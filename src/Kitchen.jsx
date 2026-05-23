// Kitchen.jsx — GNSI Portal v2.0
// ─────────────────────────────────────────────────────────────────────────────
//  Daily Kitchen Expenditure Tracker
//  Meals: Morning Breakfast · Lunch · Evening Breakfast · Dinner
//
//  Supabase Tables Required:
//
//  1. kitchen_expenditure
//     id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
//     meal_type     text NOT NULL CHECK (meal_type IN ('morning_breakfast','lunch','evening_breakfast','dinner'))
//     expense_date  date NOT NULL DEFAULT CURRENT_DATE
//     amount        numeric(10,2) NOT NULL DEFAULT 0
//     item_details  text          -- free-text or comma-sep items
//     prepared_by   text          -- cook/staff name
//     pax_count     int           -- students served
//     vendor        text          -- supplier name
//     meal_rating   int CHECK (meal_rating BETWEEN 1 AND 5)
//     serving_time  time          -- actual serving time
//     receipt_url   text          -- Supabase Storage URL
//     notes         text
//     created_at    timestamptz DEFAULT now()
//     updated_at    timestamptz DEFAULT now()
//
//  2. kitchen_budgets
//     id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
//     month         text NOT NULL UNIQUE  -- e.g. "2025-06"
//     budget_amount numeric(10,2) NOT NULL
//     created_at    timestamptz DEFAULT now()
//
//  3. kitchen_daily_locks
//     id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
//     lock_date     date NOT NULL UNIQUE
//     locked_by     text
//     locked_at     timestamptz DEFAULT now()
//
//  Enable Supabase Storage bucket: "kitchen-receipts" (public)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  navy:    { 50:'#EEF2FF',100:'#C7D2FE',300:'#818CF8',500:'#3730A3',700:'#1E1B4B',900:'#0F0D26' },
  indigo:  { 50:'#EEF2FF',100:'#C7D2FE',400:'#6366F1',500:'#4F46E5',600:'#4338CA',700:'#3730A3' },
  emerald: { 50:'#ECFDF5',100:'#D1FAE5',300:'#6EE7B7',500:'#10B981',600:'#059669',700:'#047857' },
  amber:   { 50:'#FFFBEB',100:'#FEF3C7',200:'#FDE68A',300:'#FCD34D',500:'#F59E0B',600:'#D97706',700:'#B45309' },
  orange:  { 50:'#FFF7ED',100:'#FFEDD5',200:'#FED7AA',300:'#FDBA74',500:'#F97316',600:'#EA580C',700:'#C2410C' },
  violet:  { 50:'#F5F3FF',100:'#EDE9FE',400:'#A78BFA',500:'#8B5CF6',600:'#7C3AED',700:'#6D28D9' },
  rose:    { 50:'#FFF1F2',100:'#FFE4E6',200:'#FECDD3',500:'#F43F5E',600:'#E11D48',700:'#BE123C' },
  slate:   { 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A' },
  sky:     { 50:'#F0F9FF',100:'#E0F2FE',400:'#38BDF8',500:'#0EA5E9',600:'#0284C7',700:'#0369A1' },
  teal:    { 50:'#F0FDFA',100:'#CCFBF1',500:'#14B8A6',600:'#0D9488',700:'#0F766E' },
  lime:    { 50:'#F7FEE7',100:'#ECFCCB',500:'#84CC16',600:'#65A30D',700:'#4D7C0F' },
}

// ─── Meal Config ──────────────────────────────────────────────────────────────
const MEALS = {
  morning_breakfast: { label:'Morning Breakfast', short:'M.Bfast', emoji:'🌅', time:'07:00', color: T.amber,   gradient:`linear-gradient(135deg,${T.amber[600]},${T.amber[400]})` },
  lunch:             { label:'Lunch',             short:'Lunch',   emoji:'🍱', time:'12:30', color: T.emerald, gradient:`linear-gradient(135deg,${T.emerald[600]},${T.emerald[400]})` },
  evening_breakfast: { label:'Evening Breakfast', short:'E.Bfast', emoji:'🌇', time:'16:30', color: T.orange,  gradient:`linear-gradient(135deg,${T.orange[600]},${T.orange[400]})` },
  dinner:            { label:'Dinner',            short:'Dinner',  emoji:'🌙', time:'19:30', color: T.indigo,  gradient:`linear-gradient(135deg,${T.indigo[600]},${T.indigo[400]})` },
}
const MEAL_KEYS = ['morning_breakfast','lunch','evening_breakfast','dinner']

// ─── Common Item Presets ──────────────────────────────────────────────────────
const PRESET_ITEMS = ['Rice','Dal','Oil','Sugar','Salt','Vegetables','Eggs','Milk','Bread','Flour','Potato','Onion','Tomato','Chicken','Fish','Paneer','Ghee','Tea Leaves','Coffee','Spices']

// ─── Styles ───────────────────────────────────────────────────────────────────
const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:`1.5px solid ${T.slate[200]}`, fontSize:13,
  outline:'none', boxSizing:'border-box', backgroundColor:'#fff',
  color:T.slate[800], fontFamily:'system-ui,sans-serif',
  transition:'border-color .15s',
}
const labelSt = {
  display:'block', fontSize:11, fontWeight:700, color:T.slate[500],
  marginBottom:5, textTransform:'uppercase', letterSpacing:'.07em',
}
const btnBase = (bg, color, border='none') => ({
  padding:'8px 16px', borderRadius:8, background:bg, color, border,
  fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
  display:'inline-flex', alignItems:'center', gap:5,
})

// ─── Utilities ────────────────────────────────────────────────────────────────
const today    = () => new Date().toISOString().split('T')[0]
const monthKey = (d=new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
const dateFmt  = iso => iso ? new Date(iso+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
const timeFmt  = iso => iso ? new Date(iso).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'
const moneyFmt = n => `₹${Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`
const weekStart= () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); return d.toISOString().split('T')[0] }

// ─── Sub-components ───────────────────────────────────────────────────────────
function Toast({ msg, color=T.indigo[600] }) {
  return (
    <div style={{ position:'fixed',top:20,right:20,zIndex:999999,background:'#fff',border:`1px solid ${T.slate[200]}`,borderLeft:`3px solid ${color}`,borderRadius:10,padding:'11px 16px',fontSize:13,fontWeight:600,boxShadow:'0 8px 32px rgba(0,0,0,.12)',maxWidth:360,color:T.slate[800] }}>
      {msg}
    </div>
  )
}

function FieldRow({ label: lbl, children }) {
  return <div><label style={labelSt}>{lbl}</label>{children}</div>
}

function SectionDivider({ label: lbl }) {
  return (
    <div style={{ display:'flex',alignItems:'center',gap:10,margin:'20px 0 12px',color:T.slate[400] }}>
      <div style={{ flex:1,height:1,background:T.slate[200] }} />
      <span style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em' }}>{lbl}</span>
      <div style={{ flex:1,height:1,background:T.slate[200] }} />
    </div>
  )
}

function MealBadge({ type }) {
  const m = MEALS[type]
  if (!m) return null
  return (
    <span style={{ display:'inline-flex',alignItems:'center',gap:4,padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:m.color[50],color:m.color[700],border:`1px solid ${m.color[200]}` }}>
      {m.emoji} {m.short}
    </span>
  )
}

function StarRating({ value, onChange }) {
  return (
    <div style={{ display:'flex',gap:3 }}>
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n===value?0:n)}
          style={{ fontSize:18,cursor:onChange?'pointer':'default',color:n<=value?T.amber[400]:T.slate[200],transition:'color .1s' }}>★</span>
      ))}
    </div>
  )
}

function KpiCard({ label: lbl, value, accent, subtitle, icon }) {
  return (
    <div style={{ flex:1,minWidth:110,padding:'14px 16px',borderRadius:12,background:'#fff',border:`1.5px solid ${T.slate[200]}`,position:'relative',overflow:'hidden' }}>
      {icon && <div style={{ position:'absolute',right:12,top:12,fontSize:22,opacity:.15 }}>{icon}</div>}
      <div style={{ fontSize:22,fontWeight:800,color:accent||T.slate[800],lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:10,fontWeight:700,color:T.slate[500],marginTop:4,textTransform:'uppercase',letterSpacing:'.05em' }}>{lbl}</div>
      {subtitle && <div style={{ fontSize:11,color:T.slate[400],marginTop:2 }}>{subtitle}</div>}
    </div>
  )
}

// ─── Meal KPI Strip (4 meals) ─────────────────────────────────────────────────
function MealKpiStrip({ entries, dateFilter }) {
  const dayEntries = entries.filter(e => e.expense_date === dateFilter)
  return (
    <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:12 }}>
      {MEAL_KEYS.map(mk => {
        const m   = MEALS[mk]
        const amt = dayEntries.filter(e=>e.meal_type===mk).reduce((s,e)=>s+Number(e.amount),0)
        return (
          <div key={mk} style={{ flex:1,minWidth:110,padding:'12px 14px',borderRadius:10,background:'#fff',border:`1.5px solid ${m.color[200]}`,position:'relative',overflow:'hidden' }}>
            <div style={{ position:'absolute',right:10,top:8,fontSize:20,opacity:.2 }}>{m.emoji}</div>
            <div style={{ fontSize:16,fontWeight:800,color:m.color[700],lineHeight:1 }}>{moneyFmt(amt)}</div>
            <div style={{ fontSize:10,fontWeight:700,color:m.color[600],marginTop:3,textTransform:'uppercase',letterSpacing:'.05em' }}>{m.short}</div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Budget Progress Bar ──────────────────────────────────────────────────────
function BudgetBar({ spent, budget }) {
  if (!budget) return null
  const pct = Math.min((spent/budget)*100, 100)
  const over = spent > budget
  const color = pct > 90 ? T.rose[500] : pct > 70 ? T.amber[500] : T.emerald[500]
  return (
    <div style={{ marginBottom:16,padding:'14px 18px',borderRadius:10,background:'#fff',border:`1.5px solid ${T.slate[200]}` }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8 }}>
        <span style={{ fontSize:12,fontWeight:700,color:T.slate[600] }}>📊 Monthly Budget</span>
        <span style={{ fontSize:12,fontWeight:700,color:over?T.rose[600]:T.slate[700] }}>
          {moneyFmt(spent)} / {moneyFmt(budget)} {over && '⚠ OVER'}
        </span>
      </div>
      <div style={{ height:8,borderRadius:99,background:T.slate[100],overflow:'hidden' }}>
        <div style={{ height:'100%',width:`${pct}%`,borderRadius:99,background:color,transition:'width .4s' }} />
      </div>
      <div style={{ fontSize:11,color:T.slate[400],marginTop:5 }}>
        {over ? `Over budget by ${moneyFmt(spent-budget)}` : `${moneyFmt(budget-spent)} remaining (${(100-pct).toFixed(1)}%)`}
      </div>
    </div>
  )
}

// ─── Bar Chart (monthly trend) ────────────────────────────────────────────────
function MonthlyChart({ entries }) {
  const byDay = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      map[e.expense_date] = (map[e.expense_date]||0) + Number(e.amount)
    })
    return map
  }, [entries])

  const days  = Object.keys(byDay).sort()
  if (days.length === 0) return null

  const max = Math.max(...Object.values(byDay), 1)
  const avg = Object.values(byDay).reduce((a,b)=>a+b,0) / days.length

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${T.slate[200]}`,borderRadius:12,padding:'16px 20px',marginBottom:16 }}>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12 }}>
        <span style={{ fontSize:12,fontWeight:700,color:T.slate[600] }}>📈 Daily Spend — This Month</span>
        <span style={{ fontSize:11,color:T.slate[400] }}>Avg: {moneyFmt(avg)}/day</span>
      </div>
      <div style={{ display:'flex',alignItems:'flex-end',gap:3,height:80,overflowX:'auto' }}>
        {days.map(d => {
          const v = byDay[d]
          const h = Math.max((v/max)*70, 4)
          const isToday = d === today()
          const isHigh  = v === max
          return (
            <div key={d} style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:2,flexShrink:0 }} title={`${dateFmt(d)}: ${moneyFmt(v)}`}>
              <div style={{ width:18,height:h,borderRadius:'3px 3px 0 0',
                background: isHigh ? T.rose[500] : isToday ? T.indigo[500] : T.indigo[300],
                transition:'height .3s' }} />
              <span style={{ fontSize:8,color:T.slate[400],transform:'rotate(-45deg)',transformOrigin:'center',display:'block',width:16,textAlign:'center' }}>
                {new Date(d+'T00:00:00').getDate()}
              </span>
            </div>
          )
        })}
      </div>
      <div style={{ display:'flex',gap:10,marginTop:8,fontSize:10,color:T.slate[400] }}>
        <span><span style={{ color:T.rose[500] }}>■</span> Highest</span>
        <span><span style={{ color:T.indigo[500] }}>■</span> Today</span>
        <span><span style={{ color:T.indigo[300] }}>■</span> Other</span>
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
    <div style={{ background:'#fff',border:`1.5px solid ${T.slate[200]}`,borderRadius:12,padding:'16px 20px',marginBottom:16 }}>
      <div style={{ fontSize:12,fontWeight:700,color:T.slate[600],marginBottom:12 }}>🥧 Meal-wise Breakdown</div>
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {MEAL_KEYS.map(mk => {
          const m   = MEALS[mk]
          const amt = totals[mk]
          const pct = grand ? ((amt/grand)*100).toFixed(1) : 0
          return (
            <div key={mk}>
              <div style={{ display:'flex',justifyContent:'space-between',fontSize:12,color:T.slate[600],marginBottom:3 }}>
                <span>{m.emoji} {m.short}</span>
                <span style={{ fontWeight:700 }}>{moneyFmt(amt)} ({pct}%)</span>
              </div>
              <div style={{ height:6,borderRadius:99,background:T.slate[100],overflow:'hidden' }}>
                <div style={{ height:'100%',width:`${pct}%`,borderRadius:99,background:m.gradient,transition:'width .4s' }} />
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

  const values  = Object.values(byDay)
  const max     = Math.max(...values, 1)
  const now     = new Date()
  const year    = now.getFullYear()
  const month   = now.getMonth()
  const daysInM = new Date(year, month+1, 0).getDate()
  const firstDOW= new Date(year, month, 1).getDay()

  const getColor = amt => {
    if (!amt) return T.slate[100]
    const i = amt/max
    if (i > .75) return T.rose[500]
    if (i > .5)  return T.amber[400]
    if (i > .25) return T.emerald[400]
    return T.emerald[200]
  }

  const cells = []
  for (let i=0;i<firstDOW;i++) cells.push(null)
  for (let d=1;d<=daysInM;d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ d, iso, amt: byDay[iso]||0 })
  }

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${T.slate[200]}`,borderRadius:12,padding:'16px 20px',marginBottom:16 }}>
      <div style={{ fontSize:12,fontWeight:700,color:T.slate[600],marginBottom:10 }}>
        🗓 Spend Heatmap — {now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
      </div>
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3 }}>
        {['S','M','T','W','T','F','S'].map((d,i)=>(
          <div key={i} style={{ textAlign:'center',fontSize:9,fontWeight:700,color:T.slate[400],paddingBottom:2 }}>{d}</div>
        ))}
        {cells.map((c,i) => c===null
          ? <div key={`e${i}`} />
          : <div key={c.iso}
              onClick={() => onDayClick(c.iso)}
              title={`${dateFmt(c.iso)}: ${moneyFmt(c.amt)}`}
              style={{ aspectRatio:'1',borderRadius:4,background:getColor(c.amt),cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:700,color:c.amt?'#fff':T.slate[300],transition:'transform .1s',border:c.iso===today()?'2px solid '+T.indigo[500]:'none' }}>
              {c.d}
            </div>
        )}
      </div>
      <div style={{ display:'flex',gap:8,marginTop:10,fontSize:10,color:T.slate[400],flexWrap:'wrap' }}>
        {[['None',T.slate[100]],['Low',T.emerald[200]],['Mid',T.emerald[400]],['High',T.amber[400]],['Peak',T.rose[500]]].map(([l,c])=>(
          <span key={l} style={{ display:'flex',alignItems:'center',gap:3 }}>
            <span style={{ width:10,height:10,borderRadius:2,background:c,display:'inline-block' }} />{l}
          </span>
        ))}
      </div>
    </div>
  )
}

// ─── Missing Meal Alerts ──────────────────────────────────────────────────────
function MissingMealAlert({ entries, dateFilter }) {
  const present = entries.filter(e=>e.expense_date===dateFilter).map(e=>e.meal_type)
  const missing = MEAL_KEYS.filter(m => !present.includes(m))
  const now     = new Date()
  const hhmm    = now.getHours()*100 + now.getMinutes()

  const overdue = missing.filter(mk => {
    const [h,m] = MEALS[mk].time.split(':').map(Number)
    return h*100+m < hhmm
  })

  if (overdue.length === 0 || dateFilter !== today()) return null

  return (
    <div style={{ marginBottom:14,padding:'12px 16px',borderRadius:10,background:T.rose[50],border:`1px solid ${T.rose[200]}` }}>
      <div style={{ fontSize:12,fontWeight:700,color:T.rose[700],marginBottom:5 }}>⚠ Missing Meal Entries Today</div>
      <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
        {overdue.map(mk => <MealBadge key={mk} type={mk} />)}
      </div>
      <div style={{ fontSize:11,color:T.rose[500],marginTop:5 }}>These meals are past their scheduled time with no entry recorded.</div>
    </div>
  )
}

// ─── Overspend Alert ─────────────────────────────────────────────────────────
function OverspendAlert({ entries, dateFilter }) {
  const allDates = [...new Set(entries.map(e=>e.expense_date))]
  if (allDates.length < 3) return null

  const dayTotals = allDates.map(d => entries.filter(e=>e.expense_date===d).reduce((s,e)=>s+Number(e.amount),0))
  const avg       = dayTotals.reduce((a,b)=>a+b,0)/dayTotals.length
  const todayAmt  = entries.filter(e=>e.expense_date===dateFilter).reduce((s,e)=>s+Number(e.amount),0)
  const pct       = avg > 0 ? ((todayAmt-avg)/avg)*100 : 0

  if (pct < 25 || todayAmt===0) return null

  return (
    <div style={{ marginBottom:14,padding:'12px 16px',borderRadius:10,background:T.amber[50],border:`1px solid ${T.amber[300]}` }}>
      <div style={{ fontSize:12,fontWeight:700,color:T.amber[700] }}>
        📈 Today's spend is {pct.toFixed(0)}% above your daily average ({moneyFmt(avg)})
      </div>
      <div style={{ fontSize:11,color:T.amber[600],marginTop:3 }}>Today: {moneyFmt(todayAmt)} · Avg: {moneyFmt(avg)}</div>
    </div>
  )
}

// ─── Vendor Spend Summary ─────────────────────────────────────────────────────
function VendorSummary({ entries }) {
  const vendors = useMemo(() => {
    const map = {}
    entries.filter(e=>e.vendor).forEach(e => {
      if (!map[e.vendor]) map[e.vendor] = { count:0, total:0 }
      map[e.vendor].count++
      map[e.vendor].total += Number(e.amount)
    })
    return Object.entries(map).sort((a,b)=>b[1].total-a[1].total).slice(0,5)
  }, [entries])

  if (vendors.length===0) return null

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${T.slate[200]}`,borderRadius:12,padding:'16px 20px',marginBottom:16 }}>
      <div style={{ fontSize:12,fontWeight:700,color:T.slate[600],marginBottom:10 }}>🏪 Top Vendors (This Month)</div>
      <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
        {vendors.map(([name, { count, total }]) => (
          <div key={name} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 10px',borderRadius:7,background:T.slate[50],border:`1px solid ${T.slate[100]}` }}>
            <div>
              <div style={{ fontSize:12,fontWeight:700,color:T.slate[700] }}>{name}</div>
              <div style={{ fontSize:10,color:T.slate[400] }}>{count} purchases</div>
            </div>
            <div style={{ fontSize:13,fontWeight:800,color:T.teal[600] }}>{moneyFmt(total)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Item Frequency Tracker ───────────────────────────────────────────────────
function ItemFrequency({ entries }) {
  const freq = useMemo(() => {
    const map = {}
    entries.forEach(e => {
      if (!e.item_details) return
      e.item_details.split(',').map(s=>s.trim()).filter(Boolean).forEach(item => {
        map[item] = (map[item]||0)+1
      })
    })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,10)
  }, [entries])

  if (freq.length===0) return null
  const maxF = freq[0]?.[1]||1

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${T.slate[200]}`,borderRadius:12,padding:'16px 20px',marginBottom:16 }}>
      <div style={{ fontSize:12,fontWeight:700,color:T.slate[600],marginBottom:10 }}>🥦 Most Used Items</div>
      <div style={{ display:'flex',flexWrap:'wrap',gap:6 }}>
        {freq.map(([item,count]) => (
          <span key={item} style={{ padding:'4px 10px',borderRadius:99,background:T.violet[50],border:`1px solid ${T.violet[200]}`,fontSize:11,fontWeight:700,color:T.violet[700] }}>
            {item} <span style={{ color:T.violet[400] }}>×{count}</span>
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
    <div style={{ padding:'12px 16px',borderRadius:10,background:T.sky[50],border:`1px solid ${T.sky[200]}`,marginBottom:14,display:'flex',alignItems:'center',gap:14 }}>
      <span style={{ fontSize:24 }}>👤</span>
      <div>
        <div style={{ fontSize:16,fontWeight:800,color:T.sky[700] }}>{moneyFmt(cps)}</div>
        <div style={{ fontSize:11,color:T.sky[600] }}>Cost per student today · Avg {Math.round(avgPax)} students served</div>
      </div>
    </div>
  )
}

// ─── Petty Cash Ledger ────────────────────────────────────────────────────────
function PettyCashWidget({ entries, dateFilter }) {
  const [given, setGiven]     = useState('')
  const [cashLog, setCashLog] = useState([])

  const daySpend = entries.filter(e=>e.expense_date===dateFilter).reduce((s,e)=>s+Number(e.amount),0)
  const totalGiven = cashLog.filter(c=>c.date===dateFilter).reduce((s,c)=>s+Number(c.amount),0)
  const balance    = totalGiven - daySpend

  const addCash = () => {
    const amt = parseFloat(given)
    if (!amt||amt<=0) return
    setCashLog(prev => [...prev, { date: dateFilter, amount: amt, at: new Date().toLocaleTimeString() }])
    setGiven('')
  }

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${T.slate[200]}`,borderRadius:12,padding:'16px 20px',marginBottom:16 }}>
      <div style={{ fontSize:12,fontWeight:700,color:T.slate[600],marginBottom:10 }}>💵 Petty Cash Ledger</div>
      <div style={{ display:'flex',gap:8,marginBottom:10 }}>
        <input type="number" style={{ ...inp, flex:1 }} placeholder="Cash given (₹)" value={given} onChange={e=>setGiven(e.target.value)} />
        <button onClick={addCash} style={btnBase(T.teal[600],'#fff')}>+ Add</button>
      </div>
      <div style={{ display:'flex',gap:12,fontSize:12 }}>
        <span>Given: <strong style={{ color:T.emerald[600] }}>{moneyFmt(totalGiven)}</strong></span>
        <span>Spent: <strong style={{ color:T.rose[600] }}>{moneyFmt(daySpend)}</strong></span>
        <span>Balance: <strong style={{ color: balance>=0?T.emerald[600]:T.rose[600] }}>{moneyFmt(Math.abs(balance))} {balance<0?'short':''}</strong></span>
      </div>
      {cashLog.filter(c=>c.date===dateFilter).length>0 && (
        <div style={{ marginTop:8,display:'flex',flexDirection:'column',gap:3 }}>
          {cashLog.filter(c=>c.date===dateFilter).map((c,i)=>(
            <div key={i} style={{ fontSize:11,color:T.slate[500] }}>✓ {moneyFmt(c.amount)} at {c.at}</div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Menu Planner ─────────────────────────────────────────────────────────────
function MenuPlanner({ onClose }) {
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const [menu, setMenu] = useState(() => {
    const m = {}
    days.forEach(d => { m[d] = {} ; MEAL_KEYS.forEach(mk => { m[d][mk]='' }) })
    return m
  })
  const set = (day,mk,v) => setMenu(prev => ({ ...prev, [day]: { ...prev[day], [mk]:v } }))

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${T.violet[200]}`,borderRadius:14,marginBottom:16,overflow:'hidden' }}>
      <div style={{ background:T.violet[50],borderBottom:`1px solid ${T.violet[200]}`,padding:'14px 20px',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
        <span style={{ fontSize:15,fontWeight:800,color:T.violet[700] }}>📋 Weekly Menu Planner</span>
        <button onClick={onClose} style={{ width:30,height:30,borderRadius:8,border:`1px solid ${T.violet[200]}`,background:'#fff',cursor:'pointer',fontSize:16,color:T.slate[500] }}>✕</button>
      </div>
      <div style={{ overflowX:'auto',padding:'0 0 16px' }}>
        <table style={{ width:'100%',borderCollapse:'collapse',fontSize:11,minWidth:600 }}>
          <thead>
            <tr style={{ background:T.slate[50] }}>
              <th style={{ padding:'8px 14px',textAlign:'left',color:T.slate[500],fontWeight:700,borderBottom:`1px solid ${T.slate[200]}` }}>Day</th>
              {MEAL_KEYS.map(mk=>(
                <th key={mk} style={{ padding:'8px 10px',textAlign:'left',color:MEALS[mk].color[600],fontWeight:700,borderBottom:`1px solid ${T.slate[200]}` }}>
                  {MEALS[mk].emoji} {MEALS[mk].short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map(d=>(
              <tr key={d} style={{ borderBottom:`1px solid ${T.slate[100]}` }}>
                <td style={{ padding:'6px 14px',fontWeight:700,color:T.slate[700] }}>{d}</td>
                {MEAL_KEYS.map(mk=>(
                  <td key={mk} style={{ padding:'4px 8px' }}>
                    <input style={{ ...inp,padding:'5px 8px',fontSize:11 }} value={menu[d][mk]}
                      onChange={e=>set(d,mk,e.target.value)} placeholder="Menu items…" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Export Utilities ─────────────────────────────────────────────────────────
function exportToCSV(entries, month) {
  const headers = ['Date','Meal','Amount','Items','Vendor','Staff','Students','Rating','Serving Time','Notes']
  const rows = entries.map(e => [
    e.expense_date,
    MEALS[e.meal_type]?.label||e.meal_type,
    e.amount,
    e.item_details||'',
    e.vendor||'',
    e.prepared_by||'',
    e.pax_count||'',
    e.meal_rating||'',
    e.serving_time||'',
    e.notes||'',
  ])
  const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type:'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = `kitchen-${month}.csv`
  a.click()
}

function generateWhatsAppMsg(entries, dateStr) {
  const dayE   = entries.filter(e=>e.expense_date===dateStr)
  const total  = dayE.reduce((s,e)=>s+Number(e.amount),0)
  const lines  = MEAL_KEYS.map(mk => {
    const m   = MEALS[mk]
    const amt = dayE.filter(e=>e.meal_type===mk).reduce((s,e)=>s+Number(e.amount),0)
    return amt > 0 ? `${m.emoji} ${m.short}: ₹${amt.toFixed(2)}` : null
  }).filter(Boolean)
  const msg = `🍽 *GNSI Kitchen Report — ${dateFmt(dateStr)}*\n\n${lines.join('\n')}\n\n*Total: ₹${total.toFixed(2)}*\n\n_Guidance Navodaya & Sainik Institute_`
  navigator.clipboard?.writeText(msg).catch(()=>{})
  return msg
}

// ─── Entry Form ───────────────────────────────────────────────────────────────
function EntryForm({ onSave, onCancel, editing, defaultDate }) {
  const def = (k, fb='') => editing ? (editing[k]??fb) : fb
  const [form, setForm] = useState({
    meal_type:    def('meal_type', 'morning_breakfast'),
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
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const addPreset = item => {
    const cur = form.item_details.trim()
    set('item_details', cur ? cur + ', ' + item : item)
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

  const valid = form.meal_type && form.expense_date && Number(form.amount) > 0

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${MEALS[form.meal_type]?.color[200]||T.slate[200]}`,borderRadius:14,overflow:'hidden',marginBottom:16 }}>
      <div style={{ background: MEALS[form.meal_type]?.color[50]||T.slate[50], borderBottom:`1px solid ${MEALS[form.meal_type]?.color[200]||T.slate[200]}`, padding:'14px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:15,fontWeight:800,color:MEALS[form.meal_type]?.color[700]||T.slate[700] }}>
          {editing ? '✏️ Edit Entry' : '➕ Add Kitchen Entry'}
        </div>
        <button onClick={onCancel} style={{ width:30,height:30,borderRadius:8,border:`1px solid ${T.slate[200]}`,background:'#fff',cursor:'pointer',fontSize:16,color:T.slate[500] }}>✕</button>
      </div>

      <div style={{ padding:20 }}>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:4 }}>

          {/* Meal Type */}
          <FieldRow label="Meal *">
            <select style={inp} value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
              {MEAL_KEYS.map(mk=>(
                <option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>
              ))}
            </select>
          </FieldRow>

          {/* Date */}
          <FieldRow label="Date *">
            <input type="date" style={inp} value={form.expense_date} onChange={e=>set('expense_date',e.target.value)} />
          </FieldRow>

          {/* Amount */}
          <FieldRow label="Amount (₹) *">
            <input type="number" style={inp} value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00" min="0" step="0.01" />
          </FieldRow>

          {/* Serving Time */}
          <FieldRow label="Serving Time">
            <input type="time" style={inp} value={form.serving_time} onChange={e=>set('serving_time',e.target.value)} />
          </FieldRow>

          {/* Items */}
          <div style={{ gridColumn:'1/-1' }}>
            <FieldRow label="Items / Ingredients">
              <input style={inp} value={form.item_details} onChange={e=>set('item_details',e.target.value)} placeholder="e.g. Rice, Dal, Oil…" />
              <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:6 }}>
                {PRESET_ITEMS.map(item=>(
                  <button key={item} onClick={()=>addPreset(item)} style={{ padding:'3px 9px',borderRadius:99,border:`1px solid ${T.slate[200]}`,background:T.slate[50],fontSize:10,fontWeight:600,cursor:'pointer',color:T.slate[600] }}>
                    +{item}
                  </button>
                ))}
              </div>
            </FieldRow>
          </div>

          {/* Staff */}
          <FieldRow label="Prepared By">
            <input style={inp} value={form.prepared_by} onChange={e=>set('prepared_by',e.target.value)} placeholder="Cook / Staff name" />
          </FieldRow>

          {/* Vendor */}
          <FieldRow label="Vendor / Supplier">
            <input style={inp} value={form.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="Market / Supplier name" />
          </FieldRow>

          {/* Pax */}
          <FieldRow label="Students Served">
            <input type="number" style={inp} value={form.pax_count} onChange={e=>set('pax_count',e.target.value)} placeholder="0" min="0" />
          </FieldRow>

          {/* Meal Rating */}
          <FieldRow label="Meal Quality Rating">
            <StarRating value={form.meal_rating} onChange={v=>set('meal_rating',v)} />
          </FieldRow>

          {/* Notes */}
          <div style={{ gridColumn:'1/-1' }}>
            <FieldRow label="Notes">
              <textarea style={{ ...inp,resize:'vertical' }} rows={2} value={form.notes}
                onChange={e=>set('notes',e.target.value)} placeholder="Any observations about this meal…" />
            </FieldRow>
          </div>

          {/* Receipt Upload */}
          <div style={{ gridColumn:'1/-1' }}>
            <FieldRow label="Receipt Photo">
              <div style={{ display:'flex',alignItems:'center',gap:10 }}>
                <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} style={{ fontSize:11 }} />
                {uploading && <span style={{ fontSize:11,color:T.slate[400] }}>Uploading…</span>}
                {form.receipt_url && <a href={form.receipt_url} target="_blank" rel="noreferrer" style={{ fontSize:11,color:T.sky[600],textDecoration:'none',fontWeight:600 }}>📎 View</a>}
              </div>
            </FieldRow>
          </div>

        </div>

        <div style={{ display:'flex',gap:10,marginTop:16 }}>
          <button onClick={()=>valid&&onSave(editing?.id||null,form)} disabled={!valid}
            style={{ padding:'10px 24px',borderRadius:9,background:valid?MEALS[form.meal_type]?.gradient:`linear-gradient(135deg,${T.slate[300]},${T.slate[200]})`,color:'#fff',border:'none',fontSize:13,fontWeight:800,cursor:valid?'pointer':'not-allowed' }}>
            {editing ? 'Update Entry' : 'Save Entry'}
          </button>
          <button onClick={onCancel} style={{ padding:'10px 16px',borderRadius:9,border:`1px solid ${T.slate[200]}`,background:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',color:T.slate[600] }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Entry Card ───────────────────────────────────────────────────────────────
function EntryCard({ e, locked, onEdit, onDelete }) {
  const m = MEALS[e.meal_type]

  return (
    <div style={{ background:'#fff',border:`1.5px solid ${m?.color[200]||T.slate[200]}`,borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap' }}>
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:5,flexWrap:'wrap' }}>
          <MealBadge type={e.meal_type} />
          <span style={{ fontSize:17,fontWeight:800,color:m?.color[700]||T.slate[700] }}>{moneyFmt(e.amount)}</span>
          {e.meal_rating>0 && <StarRating value={e.meal_rating} />}
        </div>

        <div style={{ display:'flex',gap:12,fontSize:11,color:T.slate[500],flexWrap:'wrap' }}>
          {e.item_details && <span>🥦 {e.item_details}</span>}
          {e.prepared_by  && <span>👨‍🍳 {e.prepared_by}</span>}
          {e.vendor       && <span>🏪 {e.vendor}</span>}
          {e.pax_count    && <span>👥 {e.pax_count} students</span>}
          {e.serving_time && <span>🕐 {e.serving_time}</span>}
          {e.pax_count>0  && <span style={{ color:T.sky[600],fontWeight:600 }}>₹{(e.amount/e.pax_count).toFixed(2)}/student</span>}
        </div>

        {e.notes && <div style={{ marginTop:6,fontSize:11,color:T.slate[400],padding:'4px 8px',background:T.slate[50],borderRadius:6 }}>{e.notes}</div>}
        {e.receipt_url && <a href={e.receipt_url} target="_blank" rel="noreferrer" style={{ display:'inline-block',marginTop:5,fontSize:10,color:T.sky[600],fontWeight:600 }}>📎 Receipt</a>}
      </div>

      {!locked && (
        <div style={{ display:'flex',gap:6,flexShrink:0 }}>
          <button onClick={()=>onEdit(e)} style={{ padding:'5px 12px',borderRadius:7,background:T.slate[50],color:T.slate[600],border:`1px solid ${T.slate[200]}`,fontSize:11,fontWeight:700,cursor:'pointer' }}>Edit</button>
          <button onClick={()=>onDelete(e.id)} style={{ padding:'5px 12px',borderRadius:7,background:T.rose[50],color:T.rose[500],border:`1px solid ${T.rose[200]}`,fontSize:11,fontWeight:700,cursor:'pointer' }}>Del</button>
        </div>
      )}
    </div>
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
      <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8,padding:'8px 14px',borderRadius:9,background: isToday ? T.indigo[50] : T.slate[50],border:`1px solid ${isToday?T.indigo[200]:T.slate[200]}` }}>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <span style={{ fontSize:12,fontWeight:800,color:isToday?T.indigo[700]:T.slate[700] }}>
            {isToday ? '📌 Today — ' : ''}{dateFmt(dateStr)}
          </span>
          {locked && <span style={{ fontSize:10,fontWeight:700,color:T.rose[600],padding:'2px 8px',borderRadius:99,background:T.rose[50],border:`1px solid ${T.rose[200]}` }}>🔒 Locked</span>}
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:10 }}>
          <span style={{ fontSize:14,fontWeight:800,color:T.slate[800] }}>{moneyFmt(total)}</span>
          {!locked
            ? <button onClick={()=>onLockDay(dateStr)} style={{ padding:'4px 10px',borderRadius:7,background:T.rose[50],color:T.rose[600],border:`1px solid ${T.rose[200]}`,fontSize:10,fontWeight:700,cursor:'pointer' }}>🔒 Lock Day</button>
            : <button onClick={()=>onUnlockDay(dateStr)} style={{ padding:'4px 10px',borderRadius:7,background:T.amber[50],color:T.amber[700],border:`1px solid ${T.amber[200]}`,fontSize:10,fontWeight:700,cursor:'pointer' }}>🔓 Unlock</button>
          }
        </div>
      </div>
      <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
        {dayE.map(e=><EntryCard key={e.id} e={e} locked={locked} onEdit={onEdit} onDelete={onDelete} />)}
        {dayE.length===0 && <div style={{ fontSize:12,color:T.slate[400],textAlign:'center',padding:'12px 0' }}>No entries for this date</div>}
      </div>
    </div>
  )
}

// ─── Budget Modal ─────────────────────────────────────────────────────────────
function BudgetModal({ current, month, onSave, onClose }) {
  const [val, setVal] = useState(current||'')
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.35)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div style={{ background:'#fff',borderRadius:16,padding:28,width:360,boxShadow:'0 20px 60px rgba(0,0,0,.25)' }}>
        <div style={{ fontSize:16,fontWeight:800,color:T.slate[800],marginBottom:4 }}>Set Monthly Budget</div>
        <div style={{ fontSize:12,color:T.slate[400],marginBottom:16 }}>For {month}</div>
        <input type="number" style={{ ...inp,marginBottom:16 }} value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. 50000" />
        <div style={{ display:'flex',gap:10 }}>
          <button onClick={()=>onSave(Number(val))} style={{ flex:1,padding:'10px 0',borderRadius:9,background:`linear-gradient(135deg,${T.indigo[700]},${T.indigo[500]})`,color:'#fff',border:'none',fontSize:13,fontWeight:800,cursor:'pointer' }}>Save</button>
          <button onClick={onClose} style={{ padding:'10px 16px',borderRadius:9,border:`1px solid ${T.slate[200]}`,background:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',color:T.slate[600] }}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Kitchen() {
  const [entries,     setEntries]     = useState([])
  const [locks,       setLocks]       = useState([])       // locked date strings
  const [budget,      setBudget]      = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [formOpen,    setFormOpen]    = useState(false)
  const [editing,     setEditing]     = useState(null)
  const [toast,       setToast]       = useState(null)
  const [filterDate,  setFilterDate]  = useState(today())
  const [filterMeal,  setFilterMeal]  = useState('all')
  const [viewMonth,   setViewMonth]   = useState(monthKey())
  const [tab,         setTab]         = useState('ledger')  // ledger | analytics
  const [showBudget,  setShowBudget]  = useState(false)
  const [showMenu,    setShowMenu]    = useState(false)
  const [showWA,      setShowWA]      = useState(null)

  const showToast = (msg, color) => { setToast({ msg, color }); setTimeout(()=>setToast(null), 3500) }

  // ─── Load ─────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [from, to] = [`${viewMonth}-01`, `${viewMonth}-31`]

    const { data: eData } = await supabase
      .from('kitchen_expenditure')
      .select('*')
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending:false })
      .order('created_at',   { ascending:false })

    const { data: lData } = await supabase
      .from('kitchen_daily_locks')
      .select('lock_date')
      .gte('lock_date', from)
      .lte('lock_date', to)

    const { data: bData } = await supabase
      .from('kitchen_budgets')
      .select('*')
      .eq('month', viewMonth)
      .maybeSingle()

    setEntries(eData || [])
    setLocks((lData||[]).map(l=>l.lock_date))
    setBudget(bData?.budget_amount || null)
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
      const { error } = await supabase.from('kitchen_expenditure').update(row).eq('id', eid)
      if (error) { showToast('Update failed: '+error.message, T.rose[600]); return }
      showToast('Entry updated', T.amber[600])
    } else {
      const { error } = await supabase.from('kitchen_expenditure').insert(row)
      if (error) { showToast('Save failed: '+error.message, T.rose[600]); return }
      showToast('Entry saved ✓', T.emerald[600])
    }
    setFormOpen(false); setEditing(null); load()
  }

  const handleDelete = async id => {
    if (!confirm('Delete this entry?')) return
    const { error } = await supabase.from('kitchen_expenditure').delete().eq('id', id)
    if (error) { showToast('Delete failed: '+error.message, T.rose[600]); return }
    showToast('Entry deleted', T.rose[600]); load()
  }

  // ─── Lock / Unlock Day ────────────────────────────────────────────────────
  const handleLockDay = async dateStr => {
    if (!confirm(`Lock all entries for ${dateFmt(dateStr)}? No edits/deletions will be allowed.`)) return
    const { error } = await supabase.from('kitchen_daily_locks').insert({ lock_date: dateStr })
    if (error) { showToast('Lock failed: '+error.message, T.rose[600]); return }
    showToast(`🔒 ${dateFmt(dateStr)} locked`, T.rose[500]); load()
  }

  const handleUnlockDay = async dateStr => {
    const { error } = await supabase.from('kitchen_daily_locks').delete().eq('lock_date', dateStr)
    if (error) { showToast('Unlock failed: '+error.message, T.rose[600]); return }
    showToast(`🔓 ${dateFmt(dateStr)} unlocked`, T.amber[600]); load()
  }

  // ─── Budget Save ──────────────────────────────────────────────────────────
  const handleBudgetSave = async amount => {
    const { error } = await supabase.from('kitchen_budgets')
      .upsert({ month: viewMonth, budget_amount: amount }, { onConflict: 'month' })
    if (error) { showToast('Budget save failed', T.rose[600]); return }
    setBudget(amount); setShowBudget(false)
    showToast('Budget updated ✓', T.emerald[600])
  }

  // ─── Filtered entries ─────────────────────────────────────────────────────
  const filteredByMeal = filterMeal==='all' ? entries : entries.filter(e=>e.meal_type===filterMeal)
  const uniqueDates    = [...new Set(filteredByMeal.map(e=>e.expense_date))].sort().reverse()

  // ─── KPI ──────────────────────────────────────────────────────────────────
  const todayTotal   = entries.filter(e=>e.expense_date===today()).reduce((s,e)=>s+Number(e.amount),0)
  const weekTotal    = entries.filter(e=>e.expense_date>=weekStart()).reduce((s,e)=>s+Number(e.amount),0)
  const monthTotal   = entries.reduce((s,e)=>s+Number(e.amount),0)
  const allDays      = [...new Set(entries.map(e=>e.expense_date))]
  const avgPerDay    = allDays.length ? monthTotal/allDays.length : 0
  const highDay      = allDays.reduce((best,d)=>{
    const sum=entries.filter(e=>e.expense_date===d).reduce((s,e)=>s+Number(e.amount),0)
    return sum>best.sum?{d,sum}:best
  }, { d:null,sum:0 })

  if (loading) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',height:'60vh',gap:14,color:T.slate[500],fontFamily:'system-ui,sans-serif' }}>
      <div style={{ width:22,height:22,border:`2.5px solid ${T.slate[200]}`,borderTopColor:T.emerald[600],borderRadius:'50%',animation:'spin .7s linear infinite' }} />
      <span style={{ fontWeight:600 }}>Loading kitchen data…</span>
    </div>
  )

  return (
    <div style={{ padding:'0 24px 32px',fontFamily:'system-ui,sans-serif',background:T.slate[50],minHeight:'100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}select:focus,input:focus,textarea:focus{border-color:${T.emerald[400]}!important;box-shadow:0 0 0 3px ${T.emerald[100]}}`}</style>

      {toast && <Toast msg={toast.msg} color={toast.color} />}
      {showBudget && <BudgetModal current={budget} month={viewMonth} onSave={handleBudgetSave} onClose={()=>setShowBudget(false)} />}
      {showWA && (
        <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,.35)',zIndex:9999,display:'flex',alignItems:'center',justifyContent:'center' }} onClick={()=>setShowWA(null)}>
          <div style={{ background:'#fff',borderRadius:16,padding:24,width:380,boxShadow:'0 20px 60px rgba(0,0,0,.25)' }} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:14,fontWeight:700,color:T.slate[700],marginBottom:10 }}>📋 WhatsApp Message (Copied!)</div>
            <pre style={{ fontSize:12,color:T.slate[600],whiteSpace:'pre-wrap',background:T.slate[50],borderRadius:8,padding:12,border:`1px solid ${T.slate[200]}`,maxHeight:280,overflowY:'auto' }}>{showWA}</pre>
            <button onClick={()=>setShowWA(null)} style={{ marginTop:12,padding:'8px 20px',borderRadius:8,background:T.emerald[600],color:'#fff',border:'none',fontSize:13,fontWeight:700,cursor:'pointer' }}>Close</button>
          </div>
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ padding:'28px 0 16px',display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:14 }}>
        <div>
          <div style={{ fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.12em',color:T.slate[400],marginBottom:5 }}>GNSI Portal</div>
          <div style={{ fontSize:26,fontWeight:800,color:T.slate[900],letterSpacing:'-.03em',lineHeight:1.1 }}>Kitchen Expenditure</div>
          <div style={{ fontSize:13,color:T.slate[500],marginTop:5 }}>Track daily meal costs · Breakfast · Lunch · Dinner</div>
        </div>
        <div style={{ display:'flex',gap:8,flexWrap:'wrap' }}>
          <button onClick={()=>setShowMenu(v=>!v)} style={btnBase(T.violet[50],T.violet[700],`1px solid ${T.violet[200]}`)}>📋 Menu Planner</button>
          <button onClick={()=>setShowBudget(true)} style={btnBase(T.teal[50],T.teal[700],`1px solid ${T.teal[200]}`)}>💰 Budget</button>
          <button onClick={()=>exportToCSV(entries,viewMonth)} style={btnBase(T.slate[50],T.slate[600],`1px solid ${T.slate[200]}`)}>⬇ CSV</button>
          <button onClick={()=>{ const msg=generateWhatsAppMsg(entries,filterDate); setShowWA(msg) }} style={btnBase(`linear-gradient(135deg,#25D366,#128C7E)`,'#fff')}>
            📲 WhatsApp
          </button>
          <button onClick={()=>{ setEditing(null); setFormOpen(true) }}
            style={{ padding:'10px 20px',borderRadius:10,background:`linear-gradient(135deg,${T.emerald[700]},${T.emerald[500]})`,color:'#fff',border:'none',fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:8,boxShadow:`0 4px 12px rgba(5,150,105,.3)` }}>
            <span style={{ fontSize:18,lineHeight:1 }}>+</span> Add Entry
          </button>
        </div>
      </div>

      {/* ── Month Picker ── */}
      <div style={{ display:'flex',gap:10,alignItems:'center',marginBottom:16,flexWrap:'wrap' }}>
        <input type="month" style={{ ...inp,width:'auto',padding:'7px 12px',fontSize:13 }} value={viewMonth} onChange={e=>setViewMonth(e.target.value)} />
        <div style={{ display:'flex',borderRadius:9,overflow:'hidden',border:`1.5px solid ${T.slate[200]}` }}>
          {[['ledger','📋 Ledger'],['analytics','📊 Analytics']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{ padding:'8px 18px',background:tab===k?T.emerald[600]:'#fff',color:tab===k?'#fff':T.slate[600],border:'none',fontSize:12,fontWeight:700,cursor:'pointer' }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ── KPI Strip ── */}
      <div style={{ display:'flex',gap:8,flexWrap:'wrap',marginBottom:16 }}>
        <KpiCard label="Today"       value={moneyFmt(todayTotal)}  accent={T.emerald[600]} icon="🌅" subtitle={today()} />
        <KpiCard label="This Week"   value={moneyFmt(weekTotal)}   accent={T.indigo[600]}  icon="📅" />
        <KpiCard label="This Month"  value={moneyFmt(monthTotal)}  accent={T.violet[600]}  icon="🗓" subtitle={viewMonth} />
        <KpiCard label="Daily Avg"   value={moneyFmt(avgPerDay)}   accent={T.teal[600]}    icon="📈" />
        <KpiCard label="Peak Day"    value={highDay.d?dateFmt(highDay.d):'—'} accent={T.rose[500]} icon="🔺" subtitle={highDay.d?moneyFmt(highDay.sum):''} />
      </div>

      {/* ── Budget Bar ── */}
      <BudgetBar spent={monthTotal} budget={budget} />

      {/* ── Menu Planner ── */}
      {showMenu && <MenuPlanner onClose={()=>setShowMenu(false)} />}

      {/* ── Form ── */}
      {formOpen && (
        <EntryForm
          onSave={handleSave}
          onCancel={()=>{ setFormOpen(false); setEditing(null) }}
          editing={editing}
          defaultDate={filterDate}
        />
      )}

      {/* ══ LEDGER TAB ══ */}
      {tab==='ledger' && (
        <>
          {/* Filters */}
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

          {/* Today alerts */}
          <OverspendAlert entries={entries} dateFilter={filterDate} />
          <MissingMealAlert entries={entries} dateFilter={filterDate} />
          <CostPerStudentCard entries={entries} dateFilter={filterDate} />

          {/* Today's 4-meal strip */}
          <MealKpiStrip entries={entries} dateFilter={filterDate} />

          {/* Petty Cash */}
          <PettyCashWidget entries={entries} dateFilter={filterDate} />

          {/* Day groups */}
          {uniqueDates.length===0 && (
            <div style={{ display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 20px',textAlign:'center' }}>
              <div style={{ width:64,height:64,borderRadius:16,background:T.slate[100],display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,marginBottom:16 }}>🍽</div>
              <div style={{ fontSize:16,fontWeight:700,color:T.slate[700],marginBottom:6 }}>No entries yet</div>
              <p style={{ fontSize:13,color:T.slate[400],maxWidth:'38ch',lineHeight:1.6,margin:'0 0 20px' }}>
                Start by adding your first kitchen entry for today's meals.
              </p>
              <button onClick={()=>setFormOpen(true)} style={{ padding:'10px 22px',borderRadius:10,background:`linear-gradient(135deg,${T.emerald[700]},${T.emerald[500]})`,color:'#fff',border:'none',fontSize:13,fontWeight:800,cursor:'pointer' }}>
                + Add First Entry
              </button>
            </div>
          )}

          {uniqueDates.length>0 && (
            <>
              <SectionDivider label={`Entries (${filteredByMeal.length})`} />
              {uniqueDates.map(d=>(
                <DayGroup
                  key={d}
                  dateStr={d}
                  entries={filteredByMeal}
                  locks={locks}
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
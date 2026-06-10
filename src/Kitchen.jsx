// Kitchen.jsx — Tailwind CSS Redesign v4.0
// Complete utility-first redesign preserving all v3.3 functionality
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from './supabase.js'

// ─── Design Tokens (mapped to Tailwind classes) ───────────────────────────────
const THEME = {
  terra: {
    50: 'bg-orange-50', 100: 'bg-orange-100', 200: 'bg-orange-200',
    300: 'bg-orange-300', 400: 'bg-orange-400', 500: 'bg-orange-500',
    600: 'bg-orange-600', 700: 'bg-orange-700', 800: 'bg-orange-800', 900: 'bg-orange-900',
    text50: 'text-orange-50', text100: 'text-orange-100', text200: 'text-orange-200',
    text300: 'text-orange-300', text400: 'text-orange-400', text500: 'text-orange-500',
    text600: 'text-orange-600', text700: 'text-orange-700', text800: 'text-orange-800', text900: 'text-orange-900',
    border50: 'border-orange-50', border100: 'border-orange-100', border200: 'border-orange-200',
    border300: 'border-orange-300', border400: 'border-orange-400', border500: 'border-orange-500',
    border600: 'border-orange-600', border700: 'border-orange-700', border800: 'border-orange-800', border900: 'border-orange-900',
  },
  saffron: {
    50: 'bg-amber-50', 100: 'bg-amber-100', 200: 'bg-amber-200',
    300: 'bg-amber-300', 400: 'bg-amber-400', 500: 'bg-amber-500',
    600: 'bg-amber-600', 700: 'bg-amber-700', 800: 'bg-amber-800', 900: 'bg-amber-900',
    text50: 'text-amber-50', text100: 'text-amber-100', text200: 'text-amber-200',
    text300: 'text-amber-300', text400: 'text-amber-400', text500: 'text-amber-500',
    text600: 'text-amber-600', text700: 'text-amber-700', text800: 'text-amber-800', text900: 'text-amber-900',
    border50: 'border-amber-50', border100: 'border-amber-100', border200: 'border-amber-200',
    border300: 'border-amber-300', border400: 'border-amber-400', border500: 'border-amber-500',
    border600: 'border-amber-600', border700: 'border-amber-700', border800: 'border-amber-800', border900: 'border-amber-900',
  },
  forest: {
    50: 'bg-green-50', 100: 'bg-green-100', 200: 'bg-green-200',
    300: 'bg-green-300', 400: 'bg-green-400', 500: 'bg-green-500',
    600: 'bg-green-600', 700: 'bg-green-700', 800: 'bg-green-800', 900: 'bg-green-900',
    text50: 'text-green-50', text100: 'text-green-100', text200: 'text-green-200',
    text300: 'text-green-300', text400: 'text-green-400', text500: 'text-green-500',
    text600: 'text-green-600', text700: 'text-green-700', text800: 'text-green-800', text900: 'text-green-900',
    border50: 'border-green-50', border100: 'border-green-100', border200: 'border-green-200',
    border300: 'border-green-300', border400: 'border-green-400', border500: 'border-green-500',
    border600: 'border-green-600', border700: 'border-green-700', border800: 'border-green-800', border900: 'border-green-900',
  },
  teal: {
    50: 'bg-teal-50', 100: 'bg-teal-100', 200: 'bg-teal-200',
    300: 'bg-teal-300', 400: 'bg-teal-400', 500: 'bg-teal-500',
    600: 'bg-teal-600', 700: 'bg-teal-700', 800: 'bg-teal-800', 900: 'bg-teal-900',
    text50: 'text-teal-50', text100: 'text-teal-100', text200: 'text-teal-200',
    text300: 'text-teal-300', text400: 'text-teal-400', text500: 'text-teal-500',
    text600: 'text-teal-600', text700: 'text-teal-700', text800: 'text-teal-800', text900: 'text-teal-900',
    border50: 'border-teal-50', border100: 'border-teal-100', border200: 'border-teal-200',
    border300: 'border-teal-300', border400: 'border-teal-400', border500: 'border-teal-500',
    border600: 'border-teal-600', border700: 'border-teal-700', border800: 'border-teal-800', border900: 'border-teal-900',
  },
  ink: {
    50: 'bg-stone-50', 100: 'bg-stone-100', 200: 'bg-stone-200',
    300: 'bg-stone-300', 400: 'bg-stone-400', 500: 'bg-stone-500',
    600: 'bg-stone-600', 700: 'bg-stone-700', 800: 'bg-stone-800', 900: 'bg-stone-900',
    text50: 'text-stone-50', text100: 'text-stone-100', text200: 'text-stone-200',
    text300: 'text-stone-300', text400: 'text-stone-400', text500: 'text-stone-500',
    text600: 'text-stone-600', text700: 'text-stone-700', text800: 'text-stone-800', text900: 'text-stone-900',
    border50: 'border-stone-50', border100: 'border-stone-100', border200: 'border-stone-200',
    border300: 'border-stone-300', border400: 'border-stone-400', border500: 'border-stone-500',
    border600: 'border-stone-600', border700: 'border-stone-700', border800: 'border-stone-800', border900: 'border-stone-900',
  },
  slate: {
    50: 'bg-slate-50', 100: 'bg-slate-100', 200: 'bg-slate-200',
    300: 'bg-slate-300', 400: 'bg-slate-400', 500: 'bg-slate-500',
    600: 'bg-slate-600', 700: 'bg-slate-700', 800: 'bg-slate-800', 900: 'bg-slate-900',
    text50: 'text-slate-50', text100: 'text-slate-100', text200: 'text-slate-200',
    text300: 'text-slate-300', text400: 'text-slate-400', text500: 'text-slate-500',
    text600: 'text-slate-600', text700: 'text-slate-700', text800: 'text-slate-800', text900: 'text-slate-900',
    border50: 'border-slate-50', border100: 'border-slate-100', border200: 'border-slate-200',
    border300: 'border-slate-300', border400: 'border-slate-400', border500: 'border-slate-500',
    border600: 'border-slate-600', border700: 'border-slate-700', border800: 'border-slate-800', border900: 'border-slate-900',
  },
  rose: {
    50: 'bg-rose-50', 100: 'bg-rose-100', 200: 'bg-rose-200',
    300: 'bg-rose-300', 400: 'bg-rose-400', 500: 'bg-rose-500',
    600: 'bg-rose-600', 700: 'bg-rose-700', 800: 'bg-rose-800', 900: 'bg-rose-900',
    text50: 'text-rose-50', text100: 'text-rose-100', text200: 'text-rose-200',
    text300: 'text-rose-300', text400: 'text-rose-400', text500: 'text-rose-500',
    text600: 'text-rose-600', text700: 'text-rose-700', text800: 'text-rose-800', text900: 'text-rose-900',
    border50: 'border-rose-50', border100: 'border-rose-100', border200: 'border-rose-200',
    border300: 'border-rose-300', border400: 'border-rose-400', border500: 'border-rose-500',
    border600: 'border-rose-600', border700: 'border-rose-700', border800: 'border-rose-800', border900: 'border-rose-900',
  },
  sky: {
    50: 'bg-sky-50', 100: 'bg-sky-100', 200: 'bg-sky-200',
    300: 'bg-sky-300', 400: 'bg-sky-400', 500: 'bg-sky-500',
    600: 'bg-sky-600', 700: 'bg-sky-700', 800: 'bg-sky-800', 900: 'bg-sky-900',
    text50: 'text-sky-50', text100: 'text-sky-100', text200: 'text-sky-200',
    text300: 'text-sky-300', text400: 'text-sky-400', text500: 'text-sky-500',
    text600: 'text-sky-600', text700: 'text-sky-700', text800: 'text-sky-800', text900: 'text-sky-900',
    border50: 'border-sky-50', border100: 'border-sky-100', border200: 'border-sky-200',
    border300: 'border-sky-300', border400: 'border-sky-400', border500: 'border-sky-500',
    border600: 'border-sky-600', border700: 'border-sky-700', border800: 'border-sky-800', border900: 'border-sky-900',
  },
  violet: {
    50: 'bg-violet-50', 100: 'bg-violet-100', 200: 'bg-violet-200',
    300: 'bg-violet-300', 400: 'bg-violet-400', 500: 'bg-violet-500',
    600: 'bg-violet-600', 700: 'bg-violet-700', 800: 'bg-violet-800', 900: 'bg-violet-900',
    text50: 'text-violet-50', text100: 'text-violet-100', text200: 'text-violet-200',
    text300: 'text-violet-300', text400: 'text-violet-400', text500: 'text-violet-500',
    text600: 'text-violet-600', text700: 'text-violet-700', text800: 'text-violet-800', text900: 'text-violet-900',
    border50: 'border-violet-50', border100: 'border-violet-100', border200: 'border-violet-200',
    border300: 'border-violet-300', border400: 'border-violet-400', border500: 'border-violet-500',
    border600: 'border-violet-600', border700: 'border-violet-700', border800: 'border-violet-800', border900: 'border-violet-900',
  },
}

// ─── Tailwind Global Styles (injected via <style>) ───────────────────────────
const TAILWIND_GLOBAL = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }
  @keyframes shimmer { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
  @keyframes spin { to { transform:rotate(360deg) } }
  @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }

  .animate-fade-up { animation: fadeUp .3s ease both; }
  .animate-fade-in { animation: fadeIn .2s ease both; }
  .animate-slide-down { animation: slideDown .25s ease both; }
  .animate-blink { animation: blink 1.4s ease-in-out infinite; }
  .animate-shimmer { animation: shimmer 1.2s ease-in-out infinite; }
  .animate-spin-slow { animation: spin 1s linear infinite; }

  .stagger > * { animation: fadeUp .3s ease both; }
  .stagger > *:nth-child(1) { animation-delay: .03s; }
  .stagger > *:nth-child(2) { animation-delay: .07s; }
  .stagger > *:nth-child(3) { animation-delay: .11s; }
  .stagger > *:nth-child(4) { animation-delay: .15s; }
  .stagger > *:nth-child(5) { animation-delay: .19s; }

  .font-display { font-family: 'Playfair Display', 'Georgia', serif; }
  .font-body { font-family: 'DM Sans', 'Segoe UI', system-ui, sans-serif; }
  .font-mono { font-family: 'DM Mono', 'Courier New', monospace; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d6d3d1; border-radius: 999px; }
  ::-webkit-scrollbar-thumb:hover { background: #a8a29e; }

  @media print {
    .no-print { display: none !important; }
    .gnsi-kitchen { background: #fff; }
  }
`

// ─── Meal Config ──────────────────────────────────────────────────────────────
const MEALS = {
  lunch:             { label:'Morning Lunch',       short:'Lunch',   emoji:'🍱', time:'12:30', twBg:'bg-green-600', twSoft:'bg-green-50', twBorder:'border-green-200', twText:'text-green-800', accent:'#166534' },
  morning_breakfast: { label:'Afternoon Breakfast', short:'A.Bfast', emoji:'☕', time:'14:30', twBg:'bg-amber-500', twSoft:'bg-amber-50', twBorder:'border-amber-200', twText:'text-amber-800', accent:'#92400E' },
  evening_breakfast: { label:'Evening Breakfast',   short:'E.Bfast', emoji:'🌇', time:'16:30', twBg:'bg-orange-500', twSoft:'bg-orange-50', twBorder:'border-orange-200', twText:'text-orange-800', accent:'#7A2A0A' },
  dinner:            { label:'Dinner',              short:'Dinner',  emoji:'🌙', time:'19:30', twBg:'bg-teal-700', twSoft:'bg-teal-50', twBorder:'border-teal-200', twText:'text-teal-800', accent:'#134E4A' },
}
const MEAL_KEYS = ['lunch','morning_breakfast','evening_breakfast','dinner']

const COOKS = [
  'Khundrakpam Jamuna Devi',
  'Ningthoujam Madhomti Devi',
  'Ningthoujam Santi Devi',
  'Khundrakpam Premabati Devi',
]
const COOK_SHIFTS = {
  morning: { label:'Morning Shift', short:'Morning', emoji:'🌅', time:'06:30–09:00 AM', defaultIn:'06:30', defaultOut:'09:00', twSoft:'bg-amber-50', twBorder:'border-amber-200', twText:'text-amber-800' },
  evening: { label:'Evening Shift', short:'Evening', emoji:'🌇', time:'06:00–09:00 PM', defaultIn:'18:00', defaultOut:'21:00', twSoft:'bg-orange-50', twBorder:'border-orange-200', twText:'text-orange-800' },
}
const MANIPURI_PRESETS = {
  lunch:             ['Chak (Rice)','Kangsoi','Eromba','Nga Thongba','Hawai Thongba','Alu Kangmet','Khichdi','Papad','Pickle','Sabzi'],
  morning_breakfast: ['Tea','Bread','Rusk','Halwa','Egg','Milk','Banana','Biscuit','Momo','Chak-hao Kheer'],
  evening_breakfast: ['Tea','Bread','Rusk','Singju','Pakora','Samosa','Bread Pakora','Chow Chow','Biscuit','Fruits'],
  dinner:            ['Chak (Rice)','Dal','Sabzi','Nga Thongba','Paneer','Chapati','Khichdi','Soup','Papad'],
}
const LOCAL_VENDORS = ['Khangabok Market','Thoubal Bazaar','Ima Keithel','Wangjing Market','Chandani Shop','Imphal Market','Thangal Bazaar','Lamlong Bazaar','Local Farmer','Daily Supplier']
const ITEM_CATEGORIES = {
  grain:     { label:'Grain / Cereal', emoji:'🌾', twSoft:'bg-amber-50', twBorder:'border-amber-200', twText:'text-amber-800' },
  vegetable: { label:'Vegetable',      emoji:'🥦', twSoft:'bg-green-50', twBorder:'border-green-200', twText:'text-green-800' },
  protein:   { label:'Protein',        emoji:'🍗', twSoft:'bg-orange-50', twBorder:'border-orange-200', twText:'text-orange-800' },
  dairy:     { label:'Dairy',          emoji:'🥛', twSoft:'bg-sky-50', twBorder:'border-sky-200', twText:'text-sky-800' },
  spice:     { label:'Spice / Masala', emoji:'🌶️', twSoft:'bg-rose-50', twBorder:'border-rose-200', twText:'text-rose-800' },
  oil:       { label:'Oil / Fat',      emoji:'🫙', twSoft:'bg-stone-50', twBorder:'border-stone-200', twText:'text-stone-800' },
  other:     { label:'Other',          emoji:'📦', twSoft:'bg-slate-50', twBorder:'border-slate-200', twText:'text-slate-800' },
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
// TAILWIND PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════════

function Toast({ msg, color = 'bg-green-600' }) {
  const colorMap = {
    'bg-green-600': '#22c55e',
    'bg-rose-600': '#e11d48',
    'bg-amber-600': '#d97706',
    'bg-orange-600': '#ea580c',
    'bg-teal-600': '#0d9488',
    'bg-sky-600': '#0284c7',
    'bg-stone-600': '#78716c',
  }
  return (
    <div className="no-print animate-fade-in fixed top-5 right-5 z-[999999] bg-white rounded-xl px-5 py-3.5 text-sm font-semibold font-body shadow-lg border border-stone-100 border-l-4 max-w-sm text-stone-800 flex items-center gap-2.5"
      style={{ borderLeftColor: colorMap[color] || color }}>
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {msg}
    </div>
  )
}

function Field({ label, sub, children, span }) {
  return (
    <div className={span ? `col-span-${span}` : ''}>
      <label className="block text-[10.5px] font-bold text-stone-500 mb-1.5 uppercase tracking-wider font-body">
        {label}
        {sub && <span className="font-normal text-stone-400 ml-1.5 normal-case tracking-normal">{sub}</span>}
      </label>
      {children}
    </div>
  )
}

function MealBadge({ type, size = 'sm' }) {
  const m = MEALS[type]; if (!m) return null
  const sizeClasses = size === 'sm' ? 'text-[10px] px-2.5 py-0.5' : 'text-[11.5px] px-3 py-1'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-bold tracking-wide ${sizeClasses} ${m.twSoft} ${m.twText} ${m.twBorder} border`}>
      {m.emoji} {m.short}
    </span>
  )
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(n => (
        <span key={n} onClick={() => onChange && onChange(n===value?0:n)}
          className={`text-lg transition-all duration-100 inline-block cursor-${onChange ? 'pointer' : 'default'} hover:scale-125`}
          style={{ color: n <= value ? '#f59e0b' : '#e7e5e4' }}>★</span>
      ))}
    </div>
  )
}

function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 my-5 text-[10px] font-bold uppercase tracking-widest text-orange-400">
      <div className="flex-1 h-px bg-gradient-to-r from-orange-100 to-transparent" />
      {label}
      <div className="flex-1 h-px bg-gradient-to-l from-orange-100 to-transparent" />
    </div>
  )
}

function LoadingBar() {
  return (
    <div className="h-0.5 rounded-full bg-stone-100 overflow-hidden mb-5 relative">
      <div className="absolute top-0 left-0 h-full w-2/5 rounded-full bg-gradient-to-r from-orange-300 to-orange-500 animate-shimmer" />
    </div>
  )
}

function StatPill({ label, value, color }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ backgroundColor: `${color}18`, color: color, border: `1px solid ${color}30` }}>
      <span className="font-bold">{value}</span>
      <span className="opacity-70 font-normal text-[10px]">{label}</span>
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// KPI SYSTEM (Tailwind)
// ═══════════════════════════════════════════════════════════════════════════════
function KpiCard({ label, value, accent, subtitle, icon, pulse, trend }) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 relative overflow-hidden flex-1 min-w-[140px] animate-fade-up">
      <div className="absolute -right-2.5 -top-2.5 w-16 h-16 rounded-full opacity-10 pointer-events-none" style={{ backgroundColor: accent }} />
      {icon && <div className="absolute right-4 top-3.5 text-[22px] opacity-10">{icon}</div>}
      {pulse && (
        <div className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-orange-500 animate-blink shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
      )}
      <div className="font-display text-2xl font-bold leading-none tracking-tight" style={{ color: accent || '#1c1917' }}>
        {value}
      </div>
      <div className="text-[10.5px] font-bold text-stone-400 mt-1.5 uppercase tracking-wider font-body">
        {label}
      </div>
      {subtitle && <div className="text-[10px] text-stone-300 mt-1 font-mono">{subtitle}</div>}
      {trend !== undefined && (
        <div className={`mt-2 text-[11px] font-semibold ${trend >= 0 ? 'text-rose-600' : 'text-green-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  )
}

function MealKpiStrip({ entries, dateFilter }) {
  const dayEntries = entries.filter(e => e.expense_date === dateFilter)
  return (
    <div className="grid grid-cols-4 gap-2 mb-4">
      {MEAL_KEYS.map(mk => {
        const m   = MEALS[mk]
        const mEntries = dayEntries.filter(e=>e.meal_type===mk)
        const amt = mEntries.reduce((s,e)=>s+Number(e.amount),0)
        const hasEntry = mEntries.length > 0
        const [h,min] = m.time.split(':').map(Number)
        const isPast  = h*100+min < nowHHMM()
        const isMissing = !hasEntry && isPast && dateFilter === today()
        return (
          <div key={mk} className={`rounded-xl p-3.5 relative overflow-hidden border-[1.5px] ${
            isMissing ? 'bg-rose-50 border-rose-200' : hasEntry ? m.twSoft : 'bg-white border-stone-100'
          } ${!hasEntry && !isPast ? 'opacity-65' : 'opacity-100'}`}>
            <div className="absolute right-2 top-2 text-xl opacity-[0.13]">{m.emoji}</div>
            <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isMissing ? 'text-rose-600' : m.twText}`}>{m.short}</div>
            <div className={`font-display text-lg font-bold leading-none ${isMissing ? 'text-rose-500' : m.twText}`}>
              {hasEntry ? moneyFmt(amt) : <span className="text-xs opacity-50">{isMissing ? '⚠ Missing' : 'Upcoming'}</span>}
            </div>
            <div className={`text-[9px] mt-1 ${isMissing ? 'text-rose-400' : m.twText} opacity-60`}>{m.time}</div>
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
  const colorClass = pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-green-500'
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 mb-4 flex items-center gap-4">
      <div className="text-xl flex-shrink-0">📊</div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-xs font-bold text-stone-600">Monthly Budget</span>
          <span className="font-display text-sm font-bold text-stone-700">
            {moneyFmt(spent)} <span className="text-stone-300 font-normal text-[11px]">/ {moneyFmt(budget)}</span>
            {over && <span className="ml-2 px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">OVER</span>}
          </span>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-[600ms] ease-[cubic-bezier(.4,0,.2,1)] ${colorClass}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="text-[11px] text-stone-400 mt-1.5 font-mono">
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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 mb-4">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-sm font-bold text-stone-700 font-body">Daily Spend</div>
          <div className="text-[11px] text-stone-400 mt-0.5">This month</div>
        </div>
        <div className="text-right">
          <div className="font-display text-[15px] font-bold text-stone-700">{moneyFmt(avg)}</div>
          <div className="text-[10px] text-stone-400">daily avg</div>
        </div>
      </div>
      <div className="flex items-end gap-1 h-[100px] overflow-x-auto pb-1">
        {days.map((d, i) => {
          const v = byDay[d]
          const h = Math.max((v/max)*84, 4)
          const isToday  = d === today()
          const isPeak   = v === max
          const color    = isPeak ? '#f43f5e' : isToday ? '#ea580c' : '#fed7aa'
          return (
            <div key={d} title={`${dateFmt(d)}: ${moneyFmt(v)}`}
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
              <div className="w-[18px] rounded-t transition-all duration-[400ms] ease-[cubic-bezier(.4,0,.2,1)] group-hover:brightness-110"
                style={{ height: h, backgroundColor: color, animationDelay: `${i*.02}s` }} />
              <span className="text-[8px] text-stone-300 -rotate-45 origin-center block w-3.5 text-center">
                {new Date(d+'T00:00:00').getDate()}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2.5 mt-2.5 text-[10px]">
        {[['Today','#ea580c'],['Peak','#f43f5e'],['Other','#fed7aa']].map(([l,col])=>(
          <span key={l} className="flex items-center gap-1.5 text-stone-400">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: col }} />{l}
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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 mb-4">
      <div className="text-sm font-bold text-stone-700 mb-4">Meal-wise Breakdown</div>
      <div className="flex flex-col gap-2.5">
        {MEAL_KEYS.map(mk => {
          const m   = MEALS[mk]
          const amt = totals[mk]
          const pct = grand ? ((amt/grand)*100) : 0
          return (
            <div key={mk}>
              <div className="flex justify-between text-xs text-stone-600 mb-1">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: m.accent }} />
                  {m.label}
                </span>
                <span className="font-bold font-mono text-[11px]">
                  {moneyFmt(amt)} <span className="text-stone-400 font-normal">({pct.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-[600ms] ease-[cubic-bezier(.4,0,.2,1)]"
                  style={{ width: `${pct}%`, backgroundColor: m.accent }} />
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
    if (!amt) return '#e7e5e4'
    const i = amt/max
    if (i > .75) return '#f43f5e'
    if (i > .5)  return '#f97316'
    if (i > .25) return '#f59e0b'
    return '#fde68a'
  }

  const cells = []
  for (let i=0;i<firstDOW;i++) cells.push(null)
  for (let d=1;d<=daysInM;d++) {
    const iso = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    cells.push({ d, iso, amt:byDay[iso]||0 })
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 mb-4">
      <div className="text-sm font-bold text-stone-700 mb-3">
        Spend Heatmap — {now.toLocaleString('en-IN',{month:'long',year:'numeric'})}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d,i)=>(
          <div key={i} className="text-center text-[9px] font-bold text-stone-400 pb-1">{d}</div>
        ))}
        {cells.map((c,i) => c===null
          ? <div key={`e${i}`} />
          : <div key={c.iso} onClick={() => onDayClick(c.iso)}
              title={`${dateFmt(c.iso)}: ${moneyFmt(c.amt)}`}
              className="aspect-square rounded-md cursor-pointer flex items-center justify-center text-[9px] font-bold transition-all duration-100 hover:scale-125 hover:z-10 hover:shadow-md"
              style={{
                backgroundColor: getColor(c.amt),
                color: c.amt ? '#fff' : '#a8a29e',
                border: c.iso===today() ? '2px solid #ea580c' : '2px solid transparent',
              }}>
              {c.d}
            </div>
        )}
      </div>
      <div className="flex gap-2.5 mt-3 text-[10px] text-stone-400">
        {[['None','#e7e5e4'],['Low','#fde68a'],['Mid','#f59e0b'],['High','#f97316'],['Peak','#f43f5e']].map(([l,col])=>(
          <span key={l} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: col }} />{l}
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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 mb-4">
      <div className="text-sm font-bold text-stone-700 mb-3.5">Top Vendors</div>
      <div className="flex flex-col gap-2.5">
        {vendors.map(([name, { count, total }], i) => (
          <div key={name}>
            <div className="flex justify-between items-baseline mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-stone-400 font-mono w-3.5">{i+1}</span>
                <span className="text-xs font-semibold text-stone-700">{name}</span>
                <span className="text-[10px] text-stone-400">{count}×</span>
              </div>
              <span className="font-display text-[13px] font-bold text-teal-700">{moneyFmt(total)}</span>
            </div>
            <div className="h-1 rounded-full bg-stone-100 overflow-hidden">
              <div className="h-full rounded-full bg-teal-400 transition-all duration-500" style={{ width: `${(total/maxT)*100}%` }} />
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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 mb-4">
      <div className="text-sm font-bold text-stone-700 mb-3">Most Used Items</div>
      <div className="flex flex-wrap gap-1.5">
        {freq.map(([item,count]) => (
          <span key={item} className="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800 inline-flex items-center gap-1">
            {item}
            <span className="text-[10px] font-bold text-amber-500 font-mono">×{count}</span>
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
    <div className="bg-white rounded-xl border border-sky-200 p-4 mb-3 bg-gradient-to-br from-sky-50 to-white flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center text-[22px] flex-shrink-0">👤</div>
      <div>
        <div className="font-display text-[22px] font-bold text-sky-700 leading-none">{moneyFmt(cps)}</div>
        <div className="text-[11px] text-sky-600 mt-1">
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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 mb-4">
      <div className="text-sm font-bold text-stone-700 mb-3 flex items-center gap-1.5">
        💵 Petty Cash Ledger
        <span className="text-[10px] text-stone-400 font-normal ml-1">— {dateFmt(dateFilter)}</span>
      </div>
      <div className="flex gap-2 mb-3">
        <input className="flex-1 px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
          type="number" placeholder="Amount given (₹)" value={given} onChange={e=>setGiven(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCash()} />
        <button type="button" className="px-4 py-2 rounded-lg bg-white text-stone-600 border-[1.5px] border-stone-200 text-xs font-semibold hover:bg-stone-50 transition-all shadow-sm"
          onClick={addCash}>+ Add</button>
      </div>
      <div className="flex gap-4 flex-wrap">
        <StatPill label="given" value={moneyFmt(totalGiven)} color="#16a34a" />
        <StatPill label="spent" value={moneyFmt(daySpend)} color="#e11d48" />
        <StatPill label={balance<0?'short':'balance'} value={moneyFmt(Math.abs(balance))} color={balance>=0?'#0d9488':'#e11d48'} />
      </div>
      {cashLog.filter(c=>c.date===dateFilter).map((c,i)=>(
        <div key={i} className="text-[11px] text-stone-400 mt-1.5 font-mono">
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
    <div className="animate-fade-up mb-3.5 p-3.5 rounded-xl bg-rose-50 border-[1.5px] border-rose-200 flex items-start gap-3">
      <span className="text-lg mt-0.5">⚠️</span>
      <div>
        <div className="text-xs font-bold text-rose-700 mb-1.5">Missing meal entries — past scheduled time</div>
        <div className="flex gap-1.5 flex-wrap">
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
    <div className="animate-fade-in fixed inset-0 bg-[rgba(12,6,3,0.92)] z-[99999] flex flex-col items-center justify-center"
      onClick={onClose}>
      <div className="absolute top-4 right-4 flex gap-2" onClick={e=>e.stopPropagation()}>
        {!isPDF && <>
          <button type="button" className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 text-xs font-semibold hover:bg-white/20 transition-all"
            onClick={()=>setZoom(z=>Math.min(z+.25,3))}>🔍+</button>
          <button type="button" className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 text-xs font-semibold hover:bg-white/20 transition-all"
            onClick={()=>setZoom(z=>Math.max(z-.25,.5))}>🔍−</button>
        </>}
        <a href={url} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 text-xs font-semibold hover:bg-white/20 transition-all no-underline inline-flex items-center">
          ⬇ Download
        </a>
        {onDelete && <button type="button" className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30 text-xs font-semibold hover:bg-red-500/30 transition-all"
          onClick={onDelete}>🗑 Delete</button>}
        <button type="button" className="px-3 py-2 rounded-lg bg-white/10 text-white border border-white/20 text-xs font-semibold hover:bg-white/20 transition-all"
          onClick={onClose}>✕ Close</button>
      </div>
      <div onClick={e=>e.stopPropagation()} className="max-w-[90vw] max-h-[85vh] overflow-auto">
        {isPDF
          ? <iframe src={url} className="w-[80vw] h-[80vh] border-none rounded-xl" title="Receipt PDF" />
          : <img src={url} alt="Receipt" className="rounded-xl shadow-2xl transition-transform duration-200 max-w-[85vw]"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} />
        }
      </div>
      {!isPDF && <div className="mt-2.5 text-[10px] text-white/30">Zoom: {Math.round(zoom*100)}% · Click outside to close</div>}
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
      showToast('Item updated ✓', 'bg-amber-600')
    } else {
      await supabase.from('kitchen_items').insert(row)
      showToast('Item added ✓', 'bg-green-600')
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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm mb-4 overflow-hidden animate-slide-down">
      <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center bg-gradient-to-br from-amber-50 to-white">
        <div>
          <div className="text-[15px] font-bold text-orange-800 font-display">Item Setup</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Manage kitchen item master list</div>
        </div>
        <button type="button" className="w-8 h-8 rounded-lg bg-white text-stone-500 border-[1.5px] border-stone-200 text-sm font-semibold hover:bg-stone-50 transition-all shadow-sm flex items-center justify-center"
          onClick={onClose}>✕</button>
      </div>
      <div className="p-5">
        <div className="bg-amber-50 border-[1.5px] border-amber-200 rounded-xl p-4 mb-4">
          <div className="text-xs font-bold text-amber-800 mb-3">
            {editId ? '✏️ Edit Item' : '➕ New Item'}
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Name (English)">
              <input className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Rice" />
            </Field>
            <Field label="Local Name">
              <input className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.name_meitei} onChange={e=>setForm(f=>({...f,name_meitei:e.target.value}))} placeholder="Alternate name" />
            </Field>
            <Field label="Category">
              <select className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer bg-white"
                value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {Object.entries(ITEM_CATEGORIES).map(([k,v])=>(
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Unit">
              <select className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer bg-white"
                value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
                {['kg','g','litre','ml','piece','dozen','packet','bundle'].map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
            <Field label="Default Price (₹/unit)">
              <input type="number" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.default_price} onChange={e=>setForm(f=>({...f,default_price:e.target.value}))} placeholder="0.00" />
            </Field>
          </div>
          <div className="flex gap-2 mt-3.5">
            <button type="button" className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
              onClick={handleSave}>{editId ? 'Update' : '+ Add'}</button>
            {editId && <button type="button" className="px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
              onClick={()=>{setEditId(null);setForm({ name:'',name_meitei:'',category:'vegetable',unit:'kg',default_price:'' })}}>Cancel</button>}
          </div>
        </div>
        <div className="flex gap-2 mb-3">
          <input className="flex-1 px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
            value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search items…" />
          <select className="px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer bg-white w-auto min-w-[140px]"
            value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
            <option value="all">All Categories</option>
            {Object.entries(ITEM_CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.emoji} {v.label}</option>)}
          </select>
        </div>
        {loading ? <div className="text-center text-stone-400 py-5 text-xs">Loading…</div> : (
          <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto">
            {!filtered.length && <div className="text-center text-stone-400 py-5 text-xs">No items found</div>}
            {filtered.map(it => {
              const cat = ITEM_CATEGORIES[it.category]||ITEM_CATEGORIES.other
              return (
                <div key={it.id} className={`flex justify-between items-center px-3.5 py-2.5 rounded-lg transition-all duration-150 ${
                  it.is_active ? 'bg-white' : 'bg-stone-50'
                } border-[1.5px] ${it.is_active ? cat.twBorder : 'border-stone-100'} ${it.is_active ? 'opacity-100' : 'opacity-55'}`}>
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg w-6 text-center">{cat.emoji}</span>
                    <div>
                      <div className="text-xs font-bold text-stone-800">
                        {it.name} {it.name_meitei && <span className="text-stone-400 font-normal">· {it.name_meitei}</span>}
                      </div>
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        {cat.label} · {it.unit}{it.default_price?` · ₹${it.default_price}/${it.unit}`:''}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <button type="button" className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
                      onClick={()=>startEdit(it)}>Edit</button>
                    <button type="button" className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all border-[1.5px] ${
                      it.is_active
                        ? 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100'
                        : 'text-green-600 bg-green-50 border-green-200 hover:bg-green-100'
                    }`}
                      onClick={()=>toggleActive(it.id,it.is_active)}>
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
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm mb-4 overflow-hidden animate-slide-down">
      <div className="px-5 py-4 border-b border-stone-200 flex justify-between items-center bg-gradient-to-br from-orange-50 to-white">
        <div>
          <div className="text-[15px] font-bold text-orange-800 font-display">Admin Monitor</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Live kitchen oversight · {dateFmt(today())}</div>
        </div>
        <button type="button" className="w-8 h-8 rounded-lg bg-white text-stone-500 border-[1.5px] border-stone-200 text-sm font-semibold hover:bg-stone-50 transition-all shadow-sm flex items-center justify-center"
          onClick={onClose}>✕</button>
      </div>
      <div className="p-5">
        <div className="flex gap-2 flex-wrap mb-4 stagger">
          <KpiCard label="Today" value={moneyFmt(todayTotal)} accent="#ea580c" icon="💸" pulse />
          <KpiCard label="Month" value={moneyFmt(monthTotal)} accent="#1c1917" icon="🗓" />
          {budget && <KpiCard label="Budget Used" value={`${budgetPct.toFixed(1)}%`} accent={budgetPct>90?'#e11d48':'#f59e0b'} icon="📊" />}
          <KpiCard label="Meals Today" value={`${presentMeals.length}/4`} accent={presentMeals.length===4?'#16a34a':'#e11d48'} icon="🍽" />
        </div>
        {budgetPct > 90 && (
          <div className="p-3 rounded-xl bg-rose-50 border-[1.5px] border-rose-200 mb-3">
            <div className="text-xs font-bold text-rose-700">🚨 Budget Breach — {budgetPct.toFixed(1)}% consumed</div>
            <div className="text-[11px] text-rose-500 mt-1">Spent {moneyFmt(monthTotal)} of {moneyFmt(budget)}</div>
          </div>
        )}
        {overdueAlerts.length > 0 && (
          <div className="p-3 rounded-xl bg-amber-50 border-[1.5px] border-amber-300 mb-3.5">
            <div className="text-xs font-bold text-amber-800 mb-1.5">⏰ Missing Past-Due Entries</div>
            <div className="flex gap-1.5 flex-wrap">
              {overdueAlerts.map(mk=><MealBadge key={mk} type={mk} />)}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {mealStatus.map(({ mk, amt, isDue, isLogged, entries:me }) => {
            const m = MEALS[mk]
            const statusColor = isLogged ? 'text-green-600' : isDue ? 'text-rose-600' : 'text-stone-400'
            const statusLabel = isLogged ? '✓ Logged' : isDue ? '⚠ Missing' : '⏳ Upcoming'
            return (
              <div key={mk} className={`p-3 rounded-xl ${m.twSoft} ${m.twBorder} border-[1.5px]`}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[13px]">{m.emoji} <strong className="font-body">{m.short}</strong></span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/70 ${statusColor}`}>{statusLabel}</span>
                </div>
                <div className="font-display text-base font-bold text-stone-800">{moneyFmt(amt)}</div>
                <div className="text-[10px] text-stone-500 mt-0.5 opacity-70">Scheduled: {m.time}</div>
                {me.length>0 && me[0].prepared_by && <div className="text-[10px] text-stone-500 mt-0.5 opacity-80">👨‍🍳 {me[0].prepared_by}</div>}
              </div>
            )
          })}
        </div>
        <div className="border-t border-stone-200 pt-4">
          <div className="text-xs font-bold text-stone-600 mb-2.5">Cook Activity — Today</div>
          {!todayCookLog.length
            ? <div className="text-[11px] text-stone-400 text-center py-3">No cook log entries today</div>
            : todayCookLog.map(log => (
              <div key={log.id} className="flex justify-between items-center px-3 py-2 rounded-lg bg-stone-50 border border-stone-100 mb-1.5">
                <div>
                  <div className="text-xs font-bold text-stone-700">{log.staff_name}</div>
                  <div className="text-[10px] text-stone-400 mt-0.5 flex gap-2 items-center">
                    <MealBadge type={log.meal_type} />
                    {log.arrived_at&&<span>In: {log.arrived_at}</span>}
                    {log.left_at&&<span>Out: {log.left_at}</span>}
                  </div>
                </div>
                {log.notes && <div className="text-[10px] text-stone-400 max-w-[150px] text-right">{log.notes}</div>}
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
    <div className="bg-white rounded-xl border-[1.5px] border-green-200 mb-3.5 overflow-hidden animate-slide-down">
      <div className="px-5 py-3.5 border-b border-green-100 flex justify-between items-center bg-gradient-to-br from-green-50 to-white">
        <div className="text-sm font-bold text-green-700 font-display">Log Cook Activity</div>
        <button type="button" className="w-8 h-8 rounded-lg bg-white text-stone-500 border-[1.5px] border-stone-200 text-sm font-semibold hover:bg-stone-50 transition-all shadow-sm flex items-center justify-center"
          onClick={onClose}>✕</button>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 gap-2.5">
          <Field label="Staff / Cook Name">
            <input className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
              value={form.staff_name} onChange={e=>set('staff_name',e.target.value)} placeholder="Name" />
          </Field>
          <Field label="Meal">
            <select className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer bg-white"
              value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
              {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
            </select>
          </Field>
          <Field label="Arrived At">
            <input type="time" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
              value={form.arrived_at} onChange={e=>set('arrived_at',e.target.value)} />
          </Field>
          <Field label="Left At">
            <input type="time" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
              value={form.left_at} onChange={e=>set('left_at',e.target.value)} />
          </Field>
          <Field label="Notes" span={2}>
            <input className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
              value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any observations…" />
          </Field>
        </div>
        <div className="flex gap-2 mt-3.5">
          <button type="button" className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
            onClick={()=>form.staff_name&&onSave(form)}>Save Log</button>
          <button type="button" className="px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
            onClick={onClose}>Cancel</button>
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
    if (delErr) { setLoading(false); showToast('Save failed: '+delErr.message, 'bg-rose-600'); return }

    const { error } = await supabase.from('kitchen_cook_attendance').insert(rows)
    setLoading(false)
    if (error) { showToast('Save failed: '+error.message, 'bg-rose-600'); return }
    showToast('Attendance saved ✓', 'bg-green-600')
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
      present:  { bg:selected?'bg-green-600':'bg-green-50',  color:selected?'text-white':'text-green-700', border:selected?'border-green-600':'border-green-200' },
      absent:   { bg:selected?'bg-rose-600':'bg-rose-50',      color:selected?'text-white':'text-rose-700',   border:selected?'border-rose-600':'border-rose-200'   },
      half_day: { bg:selected?'bg-amber-500':'bg-amber-50',color:selected?'text-white':'text-amber-700',border:selected?'border-amber-500':'border-amber-200' },
    }
    const c = configs[status]
    return `px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer font-body transition-all border-[1.5px] ${c.bg} ${c.color} ${c.border}`
  }

  return (
    <div className="bg-white rounded-xl border-[1.5px] border-teal-200 mb-4 overflow-hidden animate-slide-down">
      <div className="px-5 py-4 border-b border-teal-100 flex justify-between items-center bg-gradient-to-br from-teal-50 to-white">
        <div>
          <div className="text-[15px] font-bold text-teal-700 font-display">Cook Attendance</div>
          <div className="text-[11px] text-stone-500 mt-0.5">Morning 6:30–9:00 AM · Evening 6:00–9:00 PM</div>
        </div>
        <button type="button" className="w-8 h-8 rounded-lg bg-white text-stone-500 border-[1.5px] border-stone-200 text-sm font-semibold hover:bg-stone-50 transition-all shadow-sm flex items-center justify-center"
          onClick={onClose}>✕</button>
      </div>
      <div className="p-5">
        <div className="flex gap-2.5 items-center mb-4 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border-[1.5px] border-stone-200">
            {[['mark','📋 Mark'],['monthly','📊 Monthly']].map(([k,l]) => (
              <button key={k} type="button" onClick={()=>setView(k)}
                className={`px-4 py-1.5 text-xs font-bold cursor-pointer font-body transition-all border-none ${
                  view===k ? 'bg-teal-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}>
                {l}
              </button>
            ))}
          </div>
          {view==='mark' && (
            <input type="date" className="px-3 py-1.5 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all w-auto"
              value={attDate} onChange={e=>setAttDate(e.target.value)} />
          )}
          {view==='monthly' && (
            <input type="month" className="px-3 py-1.5 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all w-auto"
              value={viewMonth} onChange={e=>setViewMonth(e.target.value)} />
          )}
        </div>

        {loading && <div className="text-center text-stone-400 py-5 text-xs">Loading…</div>}

        {!loading && view==='mark' && Object.entries(COOK_SHIFTS).map(([shift, sh]) => (
          <div key={shift} className="mb-5">
            <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl ${sh.twSoft} ${sh.twBorder} border-[1.5px] mb-2.5`}>
              <span className="text-lg">{sh.emoji}</span>
              <div className="flex-1">
                <div className={`text-xs font-extrabold ${sh.twText}`}>{sh.label}</div>
                <div className={`text-[10px] ${sh.twText} opacity-70`}>{sh.time}</div>
              </div>
              <div className="flex gap-1">
                {['present','absent','half_day'].map(st => {
                  const cnt = COOKS.filter(c=>draft[draftKey(c,shift)]?.status===st).length
                  if (!cnt) return null
                  const colors={present:'green',absent:'rose',half_day:'amber'}
                  const col=colors[st]
                  return (
                    <span key={st} className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-${col}-50 text-${col}-700 border border-${col}-200`}>
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
                <div key={cook} className={`mb-2 px-4 py-3 rounded-xl transition-all duration-150 ${
                  isAbsent ? 'bg-rose-50 border-rose-200' : 'bg-white border-stone-100'
                } border-[1.5px]`}>
                  <div className={`flex items-center justify-between flex-wrap gap-2 ${isAbsent ? 'mb-0' : 'mb-2.5'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-full ${sh.twSoft} ${sh.twBorder} border-[1.5px] flex items-center justify-center text-[13px] font-extrabold ${sh.twText} font-display`}>
                        {cook[0]}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-stone-800">{cook}</div>
                        <div className="text-[10px] text-stone-400">Cook #{ci+1}</div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {['present','absent','half_day'].map(st => (
                        <button key={st} type="button" onClick={()=>setField(cook,shift,'status',st)} className={statusBtn(st, rec.status===st)}>
                          {st==='present'?'✓ Present':st==='absent'?'✗ Absent':'½ Half'}
                        </button>
                      ))}
                    </div>
                  </div>
                  {!isAbsent && (
                    <div className="flex gap-2.5 items-center flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-0">IN</span>
                        <input type="time" className="px-2.5 py-1 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all w-auto"
                          value={rec.check_in||''} onChange={e=>setField(cook,shift,'check_in',e.target.value)} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-0">OUT</span>
                        <input type="time" className="px-2.5 py-1 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all w-auto"
                          value={rec.check_out||''} onChange={e=>setField(cook,shift,'check_out',e.target.value)} />
                      </div>
                      <input className="flex-1 min-w-[120px] px-2.5 py-1 rounded-lg border-[1.5px] border-stone-200 text-[11px] font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                        value={rec.notes||''} onChange={e=>setField(cook,shift,'notes',e.target.value)} placeholder="Notes…" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {!loading && view==='mark' && (
          <button type="button" className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-teal-600 to-teal-800 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
            onClick={saveAll} disabled={loading}>
            {loading ? 'Saving…' : '💾 Save All Attendance'}
          </button>
        )}

        {!loading && view==='monthly' && (
          <div className="flex flex-col gap-2.5">
            {monthlySummary.map(({ cook, present, absent, half, pct, mPresent, ePresent, totalDays }) => {
              const pctColor = pct>=90?'text-green-600':pct>=70?'text-amber-600':'text-rose-600'
              return (
                <div key={cook} className="bg-white rounded-xl border border-stone-200 shadow-sm p-3.5">
                  <div className="flex justify-between items-center mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-teal-50 border-[1.5px] border-teal-200 flex items-center justify-center text-sm font-extrabold text-teal-700 font-display">
                        {cook[0]}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-stone-800">{cook}</div>
                        <div className="text-[10px] text-stone-400">{totalDays} shifts · {viewMonth}</div>
                      </div>
                    </div>
                    <div className={`font-display text-[22px] font-bold ${pctColor}`}>{pct}%</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden mb-2.5">
                    <div className="h-full rounded-full transition-all duration-[600ms]"
                      style={{ width: `${pct}%`, backgroundColor: pct>=90?'#22c55e':pct>=70?'#f59e0b':'#f43f5e' }} />
                  </div>
                  <div className="flex gap-3 flex-wrap">
                    <StatPill label="present" value={present} color="#16a34a" />
                    <StatPill label="absent"  value={absent}  color="#e11d48"   />
                    <StatPill label="half"    value={half}    color="#d97706"/>
                    <StatPill label="morning" value={mPresent} color="#0d9488" />
                    <StatPill label="evening" value={ePresent} color="#ea580c"/>
                  </div>
                </div>
              )
            })}

            {monthly.length > 0 && (
              <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 mt-1 overflow-x-auto">
                <div className="text-sm font-bold text-stone-700 mb-3.5">Day-wise Detail — {viewMonth}</div>
                <table className="w-full border-collapse text-[11px] min-w-[600px]">
                  <thead>
                    <tr>
                      <th className="px-2.5 py-1.5 text-left bg-stone-50 text-stone-600 font-bold border-b-2 border-stone-100 whitespace-nowrap text-[10px]">Cook</th>
                      {[...new Set(monthly.map(r=>r.att_date))].sort().map(d=>(
                        <th key={d} className="px-1 py-1 text-center bg-stone-50 text-stone-600 font-bold border-b-2 border-stone-100 whitespace-nowrap text-[9px]">
                          {new Date(d+'T00:00:00').getDate()}<br/>
                          <span className="font-normal text-stone-400">{new Date(d+'T00:00:00').toLocaleDateString('en-IN',{weekday:'short'})}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COOKS.map(cook => {
                      const dates = [...new Set(monthly.map(r=>r.att_date))].sort()
                      const cell = (row) => {
                        if (!row) return <span className="text-stone-300">—</span>
                        if (row.status==='present')  return <span className="text-green-600 font-extrabold">✓</span>
                        if (row.status==='absent')   return <span className="text-rose-600 font-extrabold">✗</span>
                        if (row.status==='half_day') return <span className="text-amber-600 font-extrabold">½</span>
                        return null
                      }
                      return (
                        <tr key={cook} className="border-b border-stone-100">
                          <td className="px-2.5 py-1.5 font-bold text-stone-700 whitespace-nowrap text-[10px]">
                            {cook.split(' ').slice(0,2).join(' ')}
                          </td>
                          {dates.map(d => {
                            const mRow = monthly.find(r=>r.cook_name===cook&&r.att_date===d&&r.shift==='morning')
                            const eRow = monthly.find(r=>r.cook_name===cook&&r.att_date===d&&r.shift==='evening')
                            return (
                              <td key={d} className="px-1 py-1 text-center align-middle">
                                <div className="flex flex-col items-center gap-px">
                                  <span>{cell(mRow)}</span>
                                  <span className="opacity-60 text-[9px]">{cell(eRow)}</span>
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="text-[10px] text-stone-400 mt-2">
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
      <div className={`bg-white rounded-xl border-[1.5px] ${m.twBorder} mb-4 overflow-hidden animate-fade-up shadow-sm`}>
        <div className={`${m.twSoft} border-b ${m.twBorder} px-5 py-3.5 flex justify-between items-center`}>
          <div>
            <div className={`text-[15px] font-bold ${m.twText} font-display`}>
              {editing ? `✏️ Edit — ${m.label}` : `➕ Add ${m.label}`}
            </div>
            <div className={`text-[11px] ${m.twText} opacity-70 mt-0.5`}>
              {form.expense_date ? dateFmt(form.expense_date) : 'Select date'}
            </div>
          </div>
          <button type="button" className={`w-8 h-8 rounded-lg bg-white text-stone-500 border-[1.5px] ${m.twBorder} text-sm font-semibold hover:bg-stone-50 transition-all shadow-sm flex items-center justify-center`}
            onClick={onCancel}>✕</button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-2 gap-3.5">
            <Field label="Meal *">
              <select className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer bg-white"
                value={form.meal_type} onChange={e=>set('meal_type',e.target.value)}>
                {MEAL_KEYS.map(mk=><option key={mk} value={mk}>{MEALS[mk].emoji} {MEALS[mk].label}</option>)}
              </select>
            </Field>
            <Field label="Date *">
              <input type="date" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                value={form.expense_date} onChange={e=>set('expense_date',e.target.value)} />
            </Field>
            <Field label="Amount (₹) *">
              <input type="number" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.amount} onChange={e=>set('amount',e.target.value)} placeholder="0.00" min="0" step="0.01" />
            </Field>
            <Field label="Serving Time">
              <input type="time" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all"
                value={form.serving_time} onChange={e=>set('serving_time',e.target.value)} />
            </Field>

            <Field label="Items / Ingredients" span={2}>
              <input className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.item_details} onChange={e=>set('item_details',e.target.value)} placeholder="e.g. Chak, Dal, Eromba…" />
              <div className="mt-2.5">
                <div className="text-[10px] font-bold text-orange-600 mb-1.5 uppercase tracking-wider">🍛 Manipuri Dishes</div>
                <div className="flex flex-wrap gap-1">
                  {presets.map(item=>(
                    <button key={item} type="button" onClick={()=>addItem(item)}
                      className="px-2.5 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-[10px] font-semibold cursor-pointer text-amber-800 font-body transition-all hover:bg-amber-100">
                      + {item}
                    </button>
                  ))}
                </div>
              </div>
              {dbItems.length > 0 && (
                <div className="mt-2.5">
                  <div className="text-[10px] font-bold text-teal-700 mb-1.5 uppercase tracking-wider">🧺 Item List</div>
                  <div className="flex flex-wrap gap-1">
                    {dbItems.map(it=>(
                      <button key={it.id} type="button" onClick={()=>addItem(it.name)}
                        className="px-2.5 py-0.5 rounded-full border border-teal-200 bg-teal-50 text-[10px] font-semibold cursor-pointer text-teal-800 font-body transition-all hover:bg-teal-100">
                        + {it.name}{it.name_meitei?` / ${it.name_meitei}`:''}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 mt-2.5">
                <input className="flex-1 px-3 py-1.5 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                  value={customItem} onChange={e=>setCustomItem(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCustomItem()} placeholder="Type custom item + Enter" />
                <button type="button" className="px-3 py-1.5 rounded-lg bg-white text-stone-600 border-[1.5px] border-stone-200 text-xs font-semibold hover:bg-stone-50 transition-all shadow-sm"
                  onClick={addCustomItem}>+ Add</button>
              </div>
            </Field>

            <Field label="Prepared By">
              <input className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.prepared_by} onChange={e=>set('prepared_by',e.target.value)} placeholder="Cook / Staff name" />
            </Field>

            <Field label="Vendor / Supplier">
              <select className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer bg-white mb-1.5"
                value={vendorIsPreset ? form.vendor : ''}
                onChange={e => { if (e.target.value) set('vendor', e.target.value) }}>
                <option value="">— Select preset vendor —</option>
                {LOCAL_VENDORS.map(v=><option key={v} value={v}>{v}</option>)}
              </select>
              <input className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.vendor} onChange={e=>set('vendor',e.target.value)} placeholder="Or type custom vendor name…" />
            </Field>

            <Field label="Students Served">
              <input type="number" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
                value={form.pax_count} onChange={e=>set('pax_count',e.target.value)} placeholder="0" min="0" />
            </Field>

            <Field label="Meal Quality">
              <div className="pt-1">
                <StarRating value={form.meal_rating} onChange={v=>set('meal_rating',v)} />
              </div>
            </Field>

            <Field label="Notes" span={2}>
              <textarea className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300 resize-y"
                rows={2} value={form.notes} onChange={e=>set('notes',e.target.value)} placeholder="Any observations…" />
            </Field>

            <Field label="📎 Receipt / Bill Photo" span={2}>
              <div className="flex items-center gap-2.5 flex-wrap px-3.5 py-2.5 rounded-lg bg-stone-50 border-[1.5px] border-dashed border-stone-200">
                <input type="file" accept="image/*,.pdf" onChange={handleFileUpload} className="text-[11px] flex-1" />
                {uploading && <span className="text-[11px] text-stone-400">Uploading…</span>}
                {form.receipt_url && (
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <button type="button" className="px-3 py-1 rounded-lg text-[11px] font-semibold text-sky-700 border border-sky-200 bg-sky-50 hover:bg-sky-100 transition-all"
                      onClick={()=>setViewReceipt(true)}>👁 View</button>
                    <button type="button" className="px-3 py-1 rounded-lg text-[11px] font-semibold text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-all"
                      onClick={()=>set('receipt_url','')}>🗑 Remove</button>
                    <span className="text-[10px] text-green-600 font-bold">✓ Uploaded</span>
                  </div>
                )}
              </div>
            </Field>
          </div>

          <div className="flex gap-2.5 mt-5 pt-4 border-t border-stone-200">
            <button type="button" className={`px-5 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              valid ? 'bg-gradient-to-br from-orange-500 to-orange-700' : 'bg-stone-400'
            }`}
              onClick={()=>valid&&onSave(editing?.id||null,form)} disabled={!valid}>
              {editing ? 'Update Entry' : 'Save Entry'}
            </button>
            <button type="button" className="px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
              onClick={onCancel}>Cancel</button>
            {!valid && <span className="text-[11px] text-stone-400 self-center">Fill required fields *</span>}
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
      <div className={`bg-white rounded-xl border-[1.5px] ${m?.twBorder || 'border-stone-200'} p-3.5 grid grid-cols-[1fr_auto] gap-3 items-start shadow-sm ${
        m ? `bg-gradient-to-br ${m.twSoft} to-white` : 'bg-white'
      }`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <MealBadge type={e.meal_type} size="sm" />
            <span className="font-display text-xl font-bold text-stone-800 leading-none">
              {moneyFmt(e.amount)}
            </span>
            {e.meal_rating>0 && <StarRating value={e.meal_rating} />}
            {e.pax_count>0 && (
              <span className="text-[10px] text-teal-700 font-bold font-mono px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200">
                ₹{(e.amount/e.pax_count).toFixed(2)}/student
              </span>
            )}
            {e.receipt_url && (
              <button type="button" onClick={()=>setViewReceipt(true)}
                className="px-2 py-0.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-bold cursor-pointer font-body hover:bg-sky-100 transition-all">
                📎 Receipt
              </button>
            )}
          </div>
          <div className="flex gap-2.5 text-[11px] text-stone-500 flex-wrap">
            {e.item_details  && <span>🥦 {e.item_details}</span>}
            {e.prepared_by   && <span>👨‍🍳 {e.prepared_by}</span>}
            {e.vendor        && <span>🏪 {e.vendor}</span>}
            {e.pax_count     && <span>👥 {e.pax_count} students</span>}
            {e.serving_time  && <span className="font-mono">🕐 {e.serving_time}</span>}
          </div>
          {e.notes && (
            <div className="mt-1.5 text-[11px] text-stone-500 px-2.5 py-1 bg-stone-50 rounded-lg border-l-[3px] border-stone-200">
              {e.notes}
            </div>
          )}
        </div>
        {!locked && (
          <div className="flex flex-col gap-1">
            <button type="button" className="px-3 py-1 rounded-lg text-[11px] font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
              onClick={()=>onEdit(e)}>Edit</button>
            <button type="button" className="px-3 py-1 rounded-lg text-[11px] font-semibold text-rose-600 border-[1.5px] border-rose-200 bg-rose-50 hover:bg-rose-100 transition-all shadow-sm"
              onClick={()=>onDelete(e.id)}>Del</button>
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
    <div className="mb-3.5 animate-fade-up">
      <div onClick={()=>setCollapsed(c=>!c)} className={`cursor-pointer flex items-center justify-between px-4 py-2.5 rounded-xl mb-2 select-none transition-all ${
        isToday ? 'bg-gradient-to-br from-orange-50 to-white border-[1.5px] border-orange-200' : 'bg-stone-50 border-[1.5px] border-stone-200'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className={`text-xs font-bold ${isToday ? 'text-orange-700' : 'text-stone-600'}`}>
            {isToday && <span className="text-orange-500 mr-1">📌</span>}
            {dateFmt(dateStr)}
          </span>
          {isToday && <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-bold">Today</span>}
          {locked  && <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">🔒 Locked</span>}
          <span className="text-[11px] text-stone-400">{dayE.length} entries</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-display text-base font-bold text-stone-800">{moneyFmt(total)}</span>
          {!locked
            ? <button type="button" onClick={e=>{e.stopPropagation();onLockDay(dateStr)}}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-rose-600 border-[1.5px] border-rose-200 bg-rose-50 hover:bg-rose-100 transition-all shadow-sm">
                🔒 Lock
              </button>
            : <button type="button" onClick={e=>{e.stopPropagation();onUnlockDay(dateStr)}}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-amber-700 border-[1.5px] border-amber-200 bg-amber-50 hover:bg-amber-100 transition-all shadow-sm">
                🔓 Unlock
              </button>
          }
          <span className={`text-xs text-stone-400 transition-transform duration-200 inline-block ${collapsed ? '-rotate-90' : 'rotate-0'}`}>▾</span>
        </div>
      </div>
      {!collapsed && (
        <div className="flex flex-col gap-1.5">
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
    <div className="animate-fade-in fixed inset-0 bg-[rgba(32,20,10,0.45)] z-[9999] flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-white rounded-xl border border-stone-200 shadow-xl w-[400px] overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-stone-200 bg-gradient-to-br from-teal-50 to-white">
          <div className="text-[17px] font-bold text-teal-700 font-display">Set Monthly Budget</div>
          <div className="text-xs text-stone-400 mt-0.5">For {month}</div>
        </div>
        <div className="px-6 py-5">
          <Field label="Budget Amount (₹)">
            <input type="number" className="w-full px-3.5 py-2 rounded-lg border-[1.5px] border-stone-200 text-sm font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all placeholder:text-stone-300"
              value={val} onChange={e=>setVal(e.target.value)} placeholder="e.g. 50000" min="1"
              onKeyDown={e=>e.key==='Enter'&&handleSave()} />
          </Field>
          {val && Number(val) <= 0 && (
            <div className="text-[11px] text-rose-600 mt-1.5">Enter a valid amount</div>
          )}
          <div className="flex gap-2.5 mt-4">
            <button type="button" className="flex-1 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
              onClick={handleSave}>Save Budget</button>
            <button type="button" className="px-4 py-2.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
              onClick={onClose}>Cancel</button>
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
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono&display=swap" rel="stylesheet">
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'DM Sans',sans-serif; color:#1c1917; background:#fafaf9; padding:36px 48px; }
  .header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:18px; margin-bottom:28px; border-bottom:3px solid #ea580c; }
  .institute { font-family:'Playfair Display',serif; font-size:22px; font-weight:800; color:#ea580c; }
  .sub { font-size:11px; color:#78716c; margin-top:3px; }
  .title-area { text-align:right; font-size:12px; color:#57534e; font-family:'DM Mono',monospace; }
  .kpi-row { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:28px; }
  .kpi { padding:16px 18px; border-radius:10px; background:#fff; border:1.5px solid #fed7aa; }
  .kpi-val { font-family:'Playfair Display',serif; font-size:22px; font-weight:700; color:#ea580c; }
  .kpi-lbl { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:#78716c; margin-top:4px; }
  h2 { font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; color:#ea580c; margin:24px 0 12px; padding-left:12px; border-left:3px solid #ea580c; }
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { background:#fff7ed; color:#57534e; font-weight:700; padding:8px 10px; text-align:left; border-bottom:2px solid #fed7aa; text-transform:uppercase; letter-spacing:.04em; font-size:9px; }
  td { padding:7px 10px; border-bottom:1px solid #e7e5e4; color:#1c1917; font-family:'DM Mono',monospace; font-size:10px; }
  td:first-child { font-family:'DM Sans',sans-serif; font-size:11px; }
  .total-row td { font-weight:800; color:#ea580c; border-top:2px solid #ea580c; border-bottom:none; font-family:'DM Sans',sans-serif; }
  .footer { margin-top:32px; padding-top:14px; border-top:1px solid #e7e5e4; font-size:10px; color:#a8a29e; display:flex; justify-content:space-between; font-family:'DM Mono',monospace; }
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
    <div className="no-print bg-white border-b border-stone-200 shadow-sm sticky top-0 z-[100]">
      <div className="flex justify-between items-center px-7 py-2.5 border-b border-stone-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-600 to-orange-800 flex items-center justify-center text-lg flex-shrink-0">
            🍽
          </div>
          <div>
            <div className="text-base font-bold text-stone-900 font-display leading-tight">Kitchen Ledger</div>
            <div className="text-[10px] text-stone-400 mt-0.5">GNSI · Khangabok, Thoubal</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="flex rounded-lg overflow-hidden border-[1.5px] border-stone-200">
            {[['ledger','📋 Ledger'],['analytics','📊 Analytics']].map(([k,l])=>(
              <button key={k} type="button"
                onClick={() => setTab(k)}
                className={`px-4 py-1.5 text-xs font-bold cursor-pointer font-body transition-all border-none ${
                  tab===k ? 'bg-orange-600 text-white' : 'bg-white text-stone-600 hover:bg-stone-50'
                }`}>
                {l}
              </button>
            ))}
          </div>
          <div className="text-right">
            <div className="text-[13px] font-bold text-stone-700 font-mono">{timeStr}</div>
            <div className="text-[10px] text-stone-400">{dateStr}</div>
          </div>
          <button type="button" className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center gap-1"
            onClick={onAdd}>
            <span className="text-[15px] leading-none">+</span> Add Entry
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 px-7 py-2 flex-wrap">
        <input type="month" className="px-3 py-1.5 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all w-auto"
          value={viewMonth} onChange={e=>setViewMonth(e.target.value)} />

        <div className="flex-1" />

        <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
          onClick={onItemSetup}>🧺 Items</button>
        {isAdmin && <>
          <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
            onClick={onMonitor}>🛡 Monitor</button>
          <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
            onClick={onCookLog}>👨‍🍳 Cook Log</button>
          <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
            onClick={onCookAtt}>👩‍🍳 Attendance</button>
        </>}
        <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
          onClick={onBudget}>💰 Budget</button>
        <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
          onClick={onReport}>🖨 Report</button>
        <button type="button" className="px-3 py-1.5 rounded-lg text-xs font-semibold text-stone-600 bg-white border-[1.5px] border-stone-200 hover:bg-stone-50 transition-all shadow-sm"
          onClick={onCSV}>⬇ CSV</button>
        <button type="button" onClick={onWhatsApp}
          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-br from-[#25D366] to-[#128C7E] cursor-pointer inline-flex items-center gap-1 font-body shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
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
    setShowItemSetup(false)
    setShowMonitor(false)
    setShowCookLog(false)
    setShowCookAtt(false)
    setFormOpen(false)
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
      if (error) { showToast('Update failed: '+error.message, 'bg-rose-600'); return }
      showToast('Entry updated ✓', 'bg-amber-600')
    } else {
      const { error } = await supabase.from('kitchen_expenditure').insert(row)
      if (error) { showToast('Save failed: '+error.message, 'bg-rose-600'); return }
      showToast('Entry saved ✓', 'bg-green-600')
    }
    setFormOpen(false); setEditing(null); load()
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this entry?')) return
    const { error } = await supabase.from('kitchen_expenditure').delete().eq('id',id)
    if (error) { showToast('Delete failed', 'bg-rose-600'); return }
    showToast('Deleted', 'bg-rose-600'); load()
  }

  const handleLockDay = async dateStr => {
    if (!window.confirm(`Lock all entries for ${dateFmt(dateStr)}?`)) return
    await supabase.from('kitchen_daily_locks').insert({ lock_date:dateStr })
    showToast(`🔒 ${dateFmt(dateStr)} locked`, 'bg-rose-500'); load()
  }

  const handleUnlockDay = async dateStr => {
    await supabase.from('kitchen_daily_locks').delete().eq('lock_date',dateStr)
    showToast(`🔓 ${dateFmt(dateStr)} unlocked`, 'bg-amber-600'); load()
  }

  const handleBudgetSave = async amount => {
    await supabase.from('kitchen_budgets').upsert({ month:viewMonth, budget_amount:amount },{ onConflict:'month' })
    setBudget(amount); setShowBudget(false); showToast('Budget updated ✓', 'bg-green-600')
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
    if (error) { showToast('Cook log save failed: '+error.message, 'bg-rose-600'); return }
    showToast('Cook log saved ✓', 'bg-green-600')
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
    <div className="gnsi-kitchen bg-[#faf6f1] min-h-screen text-stone-900 font-body">
      <style>{TAILWIND_GLOBAL}</style>

      {/* Overlays */}
      {toast      && <Toast msg={toast.msg} color={toast.color} />}
      {showBudget && <BudgetModal current={budget} month={viewMonth} onSave={handleBudgetSave} onClose={()=>setShowBudget(false)} />}
      {showWA && (
        <div className="animate-fade-in fixed inset-0 bg-[rgba(32,20,10,0.5)] z-[9999] flex items-center justify-center backdrop-blur-sm"
          onClick={()=>setShowWA(null)}>
          <div className="bg-white rounded-xl border border-stone-200 shadow-xl w-[420px] overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-stone-200 bg-gradient-to-br from-green-50 to-white flex items-center gap-2">
              <span className="text-xl">📲</span>
              <div>
                <div className="text-sm font-bold text-green-700">WhatsApp Message — Copied!</div>
                <div className="text-[11px] text-stone-400 mt-0.5">Paste in any chat</div>
              </div>
            </div>
            <div className="px-5 py-4">
              <pre className="text-xs text-stone-600 whitespace-pre-wrap bg-stone-50 rounded-lg p-3 border border-stone-100 max-h-[250px] overflow-y-auto font-mono leading-relaxed">{showWA}</pre>
              <button type="button" className="mt-3.5 w-full px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all flex justify-center"
                onClick={()=>setShowWA(null)}>Close</button>
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

      <div ref={contentRef} className="max-w-[1080px] mx-auto px-7 py-6 h-[calc(100vh-120px)] overflow-y-auto">
        {loading && <LoadingBar />}

        <div className="flex gap-2.5 flex-wrap mb-4 stagger">
          <KpiCard label="Today"     value={moneyFmt(todayTotal)} accent="#ea580c"  icon="🌅" subtitle={today()} pulse />
          <KpiCard label="This Week" value={moneyFmt(weekTotal)}  accent="#1c1917"    icon="📅" />
          <KpiCard label="Month"     value={moneyFmt(monthTotal)} accent="#0d9488"   icon="🗓" subtitle={viewMonth} />
          <KpiCard label="Daily Avg" value={moneyFmt(avgPerDay)}  accent="#16a34a" icon="📈" />
          <KpiCard label="Peak Day"  value={highDay.d?dateFmt(highDay.d):'—'} accent="#e11d48" icon="🔺" subtitle={highDay.d?moneyFmt(highDay.sum):''} />
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

        {/* ── TAB CONTENT ── */}
        {tab === 'ledger' && (
          <div key="ledger-tab">
            <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-3 mb-3.5 flex gap-3 items-center flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[10.5px] font-bold text-stone-500 uppercase tracking-wider mb-0">Date</label>
                <input type="date" className="px-3 py-1.5 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all w-auto"
                  value={filterDate} onChange={e=>setFilterDate(e.target.value)} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[10.5px] font-bold text-stone-500 uppercase tracking-wider mb-0">Meal</label>
                <select className="px-3 py-1.5 rounded-lg border-[1.5px] border-stone-200 text-xs font-body outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition-all cursor-pointer bg-white w-auto"
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
              <div className="flex flex-col items-center py-16 text-center animate-fade-up">
                <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-dashed border-orange-200 flex items-center justify-center text-[38px] mb-5">
                  🍽
                </div>
                <div className="text-lg font-bold text-stone-700 font-display mb-2">No entries yet</div>
                <p className="text-[13px] text-stone-400 max-w-[36ch] leading-relaxed mb-6">
                  Start tracking your kitchen expenses — add your first meal entry for {viewMonth}.
                </p>
                <button type="button" className="px-7 py-3 rounded-lg text-sm font-semibold text-white bg-gradient-to-br from-orange-500 to-orange-700 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                  onClick={()=>setFormOpen(true)}>
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
          </div>
        )}

        {tab === 'analytics' && (
          <div key="analytics-tab" className="animate-fade-up">
            <MonthlyChart entries={entries} />
            <MealPieBreakdown entries={entries} />
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
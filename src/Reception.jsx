// ReceptionPage.jsx  — GNSI Portal  (Fixed + Mobile-Compatible)
// ─────────────────────────────────────────────────────────────────────────────
// FIXES APPLIED:
//  1. Duplicate gate-pass guard (blocks if active pass exists)
//  2. Student selection required on GP & Parent Items forms
//  3. Status forward-only guard (prevents backwards transitions)
//  4. Elapsed timer uses exit_date+exit_time, not created_at
//  5. Hostel leave duplicate guard
//  6. Staff leave days auto-calculated from dates
//  7. Warning when parent_informed is 'No' on gate pass
//  8. Custom items synced to Supabase (reception_custom_items table)
//  9. Soft-delete with deleted_at timestamp instead of hard delete
// 10. Visitor "Still Inside" monitor sub-tab added
// 11. filteredRows search limited to meaningful columns only
// 12. Full mobile responsiveness (all grids, tables, tabs)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt     = n => Number(n || 0).toLocaleString('en-IN')
const fmtDate = d => { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const today   = () => new Date().toISOString().split('T')[0]
const gccStr  = g => String(parseInt(g) || g || '')
const TABS    = ['Student 360°', 'Enquiry', 'Visitor Book', 'Gate Pass', 'Parent Items', 'Monitors']

// ── predefined item catalogue ─────────────────────────────────────────────────
const DEFAULT_ITEMS = [
  'Tiffin Box','Water Bottle','School Bag','Uniform Set','Shoes',
  'Blanket','Pillow','Bedsheet','Towel','Soap / Toiletries',
  'Books','Notebooks','Stationery Kit','Medicine','Money / Cash',
  'Winter Jacket','Sports Kit','Mobile Charger','Umbrella','ID Card',
]

// ── dropdown option sets ─────────────────────────────────────────────────────
const CLASS_OPTIONS    = ['Lakshya','Umeed','Elite','Prime','Achiever','Leader','Champion']
const COURSES          = ['Sainik','Navodaya','Foundation','Combined Course']
const HOSTEL_TYPES     = ['Boarder','Day Scholar','Day Boarder']
const SOURCE_OPTIONS   = ['Walk-in','Phone Call','WhatsApp','Referral / Word of Mouth','Facebook / Instagram','Website','Google Search','School Fair / Event','Pamphlet / Poster','Other']
const PURPOSE_OPTIONS  = ['Admission Enquiry','Fee Payment','Meet Student','Meet Principal','Meet Teacher / Staff','Meet Warden','Document Submission','Item Delivery','Parent Teacher Meeting','General Visit','Other']
const MEETING_WITH_OPTIONS = ['Principal','Vice Principal','Admin Office','Reception','Warden','Class Teacher','Subject Teacher','Accountant / Cashier','Counsellor','Other']
const ID_PROOF_OPTIONS = ['Aadhaar Card','Voter ID','Driving License','PAN Card','Passport','Ration Card','Student ID','Other']
const GP_REASON_OPTIONS = ['Medical Emergency','Family Function / Event','Going Home','Weekend Leave','Personal Work','Official / School Duty','Sports / Competition','Other']
const APPROVED_BY_OPTIONS = ['Receptionist','Security']
const HOUSE_OPTIONS    = ['Shiroi','Sangai','Loktak','Kangla','Koubru','Block B','Nongin','Kombirei','Singgarei','Sanarei','Day Scholar','Unassigned']
const RECEIVED_BY_OPTIONS = ['Receptionist','Security']
const HOSTEL_LEAVE_REASONS = ['Weekend Leave','Going Home','Medical','Family Function','Personal Work','Other']
const STAFF_LEAVE_TYPES    = ['Sick Leave','Casual Leave','Earned Leave','Maternity Leave','Paternity Leave','Compensatory Leave','Special Leave','Other']
const STAFF_DEPARTMENTS    = ['Academic','Hostel','Admin','Sports','Accounts','Support Staff','Other']

// ── default form states ───────────────────────────────────────────────────────
const ENQ_DEF  = { student_name:'', parent_name:'', phone:'', class_interest:'', source:'', enquiry_date:today(), follow_up_date:'', status:'New', remarks:'' }
const VIS_DEF  = { visitor_name:'', phone:'', purpose:'', meeting_with:'', in_time:'', out_time:'', visit_date:today(), id_proof:'', remarks:'' }
const GP_DEF   = { student_name:'', class_name:'', course:'', reason:'', exit_date:today(), exit_time:'', approved_by:'', parent_informed:'No', status:'Issued', remarks:'' }
const PI_DEF = { parent_name:'', student_name:'', class_name:'', course:'', hostel_type:'', house:'', item_names:[], quantity:'1', received_date:today(), received_by:'', status:'Pending', remarks:'' }
const HOSTEL_LEAVE_DEF = { student_name:'', class_name:'', house:'', course:'', hostel_type:'', departure_date:today(), return_date:'', reason:'', status:'Out', remarks:'' }
const STAFF_LEAVE_DEF  = { staff_name:'', role:'', department:'', leave_type:'', from_date:today(), to_date:'', days:'', approved_by:'', status:'Pending', remarks:'' }

// ── FIX 3 — valid status transitions ─────────────────────────────────────────
const VALID_TRANSITIONS = {
  // Gate pass
  Issued:    ['Exited','Returned'],
  Exited:    ['Returned'],
  // General
  Out:       ['Returned'],
  Pending:   ['Approved','Delivered'],
  Approved:  ['Returned'],
  Delivered: ['Returned'],
}
const canTransition = (from, to) => (VALID_TRANSITIONS[from] || []).includes(to)

// ── status pill colours ───────────────────────────────────────────────────────
const STATUS_COLORS = {
  New:         { bg:'#dbeafe', color:'#1d4ed8' },
  'Follow Up': { bg:'#fef9c3', color:'#92400e' },
  Converted:   { bg:'#dcfce7', color:'#166534' },
  Closed:      { bg:'#f1f5f9', color:'#64748b' },
  Issued:      { bg:'#fef3c7', color:'#92400e' },
  Exited:      { bg:'#fee2e2', color:'#dc2626' },
  Returned:    { bg:'#dcfce7', color:'#166534' },
  Pending:     { bg:'#fef9c3', color:'#92400e' },
  Delivered:   { bg:'#dcfce7', color:'#166534' },
  Active:      { bg:'#dcfce7', color:'#166534' },
  Inactive:    { bg:'#f1f5f9', color:'#64748b' },
  Out:         { bg:'#fee2e2', color:'#dc2626' },
  Overdue:     { bg:'#fde8d8', color:'#9a3412' },
  Approved:    { bg:'#dcfce7', color:'#166534' },
}
const Pill = ({ label }) => {
  const c = STATUS_COLORS[label] || { bg:'#f1f5f9', color:'#475569' }
  return (
    <span style={{ background:c.bg, color:c.color, padding:'2px 10px', borderRadius:99, fontSize:11, fontWeight:700, whiteSpace:'nowrap' }}>
      {label || '—'}
    </span>
  )
}

// ── shared styles ─────────────────────────────────────────────────────────────
const card   = { background:'#fff', borderRadius:14, padding:'16px 16px', boxShadow:'0 2px 10px rgba(0,0,0,.07)' }
const inp    = { width:'100%', padding:'10px 13px', borderRadius:8, border:'1.5px solid #d1d5db', fontSize:14, boxSizing:'border-box', fontFamily:'inherit', outline:'none', transition:'border-color .15s' }
const lbl    = { display:'block', marginBottom:5, fontSize:12, fontWeight:700, color:'#374151', textTransform:'uppercase', letterSpacing:'.04em' }
const thS    = { padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:700, color:'#64748b', borderBottom:'1px solid #e5e7eb', textTransform:'uppercase', letterSpacing:'.05em', whiteSpace:'nowrap', background:'#f8fafc' }
const tdS    = { padding:'8px 10px', color:'#334155', fontSize:13, verticalAlign:'middle' }
const delBtn = { background:'#fee2e2', color:'#dc2626', border:'none', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit' }

// ── responsive grid helpers (CSS-in-JS) ──────────────────────────────────────
// We detect mobile via a hook and pass it down
function useIsMobile() {
  const [mob, setMob] = useState(window.innerWidth < 640)
  useEffect(() => {
    const h = () => setMob(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return mob
}

const grid2  = (mob) => ({ display:'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap:12 })
const span2  = { gridColumn:'1 / -1' }

// ── student index builder ─────────────────────────────────────────────────────
function buildIndex(students) {
  return students.map(s => ({
    s,
    key: [s.name, s.gcc_no, s.admission_no, s.batch, s.house, s.phone, s.father_name]
      .filter(Boolean).map(v => String(v).toLowerCase()).join('\x00'),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT AUTOCOMPLETE
// ─────────────────────────────────────────────────────────────────────────────
const StudentAutocomplete = React.memo(function StudentAutocomplete({ students, onSelect, placeholder, resetKey }) {
  const inputRef   = useRef(null)
  const wrapRef    = useRef(null)
  const indexRef   = useRef([])
  const rowRefs    = useRef([])
  const hitsRef    = useRef([])
  const cursorRef  = useRef(-1)
  const pickingRef = useRef(false)
  const [hits, setHits]     = useState([])
  const [open, setOpen]     = useState(false)
  const [cursor, setCursor] = useState(-1)

  useEffect(() => { indexRef.current = buildIndex(students) }, [students])
  useEffect(() => {
    if (inputRef.current) inputRef.current.value = ''
    hitsRef.current = []; cursorRef.current = -1
    setHits([]); setOpen(false); setCursor(-1)
  }, [resetKey])
  useEffect(() => { if (cursor >= 0) rowRefs.current[cursor]?.scrollIntoView({ block:'nearest' }) }, [cursor])

  const runSearch = raw => {
    const q = (raw||'').toLowerCase().trim()
    if (!q) { hitsRef.current=[]; cursorRef.current=-1; setHits([]); setOpen(false); setCursor(-1); return }
    const src = indexRef.current.length ? indexRef.current : buildIndex(students)
    const out = []
    for (let i=0; i<src.length && out.length<9; i++) { if (src[i].key.includes(q)) out.push(src[i].s) }
    hitsRef.current=out; cursorRef.current=-1; setHits(out); setCursor(-1); setOpen(true)
  }

  const pick = s => {
    pickingRef.current = true
    if (inputRef.current) inputRef.current.value = s.name
    hitsRef.current=[]; cursorRef.current=-1; setHits([]); setOpen(false); setCursor(-1)
    clearTimeout(pickingRef._timer)
    pickingRef._timer = setTimeout(() => { pickingRef.current=false; onSelect(s) }, 0)
  }

  const handleKeyDown = e => {
    const h=hitsRef.current; const idx=cursorRef.current
    if (!h.length) return
    switch (e.key) {
      case 'ArrowDown':{ e.preventDefault(); const n=Math.min(idx+1,h.length-1); cursorRef.current=n; setCursor(n); break }
      case 'ArrowUp':  { e.preventDefault(); const n=Math.max(idx-1,0); cursorRef.current=n; setCursor(n); break }
      case 'Enter':    { e.preventDefault(); const t=h[idx]??h[0]; if(t) pick(t); break }
      case 'Tab':      { const t=h[idx]??(h.length===1?h[0]:null); if(t){e.preventDefault();pick(t)} break }
      case 'Escape':   { e.preventDefault(); hitsRef.current=[]; cursorRef.current=-1; setOpen(false); setHits([]); setCursor(-1); break }
      default: break
    }
  }

  return (
    <div ref={wrapRef} style={{ position:'relative' }}>
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', fontSize:15, color:'#94a3b8', pointerEvents:'none' }}>🎓</span>
        <input ref={inputRef} type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} defaultValue=""
          placeholder={placeholder || 'Name, GCC No, Adm No, batch, phone…'}
          style={{ width:'100%', boxSizing:'border-box', fontFamily:'inherit', fontSize:14, padding:'10px 30px 10px 36px', borderRadius:8, border:'1.5px solid #d1d5db', outline:'none', background:'white', lineHeight:1.5 }}
          onChange={e => runSearch(e.target.value)} onKeyDown={handleKeyDown}
          onFocus={e => { e.target.style.borderColor='#1e3a5f'; e.target.style.boxShadow='0 0 0 3px rgba(30,58,95,.1)'; if(e.target.value) runSearch(e.target.value) }}
          onBlur={e => { e.target.style.borderColor='#d1d5db'; e.target.style.boxShadow='none'; if(!pickingRef.current){setOpen(false);setCursor(-1);cursorRef.current=-1} }} />
        <button type="button" tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); if(inputRef.current){inputRef.current.value='';inputRef.current.focus()} setHits([]); hitsRef.current=[]; setOpen(false); setCursor(-1); onSelect(null) }}
          style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#c0c8d4', lineHeight:1, padding:'0 2px' }}>×</button>
      </div>
      {open && hits.length > 0 && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:9999, background:'white', border:'1.5px solid #cbd5e1', borderRadius:12, boxShadow:'0 12px 40px rgba(0,0,0,.18)', maxHeight:300, overflowY:'auto' }}>
          <div style={{ position:'sticky', top:0, background:'white', zIndex:1, padding:'5px 14px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#94a3b8', textTransform:'uppercase' }}>{hits.length} match{hits.length!==1?'es':''}</span>
            <span style={{ fontSize:10, color:'#cbd5e1' }}>↑↓ Enter select</span>
          </div>
          {hits.map((s,i) => {
            const active = cursor===i
            return (
              <div key={s.id} ref={el=>{rowRefs.current[i]=el}}
                onMouseDown={e=>{e.preventDefault();pickingRef.current=true;pick(s)}}
                onMouseEnter={()=>{setCursor(i);cursorRef.current=i}}
                style={{ padding:'9px 14px', display:'flex', gap:10, alignItems:'center', borderBottom:'1px solid #f8fafc', background:active?'#eef4ff':'white', borderLeft:`3px solid ${active?'#1e3a5f':'transparent'}`, cursor:'pointer' }}>
                <div style={{ width:32, height:32, borderRadius:'50%', flexShrink:0, background:active?'#1e3a5f':'#f1f5f9', display:'flex', alignItems:'center', justifyContent:'center', color:active?'#c9a84c':'#94a3b8', fontWeight:800, fontSize:13 }}>
                  {(s.name||'?')[0].toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:active?'#1e3a5f':'#0f172a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
                  <div style={{ fontSize:11, color:'#64748b', display:'flex', gap:8, marginTop:1, flexWrap:'wrap' }}>
                    {s.gcc_no && <span style={{ fontFamily:'monospace', fontWeight:700, color:'#1e3a5f' }}>GCC-{s.gcc_no}</span>}
                    {s.batch  && <span>{s.batch}</span>}
                    {s.course && <span style={{ color:'#0891b2' }}>{s.course}</span>}
                    {s.house  && <span style={{ color:'#059669' }}>🏠 {s.house}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {open && hits.length===0 && inputRef.current?.value?.trim() && (
        <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, zIndex:9999, background:'white', border:'1.5px solid #e2e8f0', borderRadius:12, padding:16, textAlign:'center', color:'#94a3b8', fontSize:13, boxShadow:'0 8px 24px rgba(0,0,0,.1)' }}>
          No student matches
        </div>
      )}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT CHIP
// ─────────────────────────────────────────────────────────────────────────────
function StudentChip({ student, onClear }) {
  if (!student) return null
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8, padding:'8px 12px', background:'#f0fdf4', border:'1.5px solid #86efac', borderRadius:9 }}>
      <div style={{ width:28, height:28, borderRadius:'50%', background:'#1e3a5f', display:'flex', alignItems:'center', justifyContent:'center', color:'#c9a84c', fontWeight:800, fontSize:12, flexShrink:0 }}>
        {student.name[0].toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#166534' }}>✓ {student.name}</div>
        <div style={{ fontSize:11, color:'#64748b', display:'flex', gap:8, marginTop:1, flexWrap:'wrap' }}>
          {student.gcc_no      && <span style={{ fontFamily:'monospace', fontWeight:700 }}>GCC-{student.gcc_no}</span>}
          {student.batch       && <span>{student.batch}</span>}
          {student.course      && <span style={{ color:'#0891b2' }}>{student.course}</span>}
          {student.house       && <span>🏠 {student.house}</span>}
          {student.hostel_type && <span style={{ color:'#7c3aed' }}>{student.hostel_type}</span>}
        </div>
      </div>
      <button type="button" onClick={onClear} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:18, lineHeight:1, flexShrink:0 }}>×</button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM CATALOGUE PICKER
// ─────────────────────────────────────────────────────────────────────────────
function ItemPicker({ value = [], onChange, customItems, onAddCustom }) {
  const [showCustom, setShowCustom] = useState(false)
  const [customVal, setCustomVal]   = useState('')
  const allItems = [...DEFAULT_ITEMS, ...customItems]

  const toggle = item => {
    if (value.includes(item)) onChange(value.filter(i => i !== item))
    else onChange([...value, item])
  }

  const commit = () => {
    const v = customVal.trim(); if (!v) return
    onAddCustom(v); toggle(v); setCustomVal(''); setShowCustom(false)
  }

  return (
    <div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:10 }}>
        {allItems.map(item => {
          const selected = value.includes(item)
          return (
            <button key={item} type="button" onClick={() => toggle(item)}
              style={{ padding:'5px 13px', borderRadius:99, border:`1.5px solid ${selected?'#1e3a5f':'#e2e8f0'}`, background:selected?'#1e3a5f':'white', color:selected?'white':'#475569', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', position:'relative' }}>
              {selected && <span style={{ marginRight:5 }}>✓</span>}{item}
            </button>
          )
        })}
        <button type="button" onClick={() => setShowCustom(v=>!v)}
          style={{ padding:'5px 13px', borderRadius:99, border:'1.5px dashed #94a3b8', background:'white', color:'#64748b', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          + Custom
        </button>
      </div>
      {showCustom && (
        <div style={{ display:'flex', gap:8, marginBottom:8 }}>
          <input value={customVal} onChange={e=>setCustomVal(e.target.value)} placeholder="Type custom item name…" style={{ ...inp, flex:1 }}
            onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit()}}} />
          <button type="button" onClick={commit} style={{ padding:'8px 16px', background:'#1e3a5f', color:'white', border:'none', borderRadius:8, cursor:'pointer', fontWeight:700, fontSize:13, fontFamily:'inherit' }}>Add</button>
        </div>
      )}
      {value.length > 0 && (
        <div style={{ marginTop:6, display:'flex', flexWrap:'wrap', gap:6 }}>
          {value.map(i => (
            <span key={i} style={{ background:'#dbeafe', color:'#1e3a5f', padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
              {i}
              <button type="button" onClick={()=>toggle(i)} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748b', fontSize:14, lineHeight:1, padding:0 }}>×</button>
            </span>
          ))}
          <span style={{ fontSize:11, color:'#64748b', alignSelf:'center' }}>{value.length} item{value.length!==1?'s':''} selected</span>
        </div>
      )}
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────
// PRINT FUNCTIONS  (unchanged — keep original print markup)
// ─────────────────────────────────────────────────────────────────────────────
function printItemInvoice(item) {
  const d = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
  const invoiceNo = `PI-${String(item.id||Date.now()).slice(-8).toUpperCase()}`
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Item Invoice — ${item.student_name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#f0f4f8;display:flex;justify-content:center;padding:36px 16px}.page{width:680px;background:white;box-shadow:0 4px 32px rgba(0,0,0,.15);overflow:hidden;position:relative}.wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(30,58,95,.04);pointer-events:none;z-index:0;white-space:nowrap}.hdr{background:#1e3a5f;padding:24px 32px;position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start}.inst{color:white;font-size:18px;font-weight:700}.sub{color:rgba(255,255,255,.5);font-size:11px;margin-top:3px}.inv-l{font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em;text-align:right}.inv-no{font-size:20px;font-weight:800;color:#c9a84c;font-family:'Courier New',monospace;margin-top:2px;text-align:right}.accent{height:4px;background:linear-gradient(90deg,#7c3aed,#c9a84c)}.title-row{background:#f8fafc;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0}.title{font-size:14px;font-weight:800;color:#1e3a5f;text-transform:uppercase;letter-spacing:.06em}.badge{background:#7c3aed;color:white;font-size:10px;font-weight:700;padding:3px 11px;border-radius:99px}.body{padding:24px 32px;position:relative;z-index:1}.meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:22px}.mc{padding:11px 14px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.mc:nth-child(even){border-right:none}.mc:nth-last-child(-n+2){border-bottom:none}.ml{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}.mv{font-size:13px;font-weight:700;color:#1e293b}.pt{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:18px}.pt thead{background:#1e3a5f}.pt th{padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.05em}.pt td{padding:11px 14px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9}.status-row{display:flex;justify-content:flex-end;margin-bottom:22px}.status-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 18px;text-align:right;min-width:160px}.sl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}.sv{font-size:14px;font-weight:800;color:#1e293b}.sig{display:flex;justify-content:space-between;padding-top:28px;border-top:1px solid #e2e8f0}.sb{text-align:center}.sl2{width:130px;border-top:1.5px solid #1e3a5f;margin:0 auto 6px}.st{font-size:11px;color:#64748b}.ftr{background:#f8fafc;border-top:1px solid #e2e8f0;padding:11px 32px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}@media print{body{background:white;padding:0}.page{box-shadow:none;width:100%}}</style></head><body>
<div class="page"><div class="wm">GNSI</div>
<div class="hdr"><div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div class="sub">Khangabok, Thoubal, Manipur — 795128</div></div><div><div class="inv-l">Invoice No.</div><div class="inv-no">${invoiceNo}</div></div></div>
<div class="accent"></div><div class="title-row"><div class="title">Parent Item Receipt</div><div class="badge">Parent Items</div></div>
<div class="body"><div class="meta"><div class="mc"><div class="ml">Student Name</div><div class="mv">${item.student_name||'—'}</div></div><div class="mc"><div class="ml">Class / Batch</div><div class="mv">${item.class_name||'—'}</div></div><div class="mc"><div class="ml">Course</div><div class="mv">${item.course||'—'}</div></div><div class="mc"><div class="ml">Hostel Type</div><div class="mv">${item.hostel_type||'—'}</div></div><div class="mc"><div class="ml">Parent Name</div><div class="mv">${item.parent_name||'—'}</div></div><div class="mc"><div class="ml">House / Block</div><div class="mv">${item.house||'—'}</div></div><div class="mc"><div class="ml">Date Received</div><div class="mv">${fmtDate(item.received_date)}</div></div><div class="mc"><div class="ml">Received By</div><div class="mv">${item.received_by||'—'}</div></div></div>
<table class="pt"><thead><tr><th style="width:32px">#</th><th>Item Description</th><th>Quantity</th><th>Status</th></tr></thead><tbody><tr><td>1</td><td style="font-weight:700">${item.item_name}</td><td>${item.quantity||'1'}</td><td style="font-weight:700;color:#7c3aed">${item.status}</td></tr></tbody></table>
<div class="status-row"><div class="status-box"><div class="sl">Current Status</div><div class="sv">${item.status}</div>${item.remarks?`<div style="font-size:11px;color:#64748b;margin-top:4px">${item.remarks}</div>`:''}</div></div>
<div class="sig"><div class="sb"><div class="sl2"></div><div class="st">Parent / Guardian</div></div><div class="sb"><div class="sl2"></div><div class="st">Received By (Staff)</div></div><div class="sb"><div class="sl2"></div><div class="st">Warden / HOD</div></div></div></div>
<div class="ftr"><span>GNSI · Parent Item Invoice · ${item.student_name}</span><span>Printed: ${d}</span></div></div></body></html>`
  const pw = window.open('','_blank','width=760,height=860')
  if (!pw) return
  pw.document.write(html); pw.document.close(); setTimeout(()=>pw.print(),450)
}

function printGatePass(item) {
  const d = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gate Pass</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#fff;padding:32px;color:#1e293b}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px}.inst{font-size:17px;font-weight:700;color:#1e3a5f}.sub{font-size:11px;color:#64748b;margin-top:3px}.title{font-size:20px;font-weight:800;color:#1e3a5f;margin-bottom:16px;text-transform:uppercase;letter-spacing:.08em}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px}.cell{padding:11px 14px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.cell:nth-child(even){border-right:none}.cell:nth-last-child(-n+2){border-bottom:none}.cl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}.cv{font-size:13px;font-weight:700;color:#1e293b}.sig{display:flex;justify-content:space-between;margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0}.sb{text-align:center}.sl{width:140px;border-top:1.5px solid #1e3a5f;margin:0 auto 6px}.st{font-size:11px;color:#64748b}.ftr{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8}@media print{body{padding:16px}}</style></head><body>
<div class="hdr"><div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div class="sub">Khangabok, Thoubal, Manipur — 795128</div></div><div style="text-align:right"><div style="font-size:10px;color:#94a3b8">Printed</div><div style="font-weight:700;font-size:13px">${d}</div></div></div>
<div class="title">🪪 Student Gate Pass</div>
<div class="grid"><div class="cell"><div class="cl">Student Name</div><div class="cv">${item.student_name}</div></div><div class="cell"><div class="cl">Class</div><div class="cv">${item.class_name||'—'}</div></div><div class="cell"><div class="cl">Course</div><div class="cv">${item.course||'—'}</div></div><div class="cell"><div class="cl">Reason</div><div class="cv">${item.reason}</div></div><div class="cell"><div class="cl">Exit Date &amp; Time</div><div class="cv">${fmtDate(item.exit_date)} ${item.exit_time?'· '+item.exit_time:''}</div></div><div class="cell"><div class="cl">Approved By</div><div class="cv">${item.approved_by||'—'}</div></div><div class="cell"><div class="cl">Parent Informed</div><div class="cv">${item.parent_informed}</div></div><div class="cell"><div class="cl">Status</div><div class="cv">${item.status}</div></div><div class="cell" style="grid-column:1/-1"><div class="cl">Remarks</div><div class="cv">${item.remarks||'—'}</div></div></div>
<div class="sig"><div class="sb"><div class="sl"></div><div class="st">Student Signature</div></div><div class="sb"><div class="sl"></div><div class="st">Class Teacher</div></div><div class="sb"><div class="sl"></div><div class="st">Principal / Warden</div></div></div>
<div class="ftr">GNSI · Gate Pass · Computer generated · ${d}</div></body></html>`
  const pw = window.open('','_blank','width=720,height=800')
  if (!pw) return
  pw.document.write(html); pw.document.close(); setTimeout(()=>pw.print(),400)
}

function printVisitorBadge(item) {
  const d = new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Visitor Badge</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#f0f4f8;display:flex;justify-content:center;padding:40px}.badge{width:320px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)}.top{background:#1e3a5f;padding:18px;text-align:center}.inst{color:white;font-size:13px;font-weight:700}.sub{color:rgba(255,255,255,.5);font-size:10px;margin-top:2px}.bl{background:#c9a84c;color:#1e3a5f;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;padding:5px 0;text-align:center}.body{padding:18px}.av{width:56px;height:56px;border-radius:50%;background:#1e3a5f;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#c9a84c;margin:0 auto 12px}.name{text-align:center;font-size:17px;font-weight:800;color:#1e293b;margin-bottom:3px}.purpose{text-align:center;font-size:12px;color:#64748b;margin-bottom:14px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}.rk{color:#94a3b8;font-weight:600}.rv{color:#1e293b;font-weight:700}.ftr{background:#f8fafc;padding:9px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0}@media print{body{background:white;padding:0}.badge{box-shadow:none}}</style></head><body>
<div class="badge"><div class="top"><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div class="sub">Khangabok · Thoubal · Manipur</div></div><div class="bl">Visitor Pass</div>
<div class="body"><div class="av">${(item.visitor_name||'V')[0].toUpperCase()}</div><div class="name">${item.visitor_name}</div><div class="purpose">${item.purpose}</div>
<div class="row"><span class="rk">Meeting With</span><span class="rv">${item.meeting_with||'—'}</span></div><div class="row"><span class="rk">Visit Date</span><span class="rv">${fmtDate(item.visit_date)}</span></div><div class="row"><span class="rk">In Time</span><span class="rv">${item.in_time||'—'}</span></div><div class="row"><span class="rk">Phone</span><span class="rv">${item.phone||'—'}</span></div><div class="row"><span class="rk">ID Proof</span><span class="rv">${item.id_proof||'—'}</span></div></div>
<div class="ftr">Computer generated · ${d}</div></div></body></html>`
  const pw = window.open('','_blank','width=420,height=640')
  if (!pw) return
  pw.document.write(html); pw.document.close(); setTimeout(()=>pw.print(),400)
}

// ─────────────────────────────────────────────────────────────────────────────
// HOUSE-WISE ITEM GRID
// ─────────────────────────────────────────────────────────────────────────────
const HOUSE_PALETTE = ['#1e3a5f','#7c3aed','#059669','#ca8a04','#dc2626','#0f766e','#c2410c','#1d4ed8','#be185d','#0369a1']

function HouseWiseGrid({ parentItems, onStatusChange }) {
  const [statusFilter, setStatusFilter] = useState('All')
  const filtered = useMemo(()=> statusFilter==='All' ? parentItems : parentItems.filter(p=>p.status===statusFilter), [parentItems,statusFilter])
  const grouped  = useMemo(()=>{
    const g={}
    filtered.forEach(item=>{const house=item.house||'Day Scholar / Unassigned'; if(!g[house]) g[house]=[]; g[house].push(item)})
    return g
  },[filtered])
  const houseNames = Object.keys(grouped).sort()
  return (
    <div>
      <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase' }}>Filter:</span>
        {['All','Pending','Delivered','Returned'].map(s=>(
          <button key={s} type="button" onClick={()=>setStatusFilter(s)}
            style={{ padding:'5px 14px', borderRadius:99, border:`1.5px solid ${statusFilter===s?'#1e3a5f':'#e2e8f0'}`, background:statusFilter===s?'#1e3a5f':'white', color:statusFilter===s?'white':'#475569', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {s}
          </button>
        ))}
        <span style={{ marginLeft:'auto', fontSize:12, color:'#94a3b8' }}>{filtered.length} item{filtered.length!==1?'s':''}</span>
      </div>
      {houseNames.length===0 && <div style={{ padding:40, textAlign:'center', color:'#94a3b8', fontSize:14 }}>No records match.</div>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(290px,1fr))', gap:16 }}>
        {houseNames.map((house,hi)=>{
          const hColor=HOUSE_PALETTE[hi%HOUSE_PALETTE.length]
          const hItems=grouped[house]
          const pending  =hItems.filter(i=>i.status==='Pending').length
          const delivered=hItems.filter(i=>i.status==='Delivered').length
          const returned =hItems.filter(i=>i.status==='Returned').length
          return (
            <div key={house} style={{ background:'white', borderRadius:14, overflow:'hidden', border:'1px solid #e2e8f0', boxShadow:'0 2px 8px rgba(0,0,0,.06)' }}>
              <div style={{ background:hColor, padding:'14px 18px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div><div style={{ fontSize:15, fontWeight:800, color:'white' }}>🏠 {house}</div><div style={{ fontSize:11, color:'rgba(255,255,255,.6)', marginTop:2 }}>{hItems.length} item{hItems.length!==1?'s':''}</div></div>
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  {pending>0   && <span style={{ background:'#fef9c3', color:'#92400e', padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:800 }}>⏳ {pending}</span>}
                  {delivered>0 && <span style={{ background:'#dcfce7', color:'#166534', padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:800 }}>✓ {delivered}</span>}
                  {returned>0  && <span style={{ background:'#f1f5f9',  color:'#64748b', padding:'2px 9px', borderRadius:99, fontSize:11, fontWeight:800 }}>↩ {returned}</span>}
                </div>
              </div>
              <div style={{ maxHeight:360, overflowY:'auto' }}>
                {hItems.map((item,i)=>(
                  <div key={item.id||i} style={{ padding:'11px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13, color:'#1e293b', display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:22, height:22, borderRadius:6, background:hColor+'18', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:hColor, flexShrink:0 }}>{i+1}</span>
                        {item.item_name}{item.quantity&&item.quantity!=='1'&&<span style={{ fontSize:11, color:'#64748b', fontWeight:400 }}>× {item.quantity}</span>}
                      </div>
                      <div style={{ fontSize:11, color:'#64748b', marginTop:3, display:'flex', gap:8, flexWrap:'wrap' }}>
                        <span style={{ fontWeight:700, color:'#334155' }}>{item.student_name}</span>
                        {item.class_name && <span>{item.class_name}</span>}
                        {item.course     && <span style={{ color:'#0891b2' }}>{item.course}</span>}
                      </div>
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:5, flexShrink:0 }}>
                      <Pill label={item.status} />
                      <div style={{ display:'flex', gap:4 }}>
                        <button onClick={()=>printItemInvoice(item)} style={{ background:'transparent', border:`1px solid ${hColor}`, color:hColor, borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>🖨️</button>
                        {item.status==='Pending'   && onStatusChange && canTransition('Pending','Delivered')   && <button onClick={()=>onStatusChange(item.id,'Delivered')} style={{ background:'#dcfce7', color:'#166534', border:'none', borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✓</button>}
                        {item.status==='Delivered' && onStatusChange && canTransition('Delivered','Returned')  && <button onClick={()=>onStatusChange(item.id,'Returned')}  style={{ background:'#f1f5f9',  color:'#64748b', border:'none', borderRadius:5, padding:'2px 7px', fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>↩</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background:'#f8fafc', padding:'7px 16px', display:'flex', gap:14, borderTop:'1px solid #e2e8f0' }}>
                <span style={{ fontSize:11, color:'#92400e', fontWeight:600 }}>⏳ {pending}</span>
                <span style={{ fontSize:11, color:'#166534', fontWeight:600 }}>✓ {delivered}</span>
                <span style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>↩ {returned}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT 360°
// ─────────────────────────────────────────────────────────────────────────────
function SectionHead({ icon, title, color, badge }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
      <span style={{ fontSize:18 }}>{icon}</span>
      <span style={{ fontWeight:800, fontSize:14, color }}>{title}</span>
      {badge!==undefined && <span style={{ fontSize:11, fontWeight:700, background:color+'18', color, padding:'2px 9px', borderRadius:99 }}>{badge}</span>}
    </div>
  )
}
function InfoGrid({ rows }) {
  return (
    <div>
      {rows.filter(([,v])=>v).map(([k,v])=>(
        <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:'1px solid #f1f5f9', fontSize:13 }}>
          <span style={{ color:'#94a3b8', fontWeight:600, fontSize:12 }}>{k}</span>
          <span style={{ color:'#1e293b', fontWeight:700, textAlign:'right', maxWidth:'60%' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}
function EmptyState({ msg }) {
  return <div style={{ padding:'20px 0', textAlign:'center', color:'#94a3b8', fontSize:13 }}>{msg}</div>
}

function Student360({ students }) {
  const mob = useIsMobile()
  const [selected, setSel]      = useState(null)
  const [profile, setProf]      = useState(null)
  const [busy, setBusy]         = useState(false)
  const [resetKey360, setRK360] = useState(0)

  const load = useCallback(async student => {
    setSel(student); setBusy(true); setProf(null)
    const gcc = gccStr(student.gcc_no)
    const [hostelAlloc, admFees, flatFees, crsFees, gatePasses, enquiries, parentItems] = await Promise.all([
      supabase.from('hostel_allocations').select('*,hostel_rooms(room_no,floor,capacity,room_type)').eq('student_id',student.id).order('created_at',{ascending:false}).limit(1),
      supabase.from('adm_fee_collections').select('*').eq('adm_app_id',gcc).order('pay_date',{ascending:false}),
      supabase.from('adm_flat_fees').select('*').eq('adm_app_id',gcc).order('pay_date',{ascending:false}),
      supabase.from('adm_course_fees').select('*').eq('adm_app_id',gcc).order('pay_date',{ascending:false}),
      supabase.from('reception_gatepasses').select('*').eq('student_name',student.name).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('reception_enquiries').select('*').or(`student_name.eq.${student.name},phone.eq.${student.phone||'__'}`).is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('reception_parent_items').select('*').eq('student_name',student.name).is('deleted_at',null).order('created_at',{ascending:false}),
    ])
    const admTotal  = (admFees.data ||[]).reduce((s,r)=>s+Number(r.amount_paid||0),0)
    const flatTotal = (flatFees.data||[]).reduce((s,r)=>s+Number(r.amount     ||0),0)
    const crsTotal  = (crsFees.data ||[]).reduce((s,r)=>s+Number(r.amount_paid||0),0)
    setProf({ hostel:hostelAlloc.data?.[0]||null, admFees:admFees.data||[], flatFees:flatFees.data||[], crsFees:crsFees.data||[], admTotal, flatTotal, crsTotal, grandTotal:admTotal+flatTotal+crsTotal, gatePasses:gatePasses.data||[], enquiries:enquiries.data||[], parentItems:parentItems.data||[] })
    setBusy(false)
  },[])

  // FIX 3 — guarded status updates
  const updateGPStatus = async (id, from, to) => {
    if (!canTransition(from, to)) return
    await supabase.from('reception_gatepasses').update({ status:to }).eq('id',id)
    load(selected)
  }
  const updatePIStatus = async (id, from, to) => {
    if (!canTransition(from, to)) return
    await supabase.from('reception_parent_items').update({ status:to }).eq('id',id)
    load(selected)
  }

  return (
    <div>
      <div style={{ ...card, marginBottom:20, position:'relative', zIndex:10 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'#64748b', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:10 }}>🔍 Student 360° Search</div>
        <StudentAutocomplete students={students} resetKey={resetKey360} onSelect={s=>{ if(!s){setSel(null);setProf(null)} else {load(s)} }} />
        {!selected && <p style={{ marginTop:10, fontSize:13, color:'#94a3b8' }}>Select a student to view their complete profile.</p>}
      </div>
      {busy && <div style={{ textAlign:'center', padding:60, color:'#64748b' }}>⏳ Loading…</div>}
      {selected && profile && !busy && (()=>{
        const { hostel, admTotal, flatTotal, crsTotal, grandTotal, gatePasses, enquiries, parentItems } = profile
        const activeGP = gatePasses.filter(g=>g.status==='Issued'||g.status==='Exited')
        return (
          <div>
            <div style={{ background:'linear-gradient(135deg,#1e3a5f 0%,#0f2340 100%)', borderRadius:14, padding:'16px 18px', marginBottom:16, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ width:48, height:48, borderRadius:'50%', background:'#c9a84c', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, fontWeight:900, color:'#1e3a5f', flexShrink:0 }}>{(selected.name||'?')[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:'white' }}>{selected.name}</div>
                  <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap' }}>
                    {selected.gcc_no && <span style={{ fontFamily:'monospace', fontWeight:700, color:'#c9a84c', fontSize:12 }}>GCC-{selected.gcc_no}</span>}
                    {selected.batch  && <span style={{ color:'rgba(255,255,255,.6)', fontSize:12 }}>{selected.batch}</span>}
                    {selected.course && <span style={{ color:'#93c5fd', fontSize:12 }}>{selected.course}</span>}
                    {selected.house  && <span style={{ color:'#a5b4fc', fontSize:12 }}>🏠 {selected.house}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                {activeGP.length>0 && <span style={{ background:'#ef4444', color:'white', padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:800 }}>⚠ {activeGP.length} Active GP</span>}
                <button onClick={()=>{setSel(null);setProf(null);setRK360(k=>k+1)}} style={{ padding:'6px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,.25)', background:'transparent', color:'white', fontSize:12, fontWeight:600, cursor:'pointer' }}>← Change</button>
              </div>
            </div>

            {/* Stat cards — scroll on mobile */}
            <div style={{ display:'grid', gridTemplateColumns:mob?'repeat(3,1fr)':'repeat(5,1fr)', gap:10, marginBottom:16, overflowX: mob ? 'auto' : 'visible' }}>
              {[
                { icon:'💰', label:'Total Paid',   value:`₹${fmt(grandTotal)}`, color:'#1e3a5f' },
                { icon:'🏠', label:'Hostel',        value:hostel?(hostel.hostel_rooms?.room_no||'Allotted'):'Day Scholar', color:hostel?'#059669':'#64748b' },
                { icon:'🪪', label:'Gate Passes',   value:gatePasses.length, color:'#ca8a04' },
                { icon:'📦', label:'Parent Items',  value:parentItems.length, color:'#7c3aed' },
                { icon:'📋', label:'Enquiries',     value:enquiries.length, color:'#2563eb' },
              ].map(c=>(
                <div key={c.label} style={{ background:'white', borderRadius:12, padding:'12px 14px', borderLeft:`4px solid ${c.color}`, boxShadow:'0 2px 6px rgba(0,0,0,.05)', minWidth: mob ? 90 : 'auto' }}>
                  <div style={{ fontSize:15, marginBottom:2 }}>{c.icon}</div>
                  <div style={{ fontSize:9, fontWeight:700, color:c.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>{c.label}</div>
                  <div style={{ fontSize:16, fontWeight:800, color:c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display:'grid', gridTemplateColumns:mob?'1fr':'1fr 1fr', gap:16, marginBottom:16 }}>
              <div style={card}>
                <SectionHead icon="🎓" title="Student Details" color="#1e3a5f" />
                <InfoGrid rows={[
                  ['Name',selected.name],['GCC No.',selected.gcc_no?`GCC-${selected.gcc_no}`:''],
                  ['Adm. No.',selected.admission_no],['Batch',selected.batch],['Course',selected.course],
                  ['House',selected.house],['Hostel Type',selected.hostel_type],
                  ['Phone',selected.phone],['Father',selected.father_name],['Mother',selected.mother_name],
                ]} />
              </div>
              <div style={card}>
                <SectionHead icon="🏠" title="Hostel" color="#059669" />
                {hostel ? <InfoGrid rows={[['Room No.',hostel.hostel_rooms?.room_no],['Floor',hostel.hostel_rooms?.floor],['Room Type',hostel.hostel_rooms?.room_type],['Bed No.',hostel.bed_no],['Status',hostel.status]]} />
                        : <EmptyState msg="Day Scholar — not allotted" />}
              </div>
            </div>

            <div style={{ ...card, marginBottom:16 }}>
              <SectionHead icon="🪪" title="Gate Passes" color="#ca8a04" badge={gatePasses.length} />
              {gatePasses.length===0 ? <EmptyState msg="No gate passes issued" /> : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead><tr>{['Date','Reason','Approved By','Parent Informed','Status','Actions'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                    <tbody>
                      {gatePasses.map(g=>(
                        <tr key={g.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={tdS}>{fmtDate(g.exit_date)}</td>
                          <td style={tdS}>{g.reason}</td>
                          <td style={tdS}>{g.approved_by||'—'}</td>
                          <td style={tdS}>{g.parent_informed}</td>
                          <td style={tdS}><Pill label={g.status} /></td>
                          <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                            <div style={{ display:'flex', gap:5 }}>
                              <button onClick={()=>printGatePass(g)} style={{ ...delBtn, background:'#fef3c7', color:'#92400e' }}>🖨️</button>
                              {canTransition(g.status,'Exited')   && <button onClick={()=>updateGPStatus(g.id,g.status,'Exited')}   style={{ ...delBtn, background:'#fee2e2', color:'#dc2626' }}>→ Out</button>}
                              {canTransition(g.status,'Returned') && <button onClick={()=>updateGPStatus(g.id,g.status,'Returned')} style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>↩ In</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={card}>
              <SectionHead icon="📦" title="Parent Items" color="#7c3aed" badge={parentItems.length} />
              {parentItems.length===0 ? <EmptyState msg="No parent items recorded" /> : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                    <thead><tr>{['Date','Parent','Item','Qty','Status','Actions'].map(h=><th key={h} style={thS}>{h}</th>)}</tr></thead>
                    <tbody>
                      {parentItems.map(p=>(
                        <tr key={p.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                          <td style={tdS}>{fmtDate(p.received_date)}</td>
                          <td style={tdS}>{p.parent_name}</td>
                          <td style={{ ...tdS, fontWeight:700 }}>{p.item_name}</td>
                          <td style={tdS}>{p.quantity||'—'}</td>
                          <td style={tdS}><Pill label={p.status} /></td>
                          <td style={{ ...tdS, whiteSpace:'nowrap' }}>
                            <div style={{ display:'flex', gap:5 }}>
                              <button onClick={()=>printItemInvoice(p)} style={{ ...delBtn, background:'#f5f3ff', color:'#7c3aed' }}>🖨️</button>
                              {canTransition(p.status,'Delivered') && <button onClick={()=>updatePIStatus(p.id,p.status,'Delivered')} style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>✓</button>}
                              {canTransition(p.status,'Returned')  && <button onClick={()=>updatePIStatus(p.id,p.status,'Returned')}  style={{ ...delBtn, background:'#f1f5f9',  color:'#64748b' }}>↩</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC RECORDS TABLE — scrollable on mobile
// ─────────────────────────────────────────────────────────────────────────────
function RecordsTable({ rows, columns, onDelete, loading }) {
  if (loading) return <div style={{ color:'#64748b', padding:24 }}>Loading…</div>
  return (
    <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth: 500 }}>
        <thead><tr>
          {columns.map(c=><th key={c.key} style={thS}>{c.label}</th>)}
          {onDelete && <th style={thS}>Delete</th>}
        </tr></thead>
        <tbody>
          {rows.length===0
            ? <tr><td colSpan={columns.length+1} style={{ padding:28, textAlign:'center', color:'#94a3b8' }}>No records found</td></tr>
            : rows.map((row,i)=>(
              <tr key={row.id||i} style={{ borderBottom:'1px solid #f1f5f9' }}>
                {columns.map(c=><td key={c.key} style={tdS}>{c.render ? c.render(row) : (row[c.key]??'—')}</td>)}
                {onDelete && <td style={tdS}><button onClick={()=>onDelete(row.id)} style={delBtn}>Delete</button></td>}
              </tr>
            ))
          }
        </tbody>
      </table>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FORM FIELD HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function FormField({ label, children }) { return <div><label style={lbl}>{label}</label>{children}</div> }
function FormInput({ field, value, onChange, type='text', placeholder, required }) {
  return <input type={type} placeholder={placeholder} required={required} style={inp} value={value??''} onChange={e=>onChange(field,e.target.value)}
    onFocus={e=>e.target.style.borderColor='#1e3a5f'} onBlur={e=>e.target.style.borderColor='#d1d5db'} />
}
function FormSelect({ field, value, onChange, options, placeholder }) {
  return (
    <select style={inp} value={value??''} onChange={e=>onChange(field,e.target.value)}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o=><option key={o} value={o}>{o}</option>)}
    </select>
  )
}
function FormTextarea({ field, value, onChange }) {
  return <textarea rows={2} style={{ ...inp, resize:'vertical' }} value={value??''} onChange={e=>onChange(field,e.target.value)}
    onFocus={e=>e.target.style.borderColor='#1e3a5f'} onBlur={e=>e.target.style.borderColor='#d1d5db'} />
}
function SaveBtn({ label, saving }) {
  return <button type="submit" disabled={saving} style={{ marginTop:16, background:'#1e3a5f', color:'#fff', padding:'11px 24px', borderRadius:9, border:'none', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', width:'100%' }}>{saving?'Saving…':label}</button>
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX 4 — ELAPSED TIME using exit_date + exit_time
// ─────────────────────────────────────────────────────────────────────────────
function elapsedLabel(record) {
  let base
  if (record?.exit_date && record?.exit_time) {
    base = new Date(`${record.exit_date}T${record.exit_time}`)
  } else if (record?.exit_date) {
    base = new Date(record.exit_date)
  } else if (record?.created_at) {
    base = new Date(record.created_at)
  } else {
    return { label:'—', color:'#059669', bg:'#dcfce7' }
  }
  const diff = Math.floor((Date.now() - base.getTime()) / 60000)
  if (diff < 60) return { label:`${diff}m`, color:'#166534', bg:'#dcfce7' }
  const hrs = Math.floor(diff/60), mins = diff%60
  if (hrs < 8) return { label:`${hrs}h ${mins}m`, color:'#92400e', bg:'#fef3c7' }
  return { label:`${hrs}h ${mins}m`, color:'#dc2626', bg:'#fee2e2' }
}

// ─────────────────────────────────────────────────────────────────────────────
// MONITOR ROW
// ─────────────────────────────────────────────────────────────────────────────
function MonitorRow({ initLetter, avatarColor, name, sub, meta, elapsedRecord, statusLabel, actions }) {
  const e = elapsedRecord ? elapsedLabel(elapsedRecord) : null
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 0', borderBottom:'1px solid #f1f5f9' }}>
      <div style={{ width:36, height:36, borderRadius:'50%', background:avatarColor||'#1e3a5f', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#c9a84c', flexShrink:0 }}>
        {(initLetter||'?').toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#0f172a' }}>{name}</div>
        {sub  && <div style={{ fontSize:12, color:'#64748b', marginTop:1 }}>{sub}</div>}
        {meta && <div style={{ fontSize:11, color:'#94a3b8', marginTop:3, display:'flex', gap:8, flexWrap:'wrap' }}>{meta}</div>}
        {/* On mobile, show actions below info */}
        <div style={{ display:'none' }} className="mob-actions">{actions}</div>
      </div>
      {e && <span style={{ background:e.bg, color:e.color, fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:99, flexShrink:0, whiteSpace:'nowrap' }}>⏱ {e.label}</span>}
      {statusLabel && <Pill label={statusLabel} />}
      <div style={{ display:'flex', gap:5, flexShrink:0, alignItems:'center', flexWrap:'wrap' }}>{actions}</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MONITORS TAB
// ─────────────────────────────────────────────────────────────────────────────
function MonitorsTab({ students, gatePasses, onGPStatusChange, fetchAll }) {
  const mob = useIsMobile()
  const [subTab,         setSubTab]       = useState('gate')
  const [saving,         setSaving]       = useState(false)
  const [hlRecords,      setHLRecords]    = useState([])
  const [staffRecords,   setStaffRecords] = useState([])
  const [hlLoading,      setHLLoading]    = useState(false)
  const [staffLoading,   setStaffLoading] = useState(false)
  const [hlForm,         setHLForm]       = useState(HOSTEL_LEAVE_DEF)
  const [staffForm,      setStaffForm]    = useState(STAFF_LEAVE_DEF)
  const [hlStudent,      setHLStudent]    = useState(null)
  const [hlResetKey,     setHLResetKey]   = useState(0)
  const [showHLForm,     setShowHLForm]   = useState(false)
  const [showStaffForm,  setShowStaffForm]= useState(false)
  const [lastRefresh,    setLastRefresh]  = useState(new Date())

  const set_hl    = (f,v) => setHLForm(p=>({...p,[f]:v}))
  const set_staff = (f,v) => {
    setStaffForm(p => {
      const next = {...p, [f]:v}
      // FIX 6 — auto-calc days
      if ((f==='from_date'||f==='to_date') && next.from_date && next.to_date) {
        const diff = Math.round((new Date(next.to_date)-new Date(next.from_date))/(1000*60*60*24))+1
        if (diff>0) next.days = String(diff)
      }
      return next
    })
  }

  const loadHL = useCallback(async () => {
    setHLLoading(true)
    const { data, error } = await supabase.from('hostel_leave_records').select('*').is('deleted_at',null).order('created_at',{ascending:false})
    if (!error) setHLRecords(data||[])
    setHLLoading(false)
  },[])

  const loadStaff = useCallback(async () => {
    setStaffLoading(true)
    const { data, error } = await supabase.from('staff_leave_requests').select('*').is('deleted_at',null).order('created_at',{ascending:false})
    if (!error) setStaffRecords(data||[])
    setStaffLoading(false)
  },[])

  useEffect(()=>{loadHL();loadStaff()},[loadHL,loadStaff])

  const refreshAll = () => { setLastRefresh(new Date()); fetchAll(); loadHL(); loadStaff() }

  const onSelectHL = useCallback(s => {
    if (s) { setHLStudent(s); setHLForm(f=>({...f, student_name:s.name, class_name:s.batch||f.class_name, house:s.house||f.house, course:s.course||f.course, hostel_type:s.hostel_type||f.hostel_type})) }
    else   { setHLStudent(null); setHLForm(f=>({...f, student_name:'', class_name:'', house:'', course:'', hostel_type:''})) }
  },[])

  const outsideNow     = gatePasses.filter(g=>g.status==='Exited'||g.status==='Issued')
  const returnedToday  = gatePasses.filter(g=>g.status==='Returned'&&g.exit_date===today())
  // FIX 4 — overdue uses exit_date+exit_time
  const overdueGP      = outsideNow.filter(g => elapsedLabel(g).color === '#dc2626')

  const hlAway    = hlRecords.filter(r=>r.status==='Out')
  const hlOverdue = hlRecords.filter(r=>r.status==='Out'&&r.return_date&&r.return_date<today()).map(r=>r.id)

  // FIX 10 — Visitor still inside
  const [visitors, setVisitors] = useState([])
  useEffect(()=>{
    supabase.from('reception_visitors').select('*').is('out_time',null).is('deleted_at',null).order('created_at',{ascending:false}).then(({data})=>setVisitors(data||[]))
  },[])

  const staffPending = staffRecords.filter(r=>r.status==='Pending')
  const staffOnLeave = staffRecords.filter(r=>r.status==='Approved')

  // FIX 3 — guarded status updates
  const updateGPStatusMon = async (id, from, to) => {
    if (!canTransition(from,to)) return
    await supabase.from('reception_gatepasses').update({status:to}).eq('id',id)
    fetchAll()
  }
  const updateHLStatus = async (id, from, to) => {
    if (!canTransition(from,to)) return
    await supabase.from('hostel_leave_records').update({status:to}).eq('id',id)
    loadHL()
  }
  const updateStaffStatus = async (id, from, to) => {
    if (!canTransition(from,to)) return
    await supabase.from('staff_leave_requests').update({status:to}).eq('id',id)
    loadStaff()
  }

  // FIX 9 — soft delete
  const softDelete = async (table, id, reload) => {
    if (!window.confirm('Archive this record? It will be hidden but not permanently deleted.')) return
    await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id',id)
    reload()
  }

  // FIX 5 — hostel leave duplicate guard
  const saveHL = async e => {
    e.preventDefault(); setSaving(true)
    if (hlForm.student_name) {
      const { data: existing } = await supabase.from('hostel_leave_records').select('id').eq('student_name',hlForm.student_name).eq('status','Out').is('deleted_at',null)
      if (existing && existing.length > 0) {
        alert(`⚠ ${hlForm.student_name} already has an active hostel leave record (status: Out). Please mark them as Returned first.`)
        setSaving(false); return
      }
    }
    const { error } = await supabase.from('hostel_leave_records').insert([hlForm])
    if (error) alert(error.message)
    else { setHLForm({...HOSTEL_LEAVE_DEF, departure_date:today()}); setHLStudent(null); setHLResetKey(k=>k+1); setShowHLForm(false); loadHL() }
    setSaving(false)
  }

  const saveStaff = async e => {
    e.preventDefault(); setSaving(true)
    const { error } = await supabase.from('staff_leave_requests').insert([staffForm])
    if (error) alert(error.message)
    else { setStaffForm({...STAFF_LEAVE_DEF, from_date:today()}); setShowStaffForm(false); loadStaff() }
    setSaving(false)
  }

  const subTabStyle = t => ({
    padding:'8px 14px', borderRadius:8, border:`1.5px solid ${subTab===t?'#1e3a5f':'#e2e8f0'}`,
    background:subTab===t?'#1e3a5f':'white', color:subTab===t?'white':'#475569',
    fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap',
  })

  const actionBtn = (label, onClick, style={}) => (
    <button onClick={onClick} style={{ border:'none', padding:'5px 10px', borderRadius:6, cursor:'pointer', fontSize:11, fontWeight:700, fontFamily:'inherit', ...style }}>{label}</button>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', overflowX: mob ? 'auto' : 'visible' }}>
          <button style={subTabStyle('gate')} onClick={()=>setSubTab('gate')}>
            🪪 Gate Passes
            {outsideNow.length>0 && <span style={{ marginLeft:5, background:'#ef4444', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{outsideNow.length}</span>}
          </button>
          <button style={subTabStyle('hostel')} onClick={()=>setSubTab('hostel')}>
            🏠 Hostel Leave
            {hlAway.length>0 && <span style={{ marginLeft:5, background:'#ef4444', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{hlAway.length}</span>}
          </button>
          <button style={subTabStyle('staff')} onClick={()=>setSubTab('staff')}>
            👩‍🏫 Staff Leave
            {staffPending.length>0 && <span style={{ marginLeft:5, background:'#7c3aed', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{staffPending.length}</span>}
          </button>
          {/* FIX 10 — Visitor still inside sub-tab */}
          <button style={subTabStyle('visitors')} onClick={()=>setSubTab('visitors')}>
            👤 Visitors Inside
            {visitors.length>0 && <span style={{ marginLeft:5, background:'#ef4444', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{visitors.length}</span>}
          </button>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:11, color:'#94a3b8' }}>↻ {lastRefresh.toLocaleTimeString('en-IN')}</span>
          <button onClick={refreshAll} style={{ padding:'7px 12px', borderRadius:8, border:'1.5px solid #e2e8f0', background:'white', color:'#475569', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Refresh</button>
        </div>
      </div>

      {/* ══ GATE PASS MONITOR ══ */}
      {subTab==='gate' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:14 }}>
            {[
              { label:'Currently outside', value:outsideNow.length,     color:'#dc2626' },
              { label:'Overdue (>8h)',      value:overdueGP.length,      color:'#d97706' },
              { label:'Returned today',     value:returnedToday.length,  color:'#059669' },
              { label:'Total passes',       value:gatePasses.length,     color:'#1e3a5f' },
            ].map(s=>(
              <div key={s.label} style={{ background:'white', borderRadius:12, padding:'12px 14px', borderLeft:`4px solid ${s.color}`, boxShadow:'0 2px 6px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize:9, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', display:'inline-block' }}></span>
              Students currently outside ({outsideNow.length})
            </div>
            {outsideNow.length===0
              ? <EmptyState msg="✅ All students are present on campus" />
              : outsideNow.map(g=>(
                <MonitorRow key={g.id}
                  initLetter={g.student_name?.[0]}
                  avatarColor={g.status==='Exited'?'#dc2626':'#1e3a5f'}
                  name={g.student_name}
                  sub={`${g.class_name||''}${g.course?' · '+g.course:''} · ${g.reason}`}
                  meta={[
                    g.exit_time && <span key="t">Out: {g.exit_time}</span>,
                    g.approved_by && <span key="a">Approved: {g.approved_by}</span>,
                    <span key="p" style={{ color: g.parent_informed==='Yes'?'#059669':'#dc2626', fontWeight:700 }}>Parent: {g.parent_informed}</span>,
                  ].filter(Boolean)}
                  elapsedRecord={g}
                  statusLabel={g.status}
                  actions={[
                    canTransition(g.status,'Exited')   && actionBtn('→ Out',     ()=>updateGPStatusMon(g.id,g.status,'Exited'),   { background:'#fee2e2', color:'#dc2626' }),
                    canTransition(g.status,'Returned') && actionBtn('↩ Returned',()=>updateGPStatusMon(g.id,g.status,'Returned'), { background:'#dcfce7', color:'#166534' }),
                    actionBtn('🖨️',()=>printGatePass(g), { background:'#fef3c7', color:'#92400e' }),
                  ].filter(Boolean)}
                />
              ))
            }
          </div>

          <div style={card}>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:12 }}>All gate passes</div>
            <RecordsTable loading={false} rows={gatePasses}
              columns={[
                { key:'exit_date',       label:'Date',    render:r=>fmtDate(r.exit_date) },
                { key:'student_name',    label:'Student', render:r=><b>{r.student_name}</b> },
                { key:'class_name',      label:'Class' },
                { key:'reason',          label:'Reason' },
                { key:'parent_informed', label:'Parent',  render:r=><span style={{ color:r.parent_informed==='Yes'?'#059669':'#dc2626', fontWeight:700 }}>{r.parent_informed}</span> },
                { key:'status',          label:'Status',  render:r=><Pill label={r.status} /> },
                { key:'_a',              label:'Actions', render:r=>(
                  <div style={{ display:'flex', gap:4 }}>
                    {canTransition(r.status,'Exited')   && <button onClick={()=>updateGPStatusMon(r.id,r.status,'Exited')}   style={{ ...delBtn, background:'#fee2e2', color:'#dc2626' }}>→ Out</button>}
                    {canTransition(r.status,'Returned') && <button onClick={()=>updateGPStatusMon(r.id,r.status,'Returned')} style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>↩ In</button>}
                    <button onClick={()=>printGatePass(r)} style={{ ...delBtn, background:'#fef3c7', color:'#92400e' }}>🖨️</button>
                  </div>
                )},
              ]}
            />
          </div>
        </>
      )}

      {/* ══ HOSTEL LEAVE ══ */}
      {subTab==='hostel' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:14 }}>
            {[
              { label:'Currently away',  value:hlAway.length,    color:'#dc2626' },
              { label:'Overdue return',  value:hlOverdue.length, color:'#d97706' },
              { label:'Returned',        value:hlRecords.filter(r=>r.status==='Returned').length, color:'#059669' },
              { label:'Total records',   value:hlRecords.length, color:'#1e3a5f' },
            ].map(s=>(
              <div key={s.label} style={{ background:'white', borderRadius:12, padding:'12px 14px', borderLeft:`4px solid ${s.color}`, boxShadow:'0 2px 6px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize:9, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          <div style={{ ...card, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:12 }}>Boarders currently away ({hlAway.length})</div>
            {hlLoading && <div style={{ color:'#94a3b8', padding:16 }}>Loading…</div>}
            {!hlLoading && hlAway.length===0 && <EmptyState msg="✅ All boarders are in the hostel" />}
            {!hlLoading && hlAway.map(r=>{
              const isOverdue = hlOverdue.includes(r.id)
              return (
                <MonitorRow key={r.id}
                  initLetter={r.student_name?.[0]}
                  avatarColor={isOverdue?'#dc2626':'#1e3a5f'}
                  name={<>{r.student_name}{isOverdue&&<span style={{ marginLeft:8, fontSize:11, color:'#dc2626', fontWeight:700 }}>⚠ OVERDUE</span>}</>}
                  sub={`🏠 ${r.house||'—'} · ${r.class_name||''} · ${r.reason}`}
                  meta={[
                    <span key="dep">Left: {fmtDate(r.departure_date)}</span>,
                    <span key="ret" style={{ color:isOverdue?'#dc2626':'#64748b' }}>Return by: {fmtDate(r.return_date)}</span>,
                    r.course && <span key="c" style={{ color:'#0891b2' }}>{r.course}</span>,
                  ].filter(Boolean)}
                  elapsedRecord={{ created_at:r.created_at }}
                  statusLabel={isOverdue?'Overdue':'Out'}
                  actions={[
                    actionBtn('↩ Returned', ()=>updateHLStatus(r.id,'Out','Returned'), { background:'#dcfce7', color:'#166534' }),
                    actionBtn('✕', ()=>softDelete('hostel_leave_records',r.id,loadHL), { background:'#fee2e2', color:'#dc2626' }),
                  ]}
                />
              )
            })}
          </div>

          <div style={{ ...card, marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:showHLForm?14:0 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f' }}>📝 Record hostel leave</div>
              <button onClick={()=>setShowHLForm(v=>!v)} style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid #1e3a5f', background:showHLForm?'#1e3a5f':'white', color:showHLForm?'white':'#1e3a5f', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {showHLForm?'✕ Cancel':'+ Add'}
              </button>
            </div>
            {showHLForm && (
              <form onSubmit={saveHL}>
                <div style={{ ...grid2(mob), marginTop:8 }}>
                  <div style={span2}>
                    <FormField label="Search & select student *">
                      <StudentAutocomplete students={students} resetKey={hlResetKey} onSelect={onSelectHL} />
                      <StudentChip student={hlStudent} onClear={()=>{ setHLStudent(null); setHLForm(f=>({...f, student_name:'', class_name:'', house:'', course:'', hostel_type:''})); setHLResetKey(k=>k+1) }} />
                    </FormField>
                  </div>
                  <FormField label="Class"><FormSelect field="class_name" value={hlForm.class_name} onChange={set_hl} options={CLASS_OPTIONS} placeholder="Select class…" /></FormField>
                  <FormField label="House"><FormSelect field="house" value={hlForm.house} onChange={set_hl} options={HOUSE_OPTIONS} placeholder="Select house…" /></FormField>
                  <FormField label="Course"><FormSelect field="course" value={hlForm.course} onChange={set_hl} options={COURSES} placeholder="Select course…" /></FormField>
                  <FormField label="Hostel Type"><FormSelect field="hostel_type" value={hlForm.hostel_type} onChange={set_hl} options={HOSTEL_TYPES} placeholder="Select type…" /></FormField>
                  <FormField label="Reason"><FormSelect field="reason" value={hlForm.reason} onChange={set_hl} options={HOSTEL_LEAVE_REASONS} placeholder="Select reason…" /></FormField>
                  <FormField label="Departure Date"><FormInput field="departure_date" value={hlForm.departure_date} onChange={set_hl} type="date" /></FormField>
                  <FormField label="Expected Return"><FormInput field="return_date" value={hlForm.return_date} onChange={set_hl} type="date" /></FormField>
                  <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={hlForm.remarks} onChange={set_hl} /></FormField></div>
                </div>
                <SaveBtn label="Record Leave" saving={saving} />
              </form>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:12 }}>All hostel leave records ({hlRecords.length})</div>
            <RecordsTable loading={hlLoading} rows={hlRecords}
              columns={[
                { key:'departure_date', label:'Departed',  render:r=>fmtDate(r.departure_date) },
                { key:'student_name',   label:'Student',   render:r=><b>{r.student_name}</b> },
                { key:'house',          label:'House',     render:r=>r.house?<span style={{ color:'#059669', fontWeight:700 }}>🏠 {r.house}</span>:'—' },
                { key:'reason',         label:'Reason' },
                { key:'return_date',    label:'Return By', render:r=>{
                  const ov=r.status==='Out'&&r.return_date&&r.return_date<today()
                  return <span style={{ color:ov?'#dc2626':'inherit', fontWeight:ov?700:400 }}>{fmtDate(r.return_date)}{ov?' ⚠':''}</span>
                }},
                { key:'status',         label:'Status',    render:r=><Pill label={hlOverdue.includes(r.id)?'Overdue':r.status} /> },
                { key:'_a',             label:'Actions',   render:r=>(
                  <div style={{ display:'flex', gap:4 }}>
                    {canTransition(r.status,'Returned') && <button onClick={()=>updateHLStatus(r.id,r.status,'Returned')} style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>↩ Returned</button>}
                    <button onClick={()=>softDelete('hostel_leave_records',r.id,loadHL)} style={delBtn}>Archive</button>
                  </div>
                )},
              ]}
            />
          </div>
        </>
      )}

      {/* ══ STAFF LEAVE ══ */}
      {subTab==='staff' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(4,1fr)', gap:10, marginBottom:14 }}>
            {[
              { label:'Pending approval', value:staffPending.length, color:'#d97706' },
              { label:'On leave now',     value:staffOnLeave.length, color:'#dc2626' },
              { label:'Returned',         value:staffRecords.filter(r=>r.status==='Returned').length, color:'#059669' },
              { label:'Total requests',   value:staffRecords.length, color:'#1e3a5f' },
            ].map(s=>(
              <div key={s.label} style={{ background:'white', borderRadius:12, padding:'12px 14px', borderLeft:`4px solid ${s.color}`, boxShadow:'0 2px 6px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize:9, fontWeight:700, color:s.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{s.label}</div>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
              </div>
            ))}
          </div>

          {staffPending.length>0 && (
            <div style={{ ...card, marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#d97706', marginBottom:12 }}>⏳ Pending approval ({staffPending.length})</div>
              {staffPending.map(r=>(
                <MonitorRow key={r.id}
                  initLetter={r.staff_name?.[0]} avatarColor="#ca8a04"
                  name={r.staff_name}
                  sub={`${r.role||''}${r.department?' · '+r.department:''}`}
                  meta={[
                    <span key="lt" style={{ color:'#7c3aed' }}>{r.leave_type}</span>,
                    <span key="d">{fmtDate(r.from_date)} – {fmtDate(r.to_date)}</span>,
                    // FIX 6 — show auto-calculated days
                    <span key="days" style={{ color:'#ca8a04', fontWeight:700 }}>{r.days} day{r.days>1?'s':''}</span>,
                  ].filter(Boolean)}
                  elapsedRecord={{ created_at:r.created_at }}
                  statusLabel="Pending"
                  actions={[
                    actionBtn('✓ Approve', ()=>updateStaffStatus(r.id,'Pending','Approved'), { background:'#dcfce7', color:'#166534' }),
                    actionBtn('✕ Reject',  ()=>softDelete('staff_leave_requests',r.id,loadStaff), { background:'#fee2e2', color:'#dc2626' }),
                  ]}
                />
              ))}
            </div>
          )}

          <div style={{ ...card, marginBottom:14 }}>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', display:'inline-block' }}></span>
              Staff currently on leave ({staffOnLeave.length})
            </div>
            {staffLoading && <div style={{ color:'#94a3b8', padding:16 }}>Loading…</div>}
            {!staffLoading && staffOnLeave.length===0 && <EmptyState msg="✅ All staff are present" />}
            {!staffLoading && staffOnLeave.map(r=>(
              <MonitorRow key={r.id}
                initLetter={r.staff_name?.[0]} avatarColor="#7c3aed"
                name={r.staff_name}
                sub={`${r.role||''}${r.department?' · '+r.department:''}`}
                meta={[
                  <span key="lt" style={{ color:'#7c3aed' }}>{r.leave_type}</span>,
                  <span key="d">{fmtDate(r.from_date)} – {fmtDate(r.to_date)}</span>,
                  <span key="days" style={{ fontWeight:700 }}>{r.days} day{r.days>1?'s':''}</span>,
                  r.approved_by && <span key="a">Approved: {r.approved_by}</span>,
                ].filter(Boolean)}
                elapsedRecord={{ created_at:r.created_at }}
                statusLabel="Approved"
                actions={[
                  actionBtn('↩ Returned', ()=>updateStaffStatus(r.id,'Approved','Returned'), { background:'#dcfce7', color:'#166534' }),
                ]}
              />
            ))}
          </div>

          <div style={{ ...card, marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:showStaffForm?14:0 }}>
              <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f' }}>📝 Log staff leave</div>
              <button onClick={()=>setShowStaffForm(v=>!v)} style={{ padding:'6px 12px', borderRadius:8, border:'1.5px solid #1e3a5f', background:showStaffForm?'#1e3a5f':'white', color:showStaffForm?'white':'#1e3a5f', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {showStaffForm?'✕ Cancel':'+ Add'}
              </button>
            </div>
            {showStaffForm && (
              <form onSubmit={saveStaff}>
                <div style={{ ...grid2(mob), marginTop:8 }}>
                  <FormField label="Staff Name *"><FormInput field="staff_name" value={staffForm.staff_name} onChange={set_staff} required /></FormField>
                  <FormField label="Role / Designation"><FormInput field="role" value={staffForm.role} onChange={set_staff} placeholder="e.g. Class Teacher" /></FormField>
                  <FormField label="Department"><FormSelect field="department" value={staffForm.department} onChange={set_staff} options={STAFF_DEPARTMENTS} placeholder="Select dept…" /></FormField>
                  <FormField label="Leave Type"><FormSelect field="leave_type" value={staffForm.leave_type} onChange={set_staff} options={STAFF_LEAVE_TYPES} placeholder="Select type…" /></FormField>
                  <FormField label="From Date"><FormInput field="from_date" value={staffForm.from_date} onChange={set_staff} type="date" /></FormField>
                  <FormField label="To Date"><FormInput field="to_date" value={staffForm.to_date} onChange={set_staff} type="date" /></FormField>
                  {/* FIX 6 — auto-calculated, read-only display */}
                  <FormField label="No. of Days (auto)">
                    <input type="text" readOnly style={{ ...inp, background:'#f8fafc', color:'#1e3a5f', fontWeight:700 }} value={staffForm.days||'—'} />
                  </FormField>
                  <FormField label="Status"><FormSelect field="status" value={staffForm.status} onChange={set_staff} options={['Pending','Approved','Returned']} /></FormField>
                  <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={staffForm.remarks} onChange={set_staff} /></FormField></div>
                </div>
                <SaveBtn label="Save Leave Request" saving={saving} />
              </form>
            )}
          </div>

          <div style={card}>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:12 }}>All staff leave records ({staffRecords.length})</div>
            <RecordsTable loading={staffLoading} rows={staffRecords}
              columns={[
                { key:'from_date',   label:'From',  render:r=>fmtDate(r.from_date) },
                { key:'to_date',     label:'To',    render:r=>fmtDate(r.to_date) },
                { key:'staff_name',  label:'Staff', render:r=><b>{r.staff_name}</b> },
                { key:'department',  label:'Dept',  render:r=>r.department?<span style={{ color:'#7c3aed', fontWeight:700 }}>{r.department}</span>:'—' },
                { key:'leave_type',  label:'Type' },
                { key:'days',        label:'Days' },
                { key:'status',      label:'Status',render:r=><Pill label={r.status} /> },
                { key:'_a',          label:'Actions',render:r=>(
                  <div style={{ display:'flex', gap:4 }}>
                    {canTransition(r.status,'Approved')  && <button onClick={()=>updateStaffStatus(r.id,r.status,'Approved')}  style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>✓ Approve</button>}
                    {canTransition(r.status,'Returned')  && <button onClick={()=>updateStaffStatus(r.id,r.status,'Returned')}  style={{ ...delBtn, background:'#f1f5f9',  color:'#64748b' }}>↩ Returned</button>}
                    <button onClick={()=>softDelete('staff_leave_requests',r.id,loadStaff)} style={delBtn}>Archive</button>
                  </div>
                )},
              ]}
            />
          </div>
        </>
      )}

      {/* ══ FIX 10 — VISITORS STILL INSIDE ══ */}
      {subTab==='visitors' && (
        <div style={card}>
          <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', display:'inline-block' }}></span>
            Visitors currently inside ({visitors.length})
          </div>
          {visitors.length===0 && <EmptyState msg="✅ No visitors currently inside" />}
          {visitors.map(v=>(
            <MonitorRow key={v.id}
              initLetter={v.visitor_name?.[0]} avatarColor="#0f766e"
              name={v.visitor_name}
              sub={`${v.purpose} · Meeting: ${v.meeting_with||'—'}`}
              meta={[
                <span key="in">In: {v.in_time||fmtDate(v.visit_date)}</span>,
                v.phone && <span key="p">📞 {v.phone}</span>,
                v.id_proof && <span key="id">{v.id_proof}</span>,
              ].filter(Boolean)}
              elapsedRecord={{ created_at:v.created_at }}
              statusLabel="Active"
              actions={[
                <button key="out" onClick={async ()=>{
                  const now = new Date().toTimeString().slice(0,5)
                  await supabase.from('reception_visitors').update({ out_time:now }).eq('id',v.id)
                  setVisitors(prev=>prev.filter(x=>x.id!==v.id))
                }} style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>✓ Mark Out</button>,
                actionBtn('🖨️', ()=>printVisitorBadge(v), { background:'#fef3c7', color:'#92400e' }),
              ]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function ReceptionPage() {
  const mob = useIsMobile()
  const [activeTab,   setActiveTab]   = useState('Student 360°')
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [piView,      setPiView]      = useState('list')

  const [students,    setStudents]    = useState([])
  const [enquiries,   setEnquiries]   = useState([])
  const [visitors,    setVisitors]    = useState([])
  const [gatePasses,  setGatePasses]  = useState([])
  const [parentItems, setParentItems] = useState([])
  const [customItems, setCustomItems] = useState([])

  const [enquiryForm, setEnquiryForm] = useState(ENQ_DEF)
  const [visitorForm, setVisitorForm] = useState(VIS_DEF)
  const [gpForm,      setGpForm]      = useState(GP_DEF)
  const [piForm,      setPiForm]      = useState(PI_DEF)

  const [enquiryResetKey, setEnquiryResetKey] = useState(0)
  const [visitorResetKey, setVisitorResetKey] = useState(0)
  const [gpResetKey,      setGpResetKey]      = useState(0)
  const [piResetKey,      setPiResetKey]      = useState(0)

  const [enquiryStudent, setEnquiryStudent] = useState(null)
  const [visitorStudent, setVisitorStudent] = useState(null)
  const [gpStudent,      setGpStudent]      = useState(null)
  const [piStudent,      setPiStudent]      = useState(null)

  useEffect(()=>{
    fetchAll()
    supabase.from('students').select('*').order('name').then(({data})=>setStudents(data||[]))
    // FIX 8 — load custom items from Supabase
    supabase.from('reception_custom_items').select('name').order('created_at').then(({data})=>{
      if (data) setCustomItems(data.map(r=>r.name))
    })
  },[])

  const fetchAll = async () => {
    setLoading(true)
    const [e,v,g,p] = await Promise.all([
      supabase.from('reception_enquiries').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('reception_visitors').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('reception_gatepasses').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
      supabase.from('reception_parent_items').select('*').is('deleted_at',null).order('created_at',{ascending:false}),
    ])
    if (!e.error) setEnquiries(e.data||[])
    if (!v.error) setVisitors(v.data||[])
    if (!g.error) setGatePasses(g.data||[])
    if (!p.error) setParentItems(p.data||[])
    setLoading(false)
  }

  // FIX 1 — duplicate gate pass guard
  const handleInsert = async (table, payload, reset, opts={}) => {
    setSaving(true)

    // Block duplicate active gate passes
    if (table==='reception_gatepasses' && payload.student_name) {
      const { data:existing } = await supabase.from('reception_gatepasses').select('id').eq('student_name',payload.student_name).in('status',['Issued','Exited']).is('deleted_at',null)
      if (existing && existing.length>0) {
        alert(`⚠ ${payload.student_name} already has an active gate pass (Issued/Exited). Please close the existing pass before issuing a new one.`)
        setSaving(false); return
      }
    }

    // FIX 5 — duplicate hostel leave guard
    if (table==='hostel_leave_records' && payload.student_name) {
      const { data:existing } = await supabase.from('hostel_leave_records').select('id').eq('student_name',payload.student_name).eq('status','Out').is('deleted_at',null)
      if (existing && existing.length>0) {
        alert(`⚠ ${payload.student_name} already has an active hostel leave record. Please mark them as Returned first.`)
        setSaving(false); return
      }
    }

    const { error } = await supabase.from(table).insert([payload])
    if (error) alert(error.message)
    else { reset(); fetchAll() }
    setSaving(false)
  }

  // FIX 9 — soft delete
  const handleDelete = async (table, id) => {
    if (!window.confirm('Archive this record? It will be hidden but not permanently deleted.')) return
    const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id',id)
    if (error) alert(error.message)
    else fetchAll()
  }

  // FIX 3 — guarded status updates
  const updateGPStatus = async (id, from, to) => {
    if (!canTransition(from,to)) return
    await supabase.from('reception_gatepasses').update({status:to}).eq('id',id)
    fetchAll()
  }
  const updatePIStatus = async (id, from, to) => {
    if (!canTransition(from,to)) return
    await supabase.from('reception_parent_items').update({status:to}).eq('id',id)
    fetchAll()
  }

  // FIX 8 — save custom items to Supabase
  const addCustomItem = async item => {
    const next = [...customItems, item]
    setCustomItems(next)
    await supabase.from('reception_custom_items').insert([{ name: item }])
  }

  const onSelectEnquiry = useCallback(s=>{
    if (s) { setEnquiryStudent(s); setEnquiryForm(f=>({...f, student_name:s.name, class_interest:s.batch||f.class_interest, phone:s.phone||f.phone, parent_name:s.father_name||f.parent_name})) }
    else   { setEnquiryStudent(null); setEnquiryForm(f=>({...f, student_name:'', parent_name:''})) }
  },[])

  const onSelectVisitor = useCallback(s=>{
    if (s) { setVisitorStudent(s); setVisitorForm(f=>({...f, meeting_with:f.meeting_with||`Re: ${s.name}${s.batch?' ('+s.batch+')':''}`})) }
    else   { setVisitorStudent(null) }
  },[])

  const onSelectGP = useCallback(s=>{
    if (s) { setGpStudent(s); setGpForm(f=>({...f, student_name:s.name, class_name:s.batch||f.class_name, course:s.course||f.course})) }
    else   { setGpStudent(null); setGpForm(f=>({...f, student_name:'', class_name:'', course:''})) }
  },[])

  const onSelectPI = useCallback(s=>{
    if (s) { setPiStudent(s); setPiForm(f=>({...f, student_name:s.name, class_name:s.batch||f.class_name, house:s.house||f.house, course:s.course||f.course, hostel_type:s.hostel_type||f.hostel_type})) }
    else   { setPiStudent(null); setPiForm(f=>({...f, student_name:'', class_name:'', house:'', course:'', hostel_type:''})) }
  },[])

  // FIX 11 — targeted search columns only
  const filteredRows = useMemo(()=>{
    const q = search.toLowerCase()
    const searchCols = {
      'Enquiry':      ['student_name','parent_name','phone','class_interest','source','status','remarks'],
      'Visitor Book': ['visitor_name','phone','purpose','meeting_with','id_proof'],
      'Gate Pass':    ['student_name','class_name','course','reason','approved_by','status'],
      'Parent Items': ['student_name','parent_name','class_name','course','item_name','house','status'],
    }
    const cols = searchCols[activeTab] || []
    const arr  = activeTab==='Enquiry' ? enquiries : activeTab==='Visitor Book' ? visitors : activeTab==='Gate Pass' ? gatePasses : parentItems
    if (!q) return arr
    return arr.filter(r => cols.some(c => String(r[c]||'').toLowerCase().includes(q)))
  },[activeTab, search, enquiries, visitors, gatePasses, parentItems])

  const followUpDue  = enquiries.filter(e=>e.follow_up_date===today()&&e.status!=='Converted'&&e.status!=='Closed').length
  const stillOutside = gatePasses.filter(g=>g.status==='Exited').length
  const pendingItems = parentItems.filter(p=>p.status==='Pending').length

  const set_enq = (f,v) => setEnquiryForm(p=>({...p,[f]:v}))
  const set_vis = (f,v) => setVisitorForm(p=>({...p,[f]:v}))
  const set_gp  = (f,v) => setGpForm(p=>({...p,[f]:v}))
  const set_pi  = (f,v) => setPiForm(p=>({...p,[f]:v}))

  const tabBtn = tab => ({
    padding: mob ? '8px 12px' : '9px 18px',
    borderRadius:9, border:'none', cursor:'pointer', fontWeight:700,
    fontSize: mob ? 12 : 13, fontFamily:'inherit',
    background:activeTab===tab?'#1e3a5f':'#f1f5f9',
    color:     activeTab===tab?'#fff'   :'#475569',
    whiteSpace:'nowrap',
  })

  return (
    <div style={{ padding: mob ? '12px 12px' : '24px', fontFamily:'system-ui,sans-serif', background:'#f0f4f8', minHeight:'100vh' }}>

      {/* Header */}
      <div style={{ marginBottom:16 }}>
        <h1 style={{ fontSize: mob ? 20 : 26, fontWeight:800, color:'#1e3a5f', margin:0 }}>🛎️ Reception Management</h1>
        <p style={{ color:'#64748b', fontSize:12, marginTop:3 }}>Enquiries · Visitors · Gate Passes · Parent Items · Student 360°</p>
      </div>

      {/* Stat cards — 2 columns on mobile */}
      <div style={{ display:'grid', gridTemplateColumns:mob?'1fr 1fr':'repeat(5,1fr)', gap:10, marginBottom:16 }}>
        {[
          { label:'Enquiries',      value:enquiries.length,  color:'#2563eb', icon:'📋', alert:followUpDue>0 ?`${followUpDue} due today`:null },
          { label:'Visitors Today', value:visitors.filter(v=>v.visit_date===today()).length, color:'#0f766e', icon:'👤' },
          { label:'Gate Passes',    value:gatePasses.length, color:'#ca8a04', icon:'🪪', alert:stillOutside>0?`${stillOutside} outside`:null },
          { label:'Pending Items',  value:pendingItems,      color:'#7c3aed', icon:'📦', alert:pendingItems>0 ?'awaiting delivery':null },
          { label:'Students',       value:students.length,   color:'#1e3a5f', icon:'🎓' },
        ].map(c=>(
          <div key={c.label} style={{ background:'white', borderRadius:12, padding:'12px 14px', borderLeft:`4px solid ${c.color}`, boxShadow:'0 2px 8px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize:16, marginBottom:3 }}>{c.icon}</div>
            <div style={{ fontSize:9, fontWeight:700, color:c.color, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:2 }}>{c.label}</div>
            <div style={{ fontSize:20, fontWeight:800, color:c.color }}>{c.value}</div>
            {c.alert && <div style={{ fontSize:10, color:'#ef4444', fontWeight:700, marginTop:2 }}>⚠ {c.alert}</div>}
          </div>
        ))}
      </div>

      {/* Tabs — horizontal scroll on mobile */}
      <div style={{ display:'flex', gap:8, flexWrap:'nowrap', marginBottom:16, overflowX:'auto', WebkitOverflowScrolling:'touch', paddingBottom:4 }}>
        {TABS.map(tab=>(
          <button key={tab} onClick={()=>{ setActiveTab(tab); setSearch('') }} style={tabBtn(tab)}>
            {tab==='Student 360°'&&'🔍 '}{tab==='Monitors'&&'📡 '}{tab}
            {tab==='Enquiry'      && followUpDue>0  && <span style={{ marginLeft:5, background:'#ef4444', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{followUpDue}</span>}
            {tab==='Gate Pass'    && stillOutside>0 && <span style={{ marginLeft:5, background:'#ef4444', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{stillOutside}</span>}
            {tab==='Parent Items' && pendingItems>0  && <span style={{ marginLeft:5, background:'#7c3aed', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{pendingItems}</span>}
            {tab==='Monitors'     && stillOutside>0 && <span style={{ marginLeft:5, background:'#ef4444', color:'white', borderRadius:99, fontSize:10, padding:'1px 5px', fontWeight:800 }}>{stillOutside}</span>}
          </button>
        ))}
      </div>

      {activeTab==='Student 360°' && <Student360 students={students} />}
      {activeTab==='Monitors'     && <MonitorsTab students={students} gatePasses={gatePasses} onGPStatusChange={(id,from,to)=>updateGPStatus(id,from,to)} fetchAll={fetchAll} />}

      {/* Search bar */}
      {activeTab!=='Student 360°' && activeTab!=='Monitors' && (
        <div style={{ ...card, marginBottom:14 }}>
          <input style={inp} placeholder={`Search ${activeTab.toLowerCase()}…`} value={search} onChange={e=>setSearch(e.target.value)}
            onFocus={e=>e.target.style.borderColor='#1e3a5f'} onBlur={e=>e.target.style.borderColor='#d1d5db'} />
        </div>
      )}

      {/* ══ ENQUIRY ══ */}
      {activeTab==='Enquiry' && (
        <>
          <div style={{ ...card, marginBottom:14 }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:14 }}>➕ Add Enquiry</h2>
            <form onSubmit={e=>{
              e.preventDefault()
              handleInsert('reception_enquiries', enquiryForm, ()=>{ setEnquiryForm({...ENQ_DEF, enquiry_date:today()}); setEnquiryStudent(null); setEnquiryResetKey(k=>k+1) })
            }}>
              <div style={grid2(mob)}>
                <div style={span2}>
                  <FormField label="Link to student (optional)">
                    <StudentAutocomplete students={students} resetKey={enquiryResetKey} onSelect={onSelectEnquiry} />
                    <StudentChip student={enquiryStudent} onClear={()=>{ setEnquiryStudent(null); setEnquiryForm(f=>({...f, student_name:'', parent_name:''})); setEnquiryResetKey(k=>k+1) }} />
                  </FormField>
                </div>
                <FormField label="Parent Name"><FormInput field="parent_name" value={enquiryForm.parent_name} onChange={set_enq} /></FormField>
                <FormField label="Phone"><FormInput field="phone" value={enquiryForm.phone} onChange={set_enq} /></FormField>
                <FormField label="Class Interest"><FormSelect field="class_interest" value={enquiryForm.class_interest} onChange={set_enq} options={CLASS_OPTIONS} placeholder="Select class…" /></FormField>
                <FormField label="Source"><FormSelect field="source" value={enquiryForm.source} onChange={set_enq} options={SOURCE_OPTIONS} placeholder="Select source…" /></FormField>
                <FormField label="Status"><FormSelect field="status" value={enquiryForm.status} onChange={set_enq} options={['New','Follow Up','Converted','Closed']} /></FormField>
                <FormField label="Enquiry Date"><FormInput field="enquiry_date" value={enquiryForm.enquiry_date} onChange={set_enq} type="date" /></FormField>
                <FormField label="Follow Up Date"><FormInput field="follow_up_date" value={enquiryForm.follow_up_date} onChange={set_enq} type="date" /></FormField>
                <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={enquiryForm.remarks} onChange={set_enq} /></FormField></div>
              </div>
              <SaveBtn label="Save Enquiry" saving={saving} />
            </form>
          </div>
          <div style={card}>
            <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:12 }}>Enquiry Records ({filteredRows.length})</h2>
            <RecordsTable loading={loading} rows={filteredRows} onDelete={id=>handleDelete('reception_enquiries',id)}
              columns={[
                { key:'enquiry_date',   label:'Date',      render:r=>fmtDate(r.enquiry_date) },
                { key:'student_name',   label:'Student',   render:r=><b>{r.student_name||'—'}</b> },
                { key:'parent_name',    label:'Parent' },
                { key:'phone',          label:'Phone' },
                { key:'class_interest', label:'Class' },
                { key:'source',         label:'Source' },
                { key:'status',         label:'Status',    render:r=><Pill label={r.status} /> },
                { key:'follow_up_date', label:'Follow Up', render:r=>{
                  const due=r.follow_up_date===today()
                  return <span style={{ color:due?'#ef4444':'inherit', fontWeight:due?700:400 }}>{fmtDate(r.follow_up_date)}{due?' ⚠':''}</span>
                }},
              ]}
            />
          </div>
        </>
      )}

      {/* ══ VISITOR BOOK ══ */}
      {activeTab==='Visitor Book' && (
        <>
          <div style={{ ...card, marginBottom:14 }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:14 }}>➕ Add Visitor</h2>
            <form onSubmit={e=>{
              e.preventDefault()
              handleInsert('reception_visitors', visitorForm, ()=>{ setVisitorForm({...VIS_DEF, visit_date:today()}); setVisitorStudent(null); setVisitorResetKey(k=>k+1) })
            }}>
              <div style={grid2(mob)}>
                <div style={span2}>
                  <FormField label="Student being visited (optional)">
                    <StudentAutocomplete students={students} resetKey={visitorResetKey} onSelect={onSelectVisitor} placeholder="Search student…" />
                    <StudentChip student={visitorStudent} onClear={()=>{ setVisitorStudent(null); setVisitorResetKey(k=>k+1) }} />
                  </FormField>
                </div>
                <FormField label="Visitor Name *"><FormInput field="visitor_name" value={visitorForm.visitor_name} onChange={set_vis} required /></FormField>
                <FormField label="Phone"><FormInput field="phone" value={visitorForm.phone} onChange={set_vis} /></FormField>
                <FormField label="Purpose *"><FormSelect field="purpose" value={visitorForm.purpose} onChange={set_vis} options={PURPOSE_OPTIONS} placeholder="Select purpose…" /></FormField>
                <FormField label="Meeting With"><FormSelect field="meeting_with" value={visitorForm.meeting_with} onChange={set_vis} options={MEETING_WITH_OPTIONS} placeholder="Select whom…" /></FormField>
                <FormField label="In Time"><FormInput field="in_time" value={visitorForm.in_time} onChange={set_vis} type="time" /></FormField>
                <FormField label="Out Time"><FormInput field="out_time" value={visitorForm.out_time} onChange={set_vis} type="time" /></FormField>
                <FormField label="Visit Date"><FormInput field="visit_date" value={visitorForm.visit_date} onChange={set_vis} type="date" /></FormField>
                <FormField label="ID Proof"><FormSelect field="id_proof" value={visitorForm.id_proof} onChange={set_vis} options={ID_PROOF_OPTIONS} placeholder="Select ID…" /></FormField>
                <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={visitorForm.remarks} onChange={set_vis} /></FormField></div>
              </div>
              <SaveBtn label="Save Visitor" saving={saving} />
            </form>
          </div>
          <div style={card}>
            <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:12 }}>Visitor Records ({filteredRows.length})</h2>
            <RecordsTable loading={loading} rows={filteredRows} onDelete={id=>handleDelete('reception_visitors',id)}
              columns={[
                { key:'visit_date',   label:'Date',    render:r=>fmtDate(r.visit_date) },
                { key:'visitor_name', label:'Visitor', render:r=><b>{r.visitor_name}</b> },
                { key:'phone',        label:'Phone' },
                { key:'purpose',      label:'Purpose' },
                { key:'meeting_with', label:'Meeting With' },
                { key:'in_time',      label:'In' },
                { key:'out_time',     label:'Out', render:r=>r.out_time||<span style={{ color:'#ef4444', fontWeight:700 }}>Still Inside</span> },
                { key:'id_proof',     label:'ID Proof' },
                { key:'_badge',       label:'Badge', render:r=><button onClick={()=>printVisitorBadge(r)} style={{ ...delBtn, background:'#fef3c7', color:'#92400e' }}>🖨️</button> },
              ]}
            />
          </div>
        </>
      )}

      {/* ══ GATE PASS ══ */}
      {activeTab==='Gate Pass' && (
        <>
          <div style={{ ...card, marginBottom:14 }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:14 }}>➕ Issue Gate Pass</h2>
            <form onSubmit={e=>{
              e.preventDefault()
              // FIX 2 — require student selection
              if (!gpForm.student_name || !gpForm.student_name.trim()) { alert('Please search and select a student before issuing a gate pass.'); return }
              // FIX 7 — warn if parent not informed
              if (gpForm.parent_informed==='No') {
                if (!window.confirm('⚠ Parent has NOT been informed. Are you sure you want to issue this gate pass without informing the parent?')) return
              }
              handleInsert('reception_gatepasses', { ...gpForm, student_name: gpStudent?.name || gpForm.student_name }, ()=>{ setGpForm({...GP_DEF, exit_date:today()}); setGpStudent(null); setGpResetKey(k=>k+1) })
            }}>
              <div style={grid2(mob)}>
                <div style={span2}>
                  <FormField label="Search & select student * (required)">
                    <StudentAutocomplete students={students} resetKey={gpResetKey} onSelect={onSelectGP} />
                    <StudentChip student={gpStudent} onClear={()=>{ setGpStudent(null); setGpForm(f=>({...f, student_name:'', class_name:'', course:''})); setGpResetKey(k=>k+1) }} />
                    {!gpStudent && <div style={{ marginTop:6, fontSize:12, color:'#ef4444', fontWeight:600 }}>⚠ Student must be selected</div>}
                  </FormField>
                </div>
                <FormField label="Class"><FormSelect field="class_name" value={gpForm.class_name} onChange={set_gp} options={CLASS_OPTIONS} placeholder="Select class…" /></FormField>
                <FormField label="Course"><FormSelect field="course" value={gpForm.course} onChange={set_gp} options={COURSES} placeholder="Select course…" /></FormField>
                <FormField label="Reason *"><FormSelect field="reason" value={gpForm.reason} onChange={set_gp} options={GP_REASON_OPTIONS} placeholder="Select reason…" /></FormField>
                <FormField label="Exit Date"><FormInput field="exit_date" value={gpForm.exit_date} onChange={set_gp} type="date" /></FormField>
                <FormField label="Exit Time"><FormInput field="exit_time" value={gpForm.exit_time} onChange={set_gp} type="time" /></FormField>
                <FormField label="Approved By"><FormSelect field="approved_by" value={gpForm.approved_by} onChange={set_gp} options={APPROVED_BY_OPTIONS} placeholder="Select approver…" /></FormField>
                <FormField label="Parent Informed">
                  <FormSelect field="parent_informed" value={gpForm.parent_informed} onChange={set_gp} options={['Yes','No']} />
                  {gpForm.parent_informed==='No' && <div style={{ marginTop:5, fontSize:12, color:'#ef4444', fontWeight:600 }}>⚠ Parent has not been informed</div>}
                </FormField>
                <FormField label="Status"><FormSelect field="status" value={gpForm.status} onChange={set_gp} options={['Issued','Exited','Returned']} /></FormField>
                <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={gpForm.remarks} onChange={set_gp} /></FormField></div>
              </div>
              <SaveBtn label="Issue Gate Pass" saving={saving} />
            </form>
          </div>
          <div style={card}>
            <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:12 }}>Gate Pass Records ({filteredRows.length})</h2>
            <RecordsTable loading={loading} rows={filteredRows} onDelete={id=>handleDelete('reception_gatepasses',id)}
              columns={[
                { key:'exit_date',       label:'Date',    render:r=>fmtDate(r.exit_date) },
                { key:'student_name',    label:'Student', render:r=><b>{r.student_name}</b> },
                { key:'class_name',      label:'Class' },
                { key:'reason',          label:'Reason' },
                { key:'parent_informed', label:'Parent',  render:r=><span style={{ color:r.parent_informed==='Yes'?'#059669':'#dc2626', fontWeight:700 }}>{r.parent_informed}</span> },
                { key:'status',          label:'Status',  render:r=><Pill label={r.status} /> },
                { key:'_q',              label:'Actions', render:r=>(
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={()=>printGatePass(r)} style={{ ...delBtn, background:'#fef3c7', color:'#92400e' }}>🖨️</button>
                    {canTransition(r.status,'Exited')   && <button onClick={()=>updateGPStatus(r.id,r.status,'Exited')}   style={{ ...delBtn, background:'#fee2e2', color:'#dc2626' }}>→ Out</button>}
                    {canTransition(r.status,'Returned') && <button onClick={()=>updateGPStatus(r.id,r.status,'Returned')} style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>↩ In</button>}
                  </div>
                )},
              ]}
            />
          </div>
        </>
      )}

      {/* ══ PARENT ITEMS ══ */}
      {activeTab==='Parent Items' && (
        <>
          <div style={{ ...card, marginBottom:14 }}>
            <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:14 }}>📦 Record Parent Item</h2>
            <form onSubmit={e=>{
              e.preventDefault()
              // FIX 2 — require student selection
              if (!piForm.student_name || !piForm.student_name.trim()) { alert('Please search and select a student.'); return }
              if (!piForm.item_names?.length) { alert('Please select at least one item.'); return }
                handleInsert('reception_parent_items', {
  ...piForm,
  student_name: piStudent?.name || piForm.student_name,
  item_name: (piForm.item_names || []).join(', '),
  item_names: undefined,   // ← add this line
}, ()=>{ setPiForm({...PI_DEF, received_date:today()}); setPiStudent(null); setPiResetKey(k=>k+1) })
            }}>
              <div style={grid2(mob)}>
                <div style={span2}>
                  <FormField label="Search & select student * (required)">
                    <StudentAutocomplete students={students} resetKey={piResetKey} onSelect={onSelectPI} />
                    <StudentChip student={piStudent} onClear={()=>{ setPiStudent(null); setPiForm(f=>({...f, student_name:'', class_name:'', house:'', course:'', hostel_type:''})); setPiResetKey(k=>k+1) }} />
                    {!piStudent && <div style={{ marginTop:6, fontSize:12, color:'#ef4444', fontWeight:600 }}>⚠ Student must be selected</div>}
                  </FormField>
                </div>
                <FormField label="Parent Name *"><FormInput field="parent_name" value={piForm.parent_name} onChange={set_pi} required /></FormField>
                <FormField label="Class / Batch"><FormSelect field="class_name" value={piForm.class_name} onChange={set_pi} options={CLASS_OPTIONS} placeholder="Select class…" /></FormField>
                <FormField label="Course"><FormSelect field="course" value={piForm.course} onChange={set_pi} options={COURSES} placeholder="Select course…" /></FormField>
                <FormField label="Hostel Type"><FormSelect field="hostel_type" value={piForm.hostel_type} onChange={set_pi} options={HOSTEL_TYPES} placeholder="Select type…" /></FormField>
                <FormField label="House / Block"><FormSelect field="house" value={piForm.house} onChange={set_pi} options={HOUSE_OPTIONS} placeholder="Select house…" /></FormField>
                <FormField label="Quantity"><FormInput field="quantity" value={piForm.quantity} onChange={set_pi} /></FormField>
                <FormField label="Received Date"><FormInput field="received_date" value={piForm.received_date} onChange={set_pi} type="date" /></FormField>
                <FormField label="Received By (Staff Name)"><FormInput field="received_by" value={piForm.received_by} onChange={set_pi} placeholder="e.g. Th. Priya, John sir…" /></FormField>
                <FormField label="Status"><FormSelect field="status" value={piForm.status} onChange={set_pi} options={['Pending','Delivered','Returned']} /></FormField>
                <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={piForm.remarks} onChange={set_pi} /></FormField></div>
                <div style={span2}>
                  <label style={lbl}>Select Item * <span style={{ textTransform:'none', fontWeight:400, color:'#94a3b8', fontSize:11 }}>(choose or add custom)</span></label>
                  <ItemPicker value={piForm.item_names||[]} onChange={v=>setPiForm(f=>({...f, item_names:v}))} customItems={customItems} onAddCustom={addCustomItem} />
                </div>
              </div>
              <SaveBtn label="Record Item" saving={saving} />
            </form>
          </div>

          <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:12, fontWeight:700, color:'#64748b' }}>View:</span>
            {[['list','📋 List'],['house','🏠 By House']].map(([v,l])=>(
              <button key={v} type="button" onClick={()=>setPiView(v)}
                style={{ padding:'7px 14px', borderRadius:8, border:`1.5px solid ${piView===v?'#1e3a5f':'#e2e8f0'}`, background:piView===v?'#1e3a5f':'white', color:piView===v?'white':'#475569', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {l}
              </button>
            ))}
          </div>

          {piView==='house' && (
            <div style={card}>
              <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:14 }}>🏠 House-wise Item Grid</h2>
              <HouseWiseGrid parentItems={parentItems} onStatusChange={(id,to)=>{
                const item = parentItems.find(p=>p.id===id)
                if (item) updatePIStatus(id, item.status, to)
              }} />
            </div>
          )}
          {piView==='list' && (
            <div style={card}>
              <h2 style={{ fontSize:15, fontWeight:800, color:'#1e3a5f', marginBottom:12 }}>Parent Item Records ({filteredRows.length})</h2>
              <RecordsTable loading={loading} rows={filteredRows} onDelete={id=>handleDelete('reception_parent_items',id)}
                columns={[
                  { key:'received_date', label:'Date',    render:r=>fmtDate(r.received_date) },
                  { key:'parent_name',   label:'Parent',  render:r=><b>{r.parent_name}</b> },
                  { key:'student_name',  label:'Student' },
                  { key:'house',         label:'House',   render:r=>r.house?<span style={{ color:'#059669', fontWeight:700 }}>🏠 {r.house}</span>:'—' },
                  { key:'item_name',     label:'Item',    render:r=><b>{r.item_name}</b> },
                  { key:'quantity',      label:'Qty' },
                  { key:'status',        label:'Status',  render:r=><Pill label={r.status} /> },
                  { key:'_actions',      label:'Actions', render:r=>(
                    <div style={{ display:'flex', gap:4 }}>
                      <button onClick={()=>printItemInvoice(r)} style={{ ...delBtn, background:'#f5f3ff', color:'#7c3aed' }}>🖨️</button>
                      {canTransition(r.status,'Delivered') && <button onClick={()=>updatePIStatus(r.id,r.status,'Delivered')} style={{ ...delBtn, background:'#dcfce7', color:'#166534' }}>✓</button>}
                      {canTransition(r.status,'Returned')  && <button onClick={()=>updatePIStatus(r.id,r.status,'Returned')}  style={{ ...delBtn, background:'#f1f5f9',  color:'#64748b' }}>↩</button>}
                    </div>
                  )},
                ]}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}
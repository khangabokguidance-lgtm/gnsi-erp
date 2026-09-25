// ReportGenerator.jsx — GNSI Portal · Admissions Module
// ─────────────────────────────────────────────────────────────────────────────
// Phase A of the Admissions modernization plan.
// Generates four report templates from data already loaded in Admissions.jsx
// (no new Supabase queries — reuses `apps` + `cols` props exactly as
// AnalyticsDashboard does). Exports to PDF (jsPDF + autotable) and
// Excel (SheetJS), both fully client-side, matching the banking-style
// design tokens (T, N) already defined in Admissions.jsx.
//
// Drop-in usage inside Admissions.jsx:
//   import ReportGenerator from './ReportGenerator'
//   {showReports && <ReportGenerator apps={apps} cols={cols} activeSession={activeSession} />}
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

// ─── Re-use the same tokens as Admissions.jsx so this never looks bolted-on ──
// (Importing the literal objects would be cleaner long-term — for now these
// mirror T / N exactly so the file can be dropped in standalone if needed.)
const T = {
  indigo:  { 50:'#EEF2FF',100:'#C7D2FE',500:'#6366F1',600:'#4F46E5',700:'#3730A3' },
  emerald: { 50:'#ECFDF5',100:'#D1FAE5',500:'#10B981',600:'#059669',700:'#047857' },
  amber:   { 50:'#FFFBEB',100:'#FEF3C7',500:'#F59E0B',600:'#D97706',700:'#B45309' },
  violet:  { 50:'#F5F3FF',100:'#EDE9FE',500:'#8B5CF6',600:'#7C3AED',700:'#6D28D9' },
  rose:    { 50:'#FFF1F2',100:'#FFE4E6',500:'#F43F5E',600:'#E11D48',700:'#BE123C' },
  slate:   { 50:'#F8FAFC',100:'#F1F5F9',200:'#E2E8F0',300:'#CBD5E1',400:'#94A3B8',500:'#64748B',600:'#475569',700:'#334155',800:'#1E293B',900:'#0F172A' },
  sky:     { 50:'#F0F9FF',500:'#0EA5E9',600:'#0284C7' },
}
const N = {
  bg:      '#FFFFFF',
  bg2:     '#faf8f3',
  text:    '#0f1b2e',
  text2:   '#2c3a52',
  muted:   '#5d6b82',
  muted2:  '#6b7688',
  navy:    '#132a4f',
  navyLight:'#1e3a6e',
  gold:    '#b8923a',
  goldDark:'#9c7a2c',
  emerald: '#0A8042',
  rose:    '#D70015',
  border:  '#d9d2c2',
  shadow:  (size='md') => {
    const m = {
      sm: '0 0 0 1px #e8e3d8, 0 1px 2px rgba(19,42,79,.05)',
      md: '0 0 0 1px #e8e3d8, 0 1px 2px rgba(19,42,79,.05), 0 8px 22px -10px rgba(19,42,79,.18)',
      lg: '0 0 0 1px #e8e3d8, 0 2px 4px rgba(19,42,79,.06), 0 18px 40px -16px rgba(19,42,79,.28)',
    }
    return m[size] || m.md
  },
  inset: (size='md') => {
    const m = {
      sm: '0 0 0 2px rgba(30,58,110,.55), 0 0 0 5px rgba(30,58,110,.08)',
      md: '0 0 0 2px rgba(30,58,110,.55), 0 0 0 5px rgba(30,58,110,.08)',
    }
    return m[size] || m.md
  },
}

const COURSE_STRUCTURE = {
  Navodaya:          { color:T.indigo[600] },
  Sainik:            { color:T.emerald[600] },
  Foundation:        { color:T.violet[600] },
  'Combined Course': { color:T.amber[600] },
}
const HOUSES_LIST = ['Kombirei','Shiroi','Loktak','Singgarei','Koubru','Kangla','Sangai','Takhelei','Block-B','Day Scholar']
const CATEGORIES   = ['General','OBC','SC','ST','EWS','Other']
const QUOTA_TYPES   = ['Open','Sports','Defence Ward','Staff Ward','NRI','Other']
const ADM_STATUSES  = ['Applied','Under Review','Admitted','Enrolled','Rejected','Waitlisted']

const fmt   = n => Number(n||0).toLocaleString('en-IN')
const today = () => new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })
const todayCompact = () => new Date().toISOString().slice(0,10)

// ─── Report template registry ───────────────────────────────────────────────
const TEMPLATES = [ // accent colours tuned to the portal's navy/gold palette
  {
    key:'summary', label:'Admission Summary', icon:'📋', color:'#1e3a6e', bg:'#eef2f9',
    desc:'Counts by status, course, and house for the selected range',
  },
  {
    key:'fees', label:'Fee Collection Register', icon:'💰', color:T.emerald[600], bg:T.emerald[50],
    desc:'Every recorded payment with applicant, amount, and date',
  },
  {
    key:'house', label:'House-wise Occupancy', icon:'🏠', color:T.violet[600], bg:T.violet[50],
    desc:'Capacity vs. filled seats for every house and hostel type',
  },
  {
    key:'category', label:'Category & Quota Breakdown', icon:'📊', color:T.amber[600], bg:T.amber[50],
    desc:'Distribution across reservation category and quota type',
  },
]

const HOUSE_CAPACITIES = {
  'Kombirei':40,'Shiroi':40,'Loktak':40,'Singgarei':40,'Koubru':40,
  'Kangla':40,'Sangai':40,'Takhelei':40,'Block-B':30,'Day Scholar':999,
}

// ─── Filter bar ─────────────────────────────────────────────────────────────
function FilterChip({ label, options, value, onChange }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, color:N.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>{label}</div>
      <select value={value} onChange={e=>onChange(e.target.value)}
        style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', minHeight:40, borderRadius:10, border:`1px solid ${N.border}`, fontSize:13, background:'#fff', color:N.text, fontFamily:'inherit' }}>
        <option value="All">All</option>
        {options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

// ─── Filtering logic shared by every report ────────────────────────────────
function useFilteredData(apps, filters) {
  return useMemo(() => {
    const { dateFrom, dateTo, session, course, status } = filters
    return apps.filter(a => {
      if (session !== 'All' && a.session !== session) return false
      if (course  !== 'All' && a.course  !== course)  return false
      if (status  !== 'All' && a.status  !== status)  return false
      if (dateFrom && a.created_at && a.created_at.slice(0,10) < dateFrom) return false
      if (dateTo   && a.created_at && a.created_at.slice(0,10) > dateTo)   return false
      return true
    })
  }, [apps, filters])
}

// ─── PDF builder ────────────────────────────────────────────────────────────
function buildPDF(templateKey, rows, cols, filters) {
  const doc = new jsPDF({ unit:'pt', format:'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  // Letterhead
  doc.setFillColor(19,42,79)
  doc.rect(0, 0, pageWidth, 70, 'F')
  doc.setFillColor(184,146,58)
  doc.rect(0, 70, pageWidth, 2.5, 'F')
  doc.setTextColor(255,255,255)
  doc.setFont('helvetica','bold')
  doc.setFontSize(16)
  doc.text('GNSI — Guidance Navodaya & Sainik Institute', 40, 30)
  doc.setFont('helvetica','normal')
  doc.setFontSize(9)
  doc.text('Khangabok, Thoubal District, Manipur', 40, 46)
  doc.setFontSize(8)
  doc.text(`Generated on ${today()}`, 40, 60)

  const tmpl = TEMPLATES.find(t=>t.key===templateKey)
  doc.setTextColor(19,42,79)
  doc.setFont('helvetica','bold')
  doc.setFontSize(13)
  doc.text(tmpl.label, 40, 92)

  const filterLine = [
    filters.session !== 'All' ? `Session: ${filters.session}` : null,
    filters.course  !== 'All' ? `Course: ${filters.course}`   : null,
    filters.status  !== 'All' ? `Status: ${filters.status}`   : null,
    filters.dateFrom ? `From: ${filters.dateFrom}` : null,
    filters.dateTo   ? `To: ${filters.dateTo}`     : null,
  ].filter(Boolean).join('  ·  ')
  if (filterLine) {
    doc.setFont('helvetica','normal')
    doc.setFontSize(9)
    doc.setTextColor(110,110,115)
    doc.text(filterLine, 40, 108)
  }

  let startY = filterLine ? 124 : 112

  if (templateKey === 'summary') {
    const byStatus = ADM_STATUSES.map(s => [s, rows.filter(a=>a.status===s).length])
    const byCourse = Object.keys(COURSE_STRUCTURE).map(c => [c, rows.filter(a=>a.course===c).length])
    autoTable(doc, {
      startY, head:[['Status','Count']], body:byStatus,
      theme:'striped', headStyles:{ fillColor:[30,58,110] }, alternateRowStyles:{ fillColor:[250,248,243] }, margin:{ left:40, right:40 },
    })
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 24, head:[['Course','Count']], body:byCourse,
      theme:'striped', headStyles:{ fillColor:[30,58,110] }, alternateRowStyles:{ fillColor:[250,248,243] }, margin:{ left:40, right:40 },
    })
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(19,42,79)
    doc.text(`Total Applications: ${rows.length}`, 40, doc.lastAutoTable.finalY + 24)

  } else if (templateKey === 'fees') {
    const feeRows = rows
      .map(a => {
        const c = cols.find(c => String(parseInt(c.adm_app_id))===String(parseInt(a.gcc)) && c.fee_type==='admission')
        return c ? [a.gcc, a.name, a.course||'—', c.amount ? `Rs. ${fmt(c.amount)}` : '—', c.payment_date || c.created_at?.slice(0,10) || '—'] : null
      })
      .filter(Boolean)
    autoTable(doc, {
      startY, head:[['GCC','Name','Course','Amount','Date']], body:feeRows,
      theme:'striped', headStyles:{ fillColor:[5,150,105] }, margin:{ left:40, right:40 },
    })
    const total = feeRows.reduce((s,r) => s + parseInt(String(r[3]).replace(/[^\d]/g,'')||0), 0)
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(5,150,105)
    doc.text(`Total Collected: Rs. ${fmt(total)}  (${feeRows.length} payments)`, 40, doc.lastAutoTable.finalY + 24)

  } else if (templateKey === 'house') {
    const houseRows = HOUSES_LIST.filter(h=>h!=='Day Scholar').map(h => {
      const count = rows.filter(a=>a.house===h).length
      const cap   = HOUSE_CAPACITIES[h] || 40
      return [h, count, cap, `${Math.round((count/cap)*100)}%`]
    })
    autoTable(doc, {
      startY, head:[['House','Occupied','Capacity','Fill %']], body:houseRows,
      theme:'striped', headStyles:{ fillColor:[124,58,237] }, margin:{ left:40, right:40 },
    })

  } else if (templateKey === 'category') {
    const catRows   = CATEGORIES.map(c => [c, rows.filter(a=>a.category===c).length])
    const quotaRows = QUOTA_TYPES.map(q => [q, rows.filter(a=>a.quota===q).length])
    autoTable(doc, {
      startY, head:[['Category','Count']], body:catRows,
      theme:'striped', headStyles:{ fillColor:[217,119,6] }, margin:{ left:40, right:40 },
    })
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 24, head:[['Quota Type','Count']], body:quotaRows,
      theme:'striped', headStyles:{ fillColor:[217,119,6] }, margin:{ left:40, right:40 },
    })
  }

  // Footer
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(150,150,155)
    doc.text(`GNSI Portal v2.0 · Page ${i} of ${pageCount}`, 40, doc.internal.pageSize.getHeight() - 24)
  }

  doc.save(`GNSI_${tmpl.label.replace(/\s+/g,'_')}_${todayCompact()}.pdf`)
}

// ─── Excel builder ──────────────────────────────────────────────────────────
function buildExcel(templateKey, rows, cols, filters) {
  const wb = XLSX.utils.book_new()
  const tmpl = TEMPLATES.find(t=>t.key===templateKey)

  if (templateKey === 'summary') {
    const data = rows.map(a => ({
      'GCC No': a.gcc, 'Name': a.name, 'Course': a.course||'', 'Subtype': a.subtype||'',
      'Class': a.cls||'', 'House': a.house||'', 'Hostel Type': a.hostel_type, 'Session': a.session||'',
      'Status': a.status, 'Phone': a.phone||'', 'Applied On': a.created_at?.slice(0,10)||'',
    }))
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Admission Summary')

  } else if (templateKey === 'fees') {
    const data = rows.map(a => {
      const c = cols.find(c => String(parseInt(c.adm_app_id))===String(parseInt(a.gcc)) && c.fee_type==='admission')
      if (!c) return null
      return {
        'GCC No': a.gcc, 'Name': a.name, 'Course': a.course||'',
        'Amount (₹)': c.amount||0, 'Payment Date': c.payment_date||c.created_at?.slice(0,10)||'',
        'Fee Type': c.fee_type||'',
      }
    }).filter(Boolean)
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Fee Collection')

  } else if (templateKey === 'house') {
    const data = HOUSES_LIST.filter(h=>h!=='Day Scholar').map(h => {
      const count = rows.filter(a=>a.house===h).length
      const cap   = HOUSE_CAPACITIES[h] || 40
      return { 'House': h, 'Occupied': count, 'Capacity': cap, 'Fill %': Math.round((count/cap)*100) }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'House Occupancy')

  } else if (templateKey === 'category') {
    const catData   = CATEGORIES.map(c => ({ 'Category': c, 'Count': rows.filter(a=>a.category===c).length }))
    const quotaData = QUOTA_TYPES.map(q => ({ 'Quota Type': q, 'Count': rows.filter(a=>a.quota===q).length }))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catData), 'By Category')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(quotaData), 'By Quota')
  }

  XLSX.writeFile(wb, `GNSI_${tmpl.label.replace(/\s+/g,'_')}_${todayCompact()}.xlsx`)
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function ReportGenerator({ apps, cols, sessionOptions=[], courseOptions=[] }) {
  const [selected, setSelected] = useState('summary')
  const [filters, setFilters] = useState({ dateFrom:'', dateTo:'', session:'All', course:'All', status:'All' })
  const [generating, setGenerating] = useState(null)

  const filteredRows = useFilteredData(apps, filters)
  const tmpl = TEMPLATES.find(t=>t.key===selected)

  const setFilter = (k,v) => setFilters(f => ({ ...f, [k]:v }))

  const handleGenerate = async (format) => {
    setGenerating(format)
    try {
      await new Promise(r => setTimeout(r, 50)) // let UI paint the loading state
      if (format === 'pdf') buildPDF(selected, filteredRows, cols, filters)
      else buildExcel(selected, filteredRows, cols, filters)
    } finally {
      setGenerating(null)
    }
  }

  const counts = {
    total: filteredRows.length,
    enrolled: filteredRows.filter(a=>a.status==='Enrolled').length,
    pending: filteredRows.filter(a=>a.status==='Applied'||a.status==='Under Review').length,
  }

  return (
    <div className="rg-root" style={{ background:N.bg, borderRadius:20, boxShadow:N.shadow('lg'), overflow:'hidden', marginBottom:16, fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif" }}>
      <style>{`
        .rg-root * { box-sizing:border-box; }
        .rg-root input:focus, .rg-root select:focus { outline:none; border-color:#1e3a6e !important; box-shadow:0 0 0 3px rgba(30,58,110,.14) !important; }
        .rg-root button:not(:disabled) { transition:transform .12s, filter .12s, box-shadow .15s; }
        .rg-root button:not(:disabled):hover { filter:brightness(.98); }
        .rg-root button:not(:disabled):active { transform:scale(.98); }
        .rg-root button:focus-visible { outline:2px solid #b8923a; outline-offset:2px; }
        .rg-tpl:hover { transform:translateY(-2px); }
      `}</style>

      {/* Header */}
      <div style={{ position:'relative', overflow:'hidden', padding:'20px 24px', background:'radial-gradient(90% 160% at 100% 0%,rgba(184,146,58,.28) 0%,transparent 55%),linear-gradient(135deg,#0e203f 0%,#132a4f 45%,#1e3a6e 100%)' }}>
        <div style={{ position:'absolute', left:0, right:0, bottom:0, height:2, background:'linear-gradient(90deg,transparent,#b8923a,transparent)' }} />
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:14, display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(145deg,rgba(233,217,176,.28),rgba(233,217,176,.06))', border:'1px solid rgba(233,217,176,.35)', color:'#e9d9b0', flexShrink:0 }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 3.5h7L18 8v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"/><path d="M14 3.5V8h4M9 12.5h6M9 16h4"/></svg>
            </div>
            <div>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:'.2em', textTransform:'uppercase', color:'#e9d9b0', marginBottom:4 }}>Admissions · Reports</div>
              <div style={{ fontSize:21, fontWeight:600, color:'#fff', fontFamily:"'Fraunces',Georgia,serif", letterSpacing:'-.01em' }}>Report Generator</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,.65)', marginTop:3 }}>Admission, fee and occupancy reports as letterheaded PDF or Excel</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', flex:'1 1 240px', justifyContent:'flex-end' }}>
            {[['Matching',counts.total,'#fff'],['Enrolled',counts.enrolled,'#86efac'],['Pending',counts.pending,'#fcd34d']].map(([l,v,c]) => (
              <div key={l} style={{ flex:'1 1 70px', maxWidth:110, minWidth:0, padding:'8px 12px', borderRadius:12, background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)' }}>
                <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:'.12em', textTransform:'uppercase', color:'rgba(255,255,255,.6)' }}>{l}</div>
                <div style={{ fontSize:20, fontWeight:600, color:c, fontFamily:"'Fraunces',Georgia,serif", fontVariantNumeric:'tabular-nums', marginTop:2 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ padding:'20px 22px' }}>

        {/* Template picker */}
        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.16em', textTransform:'uppercase', color:N.gold, marginBottom:10 }}>1 · Choose a report</div>
        <div role="radiogroup" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(220px,100%),1fr))', gap:12, marginBottom:22 }}>
          {TEMPLATES.map(t => {
            const active = selected === t.key
            return (
              <button key={t.key} role="radio" aria-checked={active} className="rg-tpl" onClick={()=>setSelected(t.key)}
                style={{
                  position:'relative', overflow:'hidden', textAlign:'left', padding:'16px 16px 15px 18px', borderRadius:16, border:'none', cursor:'pointer', fontFamily:'inherit',
                  background: active ? `linear-gradient(180deg,${t.bg},#fff)` : N.bg, boxShadow: active ? N.inset('sm') : N.shadow('sm'),
                  transition:'box-shadow .15s, transform .15s',
                }}>
                <div style={{ position:'absolute', left:0, top:0, bottom:0, width:3, background: active ? t.color : 'transparent' }} />
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ width:36, height:36, borderRadius:11, background:t.bg, display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>{t.icon}</span>
                  <span style={{ width:18, height:18, borderRadius:'50%', border:`2px solid ${active ? t.color : '#d9d2c2'}`, display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                    {active && <span style={{ width:8, height:8, borderRadius:'50%', background:t.color }} />}
                  </span>
                </div>
                <div style={{ fontSize:14, fontWeight:700, color: active ? t.color : N.text }}>{t.label}</div>
                <div style={{ fontSize:11.5, color:N.muted, marginTop:4, lineHeight:1.45 }}>{t.desc}</div>
              </button>
            )
          })}
        </div>

        <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.16em', textTransform:'uppercase', color:N.gold, marginBottom:10 }}>2 · Narrow it down</div>
        {/* Filters */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:12, marginBottom:18, padding:'16px 18px', background:N.bg2, border:'1px solid #e8e3d8', borderRadius:16 }}>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:N.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>From</div>
            <input type="date" value={filters.dateFrom} onChange={e=>setFilter('dateFrom', e.target.value)}
              style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', minHeight:40, borderRadius:10, border:`1px solid ${N.border}`, fontSize:13, background:'#fff', color:N.text, fontFamily:'inherit' }} />
          </div>
          <div>
            <div style={{ fontSize:10, fontWeight:700, color:N.muted, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>To</div>
            <input type="date" value={filters.dateTo} onChange={e=>setFilter('dateTo', e.target.value)}
              style={{ width:'100%', boxSizing:'border-box', padding:'9px 12px', minHeight:40, borderRadius:10, border:`1px solid ${N.border}`, fontSize:13, background:'#fff', color:N.text, fontFamily:'inherit' }} />
          </div>
          <FilterChip label="Session" options={sessionOptions} value={filters.session} onChange={v=>setFilter('session',v)} />
          <FilterChip label="Course"  options={courseOptions}  value={filters.course}  onChange={v=>setFilter('course',v)} />
          <FilterChip label="Status"  options={ADM_STATUSES}   value={filters.status}  onChange={v=>setFilter('status',v)} />
        </div>

        {/* Preview count + actions */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, paddingTop:16, borderTop:'1px solid #e8e3d8' }}>
          <div style={{ fontSize:13, color:N.muted2 }}>
            <span style={{ fontSize:10.5, fontWeight:700, letterSpacing:'.16em', textTransform:'uppercase', color:N.gold, marginRight:10 }}>3 · Export</span>
            <strong style={{ color:N.text, fontWeight:800 }}>{filteredRows.length}</strong> record{filteredRows.length!==1?'s':''} match{filteredRows.length===1?'es':''} the selected filters
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>handleGenerate('excel')} disabled={generating || filteredRows.length===0}
              style={{ padding:'10px 20px', borderRadius:12, border:'none', cursor: filteredRows.length===0?'not-allowed':'pointer',
                background: N.bg, boxShadow:N.shadow('sm'), color:T.emerald[700], fontSize:13, fontWeight:700, fontFamily:'inherit',
                opacity: filteredRows.length===0 ? 0.5 : 1, display:'flex', alignItems:'center', gap:7 }}>
              {generating==='excel' ? '⏳ Generating…' : '📊 Export Excel'}
            </button>
            <button onClick={()=>handleGenerate('pdf')} disabled={generating || filteredRows.length===0}
              style={{ padding:'10px 20px', borderRadius:12, border:'none', cursor: filteredRows.length===0?'not-allowed':'pointer',
                background: `linear-gradient(180deg,${N.navyLight},${N.navy})`, color:'#fff', fontSize:13, fontWeight:700, fontFamily:'inherit',
                opacity: filteredRows.length===0 ? 0.5 : 1, boxShadow:'0 1px 0 rgba(255,255,255,.12) inset, 0 8px 18px -8px rgba(19,42,79,.6)', display:'flex', alignItems:'center', gap:7 }}>
              {generating==='pdf' ? '⏳ Generating…' : '🖨 Export PDF'}
            </button>
          </div>
        </div>

        {filteredRows.length === 0 && (
          <div style={{ marginTop:14, padding:'11px 14px', borderRadius:12, background:T.rose[50], border:`1px solid ${T.rose[100]}`, color:T.rose[700], fontSize:12.5, fontWeight:600 }}>
            No records match these filters — widen the date range or clear a filter to generate a report.
          </div>
        )}
      </div>
    </div>
  )
}
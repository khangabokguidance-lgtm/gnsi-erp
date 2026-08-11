// Reception.jsx  — GNSI Portal  (Premium v6 · Mobile Card Tables)
// ─────────────────────────────────────────────────────────────────────────────
// NEW IN v5:
//  1. 🔄 Auto-refresh Monitors (60s countdown)
//  2. ⚠️  Critical overdue alert panel (GP + Hostel combined)
//  3. 📤 WhatsApp follow-up button (Enquiry)
//  4. 🔁 Repeat visitor auto-fill (Visitor Book)
//  5. 📊 Daily summary card (printable)
//  6. 🔔 Duplicate detection (gate pass + enquiry)
//  7. 📅 Expected return time on Gate Pass
//  8. 📈 Enquiry source analytics (mini bar chart)
//  9. 🖨️  Export to Excel (all tabs via SheetJS)
// 10. 👥 Campus headcount live counter
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'
import * as XLSX from 'xlsx'

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  navy:    '#1e3a5f',
  navyMid: '#2a4f7c',
  gold:    '#c9a84c',
  goldLight:'#ffd060',
  indigo:  '#4f46e5',
  emerald: '#059669',
  amber:   '#d97706',
  red:     '#dc2626',
  violet:  '#7c3aed',
  sky:     '#0284c7',
  teal:    '#0f766e',
  slate: {
    50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
    300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b',
    600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a',
  },
}

const font = "'Outfit', system-ui, sans-serif"

// ── helpers ───────────────────────────────────────────────────────────────────
const fmt     = n => Number(n || 0).toLocaleString('en-IN')
const fmtDate = d => { if (!d) return '—'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const today   = () => new Date().toISOString().split('T')[0]
const gccStr  = g => String(parseInt(g) || g || '')
const TABS    = ['Student 360°', 'Enquiry', 'Visitor Book', 'Leave Application', 'Gate Pass', 'Parent Items', 'Monitors']

const TAB_ICONS = {
  'Student 360°': '🔍',
  'Enquiry':      '📋',
  'Visitor Book': '👤',
  'Gate Pass':    '🪪',
  'Parent Items': '📦',
  'Monitors':     '📡',
}

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
const GP_DEF   = { student_name:'', class_name:'', course:'', gcc_no:'', house:'', reason:'', exit_date:today(), exit_time:'', expected_return_time:'', return_date:'', responsible_contact:'', approved_by:'', parent_informed:'No', status:'Issued', remarks:'' }
const LA_DEF   = { student_name:'', gcc_no:'', class_name:'', house:'', course:'', reason:'', from_date:today(), to_date:'', responsible_contact:'', address:'', submitted_by:'Staff', applicant_note:'' }
const PI_DEF   = { parent_name:'', student_name:'', class_name:'', course:'', hostel_type:'', house:'', item_names:[], quantity:'1', received_date:today(), received_by:'', status:'Pending', remarks:'' }
const HOSTEL_LEAVE_DEF = { student_name:'', class_name:'', house:'', course:'', hostel_type:'', departure_date:today(), return_date:'', reason:'', status:'Out', remarks:'' }
const STAFF_LEAVE_DEF  = { staff_name:'', role:'', department:'', leave_type:'', from_date:today(), to_date:'', days:'', approved_by:'', status:'Pending', remarks:'' }

// ── valid status transitions ──────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  Issued:    ['Exited','Returned'],
  Exited:    ['Returned'],
  Out:       ['Returned'],
  Pending:   ['Approved','Delivered'],
  Approved:  ['Returned'],
  Delivered: ['Returned'],
}
const canTransition = (from, to) => (VALID_TRANSITIONS[from] || []).includes(to)

// ── status pill colours ───────────────────────────────────────────────────────
const STATUS_COLORS = {
  New:         { bg:'#dbeafe', color:'#1d4ed8',  border:'#93c5fd' },
  'Follow Up': { bg:'#fef9c3', color:'#92400e',  border:'#fde68a' },
  Converted:   { bg:'#dcfce7', color:'#166534',  border:'#86efac' },
  Closed:      { bg:'#f1f5f9', color:'#64748b',  border:'#e2e8f0' },
  Issued:      { bg:'#fef3c7', color:'#92400e',  border:'#fde68a' },
  Exited:      { bg:'#fee2e2', color:'#dc2626',  border:'#fca5a5' },
  Returned:    { bg:'#dcfce7', color:'#166534',  border:'#86efac' },
  Pending:     { bg:'#fef9c3', color:'#92400e',  border:'#fde68a' },
  Delivered:   { bg:'#dcfce7', color:'#166534',  border:'#86efac' },
  Active:      { bg:'#dcfce7', color:'#166534',  border:'#86efac' },
  Inactive:    { bg:'#f1f5f9', color:'#64748b',  border:'#e2e8f0' },
  Out:         { bg:'#fee2e2', color:'#dc2626',  border:'#fca5a5' },
  Overdue:     { bg:'#fde8d8', color:'#9a3412',  border:'#fdba74' },
  Approved:    { bg:'#dcfce7', color:'#166534',  border:'#86efac' },
}

function Pill({ label }) {
  const c = STATUS_COLORS[label] || { bg:'#f1f5f9', color:'#475569', border:'#e2e8f0' }
  return (
    <span style={{
      background: c.bg, color: c.color,
      border: `0.5px solid ${c.border}`,
      padding: '2px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
      fontFamily: font,
    }}>
      {label || '—'}
    </span>
  )
}

// ── shared styles ─────────────────────────────────────────────────────────────
const inp = {
  width: '100%', padding: '10px 13px', borderRadius: 10,
  border: `0.5px solid ${C.slate[200]}`, fontSize: 13,
  boxSizing: 'border-box', fontFamily: font, outline: 'none',
  background: C.slate[50], color: C.slate[800],
  transition: 'border-color .15s, box-shadow .15s',
}
const lbl = {
  display: 'block', marginBottom: 5, fontSize: 10,
  fontWeight: 700, color: C.slate[400],
  textTransform: 'uppercase', letterSpacing: '.07em', fontFamily: font,
}
const thS = {
  padding: '9px 12px', textAlign: 'left', fontSize: 10,
  fontWeight: 700, color: C.slate[400], borderBottom: `0.5px solid ${C.slate[200]}`,
  textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap',
  background: C.slate[50], fontFamily: font,
}
const tdS = {
  padding: '10px 12px', color: C.slate[700],
  fontSize: 13, verticalAlign: 'middle', fontFamily: font,
}
const delBtn = {
  background: '#fee2e2', color: C.red,
  border: 'none', padding: '5px 10px',
  borderRadius: 7, cursor: 'pointer', fontSize: 11,
  fontWeight: 700, fontFamily: font,
}

// ── Card primitives ───────────────────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{
      background: 'white', borderRadius: 18,
      border: `0.5px solid ${C.slate[200]}`,
      boxShadow: '0 2px 16px rgba(0,0,0,.05)',
      overflow: 'hidden', ...style,
    }}>
      {children}
    </div>
  )
}

function CardHead({ icon, title, sub, right, accentColor, isMobile }) {
  return (
    <div style={{
      padding: isMobile ? '13px 16px' : '15px 20px',
      borderBottom: `0.5px solid ${C.slate[100]}`,
      display: 'flex', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        <div style={{ width: 3, height: 22, background: accentColor || C.navy, borderRadius: 2, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 500, color: C.navy, lineHeight: 1.3, fontFamily: font }}>
            {icon && <span style={{ marginRight: 5 }}>{icon}</span>}{title}
          </div>
          {sub && <div style={{ fontSize: 10, color: C.slate[400], marginTop: 2 }}>{sub}</div>}
        </div>
      </div>
      {right && (
        <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
          {right}
        </div>
      )}
    </div>
  )
}

// ── Btn ───────────────────────────────────────────────────────────────────────
function Btn({ children, onClick, disabled, variant = 'primary', small, style = {} }) {
  const base = {
    borderRadius: small ? 9 : 12, border: 'none', fontFamily: font,
    fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: small ? 11 : 13, padding: small ? '6px 12px' : '10px 20px',
    transition: 'all .14s', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', gap: 6, flexShrink: 0, minHeight: small ? 32 : 40,
    WebkitTapHighlightColor: 'transparent',
  }
  const vars = {
    primary:  { background: disabled ? C.slate[200] : C.navy, color: disabled ? C.slate[400] : 'white' },
    success:  { background: disabled ? C.slate[200] : C.emerald, color: 'white' },
    danger:   { background: '#fee2e2', color: C.red, border: `0.5px solid #fca5a5` },
    ghost:    { background: C.slate[50], color: C.slate[600], border: `0.5px solid ${C.slate[200]}` },
    amber:    { background: '#fef3c7', color: '#92400e', border: `0.5px solid #fde68a` },
    navy:     { background: C.navy, color: C.gold },
    whatsapp: { background: '#25d366', color: 'white' },
  }
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      style={{ ...base, ...vars[variant], ...style }}>
      {children}
    </button>
  )
}

function SaveBtn({ label, saving }) {
  return (
    <button type="submit" disabled={saving}
      style={{
        marginTop: 16, background: saving ? C.slate[200] : C.navy,
        color: saving ? C.slate[400] : 'white', padding: '12px 24px',
        borderRadius: 12, border: 'none', fontWeight: 700, fontSize: 14,
        cursor: saving ? 'not-allowed' : 'pointer', fontFamily: font,
        width: '100%', minHeight: 46, transition: 'all .15s',
      }}>
      {saving ? '⏳ Saving…' : label}
    </button>
  )
}

function MiniBar({ pct }) {
  const color = pct >= 75 ? C.emerald : pct >= 50 ? C.amber : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: C.slate[100], borderRadius: 999, overflow: 'hidden', minWidth: 48 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 34 }}>{pct}%</span>
    </div>
  )
}

function useIsMobile() {
  const [mob, setMob] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const h = e => setMob(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return mob
}

const grid2 = mob => ({ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: 12 })
const span2 = { gridColumn: '1 / -1' }

function buildIndex(students) {
  return students.map(s => ({
    s,
    key: [s.name, s.gcc_no, s.admission_no, s.batch, s.house, s.phone, s.father_name]
      .filter(Boolean).map(v => String(v).toLowerCase()).join('\x00'),
  }))
}

// ── FEATURE 9: Export to Excel ────────────────────────────────────────────────
function exportToExcel(rows, columns, sheetName) {
  if (!rows.length) { alert('No data to export.'); return }
  const headers = columns.map(c => c.label)
  const data = rows.map(row => columns.map(c => {
    const val = row[c.key]
    if (c.key === 'enquiry_date' || c.key === 'visit_date' || c.key === 'exit_date' || c.key === 'received_date' || c.key === 'departure_date' || c.key === 'from_date' || c.key === 'to_date') return fmtDate(val)
    return val ?? ''
  }))
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `GNSI_${sheetName}_${today()}.xlsx`)
}

// ── FEATURE 5: Daily Summary Print ───────────────────────────────────────────
function printDailySummary({ enquiries, visitors, gatePasses, parentItems, students }) {
  const d = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  const t = today()
  const todayEnq  = enquiries.filter(e => e.enquiry_date === t)
  const todayVis  = visitors.filter(v => v.visit_date === t)
  const todayGP   = gatePasses.filter(g => g.exit_date === t)
  const outsideNow = gatePasses.filter(g => g.status === 'Issued' || g.status === 'Exited')
  const pendingItems = parentItems.filter(p => p.status === 'Pending')
  const followUpDue  = enquiries.filter(e => e.follow_up_date === t && e.status !== 'Converted' && e.status !== 'Closed')

  const tableRows = (arr, cols) => arr.length === 0
    ? `<tr><td colspan="${cols}" style="text-align:center;color:#94a3b8;padding:12px">No records</td></tr>`
    : arr.map(r => cols === 4
        ? `<tr><td>${r.student_name || '—'}</td><td>${r.reason || '—'}</td><td>${r.exit_time || '—'}</td><td style="font-weight:700;color:${r.status==='Returned'?'#166534':'#dc2626'}">${r.status}</td></tr>`
        : cols === 3
        ? `<tr><td>${r.visitor_name}</td><td>${r.purpose}</td><td>${r.in_time || '—'} – ${r.out_time || 'inside'}</td></tr>`
        : `<tr><td>${r.student_name || '—'}</td><td>${r.parent_name || '—'}</td><td>${r.phone || '—'}</td><td>${r.status}</td></tr>`
      ).join('')

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Daily Summary — ${d}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;padding:32px;color:#1e293b}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:20px}
.inst{font-size:17px;font-weight:700;color:#1e3a5f}.sub{font-size:11px;color:#64748b;margin-top:3px}
.title{font-size:20px;font-weight:800;color:#1e3a5f;margin-bottom:18px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 14px;text-align:center}
.sl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px}
.sv{font-size:24px;font-weight:800;color:#1e3a5f}
.section{margin-bottom:22px}
.sh{font-size:13px;font-weight:800;color:#1e3a5f;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px;border-left:3px solid #1e3a5f;padding-left:10px}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#1e3a5f;color:rgba(255,255,255,.8);padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
.sig{display:flex;justify-content:space-between;margin-top:36px;padding-top:20px;border-top:1px solid #e2e8f0}
.sb{text-align:center}.sl2{width:140px;border-top:1.5px solid #1e3a5f;margin:0 auto 6px}.st{font-size:11px;color:#64748b}
.ftr{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8}
@media print{body{padding:16px}}</style></head><body>
<div class="hdr"><div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div class="sub">Khangabok, Thoubal, Manipur — 795128</div></div><div style="text-align:right"><div style="font-size:10px;color:#94a3b8">Daily Summary</div><div style="font-weight:700;font-size:14px">${d}</div></div></div>
<div class="title">📋 Reception Daily Summary Report</div>
<div class="stats">
  <div class="stat"><div class="sl">Today's Enquiries</div><div class="sv">${todayEnq.length}</div></div>
  <div class="stat"><div class="sl">Today's Visitors</div><div class="sv">${todayVis.length}</div></div>
  <div class="stat"><div class="sl">Gate Passes Issued</div><div class="sv">${todayGP.length}</div></div>
  <div class="stat"><div class="sl">Students Outside</div><div class="sv" style="color:${outsideNow.length>0?'#dc2626':'#059669'}">${outsideNow.length}</div></div>
</div>
${followUpDue.length > 0 ? `<div class="section"><div class="sh">⚠ Follow-ups Due Today (${followUpDue.length})</div><table><tr><th>Student</th><th>Parent</th><th>Phone</th><th>Status</th></tr>${tableRows(followUpDue, 4)}</table></div>` : ''}
<div class="section"><div class="sh">Today's Gate Passes (${todayGP.length})</div><table><tr><th>Student</th><th>Reason</th><th>Exit Time</th><th>Status</th></tr>${tableRows(todayGP, 4)}</table></div>
<div class="section"><div class="sh">Today's Visitors (${todayVis.length})</div><table><tr><th>Visitor</th><th>Purpose</th><th>In – Out</th></tr>${tableRows(todayVis, 3)}</table></div>
${pendingItems.length > 0 ? `<div class="section"><div class="sh">📦 Pending Parent Items (${pendingItems.length})</div><table><tr><th>Student</th><th>Parent</th><th>Phone</th><th>Status</th></tr>${tableRows(pendingItems, 4)}</table></div>` : ''}
<div class="sig"><div class="sb"><div class="sl2"></div><div class="st">Receptionist</div></div><div class="sb"><div class="sl2"></div><div class="st">Security In-Charge</div></div><div class="sb"><div class="sl2"></div><div class="st">Principal</div></div></div>
<div class="ftr">GNSI Reception · Daily Summary · Computer Generated · ${d}</div></body></html>`

  const pw = window.open('', '_blank', 'width=820,height=900')
  if (!pw) return
  pw.document.write(html); pw.document.close(); setTimeout(() => pw.print(), 450)
}

// ── FEATURE 8: Enquiry Source Analytics ──────────────────────────────────────
function EnquirySourceChart({ enquiries }) {
  const counts = useMemo(() => {
    const c = {}
    enquiries.forEach(e => { if (e.source) c[e.source] = (c[e.source] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8)
  }, [enquiries])

  if (!counts.length) return null
  const max = counts[0][1]
  const COLORS = [C.navy, C.indigo, C.violet, C.sky, C.teal, C.emerald, C.amber, C.red]

  return (
    <Card style={{ marginBottom: 14 }}>
      <CardHead icon="📈" title="Enquiry Sources" sub="Where are leads coming from?" />
      <div style={{ padding: '14px 20px' }}>
        {counts.map(([source, count], i) => (
          <div key={source} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.slate[700], fontFamily: font }}>{source}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: COLORS[i % COLORS.length], fontFamily: font }}>{count}</span>
            </div>
            <div style={{ height: 8, background: C.slate[100], borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${(count / max) * 100}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 99, transition: 'width .5s ease' }} />
            </div>
          </div>
        ))}
        <div style={{ marginTop: 10, fontSize: 11, color: C.slate[400], fontFamily: font }}>Total enquiries: {enquiries.length}</div>
      </div>
    </Card>
  )
}

// ── FEATURE 10: Campus Headcount ──────────────────────────────────────────────
function CampusHeadcount({ students, gatePasses, hlRecords }) {
  const outsideGP  = gatePasses.filter(g => g.status === 'Issued' || g.status === 'Exited').length
  const outsideHL  = (hlRecords || []).filter(r => r.status === 'Out').length
  const totalAway  = outsideGP + outsideHL
  const total      = students.length
  const onCampus   = Math.max(0, total - totalAway)
  const pct        = total > 0 ? Math.round((onCampus / total) * 100) : 100

  return (
    <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0f2340 100%)`, borderRadius: 18, padding: '16px 20px', marginBottom: 14, border: `0.5px solid rgba(255,255,255,.1)` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.gold, textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: font }}>👥 Campus Headcount</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'white', fontFamily: font, marginTop: 4 }}>{onCampus} <span style={{ fontSize: 14, color: 'rgba(255,255,255,.5)', fontWeight: 400 }}>/ {total}</span></div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 2, fontFamily: font }}>students on campus right now</div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fca5a5', fontFamily: font }}>{outsideGP}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', fontFamily: font }}>Gate Pass Out</div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fde68a', fontFamily: font }}>{outsideHL}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', fontFamily: font }}>Hostel Leave</div>
          </div>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: '10px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#86efac', fontFamily: font }}>{pct}%</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', fontFamily: font }}>Attendance</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 12, height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: pct >= 90 ? C.emerald : pct >= 75 ? C.amber : C.red, borderRadius: 99, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

// ── FEATURE 2: Critical Overdue Alert Panel ───────────────────────────────────
function CriticalAlertPanel({ gatePasses, hlRecords, mob }) {
  const overdueGP = gatePasses.filter(g => (g.status === 'Issued' || g.status === 'Exited') && elapsedLabel(g).color === C.red)
  const overdueHL = (hlRecords || []).filter(r => r.status === 'Out' && r.return_date && r.return_date < today())

  if (!overdueGP.length && !overdueHL.length) return null

  return (
    <div style={{ background: '#fee2e2', border: `1.5px solid #fca5a5`, borderRadius: 16, padding: mob ? '12px 14px' : '14px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>🚨</span>
        <span style={{ fontSize: 14, fontWeight: 800, color: C.red, fontFamily: font }}>Critical Alerts — Immediate Action Required</span>
      </div>
      {overdueGP.map(g => (
        <div key={g.id} style={{ background: 'white', borderRadius: 10, padding: '9px 12px', marginBottom: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div>
            <span style={{ fontWeight: 700, color: C.red, fontSize: 13, fontFamily: font }}>🪪 {g.student_name}</span>
            <span style={{ fontSize: 11, color: C.slate[500], marginLeft: 8, fontFamily: font }}>{g.class_name} · Left: {g.exit_time || fmtDate(g.exit_date)}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: '#fee2e2', padding: '2px 9px', borderRadius: 99, fontFamily: font }}>⏱ {elapsedLabel(g).label} overdue</span>
        </div>
      ))}
      {overdueHL.map(r => (
        <div key={r.id} style={{ background: 'white', borderRadius: 10, padding: '9px 12px', marginBottom: 7, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
          <div>
            <span style={{ fontWeight: 700, color: '#92400e', fontSize: 13, fontFamily: font }}>🏠 {r.student_name}</span>
            <span style={{ fontSize: 11, color: C.slate[500], marginLeft: 8, fontFamily: font }}>Hostel leave · Due: {fmtDate(r.return_date)}</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '2px 9px', borderRadius: 99, fontFamily: font }}>OVERDUE</span>
        </div>
      ))}
    </div>
  )
}

// ── Print functions ───────────────────────────────────────────────────────────
function printItemInvoice(item) {
  const d = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const invoiceNo = `PI-${String(item.id || Date.now()).slice(-8).toUpperCase()}`
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Item Invoice — ${item.student_name}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#f0f4f8;display:flex;justify-content:center;padding:36px 16px}.page{width:680px;background:white;box-shadow:0 4px 32px rgba(0,0,0,.15);overflow:hidden;position:relative}.wm{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-size:90px;font-weight:900;color:rgba(30,58,95,.04);pointer-events:none;z-index:0;white-space:nowrap}.hdr{background:#1e3a5f;padding:24px 32px;position:relative;z-index:1;display:flex;justify-content:space-between;align-items:flex-start}.inst{color:white;font-size:18px;font-weight:700}.sub{color:rgba(255,255,255,.5);font-size:11px;margin-top:3px}.inv-l{font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em;text-align:right}.inv-no{font-size:20px;font-weight:800;color:#c9a84c;font-family:'Courier New',monospace;margin-top:2px;text-align:right}.accent{height:4px;background:linear-gradient(90deg,#7c3aed,#c9a84c)}.title-row{background:#f8fafc;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e2e8f0}.title{font-size:14px;font-weight:800;color:#1e3a5f;text-transform:uppercase;letter-spacing:.06em}.badge{background:#7c3aed;color:white;font-size:10px;font-weight:700;padding:3px 11px;border-radius:99px}.body{padding:24px 32px;position:relative;z-index:1}.meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:22px}.mc{padding:11px 14px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.mc:nth-child(even){border-right:none}.mc:nth-last-child(-n+2){border-bottom:none}.ml{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}.mv{font-size:13px;font-weight:700;color:#1e293b}.pt{width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:18px}.pt thead{background:#1e3a5f}.pt th{padding:9px 14px;text-align:left;font-size:11px;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.05em}.pt td{padding:11px 14px;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9}.status-row{display:flex;justify-content:flex-end;margin-bottom:22px}.status-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 18px;text-align:right;min-width:160px}.sl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}.sv{font-size:14px;font-weight:800;color:#1e293b}.sig{display:flex;justify-content:space-between;padding-top:28px;border-top:1px solid #e2e8f0}.sb{text-align:center}.sl2{width:130px;border-top:1.5px solid #1e3a5f;margin:0 auto 6px}.st{font-size:11px;color:#64748b}.ftr{background:#f8fafc;border-top:1px solid #e2e8f0;padding:11px 32px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}@media print{body{background:white;padding:0}.page{box-shadow:none;width:100%}}</style></head><body>
<div class="page"><div class="wm">GNSI</div>
<div class="hdr"><div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div class="sub">Khangabok, Thoubal, Manipur — 795128</div></div><div><div class="inv-l">Invoice No.</div><div class="inv-no">${invoiceNo}</div></div></div>
<div class="accent"></div><div class="title-row"><div class="title">Parent Item Receipt</div><div class="badge">Parent Items</div></div>
<div class="body"><div class="meta"><div class="mc"><div class="ml">Student Name</div><div class="mv">${item.student_name || '—'}</div></div><div class="mc"><div class="ml">Class / Batch</div><div class="mv">${item.class_name || '—'}</div></div><div class="mc"><div class="ml">Course</div><div class="mv">${item.course || '—'}</div></div><div class="mc"><div class="ml">Hostel Type</div><div class="mv">${item.hostel_type || '—'}</div></div><div class="mc"><div class="ml">Parent Name</div><div class="mv">${item.parent_name || '—'}</div></div><div class="mc"><div class="ml">House / Block</div><div class="mv">${item.house || '—'}</div></div><div class="mc"><div class="ml">Date Received</div><div class="mv">${fmtDate(item.received_date)}</div></div><div class="mc"><div class="ml">Received By</div><div class="mv">${item.received_by || '—'}</div></div></div>
<table class="pt"><thead><tr><th style="width:32px">#</th><th>Item Description</th><th>Quantity</th><th>Status</th></tr></thead><tbody><tr><td>1</td><td style="font-weight:700">${item.item_name}</td><td>${item.quantity || '1'}</td><td style="font-weight:700;color:#7c3aed">${item.status}</td></tr></tbody></table>
<div class="status-row"><div class="status-box"><div class="sl">Current Status</div><div class="sv">${item.status}</div>${item.remarks ? `<div style="font-size:11px;color:#64748b;margin-top:4px">${item.remarks}</div>` : ''}</div></div>
<div class="sig"><div class="sb"><div class="sl2"></div><div class="st">Parent / Guardian</div></div><div class="sb"><div class="sl2"></div><div class="st">Received By (Staff)</div></div><div class="sb"><div class="sl2"></div><div class="st">Warden / HOD</div></div></div></div>
<div class="ftr"><span>GNSI · Parent Item Invoice · ${item.student_name}</span><span>Printed: ${d}</span></div></div></body></html>`
  const pw = window.open('', '_blank', 'width=760,height=860')
  if (!pw) return
  pw.document.write(html); pw.document.close(); setTimeout(() => pw.print(), 450)
}

function printGatePass(item) {
  const d = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Gate Pass</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#fff;padding:32px;color:#1e293b}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #1e3a5f;padding-bottom:14px;margin-bottom:18px}.inst{font-size:17px;font-weight:700;color:#1e3a5f}.sub{font-size:11px;color:#64748b;margin-top:3px}.title{font-size:20px;font-weight:800;color:#1e3a5f;margin-bottom:16px;text-transform:uppercase;letter-spacing:.08em}.grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px}.cell{padding:11px 14px;border-right:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.cell:nth-child(even){border-right:none}.cell:nth-last-child(-n+2){border-bottom:none}.cl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px}.cv{font-size:13px;font-weight:700;color:#1e293b}.sig{display:flex;justify-content:space-between;margin-top:32px;padding-top:20px;border-top:1px solid #e2e8f0}.sb{text-align:center}.sl{width:140px;border-top:1.5px solid #1e3a5f;margin:0 auto 6px}.st{font-size:11px;color:#64748b}.ftr{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8}@media print{body{padding:16px}}</style></head><body>
<div class="hdr"><div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div class="sub">Khangabok, Thoubal, Manipur — 795128</div></div><div style="text-align:right"><div style="font-size:10px;color:#94a3b8">Printed</div><div style="font-weight:700;font-size:13px">${d}</div></div></div>
<div class="title">🪪 Student Gate Pass</div>
<div class="grid"><div class="cell"><div class="cl">Student Name</div><div class="cv">${item.student_name}</div></div><div class="cell"><div class="cl">GCC No.</div><div class="cv">${item.gcc_no || '—'}</div></div><div class="cell"><div class="cl">Class</div><div class="cv">${item.class_name || '—'}</div></div><div class="cell"><div class="cl">House</div><div class="cv">${item.house || '—'}</div></div><div class="cell"><div class="cl">Course</div><div class="cv">${item.course || '—'}</div></div><div class="cell"><div class="cl">Reason</div><div class="cv">${item.reason}</div></div><div class="cell"><div class="cl">Exit Date &amp; Time</div><div class="cv">${fmtDate(item.exit_date)} ${item.exit_time ? '· ' + item.exit_time : ''}</div></div><div class="cell"><div class="cl">Return Date</div><div class="cv">${item.return_date ? fmtDate(item.return_date) : '—'}${item.expected_return_time ? ' · ' + item.expected_return_time : ''}</div></div><div class="cell"><div class="cl">Responsible Person</div><div class="cv">${item.responsible_contact || '—'}</div></div><div class="cell"><div class="cl">Approved By</div><div class="cv">${item.approved_by || '—'}</div></div><div class="cell"><div class="cl">Parent Informed</div><div class="cv">${item.parent_informed}</div></div><div class="cell" style="grid-column:1/-1"><div class="cl">Remarks</div><div class="cv">${item.remarks || '—'}</div></div></div>
<div class="sig"><div class="sb"><div class="sl"></div><div class="st">Student Signature</div></div><div class="sb"><div class="sl"></div><div class="st">Class Teacher</div></div><div class="sb"><div class="sl"></div><div class="st">Principal / Warden</div></div></div>
<div class="ftr">GNSI · Gate Pass · Computer generated · ${d}</div></body></html>`
  const pw = window.open('', '_blank', 'width=720,height=800')
  if (!pw) return
  pw.document.write(html); pw.document.close(); setTimeout(() => pw.print(), 400)
}

function printVisitorBadge(item) {
  const d = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Visitor Badge</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#f0f4f8;display:flex;justify-content:center;padding:40px}.badge{width:320px;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.15)}.top{background:#1e3a5f;padding:18px;text-align:center}.inst{color:white;font-size:13px;font-weight:700}.sub{color:rgba(255,255,255,.5);font-size:10px;margin-top:2px}.bl{background:#c9a84c;color:#1e3a5f;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;padding:5px 0;text-align:center}.body{padding:18px}.av{width:56px;height:56px;border-radius:50%;background:#1e3a5f;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:#c9a84c;margin:0 auto 12px}.name{text-align:center;font-size:17px;font-weight:800;color:#1e293b;margin-bottom:3px}.purpose{text-align:center;font-size:12px;color:#64748b;margin-bottom:14px}.row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}.rk{color:#94a3b8;font-weight:600}.rv{color:#1e293b;font-weight:700}.ftr{background:#f8fafc;padding:9px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0}@media print{body{background:white;padding:0}.badge{box-shadow:none}}</style></head><body>
<div class="badge"><div class="top"><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div class="sub">Khangabok · Thoubal · Manipur</div></div><div class="bl">Visitor Pass</div>
<div class="body"><div class="av">${(item.visitor_name || 'V')[0].toUpperCase()}</div><div class="name">${item.visitor_name}</div><div class="purpose">${item.purpose}</div>
<div class="row"><span class="rk">Meeting With</span><span class="rv">${item.meeting_with || '—'}</span></div><div class="row"><span class="rk">Visit Date</span><span class="rv">${fmtDate(item.visit_date)}</span></div><div class="row"><span class="rk">In Time</span><span class="rv">${item.in_time || '—'}</span></div><div class="row"><span class="rk">Phone</span><span class="rv">${item.phone || '—'}</span></div><div class="row"><span class="rk">ID Proof</span><span class="rv">${item.id_proof || '—'}</span></div></div>
<div class="ftr">Computer generated · ${d}</div></div></body></html>`
  const pw = window.open('', '_blank', 'width=420,height=640')
  if (!pw) return
  pw.document.write(html); pw.document.close(); setTimeout(() => pw.print(), 400)
}

function elapsedLabel(record) {
  let base
  if (record?.exit_date && record?.exit_time) {
    base = new Date(`${record.exit_date}T${record.exit_time}`)
  } else if (record?.exit_date) {
    base = new Date(record.exit_date)
  } else if (record?.created_at) {
    base = new Date(record.created_at)
  } else {
    return { label: '—', color: C.emerald, bg: '#dcfce7' }
  }
  const diff = Math.floor((Date.now() - base.getTime()) / 60000)
  if (diff < 60) return { label: `${diff}m`, color: '#166534', bg: '#dcfce7' }
  const hrs = Math.floor(diff / 60), mins = diff % 60
  if (hrs < 8) return { label: `${hrs}h ${mins}m`, color: '#92400e', bg: '#fef3c7' }
  return { label: `${hrs}h ${mins}m`, color: C.red, bg: '#fee2e2' }
}

// ── HOUSE-WISE GRID ───────────────────────────────────────────────────────────
const HOUSE_PALETTE = [C.navy, C.violet, C.emerald, '#ca8a04', C.red, C.teal, '#c2410c', '#1d4ed8', '#be185d', C.sky]

function HouseWiseGrid({ parentItems, onStatusChange }) {
  const [statusFilter, setStatusFilter] = useState('All')
  const filtered = useMemo(() => statusFilter === 'All' ? parentItems : parentItems.filter(p => p.status === statusFilter), [parentItems, statusFilter])
  const grouped  = useMemo(() => {
    const g = {}
    filtered.forEach(item => { const house = item.house || 'Day Scholar / Unassigned'; if (!g[house]) g[house] = []; g[house].push(item) })
    return g
  }, [filtered])
  const houseNames = Object.keys(grouped).sort()

  return (
    <div>
      <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: font }}>Filter:</span>
        {['All', 'Pending', 'Delivered', 'Returned'].map(s => (
          <button key={s} type="button" onClick={() => setStatusFilter(s)}
            style={{ padding: '5px 13px', borderRadius: 99, border: `0.5px solid ${statusFilter === s ? C.navy : C.slate[200]}`, background: statusFilter === s ? C.navy : 'white', color: statusFilter === s ? 'white' : C.slate[600], fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font, transition: 'all .12s' }}>
            {s}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: C.slate[400], fontFamily: font }}>{filtered.length} item{filtered.length !== 1 ? 's' : ''}</span>
      </div>
      {houseNames.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: C.slate[400], fontSize: 14, fontFamily: font }}>No records match.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {houseNames.map((house, hi) => {
          const hColor = HOUSE_PALETTE[hi % HOUSE_PALETTE.length]
          const hItems = grouped[house]
          const pending   = hItems.filter(i => i.status === 'Pending').length
          const delivered = hItems.filter(i => i.status === 'Delivered').length
          const returned  = hItems.filter(i => i.status === 'Returned').length
          return (
            <div key={house} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', border: `0.5px solid ${C.slate[200]}`, boxShadow: '0 2px 10px rgba(0,0,0,.06)' }}>
              <div style={{ background: hColor, padding: '13px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'white', fontFamily: font }}>🏠 {house}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,.6)', marginTop: 2, fontFamily: font }}>{hItems.length} item{hItems.length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {pending > 0   && <span style={{ background: '#fef9c3', color: '#92400e', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800, fontFamily: font }}>⏳ {pending}</span>}
                  {delivered > 0 && <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800, fontFamily: font }}>✓ {delivered}</span>}
                  {returned > 0  && <span style={{ background: '#f1f5f9',  color: C.slate[600], padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 800, fontFamily: font }}>↩ {returned}</span>}
                </div>
              </div>
              <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                {hItems.map((item, i) => (
                  <div key={item.id || i} style={{ padding: '10px 14px', borderBottom: `0.5px solid ${C.slate[50]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: C.slate[800], display: 'flex', alignItems: 'center', gap: 6, fontFamily: font }}>
                        <span style={{ width: 20, height: 20, borderRadius: 5, background: `${hColor}18`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: hColor, flexShrink: 0 }}>{i + 1}</span>
                        {item.item_name}{item.quantity && item.quantity !== '1' && <span style={{ fontSize: 10, color: C.slate[400], fontWeight: 400 }}>× {item.quantity}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: C.slate[500], marginTop: 2, display: 'flex', gap: 6, flexWrap: 'wrap', fontFamily: font }}>
                        <span style={{ fontWeight: 700, color: C.slate[700] }}>{item.student_name}</span>
                        {item.class_name && <span>{item.class_name}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <Pill label={item.status} />
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button onClick={() => printItemInvoice(item)} style={{ background: 'transparent', border: `0.5px solid ${hColor}`, color: hColor, borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>🖨️</button>
                        {item.status === 'Pending'   && onStatusChange && canTransition('Pending', 'Delivered')  && <button onClick={() => onStatusChange(item.id, 'Delivered')} style={{ background: '#dcfce7', color: '#166534', border: 'none', borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>✓</button>}
                        {item.status === 'Delivered' && onStatusChange && canTransition('Delivered', 'Returned') && <button onClick={() => onStatusChange(item.id, 'Returned')}  style={{ background: '#f1f5f9',  color: C.slate[600], border: 'none', borderRadius: 5, padding: '2px 6px', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>↩</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ background: C.slate[50], padding: '6px 14px', display: 'flex', gap: 12, borderTop: `0.5px solid ${C.slate[100]}` }}>
                <span style={{ fontSize: 11, color: '#92400e', fontWeight: 700, fontFamily: font }}>⏳ {pending}</span>
                <span style={{ fontSize: 11, color: '#166534', fontWeight: 700, fontFamily: font }}>✓ {delivered}</span>
                <span style={{ fontSize: 11, color: C.slate[500], fontWeight: 700, fontFamily: font }}>↩ {returned}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── STUDENT 360° ──────────────────────────────────────────────────────────────
function SectionHead({ icon, title, color, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <div style={{ width: 3, height: 18, background: color || C.navy, borderRadius: 2, flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 500, color: color || C.navy, fontFamily: font }}>{icon} {title}</span>
      {badge !== undefined && <span style={{ fontSize: 10, fontWeight: 700, background: `${color || C.navy}18`, color: color || C.navy, padding: '2px 8px', borderRadius: 99, fontFamily: font }}>{badge}</span>}
    </div>
  )
}

function InfoGrid({ rows }) {
  return (
    <div>
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `0.5px solid ${C.slate[100]}`, fontSize: 13, fontFamily: font }}>
          <span style={{ color: C.slate[400], fontWeight: 600, fontSize: 11 }}>{k}</span>
          <span style={{ color: C.slate[800], fontWeight: 700, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ msg }) {
  return <div style={{ padding: '20px 0', textAlign: 'center', color: C.slate[400], fontSize: 13, fontFamily: font }}>{msg}</div>
}

// ── STUDENT AUTOCOMPLETE ──────────────────────────────────────────────────────
const StudentAutocomplete = React.memo(function StudentAutocomplete({ students, onSelect, placeholder, resetKey }) {
  const inputRef  = useRef(null)
  const wrapRef   = useRef(null)
  const indexRef  = useRef([])
  const rowRefs   = useRef([])
  const hitsRef   = useRef([])
  const cursorRef = useRef(-1)
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
  useEffect(() => { if (cursor >= 0) rowRefs.current[cursor]?.scrollIntoView({ block: 'nearest' }) }, [cursor])

  const runSearch = raw => {
    const q = (raw || '').toLowerCase().trim()
    if (!q) { hitsRef.current = []; cursorRef.current = -1; setHits([]); setOpen(false); setCursor(-1); return }
    const src = indexRef.current.length ? indexRef.current : buildIndex(students)
    const out = []
    for (let i = 0; i < src.length && out.length < 9; i++) { if (src[i].key.includes(q)) out.push(src[i].s) }
    hitsRef.current = out; cursorRef.current = -1; setHits(out); setCursor(-1); setOpen(true)
  }

  const pick = s => {
    pickingRef.current = true
    if (inputRef.current) inputRef.current.value = s.name
    hitsRef.current = []; cursorRef.current = -1; setHits([]); setOpen(false); setCursor(-1)
    clearTimeout(pickingRef._timer)
    pickingRef._timer = setTimeout(() => { pickingRef.current = false; onSelect(s) }, 0)
  }

  const handleKeyDown = e => {
    const h = hitsRef.current; const idx = cursorRef.current
    if (!h.length) return
    switch (e.key) {
      case 'ArrowDown': { e.preventDefault(); const n = Math.min(idx + 1, h.length - 1); cursorRef.current = n; setCursor(n); break }
      case 'ArrowUp':   { e.preventDefault(); const n = Math.max(idx - 1, 0); cursorRef.current = n; setCursor(n); break }
      case 'Enter':     { e.preventDefault(); const t = h[idx] ?? h[0]; if (t) pick(t); break }
      case 'Tab':       { const t = h[idx] ?? (h.length === 1 ? h[0] : null); if (t) { e.preventDefault(); pick(t) } break }
      case 'Escape':    { e.preventDefault(); hitsRef.current = []; cursorRef.current = -1; setOpen(false); setHits([]); setCursor(-1); break }
      default: break
    }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.slate[400], pointerEvents: 'none' }}>🎓</span>
        <input ref={inputRef} type="text" autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} defaultValue=""
          placeholder={placeholder || 'Name, GCC No, Adm No, batch, phone…'}
          style={{ ...inp, paddingLeft: 36, paddingRight: 32 }}
          onChange={e => runSearch(e.target.value)} onKeyDown={handleKeyDown}
          onFocus={e => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(30,58,95,.08)`; if (e.target.value) runSearch(e.target.value) }}
          onBlur={e => { e.target.style.borderColor = C.slate[200]; e.target.style.boxShadow = 'none'; if (!pickingRef.current) { setOpen(false); setCursor(-1); cursorRef.current = -1 } }} />
        <button type="button" tabIndex={-1}
          onMouseDown={e => { e.preventDefault(); if (inputRef.current) { inputRef.current.value = ''; inputRef.current.focus() } setHits([]); hitsRef.current = []; setOpen(false); setCursor(-1); onSelect(null) }}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: C.slate[300], lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
      {open && hits.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999, background: 'white', border: `0.5px solid ${C.slate[200]}`, borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,.15)', maxHeight: 300, overflowY: 'auto' }}>
          <div style={{ position: 'sticky', top: 0, background: 'white', zIndex: 1, padding: '6px 14px', borderBottom: `0.5px solid ${C.slate[100]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', fontFamily: font }}>{hits.length} match{hits.length !== 1 ? 'es' : ''}</span>
            <span style={{ fontSize: 10, color: C.slate[300], fontFamily: font }}>↑↓ Enter select</span>
          </div>
          {hits.map((s, i) => {
            const active = cursor === i
            return (
              <div key={s.id} ref={el => { rowRefs.current[i] = el }}
                onMouseDown={e => { e.preventDefault(); pickingRef.current = true; pick(s) }}
                onMouseEnter={() => { setCursor(i); cursorRef.current = i }}
                style={{ padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: `0.5px solid ${C.slate[50]}`, background: active ? '#eef4ff' : 'white', borderLeft: `3px solid ${active ? C.navy : 'transparent'}`, cursor: 'pointer', transition: 'all .1s' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: active ? C.navy : C.slate[100], display: 'flex', alignItems: 'center', justifyContent: 'center', color: active ? C.gold : C.slate[400], fontWeight: 800, fontSize: 13, fontFamily: font }}>
                  {(s.name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: active ? C.navy : C.slate[900], overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: font }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.slate[500], display: 'flex', gap: 8, marginTop: 1, flexWrap: 'wrap', fontFamily: font }}>
                    {s.gcc_no && <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.navy }}>GCC-{s.gcc_no}</span>}
                    {s.batch  && <span>{s.batch}</span>}
                    {s.course && <span style={{ color: C.sky }}>{s.course}</span>}
                    {s.house  && <span style={{ color: C.emerald }}>🏠 {s.house}</span>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {open && hits.length === 0 && inputRef.current?.value?.trim() && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 9999, background: 'white', border: `0.5px solid ${C.slate[200]}`, borderRadius: 14, padding: 16, textAlign: 'center', color: C.slate[400], fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,.08)', fontFamily: font }}>
          No student matches
        </div>
      )}
    </div>
  )
})

function StudentChip({ student, onClear }) {
  if (!student) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, padding: '9px 13px', background: '#f0fdf4', border: `0.5px solid #86efac`, borderRadius: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: '50%', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gold, fontWeight: 800, fontSize: 12, flexShrink: 0, fontFamily: font }}>
        {student.name[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#166534', fontFamily: font }}>✓ {student.name}</div>
        <div style={{ fontSize: 11, color: C.slate[500], display: 'flex', gap: 8, marginTop: 1, flexWrap: 'wrap', fontFamily: font }}>
          {student.gcc_no      && <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>GCC-{student.gcc_no}</span>}
          {student.batch       && <span>{student.batch}</span>}
          {student.course      && <span style={{ color: C.sky }}>{student.course}</span>}
          {student.house       && <span>🏠 {student.house}</span>}
          {student.hostel_type && <span style={{ color: C.violet }}>{student.hostel_type}</span>}
        </div>
      </div>
      <button type="button" onClick={onClear} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.slate[300], fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  )
}

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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 10 }}>
        {allItems.map(item => {
          const selected = value.includes(item)
          return (
            <button key={item} type="button" onClick={() => toggle(item)}
              style={{ padding: '5px 12px', borderRadius: 99, border: `0.5px solid ${selected ? C.navy : C.slate[200]}`, background: selected ? C.navy : 'white', color: selected ? 'white' : C.slate[600], fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font, transition: 'all .12s' }}>
              {selected && <span style={{ marginRight: 4 }}>✓</span>}{item}
            </button>
          )
        })}
        <button type="button" onClick={() => setShowCustom(v => !v)}
          style={{ padding: '5px 12px', borderRadius: 99, border: `0.5px dashed ${C.slate[300]}`, background: 'white', color: C.slate[500], fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>
          + Custom
        </button>
      </div>
      {showCustom && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input value={customVal} onChange={e => setCustomVal(e.target.value)} placeholder="Type custom item name…" style={{ ...inp, flex: 1 }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }} />
          <button type="button" onClick={commit}
            style={{ padding: '10px 16px', background: C.navy, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: font }}>Add</button>
        </div>
      )}
      {value.length > 0 && (
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {value.map(i => (
            <span key={i} style={{ background: '#dbeafe', color: C.navy, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, fontFamily: font }}>
              {i}
              <button type="button" onClick={() => toggle(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.slate[500], fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))}
          <span style={{ fontSize: 11, color: C.slate[400], alignSelf: 'center', fontFamily: font }}>{value.length} item{value.length !== 1 ? 's' : ''} selected</span>
        </div>
      )}
    </div>
  )
}

// ── Student 360° ──────────────────────────────────────────────────────────────
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
      supabase.from('hostel_allocations').select('*,hostel_rooms(room_no,floor,capacity,room_type)').eq('student_id', student.id).order('created_at', { ascending: false }).limit(1),
      supabase.from('adm_fee_collections').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: false }),
      supabase.from('adm_flat_fees').select('*').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false).order('pay_date', { ascending: false }),
      supabase.from('adm_course_fees').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: false }),
      supabase.from('reception_gatepasses').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('reception_enquiries').select('*').or(`student_name.eq.${student.name},phone.eq.${student.phone || '__'}`).is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('reception_parent_items').select('*').eq('student_name', student.name).is('deleted_at', null).order('created_at', { ascending: false }),
    ])
    const admTotal  = (admFees.data  || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0)
    const flatTotal = (flatFees.data || []).reduce((s, r) => s + Number(r.amount      || 0), 0)
    const crsTotal  = (crsFees.data  || []).reduce((s, r) => s + Number(r.amount_paid || 0), 0)
    setProf({ hostel: hostelAlloc.data?.[0] || null, admFees: admFees.data || [], flatFees: flatFees.data || [], crsFees: crsFees.data || [], admTotal, flatTotal, crsTotal, grandTotal: admTotal + flatTotal + crsTotal, gatePasses: gatePasses.data || [], enquiries: enquiries.data || [], parentItems: parentItems.data || [] })
    setBusy(false)
  }, [])

  const updateGPStatus = async (id, from, to) => { if (!canTransition(from, to)) return; await supabase.from('reception_gatepasses').update({ status: to }).eq('id', id); load(selected) }
  const updatePIStatus = async (id, from, to) => { if (!canTransition(from, to)) return; await supabase.from('reception_parent_items').update({ status: to }).eq('id', id); load(selected) }

  return (
    <div>
      <Card style={{ marginBottom: 16, position: 'relative', zIndex: 10 }}>
        <CardHead icon="🔍" title="Student 360° Search" sub="Name · GCC No · Admission No · Batch" isMobile={mob} />
        <div style={{ padding: mob ? '12px 14px' : '16px 20px' }}>
          <StudentAutocomplete students={students} resetKey={resetKey360} onSelect={s => { if (!s) { setSel(null); setProf(null) } else { load(s) } }} />
          {!selected && <p style={{ marginTop: 10, fontSize: 13, color: C.slate[400], fontFamily: font }}>Select a student to view their complete profile.</p>}
        </div>
      </Card>

      {busy && <div style={{ textAlign: 'center', padding: 60, color: C.slate[400], fontFamily: font }}>⏳ Loading profile…</div>}

      {selected && profile && !busy && (() => {
        const { hostel, admTotal, flatTotal, crsTotal, grandTotal, gatePasses, enquiries, parentItems } = profile
        const activeGP = gatePasses.filter(g => g.status === 'Issued' || g.status === 'Exited')
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0f2340 100%)`, borderRadius: 18, padding: mob ? '14px 16px' : '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: C.navy, flexShrink: 0, fontFamily: font }}>{(selected.name || '?')[0].toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: mob ? 16 : 18, fontWeight: 700, color: 'white', fontFamily: font }}>{selected.name}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    {selected.gcc_no && <span style={{ fontFamily: 'monospace', fontWeight: 700, color: C.gold, fontSize: 12 }}>GCC-{selected.gcc_no}</span>}
                    {selected.batch  && <span style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, fontFamily: font }}>{selected.batch}</span>}
                    {selected.course && <span style={{ color: '#93c5fd', fontSize: 12, fontFamily: font }}>{selected.course}</span>}
                    {selected.house  && <span style={{ color: '#a5b4fc', fontSize: 12, fontFamily: font }}>🏠 {selected.house}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {activeGP.length > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 800, fontFamily: font }}>⚠ {activeGP.length} Active GP</span>}
                <button onClick={() => { setSel(null); setProf(null); setRK360(k => k + 1) }} style={{ padding: '6px 12px', borderRadius: 9, border: '0.5px solid rgba(255,255,255,.25)', background: 'transparent', color: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: font }}>← Change</button>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(3,1fr)' : 'repeat(5,1fr)', gap: 10 }}>
              {[
                { icon: '💰', label: 'Total Paid',  value: `₹${fmt(grandTotal)}`, color: C.navy,    stripe: C.navy    },
                { icon: '🏠', label: 'Hostel',       value: hostel ? (hostel.hostel_rooms?.room_no || 'Allotted') : 'Day Scholar', color: hostel ? C.emerald : C.slate[500], stripe: hostel ? C.emerald : C.slate[300] },
                { icon: '🪪', label: 'Gate Passes',  value: gatePasses.length,  color: '#ca8a04', stripe: '#ca8a04' },
                { icon: '📦', label: 'Parent Items', value: parentItems.length, color: C.violet,  stripe: C.violet  },
                { icon: '📋', label: 'Enquiries',    value: enquiries.length,   color: C.sky,     stripe: C.sky     },
              ].map(c => (
                <div key={c.label} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', border: `0.5px solid ${C.slate[200]}`, boxShadow: '0 2px 8px rgba(0,0,0,.04)' }}>
                  <div style={{ height: 3, background: c.stripe }} />
                  <div style={{ padding: mob ? '9px 10px' : '11px 14px' }}>
                    <div style={{ fontSize: 14, marginBottom: 3 }}>{c.icon}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2, fontFamily: font }}>{c.label}</div>
                    <div style={{ fontSize: mob ? 15 : 18, fontWeight: 700, color: c.color, fontFamily: font }}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap: 14 }}>
              <Card>
                <div style={{ padding: '14px 16px' }}>
                  <SectionHead icon="🎓" title="Student Details" color={C.navy} />
                  <InfoGrid rows={[
                    ['Name', selected.name], ['GCC No.', selected.gcc_no ? `GCC-${selected.gcc_no}` : ''],
                    ['Adm. No.', selected.admission_no], ['Batch', selected.batch], ['Course', selected.course],
                    ['House', selected.house], ['Hostel Type', selected.hostel_type],
                    ['Phone', selected.phone], ['Father', selected.father_name], ['Mother', selected.mother_name],
                  ]} />
                </div>
              </Card>
              <Card>
                <div style={{ padding: '14px 16px' }}>
                  <SectionHead icon="🏠" title="Hostel" color={C.emerald} />
                  {hostel
                    ? <InfoGrid rows={[['Room No.', hostel.hostel_rooms?.room_no], ['Floor', hostel.hostel_rooms?.floor], ['Room Type', hostel.hostel_rooms?.room_type], ['Bed No.', hostel.bed_no], ['Status', hostel.status]]} />
                    : <EmptyState msg="Day Scholar — not allotted" />}
                </div>
              </Card>
            </div>
            <Card>
              <CardHead icon="🪪" title="Gate Passes" sub={`${gatePasses.length} total`} accentColor="#ca8a04" isMobile={mob} />
              {gatePasses.length === 0
                ? <div style={{ padding: '12px 16px' }}><EmptyState msg="No gate passes issued" /></div>
                : <RecordsTable rows={gatePasses} loading={false}
                    columns={[
                      { key: 'exit_date', label: 'Date', render: r => fmtDate(r.exit_date) },
                      { key: 'reason', label: 'Reason' },
                      { key: 'expected_return_time', label: 'Return By' },
                      { key: 'parent_informed', label: 'Parent', render: r => <span style={{ color: r.parent_informed === 'Yes' ? C.emerald : C.red, fontWeight: 700, fontFamily: font }}>{r.parent_informed}</span> },
                      { key: 'status', label: 'Status', render: r => <Pill label={r.status} /> },
                      { key: '_a', label: 'Actions', render: r => (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => printGatePass(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e' }}>🖨️</button>
                          {canTransition(r.status, 'Exited') && <button onClick={() => updateGPStatus(r.id, r.status, 'Exited')} style={{ ...delBtn, background: '#fee2e2', color: C.red }}>→ Out</button>}
                          {canTransition(r.status, 'Returned') && <button onClick={() => updateGPStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>↩ In</button>}
                        </div>
                      )},
                    ]}
                    mobileConfig={{
                      accent: r => r.status === 'Exited' ? C.red : r.status === 'Returned' ? C.emerald : '#ca8a04',
                      title:  r => `🪪 ${r.reason}`,
                      subtitle: r => `${fmtDate(r.exit_date)}${r.exit_time ? ' · ' + r.exit_time : ''}${r.expected_return_time ? ' · Return: ' + r.expected_return_time : ''}`,
                      badge:  r => <Pill label={r.status} />,
                      meta:   r => [`Parent: ${r.parent_informed}`, r.approved_by ? `By: ${r.approved_by}` : null],
                      actions: r => (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => printGatePass(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e', fontSize: 11 }}>🖨️</button>
                          {canTransition(r.status, 'Exited') && <button onClick={() => updateGPStatus(r.id, r.status, 'Exited')} style={{ ...delBtn, background: '#fee2e2', color: C.red, fontSize: 11 }}>→ Out</button>}
                          {canTransition(r.status, 'Returned') && <button onClick={() => updateGPStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>↩ In</button>}
                        </div>
                      ),
                    }}
                  />
              }
            </Card>
            <Card>
              <CardHead icon="📦" title="Parent Items" sub={`${parentItems.length} total`} accentColor={C.violet} isMobile={mob} />
              {parentItems.length === 0
                ? <div style={{ padding: '12px 16px' }}><EmptyState msg="No parent items recorded" /></div>
                : <RecordsTable rows={parentItems} loading={false}
                    columns={[
                      { key: 'received_date', label: 'Date', render: r => fmtDate(r.received_date) },
                      { key: 'parent_name', label: 'Parent' },
                      { key: 'item_name', label: 'Item', render: r => <b>{r.item_name}</b> },
                      { key: 'quantity', label: 'Qty' },
                      { key: 'status', label: 'Status', render: r => <Pill label={r.status} /> },
                      { key: '_a', label: 'Actions', render: r => (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => printItemInvoice(r)} style={{ ...delBtn, background: '#f5f3ff', color: C.violet }}>🖨️</button>
                          {canTransition(r.status, 'Delivered') && <button onClick={() => updatePIStatus(r.id, r.status, 'Delivered')} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>✓</button>}
                          {canTransition(r.status, 'Returned') && <button onClick={() => updatePIStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#f1f5f9', color: C.slate[600] }}>↩</button>}
                        </div>
                      )},
                    ]}
                    mobileConfig={{
                      accent: r => r.status === 'Delivered' ? C.emerald : r.status === 'Returned' ? C.slate[400] : C.violet,
                      title:  r => `📦 ${r.item_name}`,
                      subtitle: r => `${r.parent_name} → ${r.student_name || '—'}`,
                      badge:  r => <Pill label={r.status} />,
                      meta:   r => [fmtDate(r.received_date), r.quantity ? `Qty: ${r.quantity}` : null, r.house ? `🏠 ${r.house}` : null],
                      actions: r => (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => printItemInvoice(r)} style={{ ...delBtn, background: '#f5f3ff', color: C.violet, fontSize: 11 }}>🖨️</button>
                          {canTransition(r.status, 'Delivered') && <button onClick={() => updatePIStatus(r.id, r.status, 'Delivered')} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>✓ Deliver</button>}
                          {canTransition(r.status, 'Returned') && <button onClick={() => updatePIStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#f1f5f9', color: C.slate[600], fontSize: 11 }}>↩ Return</button>}
                        </div>
                      ),
                    }}
                  />
              }
            </Card>
          </div>
        )
      })()}
    </div>
  )
}

// ── GENERIC RECORDS TABLE — mobile card / desktop table ──────────────────────
function RecordsTable({ rows, columns, onDelete, loading, mobileConfig }) {
  const mob = useIsMobile()
  if (loading) return <div style={{ color: C.slate[400], padding: 24, fontFamily: font }}>Loading…</div>
  if (rows.length === 0) return <div style={{ padding: 32, textAlign: 'center', color: C.slate[400], fontSize: 13, fontFamily: font }}>No records found</div>

  // ── Mobile card layout ────────────────────────────────────────────────────
  if (mob && mobileConfig) {
    const { title, subtitle, meta, badge, actions, accent } = mobileConfig
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 12px' }}>
        {rows.map((row, i) => {
          const accentColor = accent ? accent(row) : C.navy
          return (
            <div key={row.id || i} style={{ background: 'white', borderRadius: 14, border: `0.5px solid ${C.slate[200]}`, overflow: 'hidden', boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}>
              {/* left accent bar + header */}
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <div style={{ width: 4, background: accentColor, flexShrink: 0 }} />
                <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
                  {/* title row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900], fontFamily: font, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {title(row)}
                    </div>
                    {badge && <div style={{ flexShrink: 0 }}>{badge(row)}</div>}
                  </div>
                  {/* subtitle */}
                  {subtitle && (
                    <div style={{ fontSize: 12, color: C.slate[500], marginBottom: 5, fontFamily: font }}>
                      {subtitle(row)}
                    </div>
                  )}
                  {/* meta chips */}
                  {meta && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: actions ? 8 : 0 }}>
                      {meta(row).filter(v => v !== null && v !== false && v !== undefined).map((m, mi) => (
                        <span key={mi} style={{ fontSize: 11, color: C.slate[500], background: C.slate[50], borderRadius: 6, padding: '2px 7px', fontFamily: font, border: `0.5px solid ${C.slate[200]}` }}>
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* actions row */}
                  {(actions || onDelete) && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                      {actions && actions(row)}
                      {onDelete && (
                        <button onClick={() => onDelete(row.id)} style={{ ...delBtn, fontSize: 10, padding: '4px 8px' }}>✕ Delete</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ── Desktop table layout ──────────────────────────────────────────────────
  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 500, fontFamily: font }}>
        <thead>
          <tr>
            {columns.map(c => <th key={c.key} style={thS}>{c.label}</th>)}
            {onDelete && <th style={thS}>Del</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i} style={{ borderBottom: `0.5px solid ${C.slate[100]}`, transition: 'background .1s' }}>
              {columns.map(c => <td key={c.key} style={tdS}>{c.render ? c.render(row) : (row[c.key] ?? '—')}</td>)}
              {onDelete && <td style={tdS}><button onClick={() => onDelete(row.id)} style={delBtn}>✕</button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div>
      <label style={lbl}>{label}</label>
      {children}
    </div>
  )
}

function FormInput({ field, value, onChange, type = 'text', placeholder, required }) {
  return (
    <input type={type} placeholder={placeholder} required={required}
      style={inp} value={value ?? ''}
      onChange={e => onChange(field, e.target.value)}
      onFocus={e => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(30,58,95,.08)` }}
      onBlur={e => { e.target.style.borderColor = C.slate[200]; e.target.style.boxShadow = 'none' }} />
  )
}

function FormSelect({ field, value, onChange, options, placeholder }) {
  return (
    <select style={{ ...inp, cursor: 'pointer' }} value={value ?? ''} onChange={e => onChange(field, e.target.value)}>
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function FormTextarea({ field, value, onChange }) {
  return (
    <textarea rows={2} style={{ ...inp, resize: 'vertical' }} value={value ?? ''}
      onChange={e => onChange(field, e.target.value)}
      onFocus={e => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(30,58,95,.08)` }}
      onBlur={e => { e.target.style.borderColor = C.slate[200]; e.target.style.boxShadow = 'none' }} />
  )
}

function MonitorRow({ initLetter, avatarColor, name, sub, meta, elapsedRecord, statusLabel, actions }) {
  const mob = useIsMobile()
  const e   = elapsedRecord ? elapsedLabel(elapsedRecord) : null

  // ── Mobile card layout ───────────────────────────────────────────────────
  if (mob) {
    return (
      <div style={{
        background: 'white', borderRadius: 14, marginBottom: 10,
        border: `0.5px solid ${C.slate[200]}`, overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* left accent */}
          <div style={{ width: 4, background: avatarColor || C.navy, flexShrink: 0 }} />
          <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
            {/* row 1: avatar + name + elapsed + status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor || C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.gold, flexShrink: 0, fontFamily: font }}>
                {(initLetter || '?').toUpperCase()}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900], fontFamily: font, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {name}
              </div>
              {e && (
                <span style={{ background: e.bg, color: e.color, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap', fontFamily: font }}>
                  ⏱ {e.label}
                </span>
              )}
              {statusLabel && <div style={{ flexShrink: 0 }}><Pill label={statusLabel} /></div>}
            </div>
            {/* row 2: subtitle */}
            {sub && (
              <div style={{ fontSize: 12, color: C.slate[500], marginBottom: 5, marginLeft: 38, fontFamily: font, lineHeight: 1.4 }}>
                {sub}
              </div>
            )}
            {/* row 3: meta chips */}
            {meta && Array.isArray(meta) && meta.filter(Boolean).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginLeft: 38, marginBottom: 7 }}>
                {meta.filter(Boolean).map((m, mi) => (
                  <span key={mi} style={{ fontSize: 11, color: C.slate[500], background: C.slate[50], borderRadius: 6, padding: '2px 7px', fontFamily: font, border: `0.5px solid ${C.slate[200]}` }}>
                    {m}
                  </span>
                ))}
              </div>
            )}
            {/* non-array meta (JSX spans) */}
            {meta && !Array.isArray(meta) && (
              <div style={{ fontSize: 11, color: C.slate[400], display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 38, marginBottom: 7, fontFamily: font }}>
                {meta}
              </div>
            )}
            {/* row 4: action buttons */}
            {actions && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 38 }}>
                {Array.isArray(actions) ? actions.filter(Boolean) : actions}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Desktop layout (original) ────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 0', borderBottom: `0.5px solid ${C.slate[100]}` }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarColor || C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: C.gold, flexShrink: 0, fontFamily: font }}>
        {(initLetter || '?').toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: C.slate[900], fontFamily: font }}>{name}</div>
        {sub  && <div style={{ fontSize: 12, color: C.slate[500], marginTop: 1, fontFamily: font }}>{sub}</div>}
        {meta && <div style={{ fontSize: 11, color: C.slate[400], marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', fontFamily: font }}>{meta}</div>}
      </div>
      {e && <span style={{ background: e.bg, color: e.color, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap', fontFamily: font }}>⏱ {e.label}</span>}
      {statusLabel && <Pill label={statusLabel} />}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>
    </div>
  )
}

// ── FEATURE 1: Auto-refresh countdown hook ────────────────────────────────────
function useAutoRefresh(callback, intervalSec = 60) {
  const [countdown, setCountdown] = useState(intervalSec)
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    setCountdown(intervalSec)
    const tick = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { cbRef.current(); return intervalSec }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [intervalSec])

  return countdown
}

// ── MONITORS TAB ──────────────────────────────────────────────────────────────
function MonitorsTab({ students, gatePasses, hlRecordsExternal, onGPStatusChange, fetchAll }) {
  const mob = useIsMobile()
  const [subTab,        setSubTab]       = useState('gate')
  const [saving,        setSaving]       = useState(false)
  const [hlRecords,     setHLRecords]    = useState(hlRecordsExternal || [])
  const [staffRecords,  setStaffRecords] = useState([])
  const [hlLoading,     setHLLoading]    = useState(false)
  const [staffLoading,  setStaffLoading] = useState(false)
  const [hlForm,        setHLForm]       = useState(HOSTEL_LEAVE_DEF)
  const [staffForm,     setStaffForm]    = useState(STAFF_LEAVE_DEF)
  const [hlStudent,     setHLStudent]    = useState(null)
  const [hlResetKey,    setHLResetKey]   = useState(0)
  const [showHLForm,    setShowHLForm]   = useState(false)
  const [showStaffForm, setShowStaffForm]= useState(false)
  const [visitors,      setVisitors]     = useState([])

  const set_hl    = (f, v) => setHLForm(p => ({ ...p, [f]: v }))
  const set_staff = (f, v) => {
    setStaffForm(p => {
      const next = { ...p, [f]: v }
      if ((f === 'from_date' || f === 'to_date') && next.from_date && next.to_date) {
        const diff = Math.round((new Date(next.to_date) - new Date(next.from_date)) / (1000 * 60 * 60 * 24)) + 1
        if (diff > 0) next.days = String(diff)
      }
      return next
    })
  }

  const loadHL = useCallback(async () => {
    setHLLoading(true)
    const { data } = await supabase.from('hostel_leave_records').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    setHLRecords(data || []); setHLLoading(false)
  }, [])

  const loadStaff = useCallback(async () => {
    setStaffLoading(true)
    const { data } = await supabase.from('staff_leave_requests').select('*').is('deleted_at', null).order('created_at', { ascending: false })
    setStaffRecords(data || []); setStaffLoading(false)
  }, [])

  const loadVisitors = useCallback(async () => {
    const { data } = await supabase.from('reception_visitors').select('*').is('out_time', null).is('deleted_at', null).order('created_at', { ascending: false })
    setVisitors(data || [])
  }, [])

  const refreshAll = useCallback(() => {
    fetchAll(); loadHL(); loadStaff(); loadVisitors()
  }, [fetchAll, loadHL, loadStaff, loadVisitors])

  // FEATURE 1: auto-refresh
  const countdown = useAutoRefresh(refreshAll, 60)

  useEffect(() => {
    loadHL(); loadStaff(); loadVisitors()
  }, [loadHL, loadStaff, loadVisitors])

  const outsideNow    = gatePasses.filter(g => g.status === 'Exited' || g.status === 'Issued')
  const returnedToday = gatePasses.filter(g => g.status === 'Returned' && g.exit_date === today())
  const overdueGP     = outsideNow.filter(g => elapsedLabel(g).color === C.red)
  const hlAway        = hlRecords.filter(r => r.status === 'Out')
  const hlOverdue     = hlRecords.filter(r => r.status === 'Out' && r.return_date && r.return_date < today()).map(r => r.id)
  const staffPending  = staffRecords.filter(r => r.status === 'Pending')
  const staffOnLeave  = staffRecords.filter(r => r.status === 'Approved')

  const updateGPStatusMon = async (id, from, to) => { if (!canTransition(from, to)) return; await supabase.from('reception_gatepasses').update({ status: to }).eq('id', id); fetchAll() }
  const updateHLStatus    = async (id, from, to) => { if (!canTransition(from, to)) return; await supabase.from('hostel_leave_records').update({ status: to }).eq('id', id); loadHL() }
  const updateStaffStatus = async (id, from, to) => { if (!canTransition(from, to)) return; await supabase.from('staff_leave_requests').update({ status: to }).eq('id', id); loadStaff() }

  const softDelete = async (table, id, reload) => {
    if (!window.confirm('Archive this record?')) return
    await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
    reload()
  }

  const saveHL = async e => {
    e.preventDefault(); setSaving(true)
    if (hlForm.student_name) {
      const { data: existing } = await supabase.from('hostel_leave_records').select('id').eq('student_name', hlForm.student_name).eq('status', 'Out').is('deleted_at', null)
      if (existing && existing.length > 0) {
        alert(`⚠ ${hlForm.student_name} already has an active hostel leave record.`)
        setSaving(false); return
      }
    }
    const clean = Object.fromEntries(Object.entries(hlForm).map(([k, v]) => [k, v === '' ? null : v]))
    const { error } = await supabase.from('hostel_leave_records').insert(clean)
    if (error) alert(error.message)
    else { setHLForm({ ...HOSTEL_LEAVE_DEF, departure_date: today() }); setHLStudent(null); setHLResetKey(k => k + 1); setShowHLForm(false); loadHL() }
    setSaving(false)
  }

  const saveStaff = async e => {
    e.preventDefault(); setSaving(true)
    const clean = Object.fromEntries(Object.entries(staffForm).map(([k, v]) => [k, v === '' ? null : v]))
    const { error } = await supabase.from('staff_leave_requests').insert(clean)
    if (error) alert(error.message)
    else { setStaffForm({ ...STAFF_LEAVE_DEF, from_date: today() }); setShowStaffForm(false); loadStaff() }
    setSaving(false)
  }

  const onSelectHL = useCallback(s => {
    if (s) { setHLStudent(s); setHLForm(f => ({ ...f, student_name: s.name, class_name: s.batch || f.class_name, house: s.house || f.house, course: s.course || f.course, hostel_type: s.hostel_type || f.hostel_type })) }
    else   { setHLStudent(null); setHLForm(f => ({ ...f, student_name: '', class_name: '', house: '', course: '', hostel_type: '' })) }
  }, [])

  const actionBtn = (label, onClick, style = {}) => (
    <button onClick={onClick} style={{ border: 'none', padding: '5px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: font, transition: 'all .12s', ...style }}>{label}</button>
  )

  const subTabPill = t => ({
    padding: '7px 14px', borderRadius: 99, fontFamily: font,
    border: `0.5px solid ${subTab === t ? C.navy : C.slate[200]}`,
    background: subTab === t ? C.navy : 'white',
    color: subTab === t ? 'white' : C.slate[600],
    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
    transition: 'all .14s', display: 'inline-flex', alignItems: 'center', gap: 5,
  })

  const StatMini = ({ items }) => (
    <div style={{ display: 'grid', gridTemplateColumns: mob ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 14 }}>
      {items.map(s => (
        <div key={s.label} style={{ background: 'white', borderRadius: 14, overflow: 'hidden', border: `0.5px solid ${C.slate[200]}`, boxShadow: '0 2px 6px rgba(0,0,0,.04)' }}>
          <div style={{ height: 3, background: s.color }} />
          <div style={{ padding: mob ? '10px 12px' : '12px 14px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3, fontFamily: font }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: font }}>{s.value}</div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div>
      {/* Sub-tab bar with FEATURE 1 auto-refresh countdown */}
      <div style={{ display: 'flex', gap: 7, marginBottom: 16, overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4, scrollbarWidth: 'none' }}>
        <button style={subTabPill('gate')} onClick={() => setSubTab('gate')}>
          🪪 Gate Passes
          {outsideNow.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 10, padding: '0 5px', fontWeight: 800, fontFamily: font }}>{outsideNow.length}</span>}
        </button>
        <button style={subTabPill('hostel')} onClick={() => setSubTab('hostel')}>
          🏠 Hostel Leave
          {hlAway.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 10, padding: '0 5px', fontWeight: 800, fontFamily: font }}>{hlAway.length}</span>}
        </button>
        <button style={subTabPill('staff')} onClick={() => setSubTab('staff')}>
          👩‍🏫 Staff Leave
          {staffPending.length > 0 && <span style={{ background: C.violet, color: 'white', borderRadius: 99, fontSize: 10, padding: '0 5px', fontWeight: 800, fontFamily: font }}>{staffPending.length}</span>}
        </button>
        <button style={subTabPill('visitors')} onClick={() => setSubTab('visitors')}>
          👤 Visitors Inside
          {visitors.length > 0 && <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 10, padding: '0 5px', fontWeight: 800, fontFamily: font }}>{visitors.length}</span>}
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* FEATURE 1: countdown ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: C.slate[50], borderRadius: 99, padding: '5px 10px', border: `0.5px solid ${C.slate[200]}` }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: `conic-gradient(${C.navy} ${(countdown/60)*360}deg, ${C.slate[200]} 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: C.navy, fontFamily: font }}>{countdown}</div>
            </div>
            <span style={{ fontSize: 10, color: C.slate[500], fontFamily: font, whiteSpace: 'nowrap' }}>Auto-refresh</span>
          </div>
          <button onClick={refreshAll} style={{ padding: '7px 12px', borderRadius: 9, border: `0.5px solid ${C.slate[200]}`, background: 'white', color: C.slate[600], fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font }}>↻ Now</button>
        </div>
      </div>

      {/* FEATURE 2: Critical alert panel */}
      <CriticalAlertPanel gatePasses={gatePasses} hlRecords={hlRecords} mob={mob} />

      {/* ── Gate Pass ── */}
      {subTab === 'gate' && (
        <>
          <StatMini items={[
            { label: 'Currently outside', value: outsideNow.length,    color: C.red     },
            { label: 'Overdue (>8h)',      value: overdueGP.length,    color: C.amber   },
            { label: 'Returned today',     value: returnedToday.length, color: C.emerald },
            { label: 'Total passes',       value: gatePasses.length,   color: C.navy    },
          ]} />
          <Card style={{ marginBottom: 14 }}>
            <CardHead icon="⚠" title={`Students outside (${outsideNow.length})`} accentColor={C.red} isMobile={mob} />
            <div style={{ padding: '0 16px' }}>
              {outsideNow.length === 0
                ? <EmptyState msg="✅ All students are on campus" />
                : outsideNow.map(g => (
                  <MonitorRow key={g.id}
                    initLetter={g.student_name?.[0]} avatarColor={g.status === 'Exited' ? C.red : C.navy}
                    name={g.student_name}
                    sub={[g.class_name, g.course, g.reason].filter(Boolean).join(' · ')}
                    meta={[
                      g.exit_time ? `Out: ${g.exit_time}` : null,
                      g.expected_return_time ? `⏰ Return by: ${g.expected_return_time}` : null,
                      g.approved_by ? `By: ${g.approved_by}` : null,
                      `Parent: ${g.parent_informed}`,
                    ].filter(Boolean)}
                    elapsedRecord={g} statusLabel={g.status}
                    actions={[
                      canTransition(g.status, 'Exited')   && actionBtn('→ Out',      () => updateGPStatusMon(g.id, g.status, 'Exited'),   { background: '#fee2e2', color: C.red     }),
                      canTransition(g.status, 'Returned') && actionBtn('↩ Returned', () => updateGPStatusMon(g.id, g.status, 'Returned'), { background: '#dcfce7', color: '#166534' }),
                      actionBtn('🖨️', () => printGatePass(g), { background: '#fef3c7', color: '#92400e' }),
                    ].filter(Boolean)}
                  />
                ))
              }
            </div>
          </Card>
          <Card>
            <CardHead icon="📋" title="All gate passes" sub={`${gatePasses.length} total`} isMobile={mob}
              right={<Btn small variant="ghost" onClick={() => exportToExcel(gatePasses, [
                { key: 'exit_date', label: 'Date' }, { key: 'student_name', label: 'Student' },
                { key: 'class_name', label: 'Class' }, { key: 'reason', label: 'Reason' },
                { key: 'exit_time', label: 'Exit Time' }, { key: 'expected_return_time', label: 'Return By' },
                { key: 'parent_informed', label: 'Parent' }, { key: 'status', label: 'Status' },
              ], 'GatePasses')}>📥 Excel</Btn>}
            />
            <div style={{ padding: '0 0 4px' }}>
              <RecordsTable loading={false} rows={gatePasses}
                columns={[
                  { key: 'exit_date',       label: 'Date',    render: r => fmtDate(r.exit_date) },
                  { key: 'student_name',    label: 'Student', render: r => <b style={{ fontFamily: font }}>{r.student_name}</b> },
                  { key: 'class_name',      label: 'Class' },
                  { key: 'reason',          label: 'Reason' },
                  { key: 'expected_return_time', label: 'Return By', render: r => r.expected_return_time ? <span style={{ color: C.amber, fontWeight: 700, fontFamily: font }}>{r.expected_return_time}</span> : '—' },
                  { key: 'parent_informed', label: 'Parent',  render: r => <span style={{ color: r.parent_informed === 'Yes' ? C.emerald : C.red, fontWeight: 700, fontFamily: font }}>{r.parent_informed}</span> },
                  { key: 'status',          label: 'Status',  render: r => <Pill label={r.status} /> },
                  { key: '_a',              label: 'Actions', render: r => (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {canTransition(r.status, 'Exited')   && <button onClick={() => updateGPStatusMon(r.id, r.status, 'Exited')}   style={{ ...delBtn, background: '#fee2e2', color: C.red     }}>→ Out</button>}
                      {canTransition(r.status, 'Returned') && <button onClick={() => updateGPStatusMon(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>↩ In</button>}
                      <button onClick={() => printGatePass(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e' }}>🖨️</button>
                    </div>
                  )},
                ]}
                mobileConfig={{
                  accent: r => r.status === 'Exited' ? C.red : r.status === 'Returned' ? C.emerald : '#ca8a04',
                  title:  r => `🎓 ${r.student_name}`,
                  subtitle: r => `${r.reason} · ${r.class_name || '—'}`,
                  badge:  r => <Pill label={r.status} />,
                  meta: r => [
                    `📅 ${fmtDate(r.exit_date)}${r.exit_time ? ' ' + r.exit_time : ''}`,
                    r.expected_return_time ? `⏰ Return: ${r.expected_return_time}` : null,
                    `Parent: ${r.parent_informed}`,
                  ],
                  actions: r => (
                    <div style={{ display: 'flex', gap: 5 }}>
                      {canTransition(r.status, 'Exited')   && <button onClick={() => updateGPStatusMon(r.id, r.status, 'Exited')}   style={{ ...delBtn, background: '#fee2e2', color: C.red,     fontSize: 11 }}>→ Out</button>}
                      {canTransition(r.status, 'Returned') && <button onClick={() => updateGPStatusMon(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>↩ In</button>}
                      <button onClick={() => printGatePass(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e', fontSize: 11 }}>🖨️</button>
                    </div>
                  ),
                }}
              />
            </div>
          </Card>
        </>
      )}

      {/* ── Hostel Leave ── */}
      {subTab === 'hostel' && (
        <>
          <StatMini items={[
            { label: 'Currently away', value: hlAway.length,    color: C.red     },
            { label: 'Overdue',        value: hlOverdue.length, color: C.amber   },
            { label: 'Returned',       value: hlRecords.filter(r => r.status === 'Returned').length, color: C.emerald },
            { label: 'Total records',  value: hlRecords.length, color: C.navy    },
          ]} />
          <Card style={{ marginBottom: 14 }}>
            <CardHead icon="🏠" title={`Boarders away (${hlAway.length})`} accentColor={C.red} isMobile={mob} />
            <div style={{ padding: '0 16px' }}>
              {hlLoading && <div style={{ color: C.slate[400], padding: 16, fontFamily: font }}>Loading…</div>}
              {!hlLoading && hlAway.length === 0 && <EmptyState msg="✅ All boarders are in the hostel" />}
              {!hlLoading && hlAway.map(r => {
                const isOverdue = hlOverdue.includes(r.id)
                return (
                  <MonitorRow key={r.id}
                    initLetter={r.student_name?.[0]} avatarColor={isOverdue ? C.red : C.navy}
                    name={<>{r.student_name}{isOverdue && <span style={{ marginLeft: 8, fontSize: 11, color: C.red, fontWeight: 700, fontFamily: font }}>⚠ OVERDUE</span>}</>}
                    sub={['🏠 ' + (r.house || '—'), r.class_name, r.reason].filter(Boolean).join(' · ')}
                    meta={[
                      `Left: ${fmtDate(r.departure_date)}`,
                      r.return_date ? `Return by: ${fmtDate(r.return_date)}${isOverdue ? ' ⚠' : ''}` : null,
                    ].filter(Boolean)}
                    elapsedRecord={{ created_at: r.created_at }}
                    statusLabel={isOverdue ? 'Overdue' : 'Out'}
                    actions={[
                      actionBtn('↩ Returned', () => updateHLStatus(r.id, 'Out', 'Returned'), { background: '#dcfce7', color: '#166534' }),
                      actionBtn('✕', () => softDelete('hostel_leave_records', r.id, loadHL), { background: '#fee2e2', color: C.red }),
                    ]}
                  />
                )
              })}
            </div>
          </Card>
          <Card style={{ marginBottom: 14 }}>
            <CardHead icon="📝" title="Record hostel leave"
              right={<Btn small variant={showHLForm ? 'ghost' : 'primary'} onClick={() => setShowHLForm(v => !v)}>{showHLForm ? '✕ Cancel' : '+ Add'}</Btn>}
              isMobile={mob} />
            {showHLForm && (
              <div style={{ padding: '14px 16px' }}>
                <form onSubmit={saveHL}>
                  <div style={grid2(mob)}>
                    <div style={span2}>
                      <FormField label="Search & select student *">
                        <StudentAutocomplete students={students} resetKey={hlResetKey} onSelect={onSelectHL} />
                        <StudentChip student={hlStudent} onClear={() => { setHLStudent(null); setHLForm(f => ({ ...f, student_name: '', class_name: '', house: '', course: '', hostel_type: '' })); setHLResetKey(k => k + 1) }} />
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
              </div>
            )}
          </Card>
          <Card>
            <CardHead icon="📁" title="All hostel leave records" sub={`${hlRecords.length} total`} isMobile={mob}
              right={<Btn small variant="ghost" onClick={() => exportToExcel(hlRecords, [
                { key: 'departure_date', label: 'Departed' }, { key: 'student_name', label: 'Student' },
                { key: 'house', label: 'House' }, { key: 'reason', label: 'Reason' },
                { key: 'return_date', label: 'Return By' }, { key: 'status', label: 'Status' },
              ], 'HostelLeave')}>📥 Excel</Btn>}
            />
            <RecordsTable loading={hlLoading} rows={hlRecords}
              columns={[
                { key: 'departure_date', label: 'Departed',  render: r => fmtDate(r.departure_date) },
                { key: 'student_name',   label: 'Student',   render: r => <b style={{ fontFamily: font }}>{r.student_name}</b> },
                { key: 'house',          label: 'House',     render: r => r.house ? <span style={{ color: C.emerald, fontWeight: 700, fontFamily: font }}>🏠 {r.house}</span> : '—' },
                { key: 'reason',         label: 'Reason' },
                { key: 'return_date',    label: 'Return By', render: r => { const ov = r.status === 'Out' && r.return_date && r.return_date < today(); return <span style={{ color: ov ? C.red : 'inherit', fontWeight: ov ? 700 : 400, fontFamily: font }}>{fmtDate(r.return_date)}{ov ? ' ⚠' : ''}</span> } },
                { key: 'status',         label: 'Status',    render: r => <Pill label={hlOverdue.includes(r.id) ? 'Overdue' : r.status} /> },
                { key: '_a',             label: 'Actions',   render: r => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {canTransition(r.status, 'Returned') && <button onClick={() => updateHLStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>↩</button>}
                    <button onClick={() => softDelete('hostel_leave_records', r.id, loadHL)} style={delBtn}>Archive</button>
                  </div>
                )},
              ]}
              mobileConfig={{
                accent: r => hlOverdue.includes(r.id) ? C.red : r.status === 'Returned' ? C.emerald : C.navy,
                title:  r => `🎓 ${r.student_name}`,
                subtitle: r => `${r.reason} · ${r.house ? '🏠 ' + r.house : '—'}`,
                badge:  r => <Pill label={hlOverdue.includes(r.id) ? 'Overdue' : r.status} />,
                meta: r => [
                  `Left: ${fmtDate(r.departure_date)}`,
                  r.return_date ? `Return by: ${fmtDate(r.return_date)}${hlOverdue.includes(r.id) ? ' ⚠' : ''}` : null,
                  r.class_name || null,
                ].filter(Boolean),
                actions: r => (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {canTransition(r.status, 'Returned') && <button onClick={() => updateHLStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>↩ Returned</button>}
                    <button onClick={() => softDelete('hostel_leave_records', r.id, loadHL)} style={{ ...delBtn, fontSize: 11 }}>Archive</button>
                  </div>
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* ── Staff Leave ── */}
      {subTab === 'staff' && (
        <>
          <StatMini items={[
            { label: 'Pending',  value: staffPending.length, color: C.amber   },
            { label: 'On leave', value: staffOnLeave.length, color: C.red     },
            { label: 'Returned', value: staffRecords.filter(r => r.status === 'Returned').length, color: C.emerald },
            { label: 'Total',    value: staffRecords.length, color: C.navy    },
          ]} />
          {staffPending.length > 0 && (
            <Card style={{ marginBottom: 14 }}>
              <CardHead icon="⏳" title={`Pending approval (${staffPending.length})`} accentColor={C.amber} isMobile={mob} />
              <div style={{ padding: '0 16px' }}>
                {staffPending.map(r => (
                  <MonitorRow key={r.id}
                    initLetter={r.staff_name?.[0]} avatarColor="#ca8a04"
                    name={r.staff_name}
                    sub={[r.role, r.department].filter(Boolean).join(' · ')}
                    meta={[
                      r.leave_type || null,
                      `${fmtDate(r.from_date)} – ${fmtDate(r.to_date)}`,
                      r.days ? `${r.days} day${r.days > 1 ? 's' : ''}` : null,
                    ].filter(Boolean)}
                    elapsedRecord={{ created_at: r.created_at }}
                    statusLabel="Pending"
                    actions={[
                      actionBtn('✓ Approve', () => updateStaffStatus(r.id, 'Pending', 'Approved'), { background: '#dcfce7', color: '#166534' }),
                      actionBtn('✕', () => softDelete('staff_leave_requests', r.id, loadStaff), { background: '#fee2e2', color: C.red }),
                    ]}
                  />
                ))}
              </div>
            </Card>
          )}
          <Card style={{ marginBottom: 14 }}>
            <CardHead icon="📝" title="Log staff leave"
              right={<Btn small variant={showStaffForm ? 'ghost' : 'primary'} onClick={() => setShowStaffForm(v => !v)}>{showStaffForm ? '✕ Cancel' : '+ Add'}</Btn>}
              isMobile={mob} />
            {showStaffForm && (
              <div style={{ padding: '14px 16px' }}>
                <form onSubmit={saveStaff}>
                  <div style={grid2(mob)}>
                    <FormField label="Staff Name *"><FormInput field="staff_name" value={staffForm.staff_name} onChange={set_staff} required /></FormField>
                    <FormField label="Role / Designation"><FormInput field="role" value={staffForm.role} onChange={set_staff} placeholder="e.g. Class Teacher" /></FormField>
                    <FormField label="Department"><FormSelect field="department" value={staffForm.department} onChange={set_staff} options={STAFF_DEPARTMENTS} placeholder="Select dept…" /></FormField>
                    <FormField label="Leave Type"><FormSelect field="leave_type" value={staffForm.leave_type} onChange={set_staff} options={STAFF_LEAVE_TYPES} placeholder="Select type…" /></FormField>
                    <FormField label="From Date"><FormInput field="from_date" value={staffForm.from_date} onChange={set_staff} type="date" /></FormField>
                    <FormField label="To Date"><FormInput field="to_date" value={staffForm.to_date} onChange={set_staff} type="date" /></FormField>
                    <FormField label="Days (auto)">
                      <input type="text" readOnly style={{ ...inp, background: C.slate[50], color: C.navy, fontWeight: 700 }} value={staffForm.days || '—'} />
                    </FormField>
                    <FormField label="Status"><FormSelect field="status" value={staffForm.status} onChange={set_staff} options={['Pending', 'Approved', 'Returned']} /></FormField>
                    <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={staffForm.remarks} onChange={set_staff} /></FormField></div>
                  </div>
                  <SaveBtn label="Save Leave Request" saving={saving} />
                </form>
              </div>
            )}
          </Card>
          <Card>
            <CardHead icon="📁" title="All staff leave records" sub={`${staffRecords.length} total`} isMobile={mob}
              right={<Btn small variant="ghost" onClick={() => exportToExcel(staffRecords, [
                { key: 'from_date', label: 'From' }, { key: 'to_date', label: 'To' },
                { key: 'staff_name', label: 'Staff' }, { key: 'department', label: 'Dept' },
                { key: 'leave_type', label: 'Type' }, { key: 'days', label: 'Days' }, { key: 'status', label: 'Status' },
              ], 'StaffLeave')}>📥 Excel</Btn>}
            />
            <RecordsTable loading={staffLoading} rows={staffRecords}
              columns={[
                { key: 'from_date',  label: 'From',   render: r => fmtDate(r.from_date) },
                { key: 'to_date',    label: 'To',     render: r => fmtDate(r.to_date) },
                { key: 'staff_name', label: 'Staff',  render: r => <b style={{ fontFamily: font }}>{r.staff_name}</b> },
                { key: 'department', label: 'Dept',   render: r => r.department ? <span style={{ color: C.violet, fontWeight: 700, fontFamily: font }}>{r.department}</span> : '—' },
                { key: 'leave_type', label: 'Type' },
                { key: 'days',       label: 'Days' },
                { key: 'status',     label: 'Status', render: r => <Pill label={r.status} /> },
                { key: '_a',         label: 'Actions', render: r => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {canTransition(r.status, 'Approved') && <button onClick={() => updateStaffStatus(r.id, r.status, 'Approved')}  style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>✓</button>}
                    {canTransition(r.status, 'Returned') && <button onClick={() => updateStaffStatus(r.id, r.status, 'Returned')}  style={{ ...delBtn, background: '#f1f5f9',  color: C.slate[600] }}>↩</button>}
                    <button onClick={() => softDelete('staff_leave_requests', r.id, loadStaff)} style={delBtn}>Archive</button>
                  </div>
                )},
              ]}
              mobileConfig={{
                accent: r => r.status === 'Approved' ? C.emerald : r.status === 'Pending' ? C.amber : r.status === 'Returned' ? C.slate[400] : C.navy,
                title:  r => `👩‍🏫 ${r.staff_name}`,
                subtitle: r => `${r.leave_type || '—'}${r.department ? ' · ' + r.department : ''}`,
                badge:  r => <Pill label={r.status} />,
                meta: r => [
                  `${fmtDate(r.from_date)} – ${fmtDate(r.to_date)}`,
                  r.days ? `${r.days} day${r.days > 1 ? 's' : ''}` : null,
                  r.role || null,
                ].filter(Boolean),
                actions: r => (
                  <div style={{ display: 'flex', gap: 5 }}>
                    {canTransition(r.status, 'Approved') && <button onClick={() => updateStaffStatus(r.id, r.status, 'Approved')} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>✓ Approve</button>}
                    {canTransition(r.status, 'Returned') && <button onClick={() => updateStaffStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#f1f5f9',  color: C.slate[600], fontSize: 11 }}>↩ Return</button>}
                    <button onClick={() => softDelete('staff_leave_requests', r.id, loadStaff)} style={{ ...delBtn, fontSize: 11 }}>Archive</button>
                  </div>
                ),
              }}
            />
          </Card>
        </>
      )}

      {/* ── Visitors Inside ── */}
      {subTab === 'visitors' && (
        <Card>
          <CardHead icon="👤" title={`Visitors currently inside (${visitors.length})`} accentColor={C.teal} isMobile={mob} />
          <div style={{ padding: '0 16px' }}>
            {visitors.length === 0 && <EmptyState msg="✅ No visitors currently inside" />}
            {visitors.map(v => (
              <MonitorRow key={v.id}
                initLetter={v.visitor_name?.[0]} avatarColor={C.teal}
                name={v.visitor_name}
                sub={`${v.purpose} · Meeting: ${v.meeting_with || '—'}`}
                meta={[
                  `In: ${v.in_time || fmtDate(v.visit_date)}`,
                  v.phone ? `📞 ${v.phone}` : null,
                  v.id_proof ? `ID: ${v.id_proof}` : null,
                ].filter(Boolean)}
                elapsedRecord={{ created_at: v.created_at }}
                statusLabel="Active"
                actions={[
                  <button key="out" onClick={async () => {
                    const now = new Date().toTimeString().slice(0, 5)
                    await supabase.from('reception_visitors').update({ out_time: now }).eq('id', v.id)
                    setVisitors(prev => prev.filter(x => x.id !== v.id))
                  }} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>✓ Mark Out</button>,
                  <button key="pr" onClick={() => printVisitorBadge(v)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e' }}>🖨️</button>,
                ]}
              />
            ))}
          </div>
        </Card>
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
  const [hlRecords,   setHLRecords]   = useState([])
  const [leaveApps,   setLeaveApps]   = useState([])

  const [enquiryForm, setEnquiryForm] = useState(ENQ_DEF)
  const [visitorForm, setVisitorForm] = useState(VIS_DEF)
  const [gpForm,      setGpForm]      = useState(GP_DEF)
  const [piForm,      setPiForm]      = useState(PI_DEF)
  const [laForm,      setLaForm]      = useState(LA_DEF)

  const [enquiryResetKey, setEnquiryResetKey] = useState(0)
  const [visitorResetKey, setVisitorResetKey] = useState(0)
  const [gpResetKey,      setGpResetKey]      = useState(0)
  const [piResetKey,      setPiResetKey]      = useState(0)
  const [laResetKey,      setLaResetKey]      = useState(0)

  const [enquiryStudent, setEnquiryStudent] = useState(null)
  const [visitorStudent, setVisitorStudent] = useState(null)
  const [gpStudent,      setGpStudent]      = useState(null)
  const [piStudent,      setPiStudent]      = useState(null)
  const [laStudent,      setLaStudent]      = useState(null)

  // FEATURE 4: repeat visitor cache
  const visitorHistoryRef = useRef({})

  useEffect(() => {
    fetchAll()
    supabase.from('students').select('*').order('name').then(({ data }) => setStudents(data || []))
    supabase.from('reception_custom_items').select('name').order('created_at').then(({ data }) => {
      if (data) setCustomItems(data.map(r => r.name))
    })
    supabase.from('hostel_leave_records').select('*').is('deleted_at', null).order('created_at', { ascending: false }).then(({ data }) => setHLRecords(data || []))
  }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [e, v, g, p, la] = await Promise.all([
      supabase.from('reception_enquiries').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('reception_visitors').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('reception_gatepasses').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('reception_parent_items').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('leave_applications').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    ])
    if (!e.error) setEnquiries(e.data || [])
    if (!v.error) {
      setVisitors(v.data || [])
      // FEATURE 4: build visitor history cache by phone
      const cache = {}
      ;(v.data || []).forEach(vis => {
        if (vis.phone) {
          if (!cache[vis.phone] || new Date(vis.created_at) > new Date(cache[vis.phone].created_at)) {
            cache[vis.phone] = vis
          }
        }
      })
      visitorHistoryRef.current = cache
    }
    if (!g.error) setGatePasses(g.data || [])
    if (!p.error) setParentItems(p.data || [])
    if (!la.error) setLeaveApps(la.data || [])
    setLoading(false)
  }

  const handleInsert = async (table, payload, reset) => {
    setSaving(true)
    // FEATURE 6: duplicate gate pass detection
    if (table === 'reception_gatepasses' && payload.student_name) {
      const { data: existing } = await supabase.from('reception_gatepasses').select('id').eq('student_name', payload.student_name).in('status', ['Issued', 'Exited']).is('deleted_at', null)
      if (existing && existing.length > 0) { alert(`⚠ ${payload.student_name} already has an active gate pass.`); setSaving(false); return }
    }
    // FEATURE 6: duplicate enquiry detection by phone
    if (table === 'reception_enquiries' && payload.phone) {
      const { data: existing } = await supabase.from('reception_enquiries').select('id,student_name,status').eq('phone', payload.phone).is('deleted_at', null).limit(1)
      if (existing && existing.length > 0) {
        const prev = existing[0]
        if (!window.confirm(`⚠ Phone ${payload.phone} already has an enquiry (${prev.student_name || '—'}, status: ${prev.status}). Add another anyway?`)) {
          setSaving(false); return
        }
      }
    }
    const clean = Object.fromEntries(Object.entries(payload).map(([k, v]) => [k, v === '' ? null : v]))
    const { error } = await supabase.from(table).insert(clean)
    if (error) alert(error.message)
    else { reset(); fetchAll() }
    setSaving(false)
  }

  const handleDelete = async (table, id) => {
    if (!window.confirm('Archive this record?')) return
    await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
    fetchAll()
  }

  const updateGPStatus = async (id, from, to) => { if (!canTransition(from, to)) return; await supabase.from('reception_gatepasses').update({ status: to }).eq('id', id); fetchAll() }

  // Promote a Pending leave application into an Issued gate pass, and link
  // the two records both ways so the application shows what it became and
  // the pass keeps a trail back to the original request.
  const approveLeaveApp = async (app) => {
    if (app.status !== 'Pending') return
    const approverName = window.prompt('Approved by (name):', 'Receptionist')
    if (approverName === null) return
    setSaving(true)
    const { data: existing } = await supabase.from('reception_gatepasses').select('id').eq('student_name', app.student_name).in('status', ['Issued', 'Exited']).is('deleted_at', null)
    if (existing && existing.length > 0) {
      alert(`⚠ ${app.student_name} already has an active gate pass. Resolve that first.`)
      setSaving(false)
      return
    }
    const { data: gp, error: gpErr } = await supabase.from('reception_gatepasses').insert({
      student_name: app.student_name, class_name: app.class_name, course: app.course,
      gcc_no: app.gcc_no, house: app.house, reason: app.reason,
      exit_date: app.from_date, return_date: app.to_date,
      responsible_contact: app.responsible_contact,
      approved_by: approverName || 'Receptionist', parent_informed: 'Yes', status: 'Issued',
      remarks: app.address ? `Address: ${app.address}` : null,
    }).select().single()
    if (gpErr) { alert(gpErr.message); setSaving(false); return }
    await supabase.from('leave_applications').update({
      status: 'Approved', reviewed_by: approverName || 'Receptionist',
      reviewed_at: new Date().toISOString(), gate_pass_id: gp.id,
    }).eq('id', app.id)
    setSaving(false)
    fetchAll()
  }

  const rejectLeaveApp = async (app) => {
    if (app.status !== 'Pending') return
    const reason = window.prompt('Reason for rejecting this leave application:')
    if (reason === null) return
    await supabase.from('leave_applications').update({
      status: 'Rejected', reviewed_by: 'Receptionist',
      reviewed_at: new Date().toISOString(), rejection_reason: reason || null,
    }).eq('id', app.id)
    fetchAll()
  }
  const updatePIStatus = async (id, from, to) => { if (!canTransition(from, to)) return; await supabase.from('reception_parent_items').update({ status: to }).eq('id', id); fetchAll() }

  const addCustomItem = async item => {
    setCustomItems(prev => [...prev, item])
    await supabase.from('reception_custom_items').insert([{ name: item }])
  }

  const onSelectEnquiry = useCallback(s => {
    if (s) { setEnquiryStudent(s); setEnquiryForm(f => ({ ...f, student_name: s.name, class_interest: s.batch || f.class_interest, phone: s.phone || f.phone, parent_name: s.father_name || f.parent_name })) }
    else   { setEnquiryStudent(null); setEnquiryForm(f => ({ ...f, student_name: '', parent_name: '' })) }
  }, [])

  // FEATURE 4: repeat visitor auto-fill
  const onSelectVisitor = useCallback(s => {
    if (s) { setVisitorStudent(s); setVisitorForm(f => ({ ...f, meeting_with: f.meeting_with || `Re: ${s.name}${s.batch ? ' (' + s.batch + ')' : ''}` })) }
    else   { setVisitorStudent(null) }
  }, [])

  const handleVisitorPhoneBlur = useCallback(phone => {
    if (!phone || phone.length < 6) return
    const prev = visitorHistoryRef.current[phone]
    if (prev) {
      setVisitorForm(f => ({
        ...f,
        visitor_name: f.visitor_name || prev.visitor_name,
        purpose:      f.purpose      || prev.purpose,
        meeting_with: f.meeting_with || prev.meeting_with,
        id_proof:     f.id_proof     || prev.id_proof,
      }))
    }
  }, [])

  const onSelectGP = useCallback(s => {
    if (s) { setGpStudent(s); setGpForm(f => ({ ...f, student_name: s.name, class_name: s.batch || f.class_name, course: s.course || f.course, gcc_no: s.gcc_no ? gccStr(s.gcc_no) : f.gcc_no, house: s.house || f.house })) }
    else   { setGpStudent(null); setGpForm(f => ({ ...f, student_name: '', class_name: '', course: '', gcc_no: '', house: '' })) }
  }, [])

  const onSelectLA = useCallback(s => {
    if (s) { setLaStudent(s); setLaForm(f => ({ ...f, student_name: s.name, class_name: s.batch || f.class_name, course: s.course || f.course, gcc_no: s.gcc_no ? gccStr(s.gcc_no) : f.gcc_no, house: s.house || f.house })) }
    else   { setLaStudent(null); setLaForm(f => ({ ...f, student_name: '', class_name: '', course: '', gcc_no: '', house: '' })) }
  }, [])

  const onSelectPI = useCallback(s => {
    if (s) { setPiStudent(s); setPiForm(f => ({ ...f, student_name: s.name, class_name: s.batch || f.class_name, house: s.house || f.house, course: s.course || f.course, hostel_type: s.hostel_type || f.hostel_type })) }
    else   { setPiStudent(null); setPiForm(f => ({ ...f, student_name: '', class_name: '', house: '', course: '', hostel_type: '' })) }
  }, [])

  const filteredRows = useMemo(() => {
    const q = search.toLowerCase()
    const searchCols = {
      'Enquiry':           ['student_name', 'parent_name', 'phone', 'class_interest', 'source', 'status'],
      'Visitor Book':      ['visitor_name', 'phone', 'purpose', 'meeting_with'],
      'Leave Application': ['student_name', 'gcc_no', 'house', 'reason', 'status', 'submitted_by'],
      'Gate Pass':         ['student_name', 'class_name', 'course', 'reason', 'status'],
      'Parent Items':      ['student_name', 'parent_name', 'class_name', 'item_name', 'house', 'status'],
    }
    const cols = searchCols[activeTab] || []
    const arr  = activeTab === 'Enquiry' ? enquiries : activeTab === 'Visitor Book' ? visitors : activeTab === 'Leave Application' ? leaveApps : activeTab === 'Gate Pass' ? gatePasses : parentItems
    if (!q) return arr
    return arr.filter(r => cols.some(c => String(r[c] || '').toLowerCase().includes(q)))
  }, [activeTab, search, enquiries, visitors, leaveApps, gatePasses, parentItems])

  const followUpDue  = enquiries.filter(e => e.follow_up_date === today() && e.status !== 'Converted' && e.status !== 'Closed').length
  const stillOutside = gatePasses.filter(g => g.status === 'Exited').length
  const pendingItems = parentItems.filter(p => p.status === 'Pending').length
  const pendingLA     = leaveApps.filter(a => a.status === 'Pending').length

  const set_enq = (f, v) => setEnquiryForm(p => ({ ...p, [f]: v }))
  const set_vis = (f, v) => setVisitorForm(p => ({ ...p, [f]: v }))
  const set_gp  = (f, v) => setGpForm(p => ({ ...p, [f]: v }))
  const set_pi  = (f, v) => setPiForm(p => ({ ...p, [f]: v }))
  const set_la  = (f, v) => setLaForm(p => ({ ...p, [f]: v }))

  const tabBadges = {
    'Enquiry':           followUpDue,
    'Leave Application': pendingLA,
    'Gate Pass':         stillOutside,
    'Parent Items':      pendingItems,
    'Monitors':          stillOutside,
  }

  const pad = mob ? '12px 14px' : '18px 20px'

  return (
    <div style={{ fontFamily: font, background: C.slate[50], minHeight: '100vh', paddingBottom: mob ? 80 : 0 }}>

      {/* ── Page Header ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.navy} 0%, #0f2340 100%)`, padding: mob ? '16px 16px 14px' : '20px 24px 18px', borderBottom: `3px solid ${C.gold}` }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.12em', color: C.gold, marginBottom: 3, fontFamily: font }}>GNSI Portal</div>
              <div style={{ fontSize: mob ? 20 : 24, fontWeight: 500, color: 'white', fontFamily: font }}>🛎️ Reception</div>
              {!mob && <div style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 3, fontFamily: font }}>Enquiries · Visitors · Gate Passes · Parent Items · Student 360°</div>}
            </div>
            {/* FEATURE 5: Daily Summary print button */}
            <button onClick={() => printDailySummary({ enquiries, visitors, gatePasses, parentItems, students })}
              style={{ padding: '8px 14px', borderRadius: 10, border: '0.5px solid rgba(255,255,255,.25)', background: 'rgba(255,255,255,.08)', color: 'white', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: font, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              🖨️ Daily Summary
            </button>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: mob ? 'repeat(3,1fr)' : 'repeat(5,1fr)', gap: 10, marginTop: 14 }}>
            {[
              { label: 'Enquiries',      value: enquiries.length, color: '#93c5fd', alert: followUpDue > 0 ? `${followUpDue} due` : null },
              { label: 'Visitors Today', value: visitors.filter(v => v.visit_date === today()).length, color: '#6ee7b7', alert: null },
              { label: 'Gate Passes',    value: gatePasses.length, color: C.goldLight, alert: stillOutside > 0 ? `${stillOutside} out` : null },
              { label: 'Pending Items',  value: pendingItems, color: '#c4b5fd', alert: pendingItems > 0 ? 'awaiting' : null },
              { label: 'Students',       value: students.length, color: 'rgba(255,255,255,.5)', alert: null },
            ].map((c, i) => (
              <div key={c.label} style={{ background: 'rgba(255,255,255,.07)', borderRadius: 12, padding: mob ? '10px 10px' : '12px 14px', border: '0.5px solid rgba(255,255,255,.12)', display: mob && i === 4 ? 'none' : 'block' }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 3, fontFamily: font }}>{c.label}</div>
                <div style={{ fontSize: mob ? 22 : 26, fontWeight: 700, color: 'white', fontFamily: font }}>{c.value}</div>
                {c.alert && <div style={{ fontSize: 10, color: '#fca5a5', fontWeight: 700, marginTop: 2, fontFamily: font }}>⚠ {c.alert}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Desktop Tab Bar ── */}
      {!mob && (
        <div style={{ background: 'white', borderBottom: `0.5px solid ${C.slate[200]}`, boxShadow: '0 1px 8px rgba(0,0,0,.05)', position: 'sticky', top: 0, zIndex: 100 }}>
          <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', padding: '0 24px', gap: 2 }}>
            {TABS.map(tab => (
              <button key={tab} onClick={() => { setActiveTab(tab); setSearch('') }}
                style={{ padding: '13px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer', background: 'none', border: 'none', fontFamily: font, color: activeTab === tab ? C.navy : C.slate[400], borderBottom: activeTab === tab ? `2.5px solid ${C.navy}` : '2.5px solid transparent', whiteSpace: 'nowrap', transition: 'color .12s, border-color .12s', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                {TAB_ICONS[tab]} {tab}
                {tabBadges[tab] > 0 && (
                  <span style={{ background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 10, padding: '0 5px', fontWeight: 800, fontFamily: font, lineHeight: '18px', display: 'inline-block', minWidth: 18, textAlign: 'center' }}>{tabBadges[tab]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: mob ? '14px 12px' : '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* FEATURE 10: Campus Headcount on Monitors & Student 360° */}
        {(activeTab === 'Monitors' || activeTab === 'Student 360°') && (
          <CampusHeadcount students={students} gatePasses={gatePasses} hlRecords={hlRecords} />
        )}

        {/* Search bar */}
        {activeTab !== 'Student 360°' && activeTab !== 'Monitors' && (
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: C.slate[300], pointerEvents: 'none' }}>🔍</span>
            <input
              style={{ ...inp, paddingLeft: 38, background: 'white', boxShadow: '0 1px 6px rgba(0,0,0,.05)' }}
              placeholder={`Search ${activeTab.toLowerCase()}…`}
              value={search} onChange={e => setSearch(e.target.value)}
              onFocus={e => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(30,58,95,.08)` }}
              onBlur={e => { e.target.style.borderColor = C.slate[200]; e.target.style.boxShadow = '0 1px 6px rgba(0,0,0,.05)' }}
            />
          </div>
        )}

        {activeTab === 'Student 360°' && <Student360 students={students} />}
        {activeTab === 'Monitors' && <MonitorsTab students={students} gatePasses={gatePasses} hlRecordsExternal={hlRecords} onGPStatusChange={(id, from, to) => updateGPStatus(id, from, to)} fetchAll={fetchAll} />}

        {/* ── ENQUIRY ── */}
        {activeTab === 'Enquiry' && (
          <>
            {/* FEATURE 8: source analytics */}
            <EnquirySourceChart enquiries={enquiries} />

            <Card>
              <CardHead icon="➕" title="Add Enquiry" sub="New admission or follow-up" isMobile={mob} />
              <div style={{ padding: pad }}>
                <form onSubmit={e => {
                  e.preventDefault()
                  handleInsert('reception_enquiries', enquiryForm, () => { setEnquiryForm({ ...ENQ_DEF, enquiry_date: today() }); setEnquiryStudent(null); setEnquiryResetKey(k => k + 1) })
                }}>
                  <div style={grid2(mob)}>
                    <div style={span2}>
                      <FormField label="Link to student (optional)">
                        <StudentAutocomplete students={students} resetKey={enquiryResetKey} onSelect={onSelectEnquiry} />
                        <StudentChip student={enquiryStudent} onClear={() => { setEnquiryStudent(null); setEnquiryForm(f => ({ ...f, student_name: '', parent_name: '' })); setEnquiryResetKey(k => k + 1) }} />
                      </FormField>
                    </div>
                    <FormField label="Parent Name"><FormInput field="parent_name" value={enquiryForm.parent_name} onChange={set_enq} /></FormField>
                    <FormField label="Phone"><FormInput field="phone" value={enquiryForm.phone} onChange={set_enq} /></FormField>
                    <FormField label="Class Interest"><FormSelect field="class_interest" value={enquiryForm.class_interest} onChange={set_enq} options={CLASS_OPTIONS} placeholder="Select class…" /></FormField>
                    <FormField label="Source"><FormSelect field="source" value={enquiryForm.source} onChange={set_enq} options={SOURCE_OPTIONS} placeholder="Select source…" /></FormField>
                    <FormField label="Status"><FormSelect field="status" value={enquiryForm.status} onChange={set_enq} options={['New', 'Follow Up', 'Converted', 'Closed']} /></FormField>
                    <FormField label="Enquiry Date"><FormInput field="enquiry_date" value={enquiryForm.enquiry_date} onChange={set_enq} type="date" /></FormField>
                    <FormField label="Follow Up Date"><FormInput field="follow_up_date" value={enquiryForm.follow_up_date} onChange={set_enq} type="date" /></FormField>
                    <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={enquiryForm.remarks} onChange={set_enq} /></FormField></div>
                  </div>
                  <SaveBtn label="Save Enquiry" saving={saving} />
                </form>
              </div>
            </Card>
            <Card>
              <CardHead icon="📋" title="Enquiry Records" sub={`${filteredRows.length} total`} isMobile={mob}
                right={<Btn small variant="ghost" onClick={() => exportToExcel(filteredRows, [
                  { key: 'enquiry_date', label: 'Date' }, { key: 'student_name', label: 'Student' },
                  { key: 'parent_name', label: 'Parent' }, { key: 'phone', label: 'Phone' },
                  { key: 'class_interest', label: 'Class' }, { key: 'source', label: 'Source' },
                  { key: 'status', label: 'Status' }, { key: 'follow_up_date', label: 'Follow Up' }, { key: 'remarks', label: 'Remarks' },
                ], 'Enquiries')}>📥 Excel</Btn>}
              />
              <RecordsTable loading={loading} rows={filteredRows} onDelete={id => handleDelete('reception_enquiries', id)}
                columns={[
                  { key: 'enquiry_date',   label: 'Date',      render: r => fmtDate(r.enquiry_date) },
                  { key: 'student_name',   label: 'Student',   render: r => <b style={{ fontFamily: font }}>{r.student_name || '—'}</b> },
                  { key: 'parent_name',    label: 'Parent' },
                  { key: 'phone',          label: 'Phone',     render: r => (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: font }}>{r.phone || '—'}</span>
                      {r.phone && (
                        <a href={`https://wa.me/91${r.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hello ${r.parent_name || ''},\n\nFollowing up on the admission enquiry for ${r.student_name || 'your child'} at GNSI. Please let us know if you'd like to schedule a visit.\n\nGuidance Navodaya & Sainik Institute\nKhangabok, Thoubal`)}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ background: '#25d366', color: 'white', borderRadius: 6, padding: '2px 7px', fontSize: 10, fontWeight: 700, textDecoration: 'none', fontFamily: font, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          💬 WA
                        </a>
                      )}
                    </div>
                  )},
                  { key: 'class_interest', label: 'Class' },
                  { key: 'source',         label: 'Source' },
                  { key: 'status',         label: 'Status',    render: r => <Pill label={r.status} /> },
                  { key: 'follow_up_date', label: 'Follow Up', render: r => { const due = r.follow_up_date === today(); return <span style={{ color: due ? '#ef4444' : 'inherit', fontWeight: due ? 700 : 400, fontFamily: font }}>{fmtDate(r.follow_up_date)}{due ? ' ⚠' : ''}</span> } },
                ]}
                mobileConfig={{
                  accent: r => r.status === 'Converted' ? C.emerald : r.status === 'Closed' ? C.slate[400] : r.status === 'Follow Up' ? C.amber : C.navy,
                  title:  r => r.student_name || r.parent_name || 'Enquiry',
                  subtitle: r => `${r.parent_name || '—'} · ${r.phone || 'No phone'} · ${r.class_interest || '—'}`,
                  badge:  r => <Pill label={r.status} />,
                  meta:   r => [
                    r.source ? `📣 ${r.source}` : null,
                    `📅 ${fmtDate(r.enquiry_date)}`,
                    r.follow_up_date ? `Follow up: ${fmtDate(r.follow_up_date)}${r.follow_up_date === today() ? ' ⚠' : ''}` : null,
                  ],
                  actions: r => r.phone ? (
                    <a href={`https://wa.me/91${r.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hello ${r.parent_name || ''},\n\nFollowing up on the admission enquiry for ${r.student_name || 'your child'} at GNSI.\n\nGuidance Navodaya & Sainik Institute\nKhangabok, Thoubal`)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{ background: '#25d366', color: 'white', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, textDecoration: 'none', fontFamily: font, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      💬 WhatsApp
                    </a>
                  ) : null,
                }}
              />
            </Card>
          </>
        )}

        {/* ── VISITOR BOOK ── */}
        {activeTab === 'Visitor Book' && (
          <>
            <Card>
              <CardHead icon="➕" title="Add Visitor" sub="Record new visitor entry" isMobile={mob} />
              <div style={{ padding: pad }}>
                <form onSubmit={e => {
                  e.preventDefault()
                  handleInsert('reception_visitors', visitorForm, () => { setVisitorForm({ ...VIS_DEF, visit_date: today() }); setVisitorStudent(null); setVisitorResetKey(k => k + 1) })
                }}>
                  <div style={grid2(mob)}>
                    <div style={span2}>
                      <FormField label="Student being visited (optional)">
                        <StudentAutocomplete students={students} resetKey={visitorResetKey} onSelect={onSelectVisitor} placeholder="Search student…" />
                        <StudentChip student={visitorStudent} onClear={() => { setVisitorStudent(null); setVisitorResetKey(k => k + 1) }} />
                      </FormField>
                    </div>
                    <FormField label="Visitor Name *"><FormInput field="visitor_name" value={visitorForm.visitor_name} onChange={set_vis} required /></FormField>
                    {/* FEATURE 4: phone field with auto-fill on blur */}
                    <FormField label="Phone">
                      <input type="text" style={inp} value={visitorForm.phone ?? ''}
                        onChange={e => set_vis('phone', e.target.value)}
                        onBlur={e => handleVisitorPhoneBlur(e.target.value)}
                        placeholder="Enter phone to auto-fill repeat visitor…"
                        onFocus={e => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = `0 0 0 3px rgba(30,58,95,.08)` }}
                      />
                      {visitorHistoryRef.current[visitorForm.phone] && (
                        <div style={{ marginTop: 4, fontSize: 11, color: C.teal, fontWeight: 700, fontFamily: font }}>
                          🔁 Repeat visitor detected — details auto-filled
                        </div>
                      )}
                    </FormField>
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
            </Card>
            <Card>
              <CardHead icon="👤" title="Visitor Records" sub={`${filteredRows.length} total`} isMobile={mob}
                right={<Btn small variant="ghost" onClick={() => exportToExcel(filteredRows, [
                  { key: 'visit_date', label: 'Date' }, { key: 'visitor_name', label: 'Visitor' },
                  { key: 'phone', label: 'Phone' }, { key: 'purpose', label: 'Purpose' },
                  { key: 'meeting_with', label: 'Meeting' }, { key: 'in_time', label: 'In' },
                  { key: 'out_time', label: 'Out' }, { key: 'id_proof', label: 'ID' },
                ], 'Visitors')}>📥 Excel</Btn>}
              />
              <RecordsTable loading={loading} rows={filteredRows} onDelete={id => handleDelete('reception_visitors', id)}
                columns={[
                  { key: 'visit_date',   label: 'Date',    render: r => fmtDate(r.visit_date) },
                  { key: 'visitor_name', label: 'Visitor', render: r => <b style={{ fontFamily: font }}>{r.visitor_name}</b> },
                  { key: 'phone',        label: 'Phone' },
                  { key: 'purpose',      label: 'Purpose' },
                  { key: 'meeting_with', label: 'Meeting' },
                  { key: 'in_time',      label: 'In' },
                  { key: 'out_time',     label: 'Out',     render: r => r.out_time || <span style={{ color: '#ef4444', fontWeight: 700, fontFamily: font }}>Still Inside</span> },
                  { key: 'id_proof',     label: 'ID' },
                  { key: '_badge',       label: '🖨️',      render: r => <button onClick={() => printVisitorBadge(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e' }}>🖨️</button> },
                ]}
                mobileConfig={{
                  accent: r => r.out_time ? C.slate[400] : C.teal,
                  title:  r => `👤 ${r.visitor_name}`,
                  subtitle: r => `${r.purpose} · ${r.meeting_with || '—'}`,
                  badge:  r => r.out_time
                    ? <span style={{ fontSize: 11, fontWeight: 700, color: C.slate[500], background: C.slate[100], borderRadius: 99, padding: '2px 8px', fontFamily: font }}>Out {r.out_time}</span>
                    : <span style={{ fontSize: 11, fontWeight: 700, color: C.red, background: '#fee2e2', borderRadius: 99, padding: '2px 8px', fontFamily: font }}>Still Inside</span>,
                  meta: r => [
                    r.phone ? `📞 ${r.phone}` : null,
                    `In: ${r.in_time || fmtDate(r.visit_date)}`,
                    r.id_proof ? `ID: ${r.id_proof}` : null,
                  ],
                  actions: r => (
                    <button onClick={() => printVisitorBadge(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e', fontSize: 11 }}>🖨️ Badge</button>
                  ),
                }}
              />
            </Card>
          </>
        )}

        {/* ── LEAVE APPLICATION ── */}
        {activeTab === 'Leave Application' && (
          <>
            <Card>
              <CardHead icon="📝" title="New Leave Application" sub="Request submitted by staff or parent — needs approval before a gate pass is issued" accentColor={C.violet} isMobile={mob} />
              <div style={{ padding: pad }}>
                <form onSubmit={e => {
                  e.preventDefault()
                  if (!laForm.student_name?.trim()) { alert('Please select a student before submitting.'); return }
                  if (!laForm.reason?.trim()) { alert('Reason is required.'); return }
                  if (!laForm.to_date) { alert('Return date is required.'); return }
                  handleInsert('leave_applications', { ...laForm, student_name: laStudent?.name || laForm.student_name, status: 'Pending' }, () => { setLaForm({ ...LA_DEF, from_date: today() }); setLaStudent(null); setLaResetKey(k => k + 1) })
                }}>
                  <div style={grid2(mob)}>
                    <div style={span2}>
                      <FormField label="Search & select student * (required)">
                        <StudentAutocomplete students={students} resetKey={laResetKey} onSelect={onSelectLA} />
                        <StudentChip student={laStudent} onClear={() => { setLaStudent(null); setLaForm(f => ({ ...f, student_name: '', class_name: '', course: '', gcc_no: '', house: '' })); setLaResetKey(k => k + 1) }} />
                        {!laStudent && <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444', fontWeight: 600, fontFamily: font }}>⚠ Student must be selected</div>}
                      </FormField>
                    </div>
                    <FormField label="GCC No."><FormInput field="gcc_no" value={laForm.gcc_no} onChange={set_la} placeholder="Auto-filled on student select" /></FormField>
                    <FormField label="House"><FormInput field="house" value={laForm.house} onChange={set_la} placeholder="Auto-filled on student select" /></FormField>
                    <FormField label="Reason *"><FormSelect field="reason" value={laForm.reason} onChange={set_la} options={GP_REASON_OPTIONS} placeholder="Select reason…" /></FormField>
                    <FormField label="Submitted By"><FormSelect field="submitted_by" value={laForm.submitted_by} onChange={set_la} options={['Staff', 'Parent']} /></FormField>
                    <FormField label="Date of leave"><FormInput field="from_date" value={laForm.from_date} onChange={set_la} type="date" /></FormField>
                    <FormField label="Date of return *"><FormInput field="to_date" value={laForm.to_date} onChange={set_la} type="date" /></FormField>
                    <FormField label="Responsible Person / Contact"><FormInput field="responsible_contact" value={laForm.responsible_contact} onChange={set_la} placeholder="Name and phone number" /></FormField>
                    <FormField label="Address"><FormInput field="address" value={laForm.address} onChange={set_la} /></FormField>
                    <div style={span2}><FormField label="Note (optional)"><FormTextarea field="applicant_note" value={laForm.applicant_note} onChange={set_la} /></FormField></div>
                  </div>
                  <SaveBtn label="Submit Leave Application" saving={saving} />
                </form>
              </div>
            </Card>
            <Card>
              <CardHead icon="📝" title="Leave Applications" sub={`${filteredRows.length} total`} accentColor={C.violet} isMobile={mob} />
              <RecordsTable loading={loading} rows={filteredRows} onDelete={id => handleDelete('leave_applications', id)}
                columns={[
                  { key: 'from_date',    label: 'Date',    render: r => fmtDate(r.from_date) },
                  { key: 'student_name', label: 'Student', render: r => <b style={{ fontFamily: font }}>{r.student_name}</b> },
                  { key: 'gcc_no',       label: 'GCC No.' },
                  { key: 'house',        label: 'House' },
                  { key: 'reason',       label: 'Reason' },
                  { key: 'to_date',      label: 'Return',  render: r => fmtDate(r.to_date) },
                  { key: 'submitted_by', label: 'By' },
                  { key: 'status',       label: 'Status',  render: r => <Pill label={r.status} /> },
                  { key: '_q',           label: 'Actions', render: r => (
                    r.status === 'Pending' ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => approveLeaveApp(r)} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>✓ Approve</button>
                        <button onClick={() => rejectLeaveApp(r)} style={{ ...delBtn, background: '#fee2e2', color: C.red }}>✕ Reject</button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 11, color: C.slate[400], fontFamily: font }}>{r.reviewed_by ? `By ${r.reviewed_by}` : '—'}</span>
                    )
                  )},
                ]}
                mobileConfig={{
                  accent: r => r.status === 'Approved' ? C.emerald : r.status === 'Rejected' ? C.red : C.violet,
                  title:  r => `📝 ${r.student_name}`,
                  subtitle: r => `${r.reason} · ${r.house || '—'}`,
                  badge:  r => <Pill label={r.status} />,
                  meta: r => [
                    `📅 ${fmtDate(r.from_date)} → ${fmtDate(r.to_date)}`,
                    r.gcc_no ? `GCC ${r.gcc_no}` : null,
                    `By: ${r.submitted_by}`,
                  ],
                  actions: r => (
                    r.status === 'Pending' ? (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => approveLeaveApp(r)} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>✓ Approve</button>
                        <button onClick={() => rejectLeaveApp(r)} style={{ ...delBtn, background: '#fee2e2', color: C.red, fontSize: 11 }}>✕ Reject</button>
                      </div>
                    ) : null
                  ),
                }}
              />
            </Card>
          </>
        )}

        {/* ── GATE PASS ── */}
        {activeTab === 'Gate Pass' && (
          <>
            <Card>
              <CardHead icon="🪪" title="Issue Gate Pass" sub="Student exit authorization" accentColor="#ca8a04" isMobile={mob} />
              <div style={{ padding: pad }}>
                <form onSubmit={e => {
                  e.preventDefault()
                  if (!gpForm.student_name?.trim()) { alert('Please select a student before issuing a gate pass.'); return }
                  if (gpForm.parent_informed === 'No') {
                    if (!window.confirm('⚠ Parent has NOT been informed. Issue gate pass anyway?')) return
                  }
                  handleInsert('reception_gatepasses', { ...gpForm, student_name: gpStudent?.name || gpForm.student_name }, () => { setGpForm({ ...GP_DEF, exit_date: today() }); setGpStudent(null); setGpResetKey(k => k + 1) })
                }}>
                  <div style={grid2(mob)}>
                    <div style={span2}>
                      <FormField label="Search & select student * (required)">
                        <StudentAutocomplete students={students} resetKey={gpResetKey} onSelect={onSelectGP} />
                        <StudentChip student={gpStudent} onClear={() => { setGpStudent(null); setGpForm(f => ({ ...f, student_name: '', class_name: '', course: '', gcc_no: '', house: '' })); setGpResetKey(k => k + 1) }} />
                        {!gpStudent && <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444', fontWeight: 600, fontFamily: font }}>⚠ Student must be selected</div>}
                      </FormField>
                    </div>
                    <FormField label="Class"><FormSelect field="class_name" value={gpForm.class_name} onChange={set_gp} options={CLASS_OPTIONS} placeholder="Select class…" /></FormField>
                    <FormField label="Course"><FormSelect field="course" value={gpForm.course} onChange={set_gp} options={COURSES} placeholder="Select course…" /></FormField>
                    <FormField label="GCC No."><FormInput field="gcc_no" value={gpForm.gcc_no} onChange={set_gp} placeholder="Auto-filled on student select" /></FormField>
                    <FormField label="House"><FormInput field="house" value={gpForm.house} onChange={set_gp} placeholder="Auto-filled on student select" /></FormField>
                    <FormField label="Reason *"><FormSelect field="reason" value={gpForm.reason} onChange={set_gp} options={GP_REASON_OPTIONS} placeholder="Select reason…" /></FormField>
                    <FormField label="Exit Date"><FormInput field="exit_date" value={gpForm.exit_date} onChange={set_gp} type="date" /></FormField>
                    <FormField label="Exit Time"><FormInput field="exit_time" value={gpForm.exit_time} onChange={set_gp} type="time" /></FormField>
                    {/* FEATURE 7: expected return time */}
                    <FormField label="Expected Return Time">
                      <FormInput field="expected_return_time" value={gpForm.expected_return_time} onChange={set_gp} type="time" placeholder="When should student return?" />
                    </FormField>
                    <FormField label="Return Date"><FormInput field="return_date" value={gpForm.return_date} onChange={set_gp} type="date" placeholder="For multi-day leave" /></FormField>
                    <FormField label="Responsible Person / Contact"><FormInput field="responsible_contact" value={gpForm.responsible_contact} onChange={set_gp} placeholder="Name and phone number" /></FormField>
                    <FormField label="Approved By"><FormSelect field="approved_by" value={gpForm.approved_by} onChange={set_gp} options={APPROVED_BY_OPTIONS} placeholder="Select approver…" /></FormField>
                    <FormField label="Parent Informed">
                      <FormSelect field="parent_informed" value={gpForm.parent_informed} onChange={set_gp} options={['Yes', 'No']} />
                      {gpForm.parent_informed === 'No' && <div style={{ marginTop: 5, fontSize: 12, color: '#ef4444', fontWeight: 600, fontFamily: font }}>⚠ Parent has not been informed</div>}
                    </FormField>
                    <FormField label="Status"><FormSelect field="status" value={gpForm.status} onChange={set_gp} options={['Issued', 'Exited', 'Returned']} /></FormField>
                    <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={gpForm.remarks} onChange={set_gp} /></FormField></div>
                  </div>
                  <SaveBtn label="Issue Gate Pass" saving={saving} />
                </form>
              </div>
            </Card>
            <Card>
              <CardHead icon="🪪" title="Gate Pass Records" sub={`${filteredRows.length} total`} accentColor="#ca8a04" isMobile={mob}
                right={<Btn small variant="ghost" onClick={() => exportToExcel(filteredRows, [
                  { key: 'exit_date', label: 'Date' }, { key: 'student_name', label: 'Student' },
                  { key: 'gcc_no', label: 'GCC No.' }, { key: 'class_name', label: 'Class' }, { key: 'house', label: 'House' },
                  { key: 'reason', label: 'Reason' }, { key: 'return_date', label: 'Return Date' },
                  { key: 'exit_time', label: 'Exit Time' }, { key: 'expected_return_time', label: 'Return By' },
                  { key: 'parent_informed', label: 'Parent' }, { key: 'status', label: 'Status' },
                ], 'GatePasses')}>📥 Excel</Btn>}
              />
              <RecordsTable loading={loading} rows={filteredRows} onDelete={id => handleDelete('reception_gatepasses', id)}
                columns={[
                  { key: 'exit_date',           label: 'Date',      render: r => fmtDate(r.exit_date) },
                  { key: 'student_name',         label: 'Student',   render: r => <b style={{ fontFamily: font }}>{r.student_name}</b> },
                  { key: 'gcc_no',                label: 'GCC No.' },
                  { key: 'class_name',           label: 'Class' },
                  { key: 'house',                 label: 'House' },
                  { key: 'reason',               label: 'Reason' },
                  { key: 'return_date',           label: 'Return Date', render: r => r.return_date ? fmtDate(r.return_date) : '—' },
                  { key: 'expected_return_time', label: 'Return By', render: r => r.expected_return_time ? <span style={{ color: C.amber, fontWeight: 700, fontFamily: font }}>⏰ {r.expected_return_time}</span> : '—' },
                  { key: 'parent_informed',      label: 'Parent',    render: r => <span style={{ color: r.parent_informed === 'Yes' ? C.emerald : C.red, fontWeight: 700, fontFamily: font }}>{r.parent_informed}</span> },
                  { key: 'status',               label: 'Status',    render: r => <Pill label={r.status} /> },
                  { key: '_q',                   label: 'Actions',   render: r => (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => printGatePass(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e' }}>🖨️</button>
                      {canTransition(r.status, 'Exited')   && <button onClick={() => updateGPStatus(r.id, r.status, 'Exited')}   style={{ ...delBtn, background: '#fee2e2', color: C.red     }}>→ Out</button>}
                      {canTransition(r.status, 'Returned') && <button onClick={() => updateGPStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>↩ In</button>}
                    </div>
                  )},
                ]}
                mobileConfig={{
                  accent: r => r.status === 'Exited' ? C.red : r.status === 'Returned' ? C.emerald : '#ca8a04',
                  title:  r => `🎓 ${r.student_name}`,
                  subtitle: r => `${r.reason} · ${r.class_name || '—'}`,
                  badge:  r => <Pill label={r.status} />,
                  meta: r => [
                    `📅 ${fmtDate(r.exit_date)}${r.exit_time ? ' ' + r.exit_time : ''}`,
                    r.gcc_no ? `GCC ${r.gcc_no}` : null,
                    r.house ? `🏠 ${r.house}` : null,
                    r.return_date ? `↩ Return: ${fmtDate(r.return_date)}` : null,
                    r.expected_return_time ? `⏰ Return by: ${r.expected_return_time}` : null,
                    `Parent: ${r.parent_informed}`,
                    r.approved_by ? `By: ${r.approved_by}` : null,
                  ],
                  actions: r => (
                    <div style={{ display: 'flex', gap: 5 }}>
                      <button onClick={() => printGatePass(r)} style={{ ...delBtn, background: '#fef3c7', color: '#92400e', fontSize: 11 }}>🖨️</button>
                      {canTransition(r.status, 'Exited')   && <button onClick={() => updateGPStatus(r.id, r.status, 'Exited')}   style={{ ...delBtn, background: '#fee2e2', color: C.red,     fontSize: 11 }}>→ Out</button>}
                      {canTransition(r.status, 'Returned') && <button onClick={() => updateGPStatus(r.id, r.status, 'Returned')} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>↩ In</button>}
                    </div>
                  ),
                }}
              />
            </Card>
          </>
        )}

        {/* ── PARENT ITEMS ── */}
        {activeTab === 'Parent Items' && (
          <>
            <Card>
              <CardHead icon="📦" title="Record Parent Item" sub="Log item brought by parent / guardian" accentColor={C.violet} isMobile={mob} />
              <div style={{ padding: pad }}>
                <form onSubmit={e => {
                  e.preventDefault()
                  if (!piForm.student_name?.trim()) { alert('Please select a student.'); return }
                  if (!piForm.item_names?.length) { alert('Please select at least one item.'); return }
                  const { item_names, ...restPiForm } = piForm
                  handleInsert('reception_parent_items', {
                    ...restPiForm,
                    student_name: piStudent?.name || piForm.student_name,
                    item_name: (item_names || []).join(', '),
                  }, () => { setPiForm({ ...PI_DEF, received_date: today() }); setPiStudent(null); setPiResetKey(k => k + 1) })
                }}>
                  <div style={grid2(mob)}>
                    <div style={span2}>
                      <FormField label="Search & select student * (required)">
                        <StudentAutocomplete students={students} resetKey={piResetKey} onSelect={onSelectPI} />
                        <StudentChip student={piStudent} onClear={() => { setPiStudent(null); setPiForm(f => ({ ...f, student_name: '', class_name: '', house: '', course: '', hostel_type: '' })); setPiResetKey(k => k + 1) }} />
                        {!piStudent && <div style={{ marginTop: 6, fontSize: 12, color: '#ef4444', fontWeight: 600, fontFamily: font }}>⚠ Student must be selected</div>}
                      </FormField>
                    </div>
                    <FormField label="Parent Name *"><FormInput field="parent_name" value={piForm.parent_name} onChange={set_pi} required /></FormField>
                    <FormField label="Class / Batch"><FormSelect field="class_name" value={piForm.class_name} onChange={set_pi} options={CLASS_OPTIONS} placeholder="Select class…" /></FormField>
                    <FormField label="Course"><FormSelect field="course" value={piForm.course} onChange={set_pi} options={COURSES} placeholder="Select course…" /></FormField>
                    <FormField label="Hostel Type"><FormSelect field="hostel_type" value={piForm.hostel_type} onChange={set_pi} options={HOSTEL_TYPES} placeholder="Select type…" /></FormField>
                    <FormField label="House / Block"><FormSelect field="house" value={piForm.house} onChange={set_pi} options={HOUSE_OPTIONS} placeholder="Select house…" /></FormField>
                    <FormField label="Quantity"><FormInput field="quantity" value={piForm.quantity} onChange={set_pi} /></FormField>
                    <FormField label="Received Date"><FormInput field="received_date" value={piForm.received_date} onChange={set_pi} type="date" /></FormField>
                    <FormField label="Received By"><FormInput field="received_by" value={piForm.received_by} onChange={set_pi} placeholder="e.g. Th. Priya…" /></FormField>
                    <FormField label="Status"><FormSelect field="status" value={piForm.status} onChange={set_pi} options={['Pending', 'Delivered', 'Returned']} /></FormField>
                    <div style={span2}><FormField label="Remarks"><FormTextarea field="remarks" value={piForm.remarks} onChange={set_pi} /></FormField></div>
                    <div style={span2}>
                      <label style={lbl}>Select Items * <span style={{ textTransform: 'none', fontWeight: 400, color: C.slate[400], fontSize: 11 }}>(choose or add custom)</span></label>
                      <ItemPicker value={piForm.item_names || []} onChange={v => setPiForm(f => ({ ...f, item_names: v }))} customItems={customItems} onAddCustom={addCustomItem} />
                    </div>
                  </div>
                  <SaveBtn label="Record Item" saving={saving} />
                </form>
              </div>
            </Card>

            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: font }}>View:</span>
              {[['list', '📋 List'], ['house', '🏠 By House']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setPiView(v)}
                  style={{ padding: '7px 14px', borderRadius: 99, border: `0.5px solid ${piView === v ? C.navy : C.slate[200]}`, background: piView === v ? C.navy : 'white', color: piView === v ? 'white' : C.slate[600], fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: font, transition: 'all .12s' }}>
                  {l}
                </button>
              ))}
            </div>

            {piView === 'house' && (
              <Card>
                <CardHead icon="🏠" title="House-wise Item Grid" accentColor={C.violet} isMobile={mob} />
                <div style={{ padding: pad }}>
                  <HouseWiseGrid parentItems={parentItems} onStatusChange={(id, to) => {
                    const item = parentItems.find(p => p.id === id)
                    if (item) updatePIStatus(id, item.status, to)
                  }} />
                </div>
              </Card>
            )}

            {piView === 'list' && (
              <Card>
                <CardHead icon="📦" title="Parent Item Records" sub={`${filteredRows.length} total`} accentColor={C.violet} isMobile={mob}
                  right={<Btn small variant="ghost" onClick={() => exportToExcel(filteredRows, [
                    { key: 'received_date', label: 'Date' }, { key: 'parent_name', label: 'Parent' },
                    { key: 'student_name', label: 'Student' }, { key: 'house', label: 'House' },
                    { key: 'item_name', label: 'Item' }, { key: 'quantity', label: 'Qty' }, { key: 'status', label: 'Status' },
                  ], 'ParentItems')}>📥 Excel</Btn>}
                />
                <RecordsTable loading={loading} rows={filteredRows} onDelete={id => handleDelete('reception_parent_items', id)}
                  columns={[
                    { key: 'received_date', label: 'Date',    render: r => fmtDate(r.received_date) },
                    { key: 'parent_name',   label: 'Parent',  render: r => <b style={{ fontFamily: font }}>{r.parent_name}</b> },
                    { key: 'student_name',  label: 'Student' },
                    { key: 'house',         label: 'House',   render: r => r.house ? <span style={{ color: C.emerald, fontWeight: 700, fontFamily: font }}>🏠 {r.house}</span> : '—' },
                    { key: 'item_name',     label: 'Item',    render: r => <b style={{ fontFamily: font }}>{r.item_name}</b> },
                    { key: 'quantity',      label: 'Qty' },
                    { key: 'status',        label: 'Status',  render: r => <Pill label={r.status} /> },
                    { key: '_actions',      label: 'Actions', render: r => (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => printItemInvoice(r)} style={{ ...delBtn, background: '#f5f3ff', color: C.violet }}>🖨️</button>
                        {canTransition(r.status, 'Delivered') && <button onClick={() => updatePIStatus(r.id, r.status, 'Delivered')} style={{ ...delBtn, background: '#dcfce7', color: '#166534' }}>✓</button>}
                        {canTransition(r.status, 'Returned')  && <button onClick={() => updatePIStatus(r.id, r.status, 'Returned')}  style={{ ...delBtn, background: '#f1f5f9',  color: C.slate[600] }}>↩</button>}
                      </div>
                    )},
                  ]}
                  mobileConfig={{
                    accent: r => r.status === 'Delivered' ? C.emerald : r.status === 'Returned' ? C.slate[400] : C.violet,
                    title:  r => `📦 ${r.item_name}`,
                    subtitle: r => `${r.parent_name} → ${r.student_name || '—'}`,
                    badge:  r => <Pill label={r.status} />,
                    meta:   r => [
                      fmtDate(r.received_date),
                      r.quantity ? `Qty: ${r.quantity}` : null,
                      r.house ? `🏠 ${r.house}` : null,
                      r.received_by ? `Rcvd by: ${r.received_by}` : null,
                    ],
                    actions: r => (
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => printItemInvoice(r)} style={{ ...delBtn, background: '#f5f3ff', color: C.violet, fontSize: 11 }}>🖨️</button>
                        {canTransition(r.status, 'Delivered') && <button onClick={() => updatePIStatus(r.id, r.status, 'Delivered')} style={{ ...delBtn, background: '#dcfce7', color: '#166534', fontSize: 11 }}>✓ Deliver</button>}
                        {canTransition(r.status, 'Returned')  && <button onClick={() => updatePIStatus(r.id, r.status, 'Returned')}  style={{ ...delBtn, background: '#f1f5f9',  color: C.slate[600], fontSize: 11 }}>↩ Return</button>}
                      </div>
                    ),
                  }}
                />
              </Card>
            )}
          </>
        )}
      </div>

      {/* ── Mobile Bottom Tab Bar ── */}
      {mob && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200, background: 'white', borderTop: `0.5px solid ${C.slate[200]}`, boxShadow: '0 -4px 20px rgba(0,0,0,.1)', display: 'flex', padding: '8px 0 env(safe-area-inset-bottom, 8px)' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab
            const badge = tabBadges[tab]
            return (
              <button key={tab} onClick={() => { setActiveTab(tab); setSearch('') }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 2px', fontFamily: font, WebkitTapHighlightColor: 'transparent', position: 'relative' }}>
                <div style={{ position: 'relative' }}>
                  <span style={{ fontSize: 18, display: 'block', lineHeight: 1 }}>{TAB_ICONS[tab]}</span>
                  {badge > 0 && (
                    <span style={{ position: 'absolute', top: -4, right: -6, background: '#ef4444', color: 'white', borderRadius: 99, fontSize: 8, padding: '1px 4px', fontWeight: 800, fontFamily: font, lineHeight: 1.4, minWidth: 14, textAlign: 'center' }}>{badge}</span>
                  )}
                </div>
                <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, color: isActive ? C.navy : C.slate[400], lineHeight: 1, transition: 'color .12s' }}>
                  {tab === 'Student 360°' ? '360°' : tab === 'Visitor Book' ? 'Visitors' : tab === 'Parent Items' ? 'Items' : tab}
                </span>
                {isActive && (
                  <div style={{ position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)', width: 24, height: 3, background: C.navy, borderRadius: 99 }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
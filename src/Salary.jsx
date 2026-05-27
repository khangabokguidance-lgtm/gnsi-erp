import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { supabase } from './supabase'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt       = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const cm        = () => new Date().toISOString().slice(0, 7)
const fmtMonth  = (m) => { if (!m) return ''; const [y, mo] = m.split('-'); return new Date(y, parseInt(mo) - 1).toLocaleString('default', { month: 'long', year: 'numeric' }) }
const fmtDate   = (d) => { if (!d) return '-'; return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
const gross     = (s) => (Number(s.basic_salary)||0) + (Number(s.seniority_allowance)||0) + (Number(s.loyalty_bonus)||0) + (Number(s.role_bonus)||0)
const pctBar    = (val, max) => Math.min(100, max > 0 ? Math.round((val/max)*100) : 0)
const scoreClr  = (p) => p >= 75 ? '#16a34a' : p >= 40 ? '#f59e0b' : '#dc2626'

const PAYMENT_MODES = ['Cash', 'Bank Transfer', 'UPI', 'Cheque']
const FISCAL_MONTHS = ['April','May','June','July','August','September','October','November','December','January','February','March']

// ─── Mobile detection hook ────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false)
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  return isMobile
}

// ─── Responsive style helpers ─────────────────────────────────────────────────

const S = {
  page:   (mob) => ({ padding: mob ? '12px' : '24px', fontFamily:"'Segoe UI', sans-serif", background:'#f8fafc', minHeight:'100vh' }),
  card:   { background:'white', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', padding:'16px', marginBottom:'16px' },
  cardMob:{ background:'white', borderRadius:'10px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', padding:'12px', marginBottom:'12px' },
  btn:    (c='#1e3a5f', dis=false) => ({ backgroundColor:dis?'#94a3b8':c, color:'white', border:'none', borderRadius:'8px', padding:'10px 16px', fontWeight:'600', cursor:dis?'not-allowed':'pointer', fontSize:'13px', opacity:dis?0.7:1, whiteSpace:'nowrap' }),
  btnSm:  (c='#1e3a5f') => ({ backgroundColor:c, color:'white', border:'none', borderRadius:'6px', padding:'6px 10px', fontWeight:'600', cursor:'pointer', fontSize:'12px', lineHeight:'1', whiteSpace:'nowrap' }),
  inp:    { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', boxSizing:'border-box', background:'white' },
  inpSm:  { width:'100%', padding:'8px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'13px', boxSizing:'border-box', background:'white' },
  lbl:    { display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' },
  tab:    (a, mob) => ({ padding: mob ? '8px 12px' : '10px 20px', fontWeight:'600', fontSize: mob ? '12px' : '13px', cursor:'pointer', background:'none', border:'none', borderBottomWidth:a?'3px':'0px', borderBottomStyle:'solid', borderBottomColor:a?'#1e3a5f':'transparent', color:a?'#1e3a5f':'#64748b', transition:'all 0.2s', whiteSpace:'nowrap' }),
  statCard:(color, bg) => ({ backgroundColor:bg, borderRadius:'10px', padding:'14px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', borderLeft:`4px solid ${color}` }),
  badge:  (c, bg) => ({ padding:'3px 10px', borderRadius:'999px', fontSize:'11px', fontWeight:'700', background:bg, color:c, display:'inline-block' }),
}

// ─── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_CSS = `@media print { @page { size: A4 portrait; margin: 5mm 7mm } body > *:not(#gnsi-print-root) { display: none !important } #gnsi-print-root { display: block !important } }`

function injectPrintCSS() {
  if (typeof document==='undefined' || document.getElementById('gnsi-print-style')) return
  const s = document.createElement('style'); s.id='gnsi-print-style'; s.textContent=PRINT_CSS; document.head.appendChild(s)
}

// ─── Salary Slip Builder ──────────────────────────────────────────────────────

function buildSlipHTML(s, ded, month, copy) {
  const g=gross(s), adv=Number(ded?.advance_deduction||0), lat=Number(ded?.late_deduction||0), adm=Number(ded?.admin_deduction||0), pf=Number(ded?.pf_deduction||0)
  const totDed=adv+lat+adm+pf, net=g-totDed
  const ini=(s.name||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()
  const isOff=copy==='office', ctag=isOff?'OFFICE COPY':'STAFF COPY', cbg=isOff?'#FCEBEB':'#E6F1FB', cclr=isOff?'#6B1A1A':'#0C447C'
  const mo=fmtMonth(month), genDate=new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})
  const payMode=ded?.payment_mode||''

  const erow=(el,ev,dl,dv,dspecial)=>`<tr>
    <td style="padding:8px 12px;border-bottom:.5px solid #EEF2FA;font-size:12px;color:#334;text-align:left">${el}</td>
    <td style="padding:8px 12px;border-bottom:.5px solid #EEF2FA;font-size:12px;font-weight:600;color:#185FA5;text-align:right;border-right:2px solid #C5D8F5">${ev?fmt(ev):'—'}</td>
    <td style="padding:8px 12px;border-bottom:.5px solid #FCEAEA;font-size:12px;color:#555;text-align:left;background:${dspecial?'#FFFBEB':'#fff'}">${dl||''}</td>
    <td style="padding:8px 12px;border-bottom:.5px solid #FCEAEA;font-size:12px;font-weight:600;color:${dspecial?'#B8860B':'#A32D2D'};text-align:right;background:${dspecial?'#FFFBEB':'#fff'}">${dv!=null?(dv?fmt(dv):'—'):''}</td>
  </tr>`

  return `<div style="width:100%;background:#fff;border:2px solid #1B3A6B;border-radius:6px;overflow:hidden;font-family:Arial,sans-serif;color:#222">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="background:#1B3A6B;padding:10px 14px;width:50px"><div style="width:36px;height:36px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center"><span style="font-size:9px;font-weight:700;color:#1B3A6B">GNSI</span></div></td>
      <td style="background:#1B3A6B;padding:10px 12px"><div style="font-size:15px;font-weight:700;color:#fff">Guidance Navodaya &amp; Sainik Institute</div><div style="font-size:10px;color:#B5D4F4;margin-top:2px">Khangabok Sorok Wangma, Thoubal, Manipur</div></td>
      <td style="background:#1B3A6B;padding:10px 14px;text-align:right;white-space:nowrap">
        <div style="background:${cbg};color:${cclr};font-size:10px;font-weight:700;padding:3px 10px;border-radius:10px;display:inline-block">${ctag}</div>
        <div style="font-size:10px;color:#B5D4F4;margin-top:4px">SALARY SLIP · ${mo}</div>
        <div style="font-size:9px;color:#7a9ec7;margin-top:2px">Generated: ${genDate}</div>
      </td>
    </tr></table>
    <div style="background:#EEF4FF;border-bottom:1px solid #C5D8F5;padding:8px 14px;display:flex;align-items:center;gap:12px">
      <div style="width:36px;height:36px;border-radius:50%;background:#1B3A6B;display:flex;align-items:center;justify-content:center;flex-shrink:0"><span style="font-size:13px;font-weight:700;color:#fff">${ini}</span></div>
      <div style="flex:1">
        <div style="font-size:15px;font-weight:700;color:#1B3A6B">${s.name||'—'}</div>
        <div style="font-size:11px;color:#3A5A9B;margin-top:2px">${s.designation||s.department||'—'}${payMode?` · Paid via ${payMode}`:''}</div>
      </div>
      <div style="text-align:right"><div style="font-size:10px;color:#5A7AB5">Employee No.</div><div style="font-size:14px;font-weight:700;color:#1B3A6B">GNSI-${String(s.id).padStart(3,'0')}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th colspan="2" style="background:#1B3A6B;color:#fff;font-size:11px;font-weight:700;padding:6px 12px;text-align:center;border-right:2px solid #C5D8F5">EARNINGS</th>
        <th colspan="2" style="background:#7B1F1F;color:#fff;font-size:11px;font-weight:700;padding:6px 12px;text-align:center">DEDUCTIONS</th>
      </tr></thead>
      <tbody>
        ${erow('Basic Pay',s.basic_salary,'Advance',adv,false)}
        ${erow('Seniority Allow.',s.seniority_allowance,'Late / Absent',lat,false)}
        ${erow('Loyalty Bonus',s.loyalty_bonus,'Admin Deduction',adm,true)}
        ${erow('Role Bonus',s.role_bonus,'PF Deduction',pf,false)}
      </tbody>
    </table>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #C5D8F5"><tr>
      <td style="background:#E6F1FB;padding:10px 12px;text-align:center;width:33%"><div style="font-size:10px;color:#185FA5;font-weight:700">GROSS EARNINGS</div><div style="font-size:20px;font-weight:700;color:#0C447C">${fmt(g)}</div></td>
      <td style="background:#FCEBEB;padding:10px 12px;text-align:center;width:33%;border:1px solid #FCEAEA"><div style="font-size:10px;color:#A32D2D;font-weight:700">TOTAL DEDUCTIONS</div><div style="font-size:20px;font-weight:700;color:#A32D2D">${fmt(totDed)}</div></td>
      <td style="background:#EAF3DE;padding:10px 12px;text-align:center;width:34%;border:1.5px solid #1B3A6B"><div style="font-size:10px;color:#1B3A6B;font-weight:700">NET SALARY PAYABLE</div><div style="font-size:20px;font-weight:700;color:#27500A">${fmt(net)}</div></td>
    </tr></table>
    <table style="width:100%;border-collapse:collapse;border-top:1px solid #C5D8F5"><tr><td style="padding:8px 12px;background:#fff">
      <div style="font-size:9px;font-weight:700;color:#B8860B;margin-bottom:4px">APPRAISAL / REMARKS BY FOUNDER</div>
      <div style="border-bottom:1.5px solid #333;min-height:24px;width:100%"></div>
    </td></tr></table>
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="padding:10px;text-align:center;font-size:10px;color:#666;border-right:.5px solid #EEF2FA;border-top:1.5px solid #bbb;width:33%">Staff Signature</td>
      <td style="padding:10px;text-align:center;font-size:10px;color:#666;border-right:.5px solid #EEF2FA;border-top:1.5px solid #bbb;width:33%">Accountant</td>
      <td style="padding:10px;text-align:center;font-size:10px;color:#666;border-top:1.5px solid #bbb;width:34%">Principal / Administrator</td>
    </tr></table>
  </div>`
}

function printSlip(s, ded, month) {
  injectPrintCSS()
  let root=document.getElementById('gnsi-print-root')
  if (!root) { root=document.createElement('div'); root.id='gnsi-print-root'; document.body.appendChild(root) }
  root.style.display='none'
  root.innerHTML=`<div style="width:196mm;font-family:Arial,sans-serif">${buildSlipHTML(s,ded,month,'office')}<div style="border-top:1.5px dashed #aaa;padding:3px 0;text-align:center;font-size:7px;color:#bbb;letter-spacing:2px;margin:4mm 0">✂ CUT HERE</div>${buildSlipHTML(s,ded,month,'staff')}</div>`
  root.style.display='block'
  setTimeout(() => { window.print(); setTimeout(()=>{root.style.display='none'},1200) }, 80)
}

function printAllSlips(staffList, dedMap, month) {
  injectPrintCSS()
  let root=document.getElementById('gnsi-print-root')
  if (!root) { root=document.createElement('div'); root.id='gnsi-print-root'; document.body.appendChild(root) }
  root.style.display='none'
  root.innerHTML=staffList.map(s=>`<div style="page-break-after:always;width:196mm;font-family:Arial,sans-serif">${buildSlipHTML(s,dedMap[s.id],month,'office')}<div style="border-top:1.5px dashed #aaa;padding:3px 0;text-align:center;font-size:7px;color:#bbb;letter-spacing:2px;margin:4mm 0">✂ CUT HERE</div>${buildSlipHTML(s,dedMap[s.id],month,'staff')}</div>`).join('')
  root.style.display='block'
  setTimeout(()=>{window.print();setTimeout(()=>{root.style.display='none'},2000)},80)
}

function printRegister(tableRef) {
  injectPrintCSS()
  let root=document.getElementById('gnsi-print-root')
  if (!root) { root=document.createElement('div'); root.id='gnsi-print-root'; document.body.appendChild(root) }
  root.style.display='none'; root.innerHTML=tableRef.current?.outerHTML||''; root.style.display='block'
  setTimeout(()=>{window.print();setTimeout(()=>{root.style.display='none'},1200)},80)
}

// ─── Export to CSV ────────────────────────────────────────────────────────────

function exportToCSV(staffList, dedMap, month) {
  const headers = ['S.N.','Name','Designation','Basic','Seniority','Loyalty','Role Bonus','Gross','Advance Ded','Late Ded','Admin Ded','PF Ded','Total Ded','Net Salary','Payment Mode','Status']
  const rows = staffList.map((s,i) => {
    const d = dedMap[s.id]||{}
    const g = gross(s)
    const totDed = (d.advance_deduction||0)+(d.late_deduction||0)+(d.admin_deduction||0)+(d.pf_deduction||0)
    return [i+1, s.name, s.designation||s.department||'', s.basic_salary||0, s.seniority_allowance||0, s.loyalty_bonus||0, s.role_bonus||0, g, d.advance_deduction||0, d.late_deduction||0, d.admin_deduction||0, d.pf_deduction||0, totDed, g-totDed, d.payment_mode||'', d.status||'Unpaid']
  })
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type:'text/csv' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href=url; a.download=`GNSI_Salary_${month}.csv`; a.click()
  URL.revokeObjectURL(url)
}

// ─── Slip Modal ───────────────────────────────────────────────────────────────

function SlipModal({ s, ded, month, onClose }) {
  if (!s) return null
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:'0' }}>
      <div style={{ background:'white', borderRadius:'12px 12px 0 0', width:'100%', maxWidth:'640px', maxHeight:'92vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ background:'#1e3a5f', color:'white', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
          <span style={{ fontSize:'12px', fontWeight:'600', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, marginRight:'8px' }}>Salary Slip — {s.name} · {fmtMonth(month)}</span>
          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
            <button onClick={()=>printSlip(s,ded,month)} style={S.btnSm('#B8860B')}>🖨 Print</button>
            <button onClick={onClose} style={{ background:'none', border:'none', color:'white', fontSize:'20px', cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY:'auto', padding:'12px', background:'#f2f4f8', display:'flex', flexDirection:'column', gap:'10px' }}>
          <div dangerouslySetInnerHTML={{ __html: buildSlipHTML(s,ded,month,'office') }} />
          <div style={{ borderTop:'1.5px dashed #999', padding:'4px 0', textAlign:'center', fontSize:'8px', color:'#aaa', letterSpacing:'2px' }}>CUT HERE</div>
          <div dangerouslySetInnerHTML={{ __html: buildSlipHTML(s,ded,month,'staff') }} />
        </div>
      </div>
    </div>
  )
}

// ─── Mobile Staff Card (replaces table row on mobile) ────────────────────────

function MobileStaffCard({ s, i, d, dedMap, setDed, setSlipStaff, bulkMode, isSelected, toggleSelect, isPaid, regMonth }) {
  const [expanded, setExpanded] = useState(false)
  const g = gross(s)
  const td = (d.advance_deduction||0)+(d.late_deduction||0)+(d.admin_deduction||0)+(d.pf_deduction||0)
  const net = g - td

  return (
    <div style={{ background: isPaid ? '#f0fdf4' : 'white', border: `1px solid ${isPaid ? '#bbf7d0' : '#e2e8f0'}`, borderRadius:'10px', marginBottom:'8px', overflow:'hidden', borderLeft: `4px solid ${isPaid ? '#16a34a' : '#1e3a5f'}` }}>
      {/* Card header — always visible */}
      <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:'10px' }} onClick={() => setExpanded(v=>!v)}>
        {bulkMode && (
          <input type="checkbox" checked={isSelected} onChange={e=>{e.stopPropagation();toggleSelect(s.id)}}
            style={{ width:'16px', height:'16px', flexShrink:0 }} />
        )}
        <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'#1e3a5f', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <span style={{ fontSize:'11px', fontWeight:'700', color:'white' }}>{(s.name||'').split(' ').map(w=>w[0]).join('').substring(0,2).toUpperCase()}</span>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.name}</div>
          <div style={{ fontSize:'11px', color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.designation||s.department||'—'}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:'15px', fontWeight:'800', color: isPaid ? '#16a34a' : '#1e3a5f' }}>{fmt(net)}</div>
          <span style={S.badge(isPaid?'#16a34a':'#dc2626', isPaid?'#dcfce7':'#fee2e2')}>{isPaid?'✅ Paid':'⏳ Unpaid'}</span>
        </div>
        <div style={{ fontSize:'16px', color:'#94a3b8', flexShrink:0, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }}>▼</div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop:'1px solid #f1f5f9', padding:'10px 12px', background:'#fafbfc' }}>
          {/* Earnings row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'10px' }}>
            {[
              { label:'Basic', value: fmt(s.basic_salary) },
              { label:'Gross', value: fmt(g), highlight: true },
              { label:'Seniority', value: s.seniority_allowance ? fmt(s.seniority_allowance) : '—' },
              { label:'Loyalty', value: s.loyalty_bonus ? fmt(s.loyalty_bonus) : '—' },
            ].map(item => (
              <div key={item.label} style={{ background: item.highlight ? '#E6F1FB' : '#f0f4f8', borderRadius:'6px', padding:'6px 8px' }}>
                <div style={{ fontSize:'10px', color:'#64748b' }}>{item.label}</div>
                <div style={{ fontSize:'13px', fontWeight:'700', color: item.highlight ? '#0C447C' : '#1e293b' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Deduction inputs */}
          <div style={{ fontSize:'11px', fontWeight:'700', color:'#7B1F1F', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.5px' }}>Deductions</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
            {[
              { field:'advance_deduction', label:'Advance', bg:'#fff' },
              { field:'late_deduction', label:'Late / Absent', bg:'#fff' },
              { field:'admin_deduction', label:'Admin', bg:'#FFFBEB' },
              { field:'pf_deduction', label:'PF', bg:'#f5f3ff' },
            ].map(({ field, label, bg }) => (
              <div key={field}>
                <label style={{ ...S.lbl, fontSize:'11px', marginBottom:'3px' }}>{label}</label>
                <input type="number" min="0" value={d[field]||0}
                  onChange={e=>setDed(s.id, field, e.target.value)}
                  style={{ ...S.inpSm, background:bg, textAlign:'right' }} />
              </div>
            ))}
          </div>

          {/* Net summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', marginBottom:'10px' }}>
            <div style={{ background:'#FCEBEB', borderRadius:'6px', padding:'6px 8px', textAlign:'center' }}>
              <div style={{ fontSize:'10px', color:'#A32D2D' }}>Total Ded.</div>
              <div style={{ fontSize:'13px', fontWeight:'700', color:'#A32D2D' }}>{td ? fmt(td) : '—'}</div>
            </div>
            <div style={{ background:'#EAF3DE', borderRadius:'6px', padding:'6px 8px', textAlign:'center', gridColumn:'span 2' }}>
              <div style={{ fontSize:'10px', color:'#27500A' }}>Net Salary</div>
              <div style={{ fontSize:'16px', fontWeight:'800', color:'#27500A' }}>{fmt(net)}</div>
            </div>
          </div>

          {/* Pay mode + actions */}
          <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
            <select value={d.payment_mode||'Cash'} onChange={e=>setDed(s.id,'payment_mode',e.target.value)}
              style={{ ...S.inpSm, width:'auto', flex:1, minWidth:'120px' }}>
              {PAYMENT_MODES.map(m=><option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={()=>setSlipStaff(s)} style={{ ...S.btnSm('#1e3a5f'), padding:'7px 12px' }}>🧾 Slip</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Pending Payment Dashboard Card ──────────────────────────────────────────

function PendingDashboard({ staff, salaryRows, regMonth, onMarkPaid, dedMap, isMobile }) {
  const monthRows = salaryRows.filter(r => r.month===regMonth)
  const paidIds   = new Set(monthRows.filter(r=>r.status==='Paid').map(r=>String(r.staff_id)))
  const unpaid    = staff.filter(s => !paidIds.has(String(s.id)))
  const saved     = monthRows.length > 0

  if (!saved) return (
    <div style={{ ...(isMobile ? S.cardMob : S.card), background:'#fef9c3', border:'1px solid #f59e0b' }}>
      <div style={{ fontSize:'14px', fontWeight:'700', color:'#b45309' }}>⚠️ Register not saved yet for {fmtMonth(regMonth)}</div>
      <div style={{ fontSize:'12px', color:'#92400e', marginTop:'4px' }}>Save the register first to track payment status.</div>
    </div>
  )

  return (
    <div style={isMobile ? S.cardMob : S.card}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px', flexWrap:'wrap', gap:'8px' }}>
        <h3 style={{ fontSize:'14px', fontWeight:'700', color:'#dc2626', margin:0 }}>⏳ Pending Payments — {fmtMonth(regMonth)}</h3>
        <span style={S.badge('#dc2626','#fee2e2')}>{unpaid.length} unpaid</span>
      </div>
      {unpaid.length===0
        ? <div style={{ textAlign:'center', padding:'24px', color:'#16a34a', fontWeight:'700' }}>✅ All staff paid for {fmtMonth(regMonth)}!</div>
        : (
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill,minmax(260px,1fr))', gap:'10px' }}>
            {unpaid.map(s => {
              const d=dedMap[s.id]||{}
              const g=gross(s), totDed=(d.advance_deduction||0)+(d.late_deduction||0)+(d.admin_deduction||0)+(d.pf_deduction||0), net=g-totDed
              const row=monthRows.find(r=>String(r.staff_id)===String(s.id))
              return (
                <div key={s.id} style={{ border:'1px solid #fecaca', borderRadius:'10px', padding:'12px 14px', background:'#fff1f2' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>{s.name}</div>
                      <div style={{ fontSize:'11px', color:'#64748b' }}>{s.designation||s.department||'-'}</div>
                      <div style={{ fontSize:'15px', fontWeight:'800', color:'#dc2626', marginTop:'4px' }}>{fmt(net)}</div>
                    </div>
                    {row && <button onClick={()=>onMarkPaid(row.id)} style={{ ...S.btnSm('#16a34a'), fontSize:'11px' }}>✅ Mark Paid</button>}
                  </div>
                </div>
              )
            })}
          </div>
        )
      }
    </div>
  )
}

// ─── Annual Summary ───────────────────────────────────────────────────────────

function AnnualSummary({ staff, salaryRows, isMobile }) {
  const [selectedStaff, setSelectedStaff] = useState('')
  const [fiscalYear, setFiscalYear]       = useState(() => {
    const now=new Date(); const y=now.getMonth()>=3?now.getFullYear():now.getFullYear()-1; return `${y}-${y+1}`
  })

  const years = useMemo(() => {
    const ys = new Set()
    salaryRows.forEach(r => { const y=parseInt(r.month?.split('-')[0]); if(!isNaN(y)){ys.add(`${y-1}-${y}`);ys.add(`${y}-${y+1}`)} })
    return [...ys].sort().reverse()
  }, [salaryRows])

  const [startY] = fiscalYear.split('-').map(Number)
  const fiscalMonths = [
    `${startY}-04`,`${startY}-05`,`${startY}-06`,`${startY}-07`,`${startY}-08`,`${startY}-09`,
    `${startY+1}-01`,`${startY+1}-02`,`${startY+1}-03`,`${startY+1}-10`,`${startY+1}-11`,`${startY+1}-12`,
  ].sort()

  const staffRows = useMemo(() =>
    salaryRows.filter(r => (!selectedStaff||String(r.staff_id)===selectedStaff) && fiscalMonths.includes(r.month)),
    [salaryRows, selectedStaff, fiscalMonths]
  )

  const totals = useMemo(() => ({
    gross:  staffRows.reduce((a,r)=>a+(r.basic_salary||0)+(r.seniority_allowance||0)+(r.loyalty_bonus||0)+(r.role_bonus||0),0),
    ded:    staffRows.reduce((a,r)=>a+(r.advance_deduction||0)+(r.late_deduction||0)+(r.admin_deduction||0)+(r.pf_deduction||0),0),
    net:    staffRows.reduce((a,r)=>a+(r.net_salary||0),0),
    paid:   staffRows.filter(r=>r.status==='Paid').reduce((a,r)=>a+(r.net_salary||0),0),
    months: new Set(staffRows.map(r=>r.month)).size,
  }), [staffRows])

  const byMonth = useMemo(() => {
    const map = {}
    staffRows.forEach(r => {
      if(!map[r.month]) map[r.month]={gross:0,net:0,ded:0,paid:0,count:0}
      const g=(r.basic_salary||0)+(r.seniority_allowance||0)+(r.loyalty_bonus||0)+(r.role_bonus||0)
      map[r.month].gross+=g; map[r.month].net+=r.net_salary||0
      map[r.month].ded+=(r.advance_deduction||0)+(r.late_deduction||0)+(r.admin_deduction||0)
      if(r.status==='Paid') map[r.month].paid+=r.net_salary||0
      map[r.month].count++
    })
    return map
  }, [staffRows])

  const maxNet = Math.max(...Object.values(byMonth).map(m=>m.net), 1)

  return (
    <div>
      {/* Controls */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'10px', marginBottom:'16px' }}>
        <select value={fiscalYear} onChange={e=>setFiscalYear(e.target.value)} style={isMobile ? S.inpSm : S.inp}>
          {years.map(y=><option key={y} value={y}>FY {y}</option>)}
        </select>
        <select value={selectedStaff} onChange={e=>setSelectedStaff(e.target.value)} style={isMobile ? S.inpSm : S.inp}>
          <option value="">All Staff</option>
          {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div style={{ fontSize:'12px', color:'#64748b', marginBottom:'14px' }}>{staffRows.length} records · {totals.months} months</div>

      {/* Annual stat cards — 2 cols on mobile, 4 on desktop */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
        {[
          { label:'Total Gross', value:totals.gross, color:'#0C447C', bg:'#E6F1FB', icon:'💰' },
          { label:'Total Deductions', value:totals.ded, color:'#A32D2D', bg:'#FCEBEB', icon:'➖' },
          { label:'Net Paid Out', value:totals.paid, color:'#16a34a', bg:'#dcfce7', icon:'✅' },
          { label:'Net Unpaid', value:totals.net-totals.paid, color:'#dc2626', bg:'#fee2e2', icon:'⏳' },
        ].map(c=>(
          <div key={c.label} style={S.statCard(c.color, c.bg)}>
            <div style={{ fontSize:'18px', marginBottom:'4px' }}>{c.icon}</div>
            <p style={{ fontSize:'11px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize: isMobile ? '15px' : '19px', fontWeight:'bold', color:c.color, margin:'2px 0 0' }}>{fmt(c.value)}</h2>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={isMobile ? S.cardMob : S.card}>
        <h3 style={{ fontSize:'14px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>📊 Monthly Net — FY {fiscalYear}</h3>
        <div style={{ overflowX:'auto' }}>
          <div style={{ display:'flex', alignItems:'flex-end', gap:'6px', height:'140px', paddingBottom:'4px', minWidth: isMobile ? '560px' : 'auto' }}>
            {fiscalMonths.map(m => {
              const d=byMonth[m]||{net:0,paid:0,count:0}
              const h=Math.max(8, (d.net/maxNet)*120)
              const [,mo]=m.split('-')
              return (
                <div key={m} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'4px', minWidth:'42px', flex:1 }}>
                  <div style={{ fontSize:'9px', fontWeight:'700', color:'#1e3a5f', textAlign:'center' }}>{d.net>0?fmt(d.net):''}</div>
                  <div style={{ position:'relative', width:'100%', height:`${h}px` }}>
                    <div style={{ position:'absolute', bottom:0, width:'100%', height:'100%', background:'#cbd5e1', borderRadius:'4px 4px 0 0' }} />
                    <div style={{ position:'absolute', bottom:0, width:'100%', height:`${pctBar(d.paid,d.net)}%`, background:'#1e3a5f', borderRadius:'4px 4px 0 0', transition:'height 0.4s' }} />
                  </div>
                  <div style={{ fontSize:'9px', color:'#94a3b8' }}>{FISCAL_MONTHS[parseInt(mo)-1]?.slice(0,3)}</div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display:'flex', gap:'12px', fontSize:'11px', color:'#64748b', marginTop:'8px' }}>
          <span><span style={{ display:'inline-block', width:'10px', height:'10px', background:'#1e3a5f', borderRadius:'2px', marginRight:'4px' }}/>Paid</span>
          <span><span style={{ display:'inline-block', width:'10px', height:'10px', background:'#cbd5e1', borderRadius:'2px', marginRight:'4px' }}/>Unpaid</span>
        </div>
      </div>

      {/* Month detail — cards on mobile, table on desktop */}
      {isMobile ? (
        <div>
          {fiscalMonths.filter(m=>byMonth[m]).map(m=>{
            const d=byMonth[m]
            const unpaidAmt=d.net-d.paid, cov=pctBar(d.paid,d.net)
            return (
              <div key={m} style={{ ...S.cardMob, border:'1px solid #e2e8f0' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                  <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>{fmtMonth(m)}</div>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <div style={{ width:'60px', height:'6px', background:'#e2e8f0', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ width:`${cov}%`, height:'100%', background:scoreClr(cov), borderRadius:'3px' }}/>
                    </div>
                    <span style={{ fontSize:'11px', fontWeight:'700', color:scoreClr(cov) }}>{cov}%</span>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px' }}>
                  {[['Gross',d.gross,'#0C447C'],['Paid',d.paid,'#16a34a'],['Unpaid',unpaidAmt, unpaidAmt>0?'#dc2626':'#16a34a']].map(([l,v,c])=>(
                    <div key={l} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:'10px', color:'#64748b' }}>{l}</div>
                      <div style={{ fontSize:'12px', fontWeight:'700', color:c }}>{fmt(v)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
            <thead>
              <tr style={{ background:'#1e3a5f', color:'white' }}>
                {['Month','Staff Count','Gross','Deductions','Net Payable','Paid','Unpaid','Coverage'].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontWeight:'600', fontSize:'12px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fiscalMonths.filter(m=>byMonth[m]).map(m=>{
                const d=byMonth[m]
                const unpaidAmt=d.net-d.paid, cov=pctBar(d.paid,d.net)
                return (
                  <tr key={m} style={{ borderBottom:'1px solid #f1f5f9' }}>
                    <td style={{ padding:'10px 12px', fontWeight:'600', color:'#1e293b' }}>{fmtMonth(m)}</td>
                    <td style={{ padding:'10px 12px', color:'#64748b' }}>{d.count}</td>
                    <td style={{ padding:'10px 12px', color:'#0C447C', fontWeight:'600' }}>{fmt(d.gross)}</td>
                    <td style={{ padding:'10px 12px', color:'#A32D2D' }}>{fmt(d.ded)}</td>
                    <td style={{ padding:'10px 12px', fontWeight:'700', color:'#1e293b' }}>{fmt(d.net)}</td>
                    <td style={{ padding:'10px 12px', color:'#16a34a', fontWeight:'700' }}>{fmt(d.paid)}</td>
                    <td style={{ padding:'10px 12px', color: unpaidAmt>0?'#dc2626':'#16a34a', fontWeight:'600' }}>{unpaidAmt>0?fmt(unpaidAmt):'—'}</td>
                    <td style={{ padding:'10px 12px', minWidth:'100px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <div style={{ flex:1, height:'6px', background:'#e2e8f0', borderRadius:'3px', overflow:'hidden' }}>
                          <div style={{ width:`${cov}%`, height:'100%', background:scoreClr(cov), borderRadius:'3px' }}/>
                        </div>
                        <span style={{ fontSize:'11px', fontWeight:'700', color:scoreClr(cov) }}>{cov}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background:'#f8fafc', fontWeight:'700' }}>
                <td style={{ padding:'10px 12px', color:'#1e293b' }}>Total</td>
                <td style={{ padding:'10px 12px', color:'#64748b' }}>{staffRows.length}</td>
                <td style={{ padding:'10px 12px', color:'#0C447C' }}>{fmt(totals.gross)}</td>
                <td style={{ padding:'10px 12px', color:'#A32D2D' }}>{fmt(totals.ded)}</td>
                <td style={{ padding:'10px 12px', color:'#1e293b' }}>{fmt(totals.net)}</td>
                <td style={{ padding:'10px 12px', color:'#16a34a' }}>{fmt(totals.paid)}</td>
                <td style={{ padding:'10px 12px', color:'#dc2626' }}>{fmt(totals.net-totals.paid)}</td>
                <td style={{ padding:'10px 12px' }}>{pctBar(totals.paid,totals.net)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Salary Component ────────────────────────────────────────────────────

export default function Salary() {
  const isMobile = useIsMobile()

  const [activeTab, setActiveTab] = useState('register')
  const [staff, setStaff]         = useState([])
  const [salaryRows, setSalaryRows] = useState([])
  const [advances, setAdvances]   = useState([])
  const [loading, setLoading]     = useState(true)

  // Register state
  const [regMonth, setRegMonth]       = useState(cm())
  const [roleFilter, setRoleFilter]   = useState('')
  const [search, setSearch]           = useState('')
  const [dedMap, setDedMap]           = useState({})
  const [saving, setSaving]           = useState(false)
  const [slipStaff, setSlipStaff]     = useState(null)
  const [selected, setSelected]       = useState(new Set())
  const [bulkMode, setBulkMode]       = useState(false)
  const [bulkPayMode, setBulkPayMode] = useState('Cash')
  const [toolbarOpen, setToolbarOpen] = useState(false)
  const tableRef = useRef(null)

  // Advances
  const [advForm, setAdvForm]     = useState({ staff_id:'', amount:'', reason:'', issued_month:cm(), repay_months:1 })
  const [advSaving, setAdvSaving] = useState(false)
  const [showAdvForm, setShowAdvForm] = useState(false)

  // History
  const [histStaffId, setHistStaffId] = useState('')
  const [compareMonth, setCompareMonth] = useState('')

  // ── Fetch ──

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data:sd },{ data:sald },{ data:advd }] = await Promise.all([
        supabase.from('staff_profiles').select('*').order('name'),
        supabase.from('salary').select('*').order('created_at',{ascending:false}),
        supabase.from('staff_advances').select('*').order('created_at',{ascending:false}),
      ])
      setStaff(sd||[]); setSalaryRows(sald||[]); setAdvances(advd||[])
    } catch(err) { alert('Failed to load data. '+err.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Derived ──

  const roles = useMemo(() => [...new Set(staff.map(s=>s.designation||s.department).filter(Boolean))].sort(), [staff])

  const filteredStaff = useMemo(() => {
    const q=search.toLowerCase()
    return staff.filter(s => {
      const matchRole   = !roleFilter || (s.designation||s.department)===roleFilter
      const matchSearch = !q || (s.name||'').toLowerCase().includes(q) || (s.designation||'').toLowerCase().includes(q)
      return matchRole && matchSearch
    })
  }, [staff, roleFilter, search])

  const regTotals = useMemo(() => {
    let tG=0,tA=0,tL=0,tAd=0,tPf=0,tN=0
    filteredStaff.forEach(s => {
      const g=gross(s), d=dedMap[s.id]||{}
      const td=(d.advance_deduction||0)+(d.late_deduction||0)+(d.admin_deduction||0)+(d.pf_deduction||0)
      tG+=g; tA+=d.advance_deduction||0; tL+=d.late_deduction||0; tAd+=d.admin_deduction||0; tPf+=d.pf_deduction||0; tN+=g-td
    })
    return { tG,tA,tL,tAd,tPf,tD:tA+tL+tAd+tPf,tN }
  }, [filteredStaff, dedMap])

  const historyData = useMemo(() => {
    if (!histStaffId) return []
    return salaryRows.filter(r=>String(r.staff_id)===String(histStaffId)).sort((a,b)=>b.month.localeCompare(a.month))
  }, [salaryRows, histStaffId])

  const totalPaid    = useMemo(() => salaryRows.filter(r=>r.status==='Paid').reduce((s,r)=>s+(r.net_salary||0),0), [salaryRows])
  const totalUnpaid  = useMemo(() => salaryRows.filter(r=>r.status!=='Paid').reduce((s,r)=>s+(r.net_salary||0),0), [salaryRows])
  const totalAdvOut  = useMemo(() => advances.filter(a=>a.status==='Active').reduce((s,a)=>s+(a.amount-a.repaid_amount),0), [advances])
  const paidThisMonth = useMemo(() => salaryRows.filter(r=>r.month===regMonth&&r.status==='Paid').length, [salaryRows, regMonth])

  const pendingAdvance = useCallback((staffId) => {
    let total=0
    advances.filter(a=>String(a.staff_id)===String(staffId)&&a.status==='Active').forEach(a=>{
      const rem=Number(a.amount)-Number(a.repaid_amount), pm=Number(a.repay_months)>0?Math.ceil(rem/Number(a.repay_months)):rem
      total+=Math.min(pm,rem)
    })
    return total
  }, [advances])

  // Load deductions for month
  useEffect(() => {
    if (!staff.length) return
    const map={}
    salaryRows.filter(r=>r.month===regMonth).forEach(r=>{
      map[r.staff_id]={ advance_deduction:r.advance_deduction||0, late_deduction:r.late_deduction||0, admin_deduction:r.admin_deduction||0, pf_deduction:r.pf_deduction||0, payment_mode:r.payment_mode||'Cash', status:r.status||'Unpaid' }
    })
    staff.forEach(s=>{
      if (!map[s.id]) map[s.id]={ advance_deduction:pendingAdvance(s.id), late_deduction:0, admin_deduction:0, pf_deduction:0, payment_mode:'Cash', status:'Unpaid' }
    })
    setDedMap(map)
  }, [regMonth, salaryRows, staff, pendingAdvance]) // eslint-disable-line

  // ── Handlers ──

  const setDed = useCallback((staffId, field, value) => {
    setDedMap(prev => ({ ...prev, [staffId]: { ...(prev[staffId]||{advance_deduction:0,late_deduction:0,admin_deduction:0,pf_deduction:0,payment_mode:'Cash',status:'Unpaid'}), [field]: field==='payment_mode'?value:Math.max(0,parseInt(value)||0) } }))
  }, [])

  const resetDeductions = useCallback(() => {
    setDedMap(prev => { const m={...prev}; filteredStaff.forEach(s=>{m[s.id]={advance_deduction:0,late_deduction:0,admin_deduction:0,pf_deduction:0,payment_mode:'Cash',status:'Unpaid'}}); return m })
  }, [filteredStaff])

  const toggleSelect = (id) => setSelected(prev => { const s=new Set(prev); s.has(id)?s.delete(id):s.add(id); return s })
  const selectAll    = () => setSelected(new Set(filteredStaff.map(s=>s.id)))
  const clearSelect  = () => setSelected(new Set())

  const handleSaveRegister = useCallback(async () => {
    setSaving(true)
    try {
      const rows = filteredStaff.map(s => {
        const d=dedMap[s.id]||{advance_deduction:0,late_deduction:0,admin_deduction:0,pf_deduction:0,payment_mode:'Cash',status:'Unpaid'}
        const g=gross(s), totDed=(d.advance_deduction||0)+(d.late_deduction||0)+(d.admin_deduction||0)+(d.pf_deduction||0)
        return { staff_id:s.id, month:regMonth, basic_salary:s.basic_salary||0, seniority_allowance:s.seniority_allowance||0, loyalty_bonus:s.loyalty_bonus||0, role_bonus:s.role_bonus||0, allowance:(s.seniority_allowance||0)+(s.loyalty_bonus||0)+(s.role_bonus||0), advance_deduction:d.advance_deduction||0, late_deduction:d.late_deduction||0, admin_deduction:d.admin_deduction||0, pf_deduction:d.pf_deduction||0, deduction:totDed, net_salary:g-totDed, status:d.status||'Unpaid', payment_mode:d.payment_mode||'Cash' }
      })
      const { error } = await supabase.from('salary').upsert(rows,{onConflict:'staff_id,month'})
      if (error) throw error

      for (const s of filteredStaff) {
        const advDed=dedMap[s.id]?.advance_deduction||0
        if (advDed>0) {
          const activeAdvs=advances.filter(a=>String(a.staff_id)===String(s.id)&&a.status==='Active')
          let rem=advDed
          for (const adv of activeAdvs) {
            if (rem<=0) break
            const advRem=Number(adv.amount)-Number(adv.repaid_amount), thisRep=Math.min(rem,advRem), newRepaid=Number(adv.repaid_amount)+thisRep
            await supabase.from('staff_advances').update({repaid_amount:newRepaid,status:newRepaid>=Number(adv.amount)?'Fully Repaid':'Active'}).eq('id',adv.id)
            rem-=thisRep
          }
        }
      }
      alert(`✅ Register saved for ${fmtMonth(regMonth)}`); fetchAll()
    } catch(err) { alert('Error: '+err.message) }
    finally { setSaving(false) }
  }, [filteredStaff, dedMap, regMonth, advances, fetchAll])

  const handleMarkPaid = useCallback(async (id, mode) => {
    try {
      const { error } = await supabase.from('salary').update({status:'Paid',payment_mode:mode||'Cash',paid_at:new Date().toISOString()}).eq('id',id)
      if (error) throw error; fetchAll()
    } catch(err) { alert('Error: '+err.message) }
  }, [fetchAll])

  const handleBulkMarkPaid = useCallback(async () => {
    if (!selected.size) return
    const monthRows = salaryRows.filter(r=>r.month===regMonth&&selected.has(r.staff_id))
    if (!monthRows.length) { alert('Save register first before marking paid.'); return }
    for (const row of monthRows) {
      await supabase.from('salary').update({status:'Paid',payment_mode:bulkPayMode,paid_at:new Date().toISOString()}).eq('id',row.id)
    }
    clearSelect(); fetchAll()
  }, [selected, salaryRows, regMonth, bulkPayMode, fetchAll])

  const handleDeleteSalary = useCallback(async (id) => {
    if (!window.confirm('Delete this salary record?')) return
    await supabase.from('salary').delete().eq('id',id); fetchAll()
  }, [fetchAll])

  const handleAddAdvance = useCallback(async (e) => {
    e.preventDefault(); setAdvSaving(true)
    try {
      const { error } = await supabase.from('staff_advances').insert([{ staff_id:Number(advForm.staff_id), amount:Number(advForm.amount), reason:advForm.reason, issued_month:advForm.issued_month, repay_months:Number(advForm.repay_months)||1, repaid_amount:0, status:'Active' }])
      if (error) throw error
      setAdvForm({staff_id:'',amount:'',reason:'',issued_month:cm(),repay_months:1}); setShowAdvForm(false); fetchAll()
    } catch(err) { alert('Error: '+err.message) }
    finally { setAdvSaving(false) }
  }, [advForm, fetchAll])

  const handleDeleteAdvance = useCallback(async (id) => {
    if (!window.confirm('Delete this advance?')) return
    await supabase.from('staff_advances').delete().eq('id',id); fetchAll()
  }, [fetchAll])

  const TH = ({ children, style={} }) => (
    <th style={{ padding:'7px 6px', textAlign:'center', fontWeight:'500', whiteSpace:'nowrap', fontSize:'12px', borderRight:'.5px solid rgba(255,255,255,.12)', ...style }}>{children}</th>
  )

  // ── Tabs config ──

  const TABS = [
    { key:'register',  label:'📋 Register',  labelFull:'📋 Salary Register' },
    { key:'pending',   label:'⏳ Pending',   labelFull:'⏳ Pending Payments' },
    { key:'advances',  label:'💳 Advances',  labelFull:'💳 Advances' },
    { key:'history',   label:'📅 History',   labelFull:'📅 History' },
    { key:'annual',    label:'📆 Annual',    labelFull:'📆 Annual Summary' },
  ]

  // ── JSX ──

  return (
    <div style={S.page(isMobile)}>
      {/* Header */}
      <div style={{ marginBottom:'16px' }}>
        <h1 style={{ fontSize: isMobile ? '20px' : '26px', fontWeight:'bold', color:'#1e3a5f', margin:0 }}>💵 Salary Management</h1>
        {!isMobile && <p style={{ color:'#64748b', fontSize:'14px', margin:'4px 0 0' }}>Salary register · Advances · History · Annual summary</p>}
      </div>

      {/* Stats grid — 2 cols on mobile, 5 on desktop */}
      <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: isMobile ? '8px' : '14px', marginBottom:'16px' }}>
        {[
          { label:'Total Staff',        value:staff.length,   color:'#1e3a5f', bg:'#eff6ff', icon:'👨‍🏫', money:false },
          { label:'Paid This Month',    value:paidThisMonth,  color:'#16a34a', bg:'#dcfce7', icon:'✅',  money:false },
          { label:'Total Paid',         value:totalPaid,      color:'#16a34a', bg:'#f0fdf4', icon:'💰',  money:true  },
          { label:'Total Unpaid',       value:totalUnpaid,    color:'#dc2626', bg:'#fee2e2', icon:'⏳',  money:true  },
          { label:'Advance Outstanding',value:totalAdvOut,    color:'#f59e0b', bg:'#fef3c7', icon:'💳',  money:true, fullWidth: isMobile },
        ].map(c=>(
          <div key={c.label} style={{ ...S.statCard(c.color, c.bg), gridColumn: c.fullWidth ? 'span 2' : 'auto' }}>
            <div style={{ fontSize:'18px', marginBottom:'2px' }}>{c.icon}</div>
            <p style={{ fontSize:'11px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
            <h2 style={{ fontSize: isMobile ? '16px' : '22px', fontWeight:'bold', color:c.color, margin:'2px 0 0' }}>{c.money?fmt(c.value):c.value}</h2>
          </div>
        ))}
      </div>

      {/* Tab bar — scrollable */}
      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:'16px', overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setActiveTab(t.key)} style={S.tab(activeTab===t.key, isMobile)}>
            {isMobile ? t.label : t.labelFull}
          </button>
        ))}
      </div>

      {/* ══ TAB: REGISTER ══ */}
      {activeTab==='register' && (
        <>
          {/* Toolbar */}
          <div style={{ background:'white', padding: isMobile ? '10px 12px' : '12px 16px', borderRadius:'10px', boxShadow:'0 2px 8px rgba(0,0,0,0.07)', marginBottom:'12px' }}>
            {/* Top row: title + month picker */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginBottom:'8px' }}>
              <div style={{ background:'#1e3a5f', color:'white', padding:'3px 8px', borderRadius:'6px', fontSize:'12px', fontWeight:'700' }}>GNSI</div>
              {!isMobile && <span style={{ fontWeight:'700', color:'#1e3a5f', fontSize:'14px' }}>Salary Register</span>}
              <input type="month" value={regMonth} onChange={e=>setRegMonth(e.target.value)}
                style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'13px', flex: isMobile ? 1 : 'none' }} />
              {isMobile && (
                <button onClick={()=>setToolbarOpen(v=>!v)}
                  style={{ ...S.btnSm('#64748b'), marginLeft:'auto' }}>
                  {toolbarOpen ? '✕ Close' : '⚙ Actions'}
                </button>
              )}
            </div>

            {/* Filters row */}
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginBottom:'8px' }}>
              <select value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}
                style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'13px', background:'white', flex: isMobile ? 1 : 'none', minWidth:'0' }}>
                <option value="">All Roles</option>
                {roles.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
              <input type="search" placeholder="Search name..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'13px', flex:1, minWidth:'0' }} />
            </div>

            {/* Action buttons — collapsible on mobile */}
            {(!isMobile || toolbarOpen) && (
              <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                <button onClick={resetDeductions} style={S.btnSm('#64748b')}>Reset Ded.</button>
                <button onClick={()=>exportToCSV(filteredStaff,dedMap,regMonth)} style={S.btnSm('#0891b2')}>⬇ CSV</button>
                {!isMobile && <button onClick={()=>printAllSlips(filteredStaff,dedMap,regMonth)} style={S.btnSm('#B8860B')}>🖨 All Slips</button>}
                {!isMobile && <button onClick={()=>printRegister(tableRef)} style={S.btnSm('#1e3a5f')}>🖨 Register</button>}
                <button onClick={handleSaveRegister} disabled={saving} style={{ ...S.btn('#16a34a',saving), flex: isMobile ? 1 : 'none' }}>
                  {saving?'⏳ Saving...':'💾 Save Register'}
                </button>
              </div>
            )}

            {/* Bulk action bar */}
            <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap', marginTop:'8px' }}>
              <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'13px', color:'#374151' }}>
                <input type="checkbox" checked={bulkMode} onChange={e=>setBulkMode(e.target.checked)} />
                Bulk select
              </label>
              {bulkMode && (
                <>
                  <button onClick={selectAll} style={S.btnSm('#64748b')}>All</button>
                  <button onClick={clearSelect} style={S.btnSm('#94a3b8')}>Clear</button>
                  <span style={{ fontSize:'12px', color:'#64748b' }}>{selected.size} sel.</span>
                  <select value={bulkPayMode} onChange={e=>setBulkPayMode(e.target.value)}
                    style={{ padding:'5px 8px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'12px' }}>
                    {PAYMENT_MODES.map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                  <button onClick={handleBulkMarkPaid} disabled={!selected.size} style={S.btn('#16a34a',!selected.size)}>✅ Mark Paid</button>
                </>
              )}
            </div>
          </div>

          {/* Summary bar — 2 cols on mobile */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap:'8px', marginBottom:'12px' }}>
            {[
              { label:'Staff',      value:filteredStaff.length, money:false, color:'#1e3a5f' },
              { label:'Gross',      value:regTotals.tG,         money:true,  color:'#0C447C' },
              { label:'Deductions', value:regTotals.tD,         money:true,  color:'#791F1F' },
              { label:'PF Total',   value:regTotals.tPf,        money:true,  color:'#7c3aed' },
              { label:'Net Payable',value:regTotals.tN,         money:true,  color:'#27500A', fullWidth: isMobile },
            ].map(c=>(
              <div key={c.label} style={{ background:'white', borderRadius:'8px', padding:'8px 12px', boxShadow:'0 1px 4px rgba(0,0,0,0.06)', border:'.5px solid #e2e8f0', gridColumn: c.fullWidth ? 'span 2' : 'auto' }}>
                <div style={{ fontSize:'10px', color:'#64748b', marginBottom:'2px' }}>{c.label}</div>
                <div style={{ fontSize: isMobile ? '14px' : '16px', fontWeight:'700', color:c.color }}>{c.money?fmt(c.value):c.value}</div>
              </div>
            ))}
          </div>

          {loading
            ? <div style={{ textAlign:'center', padding:'48px', color:'#64748b' }}>⏳ Loading...</div>
            : isMobile
              ? (
                /* Mobile card layout */
                <div>
                  {filteredStaff.map((s,i) => {
                    const d=dedMap[s.id]||{advance_deduction:0,late_deduction:0,admin_deduction:0,pf_deduction:0,payment_mode:'Cash',status:'Unpaid'}
                    const isPaid = d.status==='Paid'
                    return (
                      <MobileStaffCard
                        key={s.id} s={s} i={i} d={d} dedMap={dedMap} setDed={setDed}
                        setSlipStaff={setSlipStaff} bulkMode={bulkMode}
                        isSelected={selected.has(s.id)} toggleSelect={toggleSelect}
                        isPaid={isPaid} regMonth={regMonth}
                      />
                    )
                  })}
                </div>
              )
              : (
                /* Desktop table layout */
                <div style={{ background:'white', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.08)', overflow:'hidden' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table ref={tableRef} style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                      <thead style={{ position:'sticky', top:0, zIndex:10 }}>
                        <tr style={{ background:'#1e3a5f', color:'white' }}>
                          {bulkMode && <TH><input type="checkbox" onChange={e=>e.target.checked?selectAll():clearSelect()} checked={selected.size===filteredStaff.length&&filteredStaff.length>0}/></TH>}
                          <TH style={{ textAlign:'left', paddingLeft:'12px' }}>S.N.</TH>
                          <TH style={{ textAlign:'left', minWidth:'150px' }}>Staff Name</TH>
                          <TH style={{ textAlign:'left', minWidth:'110px' }}>Designation</TH>
                          <TH>Basic</TH>
                          <TH>Seniority</TH>
                          <TH>Loyalty</TH>
                          <TH>Role</TH>
                          <TH style={{ background:'#254e91', minWidth:'80px' }}>Gross</TH>
                          <TH>Advance</TH>
                          <TH>Late</TH>
                          <TH style={{ background:'#7B3A00' }}>Admin</TH>
                          <TH style={{ background:'#4a1d96' }}>PF</TH>
                          <TH style={{ background:'#6B1111' }}>Total Ded.</TH>
                          <TH style={{ background:'#1A5C1A' }}>Net</TH>
                          <TH>Pay Mode</TH>
                          <TH>Status</TH>
                          <TH>Slip</TH>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.map((s,i) => {
                          const d=dedMap[s.id]||{advance_deduction:0,late_deduction:0,admin_deduction:0,pf_deduction:0,payment_mode:'Cash',status:'Unpaid'}
                          const g=gross(s), td=(d.advance_deduction||0)+(d.late_deduction||0)+(d.admin_deduction||0)+(d.pf_deduction||0), net=g-td
                          const isPaid=d.status==='Paid'
                          const rowBg=isPaid?'#f0fdf4':i%2===1?'#fafbfc':'white'
                          const isSelected=selected.has(s.id)
                          return (
                            <tr key={s.id} style={{ borderBottom:'.5px solid #f1f5f9', background:isSelected?'#eff6ff':rowBg, borderLeft:isPaid?'3px solid #16a34a':'3px solid transparent' }}>
                              {bulkMode && <td style={{ padding:'6px', textAlign:'center' }}><input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(s.id)}/></td>}
                              <td style={{ padding:'6px 12px', color:'#64748b', textAlign:'center' }}>{i+1}</td>
                              <td style={{ padding:'6px 8px', fontWeight:'600', color:'#1e293b' }}>{s.name}</td>
                              <td style={{ padding:'6px 8px' }}>
                                <span style={{ display:'inline-block', fontSize:'10px', padding:'1px 7px', borderRadius:'8px', background:'#E6F1FB', color:'#0C447C', whiteSpace:'nowrap' }}>
                                  {s.designation||s.department||'—'}
                                </span>
                              </td>
                              <td style={{ padding:'6px 8px', textAlign:'right' }}>{fmt(s.basic_salary)}</td>
                              <td style={{ padding:'6px 8px', textAlign:'right', color:'#64748b' }}>{s.seniority_allowance?fmt(s.seniority_allowance):'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'right', color:'#64748b' }}>{s.loyalty_bonus?fmt(s.loyalty_bonus):'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'right', color:'#64748b' }}>{s.role_bonus?fmt(s.role_bonus):'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'right', fontWeight:'600', background:'#E6F1FB', color:'#0C447C' }}>{fmt(g)}</td>
                              {[
                                { field:'advance_deduction', style:{} },
                                { field:'late_deduction', style:{} },
                                { field:'admin_deduction', style:{ background:'#FFFBEB' } },
                                { field:'pf_deduction', style:{ background:'#f5f3ff' } },
                              ].map(({ field, style:iStyle }) => (
                                <td key={`${s.id}-${field}`} style={{ padding:'4px 6px', textAlign:'center' }}>
                                  <input type="number" min="0" value={d[field]||0} onChange={e=>setDed(s.id,field,e.target.value)}
                                    style={{ width:'68px', padding:'3px 5px', borderRadius:'4px', border:'.5px solid #d1d5db', fontSize:'11px', textAlign:'right', ...iStyle }} />
                                </td>
                              ))}
                              <td style={{ padding:'6px 8px', textAlign:'right', fontWeight:'600', background:'#FCEBEB', color:'#791F1F' }}>{td?fmt(td):'—'}</td>
                              <td style={{ padding:'6px 8px', textAlign:'right', fontWeight:'700', background:'#EAF3DE', color:'#27500A', fontSize:'13px' }}>{fmt(net)}</td>
                              <td style={{ padding:'4px 6px' }}>
                                <select value={d.payment_mode||'Cash'} onChange={e=>setDed(s.id,'payment_mode',e.target.value)}
                                  style={{ padding:'3px 5px', borderRadius:'4px', border:'.5px solid #d1d5db', fontSize:'11px', background:'white', width:'80px' }}>
                                  {PAYMENT_MODES.map(m=><option key={m} value={m}>{m}</option>)}
                                </select>
                              </td>
                              <td style={{ padding:'4px 8px', textAlign:'center' }}>
                                {isPaid
                                  ? <span style={S.badge('#16a34a','#dcfce7')}>✅ Paid</span>
                                  : <span style={S.badge('#dc2626','#fee2e2')}>⏳ Unpaid</span>
                                }
                              </td>
                              <td style={{ padding:'4px 6px', textAlign:'center' }}>
                                <button onClick={()=>setSlipStaff(s)} style={{ ...S.btnSm('#1e3a5f'), padding:'3px 8px', fontSize:'11px' }}>Slip</button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr style={{ background:'#1e3a5f', color:'white' }}>
                          {bulkMode && <td/>}
                          <td colSpan={3} style={{ padding:'8px 12px', fontWeight:'600', fontSize:'12px', textAlign:'left' }}>Total — {filteredStaff.length} staff</td>
                          <td colSpan={4}/>
                          <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:'600' }}>{fmt(regTotals.tG)}</td>
                          <td style={{ padding:'8px 6px', textAlign:'right' }}>{fmt(regTotals.tA)}</td>
                          <td style={{ padding:'8px 6px', textAlign:'right' }}>{fmt(regTotals.tL)}</td>
                          <td style={{ padding:'8px 6px', textAlign:'right' }}>{fmt(regTotals.tAd)}</td>
                          <td style={{ padding:'8px 6px', textAlign:'right' }}>{fmt(regTotals.tPf)}</td>
                          <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:'700' }}>{fmt(regTotals.tD)}</td>
                          <td style={{ padding:'8px 6px', textAlign:'right', fontWeight:'700' }}>{fmt(regTotals.tN)}</td>
                          <td colSpan={3}/>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  {/* Legend */}
                  <div style={{ display:'flex', gap:'14px', flexWrap:'wrap', fontSize:'11px', color:'#64748b', padding:'8px 14px', borderTop:'.5px solid #e2e8f0' }}>
                    {[['#E6F1FB','#185FA5','Gross'],['#FFFBEB','#C8960C','Admin ded'],['#f5f3ff','#7c3aed','PF'],['#FCEBEB','#A32D2D','Total ded'],['#EAF3DE','#3B6D11','Net salary'],['#f0fdf4','#16a34a','Paid row']].map(l=>(
                      <span key={l[2]}><span style={{ width:'10px', height:'10px', borderRadius:'2px', display:'inline-block', marginRight:'4px', verticalAlign:'middle', background:l[0], border:`.5px solid ${l[1]}` }}/>{l[2]}</span>
                    ))}
                  </div>
                </div>
              )
          }
        </>
      )}

      {/* ══ TAB: PENDING ══ */}
      {activeTab==='pending' && (
        <>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
            <h2 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>⏳ Pending Payments</h2>
            <input type="month" value={regMonth} onChange={e=>setRegMonth(e.target.value)}
              style={{ padding:'6px 10px', borderRadius:'6px', border:'1px solid #d1d5db', fontSize:'13px', flex: isMobile ? 1 : 'none' }} />
          </div>
          <PendingDashboard staff={staff} salaryRows={salaryRows} regMonth={regMonth} onMarkPaid={handleMarkPaid} dedMap={dedMap} isMobile={isMobile} />
        </>
      )}

      {/* ══ TAB: ADVANCES ══ */}
      {activeTab==='advances' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'8px' }}>
            <div>
              <h2 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>💳 Advance Salary</h2>
              {!isMobile && <p style={{ fontSize:'13px', color:'#64748b', margin:'4px 0 0' }}>Auto-deducted when saving salary register</p>}
            </div>
            <button onClick={()=>setShowAdvForm(!showAdvForm)} style={S.btn()}>{showAdvForm?'✖ Cancel':'➕ Issue Advance'}</button>
          </div>

          {showAdvForm && (
            <div style={isMobile ? S.cardMob : S.card}>
              <h3 style={{ fontSize:'14px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>Issue New Advance</h3>
              <form onSubmit={handleAddAdvance}>
                <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap:'12px', marginBottom:'14px' }}>
                  <div>
                    <label style={S.lbl}>Staff Member</label>
                    <select value={advForm.staff_id} onChange={e=>setAdvForm({...advForm,staff_id:e.target.value})} required style={{ ...S.inp, background:'white' }}>
                      <option value="">— Select —</option>
                      {staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={S.lbl}>Amount (₹)</label>
                    <input type="number" min="1" required value={advForm.amount} onChange={e=>setAdvForm({...advForm,amount:e.target.value})} style={S.inp}/>
                  </div>
                  <div>
                    <label style={S.lbl}>Issued Month</label>
                    <input type="month" value={advForm.issued_month} onChange={e=>setAdvForm({...advForm,issued_month:e.target.value})} style={S.inp}/>
                  </div>
                  <div>
                    <label style={S.lbl}>Repay Over (months)</label>
                    <input type="number" min="1" max="24" value={advForm.repay_months} onChange={e=>setAdvForm({...advForm,repay_months:e.target.value})} style={S.inp}/>
                    {advForm.amount&&Number(advForm.repay_months)>1&&<div style={{ fontSize:'12px', color:'#7c3aed', marginTop:'4px', fontWeight:'600' }}>≈ {fmt(Math.ceil(Number(advForm.amount)/Number(advForm.repay_months)))} / month</div>}
                  </div>
                  <div style={{ gridColumn: isMobile ? 'auto' : 'span 2' }}>
                    <label style={S.lbl}>Reason</label>
                    <input value={advForm.reason} onChange={e=>setAdvForm({...advForm,reason:e.target.value})} placeholder="Medical / Festival / Personal..." style={S.inp}/>
                  </div>
                </div>
                <button type="submit" disabled={advSaving} style={S.btn('#7c3aed',advSaving)}>{advSaving?'⏳ Saving...':'💳 Issue Advance'}</button>
              </form>
            </div>
          )}

          {/* Advance summary cards */}
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap:'10px', marginBottom:'16px' }}>
            {[
              { label:'Active Advances', value:advances.filter(a=>a.status==='Active').length, color:'#f59e0b', bg:'#fef3c7', icon:'💳', money:false },
              { label:'Total Advanced', value:advances.reduce((s,a)=>s+Number(a.amount),0), color:'#0C447C', bg:'#E6F1FB', icon:'💰', money:true },
              { label:'Outstanding', value:totalAdvOut, color:'#dc2626', bg:'#fee2e2', icon:'⚠️', money:true },
            ].map(c=>(
              <div key={c.label} style={S.statCard(c.color, c.bg)}>
                <div style={{ fontSize:'18px', marginBottom:'2px' }}>{c.icon}</div>
                <p style={{ fontSize:'12px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
                <h2 style={{ fontSize:'20px', fontWeight:'bold', color:c.color, margin:'2px 0 0' }}>{c.money?fmt(c.value):c.value}</h2>
              </div>
            ))}
          </div>

          {/* Advances list — cards on mobile, table on desktop */}
          {isMobile ? (
            <div>
              {advances.map((a,i) => {
                const s=staff.find(x=>String(x.id)===String(a.staff_id))
                const rem=Number(a.amount)-Number(a.repaid_amount), pm=Number(a.repay_months)>0?Math.ceil(rem/Number(a.repay_months)):rem
                const pct2=Math.min(100,Math.round((Number(a.repaid_amount)/Number(a.amount))*100))
                return (
                  <div key={a.id} style={{ ...S.cardMob, border:'1px solid #e2e8f0', borderLeft:`4px solid ${a.status==='Active'?'#f59e0b':'#16a34a'}` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                      <div>
                        <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>{s?.name||'—'}</div>
                        <div style={{ fontSize:'11px', color:'#64748b' }}>{a.reason||'—'} · {a.issued_month}</div>
                      </div>
                      <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                        <span style={{ padding:'3px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'600', background:a.status==='Active'?'#fef3c7':'#dcfce7', color:a.status==='Active'?'#b45309':'#16a34a' }}>{a.status}</span>
                        <button onClick={()=>handleDeleteAdvance(a.id)} style={S.btnSm('#dc2626')}>🗑</button>
                      </div>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', marginBottom:'8px' }}>
                      {[['Amount',fmt(a.amount),'#1e293b'],['Repaid',fmt(a.repaid_amount),'#16a34a'],['Remaining',fmt(rem),rem>0?'#dc2626':'#16a34a']].map(([l,v,c])=>(
                        <div key={l} style={{ textAlign:'center', background:'#f8fafc', borderRadius:'6px', padding:'5px' }}>
                          <div style={{ fontSize:'10px', color:'#64748b' }}>{l}</div>
                          <div style={{ fontSize:'13px', fontWeight:'700', color:c }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ height:'6px', background:'#e2e8f0', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct2}%`, background:'#16a34a', transition:'width 0.3s' }}/>
                    </div>
                    <div style={{ fontSize:'11px', color:'#64748b', marginTop:'4px' }}>
                      {rem>0 ? `≈ ${fmt(Math.min(pm,rem))} / month · ${a.repay_months} mo total` : 'Fully repaid'}
                    </div>
                  </div>
                )
              })}
              {advances.length===0 && <div style={{ textAlign:'center', padding:'32px', color:'#94a3b8' }}>No advance records</div>}
            </div>
          ) : (
            <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                    {['#','Staff','Amount','Repaid','Remaining','Per Month','Issued','Over','Reason','Status',''].map(h=>(
                      <th key={h} style={{ padding:'11px 12px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advances.map((a,i) => {
                    const s=staff.find(x=>String(x.id)===String(a.staff_id))
                    const rem=Number(a.amount)-Number(a.repaid_amount), pm=Number(a.repay_months)>0?Math.ceil(rem/Number(a.repay_months)):rem
                    const pct2=Math.min(100,Math.round((Number(a.repaid_amount)/Number(a.amount))*100))
                    return (
                      <tr key={a.id} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'10px 12px', color:'#94a3b8' }}>{i+1}</td>
                        <td style={{ padding:'10px 12px', fontWeight:'600', color:'#1e293b' }}>{s?.name||'—'}</td>
                        <td style={{ padding:'10px 12px', fontWeight:'700' }}>{fmt(a.amount)}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <div style={{ color:'#16a34a', fontWeight:'600' }}>{fmt(a.repaid_amount)}</div>
                          <div style={{ marginTop:'4px', height:'4px', background:'#e2e8f0', borderRadius:'2px', overflow:'hidden', width:'60px' }}>
                            <div style={{ height:'100%', width:`${pct2}%`, background:'#16a34a' }}/>
                          </div>
                        </td>
                        <td style={{ padding:'10px 12px', fontWeight:'700', color:rem>0?'#dc2626':'#16a34a' }}>{fmt(rem)}</td>
                        <td style={{ padding:'10px 12px', color:'#7c3aed', fontWeight:'600' }}>{rem>0?fmt(Math.min(pm,rem)):'—'}</td>
                        <td style={{ padding:'10px 12px', color:'#64748b' }}>{a.issued_month}</td>
                        <td style={{ padding:'10px 12px', color:'#64748b' }}>{a.repay_months} mo</td>
                        <td style={{ padding:'10px 12px', color:'#64748b', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.reason||'—'}</td>
                        <td style={{ padding:'10px 12px' }}>
                          <span style={{ padding:'3px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'600', background:a.status==='Active'?'#fef3c7':'#dcfce7', color:a.status==='Active'?'#b45309':'#16a34a' }}>{a.status}</span>
                        </td>
                        <td style={{ padding:'10px 12px' }}>
                          <button onClick={()=>handleDeleteAdvance(a.id)} style={S.btnSm('#dc2626')}>🗑</button>
                        </td>
                      </tr>
                    )
                  })}
                  {advances.length===0 && <tr><td colSpan={11} style={{ padding:'32px', textAlign:'center', color:'#94a3b8' }}>No advance records</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ══ TAB: HISTORY ══ */}
      {activeTab==='history' && (
        <>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'10px' }}>
            <h2 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📅 Salary History</h2>
            <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap', flex: isMobile ? '1 1 100%' : 'none' }}>
              <select value={histStaffId} onChange={e=>setHistStaffId(e.target.value)}
                style={{ ...S.inpSm, flex:1, minWidth:'0' }}>
                <option value="">— Select Staff —</option>
                {staff.map(s=><option key={s.id} value={s.id}>{s.name} ({s.designation||s.department})</option>)}
              </select>
              {histStaffId && (
                <input type="month" value={compareMonth} onChange={e=>setCompareMonth(e.target.value)}
                  style={{ ...S.inpSm, flex:1, minWidth:'0' }} placeholder="Compare month" />
              )}
            </div>
          </div>

          {histStaffId && historyData.length>0 && (
            <>
              {/* Quick stats — 2 cols on mobile */}
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
                {[
                  { label:'Records', value:historyData.length, color:'#1e3a5f', bg:'#eff6ff', icon:'📋', money:false },
                  { label:'Total Earned', value:historyData.reduce((a,r)=>a+(r.net_salary||0),0), color:'#16a34a', bg:'#dcfce7', icon:'💰', money:true },
                  { label:'Avg Monthly', value:Math.round(historyData.reduce((a,r)=>a+(r.net_salary||0),0)/historyData.length), color:'#7c3aed', bg:'#f3e8ff', icon:'📊', money:true },
                  { label:'Highest Month', value:Math.max(...historyData.map(r=>r.net_salary||0)), color:'#ca8a04', bg:'#fef9c3', icon:'🏆', money:true },
                ].map(c=>(
                  <div key={c.label} style={S.statCard(c.color, c.bg)}>
                    <div style={{ fontSize:'16px', marginBottom:'2px' }}>{c.icon}</div>
                    <p style={{ fontSize:'11px', color:c.color, fontWeight:'600', margin:0 }}>{c.label}</p>
                    <h2 style={{ fontSize: isMobile ? '15px' : '19px', fontWeight:'bold', color:c.color, margin:'2px 0 0' }}>{c.money?fmt(c.value):c.value}</h2>
                  </div>
                ))}
              </div>

              {/* Trend chart */}
              <div style={isMobile ? S.cardMob : S.card}>
                <h3 style={{ fontSize:'13px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>Net Salary Trend</h3>
                <div style={{ overflowX:'auto' }}>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:'6px', height:'110px', minWidth: isMobile ? `${historyData.length*52}px` : 'auto' }}>
                    {[...historyData].reverse().map(r => {
                      const maxNet=Math.max(...historyData.map(x=>x.net_salary))
                      const h=Math.max(16,(r.net_salary/maxNet)*100)
                      const isCmp=compareMonth&&r.month===compareMonth
                      return (
                        <div key={r.month} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'3px', minWidth:'44px' }}>
                          <div style={{ fontSize:'9px', fontWeight:'700', color:'#1e3a5f', textAlign:'center' }}>{fmt(r.net_salary)}</div>
                          <div style={{ width:'100%', height:`${h}px`, background:isCmp?'#f59e0b':r.status==='Paid'?'#1e3a5f':'#94a3b8', borderRadius:'4px 4px 0 0' }} title={r.month}/>
                          <div style={{ fontSize:'9px', color:'#94a3b8' }}>{r.month.slice(5)}/{r.month.slice(2,4)}</div>
                          {isCmp && <div style={{ fontSize:'9px', color:'#f59e0b', fontWeight:'700' }}>★</div>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* YoY comparison */}
              {compareMonth && (() => {
                const cmpRow=historyData.find(r=>r.month===compareMonth)
                const [cy,cm2]=compareMonth.split('-').map(Number)
                const prevYear=`${cy-1}-${String(cm2).padStart(2,'0')}`
                const prevRow=historyData.find(r=>r.month===prevYear)
                if (!cmpRow) return null
                return (
                  <div style={isMobile ? S.cardMob : S.card}>
                    <h3 style={{ fontSize:'13px', fontWeight:'700', color:'#1e3a5f', marginTop:0 }}>📊 YoY: {fmtMonth(compareMonth)} vs {fmtMonth(prevYear)}</h3>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                      {[['This Year',cmpRow],['Last Year',prevRow]].map(([label,row])=>(
                        <div key={label} style={{ padding:'12px', border:'1px solid #e2e8f0', borderRadius:'8px', background:row?'white':'#f8fafc' }}>
                          <div style={{ fontWeight:'700', color:'#1e3a5f', marginBottom:'10px', fontSize:'13px' }}>{label} — {row?fmtMonth(row.month):'No data'}</div>
                          {row ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:'5px', fontSize:'12px' }}>
                              {[['Gross',((row.basic_salary||0)+(row.seniority_allowance||0)+(row.loyalty_bonus||0)+(row.role_bonus||0)),'#0C447C'],['Deductions',((row.advance_deduction||0)+(row.late_deduction||0)+(row.admin_deduction||0)),'#A32D2D'],['Net',row.net_salary,'#27500A']].map(([l,v,c])=>(
                                <div key={l} style={{ display:'flex', justifyContent:'space-between' }}>
                                  <span style={{ color:'#64748b' }}>{l}</span>
                                  <span style={{ fontWeight:'700', color:c }}>{fmt(v)}</span>
                                </div>
                              ))}
                              <div style={{ marginTop:'4px' }}>
                                <span style={S.badge(row.status==='Paid'?'#16a34a':'#dc2626',row.status==='Paid'?'#dcfce7':'#fee2e2')}>{row.status}</span>
                              </div>
                            </div>
                          ) : <div style={{ color:'#94a3b8', fontSize:'12px' }}>No record for this period</div>}
                        </div>
                      ))}
                    </div>
                    {prevRow&&cmpRow && (
                      <div style={{ marginTop:'10px', padding:'10px 12px', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', fontSize:'12px' }}>
                        <span style={{ color:'#374151' }}>Net change: </span>
                        <span style={{ fontWeight:'800', color:(cmpRow.net_salary-prevRow.net_salary)>=0?'#16a34a':'#dc2626', fontSize:'15px' }}>
                          {(cmpRow.net_salary-prevRow.net_salary)>=0?'+':''}{fmt(cmpRow.net_salary-prevRow.net_salary)}
                        </span>
                        <span style={{ color:'#64748b', marginLeft:'8px' }}>({Math.round(((cmpRow.net_salary-prevRow.net_salary)/prevRow.net_salary)*100)}%)</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* History — cards on mobile, table on desktop */}
              {isMobile ? (
                <div>
                  {historyData.map(r => {
                    const s=staff.find(x=>String(x.id)===String(r.staff_id))
                    const g=(r.basic_salary||0)+(r.seniority_allowance||0)+(r.loyalty_bonus||0)+(r.role_bonus||0)
                    const dedR={ advance_deduction:r.advance_deduction, late_deduction:r.late_deduction, admin_deduction:r.admin_deduction, pf_deduction:r.pf_deduction, payment_mode:r.payment_mode }
                    const sForSlip=s?{...s,basic_salary:r.basic_salary,seniority_allowance:r.seniority_allowance,loyalty_bonus:r.loyalty_bonus,role_bonus:r.role_bonus,_dedOverride:dedR,_monthOverride:r.month}:null
                    const isCmp=compareMonth&&r.month===compareMonth
                    return (
                      <div key={r.id} style={{ ...S.cardMob, border:`1px solid ${isCmp?'#f59e0b':'#e2e8f0'}`, background: isCmp ? '#fefce8' : 'white', borderLeft:`4px solid ${r.status==='Paid'?'#16a34a':'#dc2626'}` }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                          <div style={{ fontWeight:'700', color:'#1e293b', fontSize:'13px' }}>
                            {r.month} {isCmp && <span style={S.badge('#f59e0b','#fef9c3')}>★ Compare</span>}
                          </div>
                          <span style={{ padding:'3px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'600', background:r.status==='Paid'?'#dcfce7':'#fee2e2', color:r.status==='Paid'?'#16a34a':'#dc2626' }}>{r.status}</span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px', marginBottom:'8px' }}>
                          {[['Gross',g,'#0C447C'],['Net',r.net_salary,'#27500A'],['Via',r.payment_mode||'—','#64748b']].map(([l,v,c])=>(
                            <div key={l} style={{ textAlign:'center', background:'#f8fafc', borderRadius:'6px', padding:'5px' }}>
                              <div style={{ fontSize:'10px', color:'#64748b' }}>{l}</div>
                              <div style={{ fontSize:'12px', fontWeight:'700', color:c }}>{typeof v === 'number' ? fmt(v) : v}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:'flex', gap:'6px' }}>
                          {sForSlip && <button onClick={()=>setSlipStaff(sForSlip)} style={{ ...S.btnSm('#1e3a5f'), flex:1 }}>🧾 Slip</button>}
                          {r.status!=='Paid' && <button onClick={()=>handleMarkPaid(r.id,r.payment_mode)} style={{ ...S.btnSm('#16a34a'), flex:1 }}>✅ Mark Paid</button>}
                          <button onClick={()=>handleDeleteSalary(r.id)} style={S.btnSm('#dc2626')}>🗑</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div style={{ ...S.card, padding:0, overflow:'hidden' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                    <thead>
                      <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                        {['Month','Basic','Seniority','Loyalty','Role','Gross','Adv Ded','Late','Admin','PF','Net','Pay Mode','Status','Actions'].map(h=>(
                          <th key={h} style={{ padding:'11px 10px', textAlign:'left', fontWeight:'600', color:'#374151', fontSize:'12px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map(r => {
                        const s=staff.find(x=>String(x.id)===String(r.staff_id))
                        const g=(r.basic_salary||0)+(r.seniority_allowance||0)+(r.loyalty_bonus||0)+(r.role_bonus||0)
                        const dedR={ advance_deduction:r.advance_deduction, late_deduction:r.late_deduction, admin_deduction:r.admin_deduction, pf_deduction:r.pf_deduction, payment_mode:r.payment_mode }
                        const sForSlip=s?{...s,basic_salary:r.basic_salary,seniority_allowance:r.seniority_allowance,loyalty_bonus:r.loyalty_bonus,role_bonus:r.role_bonus,_dedOverride:dedR,_monthOverride:r.month}:null
                        const isCmp=compareMonth&&r.month===compareMonth
                        return (
                          <tr key={r.id} style={{ borderBottom:'1px solid #f1f5f9', background:isCmp?'#fefce8':'white' }}>
                            <td style={{ padding:'10px', fontWeight:'600', color:'#1e293b' }}>{r.month}{isCmp&&<span style={{ ...S.badge('#f59e0b','#fef9c3'), marginLeft:'6px' }}>★</span>}</td>
                            <td style={{ padding:'10px' }}>{fmt(r.basic_salary)}</td>
                            <td style={{ padding:'10px', color:'#64748b' }}>{fmt(r.seniority_allowance)}</td>
                            <td style={{ padding:'10px', color:'#64748b' }}>{fmt(r.loyalty_bonus)}</td>
                            <td style={{ padding:'10px', color:'#64748b' }}>{fmt(r.role_bonus)}</td>
                            <td style={{ padding:'10px', color:'#0C447C', fontWeight:'700', background:'#E6F1FB' }}>{fmt(g)}</td>
                            <td style={{ padding:'10px', color:'#f59e0b', fontWeight:'600' }}>{fmt(r.advance_deduction)}</td>
                            <td style={{ padding:'10px', color:'#dc2626', fontWeight:'600' }}>{fmt(r.late_deduction)}</td>
                            <td style={{ padding:'10px', color:'#B8860B', fontWeight:'600' }}>{fmt(r.admin_deduction)}</td>
                            <td style={{ padding:'10px', color:'#7c3aed', fontWeight:'600' }}>{fmt(r.pf_deduction||0)}</td>
                            <td style={{ padding:'10px', fontWeight:'800', color:'#27500A', fontSize:'14px', background:'#EAF3DE' }}>{fmt(r.net_salary)}</td>
                            <td style={{ padding:'10px', color:'#64748b' }}>{r.payment_mode||'—'}</td>
                            <td style={{ padding:'10px' }}>
                              <span style={{ padding:'3px 8px', borderRadius:'999px', fontSize:'11px', fontWeight:'600', background:r.status==='Paid'?'#dcfce7':'#fee2e2', color:r.status==='Paid'?'#16a34a':'#dc2626' }}>{r.status}</span>
                            </td>
                            <td style={{ padding:'10px' }}>
                              <div style={{ display:'flex', gap:'4px' }}>
                                {sForSlip&&<button onClick={()=>setSlipStaff(sForSlip)} style={S.btnSm('#1e3a5f')}>🧾</button>}
                                {r.status!=='Paid'&&<button onClick={()=>handleMarkPaid(r.id,r.payment_mode)} style={S.btnSm('#16a34a')}>✅</button>}
                                <button onClick={()=>handleDeleteSalary(r.id)} style={S.btnSm('#dc2626')}>🗑</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          {histStaffId&&historyData.length===0&&<div style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}>No salary records for this staff member.</div>}
          {!histStaffId&&<div style={{ textAlign:'center', padding:'48px', color:'#94a3b8' }}>Select a staff member to view their salary history.</div>}
        </>
      )}

      {/* ══ TAB: ANNUAL SUMMARY ══ */}
      {activeTab==='annual' && (
        <>
          <div style={{ marginBottom:'16px' }}>
            <h2 style={{ fontSize: isMobile ? '15px' : '17px', fontWeight:'700', color:'#1e3a5f', margin:0 }}>📆 Annual Summary</h2>
            {!isMobile && <p style={{ fontSize:'13px', color:'#64748b', margin:'4px 0 0' }}>Financial year overview · Month-by-month trend · Staff totals</p>}
          </div>
          <AnnualSummary staff={staff} salaryRows={salaryRows} isMobile={isMobile} />
        </>
      )}

      {/* Slip Modal */}
      {slipStaff && (
        <SlipModal s={slipStaff} ded={slipStaff._dedOverride||dedMap[slipStaff.id]} month={slipStaff._monthOverride||regMonth} onClose={()=>setSlipStaff(null)} />
      )}
    </div>
  )
}
import { useState, useEffect, useCallback } from 'react'
import {
  loadCols, saveCol, loadAsgns, loadFeeConf, saveFeeConf,
  fmtINR, todayStr, monthsSince, calcFee,calcKPI, MONTHS,
} from './feesData'
import './fees.css'

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6)
const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'

const PAY_TYPES = [
  { id:'monthly',   label:'Monthly Fee',  color:'#1433a8' },
  { id:'fullpay',   label:'Full Pay',     color:'#7c3aed' },
  { id:'admission', label:'Admission',    color:'#15803d' },
  { id:'advance',   label:'Advance',      color:'#d97706' },
  { id:'item',      label:'Item Fee',     color:'#0891b2' },
  { id:'manual',    label:'Other',        color:'#475569' },
]
const RECEIPT_PREFIXES = { monthly:'RCP', fullpay:'FPR', admission:'ADM', advance:'ADV', item:'ITM', manual:'MAN' }

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, color, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div style={{position:'fixed',bottom:24,right:24,zIndex:9999,background:color||'#15803d',color:'#fff',
      padding:'12px 20px',borderRadius:10,fontWeight:700,fontSize:13,boxShadow:'0 4px 24px rgba(0,0,0,.2)',
      display:'flex',alignItems:'center',gap:10}}>
      {msg}
      <button onClick={onClose} style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',lineHeight:1}}>×</button>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, color='#1433a8', onClick }) {
  return (
    <div className="fee-kpi-card" onClick={onClick} style={{borderTop:`3px solid ${color}`,cursor:onClick?'pointer':'default'}}>
      <div className="fee-kpi-label">{label}</div>
      <div className="fee-kpi-value" style={{color}}>{value}</div>
      {sub && <div className="fee-kpi-sub">{sub}</div>}
    </div>
  )
}

// ─── Receipt printer ──────────────────────────────────────────────────────────
function printReceipt(col, asgn) {
  const t = window.TENANT || {}
  const typeLabels = {monthly:'Monthly Fee Receipt',fullpay:'Full Payment Receipt',admission:'Admission Fee Receipt',advance:'Advance Fee Receipt',item:'Items Receipt',manual:'Fee Receipt'}
  const label = typeLabels[col.feeType] || 'Fee Receipt'
  const copies = ['OFFICE / STAFF COPY','PARENT / STUDENT COPY'].map(lbl => `
    <div class="half">
      <div class="copy-label">${lbl}</div>
      <div class="rhead">
        <div class="school-name">${esc(t.name||'Guidance Navodaya &amp; Sainik Institute')}</div>
        <div class="school-sub">${esc(t.address||'Khangabok, Thoubal, Manipur')} &bull; Est. ${t.established||'2016'}</div>
        <div class="doc-type">${esc(label)}</div>
        <div class="meta-row"><span>Receipt No <b class="rcpt-no">${esc(col.receiptNo)}</b></span><span>Date <b>${new Date().toLocaleDateString('en-IN')}</b></span></div>
      </div>
      <table class="rtable">
        <tr><td class="lbl">Student</td><td class="val-b">${esc(col.studentName)}</td></tr>
        <tr><td class="lbl">Adm. No.</td><td>${esc(col.admNo||'—')}</td></tr>
        <tr><td class="lbl">Roll/GCC</td><td>${esc(col.rollNo||'—')}</td></tr>
        <tr><td class="lbl">Class</td><td>${esc(col.className||'—')}</td></tr>
        <tr><td class="lbl">For Period</td><td class="val-b">${esc(col.forMonth||col.description||'—')}</td></tr>
        <tr><td class="lbl">Mode</td><td>${esc(col.payMode||'Cash')}${col.txnRef?` (${esc(col.txnRef)})`:''}</td></tr>
        ${col.remark?`<tr><td class="lbl">Remarks</td><td>${esc(col.remark)}</td></tr>`:''}
        <tr class="amt-row"><td>Amount Paid</td><td class="amt">&#8377;${parseInt(col.amountPaid||0).toLocaleString('en-IN')}</td></tr>
      </table>
      <div class="rfooter"><span>Collected by <b>${esc(col.collectedBy||'Admin')}</b></span><span class="auth">GNSI Authorised Receipt</span></div>
    </div>`).join('<hr class="divider">')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
  <style>*{margin:0;padding:0;box-sizing:border-box}body{background:#f0f4fb;font-family:'DM Sans',sans-serif;font-size:12px;color:#1a2040}
  .page{width:210mm;min-height:297mm;margin:20px auto;background:#fff;box-shadow:0 4px 32px rgba(0,0,0,.18)}
  .half{height:148.5mm;padding:8mm 12mm;display:flex;flex-direction:column;gap:6px;overflow:hidden}
  .divider{border:none;border-top:1.5px dashed #8a9fd4;margin:0 12mm}
  .copy-label{font-size:9px;font-weight:700;color:#6474a0;text-align:right}
  .school-name{font-family:'Playfair Display',serif;font-size:16px;font-weight:800;color:#1433a8;text-align:center}
  .school-sub{font-size:9px;color:#6474a0;text-align:center;margin-top:2px}
  .doc-type{font-size:11px;font-weight:700;color:#1433a8;text-align:center;margin-top:4px;text-transform:uppercase;letter-spacing:.06em}
  .meta-row{display:flex;justify-content:space-between;font-size:10px;color:#6474a0;margin-top:5px}
  .rcpt-no{color:#1433a8;font-size:11px}.rhead{border-bottom:1.5px solid #c7d7f5;padding-bottom:6px;margin-bottom:4px}
  .rtable{width:100%;border-collapse:collapse;font-size:11px}.rtable tr:nth-child(even){background:#f0f4fb}
  .rtable td{padding:4px 8px}.lbl{color:#6474a0;width:36%}.val-b{font-weight:700}
  .amt-row{background:#e0e8f9!important}.amt-row td{padding:6px 8px;font-weight:800;font-size:14px}.amt{color:#15803d}
  .rfooter{display:flex;justify-content:space-between;font-size:10px;color:#6474a0;border-top:1px dashed #c7d7f5;padding-top:6px;margin-top:auto}
  .auth{color:#1433a8;font-weight:700}.toolbar{width:210mm;margin:0 auto 10px;display:flex;gap:10px;padding:8px 12mm}
  .toolbar button{padding:8px 18px;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:13px}
  .btn-print{background:#1433a8;color:#fff}.btn-close{background:#f0f4fb;color:#3d4f80}
  @media print{.toolbar{display:none!important}}</style></head>
  <body><div class="toolbar"><button class="btn-print" onclick="window.print()">🖨 Print A4 (2 copies)</button><button class="btn-close" onclick="window.close()">Close</button></div>
  <div class="page">${copies}</div></body></html>`
  const pw = window.open('','_blank','width=794,height=1123')
  if (!pw) { alert('Allow popups for this site'); return }
  pw.document.open(); pw.document.write(html); pw.document.close()
  pw.onload = () => { pw.focus(); pw.print() }
}

// ─── Collect Form ─────────────────────────────────────────────────────────────
function CollectForm({ asgn, onBack, onSaved, toast }) {
  const [payType, setPayType] = useState('monthly')
  const [amount,  setAmount]  = useState('')
  const [desc,    setDesc]    = useState('')
  const [mode,    setMode]    = useState('Cash')
  const [date,    setDate]    = useState(todayStr())
  const [txnRef,  setTxnRef]  = useState('')
  const [remark,  setRemark]  = useState('')

  const cols = loadCols()
  const m    = monthsSince(asgn.enrolledAt)
  const fee  = calcFee(asgn, m)
  const paid = cols.filter(c => c.asgnId === asgn.id).reduce((s,c) => s + parseInt(c.amountPaid||0,10), 0)
  let exp = 0; for (let i=1;i<=m;i++) exp += calcFee(asgn,i).total
  const due = Math.max(0, exp - paid)

  useEffect(() => {
    if (payType==='monthly')   setAmount(String(fee.total))
    else if (payType==='admission') setAmount(String(fee.admFee))
    else if (payType==='fullpay')   setAmount(String(fee.total*12))
    else setAmount('')
  }, [payType])

  function monthOptions() {
    const opts = []
    for (let j=6;j>=0;j--) { const d=new Date(new Date().getFullYear(),new Date().getMonth()-j,1); opts.push(MONTHS[d.getMonth()]+' '+d.getFullYear()) }
    for (let k=1;k<=6;k++) { const d=new Date(new Date().getFullYear(),new Date().getMonth()+k,1); opts.push(MONTHS[d.getMonth()]+' '+d.getFullYear()) }
    return opts
  }

  function handleSave(print) {
    const amt = parseInt(amount,10)
    if (!amt||amt<=0) { toast('Enter a valid amount','#ea580c'); return }
    if (payType==='monthly'&&!desc) { toast('Select a month','#ea580c'); return }
    const col = saveCol(asgn.id, {
      forMonth: payType==='monthly'?desc:payType==='admission'?'Admission':payType==='advance'?`Advance — ${desc}`:desc,
      description:desc, amountPaid:amt, payDate:date, payMode:mode, txnRef, remark, feeType:payType,
    }, RECEIPT_PREFIXES[payType]||'RCP')
    if (!col) return
    toast(`Receipt ${col.receiptNo} saved`, '#15803d')
    if (print) printReceipt(col, asgn)
    onSaved()
  }

  const inp = {width:'100%',border:'1.5px solid #d1d5db',borderRadius:8,padding:'9px 12px',fontSize:13,background:'var(--color-surface,#fff)',color:'var(--color-text,#1a2040)',boxSizing:'border-box'}
  const recentCols = loadCols().filter(c=>c.asgnId===asgn.id).reverse().slice(0,8)

  return (
    <div>
      <button className="fee-back-btn" onClick={onBack}>← Back to Students</button>
      <div className="fee-student-header">
        <div className="fee-avatar fee-avatar-lg">{(asgn.studentName||asgn.name||'?')[0]?.toUpperCase()}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800}}>{asgn.studentName||asgn.name||'Unknown'}</div>
          <div style={{fontSize:12,opacity:.8}}>{asgn.rollNo} {asgn.className} {asgn.admNo?`• Adm ${asgn.admNo}`:''}</div>
        </div>
        <div style={{display:'flex',gap:20}}>
          <div style={{textAlign:'center'}}><div style={{fontSize:11,opacity:.7}}>Paid</div><div style={{fontSize:18,fontWeight:800}}>₹{fmtINR(paid)}</div></div>
          <div style={{textAlign:'center'}}><div style={{fontSize:11,opacity:.7}}>Due</div><div style={{fontSize:18,fontWeight:800,color:due>0?'#fca5a5':'#86efac'}}>₹{fmtINR(due)}</div></div>
        </div>
      </div>

      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
        {PAY_TYPES.map(t => { const sel=payType===t.id; return (
          <button key={t.id} onClick={()=>setPayType(t.id)}
            style={{padding:'6px 14px',borderRadius:20,border:sel?'none':'1.5px solid #d1d5db',cursor:'pointer',fontWeight:700,fontSize:12,
              background:sel?t.color:'var(--color-surface,#fff)',color:sel?'#fff':'#6b7280',transition:'all .12s'}}>
            {t.label}
          </button>
        )})}
      </div>

      {due>0&&payType==='monthly'&&<div style={{background:'#fff5f5',border:'1px solid #fca5a5',borderRadius:8,padding:'9px 14px',marginBottom:12,fontSize:12.5,color:'#c0291d',fontWeight:600}}>₹{fmtINR(due)} outstanding</div>}

      <div className="fee-card" style={{padding:18}}>
        <div className="fee-form-grid">
          <div className="fee-form-group">
            <label>{payType==='monthly'?'For Month':payType==='fullpay'?'Months Covered':'Description'}</label>
            {payType==='monthly'
              ? <select value={desc} onChange={e=>setDesc(e.target.value)} style={inp}><option value="">— Select Month —</option>{monthOptions().map(m=><option key={m}>{m}</option>)}</select>
              : <input value={desc} onChange={e=>setDesc(e.target.value)} style={inp} />}
          </div>
          <div className="fee-form-group"><label>Amount (₹)</label><input type="number" value={amount} onChange={e=>setAmount(e.target.value)} min={0} style={inp} /></div>
          <div className="fee-form-group"><label>Payment Mode</label><select value={mode} onChange={e=>setMode(e.target.value)} style={inp}>{['Cash','UPI','Bank Transfer','Cheque','DD','Online Gateway'].map(m=><option key={m}>{m}</option>)}</select></div>
          <div className="fee-form-group"><label>Payment Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={inp} /></div>
          <div className="fee-form-group"><label>Txn Ref No.</label><input value={txnRef} onChange={e=>setTxnRef(e.target.value)} placeholder="UPI ref, cheque no" style={inp} /></div>
          <div className="fee-form-group"><label>Remarks</label><input value={remark} onChange={e=>setRemark(e.target.value)} placeholder="Optional" style={inp} /></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
          <button className="fee-btn fee-btn-primary" style={{flex:1}} onClick={()=>handleSave(true)}>💾 Save &amp; Print Receipt</button>
          <button className="fee-btn" style={{background:'#dcfce7',color:'#15803d',border:'1px solid #86efac'}} onClick={()=>handleSave(false)}>Save Only</button>
          <button className="fee-btn fee-btn-outline" onClick={onBack}>Cancel</button>
        </div>
      </div>

      {recentCols.length>0&&(
        <div className="fee-card" style={{marginTop:12}}>
          <div className="fee-card-head"><span className="fee-card-title">Payment History</span></div>
          <div style={{overflowX:'auto'}}><table className="fee-table"><thead><tr><th>Receipt</th><th>For</th><th>Amount</th><th>Mode</th><th>Date</th><th></th></tr></thead>
            <tbody>{recentCols.map(c=>(
              <tr key={c.id}>
                <td style={{fontFamily:'monospace',fontSize:11,fontWeight:700}}>{c.receiptNo||'—'}</td>
                <td>{c.forMonth||c.description||'—'}</td>
                <td style={{fontWeight:700,color:'#15803d'}}>₹{fmtINR(c.amountPaid)}</td>
                <td><span className="fee-badge" style={{background:'#e0e8f9',color:'#1433a8'}}>{c.payMode||'Cash'}</span></td>
                <td style={{fontSize:12,color:'#6b7280'}}>{c.payDate?fmtDate(c.payDate):'—'}</td>
                <td><button className="fee-btn" style={{background:'#fef9c3',color:'#854d0e',border:'1px solid #fde047',padding:'3px 8px',fontSize:11}} onClick={()=>printReceipt(c,asgn)}>🖨</button></td>
              </tr>
            ))}</tbody>
          </table></div>
        </div>
      )}
    </div>
  )
}

// ─── Collect Tab ──────────────────────────────────────────────────────────────
function CollectTab({ toast }) {
  const [search, setSearch] = useState('')
  const [selId,  setSelId]  = useState(null)
  const [, rerender] = useState(0)
  const refresh = () => rerender(n=>n+1)
  const asgns = loadAsgns()
  const cols  = loadCols()
  const q     = search.toLowerCase()
  const filtered = q ? asgns.filter(a=>(a.studentName||a.name||'').toLowerCase().includes(q)||(a.rollNo||'').toLowerCase().includes(q)||(a.className||'').toLowerCase().includes(q)) : asgns
  const selAsgn = asgns.find(a=>a.id===selId)||null
  if (selAsgn) return <CollectForm asgn={selAsgn} onBack={()=>setSelId(null)} onSaved={()=>{setSelId(null);refresh()}} toast={toast} />
  return (
    <div>
      <div style={{position:'relative',marginBottom:16}}>
        <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:16}}>🔍</span>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student name or GCC number…" autoFocus
          style={{width:'100%',border:'2px solid '+(search?'#1433a8':'#d1d5db'),borderRadius:10,padding:'11px 14px 11px 40px',fontSize:14,boxSizing:'border-box',background:'var(--color-surface,#fff)',color:'var(--color-text,#1a2040)'}} />
        {search&&<button onClick={()=>setSearch('')} style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',fontSize:18,cursor:'pointer',color:'#9ca3af'}}>×</button>}
      </div>
      {asgns.length===0
        ? <div style={{textAlign:'center',padding:'48px 20px',background:'var(--color-surface-2,#f9f8f5)',borderRadius:12,border:'1.5px dashed #d1d5db'}}>
            <div style={{fontSize:40,marginBottom:12}}>👥</div>
            <div style={{fontWeight:800,fontSize:15,marginBottom:6}}>No students in fee system yet</div>
          </div>
        : <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:10}}>
            {(q?filtered:filtered.slice(0,20)).map(a=>{
              const paid=cols.filter(c=>c.asgnId===a.id).reduce((s,c)=>s+parseInt(c.amountPaid||0,10),0)
              const m=monthsSince(a.enrolledAt); let exp=0; for(let i=1;i<=m;i++) exp+=calcFee(a,i).total
              const due=Math.max(0,exp-paid)
              return (
                <div key={a.id} onClick={()=>setSelId(a.id)} className="fee-student-card" style={{borderColor:due>0?'#fca5a5':undefined}}>
                  <div className="fee-avatar" style={{background:due>0?'#dc2626':'#1433a8'}}>{(a.studentName||a.name||'?')[0]?.toUpperCase()}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontWeight:800,fontSize:14}}>{a.studentName||a.name||'Unknown'}</div>
                    <div style={{fontSize:11.5,color:'#6b7280'}}>{a.rollNo||''} {a.className||'—'}</div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    {due>0?<><div style={{fontWeight:800,color:'#dc2626',fontSize:14}}>₹{fmtINR(due)}</div><div style={{fontSize:10,color:'#dc2626'}}>due</div></>:<div style={{fontWeight:700,color:'#15803d',fontSize:13}}>Clear ✓</div>}
                  </div>
                </div>
              )
            })}
            {!q&&asgns.length>20&&<div style={{textAlign:'center',gridColumn:'1/-1',fontSize:12.5,color:'#6b7280',padding:12}}>Showing 20 of {asgns.length} — search to find more</div>}
          </div>
      }
    </div>
  )
}

// ─── Dues Tab ─────────────────────────────────────────────────────────────────
function DuesTab({ onCollect }) {
  const asgns=loadAsgns(), cols=loadCols()
  const dues=asgns.map(a=>{
    const paid=cols.filter(c=>c.asgnId===a.id).reduce((s,c)=>s+parseInt(c.amountPaid||0,10),0)
    let exp=0; const m=monthsSince(a.enrolledAt); for(let i=1;i<=m;i++) exp+=calcFee(a,i).total
    return {...a,due:Math.max(0,exp-paid)}
  }).filter(a=>a.due>0).sort((a,b)=>b.due-a.due)
  if (!dues.length) return <div style={{textAlign:'center',padding:'48px 20px',color:'#15803d',fontWeight:800,fontSize:15}}>🎉 No defaulters! All fees up to date.</div>
  return (
    <div>
      <div style={{marginBottom:12,fontWeight:700,fontSize:13,color:'#6b7280'}}>{dues.length} student{dues.length!==1?'s':''} with outstanding dues</div>
      {dues.map(a=>(
        <div key={a.id} className="fee-card" style={{padding:'12px 16px',marginBottom:8,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <div className="fee-avatar" style={{background:'#dc2626',flexShrink:0}}>{(a.studentName||a.name||'?')[0]?.toUpperCase()}</div>
          <div style={{flex:1,minWidth:120}}>
            <div style={{fontWeight:800,fontSize:14}}>{a.studentName||a.name}</div>
            <div style={{fontSize:11.5,color:'#6b7280'}}>{a.className||'—'}</div>
          </div>
          <div style={{textAlign:'right'}}><div style={{fontWeight:800,color:'#c0291d',fontSize:16}}>₹{fmtINR(a.due)}</div><div style={{fontSize:11,color:'#6b7280'}}>outstanding</div></div>
          <button className="fee-btn fee-btn-danger" onClick={()=>onCollect(a.id)}>Collect</button>
        </div>
      ))}
    </div>
  )
}

// ─── Receipts Tab ─────────────────────────────────────────────────────────────
function ReceiptsTab() {
  const [search,setSearch]=useState(''), [filter,setFilter]=useState('all')
  const cols=loadCols(), asgns=loadAsgns(), q=search.toLowerCase()
  const shown=cols.filter(c=>{
    const match=!q||(c.studentName||'').toLowerCase().includes(q)||(c.receiptNo||'').toLowerCase().includes(q)
    return match&&(filter==='all'||c.feeType===filter)
  }).reverse()
  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search student or receipt…"
          style={{flex:1,minWidth:180,border:'1.5px solid #d1d5db',borderRadius:9,padding:'9px 12px',fontSize:13,background:'var(--color-surface,#fff)',color:'var(--color-text,#1a2040)'}} />
        <select value={filter} onChange={e=>setFilter(e.target.value)}
          style={{padding:'9px 12px',borderRadius:9,border:'1.5px solid #d1d5db',fontSize:13,background:'var(--color-surface,#fff)',color:'var(--color-text,#1a2040)'}}>
          <option value="all">All Types</option>
          {PAY_TYPES.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>
      <div style={{overflowX:'auto'}}><table className="fee-table">
        <thead><tr><th>Receipt</th><th>Student</th><th>For</th><th>Amount</th><th>Mode</th><th>Date</th><th></th></tr></thead>
        <tbody>
          {shown.length===0&&<tr><td colSpan={7} style={{textAlign:'center',padding:32,color:'#9ca3af'}}>No receipts found</td></tr>}
          {shown.map(c=>{
            const a=asgns.find(x=>x.id===c.asgnId)
            return <tr key={c.id}>
              <td style={{fontFamily:'monospace',fontSize:11,fontWeight:700}}>{c.receiptNo||'—'}</td>
              <td style={{fontWeight:700}}>{c.studentName||'—'}</td>
              <td>{c.forMonth||c.description||'—'}</td>
              <td style={{fontWeight:700,color:'#15803d'}}>₹{fmtINR(c.amountPaid)}</td>
              <td><span className="fee-badge" style={{background:'#e0e8f9',color:'#1433a8'}}>{c.payMode||'Cash'}</span></td>
              <td style={{fontSize:12,color:'#6b7280'}}>{c.payDate?fmtDate(c.payDate):'—'}</td>
              <td><button className="fee-btn" style={{background:'#fef9c3',color:'#854d0e',border:'1px solid #fde047',padding:'3px 10px',fontSize:11}} onClick={()=>printReceipt(c,a)}>🖨 Print</button></td>
            </tr>
          })}
        </tbody>
      </table></div>
    </div>
  )
}

// ─── Fee Structure Editor (EDITABLE) ─────────────────────────────────────────
function FeeStructEditor({ toast }) {
  const [conf, setConf] = useState(() => loadFeeConf())
  const [saved, setSaved] = useState(false)

  function updateAdm(course, val) {
    setConf(c => ({ ...c, admissionFees: c.admissionFees.map(f =>
      f.course === course ? { ...f, amount: parseInt(val,10)||0 } : f
    )}))
  }
  function updateMonthly(id, field, val) {
    setConf(c => ({ ...c, monthlyFees: c.monthlyFees.map(f =>
      f.id === id ? { ...f, [field]: parseInt(val,10)||0 } : f
    )}))
  }
  function handleSave() {
    saveFeeConf(conf)
    setSaved(true)
    toast('Fee structure saved & synced ✓', '#15803d')
    setTimeout(() => setSaved(false), 3000)
  }

  const inp = {width:'100%',border:'1.5px solid #d1d5db',borderRadius:7,padding:'7px 10px',fontSize:13,textAlign:'right',
    background:'var(--color-surface,#fff)',color:'var(--color-text,#1a2040)',fontFamily:"'JetBrains Mono',monospace",fontWeight:700,boxSizing:'border-box',transition:'border-color .15s'}

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14,flexWrap:'wrap',gap:8}}>
        <div style={{fontSize:13,color:'#6b7280'}}>Click any amount to edit — then Save Changes.</div>
        <button className="fee-btn fee-btn-primary" onClick={handleSave} style={{minWidth:130}}>
          {saved ? '✓ Saved!' : '💾 Save Changes'}
        </button>
      </div>
      <div style={{overflowX:'auto'}}><table className="fee-table">
        <thead><tr><th>Course</th><th>Admission Fee (₹)</th><th>Monthly — Boarder (₹)</th><th>Monthly — Day Scholar (₹)</th></tr></thead>
        <tbody>
          {(conf.monthlyFees||[]).map(mf => {
            const af=(conf.admissionFees||[]).find(a=>a.course===mf.course)
            return (
              <tr key={mf.id}>
                <td style={{fontWeight:700,minWidth:120}}>{mf.course}</td>
                <td style={{minWidth:140}}><input type="number" min={0} defaultValue={af?.amount||0} onChange={e=>updateAdm(mf.course,e.target.value)} style={inp} onFocus={e=>e.target.style.borderColor='#1433a8'} onBlur={e=>e.target.style.borderColor='#d1d5db'} /></td>
                <td style={{minWidth:160}}><input type="number" min={0} defaultValue={mf.amount||0} onChange={e=>updateMonthly(mf.id,'amount',e.target.value)} style={{...inp,color:'#15803d'}} onFocus={e=>e.target.style.borderColor='#15803d'} onBlur={e=>e.target.style.borderColor='#d1d5db'} /></td>
                <td style={{minWidth:160}}><input type="number" min={0} defaultValue={mf.hostelAmount||0} onChange={e=>updateMonthly(mf.id,'hostelAmount',e.target.value)} style={{...inp,color:'#1433a8'}} onFocus={e=>e.target.style.borderColor='#1433a8'} onBlur={e=>e.target.style.borderColor='#d1d5db'} /></td>
              </tr>
            )
          })}
        </tbody>
      </table></div>
      <div style={{marginTop:14,padding:'10px 14px',background:'#f0fdf4',border:'1px solid #86efac',borderRadius:8,fontSize:12,color:'#15803d',fontWeight:600}}>
        💡 Changes take effect immediately after saving. All dues, receipts and calculations will use the new amounts.
      </div>
    </div>
  )
}

// ─── Fee Setup Tab ────────────────────────────────────────────────────────────
function FeeSetupTab({ toast }) {
  const [sub,setSub]=useState('groups'), [,rerender]=useState(0), refresh=()=>rerender(n=>n+1)
  const [newGrpName,setNewGrpName]=useState(''), [newGrpAmt,setNewGrpAmt]=useState(''), [newType,setNewType]=useState('')
  const conf=loadFeeConf(), fgs=conf.feeGroups||[], mfts=conf.manualFeeTypes||[]

  function addGroup(){ if(!newGrpName.trim()){toast('Enter a group name','#ea580c');return} conf.feeGroups.push({id:uid(),name:newGrpName.trim(),amount:parseInt(newGrpAmt,10)||0}); saveFeeConf(conf); setNewGrpName(''); setNewGrpAmt(''); refresh(); toast(`"${newGrpName}" added`,'#15803d') }
  function delGroup(id){ if(!window.confirm('Remove this fee group?'))return; conf.feeGroups=conf.feeGroups.filter(g=>g.id!==id); saveFeeConf(conf); refresh(); toast('Removed','#64748b') }
  function addType(){ if(!newType.trim()){toast('Enter a fee type','#ea580c');return} if(conf.manualFeeTypes.includes(newType.trim())){toast('Already exists','#f59e0b');return} conf.manualFeeTypes.push(newType.trim()); saveFeeConf(conf); setNewType(''); refresh(); toast(`"${newType}" added`,'#15803d') }
  function delType(i){ conf.manualFeeTypes.splice(i,1); saveFeeConf(conf); refresh(); toast('Removed','#64748b') }

  const inp={border:'1.5px solid #d1d5db',borderRadius:8,padding:'8px 12px',fontSize:13,background:'var(--color-surface,#fff)',color:'var(--color-text,#1a2040)'}

  return (
    <div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:18,borderBottom:'2px solid #e5e7eb',paddingBottom:10}}>
        {[{id:'groups',label:'Fee Groups'},{id:'types',label:'Manual Fee Types'},{id:'struct',label:'Fee Structure'}].map(t=>(
          <button key={t.id} onClick={()=>setSub(t.id)}
            style={{padding:'7px 16px',borderRadius:8,border:sub===t.id?'none':'1.5px solid #d1d5db',cursor:'pointer',fontWeight:700,fontSize:12,
              background:sub===t.id?'#1433a8':'var(--color-surface,#fff)',color:sub===t.id?'#fff':'#6b7280'}}>
            {t.label}
          </button>
        ))}
      </div>

      {sub==='groups'&&(
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            <input value={newGrpName} onChange={e=>setNewGrpName(e.target.value)} placeholder="Group name (e.g. Science Kit)" style={{...inp,flex:1,minWidth:160}} />
            <input type="number" value={newGrpAmt} onChange={e=>setNewGrpAmt(e.target.value)} placeholder="Amount (₹)" style={{...inp,width:130}} />
            <button className="fee-btn fee-btn-primary" onClick={addGroup}>+ Add Group</button>
          </div>
          {fgs.length===0?<div style={{textAlign:'center',padding:32,color:'#9ca3af',fontSize:13}}>No fee groups yet.</div>:(
            <div style={{overflowX:'auto'}}><table className="fee-table"><thead><tr><th>Name</th><th>Amount</th><th></th></tr></thead>
              <tbody>{fgs.map(g=><tr key={g.id}><td style={{fontWeight:700}}>{g.name}</td><td style={{fontWeight:700,color:'#15803d'}}>₹{fmtINR(g.amount)}</td><td><button className="fee-btn" style={{background:'#fee2e2',color:'#dc2626',border:'1px solid #fca5a5',padding:'3px 10px',fontSize:11}} onClick={()=>delGroup(g.id)}>Remove</button></td></tr>)}</tbody>
            </table></div>
          )}
        </div>
      )}

      {sub==='types'&&(
        <div>
          <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
            <input value={newType} onChange={e=>setNewType(e.target.value)} placeholder="e.g. Library Fine, Tour Fee" style={{...inp,flex:1,minWidth:200}} />
            <button className="fee-btn fee-btn-primary" onClick={addType}>+ Add Type</button>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {mfts.map((t,i)=>(
              <span key={i} style={{display:'inline-flex',alignItems:'center',gap:6,padding:'5px 12px',borderRadius:20,border:'1.5px solid #d1d5db',fontSize:13,background:'var(--color-surface,#fff)'}}>
                {t}<button onClick={()=>delType(i)} style={{background:'none',border:'none',color:'#dc2626',cursor:'pointer',fontSize:14,lineHeight:1}}>×</button>
              </span>
            ))}
          </div>
        </div>
      )}

      {sub==='struct'&&<FeeStructEditor toast={toast} />}
    </div>
  )
}

// ─── Main Fees Page ───────────────────────────────────────────────────────────
export default function FeesPage() {
  const [tab,setTab]=useState('collect'), [kpi,setKpi]=useState(()=>calcKPI()), [toastMsg,setToastMsg]=useState(null), [,rerender]=useState(0)
  const toast=useCallback((msg,color='#15803d')=>setToastMsg({msg,color}),[])
  const WORK_TABS=[{id:'collect',icon:'💳',label:'Collect Fee'},{id:'dues',icon:'⚠️',label:`Dues${kpi.overdue>0?` (${kpi.overdue})`:''}`},{id:'receipts',icon:'🧾',label:'Receipts'}]

  return (
    <div className="fees-page">
      {toastMsg&&<Toast msg={toastMsg.msg} color={toastMsg.color} onClose={()=>setToastMsg(null)} />}
      <div className="fee-page-header">
        <div className="fee-page-eyebrow">GNSI ACCOUNTS</div>
        <div className="fee-page-title">💰 Fee Management</div>
        <div className="fee-page-sub">Collect · Dues · Receipts · Setup</div>
      </div>
      <div className="fee-kpi-strip">
        <KPICard label="Students"  value={kpi.students} color="#1433a8" />
        <KPICard label="Collected" value={`₹${Math.round((kpi.collected||0)/1000)}K`} color="#15803d" />
        <KPICard label="Dues"      value={`₹${Math.round((kpi.due||0)/1000)}K`} sub={kpi.overdue>0?`${kpi.overdue} students`:''} color="#c0291d" onClick={()=>setTab('dues')} />
        <KPICard label="Receipts"  value={kpi.receipts} color="#0891b2" />
      </div>
      <div className="fee-tab-bar">
        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
          {WORK_TABS.map(t=>{const act=tab===t.id,isAlert=t.id==='dues'&&kpi.overdue>0;return(
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{padding:'9px 20px',borderRadius:10,border:act?'none':isAlert?'1.5px solid #fca5a5':'1.5px solid #d1d5db',cursor:'pointer',fontWeight:700,fontSize:13,
                background:act?'#1433a8':isAlert?'#fff5f5':'var(--color-surface,#fff)',color:act?'#fff':isAlert?'#dc2626':'#6b7280',transition:'all .15s'}}>
              {t.icon} {t.label}
            </button>
          )})}
        </div>
        <button onClick={()=>setTab('feesetup')}
          style={{padding:'7px 14px',borderRadius:8,border:tab==='feesetup'?'none':'1.5px dashed #d1d5db',cursor:'pointer',fontWeight:700,fontSize:12,marginLeft:'auto',
            background:tab==='feesetup'?'#475569':'transparent',color:tab==='feesetup'?'#fff':'#6b7280'}}>
          ⚙️ Setup
        </button>
      </div>
      <div className="fee-tab-content">
        {tab==='collect'  && <CollectTab  toast={toast} key="collect" />}
        {tab==='dues'     && <DuesTab     onCollect={id=>{setTab('collect');toast('Select student above','#1433a8')}} key="dues" />}
        {tab==='receipts' && <ReceiptsTab key="receipts" />}
        {tab==='feesetup' && <FeeSetupTab toast={toast} key="feesetup" />}
      </div>
    </div>
  )
}

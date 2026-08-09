import { supabase } from './supabase'
import { useState, useEffect, useMemo } from 'react'
import {
  fmt, today, gccStr, rcptNo,
  collectFee, deleteLegacyFeeRecord,
  upsertAccount,
  printReceipt, sourceRef,
  getFlatFees, getFeeRates, getFlatFeeAmtSync,
  saveStudentFlatFeeOverride, clearFeeRateCache,
  revertFeeCollection, correctFeeCollectionDate,
  COURSE_RATES, FLAT_RATES,
  PAY_MODES, MONTHS_LIST, CURRENT_YEAR,
} from './feeEngine'

// ── Razorpay config ─────────────────────────────────────────────────────────
// Public key only — safe to ship to the browser. The secret key lives ONLY
// on your backend (order creation + webhook signature verification) and
// must never appear in this file or any other client bundle.
// Set VITE_RAZORPAY_KEY_ID in your .env (Vercel: Project Settings → Env Vars).
const RAZORPAY_KEY_ID = import.meta.env?.VITE_RAZORPAY_KEY_ID || ''
// Your backend/serverless endpoints (see razorpay-backend.md for the
// reference implementation). RAZORPAY_CREATE_ORDER_URL creates a Razorpay
// Order server-side; RAZORPAY_VERIFY_URL verifies the checkout signature
// server-side before the browser is trusted to record a "paid" collection.
const RAZORPAY_CREATE_ORDER_URL = import.meta.env?.VITE_RAZORPAY_CREATE_ORDER_URL || '/api/razorpay/create-order'
const RAZORPAY_VERIFY_URL       = import.meta.env?.VITE_RAZORPAY_VERIFY_URL       || '/api/razorpay/verify'

// Lazily injects the Razorpay Checkout script once per page load and
// resolves when it's ready. Safe to call from multiple components/renders —
// subsequent calls reuse the same in-flight/resolved promise.
let _razorpayScriptPromise = null
function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)
  if (_razorpayScriptPromise) return _razorpayScriptPromise
  _razorpayScriptPromise = new Promise(resolve => {
    const existing = document.querySelector('script[data-razorpay-checkout]')
    if (existing) { existing.addEventListener('load', () => resolve(true)); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.dataset.razorpayCheckout = 'true'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
  return _razorpayScriptPromise
}

// ── Pagination-safe fetch — Supabase/PostgREST caps a single .select() at
//    1000 rows by default. Any table that can grow past that (fees,
//    admissions, adm_fee_collections, adm_flat_fees, adm_course_fees) MUST be
//    fetched through this helper or the newest rows silently vanish from the
//    UI once the table crosses the cap — this is exactly what caused the
//    ~₹86K Fees/Accounts mismatch previously, and the July 2026 course-fee
//    row missing from the Fee record modal / Student Ledger tab.
async function fetchAllRows(table, { select = '*', filters = [], orderCol = null, ascending = true } = {}) {
  const PAGE = 1000
  let from = 0
  let all = []
  while (true) {
    let q = supabase.from(table).select(select)
    for (const [col, op, val] of filters) q = q[op](col, val)
    if (orderCol) q = q.order(orderCol, { ascending })
    q = q.range(from, from + PAGE - 1)
    const { data, error } = await q
    if (error) { console.error(`fetchAllRows(${table}) error:`, error.message); break }
    all = all.concat(data || [])
    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return all
}

// ── Responsive hook ───────────────────────────────────────────────────────────
function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

// ── Sync helpers for display/hints only (not used for saving) ─────────────────
const syncCourseFeeAmt = (course, hostelType) => COURSE_RATES[course]?.[hostelType] ?? 0
const syncFlatFeeAmt   = (hostelType) => FLAT_RATES[hostelType] ?? 0

const getSessionYear = () => {
  const yr = new Date().getFullYear()
  return new Date().getMonth() + 1 >= 4 ? `${yr}-${yr + 1}` : `${yr - 1}-${yr}`
}

const DRESS_ITEMS = [
  { id: 'dk1', name: 'Aqua T-Shirt',     price: 450 },
  { id: 'dk2', name: 'Blue T-Shirt',     price: 450 },
  { id: 'dk3', name: 'Track Suit',       price: 900 },
  { id: 'dk4', name: 'Track Pant',       price: 600 },
  { id: 'dk5', name: 'Track Suit Set 2', price: 600 },
]

const COURSE_STRUCTURE = {
  Navodaya:          { subtypes: ['Lakshya', 'Umeed'] },
  Sainik:            { subtypes: ['Achiever', 'Leader', 'Champion'] },
  Foundation:        { subtypes: ['Elite', 'Prime'] },
  'Combined Course': { subtypes: [] },
}

const ADM_FEE_BASE   = 6000
const PROSPECTUS_FEE = 200

// ── Export utilities ──────────────────────────────────────────────────────────
function exportCSV(rows, filename) {
  if (!rows || rows.length === 0) { alert('No data to export.'); return }
  const headers = Object.keys(rows[0])
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const v = row[h] == null ? '' : String(row[h])
      return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v
    }).join(','))
  ].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename + '.csv'; a.click()
  URL.revokeObjectURL(url)
}

function exportJSON(rows, filename) {
  if (!rows || rows.length === 0) { alert('No data to export.'); return }
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a'); a.href = url; a.download = filename + '.json'; a.click()
  URL.revokeObjectURL(url)
}

function ExportBar({ rows, filename, label = '' }) {
  const [open, setOpen] = useState(false)
  if (!rows) return null
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#1e3a5f', color: 'white', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
        ⬇ Export {label && `(${rows.length})`}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.12)', zIndex: 300, minWidth: 160 }}
          onMouseLeave={() => setOpen(false)}>
          <button onClick={() => { exportCSV(rows, filename); setOpen(false) }}
            style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#1e3a5f', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            📄 Export CSV
          </button>
          <button onClick={() => { exportJSON(rows, filename); setOpen(false) }}
            style={{ width: '100%', padding: '10px 16px', border: 'none', background: 'none', textAlign: 'left', fontSize: 13, fontWeight: 600, color: '#059669', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.background='#f1f5f9'}
            onMouseLeave={e => e.currentTarget.style.background='none'}>
            📊 Export JSON
          </button>
        </div>
      )}
    </div>
  )
}

// ── Additional export formats ────────────────────────────────────────────────
const _dl = (blob, name) => { const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u) }
function exportTSV(rows, filename) {
  if (!rows?.length) { alert('No data.'); return }
  const H=Object.keys(rows[0])
  const body=[H.join('\t'),...rows.map(r=>H.map(h=>String(r[h]??'').replace(/\t/g,' ')).join('\t'))].join('\n')
  _dl(new Blob(['\ufeff'+body],{type:'text/tab-separated-values;charset=utf-8'}),filename+'.tsv')
}
function exportXLS(rows, filename, sheetTitle='Report') {
  if (!rows?.length) { alert('No data.'); return }
  const H=Object.keys(rows[0])
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const hdr=H.map(h=>`<th style="background:#1e3a5f;color:white;font-weight:bold;padding:6px 10px;border:1px solid #ccc">${esc(h)}</th>`).join('')
  const bdy=rows.map((r,i)=>{const bg=i%2===0?'#fff':'#f8fafc';return `<tr>${H.map(h=>`<td style="padding:5px 10px;border:1px solid #ddd;background:${bg}">${esc(r[h])}</td>`).join('')}</tr>`}).join('')
  const html=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"/><title>${sheetTitle}</title><style>table{border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px}</style></head><body><h3 style="font-family:Arial;color:#1e3a5f">Guidance Navodaya &amp; Sainik Institute — ${sheetTitle}</h3><table><thead><tr>${hdr}</tr></thead><tbody>${bdy}</tbody></table></body></html>`
  _dl(new Blob(['\ufeff'+html],{type:'application/vnd.ms-excel;charset=utf-8'}),filename+'.xls')
}
function exportPrintHTML(rows, filename, title, meta={}) {
  if (!rows?.length) { alert('No data.'); return }
  const H=Object.keys(rows[0])
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  const hdr=H.map(h=>`<th>${esc(h)}</th>`).join('')
  const bdy=rows.map((r,i)=>`<tr class="${i%2===0?'':'ev'}">${H.map(h=>`<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')
  const metaRows=Object.entries(meta).map(([k,v])=>`<div class="mi"><span class="mk">${esc(k)}</span><span class="mv">${esc(String(v))}</span></div>`).join('')
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${title}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#0f172a;background:white;padding:12mm 14mm}.inst{font-size:18px;font-weight:900;color:#1e3a5f;font-family:Georgia,serif}.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #1e3a5f;padding-bottom:8px;margin-bottom:10px}.rtype{font-size:11px;font-weight:900;color:white;background:#1e3a5f;padding:2px 10px;border-radius:4px;display:inline-block}.rdate{font-size:10px;color:#64748b;display:block;margin-top:3px}.meta{display:flex;gap:20px;flex-wrap:wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:8px 12px;margin-bottom:10px}.mi{display:flex;flex-direction:column}.mk{font-size:8px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.4px}.mv{font-size:11px;font-weight:700;color:#1e3a5f}table{width:100%;border-collapse:collapse;font-size:10.5px}thead tr{background:#1e3a5f;color:white}th{padding:6px 8px;text-align:left;font-weight:700;font-size:10px;white-space:nowrap}tbody tr{border-bottom:1px solid #f1f5f9}tbody tr.ev{background:#f8fafc}td{padding:5px 8px}.foot{margin-top:10px;display:flex;justify-content:space-between;font-size:8.5px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:5px}@media print{body{padding:0}.np{display:none}}@media screen{body{background:#e2e8f0;padding:20px}.wrap{background:white;padding:20mm;box-shadow:0 4px 20px rgba(0,0,0,.12);max-width:297mm;margin:0 auto}.pbtn{position:fixed;top:16px;right:16px;background:#1e3a5f;color:white;border:none;padding:10px 20px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px}.cbtn{position:fixed;top:16px;right:170px;background:#64748b;color:white;border:none;padding:10px 16px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px}}</style></head><body><button class="pbtn np" onclick="window.print()">Print / PDF</button><button class="cbtn np" onclick="window.close()">Close</button><div class="wrap"><div class="hdr"><div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div></div><div><span class="rtype">${esc(title)}</span><span class="rdate">Generated: ${new Date().toLocaleString('en-IN')}</span></div></div><div class="meta">${metaRows}</div><table><thead><tr>${hdr}</tr></thead><tbody>${bdy}</tbody></table><div class="foot"><span>GNSI Portal</span><span>Total records: ${rows.length}</span><span>CONFIDENTIAL</span></div></div></body></html>`
  const win=window.open('','_blank','width=1000,height=700,scrollbars=yes');win.document.write(html);win.document.close()
}


// ── Daily Income Report ───────────────────────────────────────────────────────
const GNSI_INST={name:'Guidance Navodaya & Sainik Institute',tagline:'Premier Coaching for NVS · Sainik School · RMS Entrance Examinations',address:'Khangabok Sorok Wangma, Thoubal District, Manipur – 795 131',website:'guidancekhangabok.in',estd:'2016'}
const _inr=v=>Number(v||0).toLocaleString('en-IN')
const _fdate=s=>{if(!s)return '—';const d=new Date(s+'T00:00:00');return d.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}
const _fday=s=>{if(!s)return '';return new Date(s+'T00:00:00').toLocaleDateString('en-IN',{weekday:'long'})}
function _toWords(n){if(!n||n===0)return 'Zero';const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];const c=x=>{if(x<20)return ones[x];if(x<100)return tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:'');if(x<1000)return ones[Math.floor(x/100)]+' Hundred'+(x%100?' '+c(x%100):'');if(x<100000)return c(Math.floor(x/1000))+' Thousand'+(x%1000?' '+c(x%1000):'');if(x<10000000)return c(Math.floor(x/100000))+' Lakh'+(x%100000?' '+c(x%100000):'');return c(Math.floor(x/10000000))+' Crore'+(x%10000000?' '+c(x%10000000):'')};return c(Math.round(n))+' Only'}
function DailyIncomeReport({date,transactions=[],generatedBy='Admin'}){
  const todayStr=new Date().toLocaleDateString('en-CA'),reportDate=date||todayStr
  const [offlineRcpt,setOfflineRcpt]=useState(''),[reportTitle,setReportTitle]=useState('Daily Income Report')
  const grand=transactions.reduce((s,r)=>s+(Number(r.amount)||0),0)
  const handlePrint=()=>{
    const modes={},courses={};transactions.forEach(r=>{const m=r.pay_mode||'Unspecified';modes[m]=(modes[m]||0)+(Number(r.amount)||0)});transactions.forEach(r=>{const c=r.course||'Unknown';courses[c]=(courses[c]||0)+(Number(r.amount)||0)})
    const byStudent={};transactions.forEach(r=>{const k=String(r.gcc_no||r.name);if(!byStudent[k])byStudent[k]={gcc_no:r.gcc_no,name:r.name,rows:[]};byStudent[k].rows.push(r)})
    const groups=Object.values(byStudent).sort((a,b)=>(a.name||'').localeCompare(b.name||''))
    let tRows='',serial=0
    groups.forEach(sg=>{const sub=sg.rows.reduce((s,r)=>s+(Number(r.amount)||0),0);sg.rows.forEach(r=>{serial++;const tc=r.type==='Admission Fee'?'#3730a3':r.type==='Flat Fee'?'#166534':'#6d28d9',tb=r.type==='Admission Fee'?'#eef2ff':r.type==='Flat Fee'?'#dcfce7':'#f5f3ff';tRows+=`<tr style="background:${serial%2===0?'#f8fafc':'white'}"><td style="padding:5px 8px;text-align:center;font-family:monospace;font-size:10px">${serial}</td><td style="padding:5px 8px;text-align:center;font-family:monospace;font-size:10px;color:#1e3a5f;font-weight:700">${r.gcc_no?'GCC-'+r.gcc_no:'—'}</td><td style="padding:5px 8px;font-weight:700">${r.name||'—'}</td><td style="padding:5px 8px"><span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:9.5px;font-weight:700;background:${tb};color:${tc}">${r.type}</span></td><td style="padding:5px 8px;font-size:10px;color:#64748b">${r.description||'—'}</td><td style="padding:5px 8px;text-align:center">${r.pay_mode||'—'}</td><td style="padding:5px 8px;text-align:center;font-family:monospace;font-size:10px">${r.ref&&r.ref!=='—'?r.ref:'—'}</td><td style="padding:5px 8px;text-align:right;font-weight:800;color:#16a34a">Rs.${_inr(r.amount)}</td></tr>`});if(sg.rows.length>1)tRows+=`<tr style="background:#f1f5f9"><td colspan="7" style="padding:3px 8px;text-align:right;font-size:9.5px;color:#64748b">Sub-total — ${sg.name}</td><td style="padding:3px 8px;text-align:right;font-weight:700;color:#1e3a5f">Rs.${_inr(sub)}</td></tr>`})
    if(!transactions.length)tRows=`<tr><td colspan="8" style="padding:40px;text-align:center;color:#94a3b8;font-style:italic">No transactions recorded.</td></tr>`
    const modeRows=Object.entries(modes).map(([m,a])=>`<tr><td style="padding:5px 8px;font-weight:700">${m}</td><td style="padding:5px 8px;text-align:right;font-weight:700;color:#1e3a5f">Rs.${_inr(a)}</td><td style="padding:5px 8px;text-align:right;font-size:10px;color:#64748b">${grand>0?Math.round(a/grand*100):0}%</td></tr>`).join('')
    const courseRows=Object.entries(courses).map(([c,a])=>`<tr><td style="padding:5px 8px;font-weight:700">${c}</td><td style="padding:5px 8px;text-align:right;font-weight:700;color:#1e3a5f">Rs.${_inr(a)}</td></tr>`).join('')
    const reportNo=`GNSI/DIR/${(reportDate||'').replace(/-/g,'')}`
    const generated=new Date().toLocaleString('en-IN',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'})
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${reportTitle}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#0f172a;background:white}@page{size:A4;margin:12mm 14mm}table{width:100%;border-collapse:collapse}@media screen{body{background:#e2e8f0;padding:20px}.page{background:white;padding:18mm;box-shadow:0 4px 20px rgba(0,0,0,.12);max-width:210mm;margin:0 auto}.pbtn{position:fixed;top:16px;right:16px;background:#1e3a5f;color:white;border:none;padding:10px 20px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px}.cbtn{position:fixed;top:16px;right:170px;background:#64748b;color:white;border:none;padding:10px 16px;border-radius:7px;font-weight:700;cursor:pointer;font-size:13px}}@media print{body{padding:0}.np{display:none!important}tr{page-break-inside:avoid}}</style></head><body><button class="pbtn np" onclick="window.print()">Print / Save PDF</button><button class="cbtn np" onclick="window.close()">Close</button><div class="page"><div style="border-bottom:3px double #1e3a5f;padding-bottom:10px;margin-bottom:10px;display:flex;align-items:center;gap:14px"><div style="width:58px;height:58px;border-radius:50%;background:#1e3a5f;color:white;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0">GNSI</div><div style="flex:1"><div style="font-size:20px;font-weight:900;color:#1e3a5f">Guidance Navodaya &amp; Sainik Institute</div><div style="font-size:9px;color:#b45309;font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-top:2px">Premier Coaching for NVS · Sainik School · RMS</div><div style="font-size:10px;color:#475569;margin-top:2px">Khangabok Sorok Wangma, Thoubal District, Manipur – 795 131</div></div><div style="text-align:right"><span style="font-size:11px;font-weight:900;color:white;background:#1e3a5f;padding:3px 10px;border-radius:4px;display:inline-block">${reportTitle||'Daily Income Report'}</span><div style="font-size:9.5px;color:#64748b;margin-top:3px">Ref: ${reportNo}</div><div style="font-size:11px;font-weight:700;color:#1e3a5f;margin-top:2px">${_fday(reportDate)}, ${_fdate(reportDate)}</div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);border:1.5px solid #1e3a5f;border-radius:6px;overflow:hidden;margin-bottom:10px"><div style="padding:7px 10px;border-right:1px solid #cbd5e1"><div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase">Report Date</div><div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-top:2px">${_fdate(reportDate)}</div></div><div style="padding:7px 10px;border-right:1px solid #cbd5e1"><div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase">Transactions</div><div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-top:2px">${transactions.length}</div></div><div style="padding:7px 10px;border-right:1px solid #cbd5e1"><div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase">Offline Receipt No.</div><div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-top:2px">${offlineRcpt||'—'}</div></div><div style="padding:7px 10px"><div style="font-size:8.5px;font-weight:700;color:#64748b;text-transform:uppercase">Generated By</div><div style="font-size:12px;font-weight:700;color:#1e3a5f;margin-top:2px">${generatedBy||'Admin'}</div></div></div><div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px"><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;border-top:3px solid #1e3a5f"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase">Grand Total</div><div style="font-size:16px;font-weight:900;color:#1e3a5f;margin-top:3px">Rs.${_inr(grand)}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;border-top:3px solid #3730a3"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase">Admission Fees</div><div style="font-size:16px;font-weight:900;color:#3730a3;margin-top:3px">Rs.${_inr(transactions.filter(r=>r.type==='Admission Fee').reduce((s,r)=>s+r.amount,0))}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;border-top:3px solid #166534"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase">Flat Fees</div><div style="font-size:16px;font-weight:900;color:#166534;margin-top:3px">Rs.${_inr(transactions.filter(r=>r.type==='Flat Fee').reduce((s,r)=>s+r.amount,0))}</div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:8px 10px;border-top:3px solid #6d28d9"><div style="font-size:9px;font-weight:700;color:#64748b;text-transform:uppercase">Course Fees</div><div style="font-size:16px;font-weight:900;color:#6d28d9;margin-top:3px">Rs.${_inr(transactions.filter(r=>r.type==='Course Fee').reduce((s,r)=>s+r.amount,0))}</div></div></div><div style="font-size:11px;font-weight:900;color:#1e3a5f;text-transform:uppercase;letter-spacing:.5px;border-left:4px solid #1e3a5f;padding:2px 8px;margin:12px 0 6px;background:#f8fafc">Detailed Transaction Register</div><table><thead><tr style="background:#1e3a5f;color:white"><th style="padding:6px 8px;text-align:center;font-size:10px;width:28px">#</th><th style="padding:6px 8px;font-size:10px;width:72px">GCC No.</th><th style="padding:6px 8px;font-size:10px">Student</th><th style="padding:6px 8px;font-size:10px;width:90px">Fee Type</th><th style="padding:6px 8px;font-size:10px">Description</th><th style="padding:6px 8px;font-size:10px;text-align:center;width:58px">Mode</th><th style="padding:6px 8px;font-size:10px;text-align:center;width:68px">Ref No.</th><th style="padding:6px 8px;font-size:10px;text-align:right;width:78px">Amount</th></tr></thead><tbody>${tRows}</tbody><tfoot><tr style="background:#1e3a5f;color:white"><td colspan="7" style="padding:8px;text-align:right;font-size:11px">TOTAL COLLECTED</td><td style="padding:8px;text-align:right;font-weight:900;font-size:12px">Rs.${_inr(grand)}</td></tr></tfoot></table><div style="border:2px solid #1e3a5f;border-radius:8px;padding:12px 16px;margin:12px 0;background:linear-gradient(135deg,#eff6ff,#f5f3ff);display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:13px;font-weight:800;color:#1e3a5f">Total Income for ${_fdate(reportDate)}</div><div style="font-size:10px;color:#64748b;font-style:italic;margin-top:2px">Rupees ${_toWords(grand)}</div></div><div style="font-size:24px;font-weight:900;color:#1e3a5f">Rs. ${_inr(grand)}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px"><div><div style="font-size:11px;font-weight:900;color:#1e3a5f;text-transform:uppercase;border-left:4px solid #334155;padding:2px 8px;margin-bottom:6px;background:#f8fafc">Collection by Mode</div><table><thead><tr style="background:#334155;color:white"><th style="padding:5px 8px;font-size:10px">Mode</th><th style="padding:5px 8px;font-size:10px;text-align:right">Amount</th><th style="padding:5px 8px;font-size:10px;text-align:right">Share</th></tr></thead><tbody>${modeRows||'<tr><td colspan="3" style="padding:8px;text-align:center;color:#94a3b8">No data</td></tr>'}</tbody><tfoot><tr style="background:#f1f5f9;border-top:1.5px solid #334155"><td style="padding:5px 8px;font-weight:700">Total</td><td style="padding:5px 8px;text-align:right;font-weight:700;color:#1e3a5f">Rs.${_inr(grand)}</td><td style="padding:5px 8px;text-align:right;font-size:10px;color:#64748b">100%</td></tr></tfoot></table></div><div><div style="font-size:11px;font-weight:900;color:#1e3a5f;text-transform:uppercase;border-left:4px solid #334155;padding:2px 8px;margin-bottom:6px;background:#f8fafc">Collection by Course</div><table><thead><tr style="background:#334155;color:white"><th style="padding:5px 8px;font-size:10px">Course</th><th style="padding:5px 8px;font-size:10px;text-align:right">Amount</th></tr></thead><tbody>${courseRows||'<tr><td colspan="2" style="padding:8px;text-align:center;color:#94a3b8">No data</td></tr>'}</tbody><tfoot><tr style="background:#f1f5f9;border-top:1.5px solid #334155"><td style="padding:5px 8px;font-weight:700">Total</td><td style="padding:5px 8px;text-align:right;font-weight:700;color:#1e3a5f">Rs.${_inr(grand)}</td></tr></tfoot></table></div></div><div style="border:1px solid #e2e8f0;border-radius:6px;padding:10px 14px;margin-bottom:14px"><div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;margin-bottom:6px">Remarks / Notes</div><div style="height:36px;border-bottom:1px dashed #cbd5e1;width:100%"></div></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;margin-top:20px;margin-bottom:10px"><div style="text-align:center"><div style="border-top:1.5px solid #1e3a5f;margin:0 auto;width:80%;margin-top:36px;margin-bottom:4px"></div><div style="font-size:11px;font-weight:700;color:#1e3a5f">${generatedBy||'Fee In-Charge'}</div><div style="font-size:9.5px;color:#64748b">Fee In-Charge / Prepared By</div></div><div style="text-align:center"><div style="border-top:1.5px solid #1e3a5f;margin:0 auto;width:80%;margin-top:36px;margin-bottom:4px"></div><div style="font-size:11px;font-weight:700;color:#1e3a5f">Vice Principal</div><div style="font-size:9.5px;color:#64748b">Verified and Checked</div></div><div style="text-align:center"><div style="border-top:1.5px solid #1e3a5f;margin:0 auto;width:80%;margin-top:36px;margin-bottom:4px"></div><div style="font-size:11px;font-weight:700;color:#1e3a5f">Moirangthem Himan Singh</div><div style="font-size:9.5px;color:#64748b">Founder and Administrator</div></div></div><div style="border-top:1px solid #e2e8f0;padding-top:6px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:9px;color:#94a3b8">Generated: ${generated} · GNSI Portal</span><span style="font-size:8.5px;color:#b45309;font-weight:700">Guidance Navodaya &amp; Sainik Institute · Estd. 2016</span><span style="font-size:9px;color:#94a3b8;text-align:right">Ref: ${reportNo}<br>CONFIDENTIAL</span></div></div></body></html>`
    const win=window.open('','_blank','width=960,height=750,scrollbars=yes');win.document.write(html);win.document.close()
  }
  return(
    <div style={{background:'#fffbeb',border:'1.5px solid #fcd34d',borderRadius:12,padding:'16px 20px',marginTop:24}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
        <span style={{fontSize:22}}>🖨️</span>
        <div style={{flex:1}}><div style={{fontSize:14,fontWeight:900,color:'#92400e'}}>Print Daily Income Report</div><div style={{fontSize:11,color:'#b45309',marginTop:2}}>For Vice-Principal &amp; Founder / Administrator · {_fdate(reportDate)}</div></div>
        <div style={{fontSize:13,fontWeight:800,color:'#1e3a5f',background:'#eff6ff',padding:'6px 14px',borderRadius:8,border:'1px solid #bfdbfe'}}>{transactions.length} txns · ₹{_inr(grand)}</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:14}}>
        <div><div style={{fontSize:10,fontWeight:700,color:'#92400e',marginBottom:4,textTransform:'uppercase'}}>Report Title</div><input value={reportTitle} onChange={e=>setReportTitle(e.target.value)} style={{width:'100%',padding:'8px 11px',borderRadius:7,border:'1.5px solid #fcd34d',fontSize:12,fontWeight:600,outline:'none',background:'white',color:'#92400e'}} /></div>
        <div><div style={{fontSize:10,fontWeight:700,color:'#92400e',marginBottom:4,textTransform:'uppercase'}}>Offline Receipt No. <span style={{fontWeight:400}}>(optional)</span></div><input value={offlineRcpt} onChange={e=>setOfflineRcpt(e.target.value)} placeholder="GNSI/RCP/2025-26/001" style={{width:'100%',padding:'8px 11px',borderRadius:7,border:'1.5px solid #fcd34d',fontSize:12,fontWeight:700,outline:'none',background:'white',color:'#1e3a5f',fontFamily:'monospace'}} /></div>
      </div>
      <button onClick={handlePrint} disabled={transactions.length===0} style={{width:'100%',padding:'12px',borderRadius:9,background:transactions.length===0?'#94a3b8':'linear-gradient(135deg,#1e3a5f,#3730a3)',color:'white',border:'none',fontSize:14,fontWeight:800,cursor:transactions.length===0?'not-allowed':'pointer'}}>
        {transactions.length===0?'No transactions — select a date range above':`Print Preview — ₹${_inr(grand)} · ${transactions.length} receipt${transactions.length!==1?'s':''}`}
      </button>
      <div style={{fontSize:10,color:'#92400e',marginTop:8,textAlign:'center',opacity:.75}}>Opens in new tab · Ctrl+P to save as PDF</div>
    </div>
  )
}


// ── Anomaly Monitor ───────────────────────────────────────────────────────────
const SEV_COLOR={CRITICAL:{bg:'#fef2f2',border:'#fca5a5',text:'#dc2626',badge:'#dc2626'},HIGH:{bg:'#fff7ed',border:'#fed7aa',text:'#ea580c',badge:'#ea580c'},MEDIUM:{bg:'#fffbeb',border:'#fde68a',text:'#d97706',badge:'#d97706'},LOW:{bg:'#f0fdf4',border:'#bbf7d0',text:'#16a34a',badge:'#16a34a'}}
const SEV_ICON={CRITICAL:'🔴',HIGH:'🟠',MEDIUM:'🟡',LOW:'🟢'}
function runAnomalyEngine({adm_fee_collections,adm_flat_fees,adm_course_fees,students,liveRows}){
  const flags=[],push=(id,sev,cat,title,detail,records=[])=>flags.push({id,sev,cat,title,detail,records})
  const now=new Date(),todayStr=now.toLocaleDateString('en-CA'),thisMonth=now.toLocaleString('default',{month:'long'}),thisYearStr=String(now.getFullYear())
  // Tag every row with which table it actually came from BEFORE merging
  // arrays together below, so full-detail lookups can always resolve the
  // exact source table + id for an "Investigate" panel — several anomaly
  // types merge all three fee tables into one filtered list, and once
  // merged there's no other way to tell them apart.
  const flatTagged=adm_flat_fees.map(r=>({...r,_table:'adm_flat_fees'}))
  const crsfTagged=adm_course_fees.map(r=>({...r,_table:'adm_course_fees'}))
  const admTagged=adm_fee_collections.map(r=>({...r,_table:'adm_fee_collections'}))
  const allTagged=[...flatTagged,...crsfTagged,...admTagged]
  const flatKey={};adm_flat_fees.forEach(r=>{const k=`${r.adm_app_id}|${r.month}|${r.year}`;if(!flatKey[k])flatKey[k]=[];flatKey[k].push(r)})
  Object.entries(flatKey).filter(([,v])=>v.length>1).forEach(([,recs])=>{const stu=students.find(s=>String(s.gcc_no)===String(recs[0].adm_app_id));push('dup_flat_'+recs[0].adm_app_id+'_'+recs[0].month,'CRITICAL','Duplicate',`Duplicate flat fee: ${recs[0].month} ${recs[0].year}`,`${stu?.name||'GCC-'+recs[0].adm_app_id} has ${recs.length} flat fee entries for the same month.`,recs.map(r=>({label:`₹${_inr(r.amount)} on ${r.pay_date||'?'} via ${r.pay_mode||'?'}`,raw:r,_table:'adm_flat_fees'})))})
  const crsfKey={};adm_course_fees.forEach(r=>{const k=`${r.adm_app_id}|${r.for_month}|${r.year}|${r.course}`;if(!crsfKey[k])crsfKey[k]=[];crsfKey[k].push(r)})
  Object.entries(crsfKey).filter(([,v])=>v.length>1).forEach(([,recs])=>{const stu=students.find(s=>String(s.gcc_no)===String(recs[0].adm_app_id));push('dup_crsf_'+recs[0].adm_app_id+'_'+recs[0].for_month,'CRITICAL','Duplicate',`Duplicate course fee: ${recs[0].course} ${recs[0].for_month}`,`${stu?.name||'GCC-'+recs[0].adm_app_id} has ${recs.length} course fee entries for same month.`,recs.map(r=>({label:`₹${_inr(r.amount_paid)} on ${r.pay_date||'?'} via ${r.pay_mode||'?'}`,raw:r,_table:'adm_course_fees'})))})
  const admByGCC={};adm_fee_collections.filter(r=>r.fee_type==='admission'&&!r.reverted).forEach(r=>{const g=String(r.adm_app_id);if(!admByGCC[g])admByGCC[g]=[];admByGCC[g].push(r)})
  Object.entries(admByGCC).filter(([,v])=>v.length>1).forEach(([g,recs])=>{const stu=students.find(s=>String(s.gcc_no)===g);push('dup_adm_'+g,'CRITICAL','Duplicate',`Double admission fee: ${stu?.name||'GCC-'+g}`,`${stu?.name||'GCC-'+g} has ${recs.length} admission fee records. Total: ₹${_inr(recs.reduce((s,r)=>s+(Number(r.amount_paid)||0),0))}.`,recs.map(r=>({label:`₹${_inr(r.amount_paid)} on ${r.pay_date||'?'} via ${r.pay_mode||'?'}`,raw:r,_table:'adm_fee_collections'})))})
  const futureAll=allTagged.filter(r=>r.pay_date>todayStr)
  if(futureAll.length>0)push('future_date','CRITICAL','Date',`${futureAll.length} future-dated payment${futureAll.length!==1?'s':''}`,`${futureAll.length} record${futureAll.length!==1?'s':''} have payment dates after today (${todayStr}).`,futureAll.map(r=>{const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id));return{label:`${stu?.name||'GCC-'+r.adm_app_id} · ₹${_inr(r.amount||r.amount_paid||0)} · ${r.pay_date}`,raw:r,_table:r._table}}))
  const validGCC=new Set(students.map(s=>String(s.gcc_no)));const orphanAll=allTagged.filter(r=>!validGCC.has(String(r.adm_app_id)))
  if(orphanAll.length>0){const og=[...new Set(orphanAll.map(r=>String(r.adm_app_id)))];push('orphan_gcc','HIGH','Integrity',`${orphanAll.length} fee record${orphanAll.length!==1?'s':''} with no matching student`,`Fee records linked to GCC numbers not found in the students table.`,og.map(g=>{const recsForG=orphanAll.filter(r=>String(r.adm_app_id)===g);return{label:`GCC-${g}: ${recsForG.length} record(s)`,raw:recsForG[0],_table:recsForG[0]._table,_group:recsForG}}))}
  const zeroAll=allTagged.filter(r=>!Number(r.amount||r.amount_paid)||Number(r.amount||r.amount_paid)<=0)
  if(zeroAll.length>0)push('zero_amt','HIGH','Amount',`${zeroAll.length} record${zeroAll.length!==1?'s':''} with zero or missing amount`,`${zeroAll.length} fee record${zeroAll.length!==1?'s':''} have ₹0 or null amounts.`,zeroAll.slice(0,10).map(r=>{const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id));return{label:`${stu?.name||'GCC-'+r.adm_app_id} · ₹${r.amount||r.amount_paid||0} · ${r.pay_date||'no date'}`,raw:r,_table:r._table}}))
  const HIGH_AMT=50000;allTagged.filter(r=>Number(r.amount||r.amount_paid)>HIGH_AMT).forEach(r=>{const amt=Number(r.amount||r.amount_paid),stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id)),ft=r.month?'Flat Fee':r.for_month?'Course Fee':'Adm Fee';push('high_'+r.id,'HIGH','Amount',`Unusually high payment: ₹${_inr(amt)}`,`${stu?.name||'GCC-'+r.adm_app_id} paid ₹${_inr(amt)} as ${ft} on ${r.pay_date||'unknown'}.`,[{label:`${ft} · ₹${_inr(amt)} · ${r.pay_date||'?'} · ${r.pay_mode||'?'}`,raw:r,_table:r._table}])})
  const noDateAll=allTagged.filter(r=>!r.pay_date)
  if(noDateAll.length>0)push('no_date','MEDIUM','Integrity',`${noDateAll.length} record${noDateAll.length!==1?'s':''} missing payment date`,`${noDateAll.length} fee record${noDateAll.length!==1?'s':''} have no pay_date. Breaks daily reports and audit trails.`,noDateAll.slice(0,8).map(r=>{const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id));return{label:`${stu?.name||'GCC-'+r.adm_app_id} · ₹${_inr(r.amount||r.amount_paid||0)}`,raw:r,_table:r._table}}))
  const rateAnom=adm_course_fees.filter(r=>{if(r.reverted)return false;const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id));if(!stu||!r.course||!r.amount_paid)return false;const std=COURSE_RATES[r.course]?.[stu.hostel_type]||0;return std>0&&Math.abs(Number(r.amount_paid)-std)/std>0.25})
  if(rateAnom.length>0)push('rate_dev','MEDIUM','Rate',`${rateAnom.length} course fee${rateAnom.length!==1?'s':''} with >25% rate deviation`,`These payments deviate more than 25% from the standard rate.`,rateAnom.slice(0,10).map(r=>{const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id)),std=COURSE_RATES[r.course]?.[stu?.hostel_type]||0;return{label:`${stu?.name||'GCC-'+r.adm_app_id} · paid ₹${_inr(r.amount_paid)} vs std ₹${_inr(std)} (${r.course}, ${r.for_month} ${r.year})`,raw:r,_table:'adm_course_fees'}}))
  // Mis-tagged future month: pay_date falls before the calendar month that
  // for_month/year names. A real payment can only ever be logged for the
  // CURRENT or a PAST month at the moment it's collected — nobody legitimately
  // pays 2+ months ahead in one receipt with no matching multi-month total, and
  // certainly not 5 months ahead. In practice this has only ever meant one
  // thing here: staff scrolled past the current month in the collection
  // dropdown and picked the wrong one, silently attaching a real payment to a
  // month that hasn't started yet. Left uncorrected this both inflates that
  // future month's "collected" total (looks fully paid before it's even
  // begun) and can leave the month the student actually intended to pay
  // showing as still due.
  const MONTH_IDX={January:0,February:1,March:2,April:3,May:4,June:5,July:6,August:7,September:8,October:9,November:10,December:11}
  const futureMonthTag=(forMonthOrMonth,yr,payDate)=>{
    if(!forMonthOrMonth||!yr||!payDate)return false
    const targetIdx=MONTH_IDX[forMonthOrMonth];if(targetIdx===undefined)return false
    const targetFirstOfMonth=new Date(Number(yr),targetIdx,1).toLocaleDateString('en-CA')
    return payDate<targetFirstOfMonth
  }
  const crsfFutureTag=adm_course_fees.filter(r=>!r.reverted&&!r.is_advance&&futureMonthTag(r.for_month,r.year,r.pay_date))
  const flatFutureTag=adm_flat_fees.filter(r=>r.paid&&!r.is_advance&&futureMonthTag(r.month,r.year,r.pay_date))
  const futureTagAll=[...crsfFutureTag.map(r=>({...r,_table:'adm_course_fees',_month:r.for_month,_amt:r.amount_paid})),...flatFutureTag.map(r=>({...r,_table:'adm_flat_fees',_month:r.month,_amt:r.amount}))]
  if(futureTagAll.length>0)push('future_month_tag','HIGH','Integrity',`${futureTagAll.length} payment${futureTagAll.length!==1?'s':''} tagged to a month that hadn't started yet`,`These were paid before the calendar month they're recorded against began — almost always the wrong month picked in the collection form (not authorized advances, which are excluded here). Inflates that month's "collected" total and may leave the real intended month still showing due.`,futureTagAll.slice(0,15).map(r=>{const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id));return{label:`${stu?.name||'GCC-'+r.adm_app_id} · tagged ${r._month} ${r.year} · paid ₹${_inr(r._amt)} on ${r.pay_date} · ${r.receipt_no||'?'}`,raw:r,_table:r._table}}))
  // Authorized advances get their own LOW-severity informational line — not
  // a problem to fix, just a visible record of who approved what, so an
  // admin reviewing collections later can see every advance in one place.
  const crsfAdvance=adm_course_fees.filter(r=>!r.reverted&&r.is_advance)
  const flatAdvance=adm_flat_fees.filter(r=>r.paid&&r.is_advance)
  const advanceAll=[...crsfAdvance.map(r=>({...r,_table:'adm_course_fees',_month:r.for_month,_amt:r.amount_paid})),...flatAdvance.map(r=>({...r,_table:'adm_flat_fees',_month:r.month,_amt:r.amount}))]
  if(advanceAll.length>0)push('authorized_advance','LOW','Integrity',`${advanceAll.length} authorized advance payment${advanceAll.length!==1?'s':''} on record`,`These were deliberately collected ahead of the fee-period month with admin authorization.`,advanceAll.slice(0,15).map(r=>{const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id));return{label:`${stu?.name||'GCC-'+r.adm_app_id} · ${r._month} ${r.year} · ₹${_inr(r._amt)} · authorized by ${r.advance_authorized_by||'?'}`,raw:r,_table:r._table}}))
  const dayTotals={};allTagged.forEach(r=>{const d=r.pay_date;if(!d)return;dayTotals[d]=(dayTotals[d]||0)+(Number(r.amount||r.amount_paid)||0)})
  const last30=Object.entries(dayTotals).filter(([d])=>d>=new Date(now-30*86400000).toLocaleDateString('en-CA')&&d<=todayStr)
  if(last30.length>=5){const avg30=last30.reduce((s,[,v])=>s+v,0)/last30.length;last30.filter(([,v])=>v>avg30*3&&avg30>0).forEach(([d,v])=>push('spike_'+d,'MEDIUM','Spike',`Collection spike: ${_fdate(d)}`,`₹${_inr(v)} collected — ${Math.round(v/avg30)}x the 30-day average of ₹${_inr(Math.round(avg30))}.`,allTagged.filter(r=>r.pay_date===d).map(r=>({label:`₹${_inr(r.amount||r.amount_paid||0)} · ${r.pay_mode||'?'}`,raw:r,_table:r._table}))))}
  const d90Str=new Date(now-90*86400000).toLocaleDateString('en-CA');const oldNoRef=allTagged.filter(r=>r.pay_date&&r.pay_date<d90Str&&!r.txn_ref)
  if(oldNoRef.length>0)push('old_no_ref','LOW','Integrity',`${oldNoRef.length} old payment${oldNoRef.length!==1?'s':''} without transaction reference`,`${oldNoRef.length} record${oldNoRef.length!==1?'s':''} older than 90 days have no UPI/cheque reference.`,oldNoRef.slice(0,8).map(r=>{const stu=students.find(s=>String(s.gcc_no)===String(r.adm_app_id));return{label:`${stu?.name||'GCC-'+r.adm_app_id} · ₹${_inr(r.amount||r.amount_paid||0)} · ${r.pay_date}`,raw:r,_table:r._table}}))
  const zeroPayStudents=liveRows.filter(s=>s.grandTotal===0)
  if(zeroPayStudents.length>10)push('zero_pay','LOW','Collection',`${zeroPayStudents.length} enrolled students with zero payment`,`${zeroPayStudents.length} students have ₹0 across all fee types.`,zeroPayStudents.slice(0,10).map(s=>({label:`${s.name} · GCC-${s.gcc_no} · ${s.course||'—'} · ${s.hostel_type||'—'}`,raw:s,_table:'students'})))
  const order={CRITICAL:0,HIGH:1,MEDIUM:2,LOW:3};return flags.sort((a,b)=>order[a.sev]-order[b.sev])
}
// ── Anomaly record row — summary label + expandable full raw detail ──────────
// The `raw` object is the actual database row for this anomaly entry (tagged
// with `_table` in runAnomalyEngine above), not a fabricated summary — every
// field shown here is real data pulled straight from adm_flat_fees /
// adm_course_fees / adm_fee_collections / students, whichever it came from.
const FIELD_LABELS={
  id:'Record ID', adm_app_id:'GCC No.', gcc_no:'GCC No.',
  amount:'Amount', amount_paid:'Amount Paid',
  pay_date:'Payment Date', pay_mode:'Payment Mode', txn_ref:'Txn Reference',
  receipt_no:'Receipt No.', collected_by:'Collected By',
  month:'Month', for_month:'For Month', year:'Year',
  course:'Course', subtype:'Subtype', hostel_type:'Hostel Type',
  fee_type:'Fee Type', description:'Description',
  student_name:'Student Name', adm_no:'Admission No.',
  reverted:'Reverted', reverted_by:'Reverted By', reverted_at:'Reverted At', revert_reason:'Revert Reason',
  created_at:'Created At', updated_at:'Updated At',
}
function AnomalyRecordRow({record,borderColor}){
  const [expanded,setExpanded]=useState(false)
  const raw=record.raw
  return(
    <div style={{background:'white',borderRadius:6,border:`1px solid ${borderColor}`,overflow:'hidden'}}>
      <div onClick={()=>raw&&setExpanded(e=>!e)} style={{fontSize:11,color:'#475569',padding:'6px 10px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:raw?'pointer':'default',gap:8}}>
        <span>• {record.label}</span>
        {raw&&<span style={{fontSize:10,color:'#94a3b8',flexShrink:0}}>{expanded?'▲ hide details':'🔍 full details'}</span>}
      </div>
      {expanded&&raw&&(
        <div style={{borderTop:`1px dashed ${borderColor}`,padding:'8px 10px',background:'#f8fafc'}}>
          <div style={{fontSize:9,fontWeight:800,color:'#64748b',textTransform:'uppercase',letterSpacing:'.4px',marginBottom:6}}>
            Source: {record._table||'unknown table'}{record._group?` · ${record._group.length} records grouped`:''}
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'4px 12px'}}>
            {Object.entries(raw).filter(([k])=>!k.startsWith('_')&&raw[k]!==null&&raw[k]!==undefined&&raw[k]!=='').map(([k,v])=>(
              <div key={k} style={{fontSize:10.5}}>
                <span style={{color:'#94a3b8',fontWeight:600}}>{FIELD_LABELS[k]||k}: </span>
                <span style={{color:'#1e293b',fontWeight:600}}>{typeof v==='boolean'?(v?'Yes':'No'):String(v)}</span>
              </div>
            ))}
          </div>
          {record._group&&record._group.length>1&&(
            <div style={{marginTop:8,fontSize:9,color:'#94a3b8',fontStyle:'italic'}}>Showing first of {record._group.length} grouped records.</div>
          )}
        </div>
      )}
    </div>
  )
}

function AnomalyMonitor({adm_fee_collections,adm_flat_fees,adm_course_fees,students,liveRows,isAdmin,currentUser}){
  const [open,setOpen]=useState(null),[sevFilter,setSevFilter]=useState('ALL'),[catFilter,setCatFilter]=useState('ALL')
  const flags=useMemo(()=>runAnomalyEngine({adm_fee_collections,adm_flat_fees,adm_course_fees,students,liveRows}),[adm_fee_collections,adm_flat_fees,adm_course_fees,students,liveRows])

  // ✦ New: review state — persisted via the existing fraud_alerts table
  // (entry_id holds the anomaly's own id string, flag_type its category).
  // Loaded once per flags-list change; reviewSaving tracks per-anomaly-id
  // saving state so only the button just clicked shows a spinner.
  const [reviews,setReviews]=useState({}) // { [anomalyId]: { verdict, resolved_by, resolved_at } }
  const [reviewSaving,setReviewSaving]=useState(null)
  const [reviewLoading,setReviewLoading]=useState(true)

  useEffect(()=>{
    if(!isAdmin||flags.length===0){setReviewLoading(false);return}
    let cancelled=false
    ;(async()=>{
      // entry_id in fraud_alerts is bigint elsewhere in the schema, but our
      // anomaly ids are strings (e.g. "dup_flat_1129_July") — fraud_alerts
      // is being reused here as a generic flag/verdict store rather than
      // its original narrower purpose, so we match on the label text
      // instead of entry_id to keep this working without a schema change
      // beyond the verdict column already added.
      const {data,error}=await supabase.from('fraud_alerts').select('label,verdict,resolved_by,resolved_at').in('label',flags.map(f=>f.id))
      if(cancelled)return
      if(error){console.error('AnomalyMonitor: failed to load reviews',error.message);setReviewLoading(false);return}
      const map={}
      ;(data||[]).forEach(r=>{map[r.label]={verdict:r.verdict||'pending',resolved_by:r.resolved_by,resolved_at:r.resolved_at}})
      setReviews(map)
      setReviewLoading(false)
    })()
    return()=>{cancelled=true}
  },[flags,isAdmin])

  const saveVerdict=async(flag,verdict)=>{
    setReviewSaving(flag.id)
    try{
      const reviewerName=currentUser?.name||currentUser?.userName||'Admin'
      const {error}=await supabase.from('fraud_alerts').upsert({
        label:flag.id, flag_type:flag.cat, severity:flag.sev,
        detected_at:new Date().toISOString(),
        resolved:verdict!=='pending', resolved_by:verdict==='pending'?null:reviewerName,
        resolved_at:verdict==='pending'?null:new Date().toISOString(),
        verdict,
      },{onConflict:'label'})
      if(error){console.error('AnomalyMonitor: save verdict failed',error.message);return}
      setReviews(prev=>({...prev,[flag.id]:{verdict,resolved_by:verdict==='pending'?null:reviewerName,resolved_at:verdict==='pending'?null:new Date().toISOString()}}))
    }finally{
      setReviewSaving(null)
    }
  }

  if(!isAdmin)return(<div style={{background:'#fef2f2',border:'1px solid #fca5a5',borderRadius:12,padding:32,textAlign:'center',color:'#dc2626'}}><div style={{fontSize:36,marginBottom:8}}>🔒</div><div style={{fontWeight:800,fontSize:16}}>Admin Access Only</div><div style={{fontSize:13,marginTop:6,opacity:.8}}>Anomaly monitoring is restricted to administrators.</div></div>)
  const cats=['ALL',...new Set(flags.map(f=>f.cat))],sevs=['ALL','CRITICAL','HIGH','MEDIUM','LOW']
  const visible=flags.filter(f=>(sevFilter==='ALL'||f.sev===sevFilter)&&(catFilter==='ALL'||f.cat===catFilter))
  const cnt=sev=>flags.filter(f=>f.sev===sev).length
  const critCount=cnt('CRITICAL'),highCount=cnt('HIGH'),medCount=cnt('MEDIUM'),lowCount=cnt('LOW')
  const pendingCount=flags.filter(f=>(reviews[f.id]?.verdict||'pending')==='pending').length
  return(
    <div style={{fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:critCount>0?'linear-gradient(135deg,#7f1d1d,#991b1b)':highCount>0?'linear-gradient(135deg,#7c2d12,#9a3412)':'linear-gradient(135deg,#1e3a5f,#1e40af)',borderRadius:14,padding:'20px 24px',marginBottom:20,color:'white'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{fontSize:40}}>{critCount>0?'🚨':highCount>0?'⚠️':'✅'}</div>
          <div style={{flex:1}}><div style={{fontSize:20,fontWeight:900}}>Fee Collection Anomaly Monitor</div><div style={{fontSize:12,opacity:.8,marginTop:3}}>{flags.length===0?'No anomalies detected — all fee records look clean.':`${flags.length} anomal${flags.length!==1?'ies':'y'} detected · ${pendingCount} pending review · Admin eyes only`}</div></div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{[{l:'Critical',c:critCount},{l:'High',c:highCount},{l:'Medium',c:medCount},{l:'Low',c:lowCount}].map(b=>(<div key={b.l} style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.2)',borderRadius:8,padding:'8px 14px',textAlign:'center',minWidth:72}}><div style={{fontSize:22,fontWeight:900}}>{b.c}</div><div style={{fontSize:10,opacity:.85}}>{b.l}</div></div>))}</div>
        </div>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap',alignItems:'center'}}>
        <span style={{fontSize:11,fontWeight:700,color:'#64748b',marginRight:2}}>SEVERITY:</span>
        {sevs.map(s=>{const c=SEV_COLOR[s]||{},isActive=sevFilter===s;return(<button key={s} onClick={()=>setSevFilter(s)} style={{padding:'5px 12px',borderRadius:6,border:`1.5px solid ${isActive?(c.border||'#1e3a5f'):'#e2e8f0'}`,background:isActive?(s==='ALL'?'#1e3a5f':(c.badge||'#64748b')):'white',color:isActive?'white':(s==='ALL'?'#1e3a5f':(c.text||'#64748b')),fontSize:11,fontWeight:700,cursor:'pointer'}}>{s==='ALL'?'All':SEV_ICON[s]+' '+s}</button>)})}
        <span style={{width:1,height:18,background:'#e2e8f0',margin:'0 2px',display:'inline-block'}}/>
        <span style={{fontSize:11,fontWeight:700,color:'#64748b',marginRight:2}}>CATEGORY:</span>
        {cats.map(c=>(<button key={c} onClick={()=>setCatFilter(c)} style={{padding:'5px 12px',borderRadius:6,border:`1.5px solid ${catFilter===c?'#1e3a5f':'#e2e8f0'}`,background:catFilter===c?'#1e3a5f':'white',color:catFilter===c?'white':'#64748b',fontSize:11,fontWeight:700,cursor:'pointer'}}>{c}</button>))}
      </div>
      {flags.length===0&&(<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:12,padding:40,textAlign:'center'}}><div style={{fontSize:48,marginBottom:12}}>✅</div><div style={{fontSize:18,fontWeight:800,color:'#16a34a',marginBottom:6}}>All Clear</div><div style={{fontSize:13,color:'#16a34a',opacity:.7}}>No anomalies detected.</div></div>)}
      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {visible.map(f=>{const c=SEV_COLOR[f.sev]||SEV_COLOR.LOW,isOpen=open===f.id
          const review=reviews[f.id]||{verdict:'pending'}
          const verdict=review.verdict||'pending'
          const saving=reviewSaving===f.id
          return(
          <div key={f.id} style={{background:c.bg,border:`1.5px solid ${verdict==='fraud'?'#dc2626':verdict==='legitimate'?'#16a34a':c.border}`,borderRadius:12,overflow:'hidden'}}>
            <div onClick={()=>setOpen(isOpen?null:f.id)} style={{padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
              <span style={{fontSize:20}}>{SEV_ICON[f.sev]}</span>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{fontWeight:800,fontSize:13,color:c.text}}>{f.title}</span>
                  <span style={{fontSize:10,fontWeight:800,padding:'1px 7px',borderRadius:99,background:c.badge,color:'white'}}>{f.sev}</span>
                  <span style={{fontSize:10,fontWeight:700,padding:'1px 7px',borderRadius:4,background:'rgba(0,0,0,.07)',color:c.text}}>{f.cat}</span>
                  {!reviewLoading&&verdict==='fraud'&&<span style={{fontSize:10,fontWeight:800,padding:'1px 7px',borderRadius:4,background:'#dc2626',color:'white'}}>🚩 FRAUD</span>}
                  {!reviewLoading&&verdict==='legitimate'&&<span style={{fontSize:10,fontWeight:800,padding:'1px 7px',borderRadius:4,background:'#16a34a',color:'white'}}>✓ VERIFIED LEGITIMATE</span>}
                </div>
                <div style={{fontSize:11,color:c.text,opacity:.85,marginTop:3,lineHeight:1.45}}>{f.detail}</div>
                {verdict!=='pending'&&review.resolved_by&&(
                  <div style={{fontSize:10,color:c.text,opacity:.65,marginTop:3}}>Reviewed by {review.resolved_by}{review.resolved_at?` · ${new Date(review.resolved_at).toLocaleDateString('en-IN')}`:''}</div>
                )}
              </div>
              <span style={{fontSize:16,color:c.text,flexShrink:0,opacity:.6}}>{isOpen?'▲':'▼'}</span>
            </div>
            {isOpen&&(
              <div style={{borderTop:`1px dashed ${c.border}`,padding:'10px 16px',background:'rgba(255,255,255,.65)'}}>
                {f.records.length>0?(
                  <>
                    <div style={{fontSize:10,fontWeight:800,color:c.text,textTransform:'uppercase',letterSpacing:'.4px',marginBottom:8}}>Affected Records ({f.records.length})</div>
                    <div style={{display:'flex',flexDirection:'column',gap:4,marginBottom:14}}>{f.records.map((r,i)=>(<AnomalyRecordRow key={i} record={r} borderColor={c.border} />))}</div>
                  </>
                ):(
                  <div style={{fontSize:11,color:'#94a3b8',fontStyle:'italic',marginBottom:14}}>Investigate via Admin View tab.</div>
                )}
                {/* ── Real fix option: verify and record a verdict, persisted in fraud_alerts ── */}
                <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
                  <span style={{fontSize:10,fontWeight:700,color:c.text,textTransform:'uppercase',letterSpacing:'.3px'}}>Verdict:</span>
                  <button disabled={saving} onClick={e=>{e.stopPropagation();saveVerdict(f,'legitimate')}}
                    style={{padding:'5px 12px',borderRadius:6,border:'1.5px solid #16a34a',background:verdict==='legitimate'?'#16a34a':'white',color:verdict==='legitimate'?'white':'#16a34a',fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',opacity:saving?.6:1}}>
                    ✓ Verify — Legitimate
                  </button>
                  <button disabled={saving} onClick={e=>{e.stopPropagation();saveVerdict(f,'fraud')}}
                    style={{padding:'5px 12px',borderRadius:6,border:'1.5px solid #dc2626',background:verdict==='fraud'?'#dc2626':'white',color:verdict==='fraud'?'white':'#dc2626',fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',opacity:saving?.6:1}}>
                    🚩 Flag as Fraud
                  </button>
                  {verdict!=='pending'&&(
                    <button disabled={saving} onClick={e=>{e.stopPropagation();saveVerdict(f,'pending')}}
                      style={{padding:'5px 12px',borderRadius:6,border:'1.5px solid #e2e8f0',background:'white',color:'#64748b',fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',opacity:saving?.6:1}}>
                      Reset to Pending
                    </button>
                  )}
                  {saving&&<span style={{fontSize:10,color:'#94a3b8'}}>saving…</span>}
                </div>
              </div>
            )}
          </div>
        )})}
      </div>
      {visible.length===0&&flags.length>0&&(<div style={{textAlign:'center',padding:32,color:'#94a3b8',fontSize:13}}>No anomalies match the current filters.</div>)}
      {flags.length>0&&(<div style={{marginTop:20,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:10,padding:'12px 16px',fontSize:11,color:'#64748b',lineHeight:1.6}}><strong style={{color:'#1e3a5f'}}>Action guide —</strong> <strong>CRITICAL</strong>: fix immediately using Revert in Fee Payment. <strong>HIGH</strong>: verify against physical receipts before end of day. <strong>MEDIUM</strong>: review at next audit. <strong>LOW</strong>: address during month-end reconciliation. Use the <strong>Verdict</strong> buttons above to record whether each anomaly was checked and found legitimate, or flagged as suspected fraud — this is saved and visible to all admins.</div>)}
    </div>
  )
}


// ── Student Fee Card ──────────────────────────────────────────────────────────
function StudentFeeCard({student,adm_fee_collections,adm_flat_fees,adm_course_fees,isAdmin,currentUser,onRefresh,onCollect}){
  const n=v=>Number(v||0).toLocaleString('en-IN'),gcc=gccStr(student.gcc_no)
  const [tab,setTab]=useState('history'),[toast,setToast]=useState(null),[saving,setSaving]=useState(false)
  const showToast=(msg,color='#16a34a')=>{setToast({msg,color});setTimeout(()=>setToast(null),3500)}
  const myAdm=adm_fee_collections.filter(r=>gccStr(r.adm_app_id)===gcc&&!r.reverted)
  const myFlat=adm_flat_fees.filter(r=>gccStr(r.adm_app_id)===gcc&&r.paid)
  const myCrsf=adm_course_fees.filter(r=>gccStr(r.adm_app_id)===gcc&&!r.reverted)
  const admTotal=myAdm.reduce((s,r)=>s+(Number(r.amount_paid)||0),0)
  const flatTotal=myFlat.reduce((s,r)=>s+(r.amount||0),0)
  const crsfTotal=myCrsf.reduce((s,r)=>s+(Number(r.amount_paid)||0),0)
  const grandTotal=admTotal+flatTotal+crsfTotal
  const timeline=[
    ...myAdm.map(r=>({...r,_type:'Admission Fee',_amt:Number(r.amount_paid)||0,_desc:r.description||r.fee_type||'Admission',_date:r.pay_date,_table:'adm_fee_collections'})),
    ...myFlat.map(r=>({...r,_type:'Flat Fee',_amt:r.amount||0,_desc:`${r.month} ${r.year}${r.is_advance?' (ADVANCE)':''}`,_date:r.pay_date,_table:'adm_flat_fees'})),
    ...myCrsf.map(r=>({...r,_type:'Course Fee',_amt:Number(r.amount_paid)||0,_desc:`${r.course} — ${r.for_month} ${r.year}${r.is_advance?' (ADVANCE)':''}`,_date:r.pay_date,_table:'adm_course_fees'}))
  ].sort((a,b)=>(b._date||'').localeCompare(a._date||''))
  const doRevert=async(row)=>{
    if(!isAdmin)return
    const reason=window.prompt(`Revert "${row._desc}" (₹${n(row._amt)})?\n\nThis removes the entry from books so it can be re-collected.\nReason (optional):`)
    if(reason===null)return;setSaving(true)
    try{
      let aRef=null,aType=null
      if(row._table==='adm_fee_collections'){aType=row.fee_type==='advance'?'advance_fee':'adm_fee';if(row.fee_type==='admission')aRef=sourceRef.admission(gcc);else if(row.fee_type==='advance')aRef=row.id;else if(row.fee_type==='item')aRef=sourceRef.admItem(gcc,row.description==='Prospectus'?'prospectus':(row.description||'').replace(/^Dress Kit — /,''))}
      else if(row._table==='adm_flat_fees'){aType='flat_fee';aRef=sourceRef.flatFee(gcc,row.month,row.year)}
      else if(row._table==='adm_course_fees'){aType='course_fee';aRef=sourceRef.courseFee(gcc,row.for_month,row.year)}
      await revertFeeCollection({table:row._table,id:row.id,accountSourceRef:aRef,accountSourceType:aType,revertedBy:currentUser?.name||'Admin',reason})
      showToast(`↩️ Reverted: ${row._desc}`,'#dc2626');onRefresh()
    }catch(err){showToast('Revert failed: '+err.message,'#dc2626')}
    setSaving(false)
  }
  const doFixDate=async(row)=>{
    if(!isAdmin)return
    const newDate=window.prompt(`Fix payment date for "${row._desc}"\nCurrent: ${row._date||'—'}\n\nEnter correct date (YYYY-MM-DD):`,row._date||new Date().toLocaleDateString('en-CA'))
    if(!newDate)return;if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate)){showToast('Invalid date — use YYYY-MM-DD','#dc2626');return}
    setSaving(true)
    try{
      let aRef=null,aType=null
      if(row._table==='adm_flat_fees'){aType='flat_fee';aRef=sourceRef.flatFee(gcc,row.month,row.year)}
      if(row._table==='adm_course_fees'){aType='course_fee';aRef=sourceRef.courseFee(gcc,row.for_month,row.year)}
      if(row._table==='adm_fee_collections'){aType=row.fee_type==='advance'?'advance_fee':'adm_fee';aRef=row.fee_type==='admission'?sourceRef.admission(gcc):row.fee_type==='advance'?row.id:null}
      await correctFeeCollectionDate({table:row._table,id:row.id,newDate,accountSourceRef:aRef,accountSourceType:aType})
      showToast(`📅 Date corrected to ${newDate}`,'#1e3a5f');onRefresh()
    }catch(err){showToast('Date fix failed: '+err.message,'#dc2626')}
    setSaving(false)
  }
  const typeColor=t=>t==='Admission Fee'?{bg:'#eef2ff',color:'#3730a3'}:t==='Flat Fee'?{bg:'#dcfce7',color:'#166534'}:{bg:'#f5f3ff',color:'#6d28d9'}
  return(
    <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,.08)'}}>
      {toast&&<div style={{position:'fixed',top:20,right:20,zIndex:99999,background:'white',border:`1px solid #e2e8f0`,borderLeft:`3px solid ${toast.color}`,borderRadius:10,padding:'11px 16px',fontSize:13,fontWeight:600,boxShadow:'0 8px 32px rgba(0,0,0,.12)',maxWidth:320,color:'#1e293b'}}>{toast.msg}</div>}
      <div style={{background:'linear-gradient(135deg,#1e3a5f,#1e40af)',padding:'18px 20px',color:'white'}}>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,.2)',border:'2px solid rgba(255,255,255,.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,flexShrink:0}}>{(student.name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:18,fontWeight:900,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>{student.name}{student.is_repeater&&<span style={{fontSize:9,fontWeight:800,background:'#fef3c7',color:'#92400e',padding:'1px 7px',borderRadius:3,border:'1px solid #fcd34d'}}>REPEATER</span>}</div>
            <div style={{fontSize:12,opacity:.8,marginTop:3,display:'flex',gap:10,flexWrap:'wrap'}}>{student.gcc_no&&<span style={{fontWeight:700}}>GCC-{student.gcc_no}</span>}{(student.class_name||student.batch)&&<span>{student.class_name||student.batch}</span>}{student.course&&<span>{student.course}</span>}{student.hostel_type&&<span style={{background:'rgba(255,255,255,.15)',padding:'1px 8px',borderRadius:4}}>{student.hostel_type}</span>}</div>
          </div>
          <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:24,fontWeight:900}}>₹{n(grandTotal)}</div><div style={{fontSize:10,opacity:.7,marginTop:2}}>Total paid</div></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginTop:14,paddingTop:14,borderTop:'1px solid rgba(255,255,255,.2)'}}>
          {[{l:'Admission',v:admTotal,i:'🎓'},{l:'Flat Fees',v:flatTotal,i:'📅'},{l:'Course Fees',v:crsfTotal,i:'📚'}].map(c=>(<div key={c.l} style={{textAlign:'center'}}><div style={{fontSize:11,opacity:.7}}>{c.i} {c.l}</div><div style={{fontSize:15,fontWeight:800,marginTop:2}}>₹{n(c.v)}</div></div>))}
        </div>
      </div>
      <div style={{display:'flex',borderBottom:'2px solid #f1f5f9',background:'#f8fafc'}}>
        {[{id:'history',l:'📋 Fee History'},{id:'revert',l:isAdmin?'↩️ Revert / Fix (Admin)':'🔒 Admin Only'}].map(t=>(<button key={t.id} onClick={()=>isAdmin||t.id==='history'?setTab(t.id):null} style={{padding:'10px 18px',border:'none',borderBottom:tab===t.id?'2px solid #1e3a5f':'2px solid transparent',background:'none',cursor:isAdmin||t.id==='history'?'pointer':'not-allowed',fontSize:12,fontWeight:tab===t.id?800:500,color:tab===t.id?'#1e3a5f':isAdmin||t.id==='history'?'#64748b':'#cbd5e1',marginBottom:-2}}>{t.l}</button>))}
      </div>
      {tab==='history'&&(
        <div style={{padding:'0 0 4px'}}>
          {timeline.length===0?(<div style={{padding:40,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:32,marginBottom:8}}>💳</div><div style={{fontWeight:600}}>No fee records yet</div></div>):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>{['#','Type','Description','Amount','Date','Mode','Ref','By'].map(h=>(<th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:700,color:'#374151',fontSize:11,whiteSpace:'nowrap'}}>{h}</th>))}</tr></thead>
                <tbody>{timeline.map((r,i)=>{const tc=typeColor(r._type);return(<tr key={r.id+r._table} style={{borderBottom:'1px solid #f8fafc'}} onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'} onMouseLeave={e=>e.currentTarget.style.background='white'}><td style={{padding:'8px 12px',color:'#94a3b8',fontSize:10}}>{i+1}</td><td style={{padding:'8px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:tc.bg,color:tc.color}}>{r._type}</span></td><td style={{padding:'8px 12px',color:'#1e293b',fontWeight:600}}>{r._desc}</td><td style={{padding:'8px 12px',fontWeight:800,color:'#16a34a',whiteSpace:'nowrap'}}>₹{n(r._amt)}</td><td style={{padding:'8px 12px',color:'#64748b',fontFamily:'monospace',fontSize:11}}>{r._date||'—'}</td><td style={{padding:'8px 12px',color:'#475569'}}>{r.pay_mode||'—'}</td><td style={{padding:'8px 12px',color:'#94a3b8',fontFamily:'monospace',fontSize:10}}>{r.txn_ref||'—'}</td><td style={{padding:'8px 12px',color:'#64748b',fontSize:11}}>{r.collected_by||'—'}</td></tr>)})}</tbody>
                <tfoot><tr style={{background:'#1e3a5f'}}><td colSpan={3} style={{padding:'10px 12px',fontWeight:800,color:'white',fontSize:12}}>Total Paid</td><td style={{padding:'10px 12px',fontWeight:900,color:'#6ee7b7',fontSize:13}}>₹{n(grandTotal)}</td><td colSpan={4}/></tr></tfoot>
              </table>
            </div>
          )}
          <div style={{padding:'12px 16px',borderTop:'1px solid #f1f5f9'}}><button onClick={()=>onCollect(student)} style={{width:'100%',padding:'10px',borderRadius:8,background:'linear-gradient(135deg,#1e3a5f,#3730a3)',color:'white',border:'none',fontSize:13,fontWeight:800,cursor:'pointer'}}>💳 Collect Fee for {student.name.split(' ')[0]}</button></div>
        </div>
      )}
      {tab==='revert'&&isAdmin&&(
        <div style={{padding:'4px 0'}}>
          <div style={{padding:'12px 16px 8px',fontSize:11,color:'#dc2626',fontWeight:700,background:'#fef2f2',borderBottom:'1px solid #fca5a5'}}>⚠️ Admin-only — Revert removes a payment from books. Fix Date corrects a wrong date without reverting. Both actions are logged.</div>
          {timeline.length===0?(<div style={{padding:32,textAlign:'center',color:'#94a3b8'}}>No fee records to manage.</div>):(
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>{['Type','Description','Amount','Date','Mode','Actions'].map(h=>(<th key={h} style={{padding:'9px 12px',textAlign:'left',fontWeight:700,color:'#374151',fontSize:11,whiteSpace:'nowrap'}}>{h}</th>))}</tr></thead>
                <tbody>{timeline.map((r,i)=>{const tc=typeColor(r._type);return(<tr key={r.id+r._table+'-rv'} style={{borderBottom:'1px solid #f8fafc'}} onMouseEnter={e=>e.currentTarget.style.background='#fef2f2'} onMouseLeave={e=>e.currentTarget.style.background='white'}><td style={{padding:'9px 12px'}}><span style={{fontSize:10,fontWeight:700,padding:'2px 7px',borderRadius:4,background:tc.bg,color:tc.color}}>{r._type}</span></td><td style={{padding:'9px 12px',color:'#1e293b',fontWeight:600}}>{r._desc}</td><td style={{padding:'9px 12px',fontWeight:800,color:'#16a34a',whiteSpace:'nowrap'}}>₹{n(r._amt)}</td><td style={{padding:'9px 12px',color:'#64748b',fontFamily:'monospace',fontSize:11}}>{r._date||<span style={{color:'#fca5a5',fontWeight:700}}>Missing!</span>}</td><td style={{padding:'9px 12px',color:'#475569'}}>{r.pay_mode||'—'}</td><td style={{padding:'9px 12px'}}><div style={{display:'flex',gap:6}}><button onClick={()=>doFixDate(r)} disabled={saving} style={{padding:'5px 10px',borderRadius:6,border:'1px solid #bfdbfe',background:'#eff6ff',color:'#1e3a5f',fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',whiteSpace:'nowrap'}}>📅 Fix Date</button><button onClick={()=>doRevert(r)} disabled={saving} style={{padding:'5px 10px',borderRadius:6,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',fontSize:11,fontWeight:700,cursor:saving?'not-allowed':'pointer',whiteSpace:'nowrap'}}>↩️ Revert</button></div></td></tr>)})}</tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Student Ledger Tab ────────────────────────────────────────────────────────
function StudentLedgerTab({students,adm_fee_collections,adm_flat_fees,adm_course_fees,liveRows,isAdmin,currentUser,onRefresh,onCollect}){
  const [search,setSearch]=useState(''),[courseF,setCourseF]=useState('All'),[hostelF,setHostelF]=useState('All'),[statusF,setStatusF]=useState('All'),[selected,setSelected]=useState(null)
  const n=v=>Number(v||0).toLocaleString('en-IN')
  const filtered=useMemo(()=>{const q=search.toLowerCase();return liveRows.filter(s=>{if(courseF!=='All'&&s.course!==courseF)return false;if(hostelF!=='All'&&s.hostel_type!==hostelF)return false;if(statusF!=='All'&&s.liveStatus!==statusF)return false;return[s.name,s.gcc_no,s.class_name,s.batch,s.course].some(v=>(v||'').toString().toLowerCase().includes(q))})},[liveRows,search,courseF,hostelF,statusF])
  const inp2={width:'100%',padding:'8px 12px',borderRadius:7,border:'1px solid #d1d5db',fontSize:13,outline:'none',background:'white'}
  return(
    <div style={{display:'flex',gap:20,alignItems:'flex-start',flexWrap:'wrap'}}>
      <div style={{flex:'0 0 340px',minWidth:280}}>
        <div style={{background:'white',border:'1px solid #e2e8f0',borderRadius:12,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
          <div style={{padding:'14px 14px 10px',borderBottom:'1px solid #f1f5f9',background:'#f8fafc'}}>
            <div style={{fontWeight:800,fontSize:13,color:'#1e3a5f',marginBottom:10}}>👨‍🎓 Select Student</div>
            <input placeholder="Search name or GCC No…" value={search} onChange={e=>setSearch(e.target.value)} style={inp2}/>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6,marginTop:8}}>
              <select value={courseF} onChange={e=>setCourseF(e.target.value)} style={{...inp2,padding:'5px 6px',fontSize:11}}><option value="All">All Courses</option>{['Sainik','Navodaya','Foundation','Combined Course'].map(c=><option key={c}>{c}</option>)}</select>
              <select value={hostelF} onChange={e=>setHostelF(e.target.value)} style={{...inp2,padding:'5px 6px',fontSize:11}}><option value="All">All Hostel</option>{['Boarder','Day Boarder','Day Scholar'].map(h=><option key={h}>{h}</option>)}</select>
              <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{...inp2,padding:'5px 6px',fontSize:11}}><option value="All">All Status</option><option>Paid</option><option>Partial</option><option>Underpaid</option><option>Pending</option></select>
            </div>
            <div style={{fontSize:11,color:'#94a3b8',marginTop:6}}>{filtered.length} of {students.length} students</div>
          </div>
          <div style={{maxHeight:520,overflowY:'auto'}}>
            {filtered.length===0&&<div style={{padding:24,textAlign:'center',color:'#94a3b8',fontSize:12}}>No students found</div>}
            {filtered.map(s=>{const isSel=selected?.id===s.id,sc=s.liveStatus==='Paid'?'#16a34a':s.liveStatus==='Partial'?'#d97706':s.liveStatus==='Underpaid'?'#c2410c':'#dc2626',sb=s.liveStatus==='Paid'?'#dcfce7':s.liveStatus==='Partial'?'#fef9c3':s.liveStatus==='Underpaid'?'#ffedd5':'#fee2e2';return(
              <div key={s.id} onClick={()=>setSelected(s)} style={{padding:'11px 14px',cursor:'pointer',borderBottom:'1px solid #f8fafc',background:isSel?'#eff6ff':'white',borderLeft:isSel?'3px solid #1e3a5f':'3px solid transparent'}} onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background='#f8fafc'}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background='white'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,fontSize:13,color:'#1e293b',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>{s.name}{s.is_repeater&&<span style={{fontSize:8,fontWeight:800,color:'#92400e',background:'#fef3c7',padding:'1px 4px',borderRadius:2,border:'1px solid #fcd34d'}}>RPT</span>}</div><div style={{fontSize:10,color:'#64748b',marginTop:2}}>GCC-{s.gcc_no} · {s.class_name||s.batch||'—'} · {s.course||'—'}</div><div style={{fontSize:10,color:'#94a3b8',marginTop:1}}>{s.hostel_type||'—'}</div></div>
                  <div style={{textAlign:'right',flexShrink:0}}><div style={{fontSize:13,fontWeight:900,color:s.grandTotal>0?'#16a34a':'#94a3b8'}}>{s.grandTotal>0?`₹${n(s.grandTotal)}`:'₹0'}</div><span style={{fontSize:9,fontWeight:700,padding:'1px 6px',borderRadius:99,background:sb,color:sc,marginTop:3,display:'inline-block'}}>{s.liveStatus}</span></div>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
      <div style={{flex:1,minWidth:300}}>
        {!selected?(<div style={{background:'white',border:'2px dashed #e2e8f0',borderRadius:14,padding:60,textAlign:'center',color:'#94a3b8'}}><div style={{fontSize:48,marginBottom:12}}>👈</div><div style={{fontWeight:700,fontSize:15,color:'#64748b'}}>Select a student</div><div style={{fontSize:12,marginTop:6}}>Click any student on the left to view their full fee history and manage records.</div></div>):(
          <StudentFeeCard student={selected} adm_fee_collections={adm_fee_collections} adm_flat_fees={adm_flat_fees} adm_course_fees={adm_course_fees} isAdmin={isAdmin} currentUser={currentUser} onRefresh={onRefresh} onCollect={onCollect}/>
        )}
      </div>
    </div>
  )
}


// ── Reports Export Tab ────────────────────────────────────────────────────────
function buildReports({students,adm_fee_collections,adm_flat_fees,adm_course_fees,liveRows,todayStr,afDateFrom,afDateTo}){
  const stu=gcc=>students.find(s=>String(s.gcc_no)===String(gcc))
  const feeStatusRows=liveRows.map(s=>({'GCC No':`GCC-${s.gcc_no}`,'Student Name':s.name||'—','Batch/Class':s.class_name||s.batch||'—','Course':s.course||'—','Hostel Type':s.hostel_type||'—','Admission Fee':s.admTotal||0,'Flat Fees':s.flatTotal||0,'Course Fees':s.crsfTotal||0,'Total Paid':s.grandTotal,'Status':s.liveStatus,'Repeater':s.is_repeater?'Yes':'No'}))
  const pendingRows=liveRows.filter(s=>s.grandTotal===0).map(s=>({'GCC No':`GCC-${s.gcc_no}`,'Student Name':s.name||'—','Batch/Class':s.class_name||s.batch||'—','Course':s.course||'—','Hostel Type':s.hostel_type||'—','Status':'Pending'}))
  const flatRows=adm_flat_fees.filter(r=>r.paid).map(r=>{const s=stu(r.adm_app_id);return{'GCC No':`GCC-${r.adm_app_id}`,'Student Name':s?.name||'—','Course':s?.course||'—','Hostel Type':s?.hostel_type||'—','Month':r.month||'—','Year':r.year||'—','Amount':r.amount||0,'Pay Date':r.pay_date||'—','Pay Mode':r.pay_mode||'—','Txn Ref':r.txn_ref||'—','Collected By':r.collected_by||'—'}}).sort((a,b)=>b['Pay Date'].localeCompare(a['Pay Date']))
  const crsfRows=adm_course_fees.filter(r=>!r.reverted).map(r=>{const s=stu(r.adm_app_id);return{'GCC No':`GCC-${r.adm_app_id}`,'Student Name':s?.name||'—','Course':r.course||'—','Hostel Type':s?.hostel_type||'—','For Month':r.for_month||'—','Year':r.year||'—','Amount Paid':Number(r.amount_paid)||0,'Pay Date':r.pay_date||'—','Pay Mode':r.pay_mode||'—','Txn Ref':r.txn_ref||'—','Collected By':r.collected_by||'—'}}).sort((a,b)=>b['Pay Date'].localeCompare(a['Pay Date']))
  const admRows=adm_fee_collections.filter(r=>!r.reverted).map(r=>{const s=stu(r.adm_app_id);return{'GCC No':`GCC-${r.adm_app_id}`,'Student Name':s?.name||'—','Course':s?.course||'—','Fee Type':r.fee_type||'—','Description':r.description||'—','Amount Paid':Number(r.amount_paid)||0,'Pay Date':r.pay_date||'—','Pay Mode':r.pay_mode||'—','Txn Ref':r.txn_ref||'—','Collected By':r.collected_by||'—'}}).sort((a,b)=>b['Pay Date'].localeCompare(a['Pay Date']))
  const courseRows=['Sainik','Navodaya','Foundation','Combined Course'].map(c=>{const ss=liveRows.filter(s=>s.course===c);return{'Course':c,'Total Students':ss.length,'Boarders':ss.filter(s=>s.hostel_type==='Boarder').length,'Day Boarders':ss.filter(s=>s.hostel_type==='Day Boarder').length,'Day Scholars':ss.filter(s=>s.hostel_type==='Day Scholar').length,'Total Adm Fees':ss.reduce((t,s)=>t+s.admTotal,0),'Total Flat Fees':ss.reduce((t,s)=>t+s.flatTotal,0),'Total Course Fees':ss.reduce((t,s)=>t+s.crsfTotal,0),'Grand Total':ss.reduce((t,s)=>t+s.grandTotal,0)}}).filter(r=>r['Total Students']>0)
  const monthMap={};const addToMonth=(mk,type,amt)=>{if(!monthMap[mk])monthMap[mk]={'Month':mk,'Flat Fee':0,'Course Fee':0,'Admission Fee':0};monthMap[mk][type]=(monthMap[mk][type]||0)+amt}
  adm_flat_fees.forEach(r=>{if(r.month&&r.year)addToMonth(`${r.month} ${r.year}`,'Flat Fee',r.amount||0)})
  adm_course_fees.forEach(r=>{if(r.for_month&&r.year)addToMonth(`${r.for_month} ${r.year}`,'Course Fee',Number(r.amount_paid)||0)})
  adm_fee_collections.forEach(r=>{if(r.pay_date){const d=new Date(r.pay_date+'T00:00:00');addToMonth(`${d.toLocaleString('default',{month:'long'})} ${d.getFullYear()}`,'Admission Fee',Number(r.amount_paid)||0)}})
  const monthlyRows=Object.values(monthMap).map(m=>({...m,'Total':(m['Flat Fee']||0)+(m['Course Fee']||0)+(m['Admission Fee']||0)}))
  const from=afDateFrom||'2020-01-01',to=afDateTo||todayStr,inRange=d=>d&&d>=from&&d<=to
  const dailyRows=[
    ...adm_flat_fees.filter(r=>r.paid && inRange(r.pay_date)).map(r=>{const s=stu(r.adm_app_id);return{'Date':r.pay_date||'—','GCC No':`GCC-${r.adm_app_id}`,'Student':s?.name||'—','Course':s?.course||'—','Hostel':s?.hostel_type||'—','Fee Type':'Flat Fee','Description':`${r.month} ${r.year}`,'Amount':r.amount||0,'Mode':r.pay_mode||'—','Ref':r.txn_ref||'—','By':r.collected_by||'—'}}),
    ...adm_course_fees.filter(r=>!r.reverted && inRange(r.pay_date)).map(r=>{const s=stu(r.adm_app_id);return{'Date':r.pay_date||'—','GCC No':`GCC-${r.adm_app_id}`,'Student':s?.name||'—','Course':r.course||'—','Hostel':s?.hostel_type||'—','Fee Type':'Course Fee','Description':`${r.course} — ${r.for_month} ${r.year}`,'Amount':Number(r.amount_paid)||0,'Mode':r.pay_mode||'—','Ref':r.txn_ref||'—','By':r.collected_by||'—'}}),
    ...adm_fee_collections.filter(r=>!r.reverted && inRange(r.pay_date)).map(r=>{const s=stu(r.adm_app_id);return{'Date':r.pay_date||'—','GCC No':`GCC-${r.adm_app_id}`,'Student':s?.name||'—','Course':s?.course||'—','Hostel':s?.hostel_type||'—','Fee Type':'Admission Fee','Description':r.description||r.fee_type||'—','Amount':Number(r.amount_paid)||0,'Mode':r.pay_mode||'—','Ref':r.txn_ref||'—','By':r.collected_by||'—'}}),
  ].sort((a,b)=>b['Date'].localeCompare(a['Date']))
  return{feeStatusRows,pendingRows,flatRows,crsfRows,admRows,courseRows,monthlyRows,dailyRows}
}
function ReportsExportTab({students,adm_fee_collections,adm_flat_fees,adm_course_fees,liveRows}){
  const w=useWindowWidth(),isMobile=w<768,todayStr=new Date().toLocaleDateString('en-CA')
  const [dateFrom,setDateFrom]=useState(''),[dateTo,setDateTo]=useState(''),[courseF,setCourseF]=useState('All'),[hostelF,setHostelF]=useState('All'),[statusF,setStatusF]=useState('All'),[lastExport,setLastExport]=useState(null)
  const n=v=>Number(v||0).toLocaleString('en-IN')
  const filteredLive=useMemo(()=>liveRows.filter(s=>{if(courseF!=='All'&&s.course!==courseF)return false;if(hostelF!=='All'&&s.hostel_type!==hostelF)return false;if(statusF!=='All'&&s.liveStatus!==statusF)return false;return true}),[liveRows,courseF,hostelF,statusF])
  const reports=useMemo(()=>buildReports({students,adm_fee_collections,adm_flat_fees,adm_course_fees,liveRows:filteredLive,todayStr,afDateFrom:dateFrom,afDateTo:dateTo}),[students,adm_fee_collections,adm_flat_fees,adm_course_fees,filteredLive,dateFrom,dateTo,todayStr])
  const grandTotal=liveRows.reduce((s,r)=>s+r.grandTotal,0),admTotal=adm_fee_collections.filter(r=>!r.reverted).reduce((s,r)=>s+(Number(r.amount_paid)||0),0),flatTotal=adm_flat_fees.filter(r=>r.paid).reduce((s,r)=>s+(r.amount||0),0),crsfTotal=adm_course_fees.filter(r=>!r.reverted).reduce((s,r)=>s+(Number(r.amount_paid)||0),0)
  const inp3={padding:'8px 11px',borderRadius:7,border:'1px solid #d1d5db',fontSize:12,outline:'none',background:'white',width:'100%'}
  const REPORT_GROUPS=[
    {group:'Student Reports',icon:'👨‍🎓',color:'#1e3a5f',reports:[
      {id:'fee_status',name:'Fee Status Summary',desc:'All students with admission, flat, course fees and overall status',rows:()=>reports.feeStatusRows,meta:()=>({'Total Students':students.length,'Grand Total':`₹${n(grandTotal)}`,'Generated':todayStr})},
      {id:'pending',name:'Pending Fee Students',desc:'Students who have not made any payment yet',rows:()=>reports.pendingRows,meta:()=>({'Pending Count':reports.pendingRows.length,'Generated':todayStr})},
    ]},
    {group:'Collection Registers',icon:'📋',color:'#166534',reports:[
      {id:'flat_register',name:'Flat Fee Register',desc:'All monthly flat fee payments with dates, mode and reference',rows:()=>reports.flatRows,meta:()=>({'Total Records':reports.flatRows.length,'Total Amount':`₹${n(flatTotal)}`,'Generated':todayStr})},
      {id:'course_register',name:'Course Fee Register',desc:'All course fee payments per month per student',rows:()=>reports.crsfRows,meta:()=>({'Total Records':reports.crsfRows.length,'Total Amount':`₹${n(crsfTotal)}`,'Generated':todayStr})},
      {id:'adm_register',name:'Admission Fee Register',desc:'Admission, dress kit, prospectus and advance fee collections',rows:()=>reports.admRows,meta:()=>({'Total Records':reports.admRows.length,'Total Amount':`₹${n(admTotal)}`,'Generated':todayStr})},
    ]},
    {group:'Summary Reports',icon:'📊',color:'#6d28d9',reports:[
      {id:'course_summary',name:'Course-wise Collection Summary',desc:'Fee totals broken down by course and hostel type',rows:()=>reports.courseRows,meta:()=>({'Courses':reports.courseRows.length,'Grand Total':`₹${n(grandTotal)}`,'Generated':todayStr})},
      {id:'monthly_summary',name:'Monthly Collection Summary',desc:'Month-wise totals for flat, course and admission fees',rows:()=>reports.monthlyRows,meta:()=>({'Months':reports.monthlyRows.length,'Generated':todayStr})},
    ]},
    {group:'Date Range Report',icon:'📅',color:'#d97706',reports:[
      {id:'daily_range',name:'Transaction Register',desc:`All fee transactions${dateFrom?' from '+dateFrom:''}${dateTo?' to '+dateTo:' (all time)'}`,rows:()=>reports.dailyRows,meta:()=>({'Date From':dateFrom||'All','Date To':dateTo||'Today','Records':reports.dailyRows.length,'Total':`₹${n(reports.dailyRows.reduce((s,r)=>s+r['Amount'],0))}`})},
    ]},
  ]
  const doExport=(report,format)=>{const rows=report.rows(),meta=report.meta();if(!rows?.length){alert('No data to export for this report.');return};const filename=`GNSI_${report.id}_${todayStr}`,title=`${report.name} — GNSI`;if(format==='csv'){exportCSV(rows,filename);setLastExport(`✅ ${report.name} CSV exported`)}if(format==='tsv'){exportTSV(rows,filename);setLastExport(`✅ ${report.name} TSV exported`)}if(format==='json'){exportJSON(rows,filename);setLastExport(`✅ ${report.name} JSON exported`)}if(format==='xls'){exportXLS(rows,filename,report.name);setLastExport(`✅ ${report.name} XLS exported`)}if(format==='print'){exportPrintHTML(rows,filename,title,meta);setLastExport(`✅ ${report.name} Print opened`)}}
  const FmtBtn=({format,label,color,onClick})=>(<button onClick={onClick} style={{padding:'6px 10px',borderRadius:6,border:`1.5px solid ${color}20`,background:`${color}10`,color,fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}} onMouseEnter={e=>{e.currentTarget.style.background=color;e.currentTarget.style.color='white'}} onMouseLeave={e=>{e.currentTarget.style.background=`${color}10`;e.currentTarget.style.color=color}}>{label}</button>)
  return(
    <div style={{fontFamily:'system-ui,sans-serif'}}>
      <div style={{background:'linear-gradient(135deg,#1e3a5f,#1e40af)',borderRadius:14,padding:'20px 24px',color:'white',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div style={{fontSize:36}}>📤</div>
          <div style={{flex:1}}><div style={{fontSize:20,fontWeight:900}}>Reports &amp; Export Centre</div><div style={{fontSize:12,opacity:.8,marginTop:3}}>Export any fee report in CSV · TSV · XLS · JSON · Print/PDF format</div></div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{[{l:'Students',v:students.length,icon:'👨‍🎓'},{l:'Total',v:'₹'+n(grandTotal),icon:'💰'},{l:'Flat',v:'₹'+n(flatTotal),icon:'📅'},{l:'Course',v:'₹'+n(crsfTotal),icon:'📚'}].map(c=>(<div key={c.l} style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.2)',borderRadius:8,padding:'8px 14px',textAlign:'center',minWidth:80}}><div style={{fontSize:11,opacity:.8}}>{c.icon} {c.l}</div><div style={{fontSize:14,fontWeight:900,marginTop:2}}>{c.v}</div></div>))}</div>
        </div>
      </div>
      <div style={{background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:'14px 18px',marginBottom:20}}>
        <div style={{fontSize:12,fontWeight:800,color:'#1e3a5f',marginBottom:12}}>🔧 Report Filters</div>
        <div style={{display:'grid',gridTemplateColumns:isMobile?'1fr 1fr':'repeat(5,1fr)',gap:10}}>
          <div><div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase'}}>Course</div><select value={courseF} onChange={e=>setCourseF(e.target.value)} style={inp3}><option value="All">All Courses</option>{['Sainik','Navodaya','Foundation','Combined Course'].map(c=><option key={c}>{c}</option>)}</select></div>
          <div><div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase'}}>Hostel Type</div><select value={hostelF} onChange={e=>setHostelF(e.target.value)} style={inp3}><option value="All">All Types</option>{['Boarder','Day Boarder','Day Scholar'].map(h=><option key={h}>{h}</option>)}</select></div>
          <div><div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase'}}>Status</div><select value={statusF} onChange={e=>setStatusF(e.target.value)} style={inp3}><option value="All">All Status</option><option>Paid</option><option>Partial</option><option>Underpaid</option><option>Pending</option></select></div>
          <div><div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase'}}>Date From</div><input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} style={inp3}/></div>
          <div><div style={{fontSize:10,fontWeight:700,color:'#64748b',marginBottom:4,textTransform:'uppercase'}}>Date To</div><input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} style={inp3}/></div>
        </div>
        <div style={{display:'flex',gap:8,marginTop:10,flexWrap:'wrap'}}>
          <button onClick={()=>{setDateFrom(todayStr);setDateTo(todayStr)}} style={{padding:'5px 12px',borderRadius:6,border:'1px solid #bfdbfe',background:'#eff6ff',color:'#1e3a5f',fontSize:11,fontWeight:700,cursor:'pointer'}}>📅 Today</button>
          <button onClick={()=>{const d=new Date();d.setDate(1);setDateFrom(d.toLocaleDateString('en-CA'));setDateTo(todayStr)}} style={{padding:'5px 12px',borderRadius:6,border:'1px solid #d1fae5',background:'#ecfdf5',color:'#059669',fontSize:11,fontWeight:700,cursor:'pointer'}}>📅 This Month</button>
          <button onClick={()=>{const d=new Date();d.setDate(d.getDate()-30);setDateFrom(d.toLocaleDateString('en-CA'));setDateTo(todayStr)}} style={{padding:'5px 12px',borderRadius:6,border:'1px solid #ede9fe',background:'#f5f3ff',color:'#7c3aed',fontSize:11,fontWeight:700,cursor:'pointer'}}>📅 Last 30 Days</button>
          <button onClick={()=>{setCourseF('All');setHostelF('All');setStatusF('All');setDateFrom('');setDateTo('')}} style={{padding:'5px 12px',borderRadius:6,border:'1px solid #fca5a5',background:'#fef2f2',color:'#dc2626',fontSize:11,fontWeight:700,cursor:'pointer'}}>✕ Clear All</button>
        </div>
      </div>
      {lastExport&&(<div style={{background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,padding:'10px 16px',marginBottom:16,fontSize:12,fontWeight:700,color:'#16a34a',display:'flex',justifyContent:'space-between',alignItems:'center'}}>{lastExport}<button onClick={()=>setLastExport(null)} style={{background:'none',border:'none',color:'#16a34a',cursor:'pointer',fontSize:16,fontWeight:900}}>×</button></div>)}
      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:16,padding:'10px 14px',background:'#f8fafc',borderRadius:8,border:'1px solid #e2e8f0'}}>
        <span style={{fontSize:11,fontWeight:700,color:'#64748b',marginRight:4}}>FORMAT GUIDE:</span>
        {[{l:'📄 CSV',d:'Excel / Google Sheets',c:'#1e3a5f'},{l:'📋 TSV',d:'Tab-separated',c:'#059669'},{l:'📊 XLS',d:'Microsoft Excel',c:'#166534'},{l:'{ } JSON',d:'For developers',c:'#7c3aed'},{l:'🖨 Print',d:'A4 printout / PDF',c:'#d97706'}].map(f=>(<div key={f.l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:11,fontWeight:800,color:f.c}}>{f.l}</span><span style={{fontSize:10,color:'#94a3b8'}}>— {f.d}</span></div>))}
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:20}}>
        {REPORT_GROUPS.map(group=>(<div key={group.group} style={{background:'white',border:'1px solid #e2e8f0',borderRadius:14,overflow:'hidden',boxShadow:'0 2px 8px rgba(0,0,0,.05)'}}>
          <div style={{background:`linear-gradient(135deg,${group.color}15,${group.color}08)`,borderBottom:`2px solid ${group.color}20`,padding:'12px 18px',display:'flex',alignItems:'center',gap:10}}><span style={{fontSize:20}}>{group.icon}</span><div style={{fontWeight:800,fontSize:14,color:group.color}}>{group.group}</div><div style={{marginLeft:'auto',fontSize:11,color:group.color,opacity:.7}}>{group.reports.length} report{group.reports.length!==1?'s':''}</div></div>
          <div style={{padding:'0 6px 6px'}}>
            {group.reports.map((report,ri)=>{const rows=report.rows(),meta=report.meta();return(
              <div key={report.id} style={{padding:'14px 12px',borderBottom:ri<group.reports.length-1?'1px solid #f1f5f9':'none'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:14,flexWrap:'wrap'}}>
                  <div style={{flex:1,minWidth:200}}><div style={{fontSize:13,fontWeight:800,color:'#1e293b',marginBottom:3}}>{report.name}</div><div style={{fontSize:11,color:'#64748b',marginBottom:6}}>{report.desc}</div><div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{Object.entries(meta).map(([k,v])=>(<div key={k} style={{fontSize:10}}><span style={{color:'#94a3b8',fontWeight:600}}>{k}: </span><span style={{color:'#1e293b',fontWeight:800}}>{String(v)}</span></div>))}</div></div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',flexShrink:0}}><span style={{fontSize:10,color:'#94a3b8',fontWeight:700,marginRight:4}}>{rows.length} rows</span><FmtBtn format="csv" label="📄 CSV" color="#1e3a5f" onClick={()=>doExport(report,'csv')}/><FmtBtn format="tsv" label="📋 TSV" color="#059669" onClick={()=>doExport(report,'tsv')}/><FmtBtn format="xls" label="📊 XLS" color="#166534" onClick={()=>doExport(report,'xls')}/><FmtBtn format="json" label="{} JSON" color="#7c3aed" onClick={()=>doExport(report,'json')}/><FmtBtn format="print" label="🖨 Print" color="#d97706" onClick={()=>doExport(report,'print')}/></div>
                </div>
              </div>
            )})}
          </div>
        </div>))}
      </div>
      <div style={{marginTop:20,background:'#f8fafc',border:'1px solid #e2e8f0',borderRadius:12,padding:'16px 18px'}}>
        <div style={{fontSize:13,fontWeight:800,color:'#1e3a5f',marginBottom:10}}>⚡ Quick Export All Reports as CSV</div>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{REPORT_GROUPS.flatMap(g=>g.reports).map(r=>(<button key={r.id} onClick={()=>doExport(r,'csv')} style={{padding:'7px 14px',borderRadius:7,border:'1px solid #e2e8f0',background:'white',color:'#1e3a5f',fontSize:12,fontWeight:700,cursor:'pointer'}} onMouseEnter={e=>e.currentTarget.style.background='#eff6ff'} onMouseLeave={e=>e.currentTarget.style.background='white'}>📄 {r.name}</button>))}</div>
      </div>
    </div>
  )
}

const inp = {
  width: '100%', padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #d1d5db', fontSize: '14px',
  outline: 'none', boxSizing: 'border-box', backgroundColor: 'white',
}
const lbl = {
  display: 'block', fontSize: '13px', fontWeight: '600',
  color: '#374151', marginBottom: '6px',
}

const sStyle = status => ({
  padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: '600',
  backgroundColor: status === 'Paid' ? '#dcfce7' : status === 'Partial' ? '#fef9c3' : status === 'Underpaid' ? '#ffedd5' : '#fee2e2',
  color:           status === 'Paid' ? '#16a34a' : status === 'Partial' ? '#ca8a04' : status === 'Underpaid' ? '#c2410c' : '#dc2626',
})

function HostelBadge({ type }) {
  if (!type) return null
  const s = {
    'Boarder':     { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    'Day Boarder': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    'Day Scholar': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  }[type] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {type}
    </span>
  )
}

function StudentSearch({ students, onSelect, placeholder }) {
  const [q, setQ] = useState('')
  const hits = q.length > 0
    ? students.filter(s =>
        (s.name || '').toLowerCase().includes(q.toLowerCase()) ||
        String(s.gcc_no || '').includes(q)
      ).slice(0, 8)
    : []
  return (
    <div style={{ position: 'relative' }}>
      <input value={q} onChange={e => setQ(e.target.value)}
        placeholder={placeholder || 'Type name or GCC No…'} style={inp} />
      {hits.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, zIndex: 200, boxShadow: '0 4px 12px rgba(0,0,0,.12)', maxHeight: 240, overflowY: 'auto' }}>
          {hits.map(s => (
            <div key={s.id} onClick={() => { onSelect(s); setQ('') }}
              style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <strong>{s.name}</strong>
                <span style={{ color: '#64748b' }}>GCC-{s.gcc_no || '--'}</span>
                <span style={{ color: '#64748b' }}>{s.class_name || s.batch || '--'}</span>
                <span style={{ color: '#64748b' }}>{s.course || '--'}</span>
                {s.hostel_type && <HostelBadge type={s.hostel_type} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Fee Dashboard ───────────────────────────────────────────────────────

function FeeDashboardTab({ students, adm_fee_collections, adm_flat_fees, adm_course_fees, liveRows, onCollect }) {
  const w       = useWindowWidth()
  const isMobile= w < 640
  const is2Col  = w >= 640 && w < 900
  const n = v => Number(v || 0).toLocaleString('en-IN')
  const now      = new Date()
  const thisMonth= now.toLocaleString('default', { month: 'long' })
  const thisYear = now.getFullYear()
  const prevMonth= new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleString('default', { month: 'long' })

  // Today's TOTAL income across the whole institute (all categories, not just
  // fee payments) — sourced from the same `accounts` ledger Accounts.jsx reads,
  // so this always matches Accounts' "Today's Income" card exactly.
  const [todayAccountsIncome, setTodayAccountsIncome] = useState(null)
  // Month-wise Dues card — which month is drilled into, and whether every
  // month is expanded inline. Declared up-front with the other hooks (not
  // inline further down next to the derived `monthwiseDues` value) so hook
  // order stays stable regardless of future edits to the derivations below.
  const [duesMonthIdx, setDuesMonthIdx] = useState(5)
  const [duesExpanded, setDuesExpanded] = useState(false)
  useEffect(() => {
    let cancelled = false
    const todayLocal = new Date().toLocaleDateString('en-CA')
    supabase.from('accounts').select('amount,type,entry_date')
      .eq('is_soft_deleted', false).eq('type', 'Income').eq('entry_date', todayLocal)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('todayAccountsIncome fetch error:', error.message); setTodayAccountsIncome(0); return }
        setTodayAccountsIncome((data || []).reduce((s, r) => s + (Number(r.amount) || 0), 0))
      })
    return () => { cancelled = true }
  }, [])

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totalCollected  = liveRows.reduce((s, r) => s + r.grandTotal, 0)
  const admTotal        = adm_fee_collections.filter(r => !r.reverted).reduce((s, c) => s + (Number(c.amount_paid) || 0), 0)
  const flatTotal       = adm_flat_fees.filter(r => r.paid).reduce((s, r) => s + (r.amount || 0), 0)
  const crsfTotal       = adm_course_fees.filter(r => !r.reverted).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)

  // This month collections
  // FIX: r.year is stored as a STRING in Supabase ("2026"), getFullYear() returns number (2026).
  // "2026" === 2026 is always false → ₹0. Use String() to normalise both sides.
  const thisYearStr     = String(thisYear)
  const thisMonthStart  = `${thisYearStr}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const thisMonthFlat   = adm_flat_fees.filter(r => r.paid && r.month === thisMonth && String(r.year) === thisYearStr).reduce((s, r) => s + (r.amount || 0), 0)
  const thisMonthCrsf   = adm_course_fees.filter(r => !r.reverted && r.for_month === thisMonth && String(r.year) === thisYearStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const thisMonthAdm    = adm_fee_collections.filter(r => !r.reverted && r.pay_date >= thisMonthStart && r.pay_date <= todayStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const thisMonthTotal  = thisMonthFlat + thisMonthCrsf + thisMonthAdm

  const prevYearStr     = String(now.getMonth() === 0 ? thisYear - 1 : thisYear)
  const prevMonthStart  = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-CA')
  const prevMonthEnd    = new Date(now.getFullYear(), now.getMonth(), 0).toLocaleDateString('en-CA')
  const prevMonthFlat   = adm_flat_fees.filter(r => r.paid && r.month === prevMonth && String(r.year) === prevYearStr).reduce((s, r) => s + (r.amount || 0), 0)
  const prevMonthCrsf   = adm_course_fees.filter(r => !r.reverted && r.for_month === prevMonth && String(r.year) === prevYearStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const prevMonthAdm    = adm_fee_collections.filter(r => !r.reverted && r.pay_date >= prevMonthStart && r.pay_date <= prevMonthEnd).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const prevMonthTotal  = prevMonthFlat + prevMonthCrsf + prevMonthAdm
  const monthChange     = prevMonthTotal > 0 ? Math.round(((thisMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : null

  // Today's collections
  // NOTE: use local date (en-CA => YYYY-MM-DD), matching Accounts.jsx's getToday().
  // toISOString() returns the UTC date, which is a day behind local time (IST)
  // between 12:00 AM and 5:30 AM — causing Fees and Accounts to disagree on
  // "today" and show different totals for payments made in that window.
  const todayStr        = new Date().toLocaleDateString('en-CA')
  const todayFlat       = adm_flat_fees.filter(r => r.paid && r.pay_date === todayStr).reduce((s, r) => s + (r.amount || 0), 0)
  const todayCrsf       = adm_course_fees.filter(r => !r.reverted && r.pay_date === todayStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const todayAdm        = adm_fee_collections.filter(r => !r.reverted && r.pay_date === todayStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const todayTotal      = todayFlat + todayCrsf + todayAdm

  // ── Student alerts ──────────────────────────────────────────────────────────
  const paidFlatGccs    = new Set(adm_flat_fees.filter(r => r.paid).map(r => gccStr(r.adm_app_id)))
  const paidCrsfGccs    = new Set(adm_course_fees.filter(r => !r.reverted).map(r => gccStr(r.adm_app_id)))
  const paidAdmGccs     = new Set(adm_fee_collections.filter(r => !r.reverted && r.fee_type === 'admission').map(r => gccStr(r.adm_app_id)))

  const zeroPayment     = liveRows.filter(s => s.grandTotal === 0)
  const admOnlyPaid     = liveRows.filter(s => paidAdmGccs.has(gccStr(s.gcc_no)) && !paidFlatGccs.has(gccStr(s.gcc_no)) && !paidCrsfGccs.has(gccStr(s.gcc_no)))
  const repeaters       = liveRows.filter(s => s.is_repeater && s.grandTotal === 0)
  const fullyPaid       = liveRows.filter(s => paidFlatGccs.has(gccStr(s.gcc_no)) && paidCrsfGccs.has(gccStr(s.gcc_no)))

  // This month defaulters — paid no course fee this month
  const paidThisMonthCrsf = new Set(adm_course_fees.filter(r => !r.reverted && r.for_month === thisMonth && String(r.year) === thisYearStr).map(r => gccStr(r.adm_app_id)))
  const defaultersThisMonth = liveRows.filter(s => !paidThisMonthCrsf.has(gccStr(s.gcc_no)))

  // ── Monthly trend (last 6 months) ───────────────────────────────────────────
  const last6 = Array.from({ length: 6 }, (_, i) => {
    const d      = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const mon    = d.toLocaleString('default', { month: 'short' })
    const yrStr  = String(d.getFullYear())
    const fullMon= d.toLocaleString('default', { month: 'long' })
    const mStart = d.toLocaleDateString('en-CA')
    const mEnd   = new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA')
    const flat   = adm_flat_fees.filter(r => r.paid && r.month === fullMon && String(r.year) === yrStr).reduce((s, r) => s + (r.amount || 0), 0)
    const crsf   = adm_course_fees.filter(r => !r.reverted && r.for_month === fullMon && String(r.year) === yrStr).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
    const adm    = adm_fee_collections.filter(r => !r.reverted && r.pay_date >= mStart && r.pay_date <= mEnd).reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
    // Flag the current calendar month — it's still in progress, so its total
    // isn't comparable to fully-elapsed past months (see: July showing a
    // "drop" that was actually just 26/31 days of collection so far).
    const isCurrent = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    return { label: mon, flat, crsf, adm, total: flat + crsf + adm, isCurrent, dayOfMonth: now.getDate() }
  })
  const maxBar = Math.max(...last6.map(m => m.total), 1)

  // ── Course-wise breakdown ───────────────────────────────────────────────────
  const courses = ['Sainik', 'Navodaya', 'Foundation', 'Combined Course']
  const courseBreakdown = courses.map(c => {
    const sts   = liveRows.filter(s => s.course === c)
    const total = sts.reduce((s, r) => s + r.grandTotal, 0)
    return { course: c, count: sts.length, total }
  }).filter(c => c.count > 0)
  const maxCourse = Math.max(...courseBreakdown.map(c => c.total), 1)

  // ── Month-wise Dues (course fee) ────────────────────────────────────────────
  // For each of the last 6 months: expected course-fee total (active students ×
  // COURSE_RATES[course][hostel_type]) vs what was actually collected for that
  // for_month/year — the gap is the outstanding due, drillable per student.
  //
  // PERF: naive version re-filtered adm_course_fees per student per month
  // (students × 6 × course-fee rows comparisons on every render). Pre-index
  // course-fee rows once per `adm_course_fees` change into a
  // `"month|year|gcc" -> amount` map, then each month/student lookup is O(1).
  // Index BOTH the amount paid AND the course/hostel_type *that was actually
  // recorded on the payment row* (collectFee stamps these at payment time —
  // see feeEngine.js `adm_course_fees` upsert). This is the real historical
  // snapshot: a student who changed course or hostel_type after March still
  // shows March's payment priced at March's rate, not today's rate.
  const crsfByMonthGcc = useMemo(() => {
    const map = new Map()
    for (const r of adm_course_fees) {
      if (r.reverted || !r.for_month || !r.year) continue
      const key = `${r.for_month}|${r.year}|${gccStr(r.adm_app_id)}`
      const prev = map.get(key)
      map.set(key, {
        paid: (prev?.paid || 0) + (Number(r.amount_paid) || 0),
        course: r.course || prev?.course || null,
        hostel_type: r.hostel_type || prev?.hostel_type || null,
      })
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adm_course_fees])

  // Same per-month/per-student indexing for FLAT fee, mirroring crsfByMonthGcc
  // above — needed because Feb/Mar only ever had flat fee (course fee starts
  // April), so those months need real flat-fee numbers instead of the
  // course-fee "no data" placeholder.
  const flatByMonthGcc = useMemo(() => {
    const map = new Map()
    for (const r of adm_flat_fees) {
      if (!r.paid || !r.month || !r.year) continue
      const key = `${r.month}|${r.year}|${gccStr(r.adm_app_id)}`
      const prev = map.get(key)
      map.set(key, {
        paid: (prev?.paid || 0) + (Number(r.amount) || 0),
        hostel_type: r.hostel_type || prev?.hostel_type || null,
      })
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adm_flat_fees])

  const monthwiseDues = useMemo(() => Array.from({ length: 6 }, (_, idx) => {
    const d       = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1)
    const label   = d.toLocaleString('default', { month: 'short' })
    const fullMon = d.toLocaleString('default', { month: 'long' })
    const yrStr   = String(d.getFullYear())
    const isCurrent = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()

    // Flat fee — tracked every month, always computed.
    const flatPerStudent = liveRows.map(s => {
      const rec  = flatByMonthGcc.get(`${fullMon}|${yrStr}|${gccStr(s.gcc_no)}`)
      const paid = rec?.paid || 0
      const expected = paid > 0
        ? (FLAT_RATES[rec.hostel_type] ?? FLAT_RATES[s.hostel_type] ?? 0)
        : (FLAT_RATES[s.hostel_type] ?? 0)
      return { student: s, expected, paid, due: Math.max(0, expected - paid) }
    }).filter(x => x.expected > 0)
    const flatExpectedTotal  = flatPerStudent.reduce((s, x) => s + x.expected, 0)
    // IMPORTANT: collectedTotal for the *headline* is capped per-student at
    // their own `expected` (Math.min(x.paid, x.expected)), NOT the raw sum
    // of x.paid. A student who overpaid or has an advance/duplicate payment
    // for the month would otherwise inflate this total enough to mask real
    // dues from OTHER students when dueTotal was computed as a single
    // subtraction (expectedTotal - collectedTotal) — that let one
    // overpayment cancel out many real defaulters in the aggregate, even
    // though each defaulter still correctly showed up in the drill-down
    // list below. dueTotal is now the sum of each student's own due, which
    // can never be silently offset by someone else's overpayment.
    const flatCollectedCapped = flatPerStudent.reduce((s, x) => s + Math.min(x.paid, x.expected), 0)
    const flatCollectedTotal = flatPerStudent.reduce((s, x) => s + x.paid, 0) // raw total, kept for reference/exports
    const flatDueTotal       = flatPerStudent.reduce((s, x) => s + x.due, 0)
    const flatDefaulters     = flatPerStudent.filter(x => x.due > 0).sort((a, b) => b.due - a.due)

    // Course fee — only started from April of the current session (see note
    // below); Jan/Feb/Mar are "not tracked" unless a payment actually exists.
    const monthIdx0based = d.getMonth() // 0=Jan..11=Dec
    const isPreSessionMonth = monthIdx0based < 3 // Jan/Feb/Mar
    const hasAnyCrsfPayment = adm_course_fees.some(r => !r.reverted && r.for_month === fullMon && String(r.year) === yrStr)
    const isCourseFeeTracked = !isPreSessionMonth || hasAnyCrsfPayment
    const crsfPerStudent = !isCourseFeeTracked ? [] : liveRows.map(s => {
      const rec  = crsfByMonthGcc.get(`${fullMon}|${yrStr}|${gccStr(s.gcc_no)}`)
      const paid = rec?.paid || 0
      // Paid this month → price at the course/hostel_type recorded ON that
      // payment (historical rate). Not yet paid → no snapshot exists yet,
      // so fall back to their current course/hostel_type as the best
      // available estimate of what they owe.
      const expected = paid > 0
        ? (COURSE_RATES[rec.course]?.[rec.hostel_type] ?? COURSE_RATES[s.course]?.[s.hostel_type] ?? 0)
        : (COURSE_RATES[s.course]?.[s.hostel_type] ?? 0)
      return { student: s, expected, paid, due: Math.max(0, expected - paid) }
    }).filter(x => x.expected > 0)
    const crsfExpectedTotal  = crsfPerStudent.reduce((s, x) => s + x.expected, 0)
    const crsfCollectedCapped = crsfPerStudent.reduce((s, x) => s + Math.min(x.paid, x.expected), 0)
    const crsfCollectedTotal = crsfPerStudent.reduce((s, x) => s + x.paid, 0) // raw total, kept for reference/exports
    const crsfDueTotal       = crsfPerStudent.reduce((s, x) => s + x.due, 0)
    const crsfDefaulters     = crsfPerStudent.filter(x => x.due > 0).sort((a, b) => b.due - a.due)

    // Card headline: use course fee where it's tracked (Apr onward), fall
    // back to flat fee for Feb/Mar so those cards show real numbers instead
    // of "no course-fee data".
    const useFlat = !isCourseFeeTracked
    const expectedTotal  = useFlat ? flatExpectedTotal  : crsfExpectedTotal
    // % shown on the card uses the CAPPED collected figure, so one
    // overpaying student can't push the percentage past what was actually
    // owed for everyone else that month.
    const collectedTotal = useFlat ? flatCollectedCapped : crsfCollectedCapped
    const dueTotal        = useFlat ? flatDueTotal        : crsfDueTotal
    const defaulters      = useFlat ? flatDefaulters      : crsfDefaulters

    return {
      label, fullMon, year: yrStr, isCurrent, dayOfMonth: now.getDate(),
      isTracked: useFlat ? flatExpectedTotal > 0 : isCourseFeeTracked,
      headlineType: useFlat ? 'Flat Fee' : 'Course Fee',
      expectedTotal, collectedTotal, dueTotal,
      defaulterCount: defaulters.length, defaulters,
      // Both breakdowns always available for the expanded/drill-down view.
      flat:   { expectedTotal: flatExpectedTotal,  collectedTotal: flatCollectedCapped,  dueTotal: flatDueTotal,  defaulters: flatDefaulters },
      course: { expectedTotal: crsfExpectedTotal, collectedTotal: crsfCollectedCapped, dueTotal: crsfDueTotal, defaulters: crsfDefaulters, isTracked: isCourseFeeTracked },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [liveRows, crsfByMonthGcc, flatByMonthGcc, adm_course_fees])
  const selectedDues = monthwiseDues[duesMonthIdx] ?? monthwiseDues[monthwiseDues.length - 1] ?? null

  // ── Hostel breakdown ────────────────────────────────────────────────────────
  const hostelBreakdown = ['Boarder', 'Day Boarder', 'Day Scholar'].map(h => {
    const sts   = liveRows.filter(s => s.hostel_type === h)
    const total = sts.reduce((s, r) => s + r.grandTotal, 0)
    return { type: h, count: sts.length, total }
  }).filter(h => h.count > 0)

  const COURSE_COLORS = { Sainik: '#4f46e5', Navodaya: '#059669', Foundation: '#d97706', 'Combined Course': '#7c3aed' }
  const HOSTEL_COLORS = { Boarder: '#059669', 'Day Boarder': '#d97706', 'Day Scholar': '#64748b' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Top stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5, 1fr)', gap: 14 }}>
        {[{ icon: '💰', label: 'Total Collected', value: `₹${n(totalCollected)}`, color: '#1e3a5f', bg: '#eff6ff', sub: `${students.length} students` },
          { icon: '📅', label: 'This Month', value: `₹${n(thisMonthTotal)}`, color: '#059669', bg: '#f0fdf4',
            sub: monthChange !== null ? `${monthChange >= 0 ? '▲' : '▼'} ${Math.abs(monthChange)}% vs last month` : 'First month data' },
          { icon: '🌅', label: "Today's Fee Collection", value: `₹${n(todayTotal)}`, color: '#7c3aed', bg: '#f5f3ff', sub: todayStr + ' · fee payments only' },
          { icon: '📊', label: "Today's Total Income", value: todayAccountsIncome === null ? '…' : `₹${n(todayAccountsIncome)}`, color: '#0e7490', bg: '#ecfeff', sub: todayStr + ' · all income (Accounts)' },
          { icon: '⚠️', label: 'No Payment Yet', value: zeroPayment.length, color: '#dc2626', bg: '#fef2f2', sub: 'students with ₹0 paid' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '16px 18px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 24, marginBottom: 6 }}>{c.icon}</div>
            <div style={{ fontSize: 12, color: c.color, fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: c.color, opacity: .7, marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Second row cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 14 }}>
        {[{ icon: '🎓', label: 'Admission Fees', value: `₹${n(admTotal)}`, color: '#4f46e5', bg: '#eef2ff' },
          { icon: '📅', label: 'Flat Fees', value: `₹${n(flatTotal)}`, color: '#059669', bg: '#f0fdf4' },
          { icon: '📚', label: 'Course Fees', value: `₹${n(crsfTotal)}`, color: '#7c3aed', bg: '#f5f3ff' },
          { icon: '✅', label: 'Fully Paid', value: fullyPaid.length, color: '#059669', bg: '#dcfce7', sub: 'flat + course both paid' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
            <div style={{ fontSize: 11, color: c.color, fontWeight: 600, marginBottom: 3 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</div>
            {c.sub && <div style={{ fontSize: 10, color: c.color, opacity: .7, marginTop: 3 }}>{c.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 20 }}>

        {/* ── Monthly trend bar chart ── */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>📈 Monthly Collection Trend</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Last 6 months — flat + course fees</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 140 }}>
            {last6.map(m => (
              <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#1e3a5f' }}>
                  {m.total > 0 ? `₹${Math.round(m.total / 1000)}k` : '—'}
                </div>
                <div style={{
                  width: '100%', display: 'flex', flexDirection: 'column', gap: 1,
                  outline: m.isCurrent ? '2px dashed #94a3b8' : 'none',
                  outlineOffset: m.isCurrent ? 2 : 0,
                  borderRadius: m.isCurrent ? 4 : 0,
                }}>
                  <div style={{ width: '100%', height: Math.max(2, Math.round((m.adm  / maxBar) * 100)), background: '#4f46e5', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ width: '100%', height: Math.max(2, Math.round((m.crsf / maxBar) * 100)), background: '#7c3aed' }} />
                  <div style={{ width: '100%', height: Math.max(2, Math.round((m.flat / maxBar) * 100)), background: '#059669', borderRadius: '0 0 3px 3px' }} />
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: m.isCurrent ? '#7c3aed' : '#64748b' }}>
                  {m.label}{m.isCurrent ? ' •' : ''}
                </div>
                {m.isCurrent && (
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', padding: '1px 6px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    in progress · day {m.dayOfMonth}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
            <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#4f46e5', borderRadius: 2, display: 'inline-block' }} />Adm</span>
            <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#7c3aed', borderRadius: 2, display: 'inline-block' }} />Course</span>
            <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 10, background: '#059669', borderRadius: 2, display: 'inline-block' }} />Flat</span>
          </div>
        </div>

        {/* ── Hostel breakdown ── */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>🏠 Hostel Breakdown</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Collection by hostel type</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {hostelBreakdown.map(h => (
              <div key={h.type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: HOSTEL_COLORS[h.type] || '#64748b', marginBottom: 4 }}>
                  <span>{h.type} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({h.count})</span></span>
                  <span>₹{n(h.total)}</span>
                </div>
                <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((h.total / (liveRows.reduce((s, r) => s + r.grandTotal, 1))) * 100)}%`, background: HOSTEL_COLORS[h.type] || '#64748b', borderRadius: 4, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Month-wise Dues grid ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f' }}>🗓️ Month-wise Dues (Flat + Course Fee)</div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>Expected vs collected — tap a month to see who still owes</div>
          </div>
          <button onClick={() => setDuesExpanded(e => !e)}
            style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 7, border: '1px solid #e2e8f0', background: duesExpanded ? '#1e3a5f' : 'white', color: duesExpanded ? 'white' : '#1e3a5f', cursor: 'pointer' }}>
            {duesExpanded ? '↕ Collapse' : '↕ Expand All'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(6, 1fr)', gap: 10, marginTop: 14 }}>
          {monthwiseDues.map((m, idx) => {
            const pctRaw   = m.expectedTotal > 0 ? Math.round((m.collectedTotal / m.expectedTotal) * 100) : null
            // Clamp for display: collected can legitimately exceed the
            // "expected" estimate (advances, or a rate mismatch for a
            // student who changed course/hostel mid-year) — showing 101%+
            // reads as a data-integrity bug even when it's just an estimate
            // ceiling, so cap what's shown at 100 and let the ₹ due (which
            // is separately floored at 0) tell the true story.
            const pct      = pctRaw === null ? null : Math.min(100, pctRaw)
            const isSel    = idx === duesMonthIdx
            const hasDue   = m.dueTotal > 0
            const cardColor= hasDue ? '#dc2626' : (m.expectedTotal > 0 ? '#059669' : '#94a3b8')
            return (
              <button key={m.label + m.year} onClick={() => setDuesMonthIdx(idx)}
                style={{
                  textAlign: 'left', cursor: 'pointer', border: isSel ? `2px solid ${cardColor}` : '1px solid #e2e8f0',
                  borderRadius: 10, padding: '10px 12px', background: isSel ? (hasDue ? '#fef2f2' : '#f0fdf4') : 'white',
                  boxShadow: isSel ? '0 2px 8px rgba(0,0,0,.08)' : 'none', transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#1e3a5f' }}>{m.label}{m.isCurrent ? ' •' : ''}</span>
                  {hasDue && <span style={{ fontSize: 9, fontWeight: 800, background: '#dc2626', color: 'white', padding: '1px 6px', borderRadius: 99 }}>{m.defaulterCount}</span>}
                </div>
                <div style={{ fontSize: 9, fontWeight: 700, color: m.headlineType === 'Flat Fee' ? '#059669' : '#7c3aed', marginTop: 3 }}>
                  {m.headlineType}
                </div>
                <div style={{ fontSize: 15, fontWeight: 900, color: cardColor, marginTop: 2 }}>
                  {m.expectedTotal > 0 ? `₹${n(m.dueTotal)}` : '—'}
                </div>
                <div style={{ fontSize: 9.5, color: '#94a3b8', marginTop: 2 }}>
                  {m.expectedTotal > 0 ? `${pct}% collected of ₹${n(m.expectedTotal)}` : 'no fee data'}
                </div>
                {m.isCurrent && (
                  <div style={{ fontSize: 8.5, fontWeight: 700, color: '#7c3aed', marginTop: 3 }}>
                    in progress · day {m.dayOfMonth}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Drill-down: expanded shows every month stacked; collapsed shows only the selected month */}
        {duesExpanded ? (
          <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
            {monthwiseDues.map(md => (
              <div key={md.label + md.year}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1e3a5f' }}>
                    {md.fullMon} {md.year} — {md.defaulterCount} student{md.defaulterCount !== 1 ? 's' : ''} due
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: md.dueTotal > 0 ? '#dc2626' : '#059669' }}>
                    ₹{n(md.dueTotal)} outstanding
                  </div>
                </div>
                <div style={{ borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  {md.defaulters.length === 0 ? (
                    <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>🎉 No dues for this month</div>
                  ) : md.defaulters.map(x => (
                    <div key={x.student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f8fafc' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{x.student.name}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          GCC-{x.student.gcc_no} · {x.student.course || '—'} · {x.student.hostel_type || '—'} · paid ₹{n(x.paid)} of ₹{n(x.expected)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>₹{n(x.due)}</span>
                        <button onClick={() => onCollect(x.student)}
                          style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>
                          Collect
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : selectedDues && (
          <div style={{ marginTop: 16, borderTop: '1px solid #f1f5f9', paddingTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#1e3a5f' }}>
                {selectedDues.fullMon} {selectedDues.year} — {selectedDues.defaulterCount} student{selectedDues.defaulterCount !== 1 ? 's' : ''} due
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: selectedDues.dueTotal > 0 ? '#dc2626' : '#059669' }}>
                ₹{n(selectedDues.dueTotal)} outstanding
              </div>
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', borderRadius: 8, border: '1px solid #f1f5f9' }}>
              {selectedDues.defaulters.length === 0 ? (
                <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>🎉 No dues for this month</div>
              ) : selectedDues.defaulters.map(x => (
                <div key={x.student.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f8fafc' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{x.student.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>
                      GCC-{x.student.gcc_no} · {x.student.course || '—'} · {x.student.hostel_type || '—'} · paid ₹{n(x.paid)} of ₹{n(x.expected)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#dc2626' }}>₹{n(x.due)}</span>
                    <button onClick={() => onCollect(x.student)}
                      style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>
                      Collect
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Course-wise breakdown ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 4 }}>📚 Course-wise Collection</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 16 }}>Total collected per course</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {courseBreakdown.map(c => (
            <div key={c.course} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '140px 1fr 80px', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: COURSE_COLORS[c.course] || '#64748b' }}>{c.course} <span style={{ fontWeight: 400, color: '#94a3b8' }}>({c.count})</span></div>
              <div style={{ height: 10, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((c.total / maxCourse) * 100)}%`, background: COURSE_COLORS[c.course] || '#64748b', borderRadius: 5, transition: 'width .4s' }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: COURSE_COLORS[c.course] || '#64748b', textAlign: 'right' }}>₹{n(c.total)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Smart Alerts ── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>

        {/* No payment */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fca5a5', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fef2f2', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fca5a5' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>🔴 Zero Payment Students</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#dc2626', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{zeroPayment.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {zeroPayment.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>🎉 All students have made at least one payment</div>
              : zeroPayment.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fef2f2' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* This month defaulters */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fde68a', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fffbeb', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fde68a' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#d97706' }}>🟡 {thisMonth} Course Fee Pending</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#d97706', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{defaultersThisMonth.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {defaultersThisMonth.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>✅ All students paid course fee for {thisMonth}</div>
              : defaultersThisMonth.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fffbeb' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'} · {s.hostel_type || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#d97706', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Adm paid, no monthly yet */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #c4b5fd', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#f5f3ff', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #c4b5fd' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#7c3aed' }}>🟠 Adm Paid · No Monthly Yet</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#7c3aed', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{admOnlyPaid.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {admOnlyPaid.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>All students paying monthly fees</div>
              : admOnlyPaid.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #f5f3ff' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#7c3aed', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Repeaters with dues */}
        <div style={{ background: 'white', borderRadius: 14, border: '1px solid #fcd34d', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
          <div style={{ background: '#fef3c7', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #fcd34d' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e' }}>🔁 Repeaters — Pending</div>
            <span style={{ fontSize: 11, fontWeight: 800, background: '#92400e', color: 'white', padding: '2px 8px', borderRadius: 99 }}>{repeaters.length}</span>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {repeaters.length === 0
              ? <div style={{ padding: '16px', fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>No repeater students with pending dues</div>
              : repeaters.map(s => (
                <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #fef3c7' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#1e293b' }}>{s.name}</div>
                    <div style={{ fontSize: 10, color: '#94a3b8' }}>GCC-{s.gcc_no} · {s.course || '—'}</div>
                  </div>
                  <button onClick={() => onCollect(s)}
                    style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', background: '#92400e', color: 'white', cursor: 'pointer' }}>
                    Collect
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      </div>

      {/* ── Session progress bars ── */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e2e8f0', padding: '18px 20px', boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e3a5f', marginBottom: 16 }}>📊 Session Progress</div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : is2Col ? '1fr 1fr' : '1fr 1fr 1fr', gap: 20 }}>
          {[
            { label: 'Paid Admission', count: paidAdmGccs.size,  color: '#4f46e5', bg: '#eef2ff' },
            { label: 'Paid Flat Fee',  count: paidFlatGccs.size, color: '#059669', bg: '#f0fdf4' },
            { label: 'Paid Course Fee',count: paidCrsfGccs.size, color: '#7c3aed', bg: '#f5f3ff' },
          ].map(p => {
            const pct = students.length > 0 ? Math.round((p.count / students.length) * 100) : 0
            return (
              <div key={p.label} style={{ background: p.bg, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700, color: p.color, marginBottom: 8 }}>
                  <span>{p.label}</span>
                  <span>{p.count} / {students.length}</span>
                </div>
                <div style={{ height: 10, background: 'white', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: p.color, borderRadius: 5, transition: 'width .5s' }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 900, color: p.color }}>{pct}%</div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ── Parent WhatsApp helpers ─────────────────────────────────────────────────
// Tries the common column names used for a guardian's contact number across
// this schema's history (student records were entered by different staff
// over the years, so the field name isn't fully standardized). Returns a
// clean international-format number (91XXXXXXXXXX) for wa.me, or null if no
// usable number is on file.
function getParentPhone(student) {
  if (!student) return null
  const raw = student.guardian_phone || student.father_phone || student.mother_phone ||
    student.parent_phone || student.guardian_mobile || student.mobile || student.phone ||
    student.contact_no || student.contact_number || ''
  const digits = String(raw).replace(/\D/g, '')
  if (digits.length < 10) return null
  // Already has country code (12 digits starting 91) -> use as-is.
  // Bare 10-digit Indian mobile -> prefix 91. Anything else -> pass through
  // digits as given (covers already-E.164 non-Indian numbers on file).
  if (digits.length === 10) return `91${digits}`
  return digits
}

function itemDisplayLabel(item) {
  if (item.label) return item.label
  switch (item.kind) {
    case 'admission': return 'Admission Fee'
    case 'flat':       return `Flat Fee — ${item.month || ''} ${item.year || ''}`.trim()
    case 'course':     return `Course Fee (${item.course || ''}${item.subtype ? ' · ' + item.subtype : ''}) — ${item.month || ''} ${item.year || ''}`.trim()
    case 'advance':    return 'Advance Payment'
    default:           return 'Fee'
  }
}

function buildFeeReceiptWaMessage({ studentName, gcc, receiptNo, total, payDate, items }) {
  const lines = [
    `Dear Parent,`,
    ``,
    `Fee payment received for *${studentName}* (GCC-${gcc}) at GNSI.`,
    ``,
    `Receipt No: ${receiptNo}`,
    `Date: ${payDate}`,
    `Amount Paid: ₹${Number(total || 0).toLocaleString('en-IN')}`,
  ]
  if (items && items.length) {
    lines.push(``, `Details:`)
    items.forEach(i => lines.push(`• ${itemDisplayLabel(i)} — ₹${Number(i.amount || 0).toLocaleString('en-IN')}`))
  }
  lines.push(``, `Thank you,`, `Guidance Navodaya & Sainik Institute (GNSI)`)
  return lines.join('\n')
}

function buildWaLink(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
}

// ─── Tab: Fee Payment ─────────────────────────────────────────────────────────

function FeePaymentTab({ students, admissions, adm_fee_collections, adm_flat_fees, adm_course_fees, onRefresh, isAdmin, currentUser, presetStudent, onPresetConsumed }) {
  const w        = useWindowWidth()
  const isMobile = w < 768
  const [step,    setStep]    = useState('select')
  const [student, setStudent] = useState(null)
  const [admRec,  setAdmRec]  = useState(null)

  const [payMode,     setPayMode]     = useState('Cash')
  const [payDate,     setPayDate]     = useState(today())
  const [txnRef,      setTxnRef]      = useState('')
  const [collectedBy, setCollectedBy] = useState('Admin')
  const [saving,      setSaving]      = useState(false)
  const [toast,       setToast]       = useState(null)
  // Populated right after a successful collectFee() — drives the "Send
  // receipt on WhatsApp" action. Cleared whenever a different student is
  // selected so a stale receipt can't be sent for the wrong student.
  const [lastPayment, setLastPayment] = useState(null)

  const [admFeeAmt,    setAdmFeeAmt]    = useState(ADM_FEE_BASE)
  const [dressChecked, setDressChecked] = useState(DRESS_ITEMS.map(() => true))
  const [prospChecked, setProspChecked] = useState(true)
  const [crsfRows,     setCrsfRows]     = useState([{ course: '', subtype: '', hostelType: '', for_month: '', amount: '' }])
  const [advAmt,       setAdvAmt]       = useState('')
  const [advFor,       setAdvFor]       = useState('')

  const hostelType = student?.hostel_type || 'Day Scholar'

  // ✦ Bug fix: every fee rate lookup below previously used
  // `${CURRENT_YEAR}-${CURRENT_YEAR + 1}` (today's computed session)
  // regardless of which session the student was actually admitted in. A
  // student admitted in 2024-2025 was being billed at whatever the
  // CURRENT session's rates were, not their own. Now uses the student's
  // own `session` field first, falling back to today's session only when
  // that's missing (legacy records predating session tracking).
  const sessionYear = student?.session || `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`

  // ── Async flat fees + rates ───────────────────────────────────────────────
  const [flatFees,  setFlatFees]  = useState([])
  const [feeRates,  setFeeRates]  = useState({ flatFee: 0, courseFee: 0, admissionFee: ADM_FEE_BASE })

  useEffect(() => {
    if (!student) return
    const gccInt = parseInt(gccStr(student.gcc_no)) || null
    getFlatFees(hostelType, student.course || '', student.batch || '', sessionYear, gccInt)
      .then(setFlatFees)
    getFeeRates(
      sessionYear,
      student.course || '', student.batch || '', hostelType, gccInt
    ).then(rates => {
      setFeeRates(rates)
      setHasOverride(!!rates.flatFeeOverride)
      if (rates.flatFeeOverride) {
        setOverrideAmt(String(rates.flatFeeOverride.flat_fee_override))
        setOverrideReason(rates.flatFeeOverride.reason || '')
      } else {
        setOverrideAmt('')
        setOverrideReason('')
      }
    })
  }, [student, hostelType, sessionYear])

  const [flatChecked, setFlatChecked] = useState([])

  // ── Repeater state ────────────────────────────────────────────────────────
  const [isRepeater,     setIsRepeater]     = useState(false)
  const [repeaterSaving, setRepeaterSaving] = useState(false)

  // ── Admission date state — required before any fee can be collected,
  // matching the same requirement already enforced in FeeCollectionModal.jsx.
  // Fees.jsx previously never fetched or displayed this field at all.
  const [admissionDate,   setAdmissionDate]   = useState('')
  const [admDateSaving,   setAdmDateSaving]   = useState(false)

  // ── Flat fee override state ───────────────────────────────────────────────
  const [hasOverride,      setHasOverride]      = useState(false)
  const [overrideMode,     setOverrideMode]     = useState(false)
  const [overrideAmt,      setOverrideAmt]      = useState('')
  const [overrideReason,   setOverrideReason]   = useState('')
  const [overrideSaving,   setOverrideSaving]   = useState(false)
  const [overrideFeedback, setOverrideFeedback] = useState(null)

  useEffect(() => {
    if (!student?.gcc_no) return
    supabase
      .from('students')
      .select('is_repeater, admission_date')
      .eq('gcc_no', parseInt(student.gcc_no))
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setIsRepeater(!!data.is_repeater)
          setAdmissionDate(data.admission_date || '')
        }
      })
  }, [student?.gcc_no])

  const toggleRepeater = async () => {
    if (!student?.gcc_no) return
    const newVal = !isRepeater
    setRepeaterSaving(true)
    await supabase
      .from('students')
      .update({ is_repeater: newVal })
      .eq('gcc_no', parseInt(student.gcc_no))
    setIsRepeater(newVal)
    setRepeaterSaving(false)
  }

  const saveAdmissionDate = async (val) => {
    if (!student?.gcc_no) return
    setAdmissionDate(val)
    if (!val) return
    setAdmDateSaving(true)
    await supabase
      .from('students')
      .update({ admission_date: val })
      .eq('gcc_no', parseInt(student.gcc_no))
    setAdmDateSaving(false)
  }

  const saveOverrideInline = async () => {
    const amt = parseFloat(overrideAmt)
    if (isNaN(amt) || amt < 0) { setOverrideFeedback({ type: 'err', msg: 'Enter a valid amount.' }); return }
    const gccInt = parseInt(gcc) || null
    if (!gccInt) return
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(gccInt, sessionYear, amt, overrideReason, 'admin')
      clearFeeRateCache()
      const rates = await getFeeRates(sessionYear, student.course || '', student.batch || '', hostelType, gccInt)
      setFeeRates(rates)
      setHasOverride(true)
      const updated = await getFlatFees(hostelType, student.course || '', student.batch || '', sessionYear, gccInt)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: `Flat fee set to ₹${amt.toLocaleString('en-IN')}/month.` })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Save failed.' })
    } finally { setOverrideSaving(false) }
  }

  const removeOverrideInline = async () => {
    if (!window.confirm('Remove override? This student will revert to the standard flat fee rate.')) return
    const gccInt = parseInt(gcc) || null
    if (!gccInt) return
    setOverrideSaving(true)
    try {
      await saveStudentFlatFeeOverride(gccInt, sessionYear, null)
      clearFeeRateCache()
      const rates = await getFeeRates(sessionYear, student.course || '', student.batch || '', hostelType, null)
      setFeeRates(rates)
      setHasOverride(false)
      setOverrideAmt('')
      setOverrideReason('')
      const updated = await getFlatFees(hostelType, student.course || '', student.batch || '', sessionYear, null)
      setFlatFees(updated)
      setOverrideMode(false)
      setOverrideFeedback({ type: 'ok', msg: 'Override removed. Standard rate restored.' })
    } catch (err) {
      setOverrideFeedback({ type: 'err', msg: err.message || 'Remove failed.' })
    } finally { setOverrideSaving(false) }
  }

  const showToast = (msg, color = '#16a34a') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3500)
  }

  // ── Admin-only revert ───────────────────────────────────────────────────
  const doRevert = async ({ table, id, label, accountSourceRef = null, accountSourceType = null }) => {
    if (!isAdmin) return
    const reason = window.prompt(`Revert "${label}"?\n\nThis removes it from the books and lets it be re-collected. Reason (optional):`)
    if (reason === null) return // cancelled
    setSaving(true)
    try {
      await revertFeeCollection({
        table, id, accountSourceRef, accountSourceType,
        revertedBy: currentUser?.name || 'Admin', reason,
      })
      showToast(`↩️ Reverted: ${label}`, '#dc2626')
      onRefresh()
    } catch (err) {
      showToast('Revert failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const handleRevertAdmCollection = (c) => {
    const { ref, type } = admCollectionAcct(c)
    doRevert({ table: 'adm_fee_collections', id: c.id, label: `${c.description || 'Fee'} — ₹${Number(c.amount_paid || 0).toLocaleString('en-IN')}`, accountSourceRef: ref, accountSourceType: type })
  }

  const handleRevertFlat = (month) => {
    const r = myFlatRecs.find(r => r.month === month)
    if (!r) return
    doRevert({ table: 'adm_flat_fees', id: r.id, label: `${r.month} ${r.year} flat fee — ₹${Number(r.amount || 0).toLocaleString('en-IN')}`, accountSourceRef: sourceRef.flatFee(gcc, r.month, r.year), accountSourceType: 'flat_fee' })
  }

  const handleRevertCourseFee = (r) => {
    doRevert({ table: 'adm_course_fees', id: r.id, label: `${r.course} ${r.for_month} course fee — ₹${Number(r.amount_paid || 0).toLocaleString('en-IN')}`, accountSourceRef: sourceRef.courseFee(gcc, r.for_month, r.year), accountSourceType: 'course_fee' })
  }

  // ── Admin-only: fix a mistakenly-entered payment date (without reverting) ──
  function admCollectionAcct(c) {
    return {
      ref: c.fee_type === 'admission' ? sourceRef.admission(gcc)
        : c.fee_type === 'item' ? sourceRef.admItem(gcc, c.description === 'Prospectus' ? 'prospectus' : (c.description || '').replace(/^Dress Kit — /, ''))
        : c.fee_type === 'advance' ? c.id
        : null,
      type: c.fee_type === 'advance' ? 'advance_fee' : 'adm_fee',
    }
  }

  const handleFixDate = async ({ table, id, accountSourceRef, accountSourceType, currentDate, label }) => {
    if (!isAdmin) return
    const newDate = window.prompt(`Correct date for "${label}"\nCurrent: ${currentDate || '—'}\n\nEnter correct date (YYYY-MM-DD):`, currentDate || today())
    if (!newDate) return // cancelled
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) { showToast('Invalid date — use YYYY-MM-DD', '#dc2626'); return }
    setSaving(true)
    try {
      await correctFeeCollectionDate({ table, id, newDate, accountSourceRef, accountSourceType })
      showToast(`📅 Date corrected to ${newDate}`, '#1e3a5f')
      onRefresh()
    } catch (err) {
      showToast('Date fix failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const handleFixAdmDate = (c) => {
    const { ref, type } = admCollectionAcct(c)
    handleFixDate({ table: 'adm_fee_collections', id: c.id, accountSourceRef: ref, accountSourceType: type, currentDate: c.pay_date, label: c.description || 'Fee' })
  }

  const handleFixFlatDate = (month) => {
    const r = myFlatRecs.find(r => r.month === month)
    if (!r) return
    handleFixDate({ table: 'adm_flat_fees', id: r.id, accountSourceRef: sourceRef.flatFee(gcc, r.month, r.year), accountSourceType: 'flat_fee', currentDate: r.pay_date, label: `${r.month} ${r.year} flat fee` })
  }

  const handleFixCourseDate = (r) => {
    handleFixDate({ table: 'adm_course_fees', id: r.id, accountSourceRef: sourceRef.courseFee(gcc, r.for_month, r.year), accountSourceType: 'course_fee', currentDate: r.pay_date, label: `${r.course} ${r.for_month} course fee` })
  }

  // Builds the pending-charge line items from current form state — shared by
  // the Cash/Bank/UPI-manual save path and the Razorpay checkout path, so the
  // two never drift out of sync on what's actually being charged.
  const buildFeeItems = () => {
    const items = []
    if (admPkgThis > 0 && !admPaid && !isRepeater) {
      items.push({ kind: 'admission', amount: admFeeAmt })
      DRESS_ITEMS.forEach((d, idx) => {
        if (dressChecked[idx]) items.push({ kind: 'item', label: `Dress Kit — ${d.name}`, amount: d.price })
      })
      if (prospChecked) items.push({ kind: 'item', label: 'Prospectus', amount: PROSPECTUS_FEE })
    }
    selFlat.forEach(f => {
      items.push({ kind: 'flat', month: f.month, year: f.year, amount: f.amount })
    })
    crsfRows.forEach(r => {
      const amt = Number(r.amount) || 0
      if (amt > 0 && r.for_month) {
        items.push({ kind: 'course', month: r.for_month, year: CURRENT_YEAR, course: r.course, subtype: r.subtype, amount: amt })
      }
    })
    if (advThis > 0) items.push({ kind: 'advance', label: advFor, amount: advThis })
    return items
  }

  // Finalizes a payment already confirmed (cash in hand, or a verified
  // Razorpay payment) — writes to the fee tables via the single collectFee()
  // path, prints the receipt, and resets the form. `mode`/`ref` override the
  // Cash/Bank dropdown selection for the Razorpay case.
  const finalizeCollection = async (items, { mode, ref } = {}) => {
    const receiptNo = rcptNo('FEE')
    const { sections, total } = await collectFee({
      gcc, studentName: student.name, admNo: admRec?.adm_no || '--',
      className: student.batch || '', course: student.course || '',
      hostelType, payDate, payMode: mode || payMode, txnRef: ref ?? txnRef, collectedBy,
      studentId: student.id, receiptNo, items,
    })

    printReceipt({
      receipt_no: receiptNo, pay_date: payDate, pay_mode: mode || payMode,
      txn_ref: ref ?? txnRef, collected_by: collectedBy,
      student_name: student.name, adm_no: admRec?.adm_no || '--',
      gcc_no: gcc, class_name: student.batch || '', course: student.course || '',
      hostel_type: hostelType, sections, total,
    })

    showToast(`✅ Collected ₹${total.toLocaleString('en-IN')}`, '#16a34a')
    setLastPayment({ studentName: student.name, gcc, receiptNo, total, payDate, items })
    setCrsfRows([{ course: '', subtype: '', hostelType: hostelType, for_month: '', amount: '' }])
    setAdvAmt('')
    setAdvFor('')
    setFlatChecked(flatFees.map(() => false))
    setTxnRef('')
    onRefresh()
  }

  const handleSave = async () => {
    if (!student || !admRec || grandThis === 0 || saving) return
    // ✦ Bug fix: Fees.jsx had no admission_date requirement at all, unlike
    // FeeCollectionModal.jsx (fixed earlier this session) — without a real
    // admission date on file, the fee engine can't correctly determine
    // which months a student actually owes, which was the root cause of a
    // real wrong-charge bug found earlier for a repeater student.
    if (!admissionDate) {
      showToast('Admission Date is required before collecting fees — set it below.', '#dc2626')
      return
    }
    setSaving(true)
    try {
      await finalizeCollection(buildFeeItems())
    } catch (err) {
      showToast('Save failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const [razorpayBusy, setRazorpayBusy] = useState(false)

  // Full online-payment flow: create a server-side Order (amount is fixed
  // server-side from what we send — never trust a client-supplied amount),
  // open Razorpay Checkout, verify the signature server-side, and only then
  // record the collection via the same finalizeCollection() path as cash.
  // If the parent closes the checkout modal or payment fails, nothing is
  // written — no partial/ghost records.
  const handleRazorpayCollect = async () => {
    if (!student || !admRec || grandThis === 0 || razorpayBusy) return
    if (!admissionDate) {
      showToast('Admission Date is required before collecting fees — set it below.', '#dc2626')
      return
    }
    if (!RAZORPAY_KEY_ID) {
      showToast('Razorpay is not configured — set VITE_RAZORPAY_KEY_ID.', '#dc2626')
      return
    }
    setRazorpayBusy(true)
    try {
      const ok = await loadRazorpayScript()
      if (!ok) throw new Error('Could not load Razorpay checkout — check your connection')

      const items = buildFeeItems()

      // Server creates the actual Razorpay Order and returns its id — the
      // amount charged is whatever the backend computes from `items`, not
      // whatever the browser sends, so a tampered client request can't
      // under-charge or mismatch the ledger.
      const orderRes = await fetch(RAZORPAY_CREATE_ORDER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gcc, studentId: student.id, studentName: student.name,
          amount: grandThis, items,
        }),
      })
      if (!orderRes.ok) throw new Error(`Order creation failed (${orderRes.status})`)
      const order = await orderRes.json()
      if (!order?.id) throw new Error('Order creation returned no order id')

      await new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: RAZORPAY_KEY_ID,
          amount: order.amount,
          currency: order.currency || 'INR',
          order_id: order.id,
          name: 'GNSI — Guidance Navodaya & Sainik Institute',
          description: `Fee payment — ${student.name} (GCC-${gcc})`,
          prefill: {
            name: student.name,
            contact: getParentPhone(student) ? getParentPhone(student).replace(/^91/, '') : '',
          },
          notes: { gcc, student_id: String(student.id) },
          theme: { color: '#1e3a5f' },
          handler: async (response) => {
            try {
              // Server-side signature verification — MUST happen before we
              // trust this payment as real. Never call finalizeCollection
              // directly off the client-side handler alone.
              const verifyRes = await fetch(RAZORPAY_VERIFY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  razorpay_order_id:   response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature:  response.razorpay_signature,
                }),
              })
              const verify = await verifyRes.json()
              if (!verifyRes.ok || !verify?.verified) throw new Error(verify?.error || 'Payment verification failed')

              await finalizeCollection(items, { mode: 'Razorpay', ref: response.razorpay_payment_id })
              resolve()
            } catch (err) {
              reject(err)
            }
          },
          modal: {
            // User closed the checkout without paying — not an error, just
            // no-op back to the form.
            ondismiss: () => resolve('dismissed'),
          },
        })
        rzp.on('payment.failed', (resp) => {
          reject(new Error(resp?.error?.description || 'Payment failed'))
        })
        rzp.open()
      })
    } catch (err) {
      showToast('Razorpay payment failed: ' + err.message, '#dc2626')
    }
    setRazorpayBusy(false)
  }

  const gcc = student ? gccStr(student.gcc_no) : null

  const myAdmCols  = gcc ? adm_fee_collections.filter(c => gccStr(c.adm_app_id) === gcc && !c.reverted) : []
  const myFlatRecs = gcc ? adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid) : []
  const myCrsfRecs = gcc ? adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc && !r.reverted) : []

  const admPaid      = myAdmCols.some(c => c.fee_type === 'admission')
  const paidMonths   = myFlatRecs.map(r => r.month)
  const admEverPaid  = myAdmCols.reduce((s, c) => s + (Number(c.amount_paid) || 0), 0)
  const flatEverPaid = myFlatRecs.reduce((s, r) => s + (r.amount || 0), 0)
  const crsfEverPaid = myCrsfRecs.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0)
  const totalEverPaid = admEverPaid + flatEverPaid + crsfEverPaid

  const dressTotal = DRESS_ITEMS.reduce((s, i, idx) => s + (dressChecked[idx] ? i.price : 0), 0)
  const admPkgThis = (admPaid || isRepeater) ? 0 : (admFeeAmt + dressTotal + (prospChecked ? PROSPECTUS_FEE : 0))

  const selFlat  = flatFees.filter((_, i) => flatChecked[i] && !paidMonths.includes(flatFees[i]?.month))
  const flatThis = selFlat.reduce((s, f) => s + f.amount, 0)
  const crsfThis = crsfRows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const advThis  = Number(advAmt) || 0
  const grandThis = admPkgThis + flatThis + crsfThis + advThis

  const handleSelect = async s => {
    setStudent(s)
    setLastPayment(null)
    setIsRepeater(!!s.is_repeater)   // use value already loaded in students list
    const rec = admissions.find(a => gccStr(a.gcc_no) === gccStr(s.gcc_no)) || null
    setAdmRec(rec)

    // Same session-derivation as sessionYear above — use this student's own
    // admission session, not today's computed one.
    const sSessionYear = s.session || `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`

    const studentFlatFees = await getFlatFees(s.hostel_type || 'Day Scholar', s.course || '', s.batch || '', sSessionYear, parseInt(gccStr(s.gcc_no)) || null)
    const paid = adm_flat_fees
      .filter(r => gccStr(r.adm_app_id) === gccStr(s.gcc_no) && r.paid)
      .map(r => r.month)
    setFlatChecked(studentFlatFees.map(ff => !paid.includes(ff.month)))

    const defaultCourse     = s.course && COURSE_STRUCTURE[s.course] ? s.course : ''
    const defaultHostelType = s.hostel_type || 'Day Scholar'
    const defaultBatch      = s.batch || ''

    let defaultAmt = ''
    if (defaultCourse && defaultHostelType) {
      try {
        const rates = await getFeeRates(
          sSessionYear,
          defaultCourse, defaultBatch, defaultHostelType, parseInt(gccStr(s.gcc_no)) || null
        )
        defaultAmt = rates.courseFee || syncCourseFeeAmt(defaultCourse, defaultHostelType)
      } catch (_) {
        defaultAmt = syncCourseFeeAmt(defaultCourse, defaultHostelType)
      }
    }

    setCrsfRows([{
      course:     defaultCourse,
      subtype:    defaultBatch,
      hostelType: defaultHostelType,
      for_month:  '',
      amount:     defaultAmt,
    }])

    setStep('pay')
  }

  // ── Preset student (jump-to-collect from Dashboard) ──────────────────────
  // When the dashboard's "Collect" action passes a student, land directly on
  // their payment screen instead of dropping the admin on a blank search.
  // Guard against re-selecting the same student on every render (handleSelect
  // is not stable across renders, so it isn't a dependency) and notify the
  // parent once consumed so a repeat click on the same student re-triggers.
  const presetGcc = presetStudent ? gccStr(presetStudent.gcc_no) : null
  useEffect(() => {
    if (!presetStudent) return
    handleSelect(presetStudent)
    onPresetConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetGcc])

  const handleBack = () => {
    setStep('select'); setStudent(null); setAdmRec(null)
    setLastPayment(null)
    setIsRepeater(false)
    setHasOverride(false)
    setOverrideMode(false)
    setOverrideAmt('')
    setOverrideReason('')
    setOverrideFeedback(null)
    setAdmFeeAmt(ADM_FEE_BASE)
    setDressChecked(DRESS_ITEMS.map(() => true))
    setProspChecked(true)
    setFlatChecked([])
    setFlatFees([])
    setCrsfRows([{ course: '', subtype: '', hostelType: '', for_month: '', amount: '' }])
    setAdvAmt(''); setAdvFor(''); setTxnRef('')
  }

  const updateCrsfRow = async (i, field, value) => {
    setCrsfRows(rows => {
      const updated = [...rows]
      const row = { ...updated[i], [field]: value }
      if (field === 'course') row.subtype = ''
      updated[i] = row
      return updated
    })

    if (field === 'course' || field === 'hostelType' || field === 'subtype') {
      const currentRow = crsfRows[i]
      const course     = field === 'course'     ? value : currentRow.course
      const ht         = field === 'hostelType' ? value : currentRow.hostelType || hostelType
      const batch      = field === 'subtype'    ? value : (field === 'course' ? '' : currentRow.subtype || '')
      if (course && ht) {
        try {
          const rates = await getFeeRates(sessionYear, course, batch, ht)
          const amt = rates.courseFee || syncCourseFeeAmt(course, ht)
          setCrsfRows(rows => {
            const updated = [...rows]
            updated[i] = { ...updated[i], amount: amt }
            return updated
          })
        } catch (_) {
          const amt = syncCourseFeeAmt(course, ht)
          setCrsfRows(rows => {
            const updated = [...rows]
            updated[i] = { ...updated[i], amount: amt }
            return updated
          })
        }
      }
    }
  }

  // ── Select screen ─────────────────────────────────────────────────────────
  if (step === 'select') return (
    <div style={{ maxWidth: 540, margin: '48px auto', textAlign: 'center' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>💳</div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1e3a5f', marginBottom: 8 }}>Collect fee payment</h2>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>Search a student to record fees and generate a combined invoice</p>
      <StudentSearch students={students} onSelect={handleSelect} placeholder="Search student by name or GCC No…" />
    </div>
  )

  // ── Payment screen ────────────────────────────────────────────────────────
  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: '#fff', border: '1px solid #e2e8f0', borderLeft: `3px solid ${toast.color}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 320, color: '#1e293b' }}>
          {toast.msg}
        </div>
      )}

      {/* ── WhatsApp receipt prompt — shown right after a successful collection ── */}
      {lastPayment && lastPayment.gcc === gcc && (() => {
        const parentPhone = getParentPhone(student)
        const waMsg  = buildFeeReceiptWaMessage(lastPayment)
        return (
          <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#166534' }}>
                ✅ ₹{Number(lastPayment.total).toLocaleString('en-IN')} collected — Receipt {lastPayment.receiptNo}
              </div>
              <div style={{ fontSize: 11, color: '#166534', opacity: .8, marginTop: 2 }}>
                {parentPhone ? 'Notify the parent on WhatsApp with the receipt details' : 'No parent contact number on file for this student'}
              </div>
            </div>
            {parentPhone ? (
              <a href={buildWaLink(parentPhone, waMsg)} target="_blank" rel="noopener noreferrer"
                onClick={() => setLastPayment(null)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, padding: '9px 18px', borderRadius: 8, border: 'none', background: '#25D366', color: 'white', textDecoration: 'none', boxShadow: '0 2px 8px rgba(37,211,102,.35)' }}>
                📱 Send Receipt on WhatsApp
              </a>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#92400e', background: '#fef3c7', padding: '6px 12px', borderRadius: 7, border: '1px solid #fcd34d' }}>
                Add a phone number to the student's record to enable this
              </span>
            )}
          </div>
        )
      })()}

      {/* Student bar */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
          {(student.name || '?').split(' ').map(w => w[0] || '').join('').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {student.name}
            {/* ── REPEATER badge ── */}
            {isRepeater && (
              <span style={{ fontSize: 10, fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '2px 9px', borderRadius: 4, border: '1px solid #fcd34d', letterSpacing: '.04em' }}>
                🔁 REPEATER
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {student.gcc_no && <span style={{ fontWeight: 700, color: '#1e3a5f' }}>GCC-{student.gcc_no}</span>}
            {(student.class_name || student.batch) && <span>{student.class_name || student.batch}</span>}
            {student.course && <span>{student.course}</span>}
            {admRec?.adm_no && <span style={{ color: '#4f46e5', fontWeight: 600 }}>{admRec.adm_no}</span>}
            {hostelType && <HostelBadge type={hostelType} />}
            {/* ── Flat fee display with override badge + Change button ── */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 11, color: hasOverride ? '#7c3aed' : '#059669', fontWeight: 700 }}>
                Flat fee: ₹{feeRates.flatFee.toLocaleString('en-IN')}/mo
              </span>
              {hasOverride && (
                <span style={{ fontSize: 9, fontWeight: 800, background: '#ede9fe', color: '#7c3aed', padding: '1px 5px', borderRadius: 3, border: '1px solid #c4b5fd' }}>OVERRIDE</span>
              )}
              <button type="button" onClick={() => { setOverrideMode(m => !m); setOverrideFeedback(null) }}
                style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 4, border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', color: '#64748b' }}>
                ✏️ {overrideMode ? 'Cancel' : 'Change'}
              </button>
            </span>
            {totalEverPaid > 0 && <span style={{ color: '#059669', fontWeight: 700 }}>₹{totalEverPaid.toLocaleString('en-IN')} prev. paid</span>}
            {/* ── Admission Date — required before any fee can be collected ── */}
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: admissionDate ? '#64748b' : '#dc2626' }}>
                Admission Date{!admissionDate && ' *required'}
              </span>
              <input
                type="date"
                value={admissionDate || ''}
                onChange={e => saveAdmissionDate(e.target.value)}
                disabled={admDateSaving}
                style={{ fontSize: 11, padding: '2px 6px', borderRadius: 5, border: `1.5px solid ${admissionDate ? '#e2e8f0' : '#fca5a5'}`, background: admissionDate ? 'white' : '#fef2f2' }}
              />
              {admDateSaving && <span style={{ fontSize: 10, color: '#94a3b8' }}>saving…</span>}
            </span>
            {/* ── REPEATER toggle ── */}
            <button
              type="button"
              onClick={toggleRepeater}
              disabled={repeaterSaving}
              title={isRepeater ? 'Remove Repeater tag' : 'Mark as Repeater (2+ years at GNSI)'}
              style={{ fontSize: 10, fontWeight: 700, padding: '2px 9px', borderRadius: 4, border: `1px solid ${isRepeater ? '#fcd34d' : '#e2e8f0'}`, background: isRepeater ? '#fef3c7' : '#f8fafc', color: isRepeater ? '#92400e' : '#94a3b8', cursor: repeaterSaving ? 'not-allowed' : 'pointer' }}>
              {repeaterSaving ? '…' : isRepeater ? '✕ Remove Repeater' : '🔁 Mark Repeater'}
            </button>
          </div>
        </div>
        <button onClick={handleBack} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#64748b' }}>← Change</button>
      </div>

      {/* ── Inline flat fee override editor ── */}
      {overrideMode && (
        <div style={{ background: '#faf5ff', border: '1.5px solid #c4b5fd', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            ✏️ Custom flat fee for {student.name} — {sessionYear}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <label style={{ ...lbl, fontSize: 11, color: '#7c3aed' }}>New Amount (₹/month)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#94a3b8' }}>₹</span>
                <input type="number" min="0" value={overrideAmt}
                  onChange={e => setOverrideAmt(e.target.value)}
                  placeholder={String(feeRates.flatFee)}
                  style={{ ...inp, paddingLeft: 26, fontWeight: 700, color: '#7c3aed', borderColor: '#c4b5fd', fontSize: 14 }} />
              </div>
            </div>
            <div>
              <label style={{ ...lbl, fontSize: 11, color: '#7c3aed' }}>Reason (optional)</label>
              <input type="text" value={overrideReason}
                onChange={e => setOverrideReason(e.target.value)}
                placeholder="e.g. Scholarship, concession…"
                style={{ ...inp, borderColor: '#c4b5fd', fontSize: 13 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={saveOverrideInline} disabled={overrideSaving || overrideAmt === ''}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: overrideSaving || overrideAmt === '' ? 'not-allowed' : 'pointer', background: overrideSaving || overrideAmt === '' ? '#e2e8f0' : 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: overrideSaving || overrideAmt === '' ? '#94a3b8' : 'white' }}>
              {overrideSaving ? '⏳ Saving…' : '✅ Save Override'}
            </button>
            {hasOverride && (
              <button type="button" onClick={removeOverrideInline} disabled={overrideSaving}
                style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #fca5a5', background: '#fef2f2', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: '#dc2626' }}>
                🗑 Remove
              </button>
            )}
          </div>
          {overrideFeedback && (
            <div style={{ marginTop: 10, padding: '9px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: overrideFeedback.type === 'ok' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${overrideFeedback.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`, color: overrideFeedback.type === 'ok' ? '#065f46' : '#b91c1c' }}>
              {overrideFeedback.type === 'ok' ? '✅' : '❌'} {overrideFeedback.msg}
            </div>
          )}
        </div>
      )}

      {!overrideMode && overrideFeedback && (
        <div style={{ background: overrideFeedback.type === 'ok' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${overrideFeedback.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`, borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 12, fontWeight: 600, color: overrideFeedback.type === 'ok' ? '#065f46' : '#b91c1c' }}>
          {overrideFeedback.type === 'ok' ? '✅' : '❌'} {overrideFeedback.msg}
        </div>
      )}

      {!admRec && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#92400e', fontWeight: 600 }}>
          ⚠️ No admission record found for GCC-{student.gcc_no || '??'}. Create one in the Admissions module first.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '3fr 2fr', gap: 20, alignItems: 'start' }}>

        {/* Left: fee items */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Admission package */}
          <div style={{ background: 'white', border: '1px solid #c7d2fe', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#eef2ff,#f5f3ff)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 18 }}>🎓</span>
              <div style={{ flex: 1, fontWeight: 800, fontSize: 14, color: '#3730a3' }}>Admission package</div>
              {admPaid && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#dcfce7', color: '#16a34a', fontWeight: 700 }}>✓ Already paid</span>}
            </div>
            {/* ✦ Bug fix: this branch previously let staff charge Admission
                Fee + Dress + Prospectus to a known repeater — the same gap
                already found and fixed in FeeCollectionModal.jsx earlier.
                Repeaters don't owe these one-time admission-side fees. */}
            {isRepeater && !admPaid ? (
              <div style={{ padding: '16px', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, margin: 12, textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>🔁</div>
                <div style={{ fontWeight: 800, color: '#92400e', fontSize: 13 }}>Admission Fee Waived — Repeater</div>
                <div style={{ fontSize: 11.5, color: '#92400e', opacity: .85, marginTop: 4 }}>
                  This student is marked as a repeater, so Admission Fee, Dress Fee, and Prospectus Fee
                  are not charged. Collect their dues from Flat or Course Fees instead.
                </div>
              </div>
            ) : admPaid ? (
              <div style={{ padding: '12px 16px' }}>
                {myAdmCols.map((c, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '4px 0', color: '#475569' }}>
                    <span>{c.description || 'Fee'}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>₹{Number(c.amount_paid || 0).toLocaleString('en-IN')}</span>
                      {isAdmin && (
                        <>
                          <button type="button" onClick={() => handleFixAdmDate(c)} title={`Fix date (currently ${c.pay_date || '—'})`}
                            style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                            📅
                          </button>
                          <button type="button" onClick={() => handleRevertAdmCollection(c)} title="Revert this item (admin)"
                            style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                            ↩ Revert
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#3730a3', borderTop: '1px solid #e2e8f0', marginTop: 8, paddingTop: 8 }}>
                  <span>Total paid</span><span>₹{admEverPaid.toLocaleString('en-IN')}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding: '12px 16px' }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Admission fee (₹)</label>
                  <input type="number" value={admFeeAmt} onChange={e => setAdmFeeAmt(parseInt(e.target.value) || 0)} style={inp} />
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
                  {DRESS_ITEMS.map((item, i) => (
                    <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #f1f5f9', background: dressChecked[i] ? '#eef2ff' : 'white', cursor: 'pointer' }}>
                      <input type="checkbox" checked={dressChecked[i]}
                        onChange={() => setDressChecked(d => { const n = [...d]; n[i] = !n[i]; return n })}
                        style={{ accentColor: '#4f46e5', width: 14, height: 14 }} />
                      <span style={{ flex: 1, fontSize: 13 }}>{item.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>₹{item.price.toLocaleString('en-IN')}</span>
                    </label>
                  ))}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: prospChecked ? '#eef2ff' : 'white', cursor: 'pointer' }}>
                    <input type="checkbox" checked={prospChecked} onChange={e => setProspChecked(e.target.checked)} style={{ accentColor: '#4f46e5', width: 14, height: 14 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>Prospectus</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#4f46e5' }}>₹{PROSPECTUS_FEE.toLocaleString('en-IN')}</span>
                  </label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#3730a3', background: '#eef2ff', padding: '9px 12px', borderRadius: 8 }}>
                  <span>Package total</span><span>₹{admPkgThis.toLocaleString('en-IN')}</span>
                </div>
              </div>
            )}
          </div>

          {/* Flat fees */}
          <div style={{ background: 'white', border: '1px solid #6ee7b7', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#ecfdf5,#d1fae5)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 18 }}>📅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#047857' }}>Monthly flat fees</div>
                <div style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                  {hostelType} rate · ₹{feeRates.flatFee.toLocaleString('en-IN')}/month
                </div>
              </div>
              {flatEverPaid > 0 && <span style={{ fontSize: 11, color: '#047857', fontWeight: 700 }}>₹{flatEverPaid.toLocaleString('en-IN')} paid</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {flatFees.length === 0
                ? <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 16 }}>⏳ Loading months…</div>
                : flatFees.map((ff, i) => {
                    const paid = paidMonths.includes(ff.month)
                    return (
                      <label key={ff.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < flatFees.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: paid ? 'default' : 'pointer' }}>
                        <input type="checkbox"
                          checked={paid || !!flatChecked[i]}
                          disabled={paid}
                          onChange={() => setFlatChecked(c => { const n = [...c]; n[i] = !n[i]; return n })}
                          style={{ accentColor: '#059669', width: 14, height: 14 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{ff.month} {ff.year}</div>
                          <div style={{ fontSize: 11, color: paid ? '#16a34a' : '#94a3b8', marginTop: 1 }}>
                            {paid ? '✅ Already collected' : `${hostelType} rate`}
                          </div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 800, color: paid ? '#16a34a' : '#059669' }}>
                          ₹{ff.amount.toLocaleString('en-IN')}
                        </span>
                        {paid && isAdmin && (
                          <span style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                            <button type="button" onClick={(e) => { e.preventDefault(); handleFixFlatDate(ff.month) }} title={`Fix date (currently ${myFlatRecs.find(r => r.month === ff.month)?.pay_date || '—'})`}
                              style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              📅
                            </button>
                            <button type="button" onClick={(e) => { e.preventDefault(); handleRevertFlat(ff.month) }} title="Revert this month (admin)"
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              ↩ Revert
                            </button>
                          </span>
                        )}
                      </label>
                    )
                  })
              }
              {flatThis > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, color: '#047857', background: '#ecfdf5', padding: '9px 12px', borderRadius: 8, marginTop: 10 }}>
                  <span>Flat total</span><span>₹{flatThis.toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Course fees */}
          <div style={{ background: 'white', border: '1px solid #c4b5fd', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg,#f5f3ff,#ede9fe)', padding: '11px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: 18 }}>📚</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#6d28d9' }}>Course fees</div>
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 2 }}>Select course + hostel type → amount auto-fills · editable</div>
              </div>
              {crsfEverPaid > 0 && <span style={{ fontSize: 11, color: '#6d28d9', fontWeight: 700 }}>₹{crsfEverPaid.toLocaleString('en-IN')} prev.</span>}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {myCrsfRecs.length > 0 && (
                <div style={{ marginBottom: 12, padding: '10px 12px', background: '#f5f3ff', borderRadius: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#6d28d9', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Previous</div>
                  {myCrsfRecs.map((r, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: '#475569', padding: '3px 0' }}>
                      <span>{r.course}{r.subtype ? ' · ' + r.subtype : ''} · {r.for_month}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, color: '#6d28d9' }}>₹{Number(r.amount_paid || 0).toLocaleString('en-IN')}</span>
                        {isAdmin && (
                          <>
                            <button type="button" onClick={() => handleFixCourseDate(r)} title={`Fix date (currently ${r.pay_date || '—'})`}
                              style={{ background: '#eff6ff', color: '#1e3a5f', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              📅
                            </button>
                            <button type="button" onClick={() => handleRevertCourseFee(r)} title="Revert this month (admin)"
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 5, padding: '2px 7px', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                              ↩ Revert
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {crsfRows.map((row, i) => (
                <div key={i} style={{ border: '1px solid #ede9fe', borderRadius: 8, padding: 12, marginBottom: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Course</label>
                      <select value={row.course} onChange={e => updateCrsfRow(i, 'course', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                        <option value="">— Select —</option>
                        {Object.keys(COURSE_STRUCTURE).map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Hostel Type</label>
                      <select value={row.hostelType} onChange={e => updateCrsfRow(i, 'hostelType', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                        <option value="">— Select —</option>
                        <option>Boarder</option><option>Day Boarder</option><option>Day Scholar</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Subtype</label>
                      {(COURSE_STRUCTURE[row.course]?.subtypes || []).length > 0
                        ? <select value={row.subtype} onChange={e => updateCrsfRow(i, 'subtype', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                            <option value="">—</option>
                            {COURSE_STRUCTURE[row.course].subtypes.map(s => <option key={s}>{s}</option>)}
                          </select>
                        : <input value={row.subtype} onChange={e => updateCrsfRow(i, 'subtype', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }} placeholder="Optional" />
                      }
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize: 11 }}>Month</label>
                      <select value={row.for_month} onChange={e => updateCrsfRow(i, 'for_month', e.target.value)} style={{ ...inp, fontSize: 12, padding: '7px 10px' }}>
                        <option value="">— Month —</option>
                        {MONTHS_LIST.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <label style={{ ...lbl, fontSize: 11 }}>
                      Amount (₹)
                      {row.course && row.hostelType && (
                        <span style={{ fontWeight: 400, color: '#7c3aed', marginLeft: 6 }}>
                          · {row.hostelType} rate: ₹{syncCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}
                        </span>
                      )}
                    </label>
                    <input type="number" value={row.amount || ''}
                      onChange={e => updateCrsfRow(i, 'amount', e.target.value)}
                      style={{ ...inp, fontSize: 12, padding: '7px 10px',
                        borderColor: row.course && row.hostelType && row.amount !== '' &&
                          Number(row.amount) !== syncCourseFeeAmt(row.course, row.hostelType)
                          ? '#f59e0b' : '#d1d5db' }}
                      placeholder={row.course && row.hostelType
                        ? `Auto: ₹${syncCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}`
                        : 'Select course & hostel type first'}
                    />
                    {row.course && row.hostelType && row.amount !== '' &&
                      Number(row.amount) !== syncCourseFeeAmt(row.course, row.hostelType) && (
                      <div style={{ fontSize: 10, color: '#b45309', marginTop: 3 }}>
                        ⚠ Overriding standard rate of ₹{syncCourseFeeAmt(row.course, row.hostelType).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                  {crsfRows.length > 1 && (
                    <button onClick={() => setCrsfRows(r => r.filter((_, j) => j !== i))}
                      style={{ fontSize: 11, color: '#dc2626', background: '#fee2e2', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 700 }}>
                      ✕ Remove
                    </button>
                  )}
                </div>
              ))}
              <button onClick={() => setCrsfRows(r => [...r, { course: '', subtype: '', hostelType: hostelType, for_month: '', amount: '' }])}
                style={{ fontSize: 12, color: '#6d28d9', background: '#f5f3ff', border: '1px dashed #c4b5fd', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', fontWeight: 700, width: '100%' }}>
                + Add month
              </button>
            </div>
          </div>

          {/* Advance */}
          <div style={{ background: 'white', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 16px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#b45309', marginBottom: 10 }}>⮕ Advance fee (optional)</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ ...lbl, fontSize: 11 }}>Amount ₹</label>
                <input type="number" min={0} value={advAmt} onChange={e => setAdvAmt(e.target.value)} placeholder="0" style={{ ...inp, fontSize: 12, padding: '7px 10px' }} />
              </div>
              <div>
                <label style={{ ...lbl, fontSize: 11 }}>For</label>
                <input value={advFor} onChange={e => setAdvFor(e.target.value)} placeholder="e.g. Phase I Month 1" style={{ ...inp, fontSize: 12, padding: '7px 10px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: payment + summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: isMobile ? 'static' : 'sticky', top: 20 }}>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#1e3a5f', marginBottom: 14 }}>💳 Payment details</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div><label style={lbl}>Payment mode</label>
                <select value={payMode} onChange={e => setPayMode(e.target.value)} style={inp}>
                  {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Payment date</label><input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Transaction ref</label><input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder="UPI / Cheque ref (optional)" style={inp} /></div>
              <div><label style={lbl}>Collected by</label><input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} style={inp} /></div>
            </div>
          </div>

          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ background: '#1e3a5f', padding: '12px 16px', color: 'white', fontWeight: 800, fontSize: 14 }}>📋 This invoice</div>
            <div style={{ padding: '14px 16px' }}>
              {admPkgThis > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#3730a3' }}><span>🎓 Admission package</span><span style={{ fontWeight: 700 }}>₹{admPkgThis.toLocaleString('en-IN')}</span></div>}
              {flatThis   > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#047857' }}><span>📅 Flat fees ({hostelType})</span><span style={{ fontWeight: 700 }}>₹{flatThis.toLocaleString('en-IN')}</span></div>}
              {crsfThis   > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#6d28d9' }}><span>📚 Course fees</span><span style={{ fontWeight: 700 }}>₹{crsfThis.toLocaleString('en-IN')}</span></div>}
              {advThis    > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '6px 0', borderBottom: '1px solid #f1f5f9', color: '#b45309' }}><span>⮕ Advance</span><span style={{ fontWeight: 700 }}>₹{advThis.toLocaleString('en-IN')}</span></div>}
              {grandThis === 0 && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: '16px 0' }}>Select fee items on the left</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 900, color: 'white', background: 'linear-gradient(90deg,#1e3a5f,#3730a3)', padding: '12px 14px', borderRadius: 10, marginTop: 12 }}>
                <span>Grand total</span><span>₹{grandThis.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {totalEverPaid > 0 && (
            <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ fontWeight: 800, fontSize: 12, color: '#047857', marginBottom: 8 }}>✅ Previously collected</div>
              {admEverPaid  > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '3px 0' }}><span>Admission + Kit</span><span>₹{admEverPaid.toLocaleString('en-IN')}</span></div>}
              {flatEverPaid > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '3px 0' }}><span>Flat fees</span><span>₹{flatEverPaid.toLocaleString('en-IN')}</span></div>}
              {crsfEverPaid > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#475569', padding: '3px 0' }}><span>Course fees</span><span>₹{crsfEverPaid.toLocaleString('en-IN')}</span></div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 800, color: '#047857', borderTop: '1px solid #a7f3d0', marginTop: 8, paddingTop: 8 }}>
                <span>Total ever</span><span>₹{totalEverPaid.toLocaleString('en-IN')}</span>
              </div>
            </div>
          )}

          <button onClick={handleSave} disabled={saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate}
            style={{ width: '100%', padding: 14, borderRadius: 12, background: (saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate) ? '#94a3b8' : 'linear-gradient(135deg,#1e3a5f,#3730a3)', color: 'white', border: 'none', fontSize: 15, fontWeight: 800, cursor: (saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate) ? 'not-allowed' : 'pointer', boxShadow: grandThis > 0 && admRec && admissionDate ? '0 4px 16px rgba(55,48,163,.3)' : 'none' }}>
            {saving ? '⏳ Processing…' : !admissionDate ? '⚠️ Set Admission Date First' : `🖨️ Save & print invoice · ₹${grandThis.toLocaleString('en-IN')}`}
          </button>
          <button onClick={handleRazorpayCollect} disabled={saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate}
            style={{ width: '100%', padding: 13, borderRadius: 12, background: (saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate) ? '#e2e8f0' : 'white', color: (saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate) ? '#94a3b8' : '#3730a3', border: '2px solid ' + ((saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate) ? '#e2e8f0' : '#3730a3'), fontSize: 14, fontWeight: 800, cursor: (saving || razorpayBusy || grandThis === 0 || !admRec || !admissionDate) ? 'not-allowed' : 'pointer', marginTop: -4 }}>
            {razorpayBusy ? '⏳ Opening Razorpay…' : `💳 Pay via Razorpay · ₹${grandThis.toLocaleString('en-IN')}`}
          </button>
          {!admRec && <div style={{ fontSize: 11, color: '#dc2626', textAlign: 'center', marginTop: -6 }}>⚠ No admission record — create one in Admissions first</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Root: Fees page ──────────────────────────────────────────────────────────

export default function Fees() {
  const w        = useWindowWidth()
  const isMobile = w < 768
  const currentUser = useMemo(() => {
    try {
      const s = localStorage.getItem('gnsi_session')
      return s ? JSON.parse(s).user : {}
    } catch {
      return {}
    }
  }, [])
  const isAdmin = (currentUser?.role || '').toLowerCase() === 'admin'
  const [fees,                setFees]         = useState([])
  const [students,            setStudents]      = useState([])
  const [admissions,          setAdmissions]    = useState([])
  const [adm_fee_collections, setAdmFeeCols]    = useState([])
  const [adm_flat_fees,       setAdmFlatFees]   = useState([])
  const [adm_course_fees,     setAdmCourseFees] = useState([])
  const [loading,             setLoading]       = useState(true)
  const [saving,              setSaving]        = useState(false)
  const [showForm,            setShowForm]      = useState(false)
  const [search,              setSearch]        = useState('')
  const [tab, setTab] = useState('dashboard')
  // Student handed off from the Dashboard's "Collect" buttons (Zero Payment
  // alert, Month-wise Dues drill-down) so Fee Payment opens straight to their
  // form instead of a blank search screen.
  const [presetCollectStudent, setPresetCollectStudent] = useState(null)
  const [form,                setForm]          = useState({ gcc_no: '', name: '', class_name: '', course: '', amount: '', paid: '0' })

  const loadAll = async () => {
    setLoading(true)
    const [fees_, students_, admissions_, admFeeCols_, admFlatFees_, admCourseFees_] = await Promise.all([
      fetchAllRows('fees', { orderCol: 'created_at', ascending: false }),
      fetchAllRows('students', { orderCol: 'name' }),
      fetchAllRows('admissions'),
      fetchAllRows('adm_fee_collections', { filters: [['reverted', 'eq', false]] }),
      fetchAllRows('adm_flat_fees', { filters: [['paid', 'eq', true], ['reverted', 'eq', false]] }),
      fetchAllRows('adm_course_fees', { filters: [['reverted', 'eq', false]] }),
    ])
    setFees(fees_)
    setStudents(students_)
    setAdmissions(admissions_)
    setAdmFeeCols(admFeeCols_)
    setAdmFlatFees(admFlatFees_)
    setAdmCourseFees(admCourseFees_)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const getLiveFees = s => {
    const gcc = gccStr(s.gcc_no)
    const admTotal   = adm_fee_collections.filter(c => gccStr(c.adm_app_id) === gcc && !c.reverted).reduce((a, c) => a + (Number(c.amount_paid) || 0), 0)
    const flatTotal  = adm_flat_fees.filter(r => gccStr(r.adm_app_id) === gcc && r.paid).reduce((a, r) => a + (r.amount || 0), 0)
    const crsfTotal  = adm_course_fees.filter(r => gccStr(r.adm_app_id) === gcc && !r.reverted).reduce((a, r) => a + (Number(r.amount_paid) || 0), 0)
    const grandTotal = admTotal + flatTotal + crsfTotal
    return { admTotal, flatTotal, crsfTotal, grandTotal, hasFees: grandTotal > 0 }
  }

  const getAdmRec = s => admissions.find(a => gccStr(a.gcc_no) === gccStr(s.gcc_no)) || null

  // BUG FIX: liveStatus previously only checked "has any payment been made
  // at all" (grandTotal > 0), completely ignoring hostel_type and course —
  // a Boarder who paid a token ₹500 against a real ₹5000+/month due showed
  // the exact same "Partial"/"Paid" status as a Day Scholar who fully paid
  // their much smaller due. The "Fee Dues" count only ever caught students
  // with literally zero payments, never students genuinely underpaid
  // relative to what their hostel_type actually requires.
  //
  // Now computes an expected flat-fee benchmark from getFlatFeeAmtSync
  // (hostel_type + course — the same fee engine already used for receipts
  // and rate-anomaly detection elsewhere in this file) and compares actual
  // payment against it. This is a lightweight sync estimate (course-level
  // rate, not the full per-batch/session DB-backed rate from getFeeRates)
  // — good enough for a dashboard-wide dues signal without an async call
  // per student on every render; billing/receipts still correctly use the
  // async getFeeRates path elsewhere in this file.
  // Students table's real status values (from Students.jsx STATUSES):
  // 'Active', 'Inactive', 'Passed Out', 'Withdrawn', 'Dropout'. Only 'Active'
  // is an ongoing fee-paying student — the other four all mean "no longer
  // enrolled" for different reasons (paused, graduated, left voluntarily,
  // dropped out) and must not appear in any fee dashboard, dues grid,
  // defaulter list, or export. Checking FOR 'Active' rather than excluding
  // 'Dropout' alone so any additional status value added later defaults to
  // excluded rather than silently leaking into fee totals. Students with a
  // missing/blank status are treated as active (matches the `status:'Active'`
  // default used everywhere students are created).
  // liveRows is the single source every downstream view reads from, so
  // filtering here excludes non-active students everywhere at once.
  const activeStudents = useMemo(() => students.filter(s => !s.status || s.status === 'Active'), [students])

  // Same status-scoped filtering applied to the raw collection tables — used
  // wherever a component sums these tables directly (FeeDashboardTab's
  // header stats, monthly trend, month-wise dues; ReportsExportTab) instead
  // of going through liveRows, so a non-active student's old payments don't
  // keep inflating "Total Collected", "This Month", or the dues grid after
  // they leave — those totals should reflect who the institute currently has
  // to collect from, not historical records of everyone who ever paid.
  const activeGccSet = useMemo(() => new Set(activeStudents.map(s => gccStr(s.gcc_no))), [activeStudents])
  const activeAdmFeeCollections = useMemo(() => adm_fee_collections.filter(r => activeGccSet.has(gccStr(r.adm_app_id))), [adm_fee_collections, activeGccSet])
  const activeAdmFlatFees       = useMemo(() => adm_flat_fees.filter(r => activeGccSet.has(gccStr(r.adm_app_id))), [adm_flat_fees, activeGccSet])
  const activeAdmCourseFees     = useMemo(() => adm_course_fees.filter(r => activeGccSet.has(gccStr(r.adm_app_id))), [adm_course_fees, activeGccSet])

  const liveRows = useMemo(() => activeStudents.map(s => {
    const live   = getLiveFees(s)
    const admRec = getAdmRec(s)
    const expectedFlat = getFlatFeeAmtSync(s.hostel_type || 'Day Scholar', s.course || '')
    const status = live.grandTotal === 0
      ? 'Pending'
      : expectedFlat > 0 && live.grandTotal < expectedFlat
        ? 'Underpaid'
        : (admRec?.status === 'Enrolled' ? 'Paid' : 'Partial')
    return { ...s, ...live, admRec, expectedFlat, liveStatus: status }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [activeStudents, admissions, adm_fee_collections, adm_flat_fees, adm_course_fees])


  const liveTtl = liveRows.reduce((a, s) => a + s.grandTotal, 0)
  const liveP   = liveRows.filter(s => s.liveStatus === 'Pending').length
  const liveP2  = liveRows.filter(s => s.liveStatus === 'Paid').length
  // Genuinely underpaid relative to their hostel_type's expected flat fee —
  // this is the count that was previously invisible entirely.
  const liveUnderpaid = liveRows.filter(s => s.liveStatus === 'Underpaid').length

  const handleAdd = async e => {
    e.preventDefault(); setSaving(true)
    const amount = Number(form.amount) || 0, paid = Number(form.paid) || 0
    const status = paid >= amount ? 'Paid' : paid > 0 ? 'Partial' : 'Pending'
    const { error } = await supabase.from('fees').insert([{ gcc_no: form.gcc_no || null, name: form.name, class_name: form.class_name, course: form.course, amount, paid, status }])
    if (error) alert('Error: ' + error.message)
    else { setForm({ gcc_no: '', name: '', class_name: '', course: '', amount: '', paid: '0' }); setShowForm(false); loadAll() }
    setSaving(false)
  }

  const handleCollect = async (id, amount) => { await supabase.from('fees').update({ paid: amount, status: 'Paid' }).eq('id', id); loadAll() }
  const handleDelete  = async id => {
    if (!isAdmin) { alert('Only admin can delete records.'); return }
    if (!window.confirm('Permanently delete this legacy fee record? This cannot be undone.')) return
    try { await deleteLegacyFeeRecord(id, currentUser?.role || 'admin'); loadAll() }
    catch (err) { alert('Delete failed: ' + err.message) }
  }

  const handleSync = async s => {
    const live = getLiveFees(s); if (!live.hasFees) return
    const ex = fees.find(f => gccStr(f.gcc_no) === gccStr(s.gcc_no))
    const p = { gcc_no: gccStr(s.gcc_no), name: s.name, class_name: s.class_name || s.batch || '', course: s.course || '', amount: live.grandTotal, paid: live.grandTotal, status: 'Paid' }
    if (ex) await supabase.from('fees').update(p).eq('id', ex.id)
    else    await supabase.from('fees').insert([p])
    loadAll()
  }

  const n = v => Number(v || 0).toLocaleString('en-IN')

  const TABS = [
    { id: 'dashboard', label: '🏠 Dashboard' },
    { id: 'payment',   label: '💳 Fee Payment' },
    { id: 'live',      label: '📊 Live Summary' },
    { id: 'ledger',    label: '📒 Student Ledger' },
    { id: 'admin',     label: '🛡️ Admin View' },
    { id: 'reports',   label: '📤 Reports & Export' },
    ...(isAdmin ? [{ id: 'anomaly', label: '🔍 Anomaly Monitor' }] : []),
  ]

  // ── Advanced filter state (shared across live + admin tabs) ──────────────
  const [afCourse,      setAfCourse]      = useState('All')
  const [afHostel,      setAfHostel]      = useState('All')
  const [afBatch,       setAfBatch]       = useState('All')
  const [afStatus,      setAfStatus]      = useState('All')
  const [afDateFrom,    setAfDateFrom]    = useState('')
  const [afDateTo,      setAfDateTo]      = useState('')
  const [afShowFilters, setAfShowFilters] = useState(false)

  const todayStr = new Date().toLocaleDateString('en-CA')

  // All unique batches from students
  const allBatches = useMemo(() => {
    const s = new Set(students.map(s => s.class_name || s.batch || '').filter(Boolean))
    return ['All', ...Array.from(s).sort()]
  }, [students])

  // Advanced filtered live rows (used in both live tab and admin tab)
  const advFilteredLive = useMemo(() => {
    const q = search.toLowerCase()
    return liveRows.filter(s => {
      if (afCourse !== 'All' && s.course !== afCourse) return false
      if (afHostel !== 'All' && s.hostel_type !== afHostel) return false
      if (afBatch  !== 'All' && (s.class_name || s.batch || '') !== afBatch) return false
      if (afStatus !== 'All' && s.liveStatus !== afStatus) return false
      if (![s.name, s.gcc_no, s.class_name, s.batch, s.course].some(v => (v||'').toString().toLowerCase().includes(q))) return false
      return true
    })
  }, [liveRows, search, afCourse, afHostel, afBatch, afStatus])

  // Today's transactions for admin daily view
  const todayTransactions = useMemo(() => {
    const flatToday = adm_flat_fees
      .filter(r => r.pay_date === todayStr)
      .map(r => {
        const stu = students.find(s => String(s.gcc_no) === String(r.adm_app_id))
        return { gcc_no: r.adm_app_id, name: stu?.name || '—', course: stu?.course || '—', hostel_type: stu?.hostel_type || '—', batch: stu?.class_name || stu?.batch || '—', type: 'Flat Fee', description: `${r.month} ${r.year}${r.is_advance?' (ADVANCE)':''}`, amount: r.amount || 0, pay_date: r.pay_date, pay_mode: r.pay_mode || '—', collected_by: r.collected_by || '—', ref: r.txn_ref || '—' }
      })
    const crsfToday = adm_course_fees
      .filter(r => r.pay_date === todayStr)
      .map(r => {
        const stu = students.find(s => String(s.gcc_no) === String(r.adm_app_id))
        return { gcc_no: r.adm_app_id, name: stu?.name || '—', course: stu?.course || '—', hostel_type: stu?.hostel_type || '—', batch: stu?.class_name || stu?.batch || '—', type: 'Course Fee', description: `${r.course} — ${r.for_month} ${r.year}${r.is_advance?' (ADVANCE)':''}`, amount: Number(r.amount_paid) || 0, pay_date: r.pay_date, pay_mode: r.pay_mode || '—', collected_by: r.collected_by || '—', ref: r.txn_ref || '—' }
      })
    const admToday = adm_fee_collections
      .filter(r => r.pay_date === todayStr)
      .map(r => {
        const stu = students.find(s => String(s.gcc_no) === String(r.adm_app_id))
        return { gcc_no: r.adm_app_id, name: stu?.name || '—', course: stu?.course || '—', hostel_type: stu?.hostel_type || '—', batch: stu?.class_name || stu?.batch || '—', type: 'Admission Fee', description: r.description || r.fee_type || '—', amount: Number(r.amount_paid) || 0, pay_date: r.pay_date, pay_mode: r.pay_mode || '—', collected_by: r.collected_by || '—', ref: r.txn_ref || '—' }
      })
    return [...admToday, ...flatToday, ...crsfToday].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [adm_fee_collections, adm_flat_fees, adm_course_fees, students, todayStr])

  // Date-range transactions for admin export
  const rangeTransactions = useMemo(() => {
    const from = afDateFrom || '2020-01-01'
    const to   = afDateTo   || todayStr
    const inRange = d => d >= from && d <= to
    const flat = adm_flat_fees
      .filter(r => inRange(r.pay_date || ''))
      .map(r => {
        const stu = students.find(s => String(s.gcc_no) === String(r.adm_app_id))
        return { gcc_no: r.adm_app_id, name: stu?.name || '—', course: stu?.course || '—', hostel_type: stu?.hostel_type || '—', batch: stu?.class_name || stu?.batch || '—', type: 'Flat Fee', description: `${r.month} ${r.year}${r.is_advance?' (ADVANCE)':''}`, amount: r.amount || 0, pay_date: r.pay_date, pay_mode: r.pay_mode || '—', collected_by: r.collected_by || '—', ref: r.txn_ref || '—' }
      })
    const crsf = adm_course_fees
      .filter(r => inRange(r.pay_date || ''))
      .map(r => {
        const stu = students.find(s => String(s.gcc_no) === String(r.adm_app_id))
        return { gcc_no: r.adm_app_id, name: stu?.name || '—', course: stu?.course || '—', hostel_type: stu?.hostel_type || '—', batch: stu?.class_name || stu?.batch || '—', type: 'Course Fee', description: `${r.course} — ${r.for_month} ${r.year}${r.is_advance?' (ADVANCE)':''}`, amount: Number(r.amount_paid) || 0, pay_date: r.pay_date, pay_mode: r.pay_mode || '—', collected_by: r.collected_by || '—', ref: r.txn_ref || '—' }
      })
    const adm = adm_fee_collections
      .filter(r => inRange(r.pay_date || ''))
      .map(r => {
        const stu = students.find(s => String(s.gcc_no) === String(r.adm_app_id))
        return { gcc_no: r.adm_app_id, name: stu?.name || '—', course: stu?.course || '—', hostel_type: stu?.hostel_type || '—', batch: stu?.class_name || stu?.batch || '—', type: 'Admission Fee', description: r.description || r.fee_type || '—', amount: Number(r.amount_paid) || 0, pay_date: r.pay_date, pay_mode: r.pay_mode || '—', collected_by: r.collected_by || '—', ref: r.txn_ref || '—' }
      })
    return [...adm, ...flat, ...crsf].sort((a, b) => (b.pay_date || '').localeCompare(a.pay_date || ''))
  }, [adm_fee_collections, adm_flat_fees, adm_course_fees, students, afDateFrom, afDateTo, todayStr])

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 24, fontFamily: 'system-ui,sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 'bold', color: '#1e3a5f', margin: 0 }}>💰 Fee Management</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Dashboard · Collect · Invoice · Live summary · Admin view</p>
        </div>
        {tab === 'live' && (
          <ExportBar
            rows={advFilteredLive.map(s => ({ gcc_no: s.gcc_no, name: s.name, batch: s.class_name || s.batch || '', course: s.course || '', hostel_type: s.hostel_type || '', adm_fee: s.admTotal, flat_fee: s.flatTotal, course_fee: s.crsfTotal, total_paid: s.grandTotal, status: s.liveStatus }))}
            filename={`GNSI_Live_Fees_${todayStr}`} label="Live" />
        )}
        {tab === 'admin' && (
          <ExportBar rows={rangeTransactions} filename={`GNSI_Transactions_${afDateFrom||todayStr}_to_${afDateTo||todayStr}`} label="Txns" />
        )}
      </div>

      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 24, overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch('') }}
            style={{ padding: '9px 20px', border: 'none', borderBottom: tab === t.id ? '3px solid #1e3a5f' : '3px solid transparent', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? '#1e3a5f' : '#64748b', marginBottom: -2, whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <FeeDashboardTab
          students={activeStudents}
          adm_fee_collections={activeAdmFeeCollections}
          adm_flat_fees={activeAdmFlatFees}
          adm_course_fees={activeAdmCourseFees}
          liveRows={liveRows}
          onCollect={s => { setPresetCollectStudent(s); setTab('payment') }}
        />
      )}

      {tab === 'payment' && (
        <FeePaymentTab
          students={students} admissions={admissions}
          adm_fee_collections={adm_fee_collections}
          adm_flat_fees={adm_flat_fees}
          adm_course_fees={adm_course_fees}
          onRefresh={loadAll}
          isAdmin={isAdmin} currentUser={currentUser}
          presetStudent={presetCollectStudent}
          onPresetConsumed={() => setPresetCollectStudent(null)}
        />
      )}

      {tab === 'live' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5,1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total students',  value: students.length,  color: '#1e3a5f', bg: '#eff6ff', icon: '👨‍🎓' },
              { label: 'Total collected', value: `₹${n(liveTtl)}`, color: '#16a34a', bg: '#dcfce7', icon: '✅' },
              { label: 'Fees pending',    value: liveP,            color: '#dc2626', bg: '#fee2e2', icon: '⚠️' },
              { label: 'Underpaid (hostel)', value: liveUnderpaid, color: '#c2410c', bg: '#ffedd5', icon: '🏠' },
              { label: 'Fully paid',      value: liveP2,           color: '#7c3aed', bg: '#f5f3ff', icon: '🎉' },
            ].map(c => (
              <div key={c.label} style={{ backgroundColor: c.bg, borderRadius: 12, padding: 18, boxShadow: '0 2px 8px rgba(0,0,0,.06)', borderLeft: `4px solid ${c.color}` }}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div>
                <p style={{ fontSize: 13, color: c.color, fontWeight: 600, margin: 0 }}>{c.label}</p>
                <h2 style={{ fontSize: 22, fontWeight: 'bold', color: c.color, margin: '4px 0 0' }}>{c.value}</h2>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginBottom: afShowFilters ? 8 : 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 200 }} />
            <select value={afStatus} onChange={e => setAfStatus(e.target.value)} style={{ ...inp, width: 'auto' }}>
              <option value="All">All Status</option><option>Paid</option><option>Partial</option><option>Underpaid</option><option>Pending</option>
            </select>
            <button onClick={() => setAfShowFilters(f => !f)}
              style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: afShowFilters ? '#1e3a5f' : 'white', color: afShowFilters ? 'white' : '#64748b', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              ⚙ Filters {(afCourse!=='All'||afHostel!=='All'||afBatch!=='All') ? '●' : ''}
            </button>
          </div>
          {afShowFilters && (
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>COURSE</div>
                <select value={afCourse} onChange={e => setAfCourse(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }}>
                  <option value="All">All Courses</option>
                  {['Sainik','Navodaya','Foundation','Combined Course'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>HOSTEL TYPE</div>
                <select value={afHostel} onChange={e => setAfHostel(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }}>
                  <option value="All">All Types</option>
                  {['Boarder','Day Boarder','Day Scholar'].map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>BATCH / CLASS</div>
                <select value={afBatch} onChange={e => setAfBatch(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }}>
                  {allBatches.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={() => { setAfCourse('All'); setAfHostel('All'); setAfBatch('All'); setAfStatus('All') }}
                  style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer', width: '100%' }}>
                  ✕ Clear filters
                </button>
              </div>
            </div>
          )}
          {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading…</div> : (
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
              <div style={{ padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{advFilteredLive.length} students</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                <thead>
                  <tr style={{ background: '#1e3a5f' }}>
                    {['#','GCC','Student','Class','Course','Hostel','Adm fee','Flat','Course','Total','Status','Sync'].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advFilteredLive.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                      <td style={{ padding: '10px 14px', color: '#94a3b8', fontSize: 11 }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#1e3a5f', fontWeight: 700 }}>{s.gcc_no ? `GCC-${s.gcc_no}` : '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {s.name}
                          {s.is_repeater && (
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: 3, border: '1px solid #fcd34d', letterSpacing: '.04em', whiteSpace: 'nowrap' }}>🔁 RPT</span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.class_name || s.batch || '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#64748b' }}>{s.course || '—'}</td>
                      <td style={{ padding: '10px 14px' }}><HostelBadge type={s.hostel_type} /></td>
                      <td style={{ padding: '10px 14px', color: '#4f46e5', fontWeight: 600 }}>{s.admTotal  > 0 ? `₹${n(s.admTotal)}`  : '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#059669', fontWeight: 600 }}>{s.flatTotal > 0 ? `₹${n(s.flatTotal)}` : '—'}</td>
                      <td style={{ padding: '10px 14px', color: '#7c3aed', fontWeight: 600 }}>{s.crsfTotal > 0 ? `₹${n(s.crsfTotal)}` : '—'}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, color: s.grandTotal > 0 ? '#16a34a' : '#94a3b8' }}>{s.grandTotal > 0 ? `₹${n(s.grandTotal)}` : '—'}</td>
                      <td style={{ padding: '10px 14px' }}><span style={sStyle(s.liveStatus)}>{s.liveStatus}</span></td>
                      <td style={{ padding: '10px 14px' }}>
                        {s.hasFees && <button onClick={() => handleSync(s)} style={{ background: '#eff6ff', color: '#1e3a5f', border: '1px solid #bfdbfe', borderRadius: 6, padding: '4px 9px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>⇄</button>}
                      </td>
                    </tr>
                  ))}
                  {advFilteredLive.length === 0 && <tr><td colSpan={12} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No students found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'admin' && (
        <>
          {/* ── Today summary cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
            {[
              { icon: '🌅', label: "Today's Total", value: `₹${n(todayTransactions.reduce((s,r)=>s+r.amount,0))}`, color: '#7c3aed', bg: '#f5f3ff', sub: `${todayTransactions.length} transactions` },
              { icon: '🎓', label: 'Adm Fees Today', value: `₹${n(todayTransactions.filter(r=>r.type==='Admission Fee').reduce((s,r)=>s+r.amount,0))}`, color: '#4f46e5', bg: '#eef2ff', sub: `${todayTransactions.filter(r=>r.type==='Admission Fee').length} entries` },
              { icon: '📅', label: 'Flat Fees Today', value: `₹${n(todayTransactions.filter(r=>r.type==='Flat Fee').reduce((s,r)=>s+r.amount,0))}`, color: '#059669', bg: '#f0fdf4', sub: `${todayTransactions.filter(r=>r.type==='Flat Fee').length} entries` },
              { icon: '📚', label: 'Course Fees Today', value: `₹${n(todayTransactions.filter(r=>r.type==='Course Fee').reduce((s,r)=>s+r.amount,0))}`, color: '#d97706', bg: '#fffbeb', sub: `${todayTransactions.filter(r=>r.type==='Course Fee').length} entries` },
            ].map(c => (
              <div key={c.label} style={{ background: c.bg, borderRadius: 12, padding: '14px 16px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{c.icon}</div>
                <div style={{ fontSize: 11, color: c.color, fontWeight: 600, marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</div>
                {c.sub && <div style={{ fontSize: 10, color: c.color, opacity: .7, marginTop: 3 }}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* ── Filters + date range ── */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#1e3a5f', marginBottom: 10 }}>🔍 Filter & Search Transactions</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(5,1fr)', gap: 10, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>COURSE</div>
                <select value={afCourse} onChange={e => setAfCourse(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }}>
                  <option value="All">All Courses</option>
                  {['Sainik','Navodaya','Foundation','Combined Course'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>HOSTEL</div>
                <select value={afHostel} onChange={e => setAfHostel(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }}>
                  <option value="All">All Types</option>
                  {['Boarder','Day Boarder','Day Scholar'].map(h => <option key={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>BATCH</div>
                <select value={afBatch} onChange={e => setAfBatch(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }}>
                  {allBatches.map(b => <option key={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>FROM DATE</div>
                <input type="date" value={afDateFrom} onChange={e => setAfDateFrom(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', marginBottom: 3 }}>TO DATE</div>
                <input type="date" value={afDateTo} onChange={e => setAfDateTo(e.target.value)} style={{ ...inp, fontSize: 12, padding: '6px 10px' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <input placeholder="🔍 Search name or GCC…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...inp, flex: 2, minWidth: 180, fontSize: 12, padding: '7px 12px' }} />
              <button onClick={() => { setAfDateFrom(todayStr); setAfDateTo(todayStr) }}
                style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e3a5f', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                📅 Today
              </button>
              <button onClick={() => { const d = new Date(); d.setDate(d.getDate()-7); setAfDateFrom(d.toLocaleDateString('en-CA')); setAfDateTo(todayStr) }}
                style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #d1fae5', background: '#ecfdf5', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                📅 Last 7 days
              </button>
              <button onClick={() => { const d = new Date(); d.setDate(1); setAfDateFrom(d.toLocaleDateString('en-CA')); setAfDateTo(todayStr) }}
                style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #ede9fe', background: '#f5f3ff', color: '#7c3aed', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                📅 This month
              </button>
              <button onClick={() => { setAfCourse('All'); setAfHostel('All'); setAfBatch('All'); setAfDateFrom(''); setAfDateTo(''); setSearch('') }}
                style={{ padding: '7px 12px', borderRadius: 7, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                ✕ Clear
              </button>
            </div>
          </div>

          {/* ── Today's transactions table (default, no date filter) ── */}
          {!afDateFrom && !afDateTo ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a5f' }}>📋 Today's Transactions — {todayStr}</div>
                <ExportBar rows={todayTransactions} filename={`GNSI_Today_${todayStr}`} label="Today" />
              </div>
              {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading…</div> : (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: '#7c3aed' }}>
                        {['#','GCC','Student','Batch','Course','Hostel','Type','Description','Amount','Date','Mode','Collected By','Ref'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {todayTransactions.filter(r => {
                        const q = search.toLowerCase()
                        return (afCourse==='All'||r.course===afCourse) && (afHostel==='All'||r.hostel_type===afHostel) && (afBatch==='All'||r.batch===afBatch) &&
                          (!q || (r.name||'').toLowerCase().includes(q) || String(r.gcc_no||'').includes(q))
                      }).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background='#faf5ff'}
                          onMouseLeave={e => e.currentTarget.style.background='white'}>
                          <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11 }}>{i+1}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#1e3a5f', fontWeight: 700 }}>GCC-{r.gcc_no}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{r.name}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{r.batch}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{r.course}</td>
                          <td style={{ padding: '9px 12px' }}><HostelBadge type={r.hostel_type} /></td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: r.type==='Admission Fee'?'#eef2ff':r.type==='Flat Fee'?'#f0fdf4':'#f5f3ff', color: r.type==='Admission Fee'?'#4f46e5':r.type==='Flat Fee'?'#059669':'#7c3aed' }}>{r.type}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: '#475569', fontSize: 12 }}>{r.description}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 800, color: '#16a34a', fontSize: 13 }}>₹{n(r.amount)}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11 }}>{r.pay_date || '—'}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', fontSize: 12 }}>{r.pay_mode}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', fontSize: 12 }}>{r.collected_by}</td>
                          <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11 }}>{r.ref}</td>
                        </tr>
                      ))}
                      {todayTransactions.length === 0 && (
                        <tr><td colSpan={13} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No transactions recorded today yet</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan={8} style={{ padding: '10px 12px', fontWeight: 800, color: '#1e3a5f', fontSize: 13 }}>Today's Total</td>
                        <td style={{ padding: '10px 12px', fontWeight: 900, color: '#16a34a', fontSize: 14 }}>₹{n(todayTransactions.reduce((s,r)=>s+r.amount,0))}</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          ) : (
            /* ── Date-range transactions table ── */
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a5f' }}>
                  📋 Transactions: {afDateFrom || '…'} → {afDateTo || '…'} · <span style={{ color: '#7c3aed' }}>{rangeTransactions.length} records · ₹{n(rangeTransactions.reduce((s,r)=>s+r.amount,0))}</span>
                </div>
                <ExportBar rows={rangeTransactions} filename={`GNSI_Transactions_${afDateFrom}_${afDateTo}`} label="Range" />
              </div>
              {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading…</div> : (
                <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                    <thead>
                      <tr style={{ background: '#1e3a5f' }}>
                        {['#','GCC','Student','Batch','Course','Hostel','Type','Description','Amount','Date','Mode','Collected By','Ref'].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rangeTransactions.filter(r => {
                        const q = search.toLowerCase()
                        return (afCourse==='All'||r.course===afCourse) && (afHostel==='All'||r.hostel_type===afHostel) && (afBatch==='All'||r.batch===afBatch) &&
                          (!q || (r.name||'').toLowerCase().includes(q) || String(r.gcc_no||'').includes(q))
                      }).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background='white'}>
                          <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11 }}>{i+1}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#1e3a5f', fontWeight: 700 }}>GCC-{r.gcc_no}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>{r.name}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{r.batch}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{r.course}</td>
                          <td style={{ padding: '9px 12px' }}><HostelBadge type={r.hostel_type} /></td>
                          <td style={{ padding: '9px 12px' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: r.type==='Admission Fee'?'#eef2ff':r.type==='Flat Fee'?'#f0fdf4':'#f5f3ff', color: r.type==='Admission Fee'?'#4f46e5':r.type==='Flat Fee'?'#059669':'#7c3aed' }}>{r.type}</span>
                          </td>
                          <td style={{ padding: '9px 12px', color: '#475569', fontSize: 12 }}>{r.description}</td>
                          <td style={{ padding: '9px 12px', fontWeight: 800, color: '#16a34a', fontSize: 13 }}>₹{n(r.amount)}</td>
                          <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 11, fontWeight: 700 }}>{r.pay_date || '—'}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', fontSize: 12 }}>{r.pay_mode}</td>
                          <td style={{ padding: '9px 12px', color: '#475569', fontSize: 12 }}>{r.collected_by}</td>
                          <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11 }}>{r.ref}</td>
                        </tr>
                      ))}
                      {rangeTransactions.length === 0 && (
                        <tr><td colSpan={13} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No transactions in this date range</td></tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                        <td colSpan={8} style={{ padding: '10px 12px', fontWeight: 800, color: '#1e3a5f', fontSize: 13 }}>Range Total</td>
                        <td style={{ padding: '10px 12px', fontWeight: 900, color: '#16a34a', fontSize: 14 }}>₹{n(rangeTransactions.reduce((s,r)=>s+r.amount,0))}</td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── All-students fee status grid (admin view) ── */}
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a5f' }}>👨‍🎓 All Students Fee Status</div>
              <ExportBar
                rows={advFilteredLive.map(s => ({ gcc_no: s.gcc_no, name: s.name, batch: s.class_name||s.batch||'', course: s.course||'', hostel_type: s.hostel_type||'', adm_fee: s.admTotal, flat_fee: s.flatTotal, course_fee: s.crsfTotal, total_paid: s.grandTotal, status: s.liveStatus }))}
                filename={`GNSI_Students_FeeStatus_${todayStr}`} label="Students" />
            </div>
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.08)', overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
                <thead>
                  <tr style={{ background: '#1e3a5f' }}>
                    {['#','GCC','Student','Batch','Course','Hostel','Adm','Flat','Course','Total','Status'].map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'white', fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {advFilteredLive.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                      onMouseEnter={e => e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.background='white'}>
                      <td style={{ padding: '9px 12px', color: '#94a3b8', fontSize: 11 }}>{i+1}</td>
                      <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontSize: 11, color: '#1e3a5f', fontWeight: 700 }}>GCC-{s.gcc_no}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 600, color: '#1e293b' }}>
                        {s.name}
                        {s.is_repeater && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 800, color: '#92400e', background: '#fef3c7', padding: '1px 5px', borderRadius: 3, border: '1px solid #fcd34d' }}>RPT</span>}
                      </td>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{s.class_name||s.batch||'—'}</td>
                      <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{s.course||'—'}</td>
                      <td style={{ padding: '9px 12px' }}><HostelBadge type={s.hostel_type} /></td>
                      <td style={{ padding: '9px 12px', color: '#4f46e5', fontWeight: 600 }}>{s.admTotal>0?`₹${n(s.admTotal)}`:'—'}</td>
                      <td style={{ padding: '9px 12px', color: '#059669', fontWeight: 600 }}>{s.flatTotal>0?`₹${n(s.flatTotal)}`:'—'}</td>
                      <td style={{ padding: '9px 12px', color: '#7c3aed', fontWeight: 600 }}>{s.crsfTotal>0?`₹${n(s.crsfTotal)}`:'—'}</td>
                      <td style={{ padding: '9px 12px', fontWeight: 800, color: s.grandTotal>0?'#16a34a':'#94a3b8' }}>{s.grandTotal>0?`₹${n(s.grandTotal)}`:'—'}</td>
                      <td style={{ padding: '9px 12px' }}><span style={sStyle(s.liveStatus)}>{s.liveStatus}</span></td>
                    </tr>
                  ))}
                  {advFilteredLive.length === 0 && <tr><td colSpan={11} style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>No students match filters</td></tr>}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0' }}>
                    <td colSpan={9} style={{ padding: '10px 12px', fontWeight: 800, color: '#1e3a5f', fontSize: 13 }}>Grand Total ({advFilteredLive.length} students)</td>
                    <td style={{ padding: '10px 12px', fontWeight: 900, color: '#16a34a', fontSize: 14 }}>₹{n(advFilteredLive.reduce((s,r)=>s+r.grandTotal,0))}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          {/* ── Daily Income Report print card ── */}
          <DailyIncomeReport
            date={afDateFrom && afDateFrom === afDateTo ? afDateFrom : todayStr}
            transactions={afDateFrom || afDateTo ? rangeTransactions : todayTransactions}
            generatedBy={currentUser?.name || 'Admin'}
          />
        </>
      )}

      {tab === 'ledger' && (
        <StudentLedgerTab
          students={students}
          adm_fee_collections={adm_fee_collections}
          adm_flat_fees={adm_flat_fees}
          adm_course_fees={adm_course_fees}
          liveRows={liveRows}
          isAdmin={isAdmin}
          currentUser={currentUser}
          onRefresh={loadAll}
          onCollect={s => { setTab('payment') }}
        />
      )}

      {tab === 'reports' && (
        <ReportsExportTab
          students={activeStudents}
          adm_fee_collections={activeAdmFeeCollections}
          adm_flat_fees={activeAdmFlatFees}
          adm_course_fees={activeAdmCourseFees}
          liveRows={liveRows}
        />
      )}

      {tab === 'anomaly' && (
        <AnomalyMonitor
          adm_fee_collections={adm_fee_collections}
          adm_flat_fees={adm_flat_fees}
          adm_course_fees={adm_course_fees}
          students={students}
          liveRows={liveRows}
          isAdmin={isAdmin}
          currentUser={currentUser}
        />
      )}
    </div>
  )
}
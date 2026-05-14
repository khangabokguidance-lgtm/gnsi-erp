import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'

// ─── Institute config ──────────────────────────────────────────
const INSTITUTE = {
  name:    'Guidance Navodaya & Sainik Institute',
  short:   'GNSI',
  address: 'Khangabok, Thoubal, Manipur — 795128',
  phone:   '+91 9876543210',
}

// ─── Fee constants ─────────────────────────────────────────────
const FLAT_FEES = [
  { id:'ff_feb', month:'February', amount:5500, year: new Date().getFullYear() },
  { id:'ff_mar', month:'March',    amount:5500, year: new Date().getFullYear() },
]
const DRESS_ITEMS = [
  { id:'dk1', name:'Aqua T-Shirt',     price:450 },
  { id:'dk2', name:'Blue T-Shirt',     price:450 },
  { id:'dk3', name:'Track Suit',       price:900 },
  { id:'dk4', name:'Track Pant',       price:600 },
  { id:'dk5', name:'Track Suit Set 2', price:600 },
]
const COURSE_STRUCTURE = {
  Navodaya:          { subtypes:['Lakshya','Umeed'] },
  Sainik:            { subtypes:['Achiever','Leader','Champion'] },
  Foundation:        { subtypes:['Elite','Prime'] },
  'Combined Course': { subtypes:[] },
}
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December']
const PAY_MODES = ['Cash','UPI','Bank Transfer','Cheque','DD','Razorpay']
const ADM_FEE_BASE   = 6000
const PROSPECTUS_FEE = 200

// ─── Helpers ──────────────────────────────────────────────────
const fmt    = n  => Number(n||0).toLocaleString('en-IN')
const today  = () => new Date().toISOString().split('T')[0]
const rcptNo = p  => p + Date.now().toString(36).toUpperCase()

const inp = { width:'100%', padding:'10px 14px', borderRadius:'8px', border:'1px solid #d1d5db', fontSize:'14px', outline:'none', boxSizing:'border-box', backgroundColor:'white' }
const lbl = { display:'block', fontSize:'13px', fontWeight:'600', color:'#374151', marginBottom:'6px' }

const sStyle = status => ({
  padding:'4px 10px', borderRadius:'999px', fontSize:'12px', fontWeight:'600',
  backgroundColor: status==='Paid'?'#dcfce7':status==='Partial'?'#fef9c3':'#fee2e2',
  color:           status==='Paid'?'#16a34a':status==='Partial'?'#ca8a04':'#dc2626',
})

// ─── Student search dropdown ───────────────────────────────────
function StudentSearch({ students, onSelect, placeholder }) {
  const [q, setQ] = useState('')
  const hits = q.length > 0
    ? students.filter(s =>
        (s.name||'').toLowerCase().includes(q.toLowerCase()) ||
        String(s.gcc_no||'').includes(q)
      ).slice(0,8)
    : []
  return (
    <div style={{ position:'relative' }}>
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder={placeholder||'Type name or GCC No...'} style={inp} />
      {hits.length > 0 && (
        <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid #d1d5db', borderRadius:8, zIndex:200, boxShadow:'0 4px 12px rgba(0,0,0,.12)', maxHeight:200, overflowY:'auto' }}>
          {hits.map(s=>(
            <div key={s.id} onClick={()=>{ onSelect(s); setQ('') }}
              style={{ padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid #f1f5f9', fontSize:13 }}
              onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
              onMouseLeave={e=>e.currentTarget.style.background='white'}
            >
              <strong>{s.name}</strong>
              <span style={{ color:'#64748b', marginLeft:8 }}>GCC-{s.gcc_no||'--'} · {s.class_name||s.cls||'--'} · {s.course||'--'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  INVOICE — HTML builder + print/PDF
// ══════════════════════════════════════════════════════════════
function buildInvoiceHTML(d) {
  const {
    receiptNo, date, payMode, txnRef, collectedBy,
    studentName, admNo, gccNo, className, course,
    admFeeAmt, dressItems, prospectus,
    flatMonths, courseFees,
    advAmt, advFor,
  } = d

  const admSubtotal  = admFeeAmt + dressItems.reduce((s,i)=>s+i.price,0) + (prospectus?PROSPECTUS_FEE:0)
  const flatSubtotal = flatMonths.reduce((s,m)=>s+m.amount,0)
  const crsfSubtotal = courseFees.reduce((s,c)=>s+c.amount,0)
  const advTotal     = Number(advAmt)||0
  const grand        = admSubtotal + flatSubtotal + crsfSubtotal + advTotal

  const dressRows = dressItems.map(i=>`
    <tr><td style="padding:5px 18px 5px 30px;font-size:12px;color:#475569">&#8627; ${i.name}</td>
        <td style="padding:5px 18px;text-align:right;font-size:12px;color:#475569">&#8377;${fmt(i.price)}</td></tr>`).join('')

  const flatRows = flatMonths.map(m=>`
    <tr><td style="padding:8px 18px;color:#047857;font-weight:600">${m.month} ${m.year}</td>
        <td style="padding:8px 18px;text-align:right;font-weight:700;color:#047857">&#8377;${fmt(m.amount)}</td></tr>`).join('')

  const crsfRows = courseFees.map(c=>`
    <tr><td style="padding:8px 18px;color:#7c3aed;font-weight:600">${c.course}${c.subtype?' &middot; '+c.subtype:''} &mdash; ${c.forMonth}</td>
        <td style="padding:8px 18px;text-align:right;font-weight:700;color:#7c3aed">&#8377;${fmt(c.amount)}</td></tr>`).join('')

  // jsPDF section data — uses Rs. prefix since jsPDF helvetica can't render ₹
  const pdfSections = JSON.stringify([
    ...(admSubtotal > 0 ? [{ label:'Admission Package', rgb:[55,48,163], rows:[
      ['Admission Fee', `Rs.${fmt(admFeeAmt)}`],
      ...dressItems.map(i=>['  '+i.name, `Rs.${fmt(i.price)}`]),
      ...(prospectus?[['  Prospectus',`Rs.${fmt(PROSPECTUS_FEE)}`]]:[]),
      ['Subtotal', `Rs.${fmt(admSubtotal)}`],
    ]}] : []),
    ...(flatSubtotal > 0 ? [{ label:'Monthly Flat Fees', rgb:[4,120,87], rows:[
      ...flatMonths.map(m=>[`${m.month} ${m.year}`, `Rs.${fmt(m.amount)}`]),
      ['Subtotal', `Rs.${fmt(flatSubtotal)}`],
    ]}] : []),
    ...(crsfSubtotal > 0 ? [{ label:'Course Fees', rgb:[109,40,217], rows:[
      ...courseFees.map(c=>[`${c.course}${c.subtype?' · '+c.subtype:''} — ${c.forMonth}`, `Rs.${fmt(c.amount)}`]),
      ['Subtotal', `Rs.${fmt(crsfSubtotal)}`],
    ]}] : []),
    ...(advTotal > 0 ? [{ label:'Advance Payment', rgb:[180,83,9], rows:[
      [advFor||'Advance', `Rs.${fmt(advTotal)}`],
    ]}] : []),
  ])

  // PATCH 4: robust print function — uses blob fallback if popup is blocked
  const printScript = `
  function doPrint() {
    var pw = window.open('','_blank','width=720,height=840,scrollbars=yes');
    if (!pw) {
      // Popup blocked — fallback: blob URL in same tab
      var html = document.documentElement.outerHTML;
      var blob = new Blob([html], {type:'text/html'});
      var url  = URL.createObjectURL(blob);
      var a    = document.createElement('a');
      a.href = url; a.target = '_blank'; a.click();
      URL.revokeObjectURL(url);
      return;
    }
    pw.document.write(document.documentElement.outerHTML);
    pw.document.close();
    pw.onload = function(){ pw.print(); setTimeout(function(){ pw.close(); }, 400); };
  }
  `

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Invoice ${receiptNo}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'DM Sans',system-ui,sans-serif;background:#F1F5F9;padding:28px 16px;display:flex;flex-direction:column;align-items:center;gap:16px;min-height:100vh}
    .card{background:#fff;border-radius:16px;width:100%;max-width:620px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.1)}
    .hdr{background:linear-gradient(150deg,#1E1B4B 0%,#3730A3 65%,#6D28D9 100%);padding:26px 28px 20px;color:#fff}
    .inst{font-size:12px;font-weight:700;letter-spacing:.08em;color:rgba(255,255,255,.6);text-transform:uppercase;margin-bottom:3px}
    .addr{font-size:11px;color:rgba(255,255,255,.45);margin-bottom:14px}
    .badge{display:inline-block;padding:3px 11px;border-radius:99px;background:rgba(255,255,255,.14);font-size:11px;font-weight:600;color:rgba(255,255,255,.85);margin-bottom:7px}
    .rtitle{font-size:22px;font-weight:800;letter-spacing:-.02em}
    .rno{font-size:12px;color:rgba(255,255,255,.5);margin-top:2px}
    .meta{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #E2E8F0}
    .mc{padding:10px 18px;border-right:1px solid #E2E8F0}
    .mc:last-child{border-right:none}
    .ml{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
    .mv{font-weight:700;color:#1E293B;font-size:12px}
    table{width:100%;border-collapse:collapse}
    td{padding:8px 18px;border-bottom:1px solid #F1F5F9;font-size:13px}
    .sec{padding:7px 18px 4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#94A3B8;background:#F8FAFC;border-bottom:1px solid #F1F5F9}
    .sub td{background:#F8FAFC;font-weight:700;font-size:12px;color:#475569;border-top:1px solid #E2E8F0}
    .grand td{background:linear-gradient(90deg,#1E1B4B,#3730A3);font-weight:900;font-size:16px;color:#fff;padding:14px 18px;border:none}
    .ftr{padding:16px 20px;background:#F8FAFC;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between;align-items:flex-end}
    .sig-box{font-size:11px;color:#94A3B8;margin-bottom:4px}
    .sig-line{height:1px;width:130px;border-top:1.5px dashed #CBD5E1;margin-top:32px}
    .btns{display:flex;gap:10px;justify-content:center}
    .btn{padding:11px 30px;border:none;border-radius:10px;font-size:14px;font-family:'DM Sans',sans-serif;font-weight:700;cursor:pointer;transition:opacity .15s}
    .btn:hover{opacity:.88}
    .bp{background:#3730A3;color:#fff}
    .bd{background:#059669;color:#fff}
    @media print{.btns{display:none}body{background:#fff;padding:0}.card{box-shadow:none}}
  </style></head><body>

  <div class="card" id="invoice">
    <div class="hdr">
      <div class="inst">${INSTITUTE.name}</div>
      <div class="addr">${INSTITUTE.address} &middot; ${INSTITUTE.phone}</div>
      <div class="badge">OFFICIAL FEE INVOICE</div>
      <div class="rtitle">Fee Receipt</div>
      <div class="rno">${INSTITUTE.short} &middot; ${receiptNo}</div>
    </div>

    <div class="meta">
      <div class="mc"><div class="ml">Date</div><div class="mv">${date}</div></div>
      <div class="mc"><div class="ml">Pay Mode</div><div class="mv">${payMode}</div></div>
      <div class="mc"><div class="ml">Collected By</div><div class="mv">${collectedBy||'Admin'}</div></div>
    </div>

    <table><tbody>
      <tr><td style="color:#64748B;width:40%">Student</td><td style="font-weight:700;color:#0F172A">${studentName}</td></tr>
      <tr><td style="color:#64748B">Adm. No.</td><td style="font-weight:700;color:#0F172A">${admNo||'&mdash;'}</td></tr>
      <tr><td style="color:#64748B">GCC No.</td><td style="font-weight:700;color:#0F172A">${gccNo?'GCC-'+gccNo:'&mdash;'}</td></tr>
      <tr><td style="color:#64748B">Class / Course</td><td style="font-weight:700;color:#0F172A">${className||'&mdash;'}${course?' &middot; '+course:''}</td></tr>
      ${txnRef?`<tr><td style="color:#64748B">Txn Ref</td><td style="font-weight:700;color:#0F172A">${txnRef}</td></tr>`:''}
    </tbody></table>

    ${admSubtotal > 0 ? `
    <div class="sec">&#127891; Admission Package</div>
    <table><tbody>
      <tr><td style="color:#1E293B;font-weight:600">Admission Fee</td><td style="text-align:right;font-weight:700;color:#3730A3">&#8377;${fmt(admFeeAmt)}</td></tr>
      ${dressRows}
      ${prospectus?`<tr><td style="padding:5px 18px 5px 30px;font-size:12px;color:#475569">&#8627; Prospectus</td><td style="padding:5px 18px;text-align:right;font-size:12px;color:#475569">&#8377;${fmt(PROSPECTUS_FEE)}</td></tr>`:''}
      <tr class="sub"><td>Admission Subtotal</td><td style="text-align:right">&#8377;${fmt(admSubtotal)}</td></tr>
    </tbody></table>` : ''}

    ${flatSubtotal > 0 ? `
    <div class="sec">&#128197; Monthly Flat Fees</div>
    <table><tbody>
      ${flatRows}
      <tr class="sub"><td>Flat Fee Subtotal</td><td style="text-align:right">&#8377;${fmt(flatSubtotal)}</td></tr>
    </tbody></table>` : ''}

    ${crsfSubtotal > 0 ? `
    <div class="sec">&#128218; Course Fees</div>
    <table><tbody>
      ${crsfRows}
      <tr class="sub"><td>Course Fee Subtotal</td><td style="text-align:right">&#8377;${fmt(crsfSubtotal)}</td></tr>
    </tbody></table>` : ''}

    ${advTotal > 0 ? `
    <div class="sec">Advance</div>
    <table><tbody>
      <tr><td style="color:#B45309;font-weight:600">${advFor||'Advance'}</td><td style="text-align:right;font-weight:700;color:#B45309">&#8377;${fmt(advTotal)}</td></tr>
    </tbody></table>` : ''}

    <table><tbody>
      <tr class="grand"><td>Grand Total</td><td style="text-align:right">&#8377;${fmt(grand)}</td></tr>
    </tbody></table>

    <div class="ftr">
      <div><div class="sig-box">Authorised Signature</div><div class="sig-line"></div></div>
      <div style="text-align:right;font-size:11px;color:#94A3B8">
        <div style="font-weight:700;color:#1E293B;font-size:13px">${INSTITUTE.short}</div>
        <div>${INSTITUTE.address}</div>
        <div style="margin-top:3px">Computer-generated receipt &middot; ${receiptNo}</div>
      </div>
    </div>
  </div>

  <div class="btns">
    <button class="btn bp" onclick="window.print()">&#128424; Print</button>
    <button class="btn bd" onclick="downloadPDF()">&#11015; Download PDF</button>
  </div>

  <script>
  ${printScript}

  const SECTIONS = ${pdfSections};
  const GRAND = ${grand};
  const RECEIPT = '${receiptNo}';

  // PATCH 3: use Rs. prefix throughout PDF (jsPDF helvetica can't render ₹ glyph)
  async function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit:'pt', format:'a4' });
    const W = 595;

    // Header
    doc.setFillColor(30,27,75); doc.rect(0,0,W,96,'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text('${INSTITUTE.name}', 30, 20);
    doc.text('${INSTITUTE.address} - ${INSTITUTE.phone}', 30, 32);
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('Fee Receipt', 30, 56);
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text('${INSTITUTE.short} - ' + RECEIPT, 30, 70);

    // Meta band
    doc.setFillColor(248,250,252); doc.rect(0,96,W,30,'F');
    doc.setTextColor(148,163,184); doc.setFontSize(7.5); doc.setFont('helvetica','normal');
    doc.text('DATE', 30,109); doc.text('PAY MODE', 210,109); doc.text('COLLECTED BY', 390,109);
    doc.setTextColor(30,41,59); doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text('${date}', 30,123); doc.text('${payMode}', 210,123); doc.text('${collectedBy||'Admin'}', 390,123);

    // Student info
    let y = 144;
    const fields = [
      ['Student','${studentName.replace(/'/g,"\\'")}'],
      ['Adm. No.','${admNo||'--'}'],
      ['GCC No.','${gccNo?'GCC-'+gccNo:'--'}'],
      ['Class / Course','${(className||'--')+(course?' - '+course:'')}'],
      ${txnRef?`['Txn Ref','${txnRef}'],`:''}
    ];
    fields.forEach(([k,v])=>{
      doc.setFontSize(10); doc.setFont('helvetica','normal'); doc.setTextColor(100,116,139);
      doc.text(k, 30, y);
      doc.setFont('helvetica','bold'); doc.setTextColor(15,23,42);
      doc.text(String(v), 200, y);
      doc.setDrawColor(241,245,249); doc.line(0, y+5, W, y+5);
      y += 20;
    });

    // Fee sections
    SECTIONS.forEach(sec => {
      y += 6;
      doc.setFillColor(...sec.rgb); doc.rect(0,y,W,17,'F');
      doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','bold');
      doc.text(sec.label, 30, y+12);
      y += 17;
      sec.rows.forEach((row, idx) => {
        const isLast = idx === sec.rows.length-1;
        if(isLast){ doc.setFillColor(248,250,252); doc.rect(0,y,W,17,'F'); }
        doc.setFontSize(10);
        doc.setFont('helvetica', isLast?'bold':'normal');
        doc.setTextColor(isLast?71:30, isLast?85:41, isLast?105:59);
        doc.text(row[0], isLast?30:38, y+12);
        doc.text(row[1], W-18, y+12, {align:'right'});
        y += 17;
      });
    });

    // Grand total — uses Rs. since ₹ glyph not supported
    y += 6;
    doc.setFillColor(30,27,75); doc.rect(0,y,W,28,'F');
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont('helvetica','bold');
    doc.text('Grand Total', 30, y+19);
    doc.text('Rs.' + GRAND.toLocaleString('en-IN'), W-18, y+19, {align:'right'});

    // Footer
    y += 50;
    doc.setTextColor(148,163,184); doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.text('${INSTITUTE.name} - ${INSTITUTE.address}', W/2, y, {align:'center'});
    doc.text('Computer-generated receipt - ${INSTITUTE.short} - ' + RECEIPT, W/2, y+12, {align:'center'});

    doc.save('GNSI-Invoice-' + RECEIPT + '.pdf');
  }
  </script>
  </body></html>`
}

// PATCH 4: printInvoice with blob fallback for popup-blocked browsers
function printInvoice(data) {
  const html = buildInvoiceHTML(data)
  const pw = window.open('', '_blank', 'width=720,height=840,scrollbars=yes')
  if (!pw) {
    // Popup blocked — open as blob URL instead
    const blob = new Blob([html], { type: 'text/html' })
    const url  = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 10000)
    return
  }
  pw.document.write(html)
  pw.document.close()
}

// ══════════════════════════════════════════════════════════════
//  TAB: Fee Payment
// ══════════════════════════════════════════════════════════════
function FeePaymentTab({ students, admApps, admCols, flatRecs, crsfRecs, onRefresh }) {
  const [step,    setStep]    = useState('select') // 'select' | 'pay'
  const [student, setStudent] = useState(null)
  const [admApp,  setAdmApp]  = useState(null)

  // Payment details
  const [payMode,      setPayMode]      = useState('Cash')
  const [payDate,      setPayDate]      = useState(today())
  const [txnRef,       setTxnRef]       = useState('')
  const [collectedBy,  setCollectedBy]  = useState('Admin')
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState(null)

  // Admission package
  const [admFeeAmt,    setAdmFeeAmt]    = useState(ADM_FEE_BASE)
  const [dressChecked, setDressChecked] = useState(DRESS_ITEMS.map(()=>true))
  const [prospChecked, setProspChecked] = useState(true)

  // Flat fees
  const [flatChecked,  setFlatChecked]  = useState([false,false])

  // Course fees rows
  const [crsfRows, setCrsfRows] = useState([{ course:'', subtype:'', forMonth:'', amount:'' }])

  // Advance
  const [advAmt, setAdvAmt] = useState('')
  const [advFor, setAdvFor] = useState('')

  const showToast = (msg, color='#16a34a') => { setToast({msg,color}); setTimeout(()=>setToast(null),3500) }

  // ── Derived from existing records ─────────────────────────
  const appId      = admApp ? String(admApp.id) : null
  const myAdmCols  = appId ? admCols.filter(c  => c.adm_app_id === appId) : []
  const myFlatRecs = appId ? flatRecs.filter(r => r.appId === appId && r.paid) : []
  const myCrsfRecs = appId ? crsfRecs.filter(r => r.appId === appId) : []
  const admPaid = myAdmCols.some(c => c.fee_type === 'admission')
  const paidMonths  = myFlatRecs.map(r=>r.month)
  const flatEverPaid= myFlatRecs.reduce((s,r)=>s+(r.amount||0),0)
  const crsfEverPaid= myCrsfRecs.reduce((s,r)=>s+(Number(r.amountPaid)||0),0)
  // PATCH 1: use amount_paid (snake_case) to match Supabase column
  const admEverPaid   = myAdmCols.reduce((s,c) => s+(Number(c.amount_paid)||0), 0)
  const totalEverPaid = admEverPaid + flatEverPaid + crsfEverPaid

  // ── Totals for this payment ────────────────────────────────
  const dressTotal = DRESS_ITEMS.reduce((s,i,idx)=>s+(dressChecked[idx]?i.price:0),0)
  const admPkgThis = admPaid ? 0 : (admFeeAmt + dressTotal + (prospChecked?PROSPECTUS_FEE:0))
  const selFlat    = FLAT_FEES.filter((_,i)=>flatChecked[i]&&!paidMonths.includes(FLAT_FEES[i].month))
  const flatThis   = selFlat.reduce((s,f)=>s+f.amount,0)
  const crsfThis   = crsfRows.reduce((s,r)=>s+(Number(r.amount)||0),0)
  const advThis    = Number(advAmt)||0
  const grandThis  = admPkgThis + flatThis + crsfThis + advThis

  const handleSelect = s => {
    setStudent(s)
    const app = admApps.find(a=>String(a.gcc_no)===String(s.gcc_no))||null
    setAdmApp(app)
    // pre-tick unpaid flat months
    const paid = app ? flatRecs.filter(r=>r.appId===String(app.id)&&r.paid).map(r=>r.month) : []
    setFlatChecked(FLAT_FEES.map(ff=>!paid.includes(ff.month)))
    setStep('pay')
  }

  const handleBack = () => {
    setStep('select'); setStudent(null); setAdmApp(null)
    setAdmFeeAmt(ADM_FEE_BASE); setDressChecked(DRESS_ITEMS.map(()=>true)); setProspChecked(true)
    setFlatChecked([false,false]); setCrsfRows([{course:'',subtype:'',forMonth:'',amount:''}])
    setAdvAmt(''); setAdvFor(''); setTxnRef('')
  }

  const handleSave = async () => {
    if (grandThis === 0) { showToast('Select at least one fee item','#dc2626'); return }
    if (!admApp) { showToast('No admission record linked to this student','#dc2626'); return }
    setSaving(true)

    const rNo = rcptNo('INV')
    const insertedDress = []
    const insertedFlat  = []
    const insertedCrsf  = []

    try {
      // 1. Admission package
      // PATCH 1: use amount_paid (snake_case) to match Supabase column name
      // PATCH 2: use adm_no (snake_case) to match Supabase column name
      if (!admPaid && admFeeAmt > 0) {
        await supabase.from('adm_fee_collections').insert({
          id:'col'+Date.now()+'a', adm_app_id:appId, fee_type:'admission',
          amount_paid:admFeeAmt,          // ← PATCH 1: was amountPaid
          payDate, payMode, txnRef,
          description:'Admission Fee', receiptNo:rNo,
          studentName:student.name,
          admNo:admApp.adm_no||'--',      // ← PATCH 2: was admApp.admNo
          collectedBy,
        })
        await supabase.from('accounts').insert({
          entry_date:payDate, type:'Income', category:'Admission',
          amount:admFeeAmt, payment_mode:payMode,
          note:`${student.name} · Admission Fee · ${rNo}`,
          source_ref:rNo+'_adm', source_type:'adm_fee',
        }).catch(()=>{})

        for (let i=0;i<DRESS_ITEMS.length;i++) {
          if (!dressChecked[i]) continue
          const item = DRESS_ITEMS[i]
          insertedDress.push(item)
          await supabase.from('adm_fee_collections').insert({
            id:'col'+Date.now()+'dk'+i, adm_app_id:appId, fee_type:'item',
            amount_paid:item.price,       // ← PATCH 1
            payDate, payMode, txnRef,
            description:'Dress Kit — '+item.name, receiptNo:rNo, studentName:student.name,
          })
        }
        if (prospChecked) {
          insertedDress.push({ name:'Prospectus', price:PROSPECTUS_FEE })
          await supabase.from('adm_fee_collections').insert({
            id:'col'+Date.now()+'p', adm_app_id:appId, fee_type:'item',
            amount_paid:PROSPECTUS_FEE,   // ← PATCH 1
            payDate, payMode,
            description:'Prospectus', receiptNo:rNo, studentName:student.name,
          })
        }
      }

      // 2. Flat fees
for (let fi = 0; fi < selFlat.length; fi++) {
  const ff = selFlat[fi]
  const rec = {
    id:'flat'+Date.now()+ff.id+fi, appId,
          month:ff.month, year:ff.year, amount:ff.amount,
          paid:true, date:payDate, mode:payMode, txnRef,
          rcptNo:rNo, studentName:student.name,
          admNo:admApp.adm_no||'--',      // ← PATCH 2
        }
        await supabase.from('adm_flat_fees').insert(rec)
        await supabase.from('accounts').insert({
          entry_date:payDate, type:'Income', category:'Hostel',
          amount:ff.amount, payment_mode:payMode,
          note:`${student.name} · ${ff.month} ${ff.year} Flat Fee · ${rNo}`,
          source_ref:rNo+'_flat_'+fi, source_type:'flat_fee',
        }).catch(()=>{})
        insertedFlat.push(ff)
      }

      // 3. Course fees
      for (const cf of crsfRows) {
        if (!cf.course || !cf.forMonth || !Number(cf.amount)) continue
        const rec = {
          id:'crsf'+Date.now()+Math.random().toString(36).slice(2),
          appId, course:cf.course, subtype:cf.subtype||'',
          forMonth:cf.forMonth,
          amountPaid:Number(cf.amount),   // adm_course_fees uses amountPaid — keep as-is
          date:payDate, payMode, txnRef, receiptNo:rNo,
          studentName:student.name,
          admNo:admApp.adm_no||'--',      // ← PATCH 2
        }
        await supabase.from('adm_course_fees').insert(rec)
        await supabase.from('accounts').insert({
          entry_date:payDate, type:'Income', category:'Fees',
          amount:Number(cf.amount), payment_mode:payMode,
          note:`${student.name} · ${cf.course} ${cf.forMonth} · ${rNo}`,
          source_ref:rNo+'_crsf_'+insertedCrsf.length, source_type:'course_fee',
        }).catch(()=>{})
        insertedCrsf.push({ ...cf, amount:Number(cf.amount) })
      }

      // 4. Advance
      if (advThis > 0) {
        await supabase.from('adm_fee_collections').insert({
          id:'col'+Date.now()+'adv', adm_app_id:appId, fee_type:'advance',
          amount_paid:advThis,            // ← PATCH 1
          advanceFor:advFor, payDate, payMode,
          description:'Advance — '+advFor, receiptNo:rNo, studentName:student.name,
        })
      }

      // 5. Print invoice
      printInvoice({
        receiptNo:rNo, date:payDate, payMode, txnRef, collectedBy,
        studentName:student.name,
        admNo:admApp.adm_no||'--',        // ← PATCH 2
        gccNo:student.gcc_no||'', className:student.class_name||student.cls||'',
        course:student.course||'',
        admFeeAmt: admPaid ? 0 : admFeeAmt,
        dressItems: insertedDress, prospectus:false,
        flatMonths: insertedFlat,
        courseFees: insertedCrsf,
        advAmt:advThis, advFor,
      })

      showToast(`✅ Saved & invoice printed · ${rNo}`)
      onRefresh()

      // Reset dynamic fields, keep student selected
      setCrsfRows([{course:'',subtype:'',forMonth:'',amount:''}])
      setAdvAmt(''); setAdvFor(''); setTxnRef('')
      const nowPaid=[...paidMonths,...insertedFlat.map(f=>f.month)]
      setFlatChecked(FLAT_FEES.map(ff=>!nowPaid.includes(ff.month)))

    } catch(err) {
      showToast('Error: '+err.message,'#dc2626')
    }
    setSaving(false)
  }

  // ── SELECT SCREEN ─────────────────────────────────────────
  if (step==='select') return (
    <div style={{ maxWidth:540, margin:'48px auto', textAlign:'center' }}>
      <div style={{ fontSize:52, marginBottom:16 }}>💳</div>
      <h2 style={{ fontSize:22, fontWeight:800, color:'#1e3a5f', marginBottom:8 }}>Collect Fee Payment</h2>
      <p style={{ color:'#64748b', fontSize:14, marginBottom:28 }}>Search a student to record fees and generate a combined invoice</p>
      <StudentSearch students={students} onSelect={handleSelect} placeholder="Search student by name or GCC No..." />
      <p style={{ fontSize:12, color:'#94a3b8', marginTop:14 }}>Start typing name or GCC number to search</p>
    </div>
  )

  // ── PAYMENT SCREEN ────────────────────────────────────────
  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:99999, background:'#fff', border:'1px solid #e2e8f0', borderLeft:`3px solid ${toast.color}`, borderRadius:10, padding:'11px 16px', fontSize:13, fontWeight:600, boxShadow:'0 8px 32px rgba(0,0,0,.12)', maxWidth:320, color:'#1e293b' }}>
          {toast.msg}
        </div>
      )}

      {/* Student bar */}
      <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'14px 18px', marginBottom:20, display:'flex', alignItems:'center', gap:14, flexWrap:'wrap' }}>
        <div style={{ width:44, height:44, borderRadius:'50%', background:'#1e3a5f', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0 }}>
          {(student.name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase()}
        </div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:16, fontWeight:800, color:'#0f172a' }}>{student.name}</div>
          <div style={{ fontSize:12, color:'#64748b', marginTop:2, display:'flex', gap:10, flexWrap:'wrap' }}>
            {student.gcc_no && <span style={{ fontWeight:700, color:'#1e3a5f' }}>GCC-{student.gcc_no}</span>}
            {(student.class_name||student.cls) && <span>{student.class_name||student.cls}</span>}
            {student.course && <span>{student.course}</span>}
            {/* PATCH 2: use adm_no */}
            {admApp?.adm_no && <span style={{ color:'#4f46e5', fontWeight:600 }}>{admApp.adm_no}</span>}
            {totalEverPaid > 0 && <span style={{ color:'#059669', fontWeight:700 }}>₹{fmt(totalEverPaid)} prev. paid</span>}
          </div>
        </div>
        <button onClick={handleBack} style={{ padding:'7px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'#f8fafc', cursor:'pointer', fontSize:12, fontWeight:700, color:'#64748b' }}>← Change</button>
      </div>

      {!admApp && (
        <div style={{ background:'#fffbeb', border:'1.5px solid #fcd34d', borderRadius:10, padding:'12px 16px', marginBottom:16, fontSize:13, color:'#92400e', fontWeight:600 }}>
          ⚠️ No admission record found for GCC-{student.gcc_no||'??'}. Create one in the Admissions module first.
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:20, alignItems:'start' }}>

        {/* ── LEFT: fee items ─────────────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Admission Package */}
          <div style={{ background:'white', border:'1px solid #c7d2fe', borderRadius:12, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(90deg,#eef2ff,#f5f3ff)', padding:'11px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #e2e8f0' }}>
              <span style={{ fontSize:18 }}>🎓</span>
              <div style={{ flex:1, fontWeight:800, fontSize:14, color:'#3730a3' }}>Admission Package</div>
              {admPaid && <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:'#dcfce7', color:'#16a34a', fontWeight:700 }}>✓ Already Paid</span>}
            </div>
            {admPaid ? (
              <div style={{ padding:'12px 16px' }}>
                {myAdmCols.map((c,i)=>(
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'4px 0', color:'#475569' }}>
                    {/* PATCH 1: read amount_paid */}
                    <span>{c.description||'Fee'}</span><span style={{ fontWeight:700 }}>₹{fmt(c.amount_paid)}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:800, color:'#3730a3', borderTop:'1px solid #e2e8f0', marginTop:8, paddingTop:8 }}>
                  <span>Total Paid</span><span>₹{fmt(admEverPaid)}</span>
                </div>
              </div>
            ) : (
              <div style={{ padding:'12px 16px' }}>
                <div style={{ marginBottom:12 }}>
                  <label style={lbl}>Admission Fee (₹)</label>
                  <input type="number" value={admFeeAmt} onChange={e=>setAdmFeeAmt(parseInt(e.target.value)||0)} style={inp} />
                </div>
                <div style={{ border:'1px solid #e2e8f0', borderRadius:8, overflow:'hidden', marginBottom:10 }}>
                  {DRESS_ITEMS.map((item,i)=>(
                    <label key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderBottom:'1px solid #f1f5f9', background:dressChecked[i]?'#eef2ff':'white', cursor:'pointer' }}>
                      <input type="checkbox" checked={dressChecked[i]} onChange={()=>setDressChecked(d=>{const n=[...d];n[i]=!n[i];return n})} style={{ accentColor:'#4f46e5', width:14, height:14 }} />
                      <span style={{ flex:1, fontSize:13 }}>{item.name}</span>
                      <span style={{ fontSize:13, fontWeight:700, color:'#4f46e5' }}>₹{fmt(item.price)}</span>
                    </label>
                  ))}
                  <label style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', background:prospChecked?'#eef2ff':'white', cursor:'pointer' }}>
                    <input type="checkbox" checked={prospChecked} onChange={e=>setProspChecked(e.target.checked)} style={{ accentColor:'#4f46e5', width:14, height:14 }} />
                    <span style={{ flex:1, fontSize:13, fontWeight:600 }}>Prospectus</span>
                    <span style={{ fontSize:13, fontWeight:700, color:'#4f46e5' }}>₹{fmt(PROSPECTUS_FEE)}</span>
                  </label>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, color:'#3730a3', background:'#eef2ff', padding:'9px 12px', borderRadius:8 }}>
                  <span>Package Total</span><span>₹{fmt(admPkgThis)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Flat Fees */}
          <div style={{ background:'white', border:'1px solid #6ee7b7', borderRadius:12, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(90deg,#ecfdf5,#d1fae5)', padding:'11px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #e2e8f0' }}>
              <span style={{ fontSize:18 }}>📅</span>
              <div style={{ flex:1, fontWeight:800, fontSize:14, color:'#047857' }}>Monthly Flat Fees</div>
              {flatEverPaid > 0 && <span style={{ fontSize:11, color:'#047857', fontWeight:700 }}>₹{fmt(flatEverPaid)} paid</span>}
            </div>
            <div style={{ padding:'12px 16px' }}>
              {FLAT_FEES.map((ff,i)=>{
                const paid = paidMonths.includes(ff.month)
                return (
                  <label key={ff.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom:i<FLAT_FEES.length-1?'1px solid #f1f5f9':'none', cursor:paid?'default':'pointer' }}>
                    <input type="checkbox" checked={paid||flatChecked[i]} disabled={paid}
                      onChange={()=>setFlatChecked(c=>{const n=[...c];n[i]=!n[i];return n})}
                      style={{ accentColor:'#059669', width:14, height:14 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:'#1e293b' }}>{ff.month} {ff.year}</div>
                      <div style={{ fontSize:11, color:paid?'#16a34a':'#94a3b8', marginTop:1 }}>{paid?'✅ Already collected':'Hostel + tuition flat rate'}</div>
                    </div>
                    <span style={{ fontSize:14, fontWeight:800, color:paid?'#16a34a':'#059669' }}>₹{fmt(ff.amount)}</span>
                  </label>
                )
              })}
              {flatThis > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, color:'#047857', background:'#ecfdf5', padding:'9px 12px', borderRadius:8, marginTop:10 }}>
                  <span>Flat Total ({selFlat.map(f=>f.month.slice(0,3)).join(' + ')})</span><span>₹{fmt(flatThis)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Course Fees */}
          <div style={{ background:'white', border:'1px solid #c4b5fd', borderRadius:12, overflow:'hidden' }}>
            <div style={{ background:'linear-gradient(90deg,#f5f3ff,#ede9fe)', padding:'11px 16px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #e2e8f0' }}>
              <span style={{ fontSize:18 }}>📚</span>
              <div style={{ flex:1, fontWeight:800, fontSize:14, color:'#6d28d9' }}>Course Fees</div>
              {crsfEverPaid > 0 && <span style={{ fontSize:11, color:'#6d28d9', fontWeight:700 }}>₹{fmt(crsfEverPaid)} prev.</span>}
            </div>
            <div style={{ padding:'12px 16px' }}>
              {myCrsfRecs.length > 0 && (
                <div style={{ marginBottom:12, padding:'10px 12px', background:'#f5f3ff', borderRadius:8 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'#6d28d9', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Previous</div>
                  {myCrsfRecs.map((r,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#475569', padding:'3px 0' }}>
                      <span>{r.course}{r.subtype?' · '+r.subtype:''} · {r.forMonth}</span>
                      <span style={{ fontWeight:700, color:'#6d28d9' }}>₹{fmt(r.amountPaid)}</span>
                    </div>
                  ))}
                </div>
              )}
              {crsfRows.map((row,i)=>(
                <div key={i} style={{ border:'1px solid #ede9fe', borderRadius:8, padding:12, marginBottom:10 }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                    <div>
                      <label style={{ ...lbl, fontSize:11 }}>Course</label>
                      <select value={row.course} onChange={e=>{ const r=[...crsfRows]; r[i]={...r[i],course:e.target.value,subtype:''}; setCrsfRows(r) }} style={{ ...inp, fontSize:12, padding:'7px 10px' }}>
                        <option value="">— Select —</option>
                        {Object.keys(COURSE_STRUCTURE).map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize:11 }}>Subtype</label>
                      {(COURSE_STRUCTURE[row.course]?.subtypes||[]).length > 0
                        ? <select value={row.subtype} onChange={e=>{const r=[...crsfRows];r[i]={...r[i],subtype:e.target.value};setCrsfRows(r)}} style={{ ...inp, fontSize:12, padding:'7px 10px' }}>
                            <option value="">—</option>
                            {COURSE_STRUCTURE[row.course].subtypes.map(s=><option key={s}>{s}</option>)}
                          </select>
                        : <input value={row.subtype} onChange={e=>{const r=[...crsfRows];r[i]={...r[i],subtype:e.target.value};setCrsfRows(r)}} style={{ ...inp, fontSize:12, padding:'7px 10px' }} placeholder="Subtype" />
                      }
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize:11 }}>Month</label>
                      <select value={row.forMonth} onChange={e=>{const r=[...crsfRows];r[i]={...r[i],forMonth:e.target.value};setCrsfRows(r)}} style={{ ...inp, fontSize:12, padding:'7px 10px' }}>
                        <option value="">— Month —</option>
                        {MONTHS.map(m=><option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ ...lbl, fontSize:11 }}>Amount (₹)</label>
                      <input type="number" value={row.amount||''} onChange={e=>{const r=[...crsfRows];r[i]={...r[i],amount:e.target.value};setCrsfRows(r)}} style={{ ...inp, fontSize:12, padding:'7px 10px' }} placeholder="0" />
                    </div>
                  </div>
                  {crsfRows.length > 1 && (
                    <button onClick={()=>setCrsfRows(r=>r.filter((_,j)=>j!==i))} style={{ fontSize:11, color:'#dc2626', background:'#fee2e2', border:'none', borderRadius:6, padding:'4px 10px', cursor:'pointer', fontWeight:700 }}>✕ Remove</button>
                  )}
                </div>
              ))}
              <button onClick={()=>setCrsfRows(r=>[...r,{course:'',subtype:'',forMonth:'',amount:''}])} style={{ fontSize:12, color:'#6d28d9', background:'#f5f3ff', border:'1px dashed #c4b5fd', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontWeight:700, width:'100%' }}>+ Add Month</button>
              {crsfThis > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:14, fontWeight:800, color:'#6d28d9', background:'#f5f3ff', padding:'9px 12px', borderRadius:8, marginTop:10 }}>
                  <span>Course Total</span><span>₹{fmt(crsfThis)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Advance */}
          <div style={{ background:'white', border:'1px solid #fcd34d', borderRadius:12, padding:'12px 16px' }}>
            <div style={{ fontWeight:700, fontSize:13, color:'#b45309', marginBottom:10 }}>⮕ Advance Fee (Optional)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <label style={{ ...lbl, fontSize:11 }}>Amount ₹</label>
                <input type="number" min={0} value={advAmt} onChange={e=>setAdvAmt(e.target.value)} placeholder="0" style={{ ...inp, fontSize:12, padding:'7px 10px' }} />
              </div>
              <div>
                <label style={{ ...lbl, fontSize:11 }}>For</label>
                <input value={advFor} onChange={e=>setAdvFor(e.target.value)} placeholder="e.g. Phase I Month 1" style={{ ...inp, fontSize:12, padding:'7px 10px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: payment + summary ─────────────────────── */}
        <div style={{ display:'flex', flexDirection:'column', gap:14, position:'sticky', top:20 }}>

          {/* Payment details */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:'16px' }}>
            <div style={{ fontWeight:800, fontSize:14, color:'#1e3a5f', marginBottom:14 }}>💳 Payment Details</div>
            <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
              <div>
                <label style={lbl}>Payment Mode</label>
                <select value={payMode} onChange={e=>setPayMode(e.target.value)} style={inp}>
                  {PAY_MODES.map(m=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Date</label>
                <input type="date" value={payDate} onChange={e=>setPayDate(e.target.value)} style={inp} />
              </div>
              <div>
                <label style={lbl}>Transaction Ref</label>
                <input value={txnRef} onChange={e=>setTxnRef(e.target.value)} placeholder="UPI / Cheque ref (optional)" style={inp} />
              </div>
              <div>
                <label style={lbl}>Collected By</label>
                <input value={collectedBy} onChange={e=>setCollectedBy(e.target.value)} style={inp} />
              </div>
            </div>
          </div>

          {/* Summary */}
          <div style={{ background:'white', border:'1px solid #e2e8f0', borderRadius:12, overflow:'hidden' }}>
            <div style={{ background:'#1e3a5f', padding:'12px 16px', color:'white', fontWeight:800, fontSize:14 }}>📋 This Invoice</div>
            <div style={{ padding:'14px 16px' }}>
              {admPkgThis > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid #f1f5f9', color:'#3730a3' }}>
                  <span>🎓 Admission Package</span><span style={{ fontWeight:700 }}>₹{fmt(admPkgThis)}</span>
                </div>
              )}
              {flatThis > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid #f1f5f9', color:'#047857' }}>
                  <span>📅 Flat Fees</span><span style={{ fontWeight:700 }}>₹{fmt(flatThis)}</span>
                </div>
              )}
              {crsfThis > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid #f1f5f9', color:'#6d28d9' }}>
                  <span>📚 Course Fees</span><span style={{ fontWeight:700 }}>₹{fmt(crsfThis)}</span>
                </div>
              )}
              {advThis > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', borderBottom:'1px solid #f1f5f9', color:'#b45309' }}>
                  <span>⮕ Advance</span><span style={{ fontWeight:700 }}>₹{fmt(advThis)}</span>
                </div>
              )}
              {grandThis === 0 && (
                <div style={{ fontSize:12, color:'#94a3b8', textAlign:'center', padding:'16px 0' }}>Select fee items on the left</div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:16, fontWeight:900, color:'white', background:'linear-gradient(90deg,#1e3a5f,#3730a3)', padding:'12px 14px', borderRadius:10, marginTop:12 }}>
                <span>Grand Total</span><span>₹{fmt(grandThis)}</span>
              </div>
            </div>
          </div>

          {/* Prev paid */}
          {totalEverPaid > 0 && (
            <div style={{ background:'#ecfdf5', border:'1px solid #6ee7b7', borderRadius:12, padding:'12px 16px' }}>
              <div style={{ fontWeight:800, fontSize:12, color:'#047857', marginBottom:8 }}>✅ Previously Collected</div>
              {admEverPaid>0  && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#475569', padding:'3px 0' }}><span>Admission + Kit</span><span>₹{fmt(admEverPaid)}</span></div>}
              {flatEverPaid>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#475569', padding:'3px 0' }}><span>Flat Fees</span><span>₹{fmt(flatEverPaid)}</span></div>}
              {crsfEverPaid>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#475569', padding:'3px 0' }}><span>Course Fees</span><span>₹{fmt(crsfEverPaid)}</span></div>}
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, fontWeight:800, color:'#047857', borderTop:'1px solid #a7f3d0', marginTop:8, paddingTop:8 }}>
                <span>Total Ever</span><span>₹{fmt(totalEverPaid)}</span>
              </div>
            </div>
          )}

          {/* Save button */}
          <button onClick={handleSave} disabled={saving||grandThis===0||!admApp}
            style={{ width:'100%', padding:14, borderRadius:12, background:saving||grandThis===0||!admApp?'#94a3b8':'linear-gradient(135deg,#1e3a5f,#3730a3)', color:'white', border:'none', fontSize:15, fontWeight:800, cursor:saving||grandThis===0||!admApp?'not-allowed':'pointer', transition:'opacity .15s', boxShadow:grandThis>0&&admApp?'0 4px 16px rgba(55,48,163,.3)':'none' }}>
            {saving?'⏳ Processing…':`🖨️ Save & Print Invoice · ₹${fmt(grandThis)}`}
          </button>
          {!admApp && <div style={{ fontSize:11, color:'#dc2626', textAlign:'center', marginTop:-6 }}>⚠ No admission record — create one in Admissions first</div>}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
//  ROOT — Fees page
// ══════════════════════════════════════════════════════════════
export default function Fees() {
  const [fees,     setFees]     = useState([])
  const [students, setStudents] = useState([])
  const [admApps,  setAdmApps]  = useState([])
  const [admCols,  setAdmCols]  = useState([])
  const [flatRecs, setFlatRecs] = useState([])
  const [crsfRecs, setCrsfRecs] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [search,   setSearch]   = useState('')
  const [sf,       setSf]       = useState('All')
  const [tab,      setTab]      = useState('payment')
  const [form,     setForm]     = useState({ gcc_no:'', name:'', class_name:'', course:'', amount:'', paid:'0' })

  const loadAll = async () => {
    setLoading(true)
    const [fR,sR,aR,cR,flR,crR] = await Promise.all([
      supabase.from('fees').select('*').order('created_at',{ascending:false}),
      supabase.from('students').select('*').order('name'),
      supabase.from('admissions').select('*'),
      supabase.from('adm_fee_collections').select('*'),
      supabase.from('adm_flat_fees').select('*'),
      supabase.from('adm_course_fees').select('*'),
    ])
    setFees(fR.data||[]); setStudents(sR.data||[]); setAdmApps(aR.data||[])
    setAdmCols(cR.data||[]); setFlatRecs(flR.data||[]); setCrsfRecs(crR.data||[])
    setLoading(false)
  }
  useEffect(()=>{ loadAll() },[])

  const getAdmApp = s => admApps.find(a => String(parseInt(a.gcc_no)) === String(parseInt(s.gcc_no))) || null
  const getLiveFees = s => {
    const app=getAdmApp(s); if(!app) return { admTotal:0,flatTotal:0,crsfTotal:0,grandTotal:0,hasFees:false }
    const id=String(app.id)
    // PATCH 1: read amount_paid (snake_case)
    const admTotal  = admCols.filter(c => c.adm_app_id === String(app.id)).reduce((a,c) => a+(Number(c.amount_paid)||0), 0)
    const flatTotal = flatRecs.filter(r => r.appId === id && r.paid).reduce((a,r) => a+(r.amount||0), 0)
    const crsfTotal = crsfRecs.filter(r => r.appId === id).reduce((a,r) => a+(Number(r.amountPaid)||0), 0)
    const grandTotal= admTotal+flatTotal+crsfTotal
    return { admTotal,flatTotal,crsfTotal,grandTotal,hasFees:grandTotal>0 }
  }

  const liveRows = useMemo(()=>students.map(s=>{
    const live=getLiveFees(s); const app=getAdmApp(s)
    const status=live.grandTotal>0?(app?.status==='Enrolled'?'Paid':'Partial'):'Pending'
    return {...s,...live,admApp:app,liveStatus:status}
  }),[students,admApps,admCols,flatRecs,crsfRecs])

  const filteredLive = useMemo(()=>{
    const q=search.toLowerCase()
    return liveRows.filter(s=>(sf==='All'||s.liveStatus===sf)&&[s.name,s.gcc_no,s.class_name,s.cls,s.course].some(v=>(v||'').toLowerCase().includes(q)))
  },[liveRows,search,sf])

  const liveTtl = liveRows.reduce((a,s)=>a+s.grandTotal,0)
  const liveP   = liveRows.filter(s=>s.liveStatus==='Pending').length
  const liveP2  = liveRows.filter(s=>s.liveStatus==='Paid').length

  const filteredLeg = useMemo(()=>{
    const q=search.toLowerCase()
    return fees.filter(f=>(sf==='All'||f.status===sf)&&[(f.name||''),(f.status||'')].some(v=>v.toLowerCase().includes(q)))
  },[fees,search,sf])

  const legTtl=fees.reduce((s,f)=>s+(Number(f.amount)||0),0)
  const legPd =fees.reduce((s,f)=>s+(Number(f.paid)||0),0)

  const handleAdd = async e => {
    e.preventDefault(); setSaving(true)
    const amount=Number(form.amount)||0,paid=Number(form.paid)||0
    const status=paid>=amount?'Paid':paid>0?'Partial':'Pending'
    const {error}=await supabase.from('fees').insert([{gcc_no:form.gcc_no||null,name:form.name,class_name:form.class_name,course:form.course,amount,paid,status}])
    if(error) alert('Error: '+error.message)
    else { setForm({gcc_no:'',name:'',class_name:'',course:'',amount:'',paid:'0'}); setShowForm(false); loadAll() }
    setSaving(false)
  }
  const handleCollect = async (id,amount) => { await supabase.from('fees').update({paid:amount,status:'Paid'}).eq('id',id); loadAll() }
  const handleDelete  = async id => { if(!window.confirm('Delete?')) return; await supabase.from('fees').delete().eq('id',id); loadAll() }
  const handleSync    = async s => {
    const live=getLiveFees(s); if(!live.hasFees) return
    const ex=fees.find(f=>String(f.gcc_no)===String(s.gcc_no))
    const p={gcc_no:String(s.gcc_no),name:s.name,class_name:s.class_name||s.cls||'',course:s.course||'',amount:live.grandTotal,paid:live.grandTotal,status:'Paid'}
    if(ex) await supabase.from('fees').update(p).eq('id',ex.id)
    else   await supabase.from('fees').insert([p])
    loadAll()
  }

  const TABS = [
    { id:'payment', label:'💳 Fee Payment' },
    { id:'live',    label:'📊 Live Summary' },
    { id:'legacy',  label:'🗂️ Legacy Records' },
  ]

  return (
    <div style={{ padding:24, fontFamily:'system-ui,sans-serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={{ fontSize:26, fontWeight:'bold', color:'#1e3a5f', margin:0 }}>💰 Fee Management</h1>
          <p style={{ color:'#64748b', fontSize:14, margin:'4px 0 0' }}>Collect · Invoice · Live summary · Legacy records</p>
        </div>
        {tab==='legacy' && (
          <button onClick={()=>setShowForm(!showForm)} style={{ backgroundColor:'#1e3a5f', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontWeight:600, cursor:'pointer', fontSize:14 }}>
            {showForm?'✖ Cancel':'➕ Add Record'}
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid #e2e8f0', marginBottom:24 }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>{ setTab(t.id); setSearch(''); setSf('All') }}
            style={{ padding:'9px 20px', border:'none', borderBottom:tab===t.id?'3px solid #1e3a5f':'3px solid transparent', background:'none', cursor:'pointer', fontSize:13, fontWeight:tab===t.id?700:500, color:tab===t.id?'#1e3a5f':'#64748b', marginBottom:-2, whiteSpace:'nowrap', transition:'color .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Payment Tab */}
      {tab==='payment' && (
        <FeePaymentTab students={students} admApps={admApps} admCols={admCols} flatRecs={flatRecs} crsfRecs={crsfRecs} onRefresh={loadAll} />
      )}

      {/* Live Summary Tab */}
      {tab==='live' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
            {[
              {label:'Total Students', value:students.length,         color:'#1e3a5f', bg:'#eff6ff', icon:'👨‍🎓'},
              {label:'Total Collected',value:`₹${fmt(liveTtl)}`,     color:'#16a34a', bg:'#dcfce7', icon:'✅'},
              {label:'Fees Pending',   value:liveP,                   color:'#dc2626', bg:'#fee2e2', icon:'⚠️'},
              {label:'Fully Paid',     value:liveP2,                  color:'#7c3aed', bg:'#f5f3ff', icon:'🎉'},
            ].map(c=>(
              <div key={c.label} style={{ backgroundColor:c.bg, borderRadius:12, padding:18, boxShadow:'0 2px 8px rgba(0,0,0,.06)', borderLeft:`4px solid ${c.color}` }}>
                <div style={{ fontSize:22, marginBottom:6 }}>{c.icon}</div>
                <p style={{ fontSize:13, color:c.color, fontWeight:600, margin:0 }}>{c.label}</p>
                <h2 style={{ fontSize:22, fontWeight:'bold', color:c.color, margin:'4px 0 0' }}>{c.value}</h2>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
            <input placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inp, flex:2, minWidth:200 }} />
            <select value={sf} onChange={e=>setSf(e.target.value)} style={{ ...inp, width:'auto' }}>
              <option value="All">All</option><option>Paid</option><option>Partial</option><option>Pending</option>
            </select>
          </div>
          {loading ? <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading...</div> : (
            <div style={{ background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.08)', overflow:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, minWidth:900 }}>
                <thead>
                  <tr style={{ background:'#1e3a5f' }}>
                    {['#','GCC','Student','Class','Course','Adm Fee','Flat','Course','Total','Adm Status','Status','Sync'].map(h=>(
                      <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontWeight:700, color:'white', fontSize:12, whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLive.map((s,i)=>(
                    <tr key={s.id} style={{ borderBottom:'1px solid #f1f5f9' }}
                      onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                      onMouseLeave={e=>e.currentTarget.style.background='white'}
                    >
                      <td style={{ padding:'10px 14px', color:'#94a3b8', fontSize:11 }}>{i+1}</td>
                      <td style={{ padding:'10px 14px', fontFamily:'monospace', fontSize:12, color:'#1e3a5f', fontWeight:700 }}>{s.gcc_no?`GCC-${s.gcc_no}`:'—'}</td>
                      <td style={{ padding:'10px 14px', fontWeight:600, color:'#1e293b' }}>{s.name}</td>
                      <td style={{ padding:'10px 14px', color:'#64748b' }}>{s.class_name||s.cls||'—'}</td>
                      <td style={{ padding:'10px 14px', color:'#64748b' }}>{s.course||'—'}</td>
                      <td style={{ padding:'10px 14px', color:'#4f46e5', fontWeight:600 }}>{s.admTotal>0?`₹${fmt(s.admTotal)}`:'—'}</td>
                      <td style={{ padding:'10px 14px', color:'#059669', fontWeight:600 }}>{s.flatTotal>0?`₹${fmt(s.flatTotal)}`:'—'}</td>
                      <td style={{ padding:'10px 14px', color:'#7c3aed', fontWeight:600 }}>{s.crsfTotal>0?`₹${fmt(s.crsfTotal)}`:'—'}</td>
                      <td style={{ padding:'10px 14px', fontWeight:800, color:s.grandTotal>0?'#16a34a':'#94a3b8' }}>{s.grandTotal>0?`₹${fmt(s.grandTotal)}`:'—'}</td>
                      <td style={{ padding:'10px 14px' }}>
                        {s.admApp
                          ? <span style={{ padding:'3px 8px', borderRadius:99, fontSize:11, fontWeight:700, background:'#ecfdf5', color:'#059669' }}>{s.admApp.status}</span>
                          : <span style={{ color:'#94a3b8', fontSize:11 }}>—</span>}
                      </td>
                      <td style={{ padding:'10px 14px' }}><span style={sStyle(s.liveStatus)}>{s.liveStatus}</span></td>
                      <td style={{ padding:'10px 14px' }}>
                        {s.hasFees && <button onClick={()=>handleSync(s)} style={{ background:'#eff6ff', color:'#1e3a5f', border:'1px solid #bfdbfe', borderRadius:6, padding:'4px 9px', fontSize:11, cursor:'pointer', fontWeight:700 }}>⇄</button>}
                      </td>
                    </tr>
                  ))}
                  {filteredLive.length===0&&<tr><td colSpan={12} style={{ padding:40, textAlign:'center', color:'#94a3b8' }}>No students found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Legacy Tab */}
      {tab==='legacy' && (
        <>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
            {[
              {label:'Total Fees', amount:legTtl,        color:'#1e3a5f', bg:'#eff6ff'},
              {label:'Collected',  amount:legPd,         color:'#16a34a', bg:'#dcfce7'},
              {label:'Pending',    amount:legTtl-legPd,  color:'#dc2626', bg:'#fee2e2'},
            ].map(c=>(
              <div key={c.label} style={{ backgroundColor:c.bg, borderRadius:12, padding:20, boxShadow:'0 2px 8px rgba(0,0,0,.06)', borderLeft:`4px solid ${c.color}` }}>
                <p style={{ fontSize:13, color:c.color, fontWeight:500, opacity:.8, margin:0 }}>{c.label}</p>
                <h2 style={{ fontSize:28, fontWeight:'bold', color:c.color, marginTop:4, marginBottom:0 }}>₹{fmt(c.amount)}</h2>
              </div>
            ))}
          </div>
          {showForm && (
            <div style={{ background:'white', borderRadius:12, padding:24, marginBottom:24, boxShadow:'0 2px 8px rgba(0,0,0,.08)' }}>
              <h2 style={{ fontSize:18, fontWeight:600, color:'#1e3a5f', marginBottom:16 }}>Add Fee Record</h2>
              <form onSubmit={handleAdd}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                  <div style={{ gridColumn:'1/-1' }}>
                    <label style={lbl}>Search Student</label>
                    <StudentSearch students={students} onSelect={s=>setForm(f=>({...f,gcc_no:String(s.gcc_no||''),name:s.name||'',class_name:s.class_name||s.cls||'',course:s.course||''}))} />
                  </div>
                  <div><label style={lbl}>GCC No.</label><input value={form.gcc_no} onChange={e=>setForm(f=>({...f,gcc_no:e.target.value}))} style={inp} /></div>
                  <div><label style={lbl}>Name *</label><input required value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp} /></div>
                  <div><label style={lbl}>Class</label><input value={form.class_name} onChange={e=>setForm(f=>({...f,class_name:e.target.value}))} style={inp} /></div>
                  <div><label style={lbl}>Course</label><input value={form.course} onChange={e=>setForm(f=>({...f,course:e.target.value}))} style={inp} /></div>
                  <div><label style={lbl}>Total ₹ *</label><input required type="number" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} style={inp} /></div>
                  <div><label style={lbl}>Paid ₹</label><input type="number" value={form.paid} onChange={e=>setForm(f=>({...f,paid:e.target.value}))} style={inp} /></div>
                </div>
                <button type="submit" disabled={saving} style={{ marginTop:16, backgroundColor:saving?'#94a3b8':'#1e3a5f', color:'white', border:'none', borderRadius:8, padding:'10px 24px', fontWeight:600, cursor:saving?'not-allowed':'pointer', fontSize:14 }}>
                  {saving?'⏳ Saving...':'✅ Save'}
                </button>
              </form>
            </div>
          )}
          <div style={{ display:'flex', gap:10, marginBottom:16 }}>
            <input placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...inp, flex:2 }} />
            <select value={sf} onChange={e=>setSf(e.target.value)} style={{ ...inp, width:'auto' }}>
              <option value="All">All</option><option>Paid</option><option>Partial</option><option>Pending</option>
            </select>
          </div>
          {loading ? <div style={{ textAlign:'center', padding:48, color:'#64748b' }}>⏳ Loading...</div> : (
            <div style={{ background:'white', borderRadius:12, boxShadow:'0 2px 8px rgba(0,0,0,.08)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:14 }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                    {['#','GCC','Name','Class','Course','Total','Paid','Pending','Status','Linked','Action'].map(h=>(
                      <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:600, color:'#374151', fontSize:13 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredLeg.map((f,i)=>{
                    const amt=Number(f.amount)||0, pd=Number(f.paid)||0
                    const linked=f.gcc_no?students.find(s=>String(s.gcc_no)===String(f.gcc_no)):null
                    const live=linked?getLiveFees(linked):null
                    return (
                      <tr key={f.id} style={{ borderBottom:'1px solid #f1f5f9' }}
                        onMouseEnter={e=>e.currentTarget.style.background='#f8fafc'}
                        onMouseLeave={e=>e.currentTarget.style.background='white'}
                      >
                        <td style={{ padding:'12px 16px', color:'#64748b' }}>{i+1}</td>
                        <td style={{ padding:'12px 16px', fontFamily:'monospace', fontSize:12, color:'#1e3a5f', fontWeight:700 }}>{f.gcc_no?`GCC-${f.gcc_no}`:'—'}</td>
                        <td style={{ padding:'12px 16px', fontWeight:600, color:'#1e293b' }}>{f.name||'—'}</td>
                        <td style={{ padding:'12px 16px', color:'#64748b' }}>{f.class_name||'—'}</td>
                        <td style={{ padding:'12px 16px', color:'#64748b' }}>{f.course||'—'}</td>
                        <td style={{ padding:'12px 16px', color:'#1e293b', fontWeight:600 }}>₹{fmt(amt)}</td>
                        <td style={{ padding:'12px 16px', color:'#16a34a', fontWeight:600 }}>₹{fmt(pd)}</td>
                        <td style={{ padding:'12px 16px', color:'#dc2626', fontWeight:600 }}>₹{fmt(amt-pd)}</td>
                        <td style={{ padding:'12px 16px' }}><span style={sStyle(f.status)}>{f.status||'Pending'}</span></td>
                        <td style={{ padding:'12px 16px' }}>
                          {linked
                            ? <div><div style={{ fontSize:12, fontWeight:700, color:'#059669' }}>✓ {linked.name}</div>{live?.hasFees&&<div style={{ fontSize:11, color:'#64748b' }}>Live ₹{fmt(live.grandTotal)}</div>}</div>
                            : f.gcc_no ? <span style={{ fontSize:11, color:'#dc2626' }}>⚠ No match</span> : <span style={{ fontSize:11, color:'#94a3b8' }}>—</span>
                          }
                        </td>
                        <td style={{ padding:'12px 16px' }}>
                          <div style={{ display:'flex', gap:6 }}>
                            {f.status!=='Paid'&&<button onClick={()=>handleCollect(f.id,amt)} style={{ background:'#dcfce7', color:'#16a34a', border:'none', borderRadius:6, padding:'6px 10px', fontSize:12, cursor:'pointer', fontWeight:600 }}>💰</button>}
                            <button onClick={()=>handleDelete(f.id)} style={{ background:'#fee2e2', color:'#dc2626', border:'none', borderRadius:6, padding:'6px 10px', fontSize:12, cursor:'pointer', fontWeight:600 }}>🗑</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filteredLeg.length===0&&<tr><td colSpan={11} style={{ padding:32, textAlign:'center', color:'#94a3b8' }}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

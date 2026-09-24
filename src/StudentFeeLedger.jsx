// StudentFeeLedger.jsx — mobile-responsive
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumHero, PREMIUM_CSS } from './staffPhotos'
import { printFeeReceipt } from './premiumReceipt'

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 640)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)')
    const h = e => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

const fmt = n => Number(n || 0).toLocaleString('en-IN')
const gccStr = gcc => String(parseInt(gcc) || gcc || '')

const fmtDate = d => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function HostelTypeBadge({ type }) {
  if (!type) return <span style={{ color: '#94a3b8' }}>—</span>
  const styles = {
    'Boarder':     { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    'Day Boarder': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    'Day Scholar': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  }
  const s = styles[type] || styles['Day Scholar']
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.color, border: `1px solid ${s.border}`, whiteSpace: 'nowrap' }}>
      {type}
    </span>
  )
}

// Student photo (students.photo_url) with initials fallback
function StudentPhoto({ s, size = 40, ring = '#E2C57E' }) {
  const [bad, setBad] = useState(false)
  const url = !bad && (s?.photo_url || s?.photo || null)
  const base = { width: size, height: size, borderRadius: '50%', flexShrink: 0, border: `2px solid ${ring}`, boxShadow: '0 4px 12px rgba(11,30,61,.18)' }
  if (url) return <img src={url} alt="" onError={() => setBad(true)} style={{ ...base, objectFit: 'cover', objectPosition: 'center top', background: '#F4F1EA' }}/>
  return <div style={{ ...base, background: 'linear-gradient(135deg,#0B1E3D,#1F4E8C)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E2C57E', fontWeight: 800, fontSize: size * 0.4, fontFamily: "'Playfair Display',Georgia,serif" }}>{(s?.name || '?')[0].toUpperCase()}</div>
}

// ─── Receipt printer (unchanged) ─────────────────────────────────────────────
const escH = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]))

// Indian-system amount in words: 125000 → "One Lakh Twenty Five Thousand Rupees Only"
function amountInWords(num) {
  num = Math.round(Number(num) || 0)
  if (num === 0) return 'Zero Rupees Only'
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const two = n => n < 20 ? a[n] : b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '')
  const three = n => (n >= 100 ? a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : '')
  const parts = []
  const cr = Math.floor(num / 10000000); num %= 10000000
  const lk = Math.floor(num / 100000); num %= 100000
  const th = Math.floor(num / 1000); num %= 1000
  if (cr) parts.push(two(cr) + ' Crore')
  if (lk) parts.push(two(lk) + ' Lakh')
  if (th) parts.push(two(th) + ' Thousand')
  if (num) parts.push(three(num))
  return parts.join(' ') + ' Rupees Only'
}

// Shared premium print styles (A4 / A5 friendly)
const PRINT_BASE = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@600;700&display=swap');
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Plus Jakarta Sans',Arial,sans-serif;background:#ECE7DB;color:#1B2437;display:flex;flex-direction:column;align-items:center;padding:28px 12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .serif{font-family:'Playfair Display',Georgia,serif}
  .mono{font-family:'JetBrains Mono',monospace}
  .sheet{position:relative;width:760px;max-width:100%;background:#fff;border-radius:6px;overflow:hidden;box-shadow:0 30px 70px rgba(11,30,61,.22)}
  .frame{position:absolute;inset:10px;border:1px solid #E2C57E;border-radius:4px;pointer-events:none}
  .frame:after{content:'';position:absolute;inset:4px;border:.5px solid rgba(201,162,75,.45);border-radius:2px}
  .hdr{position:relative;padding:30px 40px 24px;background:radial-gradient(120% 160% at 100% 0%,#1F4E8C 0%,#132B52 42%,#0B1E3D 82%);color:#fff;display:flex;align-items:center;gap:18px}
  .crest{width:62px;height:62px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#E2C57E,#B8913F);color:#0B1E3D;font-family:'Playfair Display',serif;font-weight:800;font-size:20px;box-shadow:0 0 0 3px rgba(255,255,255,.15),0 8px 18px rgba(0,0,0,.25)}
  .inst{font-family:'Playfair Display',serif;font-size:21px;font-weight:700;letter-spacing:.01em;line-height:1.2}
  .sub{font-size:11px;color:rgba(255,255,255,.7);margin-top:4px;letter-spacing:.04em}
  .tag{font-size:9.5px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#E2C57E}
  .goldbar{height:4px;background:linear-gradient(90deg,#B8913F,#E2C57E,#B8913F)}
  .body{position:relative;padding:26px 40px 30px}
  .wm{position:absolute;left:50%;top:52%;transform:translate(-50%,-50%) rotate(-18deg);font-family:'Playfair Display',serif;font-size:120px;font-weight:800;color:rgba(22,163,74,.07);letter-spacing:.1em;pointer-events:none;white-space:nowrap}
  .lbl{font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#8A8F9C}
  .val{font-size:13.5px;font-weight:700;color:#1B2437;margin-top:3px}
  .grid{display:grid;gap:14px 22px}
  table{width:100%;border-collapse:collapse}
  th{font-size:9.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#6B7280;text-align:left;padding:10px 12px;background:#FBF8F1;border-bottom:1.5px solid #E2C57E}
  td{padding:11px 12px;font-size:12.5px;border-bottom:1px solid #F1ECE0;vertical-align:top}
  .amt{text-align:right;font-weight:800;white-space:nowrap}
  .sig{height:1px;width:170px;border-top:1px solid #1B2437;margin:40px 0 6px}
  .btns{display:flex;gap:10px;justify-content:center;margin-top:18px}
  .btn{padding:11px 26px;border:none;border-radius:999px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit}
  .bp{background:linear-gradient(180deg,#132B52,#0B1E3D);color:#E2C57E}
  .bs{background:#fff;color:#0B1E3D;border:1px solid #E2C57E}
  @page{size:A4;margin:10mm}
  @media print{body{background:#fff;padding:0}.sheet{box-shadow:none;border-radius:0;width:100%}.btns{display:none}}
`
const HEADER = (right) => `
  <div class="hdr">
    <div class="crest">GN</div>
    <div style="flex:1;min-width:0">
      <div class="tag">Est. 2016 · Residential Coaching</div>
      <div class="inst">Guidance Navodaya &amp; Sainik Institute</div>
      <div class="sub">Khangabok, Thoubal, Manipur · guidancekhangabok.in · +91 89742 98074</div>
    </div>
    ${right}
  </div><div class="goldbar"></div>`

function openPrint(html, title) {
  const pw = window.open('', '_blank', 'width=860,height=980,scrollbars=yes')
  if (!pw) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  pw.document.write(html); pw.document.close(); pw.document.title = title
  setTimeout(() => { try { pw.focus(); pw.print() } catch (_) {} }, 700)
}

// ─── Receipt — same premium design as Fees → Collect (premiumReceipt.js) ───
function printReceipt(st, row, type) {
  let item
  if (type === 'adm') item = { particulars: row.description || row.fee_type || 'Admission / Kit Fee', period: 'One-time', category: 'Admission & Kit', amount: row.amount_paid }
  else if (type === 'flat') item = { particulars: 'Monthly Flat Fee', period: `${row.month || ''} ${row.year || ''}`.trim() || '—', category: row.hostel_type || 'Hostel', amount: row.amount }
  else item = { particulars: 'Course Fee', period: `${row.for_month || ''} ${row.year || ''}`.trim() || '—', category: row.course || st.course || 'Course', amount: row.amount_paid }
  printFeeReceipt({
    receipt_no: row.receipt_no, pay_date: row.pay_date, pay_mode: row.pay_mode, txn_ref: row.txn_ref,
    collected_by: row.collected_by, student_name: st.name, adm_no: st.admission_no, gcc_no: st.gcc_no,
    class_name: [st.class_name, st.batch].filter(Boolean).join(' · '), course: st.course,
    hostel_type: row.hostel_type || st.hostel_type, items: [item],
  })
}

// ─── Premium full ledger statement ───────────────────────────────────────────
function printLedger(studentRaw, admRows, flatRows, crsRows, grandTotal) {
  const st = studentRaw || {}
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const sum = (rows, k) => rows.reduce((s, r) => s + Number(r[k] || 0), 0)
  const section = (title, accent, headers, rows, total) => rows.length === 0 ? '' : `
    <div style="margin-top:22px;page-break-inside:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div class="serif" style="font-size:15px;font-weight:700;color:#0B1E3D"><span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${accent};margin-right:8px"></span>${title}</div>
        <div style="font-size:11px;color:#8A8F9C">${rows.length} payment${rows.length === 1 ? '' : 's'} · <b style="color:${accent}">₹${fmt(total)}</b></div>
      </div>
      <table><thead><tr>${headers.map((h, i) => `<th${i === headers.length - 1 ? ' style="text-align:right"' : ''}>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody></table>
    </div>`
  const td = v => `<td>${escH(v)}</td>`
  const admHtml = admRows.map(r => `<tr>${td(fmtDate(r.pay_date))}<td style="font-weight:700">${escH(r.description || r.fee_type || '—')}</td>${td(r.pay_mode || '—')}<td class="mono">${escH(r.receipt_no || '—')}</td><td class="amt mono">${fmt(r.amount_paid)}</td></tr>`)
  const flatHtml = flatRows.map(r => `<tr>${td(fmtDate(r.pay_date))}<td style="font-weight:700">${escH((r.month || '—') + ' ' + (r.year || ''))}</td>${td(r.hostel_type || '—')}${td(r.pay_mode || '—')}<td class="mono">${escH(r.receipt_no || '—')}</td><td class="amt mono">${fmt(r.amount)}</td></tr>`)
  const crsHtml = crsRows.map(r => `<tr>${td(fmtDate(r.pay_date))}<td style="font-weight:700">${escH((r.for_month || '—') + (r.year ? ' ' + r.year : ''))}</td>${td(r.course || '—')}${td(r.pay_mode || '—')}<td class="mono">${escH(r.receipt_no || '—')}</td><td class="amt mono">${fmt(r.amount_paid)}</td></tr>`)
  const cls = [st.class_name, st.batch, st.course].filter(Boolean).join(' · ') || '—'
  const photo = st.photo_url ? `<img src="${escH(st.photo_url)}" style="width:70px;height:70px;border-radius:50%;object-fit:cover;object-position:center top;border:2px solid #E2C57E"/>` : ''
  const count = admRows.length + flatRows.length + crsRows.length

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fee Ledger — ${escH(st.name)}</title><style>${PRINT_BASE}</style></head><body>
  <div class="sheet"><div class="frame"></div>
    ${HEADER(`<div style="text-align:right;flex-shrink:0"><div class="tag">Fee Statement</div><div class="serif" style="font-size:18px;font-weight:700;color:#E2C57E;margin-top:4px">Student Ledger</div><div style="font-size:11px;color:rgba(255,255,255,.7);margin-top:3px">As on ${today}</div></div>`)}
    <div class="body">
      <div style="display:flex;align-items:center;gap:16px;padding:16px 18px;border:1px solid #EFE6CF;border-radius:12px;background:linear-gradient(135deg,#FFFDF7,#FBF6E9)">
        ${photo}
        <div class="grid" style="flex:1;grid-template-columns:2fr 1fr 1fr">
          <div><div class="lbl">Student</div><div class="val serif" style="font-size:18px">${escH(st.name)}</div></div>
          <div><div class="lbl">GCC No.</div><div class="val mono">GCC-${escH(st.gcc_no)}</div></div>
          <div><div class="lbl">Adm. No.</div><div class="val">${escH(st.admission_no || '—')}</div></div>
          <div><div class="lbl">Class / Course</div><div class="val">${escH(cls)}</div></div>
          <div><div class="lbl">Hostel</div><div class="val">${escH(st.hostel_type || '—')}</div></div>
          <div><div class="lbl">Transactions</div><div class="val">${count}</div></div>
        </div>
      </div>

      <div class="grid" style="grid-template-columns:repeat(4,1fr);margin-top:16px">
        ${[['Admission & Kit', sum(admRows, 'amount_paid'), '#4F46E5'], ['Monthly Flat', sum(flatRows, 'amount'), '#047857'], ['Course Fees', sum(crsRows, 'amount_paid'), '#6D28D9'], ['Grand Total', grandTotal, '#B8913F']]
          .map(([l, v, c]) => `<div style="padding:12px 14px;border-radius:12px;border:1px solid #EFE6CF;border-top:3px solid ${c}"><div class="lbl">${l}</div><div class="serif" style="font-size:19px;font-weight:700;color:${c};margin-top:3px">₹${fmt(v)}</div></div>`).join('')}
      </div>

      ${section('Admission &amp; Kit Fees', '#4F46E5', ['Date', 'Description', 'Mode', 'Receipt No.', 'Amount (₹)'], admHtml, sum(admRows, 'amount_paid'))}
      ${section('Monthly Flat Fees', '#047857', ['Date', 'Month', 'Hostel', 'Mode', 'Receipt No.', 'Amount (₹)'], flatHtml, sum(flatRows, 'amount'))}
      ${section('Course Fees', '#6D28D9', ['Date', 'Month', 'Course', 'Mode', 'Receipt No.', 'Amount (₹)'], crsHtml, sum(crsRows, 'amount_paid'))}
      ${count === 0 ? '<div style="margin-top:22px;padding:20px;text-align:center;color:#8A8F9C;border:1px dashed #E2C57E;border-radius:12px">No payments recorded yet.</div>' : ''}

      <div style="display:flex;justify-content:space-between;align-items:stretch;gap:16px;margin-top:22px;flex-wrap:wrap">
        <div style="flex:1 1 300px;padding:12px 16px;border-radius:12px;background:#FBF8F1;border:1px dashed #E2C57E">
          <div class="lbl">Total paid in words</div>
          <div class="serif" style="font-size:14.5px;font-weight:700;margin-top:4px;color:#0B1E3D">${amountInWords(grandTotal)}</div>
        </div>
        <div style="flex:0 0 230px;padding:14px 18px;border-radius:12px;background:linear-gradient(135deg,#0B1E3D,#132B52);color:#fff;text-align:right;box-shadow:inset 0 0 0 1px rgba(226,197,126,.35)">
          <div class="tag">Grand total paid</div>
          <div class="serif" style="font-size:28px;font-weight:700;color:#E2C57E;margin-top:2px">₹${fmt(grandTotal)}</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:10px;gap:16px;flex-wrap:wrap">
        <div style="font-size:10.5px;color:#8A8F9C;line-height:1.6">Computer-generated statement · ${escH(st.name)} (GCC-${escH(st.gcc_no)}) · ${today}<br/>For queries please contact the institute office.</div>
        <div style="text-align:center"><div class="sig"></div><div class="lbl">Accounts Office</div></div>
      </div>
    </div>
  </div>
  <div class="btns"><button class="btn bp" onclick="window.print()">🖨 Print statement</button><button class="btn bs" onclick="window.close()">Close</button></div>
  </body></html>`
  openPrint(html, `Fee Ledger — ${st.name || ''}`)
}

// ─── Column definitions ───────────────────────────────────────────────────────
const ADM_COLUMNS = [
  { key: 'pay_date', label: 'Date', render: r => fmtDate(r.pay_date) },
  { key: 'description', label: 'Description', bold: true, render: r => r.description || r.fee_type || '—' },
  { key: 'pay_mode', label: 'Mode', render: r => r.pay_mode || '—' },
  { key: 'txn_ref', label: 'Txn Ref', color: () => '#94a3b8', render: r => r.txn_ref || '—' },
  { key: 'receipt_no', label: 'Receipt No.', mono: true, color: () => '#4f46e5', render: r => r.receipt_no || '—' },
  { key: 'amount_paid', label: 'Amount', bold: true, color: () => '#4f46e5', render: r => `₹${fmt(r.amount_paid)}` },
]
const FLAT_COLUMNS = [
  { key: 'pay_date', label: 'Date', render: r => fmtDate(r.pay_date) },
  { key: 'month', label: 'Month', bold: true },
  { key: 'year', label: 'Year', render: r => r.year || '—' },
  { key: 'hostel_type', label: 'Hostel Type', render: r => <HostelTypeBadge type={r.hostel_type} /> },
  { key: 'pay_mode', label: 'Mode', render: r => r.pay_mode || '—' },
  { key: 'txn_ref', label: 'Txn Ref', color: () => '#94a3b8', render: r => r.txn_ref || '—' },
  { key: 'receipt_no', label: 'Receipt No.', mono: true, color: () => '#059669', render: r => r.receipt_no || '—' },
  { key: 'amount', label: 'Amount', bold: true, color: () => '#059669', render: r => `₹${fmt(r.amount)}` },
]
const CRS_COLUMNS = [
  { key: 'pay_date', label: 'Date', render: r => fmtDate(r.pay_date) },
  { key: 'for_month', label: 'Month', bold: true },
  { key: 'year', label: 'Year', render: r => r.year || '—' },
  { key: 'course', label: 'Course', render: r => r.course || '—' },
  { key: 'hostel_type', label: 'Hostel Type', render: r => <HostelTypeBadge type={r.hostel_type} /> },
  { key: 'pay_mode', label: 'Mode', render: r => r.pay_mode || '—' },
  { key: 'txn_ref', label: 'Txn Ref', color: () => '#94a3b8', render: r => r.txn_ref || '—' },
  { key: 'receipt_no', label: 'Receipt No.', mono: true, color: () => '#7c3aed', render: r => r.receipt_no || '—' },
  { key: 'amount_paid', label: 'Amount', bold: true, color: () => '#7c3aed', render: r => `₹${fmt(r.amount_paid)}` },
]

// ─── Student Search ───────────────────────────────────────────────────────────
function StudentSearch({ students, onSelect, mobile }) {
  const [q, setQ] = useState('')
  const hits = q.length > 0
    ? students.filter(s => (s.name || '').toLowerCase().includes(q.toLowerCase()) || String(s.gcc_no || '').includes(q) || (s.admission_no || '').toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : []

  return (
    <div style={{ position: 'relative', maxWidth: mobile ? '100%' : 480 }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#94a3b8' }}>🔍</span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name, GCC No. or Adm. No…"
          style={{ width: '100%', padding: '13px 14px 13px 44px', borderRadius: 12, border: '2px solid #e2e8f0', fontSize: mobile ? 14 : 15, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}
          onFocus={e => e.target.style.borderColor = '#0B1E3D'} onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
      </div>
      {hits.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,.12)', marginTop: 4, overflow: 'hidden' }}>
          {hits.map(s => (
            <div key={s.id} onClick={() => { onSelect(s); setQ('') }}
              style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 12, alignItems: 'center' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'white'}
            >
              <StudentPhoto s={s} size={38} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.gcc_no && <span style={{ fontWeight: 700, color: '#0B1E3D', fontFamily: 'monospace' }}>GCC-{s.gcc_no}</span>}
                  {s.batch && <span>{s.batch}</span>}
                  {s.course && <span>{s.course}</span>}
                  {s.hostel_type && <HostelTypeBadge type={s.hostel_type} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Section Table ────────────────────────────────────────────────────────────
function LedgerSection({ title, icon, color, bg, rows, columns, emptyMsg, total, totalLabel, student, feeType, mobile }) {
  return (
    <div className="gp-card gp-in" style={{ overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ background: bg, padding: mobile ? '12px 14px' : '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `2px solid ${color}20`, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: mobile ? 16 : 20 }}>{icon}</span>
          <span style={{ fontWeight: 800, fontSize: mobile ? 13 : 15, color }}>{title}</span>
          <span style={{ fontSize: 11, color, background: color + '20', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>{rows.length}</span>
        </div>
        {total > 0 && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color, fontWeight: 600, opacity: .7 }}>{totalLabel || 'Total'}</div>
            <div style={{ fontSize: mobile ? 15 : 18, fontWeight: 800, color }}>₹{fmt(total)}</div>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>{emptyMsg || 'No records'}</div>
      ) : mobile ? (
        /* Mobile: card list */
        <div style={{ padding: '8px 0' }}>
          {rows.map((row, i) => (
            <div key={i} style={{ padding: '12px 14px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  {feeType === 'adm' ? (row.description || row.fee_type || '—') : feeType === 'flat' ? `${row.month || '—'} ${row.year || ''}` : `${row.for_month || '—'}${row.year ? ' ' + row.year : ''}`}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color }}>₹{fmt(feeType === 'flat' ? row.amount : row.amount_paid)}</div>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <span>{fmtDate(row.pay_date)}</span>
                {row.pay_mode && <span>{row.pay_mode}</span>}
                {row.receipt_no && <span style={{ fontFamily: 'monospace', color }}>{row.receipt_no}</span>}
                {row.hostel_type && <HostelTypeBadge type={row.hostel_type} />}
                {row.course && <span>{row.course}</span>}
              </div>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => printReceipt(student, row, feeType)}
                  style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${color}`, background: 'white', color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🖨️ Receipt
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop: table */
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {columns.map(col => (
                  <th key={col.key} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{col.label}</th>
                ))}
                <th style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Receipt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'white'}
                >
                  {columns.map(col => (
                    <td key={col.key} style={{ padding: '10px 16px', color: col.color ? col.color(row) : '#334155', fontWeight: col.bold ? 700 : 400, fontFamily: col.mono ? 'monospace' : 'inherit', whiteSpace: 'nowrap' }}>
                      {col.render ? col.render(row) : (row[col.key] ?? '—')}
                    </td>
                  ))}
                  <td style={{ padding: '8px 16px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <button onClick={() => printReceipt(student, row, feeType)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: `1.5px solid ${color}`, background: 'white', color, fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = 'white' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.color = color }}
                    >
                      🖨️ Receipt
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentFeeLedger() {
  const mobile = useMobile()
  const [students, setStudents] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [admRows, setAdmRows] = useState([])
  const [flatRows, setFlatRows] = useState([])
  const [crsRows, setCrsRows] = useState([])

  useEffect(() => {
    supabase.from('students').select('*').order('name').then(({ data }) => setStudents(data || []))
  }, [])

  const loadLedger = async student => {
    setSelected(student); setLoading(true)
    const gcc = gccStr(student.gcc_no)
    const [a, f, c] = await Promise.all([
      supabase.from('adm_fee_collections').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: true }),
      supabase.from('adm_flat_fees').select('*').eq('adm_app_id', gcc).eq('paid', true).eq('reverted', false).order('pay_date', { ascending: true }),
      supabase.from('adm_course_fees').select('*').eq('adm_app_id', gcc).eq('reverted', false).order('pay_date', { ascending: true }),
    ])
    setAdmRows(a.data || []); setFlatRows(f.data || []); setCrsRows(c.data || [])
    setLoading(false)
  }

  const admTotal  = useMemo(() => admRows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0), [admRows])
  const flatTotal = useMemo(() => flatRows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [flatRows])
  const crsTotal  = useMemo(() => crsRows.reduce((s, r) => s + (Number(r.amount_paid) || 0), 0), [crsRows])
  const grandTotal = admTotal + flatTotal + crsTotal
  const handleClear = () => { setSelected(null); setAdmRows([]); setFlatRows([]); setCrsRows([]) }

  return (
    <div style={{ padding: mobile ? '14px 12px' : '24px', fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", background: 'linear-gradient(180deg,#F4F1EA,#F8F6F0)', minHeight: '100vh' }}>
      <style>{PREMIUM_CSS}</style>
      <PremiumHero mobile={mobile} icon="📒" title="Student Fee Ledger" subtitle="Full payment history per student · Print receipts on any row"
        stats={[
          { icon: '🎓', label: 'Students', value: students.length.toLocaleString('en-IN') },
          ...(selected ? [{ icon: '🧾', label: 'Transactions', value: admRows.length + flatRows.length + crsRows.length }, { icon: '💰', label: 'Total paid', value: '₹' + fmt(grandTotal), color: '#E2C57E' }] : []),
        ]} />

      {/* Search */}
      <div className="gp-card gp-in" style={{ padding: mobile ? '14px' : '20px 24px', marginBottom: 20, position: 'relative', zIndex: 5 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Search student</div>
        <StudentSearch students={students} onSelect={loadLedger} mobile={mobile} />
        {!selected && <p style={{ marginTop: 10, fontSize: 13, color: '#94a3b8' }}>Search and select a student to view their fee ledger.</p>}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Loading ledger…</div>}

      {selected && !loading && (
        <>
          {/* Student card */}
          <div className="gp-in" style={{ background: 'radial-gradient(120% 140% at 100% 0%, #1F4E8C 0%, #132B52 45%, #0B1E3D 85%)', borderRadius: 18, boxShadow: '0 18px 40px rgba(11,30,61,.22), inset 0 0 0 1px rgba(226,197,126,.22)', padding: mobile ? '16px' : '22px 26px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <StudentPhoto s={selected} size={mobile ? 52 : 68} />
              <div>
                <div className="gp-serif" style={{ fontSize: mobile ? 18 : 24, fontWeight: 700, color: 'white' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {selected.gcc_no && <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#C9A24B' }}>GCC-{selected.gcc_no}</span>}
                  {selected.batch && <span>{selected.batch}</span>}
                  {selected.course && <span>{selected.course}</span>}
                  {selected.hostel_type && <HostelTypeBadge type={selected.hostel_type} />}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => printLedger(selected, admRows, flatRows, crsRows, grandTotal)}
                style={{ padding: mobile ? '8px 14px' : '10px 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(180deg,#D9B566,#C9A24B)', color: '#0B1E3D', fontSize: mobile ? 12 : 13, fontWeight: 800, cursor: 'pointer', borderRadius: 999, boxShadow: '0 10px 22px rgba(201,162,75,.3)' }}>
                🖨️ Print Ledger
              </button>
              <button onClick={handleClear}
                style={{ padding: mobile ? '8px 12px' : '10px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,.2)', background: 'transparent', color: 'white', fontSize: mobile ? 12 : 13, fontWeight: 600, cursor: 'pointer' }}>
                ← Change
              </button>
            </div>
          </div>

          {/* Summary cards — 2-col on mobile */}
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: mobile ? 10 : 14, marginBottom: 16 }}>
            {[
              { label: 'Admission & Kit', amount: admTotal, color: '#4f46e5', icon: '🎓' },
              { label: 'Flat Fees', amount: flatTotal, color: '#059669', icon: '📅' },
              { label: 'Course Fees', amount: crsTotal, color: '#7c3aed', icon: '📚' },
              { label: 'Grand Total', amount: grandTotal, color: '#B8913F', icon: '💰' },
            ].map(c => (
              <div key={c.label} className="gp-card gp-lift" style={{ padding: mobile ? '12px' : '16px 18px', borderTop: `3px solid ${c.color}` }}>
                <div style={{ fontSize: mobile ? 16 : 20, marginBottom: 4 }}>{c.icon}</div>
                <div style={{ fontSize: mobile ? 10 : 11, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{c.label}</div>
                <div className="gp-serif" style={{ fontSize: mobile ? 18 : 24, fontWeight: 700, color: c.color }}>{c.amount > 0 ? `₹${fmt(c.amount)}` : '—'}</div>
              </div>
            ))}
          </div>

          <LedgerSection title="Admission & Kit Fees" icon="🎓" color="#4f46e5" bg="#eef2ff" total={admTotal} totalLabel="Total paid" emptyMsg="No admission fees recorded" columns={ADM_COLUMNS} rows={admRows} student={selected} feeType="adm" mobile={mobile} />
          <LedgerSection title="Monthly Flat Fees" icon="📅" color="#059669" bg="#ecfdf5" total={flatTotal} totalLabel="Total paid" emptyMsg="No flat fees recorded" columns={FLAT_COLUMNS} rows={flatRows} student={selected} feeType="flat" mobile={mobile} />
          <LedgerSection title="Course Fees" icon="📚" color="#7c3aed" bg="#f5f3ff" total={crsTotal} totalLabel="Total paid" emptyMsg="No course fees recorded" columns={CRS_COLUMNS} rows={crsRows} student={selected} feeType="crs" mobile={mobile} />

          {/* Grand total */}
          <div style={{ background: 'linear-gradient(135deg,#0B1E3D,#132B52)', borderRadius: 18, padding: mobile ? '16px' : '20px 26px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 16px 36px rgba(11,30,61,.22), inset 0 0 0 1px rgba(226,197,126,.25)' }}>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{admRows.length + flatRows.length + crsRows.length} transactions</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Grand Total</div>
              <div className="gp-serif" style={{ fontSize: mobile ? 24 : 32, fontWeight: 700, color: '#E2C57E' }}>₹{fmt(grandTotal)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
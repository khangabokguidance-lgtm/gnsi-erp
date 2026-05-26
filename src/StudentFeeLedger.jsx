// StudentFeeLedger.jsx — mobile-responsive
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'

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

// ─── Receipt printer (unchanged) ─────────────────────────────────────────────
function printReceipt(student, row, type) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const receiptNo = row.receipt_no || '—'
  const payDate = fmtDate(row.pay_date)
  const payMode = row.pay_mode || '—'
  const txnRef = row.txn_ref || null
  let description, amount, sectionLabel, accentColor

  if (type === 'adm') {
    description = row.description || row.fee_type || 'Admission / Kit Fee'
    amount = Number(row.amount_paid || 0)
    sectionLabel = 'Admission & Kit Fee'
    accentColor = '#4f46e5'
  } else if (type === 'flat') {
    description = `Monthly Fee — ${row.month || ''}${row.year ? ' ' + row.year : ''}${row.hostel_type ? ' (' + row.hostel_type + ')' : ''}`
    amount = Number(row.amount || 0)
    sectionLabel = `Monthly Flat Fee${row.hostel_type ? ' · ' + row.hostel_type : ''}`
    accentColor = '#059669'
  } else {
    description = `Course Fee — ${row.for_month || ''}${row.year ? ' ' + row.year : ''}`
    amount = Number(row.amount_paid || 0)
    sectionLabel = `Course Fee${row.course ? ' · ' + row.course : ''}`
    accentColor = '#7c3aed'
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt ${receiptNo}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#f0f4f8;display:flex;justify-content:center;padding:32px 16px}.page{width:720px;background:white;border-radius:0;box-shadow:0 4px 40px rgba(0,0,0,.15);overflow:hidden}.header{background:#1e3a5f;padding:28px 36px}.inst-name{font-size:20px;font-weight:700;color:white}.receipt-no{font-size:22px;font-weight:800;color:#c9a84c;font-family:monospace}.meta{display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid #E2E8F0}.mc{padding:10px 18px;border-right:1px solid #E2E8F0}.ml{font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}.mv{font-weight:700;color:#1E293B;font-size:12px}table{width:100%;border-collapse:collapse}td{padding:8px 18px;border-bottom:1px solid #F1F5F9}.grand td{background:#1E1B4B;font-weight:900;font-size:16px;color:#fff;padding:14px 18px;border:none}.ftr{padding:16px 20px;background:#F8FAFC;border-top:1px solid #E2E8F0;display:flex;justify-content:space-between}.sig-line{height:1px;width:130px;border-top:1.5px dashed #CBD5E1;margin-top:32px}.btns{display:flex;gap:10px;justify-content:center;margin-top:20px}.btn{padding:11px 30px;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer}.bp{background:#1e3a5f;color:#fff}@media print{.btns{display:none}}</style></head><body>
  <div class="page">
    <div class="header" style="display:flex;justify-content:space-between;align-items:flex-start">
      <div><div class="inst-name">Guidance Navodaya &amp; Sainik Institute</div><div style="font-size:11px;color:rgba(255,255,255,.55);margin-top:4px">Khangabok, Thoubal, Manipur</div></div>
      <div style="text-align:right"><div style="font-size:10px;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.1em">Receipt No.</div><div class="receipt-no">${receiptNo}</div></div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,${accentColor},#c9a84c)"></div>
    <div class="meta">
      <div class="mc"><div class="ml">Date</div><div class="mv">${payDate}</div></div>
      <div class="mc"><div class="ml">Pay mode</div><div class="mv">${payMode}</div></div>
      <div class="mc"><div class="ml">Type</div><div class="mv" style="color:${accentColor}">${sectionLabel}</div></div>
    </div>
    <table><tbody>
      <tr><td style="color:#64748B;width:40%">Student</td><td style="font-weight:700">${student.name}</td></tr>
      <tr><td style="color:#64748B">GCC No.</td><td style="font-weight:700">GCC-${student.gcc_no}</td></tr>
      <tr><td style="color:#64748B">Class / Course</td><td style="font-weight:700">${[student.batch, student.course].filter(Boolean).join(' · ') || '—'}</td></tr>
      ${row.hostel_type ? `<tr><td style="color:#64748B">Hostel Type</td><td style="font-weight:700">${row.hostel_type}</td></tr>` : ''}
      ${txnRef ? `<tr><td style="color:#64748B">Txn ref</td><td style="font-weight:700">${txnRef}</td></tr>` : ''}
    </tbody></table>
    <table><tbody>
      <tr><td style="color:#1E293B;font-weight:600">${description}</td><td style="text-align:right;font-weight:800;font-size:16px;color:${accentColor}">₹${fmt(amount)}</td></tr>
      <tr class="grand"><td>Total Paid</td><td style="text-align:right">₹${fmt(amount)}</td></tr>
    </tbody></table>
    <div class="ftr">
      <div><div style="font-size:11px;color:#94a3b8;margin-bottom:4px">Authorised signatory</div><div class="sig-line"></div></div>
      <div style="text-align:right;font-size:11px;color:#94A3B8"><div style="font-weight:700;color:#1E293B;font-size:13px">GNSI</div><div>Printed on: ${dateStr}</div></div>
    </div>
  </div>
  <div class="btns"><button class="btn bp" onclick="window.print()">Print receipt</button></div>
  </body></html>`

  const pw = window.open('', '_blank', 'width=820,height=950,scrollbars=yes')
  if (!pw) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  pw.document.write(html); pw.document.close()
  setTimeout(() => pw.print(), 500)
}

function printLedger(student, admRows, flatRows, crsRows, grandTotal) {
  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const section = (title, headers, rows) => rows.length === 0 ? '' : `<div class="section"><div class="sec-title">${title}</div><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`
  const admHtmlRows = admRows.map(r => `<tr><td>${fmtDate(r.pay_date)}</td><td>${r.description || r.fee_type || '—'}</td><td>${r.pay_mode || '—'}</td><td>${r.receipt_no || '—'}</td><td class="amt">₹${fmt(r.amount_paid)}</td></tr>`)
  const flatHtmlRows = flatRows.map(r => `<tr><td>${fmtDate(r.pay_date)}</td><td>${r.month || '—'} ${r.year || ''}</td><td>${r.hostel_type || '—'}</td><td>${r.pay_mode || '—'}</td><td>${r.receipt_no || '—'}</td><td class="amt">₹${fmt(r.amount)}</td></tr>`)
  const crsHtmlRows = crsRows.map(r => `<tr><td>${fmtDate(r.pay_date)}</td><td>${r.for_month || '—'}${r.year ? ' ' + r.year : ''}</td><td>${r.course || '—'}</td><td>${r.hostel_type || '—'}</td><td>${r.pay_mode || '—'}</td><td>${r.receipt_no || '—'}</td><td class="amt">₹${fmt(r.amount_paid)}</td></tr>`)
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Fee Ledger — ${student.name}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Georgia,serif;background:#fff;padding:32px;color:#1e293b;font-size:13px}.hdr{display:flex;justify-content:space-between;border-bottom:3px solid #1e3a5f;padding-bottom:16px;margin-bottom:20px}.inst{font-size:18px;font-weight:700;color:#1e3a5f}.title{font-size:22px;font-weight:800;color:#1e3a5f;margin-bottom:16px}.meta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;padding:16px;background:#f8fafc;border-radius:8px}.ml{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}.mv{font-weight:700;color:#1e293b;font-size:13px}.section{margin-bottom:20px}.sec-title{font-size:13px;font-weight:800;color:#1e3a5f;text-transform:uppercase;letter-spacing:.08em;padding:8px 0;border-bottom:2px solid #1e3a5f;margin-bottom:8px}table{width:100%;border-collapse:collapse}th{padding:8px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;background:#f8fafc;border-bottom:1px solid #e2e8f0;text-transform:uppercase}td{padding:8px 12px;border-bottom:1px solid #f1f5f9;font-size:12px}.amt{font-weight:700;text-align:right}.grand{display:flex;justify-content:flex-end;margin-top:20px;padding-top:16px;border-top:2px solid #1e3a5f}.grand-box{background:#1e3a5f;color:white;padding:14px 24px;border-radius:8px;text-align:right}.grand-label{font-size:11px;opacity:.7;margin-bottom:2px}.grand-amt{font-size:22px;font-weight:800}.ftr{margin-top:32px;display:flex;justify-content:space-between;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}@media print{body{padding:16px}}</style></head><body>
  <div class="hdr"><div><div class="inst">Guidance Navodaya &amp; Sainik Institute</div><div style="font-size:11px;color:#64748b">Khangabok, Thoubal, Manipur</div></div><div style="text-align:right"><div style="font-size:11px;color:#94a3b8">Printed on</div><div style="font-weight:700">${dateStr}</div></div></div>
  <div class="title">Student Fee Ledger</div>
  <div class="meta"><div><div class="ml">Student</div><div class="mv">${student.name}</div></div><div><div class="ml">GCC No.</div><div class="mv">GCC-${student.gcc_no}</div></div><div><div class="ml">Adm. No.</div><div class="mv">${student.admission_no || '—'}</div></div><div><div class="ml">Class / Course</div><div class="mv">${[student.batch, student.course].filter(Boolean).join(' · ') || '—'}</div></div></div>
  ${section('Admission &amp; Kit Fees', ['Date', 'Description', 'Mode', 'Receipt No.', 'Amount'], admHtmlRows)}
  ${section('Monthly Flat Fees', ['Date', 'Month', 'Hostel Type', 'Mode', 'Receipt No.', 'Amount'], flatHtmlRows)}
  ${section('Course Fees', ['Date', 'Month', 'Course', 'Hostel Type', 'Mode', 'Receipt No.', 'Amount'], crsHtmlRows)}
  <div class="grand"><div class="grand-box"><div class="grand-label">Grand Total Paid</div><div class="grand-amt">₹${fmt(grandTotal)}</div></div></div>
  <div class="ftr"><span>GNSI · Student Fee Ledger · ${student.name} (GCC-${student.gcc_no})</span><span>Computer generated · ${dateStr}</span></div>
  </body></html>`
  const pw = window.open('', '_blank', 'width=800,height=900,scrollbars=yes')
  if (!pw) { window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank'); return }
  pw.document.write(html); pw.document.close()
  setTimeout(() => pw.print(), 400)
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
          onFocus={e => e.target.style.borderColor = '#1e3a5f'} onBlur={e => e.target.style.borderColor = '#e2e8f0'}
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
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c9a84c', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                {(s.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {s.gcc_no && <span style={{ fontWeight: 700, color: '#1e3a5f', fontFamily: 'monospace' }}>GCC-{s.gcc_no}</span>}
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
    <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', border: '1px solid #e2e8f0', marginBottom: 16 }}>
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
      supabase.from('adm_fee_collections').select('*').eq('adm_app_id', gcc).order('pay_date', { ascending: true }),
      supabase.from('adm_flat_fees').select('*').eq('adm_app_id', gcc).order('pay_date', { ascending: true }),
      supabase.from('adm_course_fees').select('*').eq('adm_app_id', gcc).order('pay_date', { ascending: true }),
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
    <div style={{ padding: mobile ? '14px 12px' : '24px', fontFamily: 'system-ui,sans-serif', background: '#f0f4f8', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: mobile ? 20 : 26, fontWeight: 800, color: '#1e3a5f', margin: 0 }}>📒 Fee Ledger</h1>
        {!mobile && <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>Full payment history per student · Print receipts on any row</p>}
      </div>

      {/* Search */}
      <div style={{ background: 'white', borderRadius: 14, padding: mobile ? '14px' : '20px 24px', marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>Search student</div>
        <StudentSearch students={students} onSelect={loadLedger} mobile={mobile} />
        {!selected && <p style={{ marginTop: 10, fontSize: 13, color: '#94a3b8' }}>Search and select a student to view their fee ledger.</p>}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: '#64748b' }}>⏳ Loading ledger…</div>}

      {selected && !loading && (
        <>
          {/* Student card */}
          <div style={{ background: '#1e3a5f', borderRadius: 14, padding: mobile ? '14px' : '20px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: mobile ? 40 : 52, height: mobile ? 40 : 52, borderRadius: '50%', background: '#c9a84c', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: mobile ? 18 : 22, fontWeight: 800, color: '#1e3a5f', flexShrink: 0 }}>
                {(selected.name || '?')[0].toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: mobile ? 16 : 20, fontWeight: 800, color: 'white' }}>{selected.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.6)', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {selected.gcc_no && <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#c9a84c' }}>GCC-{selected.gcc_no}</span>}
                  {selected.batch && <span>{selected.batch}</span>}
                  {selected.course && <span>{selected.course}</span>}
                  {selected.hostel_type && <HostelTypeBadge type={selected.hostel_type} />}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => printLedger(selected, admRows, flatRows, crsRows, grandTotal)}
                style={{ padding: mobile ? '8px 14px' : '10px 20px', borderRadius: 10, border: 'none', background: '#c9a84c', color: '#1e3a5f', fontSize: mobile ? 12 : 13, fontWeight: 800, cursor: 'pointer' }}>
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
              { label: 'Grand Total', amount: grandTotal, color: '#1e3a5f', icon: '💰' },
            ].map(c => (
              <div key={c.label} style={{ background: 'white', borderRadius: 12, padding: mobile ? '12px' : '16px 18px', borderLeft: `4px solid ${c.color}`, boxShadow: '0 2px 8px rgba(0,0,0,.05)' }}>
                <div style={{ fontSize: mobile ? 16 : 20, marginBottom: 4 }}>{c.icon}</div>
                <div style={{ fontSize: mobile ? 10 : 11, fontWeight: 700, color: c.color, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 3 }}>{c.label}</div>
                <div style={{ fontSize: mobile ? 16 : 22, fontWeight: 800, color: c.color }}>{c.amount > 0 ? `₹${fmt(c.amount)}` : '—'}</div>
              </div>
            ))}
          </div>

          <LedgerSection title="Admission & Kit Fees" icon="🎓" color="#4f46e5" bg="#eef2ff" total={admTotal} totalLabel="Total paid" emptyMsg="No admission fees recorded" columns={ADM_COLUMNS} rows={admRows} student={selected} feeType="adm" mobile={mobile} />
          <LedgerSection title="Monthly Flat Fees" icon="📅" color="#059669" bg="#ecfdf5" total={flatTotal} totalLabel="Total paid" emptyMsg="No flat fees recorded" columns={FLAT_COLUMNS} rows={flatRows} student={selected} feeType="flat" mobile={mobile} />
          <LedgerSection title="Course Fees" icon="📚" color="#7c3aed" bg="#f5f3ff" total={crsTotal} totalLabel="Total paid" emptyMsg="No course fees recorded" columns={CRS_COLUMNS} rows={crsRows} student={selected} feeType="crs" mobile={mobile} />

          {/* Grand total */}
          <div style={{ background: '#1e3a5f', borderRadius: 14, padding: mobile ? '14px' : '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12 }}>{admRows.length + flatRows.length + crsRows.length} transactions</div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>Grand Total</div>
              <div style={{ fontSize: mobile ? 22 : 28, fontWeight: 800, color: '#c9a84c' }}>₹{fmt(grandTotal)}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
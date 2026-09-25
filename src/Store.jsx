import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { getActiveStudents } from './studentQueries'
import { isAdminRole } from './roles'
import { gccStr } from './feeEngine'

// ═══════════════════════════════════════════════════════════════════════════
// GNSI Store — counter POS, inventory, online orders, sales, purchases, reports.
// Run store_schema.sql, then store_features.sql, in Supabase first.
// ═══════════════════════════════════════════════════════════════════════════

const NAVY = '#1e3a5f'
const PAY_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque']
const ORDER_FLOW = { new: 'confirmed', confirmed: 'ready' }
const ORDER_COLORS = {
  new: ['#eff6ff', '#1d4ed8'], confirmed: ['#fef9c3', '#a16207'], ready: ['#f0fdf4', '#166534'],
  delivered: ['#f1f5f9', '#475569'], cancelled: ['#fef2f2', '#b91c1c'],
}

const n = v => Number(v || 0).toLocaleString('en-IN')
const todayStr = () => new Date().toLocaleDateString('en-CA')
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// A product's effective (sale, if active) price — mirrors store_effective_price() in SQL,
// which is what actually gets charged; this is only for display before checkout.
const effPrice = p => {
  const now = Date.now()
  const starts = p.sale_starts ? new Date(p.sale_starts).getTime() : null
  const ends = p.sale_ends ? new Date(p.sale_ends).getTime() : null
  if (p.sale_price != null && Number(p.sale_price) >= 0 && Number(p.sale_price) < Number(p.price)
      && (starts === null || now >= starts) && (ends === null || now <= ends)) return Number(p.sale_price)
  return Number(p.price)
}
const LOYALTY_POINT_VALUE = 1   // ₹ per point on redemption — mirrors store_loyalty_point_value()
const LOYALTY_EARN_RATE = 100   // ₹ paid per point earned — mirrors store_loyalty_earn_rate()

const HELD_KEY = 'gnsi_store_held_bills'
const DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1]
const MIGRATION_HINT = 'Run store_features.sql in the Supabase SQL Editor to enable this.'
const staffName = u => u?.userName || u?.name || 'Admin'
const isMissingTable = err => !!err && /does not exist|schema cache|could not find/i.test(err.message || '')

// ── CSV helpers ─────────────────────────────────────────────────────────────
const csvCell = v => {
  let s = String(v ?? '')
  if (/^[=+\-@]/.test(s)) s = "'" + s            // block formula injection in Excel
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const toCSV = (headers, rows) => [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n')
function downloadFile(name, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false
  const t = text.replace(/^﻿/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) {
      if (c === '"' && t[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(x => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell); if (row.some(x => x.trim() !== '')) rows.push(row)
  if (!rows.length) return []
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
  return rows.slice(1).map(r => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])))
}

// ── WhatsApp + print helpers ────────────────────────────────────────────────
const waPhone = ph => { const d = String(ph || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d }
const waLink = (ph, text) => `https://wa.me/${waPhone(ph)}?text=${encodeURIComponent(text)}`
function openPrint(title, body, extraHead = '', width = 820) {
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${esc(title)}</title>${extraHead}<style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#0f172a;padding:18px}
h1{font-size:17px;color:${NAVY}}h2{font-size:13px;color:${NAVY};margin:14px 0 6px}.s{font-size:10.5px;color:#64748b;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-top:6px}th{font-size:10.5px;text-align:left;background:#f1f5f9;border:1px solid #cbd5e1;padding:5px}
td{border:1px solid #e2e8f0;padding:5px;vertical-align:top}.r{text-align:right}.b{font-weight:800}.np{margin-bottom:12px}
button{padding:8px 18px;background:${NAVY};color:white;border:none;border-radius:6px;font-weight:700;cursor:pointer}
@media print{.np{display:none}body{padding:0}}</style></head><body><div class="np"><button onclick="window.print()">Print</button></div>${body}</body></html>`
  const win = window.open('', '_blank', `width=${width},height=760,scrollbars=yes`)
  if (!win) { alert('Pop-up blocked — allow pop-ups to print.'); return }
  win.document.write(html); win.document.close()
}
const HEADER_HTML = sub => `<h1>Guidance Navodaya &amp; Sainik Institute — GNSI Store</h1><div class="s">Khangabok, Thoubal, Manipur – 795 131${sub ? ' · ' + esc(sub) : ''}</div>`

const Modal = ({ children, onClose, width = 560, busy }) => (
  <div data-store-modal="1" style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => !busy && onClose()}>
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, width: '100%', maxWidth: width, maxHeight: '92vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>{children}</div>
  </div>
)

const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white', fontFamily: 'inherit' }
const lbl = { display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.03em' }
const card = { background: 'white', border: '1px solid #e2e8f0', borderRadius: 12 }
const btn = (bg, color = 'white', extra = {}) => ({ padding: '8px 14px', borderRadius: 8, border: 'none', background: bg, color, fontSize: 12, fontWeight: 700, cursor: 'pointer', ...extra })

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const fn = () => setW(window.innerWidth)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return w
}

function Toast({ toast }) {
  if (!toast) return null
  return (
    <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 99999, background: 'white', border: '1px solid #e2e8f0', borderLeft: `3px solid ${toast.color}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 340, color: '#1e293b' }}>
      {toast.msg}
    </div>
  )
}

// Two-tone chime via Web Audio — no sound file needed.
let audioCtx = null
function chime() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    ;[[880, 0], [1320, 0.16]].forEach(([f, t]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), at = audioCtx.currentTime + t
      o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination)
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.25, at + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
      o.start(at); o.stop(at + 0.4)
    })
  } catch {}
}

// ── Accounts posting ────────────────────────────────────────────────────────
// Posts store income to the same `accounts` ledger the Fees module feeds.
// If your accounts table uses different column names, only this function
// needs adjusting — sales still save either way (account_posted stays false).
async function postToAccounts({ amount, date, desc, ref, type = 'Income', category = 'Store Sales' }) {
  if (!(amount > 0)) return true
  const { error } = await supabase.from('accounts').insert([{
    entry_date: date, type, amount, category,
    description: desc, source_ref: ref, source_type: 'store_sale', is_soft_deleted: false,
  }])
  if (error) { console.error('Store → accounts post failed:', error.message); return false }
  return true
}

async function softDeleteAccounts(ref) {
  const { error } = await supabase.from('accounts').update({ is_soft_deleted: true }).like('source_ref', `${ref}%`)
  if (error) console.error('Store → accounts reversal failed:', error.message)
}

// ── Printable bill ──────────────────────────────────────────────────────────
function printBill(sale) {
  const items = sale.items || sale.store_sale_items || []
  const rows = items.map((i, idx) => `<tr><td>${idx + 1}</td><td>${esc(i.name)}${i.size ? ' — ' + esc(i.size) : ''}</td><td class="r">${i.qty}</td><td class="r">₹${n(i.price)}</td><td class="r">₹${n(i.amount)}</td></tr>`).join('')
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${esc(sale.bill_no)}</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#0f172a;padding:14px}
.w{max-width:380px;margin:0 auto}.c{text-align:center}h1{font-size:16px;color:${NAVY}}.s{font-size:10px;color:#64748b;margin-top:2px}
hr{border:none;border-top:1px dashed #94a3b8;margin:8px 0}table{width:100%;border-collapse:collapse}th{font-size:10px;text-align:left;border-bottom:1px solid #cbd5e1;padding:4px 2px}
td{padding:4px 2px;vertical-align:top}.r{text-align:right}.row{display:flex;justify-content:space-between;padding:2px 0}.b{font-weight:800;font-size:14px}
.np{margin-bottom:10px;text-align:center}button{padding:8px 18px;background:${NAVY};color:white;border:none;border-radius:6px;font-weight:700;cursor:pointer}
@media print{.np{display:none}body{padding:0}}</style></head><body><div class="w">
<div class="np"><button onclick="window.print()">Print</button></div>
<div class="c"><h1>Guidance Navodaya &amp; Sainik Institute</h1><div class="s">GNSI Store · Khangabok, Thoubal, Manipur – 795 131</div></div><hr/>
<div class="row"><span>Bill: <b>${esc(sale.bill_no)}</b></span><span>${esc(sale.sale_date)}</span></div>
<div class="row"><span>${esc(sale.customer_name || 'Walk-in customer')}${sale.gcc_no ? ' (GCC-' + esc(sale.gcc_no) + ')' : ''}</span><span>${esc(sale.pay_mode || '')}</span></div><hr/>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr></thead><tbody>${rows}</tbody></table><hr/>
<div class="row"><span>Subtotal</span><span>₹${n(sale.subtotal)}</span></div>
${Number(sale.discount) > 0 ? `<div class="row"><span>Discount</span><span>− ₹${n(sale.discount)}</span></div>` : ''}
<div class="row b"><span>Total</span><span>₹${n(sale.total)}</span></div>
<div class="row"><span>Paid</span><span>₹${n(sale.amount_paid)}</span></div>
${Number(sale.tendered) > 0 ? `<div class="row"><span>Cash tendered</span><span>₹${n(sale.tendered)}</span></div><div class="row"><span>Change returned</span><span>₹${n(sale.change)}</span></div>` : ''}
${Number(sale.due_amount) > 0 ? `<div class="row" style="color:#b91c1c;font-weight:700"><span>Balance due (on student account)</span><span>₹${n(sale.due_amount)}</span></div>` : ''}
<hr/><div class="c s">Collected by ${esc(sale.collected_by || '—')}<br/>Thank you! Goods once sold are exchangeable only with this bill.</div>
</div></body></html>`
  const win = window.open('', '_blank', 'width=460,height=700,scrollbars=yes')
  if (!win) { alert('Pop-up blocked — allow pop-ups to print the bill.'); return }
  win.document.write(html); win.document.close()
}

// ═══════════════════════════════════════════════════════════════════════════
// POS TAB
// ═══════════════════════════════════════════════════════════════════════════
function POSTab({ products, categories, students, kits = [], isAdmin, currentUser, onSaleDone, showToast }) {
  const w = useWindowWidth()
  const isMobile = w < 900
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [cart, setCart] = useState([]) // [{id, qty}]
  const [custType, setCustType] = useState('walkin')
  const [student, setStudent] = useState(null)
  const [studentQ, setStudentQ] = useState('')
  const [custName, setCustName] = useState('')
  const [custPhone, setCustPhone] = useState('')
  const [discount, setDiscount] = useState('')
  const [payMode, setPayMode] = useState('Cash')
  const [txnRef, setTxnRef] = useState('')
  const [paidAmt, setPaidAmt] = useState('')
  const [collectedBy, setCollectedBy] = useState(currentUser?.userName || currentUser?.name || '')
  const [saving, setSaving] = useState(false)
  const [promoCode, setPromoCode] = useState('')
  const [promoResult, setPromoResult] = useState(null) // { valid, amount_off, reason }
  const [checkingPromo, setCheckingPromo] = useState(false)
  const [loyaltyBalance, setLoyaltyBalance] = useState(null)
  const [redeemPts, setRedeemPts] = useState('')
  const [tendered, setTendered] = useState('')
  const [lastSale, setLastSale] = useState(null)
  const [held, setHeld] = useState(() => { try { return JSON.parse(localStorage.getItem(HELD_KEY) || '[]') } catch { return [] } })
  const searchRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const saveHeld = list => { setHeld(list); try { localStorage.setItem(HELD_KEY, JSON.stringify(list)) } catch {} }

  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products])
  const sellable = useMemo(() => products.filter(p => p.active), [products])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return sellable.filter(p => {
      if (cat !== 'All' && String(p.category_id) !== String(cat)) return false
      if (!s) return true
      return [p.name, p.size, p.sku, p.barcode].some(v => (v || '').toString().toLowerCase().includes(s))
    })
  }, [sellable, q, cat])

  const lines = cart.map(c => ({ ...c, p: byId.get(c.id) })).filter(l => l.p)
  const subtotal = lines.reduce((s, l) => s + effPrice(l.p) * l.qty, 0)
  const discNum = Math.min(Math.max(Number(discount) || 0, 0), subtotal)
  const promoOff = promoResult?.valid ? Math.min(Number(promoResult.amount_off) || 0, subtotal - discNum) : 0
  const afterPromo = subtotal - discNum - promoOff
  const maxRedeemablePts = custType === 'student' && loyaltyBalance != null
    ? Math.min(loyaltyBalance, Math.floor(afterPromo / LOYALTY_POINT_VALUE))
    : 0
  const redeemPtsNum = Math.min(Math.max(parseInt(redeemPts, 10) || 0, 0), maxRedeemablePts)
  const redeemVal = redeemPtsNum * LOYALTY_POINT_VALUE
  const total = Math.max(afterPromo - redeemVal, 0)
  const paidNum = paidAmt === '' ? total : Math.min(Math.max(Number(paidAmt) || 0, 0), total)
  const dueNum = total - paidNum
  const willEarnPts = custType === 'student' && student ? Math.floor(paidNum / LOYALTY_EARN_RATE) : 0
  const tenderedNum = Number(tendered) || 0
  const changeDue = payMode === 'Cash' && tenderedNum > 0 ? tenderedNum - paidNum : null

  const studentHits = useMemo(() => {
    const s = studentQ.trim().toLowerCase()
    if (!s) return []
    return students.filter(st => (st.name || '').toLowerCase().includes(s) || String(st.gcc_no || '').includes(s)).slice(0, 6)
  }, [students, studentQ])

  // Fetch the loyalty points balance whenever a student is selected/changed.
  useEffect(() => {
    let cancelled = false
    setRedeemPts('')
    if (custType !== 'student' || !student) { setLoyaltyBalance(null); return }
    supabase.rpc('store_loyalty_balance', { p_gcc: gccStr(student.gcc_no) }).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setLoyaltyBalance(null); return }
      setLoyaltyBalance(Number(data) || 0)
    })
    return () => { cancelled = true }
  }, [custType, student])

  const checkPromo = async () => {
    const code = promoCode.trim()
    if (!code) { setPromoResult(null); return }
    setCheckingPromo(true)
    const { data, error } = await supabase.rpc('store_validate_promo', { p_code: code, p_subtotal: subtotal - discNum })
    setCheckingPromo(false)
    if (error) { setPromoResult({ valid: false, reason: error.message }); return }
    setPromoResult(data)
    if (!data?.valid) showToast(data?.reason || 'Invalid promo code', '#dc2626')
  }

  const addToCart = p => {
    if (p.stock <= 0) { showToast(`${p.name} is out of stock`, '#dc2626'); return }
    setCart(c => {
      const ex = c.find(x => x.id === p.id)
      if (ex) {
        if (ex.qty + 1 > p.stock) { showToast(`Only ${p.stock} in stock`, '#d97706'); return c }
        return c.map(x => x.id === p.id ? { ...x, qty: x.qty + 1 } : x)
      }
      return [...c, { id: p.id, qty: 1 }]
    })
  }
  // One tap adds every item of a kit, as far as stock allows.
  const addKit = kit => {
    const next = cart.map(x => ({ ...x })), missing = []
    arr(kit.items).forEach(({ product_id, qty }) => {
      const p = byId.get(product_id)
      if (!p || !p.active) { missing.push('an item no longer sold'); return }
      const ex = next.find(x => x.id === p.id), q = Math.min(Number(qty) || 1, p.stock - (ex ? ex.qty : 0))
      if (q <= 0) { missing.push(`${p.name}${p.size ? ' ' + p.size : ''}`); return }
      if (ex) ex.qty += q; else next.push({ id: p.id, qty: q })
    })
    setCart(next)
    showToast(missing.length ? `🎒 ${kit.name}: added, but out of stock — ${missing.join(', ')}` : `🎒 ${kit.name} added`, missing.length ? '#d97706' : '#16a34a')
  }
  const onScanned = code => {
    const c = String(code).trim().toLowerCase()
    const p = sellable.find(x => (x.barcode || '').toLowerCase() === c || (x.sku || '').toLowerCase() === c)
    if (p) { addToCart(p); chime(); return `${p.name}${p.size ? ' — ' + p.size : ''}` }
    return null
  }
  const setQty = (id, qty) => {
    const p = byId.get(id)
    if (qty <= 0) { setCart(c => c.filter(x => x.id !== id)); return }
    if (p && qty > p.stock) { showToast(`Only ${p.stock} in stock`, '#d97706'); return }
    setCart(c => c.map(x => x.id === id ? { ...x, qty } : x))
  }

  // Barcode scanners type the code then press Enter.
  const onSearchKey = e => {
    if (e.key !== 'Enter') return
    const s = q.trim().toLowerCase()
    if (!s) return
    const exact = sellable.find(p => (p.barcode || '').toLowerCase() === s || (p.sku || '').toLowerCase() === s)
    if (exact) { addToCart(exact); setQ('') }
  }

  const reset = () => {
    setCart([]); setStudent(null); setStudentQ(''); setCustName(''); setCustPhone('')
    setDiscount(''); setTxnRef(''); setPaidAmt(''); setPayMode('Cash'); setCustType('walkin')
    setPromoCode(''); setPromoResult(null); setRedeemPts(''); setLoyaltyBalance(null); setTendered('')
  }

  // ── Held (parked) bills — kept on this device so a queue can be served in parallel ──
  const holdBill = () => {
    if (!lines.length) { showToast('Nothing to hold — the bill is empty.', '#d97706'); return }
    const label = student ? student.name : custName.trim() || `Bill ${held.length + 1}`
    const entry = {
      id: Date.now(), at: new Date().toISOString(), label, cart, custType, custName, custPhone,
      student: student ? { id: student.id, name: student.name, gcc_no: student.gcc_no, course: student.course, hostel_type: student.hostel_type } : null,
      total,
    }
    saveHeld([entry, ...held].slice(0, 20))
    reset()
    showToast(`⏸ Held: ${label}`, '#0e7490')
  }
  const resumeBill = h => {
    if (lines.length && !window.confirm('The current bill is not empty. Replace it with the held bill?')) return
    reset()
    setCart(h.cart.filter(c => byId.get(c.id)))
    setCustType(h.custType); setCustName(h.custName || ''); setCustPhone(h.custPhone || '')
    if (h.student) setStudent(students.find(s => s.id === h.student.id) || h.student)
    saveHeld(held.filter(x => x.id !== h.id))
  }
  const dropHeld = h => window.confirm(`Discard held bill "${h.label}"?`) && saveHeld(held.filter(x => x.id !== h.id))

  const checkout = async () => {
    if (!lines.length || saving) return
    if (!collectedBy.trim()) { showToast('Collected By is required.', '#dc2626'); return }
    if (custType === 'student' && !student) { showToast('Select the student for this bill.', '#dc2626'); return }
    if (dueNum > 0 && custType !== 'student') { showToast('Part-payment is only allowed on a student account.', '#dc2626'); return }
    if (paidNum > 0 && payMode !== 'Cash' && !txnRef.trim()) { showToast(`Transaction reference required for ${payMode}.`, '#dc2626'); return }
    if (changeDue !== null && changeDue < 0) { showToast(`Cash tendered is ₹${n(-changeDue)} short.`, '#dc2626'); return }

    setSaving(true)
    try {
      const payload = {
        sale_date: todayStr(), customer_type: custType,
        gcc_no: student ? gccStr(student.gcc_no) : null,
        customer_name: student ? student.name : custName,
        phone: custPhone, discount: discNum, pay_mode: paidNum > 0 ? payMode : null,
        txn_ref: txnRef, amount_paid: paidNum, collected_by: collectedBy.trim(), source: 'counter',
        promo_code: promoResult?.valid ? promoCode.trim() : '', redeem_points: redeemPtsNum,
        items: lines.map(l => ({ product_id: l.id, qty: l.qty })),
      }
      const { data, error } = await supabase.rpc('store_create_sale', { p: payload })
      if (error) throw new Error(error.message)

      const posted = await postToAccounts({
        amount: Number(data.amount_paid), date: data.sale_date,
        desc: `Store sale ${data.bill_no}${data.customer_name ? ' — ' + data.customer_name : ''}`,
        ref: `store_${data.bill_no}_pay0`,
      })
      if (posted && Number(data.amount_paid) > 0) await supabase.from('store_sales').update({ account_posted: true }).eq('id', data.id)
      const ptsNote = data.points_earned > 0 ? ` · +${data.points_earned} pts` : ''
      if (!posted) showToast('Sale saved, but posting to Accounts failed — check accounts columns.', '#d97706')
      else showToast(`✅ ${data.bill_no} · ₹${n(data.total)}${ptsNote}`, '#16a34a')

      const printed = changeDue !== null ? { ...data, tendered: tenderedNum, change: changeDue } : data
      printBill(printed)
      setLastSale(printed)
      reset()
      onSaleDone()
    } catch (err) {
      showToast('Sale failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  // ── Keyboard shortcuts: F2 search · F8 hold · F9 charge · Esc clear search ──
  const keysRef = useRef({})
  keysRef.current = { checkout, holdBill }
  useEffect(() => {
    const onKey = e => {
      if (document.querySelector('[data-store-modal]')) return
      if (e.key === 'F2') { e.preventDefault(); searchRef.current?.focus(); searchRef.current?.select() }
      else if (e.key === 'F8') { e.preventDefault(); keysRef.current.holdBill() }
      else if (e.key === 'F9') { e.preventDefault(); keysRef.current.checkout() }
      else if (e.key === 'Escape' && document.activeElement === searchRef.current) setQ('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
      {/* Catalogue */}
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <input ref={searchRef} autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onSearchKey}
            placeholder="🔍 Search name / size — or scan barcode & press Enter" style={{ ...inp, flex: 1, minWidth: 220 }} />
          <button onClick={() => setScanning(true)} title="Scan barcodes with this device's camera" style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>📷 Camera</button>
          {lastSale && <button onClick={() => printBill(lastSale)} title={`Reprint ${lastSale.bill_no}`} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>🖨 Last bill</button>}
        </div>
        {scanning && <CameraScanner onCode={onScanned} onClose={() => { setScanning(false); searchRef.current?.focus() }} />}
        {kits.filter(k => k.active).length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {kits.filter(k => k.active).map(k => {
              const items = arr(k.items), total = items.reduce((a, i) => a + (byId.get(i.product_id) ? effPrice(byId.get(i.product_id)) * (Number(i.qty) || 1) : 0), 0)
              return <button key={k.id} onClick={() => addKit(k)} title={items.map(i => { const p = byId.get(i.product_id); return p ? `${p.name}${p.size ? ' ' + p.size : ''} ×${i.qty}` : '' }).join(', ')}
                style={{ flex: 'none', padding: '7px 12px', borderRadius: 9, border: '1.5px solid #e9d9b0', background: '#fbf6ea', color: '#6b5320', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🎒 {k.name} · {items.length} items · ₹{n(total)}</button>
            })}
          </div>
        )}
        {!isMobile && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11, color: '#94a3b8' }}>
            {[['F2', 'Search'], ['F8', 'Hold bill'], ['F9', 'Charge'], ['Esc', 'Clear search']].map(([k, l]) => (
              <span key={k}><kbd style={{ fontFamily: 'monospace', fontSize: 10.5, fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 4, padding: '1px 5px' }}>{k}</kbd> {l}</span>
            ))}
          </div>
        )}
        {held.length > 0 && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center', background: '#ecfeff', border: '1px solid #a5f3fc', borderRadius: 9, padding: '7px 10px' }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#0e7490' }}>⏸ HELD ({held.length}):</span>
            {held.map(h => (
              <span key={h.id} style={{ display: 'inline-flex', alignItems: 'center', background: 'white', border: '1px solid #a5f3fc', borderRadius: 99, overflow: 'hidden' }}>
                <button onClick={() => resumeBill(h)} title={`Held ${new Date(h.at).toLocaleTimeString('en-IN', { timeStyle: 'short' })}`} style={{ border: 'none', background: 'none', padding: '4px 4px 4px 10px', fontSize: 11.5, fontWeight: 700, color: '#0e7490', cursor: 'pointer' }}>{h.label} · ₹{n(h.total)}</button>
                <button onClick={() => dropHeld(h)} title="Discard" style={{ border: 'none', background: 'none', padding: '4px 8px 4px 2px', fontSize: 13, color: '#94a3b8', cursor: 'pointer' }}>×</button>
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {[{ id: 'All', name: 'All' }, ...categories].map(c => (
            <button key={c.id} onClick={() => setCat(c.id)}
              style={{ padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${String(cat) === String(c.id) ? NAVY : '#e2e8f0'}`, background: String(cat) === String(c.id) ? NAVY : 'white', color: String(cat) === String(c.id) ? 'white' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              {c.name}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 10, maxHeight: isMobile ? 'none' : 620, overflowY: 'auto', paddingRight: 2 }}>
          {filtered.map(p => {
            const out = p.stock <= 0, low = !out && p.stock <= (p.reorder_level ?? 5)
            const price = effPrice(p), onSale = price < Number(p.price)
            return (
              <button key={p.id} onClick={() => addToCart(p)} disabled={out}
                style={{ ...card, padding: 10, textAlign: 'left', cursor: out ? 'not-allowed' : 'pointer', opacity: out ? .5 : 1, position: 'relative' }}>
                {onSale && <span style={{ position: 'absolute', top: 6, left: 6, fontSize: 9.5, fontWeight: 800, color: 'white', background: '#dc2626', padding: '2px 6px', borderRadius: 5 }}>SALE</span>}
                <div style={{ height: 70, borderRadius: 8, background: '#f1f5f9', marginBottom: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>
                  {p.image_url ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.25, minHeight: 32 }}>{p.name}{p.size ? ` — ${p.size}` : ''}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: onSale ? '#dc2626' : NAVY }}>₹{n(price)}</span>
                  {(onSale || p.mrp > p.price) && <span style={{ fontSize: 10.5, color: '#94a3b8', textDecoration: 'line-through' }}>₹{n(onSale ? p.price : p.mrp)}</span>}
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 3, color: out ? '#dc2626' : low ? '#d97706' : '#16a34a' }}>
                  {out ? 'Out of stock' : `${p.stock} ${p.unit || 'pc'} left`}
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && <div style={{ gridColumn: '1/-1', padding: 32, textAlign: 'center', color: '#94a3b8' }}>No products found</div>}
        </div>
      </div>

      {/* Cart */}
      <div style={{ ...card, position: isMobile ? 'static' : 'sticky', top: 16, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 800, fontSize: 14, color: NAVY, display: 'flex', justifyContent: 'space-between' }}>
          <span>🛒 Current bill</span>
          {lines.length > 0 && (
            <span style={{ display: 'flex', gap: 10 }}>
              <button onClick={holdBill} style={{ background: 'none', border: 'none', color: '#0e7490', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⏸ Hold</button>
              <button onClick={reset} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Clear</button>
            </span>
          )}
        </div>
        <div style={{ padding: 14 }}>
          {lines.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '20px 0', fontSize: 13 }}>Tap products to add them</div>
          ) : lines.map(l => {
            const price = effPrice(l.p)
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>{l.p.name}{l.p.size ? ` — ${l.p.size}` : ''}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>₹{n(price)} each{price < Number(l.p.price) && <span style={{ color: '#dc2626', fontWeight: 700 }}> · sale</span>}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => setQty(l.id, l.qty - 1)} style={btn('#f1f5f9', '#334155', { padding: '3px 9px' })}>−</button>
                  <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 800, fontSize: 13 }}>{l.qty}</span>
                  <button onClick={() => setQty(l.id, l.qty + 1)} style={btn('#f1f5f9', '#334155', { padding: '3px 9px' })}>+</button>
                </div>
                <div style={{ width: 62, textAlign: 'right', fontWeight: 800, fontSize: 13 }}>₹{n(price * l.qty)}</div>
              </div>
            )
          })}

          {/* Customer */}
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
              {[['walkin', 'Walk-in'], ['student', 'Student account']].map(([id, label]) => (
                <button key={id} onClick={() => { setCustType(id); if (id === 'walkin') { setStudent(null); setStudentQ('') } }}
                  style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1.5px solid ${custType === id ? NAVY : '#e2e8f0'}`, background: custType === id ? '#eff6ff' : 'white', color: custType === id ? NAVY : '#64748b', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            {custType === 'student' ? (
              student ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '8px 12px' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>{student.name}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>GCC-{student.gcc_no} · {student.course || '—'} · {student.hostel_type || '—'}</div>
                  </div>
                  <button onClick={() => { setStudent(null); setStudentQ('') }} style={btn('white', '#64748b', { border: '1px solid #e2e8f0', padding: '4px 10px' })}>Change</button>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  <input value={studentQ} onChange={e => setStudentQ(e.target.value)} placeholder="Student name or GCC No…" style={inp} />
                  {studentHits.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
                      {studentHits.map(s => (
                        <div key={s.id} onClick={() => { setStudent(s); setStudentQ('') }}
                          style={{ padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                          <strong>{s.name}</strong> <span style={{ color: '#64748b' }}>GCC-{s.gcc_no} · {s.course || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input value={custName} onChange={e => setCustName(e.target.value)} placeholder="Name (optional)" style={inp} />
                <input value={custPhone} onChange={e => setCustPhone(e.target.value)} placeholder="Phone (optional)" style={inp} />
              </div>
            )}
          </div>

          {/* Promo code */}
          <div style={{ marginTop: 14 }}>
            <label style={lbl}>Promo code</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null) }}
                onKeyDown={e => e.key === 'Enter' && checkPromo()} placeholder="e.g. WELCOME10" style={{ ...inp, flex: 1 }} />
              <button onClick={checkPromo} disabled={checkingPromo || !promoCode.trim()} style={btn(NAVY, 'white', { padding: '9px 14px' })}>{checkingPromo ? '…' : 'Apply'}</button>
            </div>
            {promoResult?.valid && (
              <div style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: '#16a34a', display: 'flex', justifyContent: 'space-between' }}>
                <span>✓ {promoResult.code} applied</span>
                <button onClick={() => { setPromoCode(''); setPromoResult(null) }} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>Remove</button>
              </div>
            )}
          </div>

          {/* Loyalty points */}
          {custType === 'student' && student && loyaltyBalance != null && (
            <div style={{ marginTop: 10, background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, fontWeight: 700, color: '#854d0e' }}>
                <span>⭐ {loyaltyBalance} points available</span>
                {willEarnPts > 0 && <span style={{ color: '#16a34a' }}>+{willEarnPts} pts on this bill</span>}
              </div>
              {maxRedeemablePts > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <input type="number" min={0} max={maxRedeemablePts} value={redeemPts} onChange={e => setRedeemPts(e.target.value)}
                    placeholder="Redeem points" style={{ ...inp, padding: '6px 10px', fontSize: 12 }} />
                  <button onClick={() => setRedeemPts(String(maxRedeemablePts))} style={btn('#fde047', '#854d0e', { padding: '6px 10px', fontSize: 11 })}>Max</button>
                </div>
              )}
            </div>
          )}

          {/* Totals + payment */}
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label style={lbl}>Discount ₹{!isAdmin && ' (admin)'}</label>
              <input type="number" min={0} value={discount} disabled={!isAdmin} onChange={e => setDiscount(e.target.value)} placeholder="0" style={{ ...inp, background: isAdmin ? 'white' : '#f1f5f9' }} />
            </div>
            <div>
              <label style={lbl}>Amount paid ₹</label>
              <input type="number" min={0} value={paidAmt} onChange={e => setPaidAmt(e.target.value)} placeholder={String(total)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Mode</label>
              <select value={payMode} onChange={e => setPayMode(e.target.value)} style={inp}>{PAY_MODES.map(m => <option key={m}>{m}</option>)}</select>
            </div>
            <div>
              <label style={lbl}>Txn ref{payMode !== 'Cash' ? ' *' : ''}</label>
              <input value={txnRef} onChange={e => setTxnRef(e.target.value)} placeholder={payMode !== 'Cash' ? 'Required' : 'Optional'} style={inp} />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label style={lbl}>Collected by *</label>
            <input value={collectedBy} onChange={e => setCollectedBy(e.target.value)} placeholder="Staff name" style={{ ...inp, borderColor: collectedBy.trim() ? '#d1d5db' : '#fca5a5' }} />
          </div>

          {/* Cash tendered → change */}
          {payMode === 'Cash' && paidNum > 0 && (
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'end' }}>
              <div>
                <label style={lbl}>Cash tendered ₹</label>
                <input type="number" min={0} value={tendered} onChange={e => setTendered(e.target.value)} placeholder="Optional" style={inp} />
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[...new Set([Math.ceil(paidNum / 100) * 100, Math.ceil(paidNum / 500) * 500, 2000].filter(v => v >= paidNum))].slice(0, 3).map(v => (
                  <button key={v} onClick={() => setTendered(String(v))} style={btn('#f1f5f9', '#334155', { padding: '6px 8px', fontSize: 11, border: '1px solid #e2e8f0' })}>₹{n(v)}</button>
                ))}
              </div>
              {changeDue !== null && (
                <div style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 900, padding: '8px 12px', borderRadius: 8, background: changeDue >= 0 ? '#f0fdf4' : '#fef2f2', color: changeDue >= 0 ? '#166534' : '#b91c1c' }}>
                  <span>{changeDue >= 0 ? 'Return change' : 'Short by'}</span><span>₹{n(Math.abs(changeDue))}</span>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 14, fontSize: 13, color: '#475569' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Subtotal</span><span>₹{n(subtotal)}</span></div>
            {discNum > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Discount</span><span>− ₹{n(discNum)}</span></div>}
            {promoOff > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#16a34a' }}><span>Promo ({promoResult.code})</span><span>− ₹{n(promoOff)}</span></div>}
            {redeemVal > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#854d0e' }}><span>Points redeemed ({redeemPtsNum})</span><span>− ₹{n(redeemVal)}</span></div>}
            {dueNum > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#b91c1c', fontWeight: 700 }}><span>Goes to student dues</span><span>₹{n(dueNum)}</span></div>}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900, color: 'white', background: NAVY, padding: '12px 14px', borderRadius: 10, marginTop: 8 }}>
            <span>Total</span><span>₹{n(total)}</span>
          </div>
          <button onClick={checkout} disabled={saving || !lines.length}
            style={{ ...btn(saving || !lines.length ? '#e2e8f0' : '#16a34a', saving || !lines.length ? '#94a3b8' : 'white'), width: '100%', padding: 14, fontSize: 15, marginTop: 10, cursor: saving || !lines.length ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Processing…' : `Charge ₹${n(paidNum)} & print bill`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCTS TAB
// ═══════════════════════════════════════════════════════════════════════════
const EMPTY_PRODUCT = { name: '', sku: '', barcode: '', category_id: '', price: '', mrp: '', cost_price: '', size: '', sizes: '', stock: '', reorder_level: '5', unit: 'pc', description: '', image_url: '', online_visible: true, active: true, sale_price: '', sale_starts: '', sale_ends: '' }
const marginPct = p => (p.cost_price != null && Number(p.cost_price) > 0 && effPrice(p) > 0) ? Math.round((effPrice(p) - Number(p.cost_price)) / effPrice(p) * 100) : null

function ProductsTab({ products, categories, isAdmin, currentUser, reload, showToast, requestCount = 0, onRequests }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [stockF, setStockF] = useState('All')
  const [editing, setEditing] = useState(null) // product object or {} for new
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [saving, setSaving] = useState(false)
  const [newCat, setNewCat] = useState('')
  const [modal, setModal] = useState(null) // 'import' | 'labels' | 'stocktake'
  const [listing, setListing] = useState(null) // product whose listing is being edited
  const [insight, setInsight] = useState(null) // product whose sales insights are open
  const byCat = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories])
  const by = currentUser?.userName || currentUser?.name || 'Admin'
  const hasCost = products.length > 0 && 'cost_price' in products[0]
  const hasListing = products.length > 0 && 'bullets' in products[0]

  const exportCSV = () => {
    const headers = ['name', 'size', 'category', 'sku', 'barcode', 'price', 'mrp', 'cost_price', 'sale_price', 'stock', 'reorder_level', 'unit', 'online_visible', 'active', 'description', 'image_url']
    const data = rows.map(p => [p.name, p.size, byCat.get(p.category_id) || '', p.sku, p.barcode, p.price, p.mrp, p.cost_price, p.sale_price, p.stock, p.reorder_level, p.unit, p.online_visible ? 'yes' : 'no', p.active ? 'yes' : 'no', p.description, p.image_url])
    downloadFile(`gnsi-store-products-${todayStr()}.csv`, toCSV(headers, data))
  }

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase()
    return products.filter(p => {
      if (cat !== 'All' && String(p.category_id) !== String(cat)) return false
      if (stockF === 'Low' && !(p.stock > 0 && p.stock <= (p.reorder_level ?? 5))) return false
      if (stockF === 'Out' && p.stock > 0) return false
      if (!s) return true
      return [p.name, p.size, p.sku, p.barcode].some(v => (v || '').toString().toLowerCase().includes(s))
    })
  }, [products, q, cat, stockF])

  const openNew = () => { setForm(EMPTY_PRODUCT); setEditing({}) }
  const openEdit = p => {
    setForm({ ...EMPTY_PRODUCT, ...p, category_id: p.category_id ?? '', price: p.price ?? '', mrp: p.mrp ?? '', cost_price: p.cost_price ?? '', size: p.size ?? '', sizes: '', stock: p.stock, reorder_level: p.reorder_level ?? '', sku: p.sku ?? '', barcode: p.barcode ?? '', description: p.description ?? '', image_url: p.image_url ?? '',
      sale_price: p.sale_price ?? '', sale_starts: p.sale_starts ? p.sale_starts.slice(0, 16) : '', sale_ends: p.sale_ends ? p.sale_ends.slice(0, 16) : '' })
    setEditing(p)
  }
  const f = (k, v) => setForm(x => ({ ...x, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) { showToast('Product name is required.', '#dc2626'); return }
    if (form.price === '' || Number(form.price) < 0) { showToast('Enter a valid selling price.', '#dc2626'); return }
    if (form.sale_price !== '' && Number(form.sale_price) >= Number(form.price)) { showToast('Sale price must be lower than the regular price.', '#dc2626'); return }
    setSaving(true)
    try {
      const base = {
        name: form.name.trim(), category_id: form.category_id ? Number(form.category_id) : null,
        price: Number(form.price), mrp: form.mrp === '' ? null : Number(form.mrp),
        reorder_level: form.reorder_level === '' ? 5 : Number(form.reorder_level), unit: form.unit || 'pc',
        description: form.description || null, image_url: form.image_url || null,
        online_visible: !!form.online_visible, active: !!form.active, updated_at: new Date().toISOString(),
        sale_price: form.sale_price === '' ? null : Number(form.sale_price),
        sale_starts: form.sale_starts || null, sale_ends: form.sale_ends || null,
        ...(hasCost ? { cost_price: form.cost_price === '' ? null : Number(form.cost_price) } : {}),
      }
      if (editing.id) {
        const { error } = await supabase.from('store_products').update({
          ...base, sku: form.sku.trim() || null, barcode: form.barcode.trim() || null, size: form.size.trim() || null,
        }).eq('id', editing.id)
        if (error) throw new Error(error.message)
        showToast('✅ Product updated')
      } else {
        const sizes = form.sizes.split(',').map(s => s.trim()).filter(Boolean)
        const variants = sizes.length ? sizes : [form.size.trim() || null]
        const opening = Number(form.stock) || 0
        for (const sz of variants) {
          const sku = form.sku.trim() ? (variants.length > 1 ? `${form.sku.trim()}-${sz}` : form.sku.trim()) : null
          const { data, error } = await supabase.from('store_products').insert([{ ...base, sku, barcode: variants.length > 1 ? null : (form.barcode.trim() || null), size: sz, stock: 0 }]).select().single()
          if (error) throw new Error(error.message)
          if (opening > 0) await supabase.rpc('store_adjust_stock', { p_product: data.id, p_delta: opening, p_reason: 'Opening stock', p_by: by })
        }
        showToast(`✅ Added ${variants.length} product${variants.length > 1 ? 's' : ''}`)
      }
      setEditing(null); reload()
    } catch (err) {
      showToast('Save failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  const adjust = async p => {
    const raw = window.prompt(`Adjust stock for "${p.name}${p.size ? ' — ' + p.size : ''}" (now ${p.stock}).\nEnter +N to add, −N to remove:`)
    if (raw === null) return
    const delta = parseInt(raw, 10)
    if (!delta) { showToast('Enter a non-zero whole number.', '#dc2626'); return }
    const reason = window.prompt('Reason (e.g. Purchase, Damaged, Recount):', delta > 0 ? 'Purchase' : 'Damaged') || 'Adjustment'
    const { error } = await supabase.rpc('store_adjust_stock', { p_product: p.id, p_delta: delta, p_reason: reason, p_by: by })
    if (error) { showToast('Adjust failed: ' + error.message, '#dc2626'); return }
    showToast(`Stock ${delta > 0 ? '+' : ''}${delta} applied`); reload()
  }

  const addCategory = async () => {
    const name = newCat.trim()
    if (!name) return
    const { error } = await supabase.from('store_categories').insert([{ name, sort_order: categories.length + 1 }])
    if (error) { showToast('Could not add category: ' + error.message, '#dc2626'); return }
    setNewCat(''); reload()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search name, SKU, barcode…" style={{ ...inp, flex: 2, minWidth: 200 }} />
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="All">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={stockF} onChange={e => setStockF(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="All">All stock</option><option value="Low">Low stock</option><option value="Out">Out of stock</option>
        </select>
        {isAdmin && <button onClick={openNew} style={btn(NAVY)}>+ Add product</button>}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <button onClick={exportCSV} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>⬇ Export CSV</button>
        {isAdmin && <button onClick={() => setModal('import')} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>⬆ Import CSV</button>}
        <button onClick={() => setModal('labels')} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>🏷 Print labels</button>
        {isAdmin && <button onClick={() => setModal('stocktake')} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>📋 Stock take</button>}
        {isAdmin && <button onClick={() => setModal('price')} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>₹ Bulk price</button>}
        {onRequests && <button onClick={onRequests} style={btn(requestCount ? '#f0fdf4' : '#f1f5f9', requestCount ? '#166534' : '#334155', { border: `1px solid ${requestCount ? '#86efac' : '#e2e8f0'}` })}>📣 Stock requests{requestCount ? ` (${requestCount})` : ''}</button>}
      </div>

      {isAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>NEW CATEGORY:</span>
          <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="e.g. Sports items" style={{ ...inp, width: 220 }} />
          <button onClick={addCategory} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>Add</button>
        </div>
      )}

      <div style={{ ...card, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
          <thead>
            <tr style={{ background: NAVY }}>
              {['Product', 'Category', 'SKU / Barcode', 'Price', 'MRP', ...(hasCost ? ['Cost · Margin'] : []), 'Stock', 'Online', ''].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'white', fontSize: 11, fontWeight: 700 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const out = p.stock <= 0, low = !out && p.stock <= (p.reorder_level ?? 5)
              const price = effPrice(p), onSale = price < Number(p.price)
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: p.active ? 1 : .5 }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 7, background: '#f1f5f9', overflow: 'hidden', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 15 }}>{p.image_url ? <img src={p.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}</div>
                      <div>
                        <span onClick={() => setInsight(p)} title="Sales insights" style={{ cursor: 'pointer', borderBottom: '1px dashed #cbd5e1' }}>{p.name}{p.size ? ` — ${p.size}` : ''}</span>{!p.active && <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>(inactive)</span>}
                        {hasListing && p.online_visible && (() => { const s = listingScore(p).score; return <div style={{ fontSize: 10.5, fontWeight: 700, color: s >= 80 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626' }}>Listing {s}%</div> })()}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{byCat.get(p.category_id) || '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>{p.sku || '—'}{p.barcode ? ` · ${p.barcode}` : ''}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 800, color: onSale ? '#dc2626' : NAVY }}>₹{n(price)}{onSale && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: 'white', background: '#dc2626', padding: '1px 5px', borderRadius: 4 }}>SALE</span>}</td>
                  <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{onSale ? <span style={{ textDecoration: 'line-through' }}>₹{n(p.price)}</span> : p.mrp ? `₹${n(p.mrp)}` : '—'}</td>
                  {hasCost && (() => { const m = marginPct(p); return (
                    <td style={{ padding: '9px 12px', fontSize: 12 }}>
                      {p.cost_price != null ? <>₹{n(p.cost_price)} <span style={{ fontWeight: 800, color: m == null ? '#94a3b8' : m < 10 ? '#dc2626' : m < 25 ? '#d97706' : '#16a34a' }}>· {m ?? '—'}%</span></> : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                  ) })()}
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ fontWeight: 800, color: out ? '#dc2626' : low ? '#d97706' : '#16a34a' }}>{p.stock}</span>
                    {out && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#dc2626' }}>OUT</span>}
                    {low && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#d97706' }}>LOW</span>}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>{p.online_visible ? '🌐 Yes' : '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    {isAdmin && <button onClick={() => adjust(p)} style={btn('#eff6ff', NAVY, { padding: '4px 10px', marginRight: 6 })}>± Stock</button>}
                    {isAdmin && <button onClick={() => openEdit(p)} style={btn('#f1f5f9', '#334155', { padding: '4px 10px', marginRight: 6 })}>Edit</button>}
                    {isAdmin && <button onClick={() => hasListing ? setListing(p) : showToast('Run store_listing.sql in Supabase to enable rich listings.', '#d97706')} style={btn('#fbf6ea', '#8a6d1f', { padding: '4px 10px', border: '1px solid #e9d9b0' })}>✨ Listing</button>}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={hasCost ? 9 : 8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No products found</td></tr>}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => !saving && setEditing(null)}>
          <div style={{ ...card, width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 14 }}>{editing.id ? 'Edit product' : 'Add product'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Name *</label><input value={form.name} onChange={e => f('name', e.target.value)} style={inp} placeholder="e.g. Track Suit" /></div>
              <div><label style={lbl}>Category</label>
                <select value={form.category_id} onChange={e => f('category_id', e.target.value)} style={inp}><option value="">—</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div><label style={lbl}>Unit</label><input value={form.unit} onChange={e => f('unit', e.target.value)} style={inp} placeholder="pc / set / kg" /></div>
              <div><label style={lbl}>Selling price ₹ *</label><input type="number" min={0} value={form.price} onChange={e => f('price', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>MRP ₹</label><input type="number" min={0} value={form.mrp} onChange={e => f('mrp', e.target.value)} style={inp} /></div>
              {hasCost && (
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={lbl}>Cost price ₹ (purchase cost — never shown online)</label>
                  <input type="number" min={0} value={form.cost_price} onChange={e => f('cost_price', e.target.value)} style={inp} placeholder="Used for profit & margin reports" />
                  {form.cost_price !== '' && form.price !== '' && Number(form.price) > 0 && (
                    <div style={{ fontSize: 11.5, marginTop: 4, fontWeight: 700, color: Number(form.price) > Number(form.cost_price) ? '#16a34a' : '#dc2626' }}>
                      Margin ₹{n(Number(form.price) - Number(form.cost_price))} · {Math.round((Number(form.price) - Number(form.cost_price)) / Number(form.price) * 100)}% on regular price
                    </div>
                  )}
                </div>
              )}
              {editing.id ? (
                <div><label style={lbl}>Size / variant</label><input value={form.size} onChange={e => f('size', e.target.value)} style={inp} /></div>
              ) : (
                <div><label style={lbl}>Sizes (comma separated)</label><input value={form.sizes} onChange={e => f('sizes', e.target.value)} style={inp} placeholder="S, M, L, XL  — leave blank if none" /></div>
              )}
              {!editing.id && <div><label style={lbl}>Opening stock (each size)</label><input type="number" min={0} value={form.stock} onChange={e => f('stock', e.target.value)} style={inp} /></div>}
              <div><label style={lbl}>SKU</label><input value={form.sku} onChange={e => f('sku', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Barcode</label><input value={form.barcode} onChange={e => f('barcode', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Low-stock alert at</label><input type="number" min={0} value={form.reorder_level} onChange={e => f('reorder_level', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Image URL</label><input value={form.image_url} onChange={e => f('image_url', e.target.value)} style={inp} placeholder="https://…" /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description (shown online)</label><textarea value={form.description} onChange={e => f('description', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></div>
              <div style={{ gridColumn: '1/-1', borderTop: '1px dashed #e2e8f0', paddingTop: 10, marginTop: 2 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '.03em', marginBottom: 8 }}>🏷️ Sale price (optional)</div>
              </div>
              <div><label style={lbl}>Sale price ₹</label><input type="number" min={0} value={form.sale_price} onChange={e => f('sale_price', e.target.value)} style={inp} placeholder="Leave blank for no sale" /></div>
              <div><label style={lbl}>Sale starts</label><input type="datetime-local" value={form.sale_starts} onChange={e => f('sale_starts', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Sale ends</label><input type="datetime-local" value={form.sale_ends} onChange={e => f('sale_ends', e.target.value)} style={inp} /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={form.online_visible} onChange={e => f('online_visible', e.target.checked)} /> Show on public store</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={form.active} onChange={e => f('active', e.target.checked)} /> Active (sellable)</label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={save} disabled={saving} style={{ ...btn(NAVY), flex: 1, padding: 12, fontSize: 14 }}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setEditing(null)} disabled={saving} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'import' && <ImportProductsModal products={products} categories={categories} hasCost={hasCost} by={by} onClose={() => setModal(null)} onDone={reload} showToast={showToast} />}
      {modal === 'labels' && <LabelsModal products={rows.filter(p => p.active)} onClose={() => setModal(null)} />}
      {modal === 'price' && <BulkPriceModal products={rows} hasCost={hasCost} onClose={() => setModal(null)} onDone={reload} showToast={showToast} />}
      {insight && <ProductInsights product={insight} onClose={() => setInsight(null)} />}
      {listing && <ListingEditor product={listing} products={products} categories={categories} onClose={() => setListing(null)} onSaved={reload} showToast={showToast} />}
      {modal === 'stocktake' && <StockTakeModal products={products} categories={categories} by={by} onClose={() => setModal(null)} onDone={reload} showToast={showToast} />}
    </div>
  )
}

// ── CSV product import (add new / update existing by SKU, else name + size) ──
function ImportProductsModal({ products, categories, hasCost, by, onClose, onDone, showToast }) {
  const [plan, setPlan] = useState(null) // { adds, updates, errors }
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const template = () => downloadFile('gnsi-store-import-template.csv', toCSV(
    ['name', 'size', 'category', 'sku', 'barcode', 'price', 'mrp', 'cost_price', 'stock', 'reorder_level', 'unit', 'online_visible', 'description'],
    [['Track Suit', 'M', 'Uniforms', 'TS-01-M', '', '850', '950', '600', '20', '5', 'pc', 'yes', 'Navy blue GNSI track suit']]))

  const onFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    const recs = parseCSV(await file.text())
    const bySku = new Map(products.filter(p => p.sku).map(p => [p.sku.toLowerCase(), p]))
    const byKey = new Map(products.map(p => [`${p.name.toLowerCase()}|${(p.size || '').toLowerCase()}`, p]))
    const adds = [], updates = [], errors = []
    recs.forEach((r, i) => {
      const line = i + 2
      if (!r.name) { errors.push(`Row ${line}: name is missing`); return }
      if (r.price === '' || r.price == null || isNaN(Number(r.price)) || Number(r.price) < 0) { errors.push(`Row ${line} (${r.name}): invalid price`); return }
      const match = (r.sku && bySku.get(r.sku.toLowerCase())) || byKey.get(`${r.name.toLowerCase()}|${(r.size || '').toLowerCase()}`)
      ;(match ? updates : adds).push({ r, match, line })
    })
    setPlan({ adds, updates, errors, fileName: file.name })
  }

  const numOr = (v, d = null) => v === '' || v == null || isNaN(Number(v)) ? d : Number(v)
  const yes = (v, d = true) => v === '' || v == null ? d : /^(y|yes|true|1)$/i.test(v)

  const run = async () => {
    setBusy(true)
    try {
      const catIds = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
      const catFor = async name => {
        if (!name) return null
        const k = name.toLowerCase()
        if (catIds.has(k)) return catIds.get(k)
        const { data, error } = await supabase.from('store_categories').insert([{ name, sort_order: catIds.size + 1 }]).select().single()
        if (error) throw new Error(`Category "${name}": ${error.message}`)
        catIds.set(k, data.id); return data.id
      }
      let done = 0
      const total = plan.adds.length + plan.updates.length
      for (const { r, match } of [...plan.updates, ...plan.adds]) {
        const row = {
          name: r.name, size: r.size || null, category_id: await catFor(r.category), sku: r.sku || null, barcode: r.barcode || null,
          price: Number(r.price), mrp: numOr(r.mrp), reorder_level: numOr(r.reorder_level, 5), unit: r.unit || 'pc',
          online_visible: yes(r.online_visible), description: r.description || null, updated_at: new Date().toISOString(),
          ...(hasCost && r.cost_price !== undefined ? { cost_price: numOr(r.cost_price) } : {}),
        }
        if (match) {
          const { error } = await supabase.from('store_products').update(row).eq('id', match.id)
          if (error) throw new Error(`${r.name}: ${error.message}`)
        } else {
          const { data, error } = await supabase.from('store_products').insert([{ ...row, active: true, stock: 0 }]).select().single()
          if (error) throw new Error(`${r.name}: ${error.message}`)
          const opening = parseInt(r.stock, 10) || 0
          if (opening > 0) await supabase.rpc('store_adjust_stock', { p_product: data.id, p_delta: opening, p_reason: 'Opening stock (CSV import)', p_by: by })
        }
        setProgress(`${++done} / ${total}`)
      }
      showToast(`✅ Imported: ${plan.adds.length} added, ${plan.updates.length} updated`)
      onDone(); onClose()
    } catch (err) {
      showToast('Import stopped: ' + err.message, '#dc2626'); onDone()
    }
    setBusy(false)
  }

  return (
    <Modal onClose={onClose} busy={busy} width={620}>
      <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 6 }}>⬆ Import products from CSV</div>
      <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.5, marginBottom: 12 }}>
        Rows are matched to existing products by <b>SKU</b>, otherwise by <b>name + size</b>. Matches are updated (stock is <i>not</i> changed — use Stock take for that); new rows are added with their <b>stock</b> as opening stock. Missing categories are created.
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} style={{ fontSize: 12.5 }} />
        <button onClick={template} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>Download template</button>
      </div>
      {plan && (
        <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, fontSize: 13 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{plan.fileName}</div>
          <div style={{ color: '#16a34a' }}>➕ {plan.adds.length} new product{plan.adds.length === 1 ? '' : 's'}</div>
          <div style={{ color: '#0e7490' }}>✏️ {plan.updates.length} update{plan.updates.length === 1 ? '' : 's'} to existing</div>
          {plan.errors.length > 0 && (
            <div style={{ color: '#b91c1c', marginTop: 6 }}>
              ⚠ {plan.errors.length} row{plan.errors.length === 1 ? '' : 's'} skipped:
              <div style={{ maxHeight: 110, overflowY: 'auto', fontSize: 11.5, marginTop: 3 }}>{plan.errors.map(e => <div key={e}>{e}</div>)}</div>
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
        <button onClick={run} disabled={busy || !plan || plan.adds.length + plan.updates.length === 0} style={{ ...btn(busy || !plan ? '#94a3b8' : NAVY), flex: 1, padding: 12, fontSize: 14 }}>{busy ? `Importing… ${progress}` : 'Import'}</button>
        <button onClick={onClose} disabled={busy} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── Barcode / price label printing (Code 128 via JsBarcode) ─────────────────
function LabelsModal({ products, onClose }) {
  const [copies, setCopies] = useState(() => Object.fromEntries(products.map(p => [p.id, p.stock > 0 ? Math.min(p.stock, 50) : 1])))
  const [q, setQ] = useState('')
  const [showPrice, setShowPrice] = useState(true)
  const shown = products.filter(p => { const s = q.trim().toLowerCase(); return !s || [p.name, p.size, p.sku, p.barcode].some(v => (v || '').toLowerCase().includes(s)) })
  const count = products.reduce((a, p) => a + (Number(copies[p.id]) || 0), 0)

  const print = () => {
    const labels = []
    products.forEach(p => {
      const code = p.barcode || p.sku || `GNSI${String(p.id).padStart(6, '0')}`
      for (let i = 0; i < (Number(copies[p.id]) || 0); i++) labels.push({ p, code })
    })
    if (!labels.length) return
    const body = `<div class="grid">${labels.map(({ p, code }) => `<div class="lb"><div class="nm">${esc(p.name)}${p.size ? ' — ' + esc(p.size) : ''}</div><svg class="bc" data-code="${esc(code)}"></svg>${showPrice ? `<div class="pr">₹${n(effPrice(p))}${p.mrp > effPrice(p) ? ` <s>MRP ₹${n(p.mrp)}</s>` : ''}</div>` : ''}</div>`).join('')}</div>
<script>window.addEventListener('load',function(){document.querySelectorAll('svg.bc').forEach(function(s){try{JsBarcode(s,s.dataset.code,{format:'CODE128',height:34,width:1.4,fontSize:11,margin:0})}catch(e){s.outerHTML='<div style="font-family:monospace">'+s.dataset.code+'</div>'}})})</script>`
    const head = `<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script><style>
.grid{display:grid;grid-template-columns:repeat(3,63mm);gap:2mm}.lb{border:1px dashed #cbd5e1;border-radius:4px;padding:2mm;height:36mm;text-align:center;overflow:hidden;break-inside:avoid;display:flex;flex-direction:column;justify-content:center;align-items:center}
.nm{font-size:10px;font-weight:700;line-height:1.2;max-height:24px;overflow:hidden}.bc{max-width:100%}.pr{font-size:13px;font-weight:900}.pr s{font-size:9px;color:#64748b;font-weight:400}
@media print{.lb{border-color:#e2e8f0}@page{margin:6mm}}</style>`
    openPrint('GNSI Store labels', body, head)
  }

  return (
    <Modal onClose={onClose} width={620}>
      <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 10 }}>🏷 Print barcode labels</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter…" style={{ ...inp, flex: 1, minWidth: 160 }} />
        <button onClick={() => setCopies(c => Object.fromEntries(Object.keys(c).map(k => [k, 0])))} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>Set all 0</button>
        <button onClick={() => setCopies(c => Object.fromEntries(Object.keys(c).map(k => [k, 1])))} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>Set all 1</button>
        <label style={{ fontSize: 12.5, fontWeight: 600, display: 'flex', gap: 5, alignItems: 'center' }}><input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} /> Price</label>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        {shown.map(p => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
            <div style={{ flex: 1 }}><b>{p.name}</b>{p.size ? ` — ${p.size}` : ''} <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: 11 }}>{p.barcode || p.sku || `GNSI${String(p.id).padStart(6, '0')}`}</span></div>
            <input type="number" min={0} max={500} value={copies[p.id] ?? 0} onChange={e => setCopies(c => ({ ...c, [p.id]: Math.max(0, Math.min(500, parseInt(e.target.value, 10) || 0)) }))} style={{ ...inp, width: 70, padding: '5px 8px' }} />
          </div>
        ))}
        {shown.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8' }}>No products</div>}
      </div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>Products without a barcode use their SKU, or an auto code like GNSI000012. 3 × 36 mm labels per row on A4.</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={print} disabled={!count} style={{ ...btn(count ? NAVY : '#94a3b8'), flex: 1, padding: 12, fontSize: 14 }}>Print {count} label{count === 1 ? '' : 's'}</button>
        <button onClick={onClose} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Close</button>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTING EDITOR — seller-style rich listing: photos, bullets, specs, preview
// ═══════════════════════════════════════════════════════════════════════════
const arr = v => Array.isArray(v) ? v : (() => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : [] } catch { return [] } })()
const SPEC_PRESETS = ['Material', 'Colour', 'Fit', 'Class / Grade', 'Publisher', 'Author', 'Pages', 'Language', 'Edition', 'Pack of', 'Dimensions', 'Weight', 'Care']

function listingScore(p) {
  const photos = (p.image_url ? 1 : 0) + arr(p.images).length
  const bullets = arr(p.bullets).filter(b => String(b).trim()).length
  const specs = arr(p.specs).filter(s => s?.k && s?.v).length
  const title = (p.name || '').trim().length
  const checks = [
    [15, !!p.image_url, 'Main photo', 'Add a clear photo on a plain background.'],
    [15, photos >= 3, '3+ photos', `Add ${Math.max(0, 3 - photos)} more — back, detail, size label.`],
    [10, title >= 15 && title <= 120, 'Descriptive title', 'Name what it is + key detail, e.g. "GNSI Track Suit – Navy, Cotton Blend".'],
    [5, !!(p.brand || '').trim(), 'Brand', 'Set the brand or publisher.'],
    [20, bullets >= 3, '3+ bullet points', `Add ${Math.max(0, 3 - bullets)} more "About this item" points.`],
    [10, (p.description || '').trim().length >= 100, 'Full description', 'Write at least 100 characters.'],
    [10, specs >= 3, '3+ specifications', `Add ${Math.max(0, 3 - specs)} more rows, e.g. Material, Colour, Pages.`],
    [5, Number(p.mrp) >= Number(p.price) && Number(p.mrp) > 0, 'M.R.P. set', 'Set M.R.P. so parents see the saving.'],
    [5, !!(p.keywords || '').trim(), 'Search keywords', 'Add words parents might search, e.g. "tracksuit sports dress".'],
    [5, !!p.online_visible, 'Visible online', 'Turn on "Show on public store".'],
  ]
  return { score: checks.reduce((a, c) => a + (c[1] ? c[0] : 0), 0), checks: checks.map(([w, ok, label, tip]) => ({ w, ok, label, tip })) }
}

// Shrinks a photo to ≤1600px JPEG before upload so pages stay fast on mobile data.
function resizeImage(file, max = 1600) {
  return new Promise(resolve => {
    if (!/^image\//.test(file.type) || file.type === 'image/gif') return resolve(file)
    const img = new Image(), url = URL.createObjectURL(file)
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s)
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob(b => resolve(b || file), 'image/jpeg', 0.86)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

function ListingEditor({ product, products, categories, onClose, onSaved, showToast }) {
  const siblings = useMemo(() => products.filter(p => p.name.trim().toLowerCase() === product.name.trim().toLowerCase() && String(p.category_id ?? '') === String(product.category_id ?? '')).sort((a, b) => String(a.size || '').localeCompare(String(b.size || ''), 'en', { numeric: true })), [products, product])
  const [f, setF] = useState(() => ({
    name: product.name || '', brand: product.brand || '', description: product.description || '', keywords: product.keywords || '',
    photos: [product.image_url, ...arr(product.images)].filter(Boolean),
    bullets: [...arr(product.bullets), '', '', '', '', ''].slice(0, 5),
    specs: arr(product.specs).length ? arr(product.specs) : [{ k: 'Material', v: '' }, { k: 'Colour', v: '' }, { k: '', v: '' }],
  }))
  const [applyAll, setApplyAll] = useState(siblings.length > 1)
  const [url, setUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState('edit') // mobile: edit | preview
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const draft = { ...product, name: f.name, brand: f.brand, description: f.description, keywords: f.keywords, image_url: f.photos[0] || null, images: f.photos.slice(1), bullets: f.bullets, specs: f.specs }
  const q = listingScore(draft)
  const catName = categories.find(c => c.id === product.category_id)?.name

  const addUrl = () => {
    const u = url.trim()
    if (!/^https?:\/\//i.test(u)) { showToast('Paste a full image link starting with https://', '#dc2626'); return }
    if (f.photos.length >= 8) { showToast('Up to 8 photos per listing.', '#d97706'); return }
    set('photos', [...f.photos, u]); setUrl('')
  }
  const upload = async e => {
    const files = [...(e.target.files || [])].slice(0, 8 - f.photos.length)
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    const added = []
    for (const file of files) {
      const blob = await resizeImage(file)
      const path = `p${product.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
      const { error } = await supabase.storage.from('store-images').upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false })
      if (error) { showToast(/bucket|not found/i.test(error.message) ? 'Photo upload is not set up — run store_listing.sql, or paste an image link.' : 'Upload failed: ' + error.message, '#dc2626'); break }
      added.push(supabase.storage.from('store-images').getPublicUrl(path).data.publicUrl)
    }
    setUploading(false)
    if (added.length) { setF(x => ({ ...x, photos: [...x.photos, ...added] })); showToast(`✅ ${added.length} photo${added.length > 1 ? 's' : ''} uploaded`) }
  }
  const movePhoto = (i, d) => setF(x => { const p = [...x.photos], j = i + d; if (j < 0 || j >= p.length) return x; [p[i], p[j]] = [p[j], p[i]]; return { ...x, photos: p } })
  const setBullet = (i, v) => setF(x => { const b = [...x.bullets]; b[i] = v.slice(0, 250); return { ...x, bullets: b } })
  const setSpec = (i, k, v) => setF(x => { const s = [...x.specs]; s[i] = { ...s[i], [k]: v }; return { ...x, specs: s } })

  const save = async () => {
    if (!f.name.trim()) { showToast('Title is required.', '#dc2626'); return }
    setSaving(true)
    const shared = {
      name: f.name.trim(), brand: f.brand.trim() || null, description: f.description.trim() || null, keywords: f.keywords.trim() || null,
      bullets: f.bullets.map(b => b.trim()).filter(Boolean), specs: f.specs.map(s => ({ k: (s.k || '').trim(), v: (s.v || '').trim() })).filter(s => s.k && s.v),
      updated_at: new Date().toISOString(),
    }
    const photos = { image_url: f.photos[0] || null, images: f.photos.slice(1) }
    const ids = applyAll ? siblings.map(s => s.id) : [product.id]
    const { error } = await supabase.from('store_products').update({ ...shared, ...photos }).in('id', ids)
    setSaving(false)
    if (error) { showToast('Save failed: ' + error.message, '#dc2626'); return }
    showToast(`✅ Listing saved${ids.length > 1 ? ` for ${ids.length} sizes` : ''} · quality ${q.score}%`)
    onSaved(); onClose()
  }

  const sec = { fontSize: 13, fontWeight: 800, color: NAVY, margin: '18px 0 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }
  const hint = { fontSize: 11, fontWeight: 500, color: '#94a3b8' }
  const price = effPrice(product), strike = price < Number(product.price) ? Number(product.price) : Number(product.mrp) || 0
  const off = strike > price ? Math.round((strike - price) / strike * 100) : 0

  return (
    <div data-store-modal="1" style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(15,23,42,.55)', display: 'flex', alignItems: 'stretch', justifyContent: 'center', padding: 12 }}>
      <div style={{ background: '#f8fafc', borderRadius: 14, width: '100%', maxWidth: 1240, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 18px', background: 'white', borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em' }}>EDIT LISTING · {catName || 'Uncategorised'}</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>{product.name}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 120, height: 8, borderRadius: 9, background: '#e2e8f0', overflow: 'hidden' }}><div style={{ width: `${q.score}%`, height: '100%', background: q.score >= 80 ? '#16a34a' : q.score >= 50 ? '#d97706' : '#dc2626', transition: 'width .3s' }} /></div>
            <b style={{ fontSize: 13, color: q.score >= 80 ? '#16a34a' : q.score >= 50 ? '#d97706' : '#dc2626' }}>Quality {q.score}%</b>
          </div>
          <div style={{ display: 'flex', gap: 6 }} className="le-tabs">
            {['edit', 'preview'].map(t => <button key={t} onClick={() => setTab(t)} style={btn(tab === t ? NAVY : '#f1f5f9', tab === t ? 'white' : '#334155')}>{t === 'edit' ? 'Edit' : 'Preview'}</button>)}
          </div>
          <button onClick={onClose} disabled={saving} style={btn('#f1f5f9', '#334155')}>Cancel</button>
          <button onClick={save} disabled={saving} style={btn('#16a34a', 'white', { padding: '9px 18px', fontSize: 13 })}>{saving ? 'Saving…' : 'Save listing'}</button>
        </div>
        <style>{`.le-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:18px}.le-tabs{display:none!important}
@media(max-width:900px){.le-grid{grid-template-columns:1fr}.le-tabs{display:flex!important}.le-grid>.le-hide{display:none}}`}</style>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          <div className="le-grid">
            {/* ── form ── */}
            <div className={tab === 'edit' ? '' : 'le-hide'}>
              <div style={{ ...card, padding: 16 }}>
                <div style={{ ...sec, marginTop: 0 }}><span>📷 Photos</span><span style={hint}>{f.photos.length}/8 · first photo is the main image</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(104px,1fr))', gap: 10 }}>
                  {f.photos.map((src, i) => (
                    <div key={src + i} style={{ position: 'relative', aspectRatio: '1', borderRadius: 10, overflow: 'hidden', border: i === 0 ? '2px solid #b8923a' : '1px solid #e2e8f0', background: '#f1f5f9' }}>
                      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {i === 0 && <span style={{ position: 'absolute', top: 5, left: 5, fontSize: 9.5, fontWeight: 800, background: '#b8923a', color: 'white', padding: '2px 6px', borderRadius: 5 }}>MAIN</span>}
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'space-between', background: 'rgba(15,23,42,.6)', padding: 3 }}>
                        <button onClick={() => movePhoto(i, -1)} disabled={i === 0} title="Move left" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 13 }}>◀</button>
                        {i > 0 && <button onClick={() => setF(x => { const p = [...x.photos]; p.unshift(p.splice(i, 1)[0]); return { ...x, photos: p } })} title="Make main" style={{ background: 'none', border: 'none', color: '#e9d9b0', cursor: 'pointer', fontSize: 12 }}>★</button>}
                        <button onClick={() => set('photos', f.photos.filter((_, k) => k !== i))} title="Remove" style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 13 }}>✕</button>
                        <button onClick={() => movePhoto(i, 1)} disabled={i === f.photos.length - 1} title="Move right" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 13 }}>▶</button>
                      </div>
                    </div>
                  ))}
                  {f.photos.length < 8 && (
                    <label style={{ aspectRatio: '1', borderRadius: 10, border: '2px dashed #cbd5e1', display: 'grid', placeItems: 'center', textAlign: 'center', cursor: uploading ? 'wait' : 'pointer', color: '#64748b', fontSize: 12, fontWeight: 700, background: 'white' }}>
                      <input type="file" accept="image/*" multiple onChange={upload} disabled={uploading} style={{ display: 'none' }} />
                      <span>{uploading ? '⏳ Uploading…' : <>＋<br />Upload</>}</span>
                    </label>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addUrl()} placeholder="…or paste an image link (https://…)" style={inp} />
                  <button onClick={addUrl} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>Add</button>
                </div>

                <div style={sec}><span>🏷️ Title &amp; brand</span><span style={hint}>{f.name.length}/120</span></div>
                <input value={f.name} maxLength={120} onChange={e => set('name', e.target.value)} placeholder="e.g. GNSI Track Suit – Navy Blue, Cotton Blend, Full Sleeve" style={{ ...inp, fontSize: 14, fontWeight: 600 }} />
                {siblings.length > 1 && f.name.trim() !== product.name.trim() && !applyAll && <div style={{ fontSize: 11.5, color: '#d97706', marginTop: 4 }}>Renaming only this size will split it from the other sizes on the shop page.</div>}
                <input value={f.brand} onChange={e => set('brand', e.target.value)} placeholder="Brand / publisher (e.g. GNSI, Arihant, Classmate)" style={{ ...inp, marginTop: 8 }} />

                <div style={sec}><span>✅ About this item</span><span style={hint}>3–5 short points · shown as bullets</span></div>
                {f.bullets.map((b, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ color: '#94a3b8', fontWeight: 800, width: 14 }}>•</span>
                    <input value={b} onChange={e => setBullet(i, e.target.value)} placeholder={['Key benefit — e.g. Soft, breathable cotton blend for all-day wear', 'Fit / size advice — e.g. Regular fit; choose one size up for growing children', 'What\'s included — e.g. Jacket + trouser with GNSI logo', 'Care — e.g. Machine wash cold, do not bleach', 'Other — e.g. Approved uniform for JNVST & Sainik batches'][i]} style={inp} />
                  </div>
                ))}

                <div style={sec}><span>📝 Description</span><span style={hint}>{f.description.length} chars · aim for 100+</span></div>
                <textarea value={f.description} onChange={e => set('description', e.target.value)} rows={5} placeholder="Describe the item for parents: what it is, who it's for, quality, and anything they should know before buying." style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />

                <div style={sec}><span>📋 Specifications</span><button onClick={() => set('specs', [...f.specs, { k: '', v: '' }])} style={btn('#f1f5f9', '#334155', { padding: '4px 10px' })}>+ Row</button></div>
                <datalist id="spec-presets">{SPEC_PRESETS.map(s => <option key={s} value={s} />)}</datalist>
                {f.specs.map((s, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr auto', gap: 6, marginBottom: 6 }}>
                    <input list="spec-presets" value={s.k} onChange={e => setSpec(i, 'k', e.target.value)} placeholder="Name (e.g. Material)" style={{ ...inp, fontWeight: 600 }} />
                    <input value={s.v} onChange={e => setSpec(i, 'v', e.target.value)} placeholder="Value (e.g. 65% cotton, 35% polyester)" style={inp} />
                    <button onClick={() => set('specs', f.specs.filter((_, k) => k !== i))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
                  </div>
                ))}

                <div style={sec}><span>🔎 Search keywords</span><span style={hint}>hidden · helps parents find it</span></div>
                <input value={f.keywords} onChange={e => set('keywords', e.target.value)} placeholder="e.g. tracksuit sports dress PT uniform winter" style={inp} />
              </div>

              {siblings.length > 1 && (
                <div style={{ ...card, padding: 16, marginTop: 14 }}>
                  <div style={{ ...sec, marginTop: 0 }}><span>🧩 Variations ({siblings.length} sizes)</span></div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead><tr style={{ background: '#f8fafc' }}>{['Size', 'SKU', 'Price', 'Stock', 'Online'].map(h => <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: '#475569' }}>{h}</th>)}</tr></thead>
                    <tbody>{siblings.map(s => (
                      <tr key={s.id} style={{ borderTop: '1px solid #f1f5f9', background: s.id === product.id ? '#fbf6ea' : 'white' }}>
                        <td style={{ padding: '6px 8px', fontWeight: 700 }}>{s.size || '—'}</td>
                        <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#64748b' }}>{s.sku || '—'}</td>
                        <td style={{ padding: '6px 8px' }}>₹{n(effPrice(s))}</td>
                        <td style={{ padding: '6px 8px', fontWeight: 700, color: s.stock <= 0 ? '#dc2626' : s.stock <= (s.reorder_level ?? 5) ? '#d97706' : '#16a34a' }}>{s.stock}</td>
                        <td style={{ padding: '6px 8px' }}>{s.online_visible ? '🌐' : '—'}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600, marginTop: 10 }}>
                    <input type="checkbox" checked={applyAll} onChange={e => setApplyAll(e.target.checked)} /> Use this listing (title, photos, bullets, specs) for all {siblings.length} sizes
                  </label>
                  <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 4 }}>Prices, stock and SKUs stay per size — edit those in the product row.</div>
                </div>
              )}
            </div>

            {/* ── preview + quality ── */}
            <div className={tab === 'preview' ? '' : 'le-hide'}>
              <div style={{ position: 'sticky', top: 0, display: 'grid', gap: 14 }}>
                <div style={{ ...card, padding: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 10 }}>📈 Listing quality</div>
                  {q.checks.map(c => (
                    <div key={c.label} style={{ display: 'flex', gap: 9, padding: '5px 0', fontSize: 12.5, alignItems: 'flex-start' }}>
                      <span style={{ width: 18, height: 18, borderRadius: 99, flex: 'none', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 900, background: c.ok ? '#dcfce7' : '#fef3c7', color: c.ok ? '#16a34a' : '#b45309' }}>{c.ok ? '✓' : '!'}</span>
                      <div style={{ flex: 1 }}><b style={{ color: c.ok ? '#334155' : '#0f172a' }}>{c.label}</b>{!c.ok && <div style={{ color: '#64748b', fontSize: 11.5 }}>{c.tip}</div>}</div>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>+{c.w}</span>
                    </div>
                  ))}
                </div>

                <div style={{ ...card, padding: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.06em', marginBottom: 10 }}>PREVIEW · SEARCH RESULT</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ width: 110, height: 110, flex: 'none', borderRadius: 10, background: '#f3efe6', overflow: 'hidden', display: 'grid', placeItems: 'center', fontSize: 34 }}>{f.photos[0] ? <img src={f.photos[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{f.name || 'Product title'}</div>
                      {f.brand && <div style={{ fontSize: 11.5, color: '#64748b' }}>by {f.brand}</div>}
                      <div style={{ marginTop: 4 }}>{off > 0 && <span style={{ fontSize: 13, color: '#c2410c', fontWeight: 700, marginRight: 6 }}>−{off}%</span>}<b style={{ fontSize: 19 }}>₹{n(price)}</b>{strike > price && <span style={{ fontSize: 11.5, color: '#94a3b8', marginLeft: 6 }}>M.R.P. <s>₹{n(strike)}</s></span>}</div>
                      <div style={{ fontSize: 11.5, color: '#15803d', fontWeight: 600, marginTop: 2 }}>FREE pickup at campus</div>
                      {siblings.length > 1 && <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>{siblings.map(s => <span key={s.id} style={{ fontSize: 10.5, fontWeight: 700, border: '1px solid #e2e8f0', borderRadius: 5, padding: '1px 6px' }}>{s.size}</span>)}</div>}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', letterSpacing: '.06em', margin: '16px 0 8px' }}>PREVIEW · PRODUCT PAGE</div>
                  {f.photos.length > 1 && <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>{f.photos.slice(0, 6).map((s, i) => <img key={i} src={s} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: i === 0 ? '2px solid #b8923a' : '1px solid #e2e8f0' }} />)}</div>}
                  <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>About this item</div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#334155', lineHeight: 1.55 }}>
                    {f.bullets.filter(b => b.trim()).length ? f.bullets.filter(b => b.trim()).map((b, i) => <li key={i}>{b}</li>) : <li style={{ color: '#cbd5e1' }}>Your bullet points appear here</li>}
                  </ul>
                  {f.specs.some(s => s.k && s.v) && (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 10 }}>
                      <tbody>{f.specs.filter(s => s.k && s.v).map((s, i) => <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}><td style={{ padding: '5px 6px', fontWeight: 700, background: '#f8fafc', width: '40%' }}>{s.k}</td><td style={{ padding: '5px 6px' }}>{s.v}</td></tr>)}</tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Stock take: physical count → variance → one-click adjustments ──────────
function StockTakeModal({ products, categories, by, onClose, onDone, showToast }) {
  const [cat, setCat] = useState('All')
  const [counts, setCounts] = useState({})
  const [busy, setBusy] = useState(false)
  const list = products.filter(p => p.active && (cat === 'All' || String(p.category_id) === String(cat)))
  const diffs = list.filter(p => counts[p.id] !== undefined && counts[p.id] !== '' && Number(counts[p.id]) !== p.stock)
    .map(p => ({ p, delta: Number(counts[p.id]) - p.stock }))
  const valueDelta = diffs.reduce((a, d) => a + d.delta * Number(d.p.cost_price ?? d.p.price), 0)
  const counted = list.filter(p => counts[p.id] !== undefined && counts[p.id] !== '').length

  const printSheet = () => openPrint('Stock count sheet', `${HEADER_HTML('Stock count sheet · ' + todayStr())}
<table><thead><tr><th>#</th><th>Product</th><th>SKU / Barcode</th><th class="r">System</th><th class="r" style="width:90px">Counted</th></tr></thead><tbody>
${list.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.name)}${p.size ? ' — ' + esc(p.size) : ''}</td><td>${esc(p.sku || '')} ${esc(p.barcode || '')}</td><td class="r">${p.stock}</td><td></td></tr>`).join('')}
</tbody></table><div class="s" style="margin-top:14px">Counted by: ____________________ &nbsp;&nbsp; Verified by: ____________________</div>`)

  const apply = async () => {
    if (!diffs.length) return
    if (!window.confirm(`Apply ${diffs.length} stock adjustment${diffs.length > 1 ? 's' : ''}?`)) return
    setBusy(true)
    let ok = 0
    for (const d of diffs) {
      const { error } = await supabase.rpc('store_adjust_stock', { p_product: d.p.id, p_delta: d.delta, p_reason: `Stock take ${todayStr()}`, p_by: by })
      if (error) { showToast(`Stopped at ${d.p.name}: ${error.message}`, '#dc2626'); break }
      ok++
    }
    setBusy(false)
    if (ok === diffs.length) { showToast(`✅ Stock take applied — ${ok} item${ok > 1 ? 's' : ''} adjusted`); onDone(); onClose() }
    else onDone()
  }

  return (
    <Modal onClose={onClose} busy={busy} width={720}>
      <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 10 }}>📋 Stock take</div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <select value={cat} onChange={e => setCat(e.target.value)} style={{ ...inp, width: 'auto' }}>
          <option value="All">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={printSheet} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>🖨 Print count sheet</button>
        <button onClick={() => setCounts(c => ({ ...c, ...Object.fromEntries(list.map(p => [p.id, String(p.stock)])) }))} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>Fill with system qty</button>
      </div>
      <div style={{ maxHeight: 380, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>{['Product', 'System', 'Counted', 'Variance'].map(h => <th key={h} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 11, color: '#475569' }}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map(p => {
              const c = counts[p.id], has = c !== undefined && c !== '', d = has ? Number(c) - p.stock : 0
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #f1f5f9', background: has && d !== 0 ? (d < 0 ? '#fef2f2' : '#f0fdf4') : 'white' }}>
                  <td style={{ padding: '6px 10px' }}><b>{p.name}</b>{p.size ? ` — ${p.size}` : ''}</td>
                  <td style={{ padding: '6px 10px' }}>{p.stock}</td>
                  <td style={{ padding: '4px 10px' }}><input type="number" min={0} value={c ?? ''} onChange={e => setCounts(x => ({ ...x, [p.id]: e.target.value }))} style={{ ...inp, width: 80, padding: '5px 8px' }} /></td>
                  <td style={{ padding: '6px 10px', fontWeight: 800, color: !has || d === 0 ? '#94a3b8' : d < 0 ? '#dc2626' : '#16a34a' }}>{!has ? '' : d === 0 ? '✓' : (d > 0 ? '+' : '') + d}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 10, color: '#475569', flexWrap: 'wrap', gap: 6 }}>
        <span>Counted {counted} / {list.length} · {diffs.length} with variance</span>
        <span style={{ fontWeight: 800, color: valueDelta < 0 ? '#dc2626' : '#16a34a' }}>Value impact ₹{n(Math.round(valueDelta))}</span>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={apply} disabled={busy || !diffs.length} style={{ ...btn(busy || !diffs.length ? '#94a3b8' : NAVY), flex: 1, padding: 12, fontSize: 14 }}>{busy ? 'Applying…' : `Apply ${diffs.length} adjustment${diffs.length === 1 ? '' : 's'}`}</button>
        <button onClick={onClose} disabled={busy} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Cancel</button>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS TAB (online orders from the public storefront)
// ═══════════════════════════════════════════════════════════════════════════
const pickupOf = note => (String(note || '').match(/Pickup:\s*([^\n|]+)/) || [])[1]?.trim()
const ORDER_COLS = [['new', 'New', '#1d4ed8'], ['confirmed', 'Confirmed · packing', '#a16207'], ['ready', 'Ready for pickup', '#166534']]

// Pick list = everything to pull from the shelves for the chosen orders, totalled per item.
function printPickList(list) {
  const agg = new Map()
  list.forEach(o => (o.items || []).forEach(i => {
    const k = `${i.product_id}|${i.size || ''}`
    const a = agg.get(k) || { name: i.name, size: i.size, qty: 0, orders: [] }
    a.qty += Number(i.qty) || 0; a.orders.push(`${o.order_no}×${i.qty}`); agg.set(k, a)
  }))
  const rows = [...agg.values()].sort((a, b) => a.name.localeCompare(b.name))
  openPrint('Pick list', `${HEADER_HTML('Pick list · ' + new Date().toLocaleString('en-IN'))}
<div class="s" style="margin-top:6px">${list.length} order${list.length > 1 ? 's' : ''}: ${list.map(o => esc(o.order_no)).join(', ')}</div>
<table><thead><tr><th style="width:28px">✓</th><th>Item</th><th class="r">Total qty</th><th>Orders</th></tr></thead><tbody>
${rows.map(r => `<tr><td>☐</td><td><b>${esc(r.name)}</b>${r.size ? ' — ' + esc(r.size) : ''}</td><td class="r b">${r.qty}</td><td class="s">${r.orders.map(esc).join(', ')}</td></tr>`).join('')}
</tbody></table><div class="s" style="margin-top:18px">Picked by ____________________ &nbsp; Checked by ____________________</div>`)
}
function printPackingSlips(list) {
  openPrint('Packing slips', list.map((o, k) => `<div style="${k ? 'page-break-before:always;' : ''}padding-top:4px">${HEADER_HTML('Packing slip')}
<table style="margin-top:10px"><tr><td>Order <b style="font-size:16px">${esc(o.order_no)}</b></td><td>${esc(new Date(o.created_at).toLocaleString('en-IN'))}</td></tr>
<tr><td>${esc(o.customer_name)} · ${esc(o.phone)}${o.gcc_no ? ' · GCC-' + esc(o.gcc_no) : ''}</td><td>${pickupOf(o.note) ? 'Pickup: ' + esc(pickupOf(o.note)) : ''}</td></tr></table>
<table><thead><tr><th>☐</th><th>Item</th><th class="r">Qty</th><th class="r">Amount</th></tr></thead><tbody>
${(o.items || []).map(i => `<tr><td>☐</td><td>${esc(i.name)}${i.size ? ' — ' + esc(i.size) : ''}</td><td class="r">${i.qty}</td><td class="r">₹${n(i.price * i.qty)}</td></tr>`).join('')}
<tr><td colspan="3" class="b">To collect at pickup</td><td class="r b">₹${n(o.total)}</td></tr></tbody></table>
${o.note ? `<div class="s" style="margin-top:6px">Note: ${esc(o.note)}</div>` : ''}</div>`).join(''))
}

function OrdersTab({ currentUser, showToast, onSaleDone, liveTick }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState('open')
  const [busy, setBusy] = useState(null)
  const [payModes, setPayModes] = useState({})
  const [view, setView] = useState(() => { try { return localStorage.getItem('gnsi_orders_view') || 'list' } catch { return 'list' } })
  const [picked, setPicked] = useState(() => new Set())
  const [dragId, setDragId] = useState(null)
  const [dropCol, setDropCol] = useState(null)

  const load = useCallback(async (quiet) => {
    if (!quiet) setLoading(true)
    const { data, error } = await supabase.from('store_orders').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) showToast('Could not load orders: ' + error.message, '#dc2626')
    setOrders(data || [])
    setLoading(false)
  }, [showToast])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (liveTick) load(true) }, [liveTick, load])
  useEffect(() => { try { localStorage.setItem('gnsi_orders_view', view) } catch {} }, [view])

  const togglePick = id => setPicked(p => { const x = new Set(p); x.has(id) ? x.delete(id) : x.add(id); return x })
  const pickedOrders = orders.filter(o => picked.has(o.id))
  const bulkStatus = async status => {
    const ids = pickedOrders.filter(o => ['new', 'confirmed', 'ready'].includes(o.status) && o.status !== status).map(o => o.id)
    if (!ids.length) { showToast('Nothing to change for the selected orders.', '#d97706'); return }
    const { error } = await supabase.from('store_orders').update({ status, updated_at: new Date().toISOString() }).in('id', ids)
    if (error) { showToast('Update failed: ' + error.message, '#dc2626'); return }
    showToast(`✅ ${ids.length} order${ids.length > 1 ? 's' : ''} marked ${status}`); setPicked(new Set()); load(true)
  }

  const [find, setFind] = useState('')
  const [hit, setHit] = useState(null)
  const fq = find.trim().toLowerCase()
  const shown = orders.filter(o => {
    if (fq) return [o.order_no, o.customer_name, o.phone, o.gcc_no].some(v => String(v || '').toLowerCase().includes(fq))
    return statusF === 'all' ? true : statusF === 'open' ? ['new', 'confirmed', 'ready'].includes(o.status) : o.status === statusF
  })

  // Pickup pass QR = the order number. A scanner types it + Enter.
  const onFindKey = e => {
    if (e.key !== 'Enter' || !fq) return
    const o = orders.find(x => String(x.order_no || '').toLowerCase() === fq)
    if (!o) { showToast(`No order ${find.trim()}`, '#dc2626'); return }
    setHit(o.id)
    setTimeout(() => document.getElementById(`order-${o.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    if (o.status === 'cancelled') showToast(`${o.order_no} was cancelled`, '#dc2626')
    else if (o.status === 'delivered') showToast(`${o.order_no} was already collected`, '#d97706')
    else showToast(`${o.order_no} · ${o.customer_name} · ₹${n(o.total)}`, '#0e7490')
  }

  // Pre-written WhatsApp update for the customer, matched to the order's status.
  const waMessage = o => {
    const items = (o.items || []).map(i => `• ${i.name}${i.size ? ' (' + i.size + ')' : ''} × ${i.qty}`).join('\n')
    const hi = `Dear ${o.customer_name || 'Parent'},\n\n`
    const sign = '\n\n— GNSI Store, Guidance Navodaya & Sainik Institute, Khangabok'
    switch (o.status) {
      case 'new': return `${hi}We have received your GNSI Store order *${o.order_no}*:\n${items}\n\nTotal: ₹${n(o.total)}. We will confirm it shortly.${sign}`
      case 'confirmed': return `${hi}Your GNSI Store order *${o.order_no}* is confirmed and being packed:\n${items}\n\nTotal: ₹${n(o.total)}. We will message you when it is ready.${sign}`
      case 'ready': return `${hi}Good news — your order *${o.order_no}* is *ready for pickup* at the institute counter.\n${items}\n\nAmount payable: *₹${n(o.total)}* (Cash / UPI / Card). Please quote ${o.order_no} when collecting.${sign}`
      case 'delivered': return `${hi}Thank you for collecting order *${o.order_no}*. We hope everything is right — reply here if anything needs changing.${sign}`
      case 'cancelled': return `${hi}Your GNSI Store order *${o.order_no}* has been cancelled. Please contact the institute office if this was not expected.${sign}`
      default: return `${hi}Update on your order ${o.order_no}.${sign}`
    }
  }

  const setStatus = async (o, status) => {
    setBusy(o.id)
    const { error } = await supabase.from('store_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', o.id)
    if (error) showToast('Update failed: ' + error.message, '#dc2626'); else load()
    setBusy(null)
  }

  const fulfil = async o => {
    const by = currentUser?.userName || currentUser?.name || ''
    if (!by) { showToast('Your staff name is missing from the session.', '#dc2626'); return }
    const mode = payModes[o.id] || 'Cash'
    let ref = ''
    if (mode !== 'Cash') { ref = window.prompt(`Transaction reference for ${mode} payment:`) || ''; if (!ref.trim()) { showToast('Transaction reference required.', '#dc2626'); return } }
    setBusy(o.id)
    try {
      const { data, error } = await supabase.rpc('store_create_sale', { p: {
        sale_date: todayStr(), customer_type: o.gcc_no ? 'student' : 'walkin', gcc_no: o.gcc_no,
        customer_name: o.customer_name, phone: o.phone, discount: 0, pay_mode: mode, txn_ref: ref,
        amount_paid: o.total, collected_by: by, source: 'online', order_id: o.id,
        items: (o.items || []).map(i => ({ product_id: i.product_id, qty: i.qty })),
      } })
      if (error) throw new Error(error.message)
      const posted = await postToAccounts({ amount: Number(data.amount_paid), date: data.sale_date, desc: `Store order ${o.order_no} (${data.bill_no}) — ${o.customer_name}`, ref: `store_${data.bill_no}_pay0` })
      if (posted) await supabase.from('store_sales').update({ account_posted: true }).eq('id', data.id)
      else showToast('Billed, but posting to Accounts failed — check accounts columns.', '#d97706')
      printBill(data); showToast(`✅ ${o.order_no} billed as ${data.bill_no}`); load(); onSaleDone()
    } catch (err) {
      showToast('Could not bill order: ' + err.message, '#dc2626')
    }
    setBusy(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <input autoFocus value={find} onChange={e => { setFind(e.target.value); setHit(null) }} onKeyDown={onFindKey}
          placeholder="📷 Scan pickup pass — or type order no, name, phone" style={{ ...inp, flex: 1, padding: '11px 14px', fontSize: 14, borderColor: '#93c5fd' }} />
        {find && <button onClick={() => { setFind(''); setHit(null) }} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>Clear</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: 9, overflow: 'hidden' }}>
          {[['list', '☰ List'], ['board', '▦ Board']].map(([v, l]) => <button key={v} onClick={() => setView(v)} style={{ padding: '6px 12px', border: 'none', background: view === v ? NAVY : 'white', color: view === v ? 'white' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{l}</button>)}
        </div>
        {view === 'board' && <button onClick={() => load()} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>↻ Refresh</button>}
      </div>
      {picked.size > 0 && (
        <div style={{ position: 'sticky', top: 8, zIndex: 20, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', background: NAVY, color: 'white', borderRadius: 10, padding: '9px 12px', marginBottom: 12, boxShadow: '0 6px 20px rgba(15,23,42,.2)' }}>
          <b style={{ fontSize: 13 }}>{picked.size} selected</b>
          <button onClick={() => bulkStatus('confirmed')} style={btn('rgba(255,255,255,.12)', 'white')}>Mark confirmed</button>
          <button onClick={() => bulkStatus('ready')} style={btn('rgba(255,255,255,.12)', 'white')}>Mark ready</button>
          <button onClick={() => printPickList(pickedOrders)} style={btn('#b8923a', '#132a4f')}>🧺 Pick list</button>
          <button onClick={() => printPackingSlips(pickedOrders)} style={btn('rgba(255,255,255,.12)', 'white')}>📦 Packing slips</button>
          <button onClick={() => setPicked(new Set())} style={{ ...btn('transparent', 'rgba(255,255,255,.7)'), marginLeft: 'auto' }}>Clear</button>
        </div>
      )}
      {view === 'board' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12, alignItems: 'start' }}>
          {ORDER_COLS.map(([st, label, color]) => {
            const col = orders.filter(o => o.status === st && (!fq || [o.order_no, o.customer_name, o.phone, o.gcc_no].some(v => String(v || '').toLowerCase().includes(fq))))
            return (
              <div key={st} onDragOver={e => { e.preventDefault(); setDropCol(st) }} onDragLeave={() => setDropCol(c => c === st ? null : c)}
                onDrop={e => { e.preventDefault(); setDropCol(null); const o = orders.find(x => x.id === dragId); if (o && o.status !== st) setStatus(o, st) }}
                style={{ background: dropCol === st ? '#eff6ff' : '#f8fafc', border: `1.5px ${dropCol === st ? 'dashed' : 'solid'} ${dropCol === st ? color : '#e2e8f0'}`, borderRadius: 12, padding: 10, minHeight: 160 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <b style={{ fontSize: 13, color }}>{label}</b>
                  <span style={{ fontSize: 11, fontWeight: 800, background: 'white', border: '1px solid #e2e8f0', borderRadius: 99, padding: '1px 8px' }}>{col.length} · ₹{n(col.reduce((a, o) => a + Number(o.total), 0))}</span>
                </div>
                {col.map(o => (
                  <div key={o.id} draggable onDragStart={() => setDragId(o.id)} onDragEnd={() => setDragId(null)}
                    style={{ ...card, padding: 10, marginBottom: 8, cursor: 'grab', opacity: dragId === o.id ? .5 : 1, borderLeft: `3px solid ${color}`, ...(hit === o.id ? { boxShadow: '0 0 0 3px rgba(184,146,58,.35)' } : {}) }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 800, fontSize: 13, color: NAVY }}><input type="checkbox" checked={picked.has(o.id)} onChange={() => togglePick(o.id)} />{o.order_no}</label>
                      <b style={{ fontSize: 13 }}>₹{n(o.total)}</b>
                    </div>
                    <div style={{ fontSize: 12, color: '#334155', marginTop: 2 }}>{o.customer_name} · {o.phone}</div>
                    <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 3 }}>{(o.items || []).map(i => `${i.name}${i.size ? ' ' + i.size : ''} ×${i.qty}`).join(', ')}</div>
                    {pickupOf(o.note) && <div style={{ fontSize: 11, fontWeight: 700, color: '#0e7490', marginTop: 4 }}>🕒 {pickupOf(o.note)}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                      {ORDER_FLOW[o.status] && <button disabled={busy === o.id} onClick={() => setStatus(o, ORDER_FLOW[o.status])} style={btn('#eff6ff', NAVY, { padding: '4px 9px', fontSize: 11 })}>→ {ORDER_FLOW[o.status]}</button>}
                      {o.status === 'ready' && <button disabled={busy === o.id} onClick={() => fulfil(o)} style={btn('#16a34a', 'white', { padding: '4px 9px', fontSize: 11 })}>Bill {PAY_MODES.includes(payModes[o.id]) ? payModes[o.id] : 'Cash'}</button>}
                      {o.phone && <a href={waLink(o.phone, waMessage(o))} target="_blank" rel="noopener noreferrer" style={{ ...btn('#f0fdf4', '#15803d', { padding: '4px 9px', fontSize: 11 }), textDecoration: 'none', marginLeft: 'auto' }}>💬</a>}
                    </div>
                  </div>
                ))}
                {col.length === 0 && <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', padding: 20 }}>Drag orders here</div>}
              </div>
            )
          })}
        </div>
      ) : <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', opacity: fq ? .45 : 1 }}>
        {[['open', 'Open'], ['new', 'New'], ['confirmed', 'Confirmed'], ['ready', 'Ready'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([id, label]) => (
          <button key={id} onClick={() => setStatusF(id)}
            style={{ padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${statusF === id ? NAVY : '#e2e8f0'}`, background: statusF === id ? NAVY : 'white', color: statusF === id ? 'white' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
        ))}
        <button onClick={() => load()} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>↻ Refresh</button>
        {shown.some(o => ['new', 'confirmed', 'ready'].includes(o.status)) && <button onClick={() => setPicked(new Set(shown.filter(o => ['new', 'confirmed', 'ready'].includes(o.status)).map(o => o.id)))} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>☑ Select all open</button>}
      </div>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div> : shown.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No orders here</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(o => {
            const [bg, fg] = ORDER_COLORS[o.status] || ORDER_COLORS.delivered
            const active = ['new', 'confirmed', 'ready'].includes(o.status)
            return (
              <div key={o.id} id={`order-${o.id}`} style={{ ...card, padding: 14, ...(hit === o.id ? { borderColor: '#b8923a', boxShadow: '0 0 0 3px rgba(184,146,58,.25)' } : {}) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: NAVY, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>{active && <input type="checkbox" checked={picked.has(o.id)} onChange={() => togglePick(o.id)} aria-label="Select order" />}{o.order_no} <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: bg, color: fg }}>{o.status.toUpperCase()}</span></div>
                    <div style={{ fontSize: 12.5, color: '#334155', marginTop: 3 }}>{o.customer_name} · <a href={`tel:${o.phone}`} style={{ color: NAVY }}>{o.phone}</a>{o.gcc_no ? ` · GCC-${o.gcc_no}` : ''}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}{pickupOf(o.note) && <span style={{ marginLeft: 8, fontWeight: 700, color: '#0e7490' }}>🕒 Pickup {pickupOf(o.note)}</span>}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>₹{n(o.total)}</div>
                    {o.phone && (
                      <a href={waLink(o.phone, waMessage(o))} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-block', marginTop: 4, fontSize: 11.5, fontWeight: 700, color: '#15803d', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 7, padding: '4px 10px', textDecoration: 'none' }}>
                        💬 WhatsApp update
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 12.5, color: '#475569' }}>
                  {(o.items || []).map((i, idx) => <div key={idx}>• {i.name}{i.size ? ` — ${i.size}` : ''} × {i.qty} = ₹{n(i.price * i.qty)}</div>)}
                </div>
                {o.note && <div style={{ marginTop: 6, fontSize: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 9px', color: '#92400e' }}>📝 {o.note}</div>}
                {active && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {ORDER_FLOW[o.status] && <button disabled={busy === o.id} onClick={() => setStatus(o, ORDER_FLOW[o.status])} style={btn('#eff6ff', NAVY)}>Mark {ORDER_FLOW[o.status]}</button>}
                    <select value={payModes[o.id] || 'Cash'} onChange={e => setPayModes(m => ({ ...m, [o.id]: e.target.value }))} style={{ ...inp, width: 'auto', padding: '7px 10px' }}>
                      {PAY_MODES.map(m => <option key={m}>{m}</option>)}
                    </select>
                    <button disabled={busy === o.id} onClick={() => fulfil(o)} style={btn('#16a34a')}>{busy === o.id ? 'Working…' : 'Collect payment & bill'}</button>
                    <button disabled={busy === o.id} onClick={() => window.confirm('Cancel this order?') && setStatus(o, 'cancelled')} style={btn('#fef2f2', '#dc2626', { marginLeft: 'auto' })}>Cancel</button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// SALES TAB
// ═══════════════════════════════════════════════════════════════════════════
function SalesTab({ isAdmin, currentUser, showToast, onSaleDone, refreshKey }) {
  const [from, setFrom] = useState(todayStr())
  const [to, setTo] = useState(todayStr())
  const [search, setSearch] = useState('')
  const [statusF, setStatusF] = useState('All')
  const [sales, setSales] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(null)
  const [hasReturns, setHasReturns] = useState(true)
  const [returning, setReturning] = useState(null)
  const [dayClose, setDayClose] = useState(false)
  const by = currentUser?.userName || currentUser?.name || 'Admin'

  const load = useCallback(async () => {
    setLoading(true)
    const q = sel => supabase.from('store_sales').select(sel)
      .gte('sale_date', from || '2000-01-01').lte('sale_date', to || '2100-01-01')
      .order('created_at', { ascending: false }).limit(1000)
    let res = await q('*, store_sale_items(*), store_returns(*, store_return_items(*))')
    if (res.error && isMissingTable(res.error)) { setHasReturns(false); res = await q('*, store_sale_items(*)') }
    else if (!res.error) setHasReturns(true)
    if (res.error) showToast('Could not load sales: ' + res.error.message, '#dc2626')
    setSales(res.data || [])
    setLoading(false)
  }, [from, to, showToast])
  useEffect(() => { load() }, [load, refreshKey])

  const refundedOf = s => (s.store_returns || []).reduce((a, r) => a + Number(r.refund), 0)

  const exportCSV = () => {
    const headers = ['bill_no', 'date', 'source', 'customer', 'gcc_no', 'phone', 'items', 'subtotal', 'discount', 'total', 'paid', 'due', 'refunded', 'pay_mode', 'txn_ref', 'status', 'collected_by']
    const data = shown.map(s => [s.bill_no, s.sale_date, s.source || 'counter', s.customer_name || 'Walk-in', s.gcc_no, s.phone,
      (s.store_sale_items || []).map(i => `${i.name}${i.size ? ' ' + i.size : ''} x${i.qty}`).join('; '),
      s.subtotal, s.discount, s.total, s.amount_paid, s.due_amount, refundedOf(s), s.pay_mode, s.txn_ref, s.status, s.collected_by])
    downloadFile(`gnsi-store-sales-${from}-to-${to}.csv`, toCSV(headers, data))
  }

  const shown = sales.filter(s => {
    if (statusF !== 'All' && s.status !== statusF) return false
    const q = search.trim().toLowerCase()
    return !q || [s.bill_no, s.customer_name, s.gcc_no, s.phone].some(v => (v || '').toString().toLowerCase().includes(q))
  })
  const live = shown.filter(s => s.status !== 'void')
  const totals = { revenue: live.reduce((a, s) => a + Number(s.total), 0), paid: live.reduce((a, s) => a + Number(s.amount_paid), 0), due: live.reduce((a, s) => a + Number(s.due_amount), 0), refunded: live.reduce((a, s) => a + refundedOf(s), 0) }

  const receiveDue = async s => {
    const raw = window.prompt(`Receive payment for ${s.bill_no} (due ₹${n(s.due_amount)}).\nAmount:`, String(s.due_amount))
    if (raw === null) return
    const amt = Number(raw)
    if (!(amt > 0) || amt > Number(s.due_amount)) { showToast('Enter an amount between 1 and the due amount.', '#dc2626'); return }
    const mode = window.prompt('Payment mode (Cash / UPI / Card / Bank Transfer / Cheque):', 'Cash') || 'Cash'
    if (mode !== 'Cash' && !(window.prompt(`Transaction reference for ${mode}:`) || '').trim()) { showToast('Transaction reference required.', '#dc2626'); return }
    const newPaid = Number(s.amount_paid) + amt, newDue = Number(s.due_amount) - amt
    const { error } = await supabase.from('store_sales').update({ amount_paid: newPaid, due_amount: newDue, status: newDue > 0 ? 'due' : 'paid' }).eq('id', s.id).eq('status', 'due')
    if (error) { showToast('Update failed: ' + error.message, '#dc2626'); return }
    const posted = await postToAccounts({ amount: amt, date: todayStr(), desc: `Store due received ${s.bill_no} — ${s.customer_name || ''}`, ref: `store_${s.bill_no}_due_${Date.now()}` })
    if (!posted) showToast('Saved, but posting to Accounts failed.', '#d97706'); else showToast(`✅ ₹${n(amt)} received`)
    load(); onSaleDone()
  }

  const voidSale = async s => {
    const reason = window.prompt(`Void ${s.bill_no} (₹${n(s.total)})? Stock will be restored.\nReason:`)
    if (reason === null) return
    if (!reason.trim()) { showToast('A reason is required to void a bill.', '#dc2626'); return }
    const { error } = await supabase.rpc('store_void_sale', { p_sale: s.id, p_reason: reason.trim(), p_by: by })
    if (error) { showToast('Void failed: ' + error.message, '#dc2626'); return }
    await softDeleteAccounts(`store_${s.bill_no}_`)
    showToast(`↩️ ${s.bill_no} voided`, '#dc2626'); load(); onSaleDone()
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div><label style={lbl}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: 150 }} /></div>
        <div><label style={lbl}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: 150 }} /></div>
        <div><label style={lbl}>Status</label><select value={statusF} onChange={e => setStatusF(e.target.value)} style={{ ...inp, width: 120 }}><option>All</option><option value="paid">Paid</option><option value="due">Due</option><option value="void">Void</option></select></div>
        <div style={{ flex: 1, minWidth: 180 }}><label style={lbl}>Search</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Bill no, name, GCC, phone" style={inp} /></div>
        <button onClick={() => { setFrom(todayStr()); setTo(todayStr()) }} style={btn('#eff6ff', NAVY)}>Today</button>
        <button onClick={exportCSV} disabled={!shown.length} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>⬇ CSV</button>
        <button onClick={() => setDayClose(true)} style={btn('#0f766e')}>🧮 Day close</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
        {[['Bills', live.length, NAVY, '#eff6ff'], ['Sales value', `₹${n(totals.revenue)}`, '#16a34a', '#f0fdf4'], ['Received', `₹${n(totals.paid)}`, '#0e7490', '#ecfeff'], ['Outstanding', `₹${n(totals.due)}`, '#dc2626', '#fef2f2'], ...(totals.refunded > 0 ? [['Refunded', `₹${n(totals.refunded)}`, '#9333ea', '#faf5ff']] : [])].map(([l, v, c, bg]) => (
          <div key={l} style={{ background: bg, borderRadius: 10, padding: '11px 14px', borderLeft: `4px solid ${c}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: c }}>{l}</div><div style={{ fontSize: 19, fontWeight: 900, color: c }}>{v}</div>
          </div>
        ))}
      </div>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div> : (
        <div style={{ ...card, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 820 }}>
            <thead><tr style={{ background: NAVY }}>{['Bill', 'Date', 'Customer', 'Items', 'Total', 'Paid', 'Due', 'Mode', 'Status', ''].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'white', fontSize: 11, fontWeight: 700 }}>{h}</th>)}</tr></thead>
            <tbody>
              {shown.map(s => {
                const items = s.store_sale_items || []
                const isOpen = open === s.id
                const stC = s.status === 'paid' ? ['#dcfce7', '#16a34a'] : s.status === 'due' ? ['#ffedd5', '#c2410c'] : ['#f1f5f9', '#64748b']
                return [
                  <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: s.status === 'void' ? .55 : 1, cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : s.id)}>
                    <td style={{ padding: '9px 12px', fontFamily: 'monospace', fontWeight: 700, color: NAVY, fontSize: 12 }}>{s.bill_no}{s.source === 'online' && ' 🌐'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{s.sale_date}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{s.customer_name || 'Walk-in'}{s.gcc_no && <span style={{ color: '#94a3b8', fontWeight: 400 }}> · GCC-{s.gcc_no}</span>}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b' }}>{items.reduce((a, i) => a + i.qty, 0)}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 800 }}>₹{n(s.total)}</td>
                    <td style={{ padding: '9px 12px', color: '#16a34a', fontWeight: 700 }}>₹{n(s.amount_paid)}</td>
                    <td style={{ padding: '9px 12px', color: Number(s.due_amount) > 0 ? '#dc2626' : '#94a3b8', fontWeight: 700 }}>{Number(s.due_amount) > 0 ? `₹${n(s.due_amount)}` : '—'}</td>
                    <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{s.pay_mode || '—'}</td>
                    <td style={{ padding: '9px 12px' }}><span style={{ fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: stC[0], color: stC[1] }}>{s.status.toUpperCase()}</span></td>
                    <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => printBill(s)} style={btn('#f1f5f9', '#334155', { padding: '4px 9px', marginRight: 5 })}>🖨</button>
                      {s.status === 'due' && <button onClick={() => receiveDue(s)} style={btn('#16a34a', 'white', { padding: '4px 9px', marginRight: 5 })}>Receive</button>}
                      {isAdmin && hasReturns && s.status === 'paid' && <button onClick={() => setReturning(s)} style={btn('#faf5ff', '#9333ea', { padding: '4px 9px', marginRight: 5 })}>↩ Return</button>}
                      {isAdmin && s.status !== 'void' && !(s.store_returns || []).length && <button onClick={() => voidSale(s)} style={btn('#fef2f2', '#dc2626', { padding: '4px 9px' })}>Void</button>}
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={s.id + 'd'} style={{ background: '#f8fafc' }}>
                      <td colSpan={10} style={{ padding: '10px 16px', fontSize: 12.5, color: '#475569' }}>
                        {items.map(i => <div key={i.id}>• {i.name}{i.size ? ` — ${i.size}` : ''} × {i.qty} @ ₹{n(i.price)} = ₹{n(i.amount)}</div>)}
                        {Number(s.discount) > 0 && <div>Discount: ₹{n(s.discount)}</div>}
                        {(s.store_returns || []).map(r => (
                          <div key={r.id} style={{ marginTop: 4, color: '#9333ea' }}>
                            ↩ {r.return_no} · {r.return_date} · refunded ₹{n(r.refund)} ({r.refund_mode}){r.reason ? ` — ${r.reason}` : ''}: {(r.store_return_items || []).map(i => `${i.name}${i.size ? ' ' + i.size : ''} ×${i.qty}`).join(', ')}
                          </div>
                        ))}
                        <div style={{ color: '#94a3b8', marginTop: 4 }}>Collected by {s.collected_by || '—'}{s.txn_ref ? ` · Ref ${s.txn_ref}` : ''}{s.status === 'void' ? ` · VOID: ${s.void_reason} (${s.voided_by})` : ''}{!s.account_posted && s.status !== 'void' && Number(s.amount_paid) > 0 ? ' · ⚠ not posted to Accounts' : ''}</div>
                      </td>
                    </tr>
                  ),
                ]
              })}
              {shown.length === 0 && <tr><td colSpan={10} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No sales in this range</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {returning && <ReturnModal sale={returning} by={by} onClose={() => setReturning(null)} showToast={showToast} onDone={() => { load(); onSaleDone() }} />}
      {dayClose && <DayCloseModal date={to || todayStr()} by={by} onClose={() => setDayClose(false)} showToast={showToast} />}
    </div>
  )
}

// ── Returns & refunds: partial, per item, stock goes back on the shelf ──────
function ReturnModal({ sale, by, onClose, showToast, onDone }) {
  const items = sale.store_sale_items || []
  const returnedQty = useMemo(() => {
    const m = {}
    ;(sale.store_returns || []).forEach(r => (r.store_return_items || []).forEach(i => { m[i.sale_item_id] = (m[i.sale_item_id] || 0) + i.qty }))
    return m
  }, [sale])
  const [qty, setQty] = useState({})
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState(sale.pay_mode && PAY_MODES.includes(sale.pay_mode) ? sale.pay_mode : 'Cash')
  const [busy, setBusy] = useState(false)
  const ratio = Number(sale.subtotal) > 0 ? Number(sale.total) / Number(sale.subtotal) : 1
  const refund = items.reduce((a, i) => a + Math.round(Number(i.price) * (Number(qty[i.id]) || 0) * ratio * 100) / 100, 0)

  const submit = async () => {
    const sel = items.filter(i => Number(qty[i.id]) > 0).map(i => ({ sale_item_id: i.id, qty: Number(qty[i.id]) }))
    if (!sel.length) { showToast('Choose the quantity to return.', '#dc2626'); return }
    if (!reason.trim()) { showToast('Enter a reason for the return.', '#dc2626'); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('store_process_return', { p: { sale_id: sale.id, items: sel, reason: reason.trim(), refund_mode: mode, by } })
    if (error) { setBusy(false); showToast('Return failed: ' + error.message, '#dc2626'); return }
    const posted = await postToAccounts({ amount: Number(data.refund), date: todayStr(), type: 'Expense', category: 'Store Refunds',
      desc: `Store refund ${data.return_no} against ${sale.bill_no}${sale.customer_name ? ' — ' + sale.customer_name : ''}`, ref: `store_${sale.bill_no}_ret_${data.return_no}` })
    setBusy(false)
    showToast(posted ? `↩️ ${data.return_no} · refund ₹${n(data.refund)}` : 'Return saved, but posting the refund to Accounts failed.', posted ? '#9333ea' : '#d97706')
    openPrint(data.return_no, `${HEADER_HTML('Credit note / Return receipt')}
<table style="margin-top:12px"><tr><td>Return no: <b>${esc(data.return_no)}</b></td><td>Date: ${todayStr()}</td></tr>
<tr><td>Against bill: <b>${esc(sale.bill_no)}</b> (${esc(sale.sale_date)})</td><td>${esc(sale.customer_name || 'Walk-in')}${sale.gcc_no ? ' · GCC-' + esc(sale.gcc_no) : ''}</td></tr></table>
<table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Refund</th></tr></thead><tbody>
${items.filter(i => Number(qty[i.id]) > 0).map(i => `<tr><td>${esc(i.name)}${i.size ? ' — ' + esc(i.size) : ''}</td><td class="r">${qty[i.id]}</td><td class="r">₹${n(Math.round(Number(i.price) * qty[i.id] * ratio * 100) / 100)}</td></tr>`).join('')}
<tr><td class="b" colspan="2">Total refunded (${esc(mode)})</td><td class="r b">₹${n(data.refund)}</td></tr></tbody></table>
<div class="s" style="margin-top:10px">Reason: ${esc(reason)} · Processed by ${esc(by)}</div>
<div class="s" style="margin-top:26px">Customer signature: ____________________</div>`, '', 520)
    onDone(); onClose()
  }

  return (
    <Modal onClose={onClose} busy={busy} width={560}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#9333ea', marginBottom: 4 }}>↩ Return items — {sale.bill_no}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{sale.customer_name || 'Walk-in'} · {sale.sale_date} · paid ₹{n(sale.amount_paid)}{ratio < 1 ? ` · bill discount shared out (${Math.round((1 - ratio) * 100)}%)` : ''}</div>
      {items.map(i => {
        const left = i.qty - (returnedQty[i.id] || 0)
        return (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f1f5f9', opacity: left > 0 ? 1 : .5 }}>
            <div style={{ flex: 1, fontSize: 13 }}>
              <b>{i.name}</b>{i.size ? ` — ${i.size}` : ''}
              <div style={{ fontSize: 11, color: '#64748b' }}>Sold {i.qty} @ ₹{n(i.price)}{returnedQty[i.id] ? ` · already returned ${returnedQty[i.id]}` : ''}</div>
            </div>
            <select disabled={left <= 0} value={qty[i.id] || 0} onChange={e => setQty(q => ({ ...q, [i.id]: Number(e.target.value) }))} style={{ ...inp, width: 80 }}>
              {Array.from({ length: left + 1 }, (_, k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )
      })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
        <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Reason *</label><input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Wrong size, defective" style={inp} /></div>
        <div><label style={lbl}>Refund via</label><select value={mode} onChange={e => setMode(e.target.value)} style={inp}>{PAY_MODES.map(m => <option key={m}>{m}</option>)}</select></div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: '#faf5ff', borderRadius: 8, padding: '8px 12px', fontSize: 15, fontWeight: 900, color: '#9333ea', display: 'flex', justifyContent: 'space-between' }}><span>Refund</span><span>₹{n(refund)}</span></div>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 8 }}>Returned stock goes back on the shelf. For an exchange, process the return, then bill the replacement at the POS.</div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={submit} disabled={busy || refund <= 0} style={{ ...btn(busy || refund <= 0 ? '#94a3b8' : '#9333ea'), flex: 1, padding: 12, fontSize: 14 }}>{busy ? 'Processing…' : `Refund ₹${n(refund)} & print credit note`}</button>
        <button onClick={onClose} disabled={busy} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Cancel</button>
      </div>
    </Modal>
  )
}

// ── Day-end closing (Z-report) with cash denomination count ─────────────────
function DayCloseModal({ date, by, onClose, showToast }) {
  const [day, setDay] = useState(date)
  const [data, setData] = useState(null)
  const [float, setFloat] = useState('')
  const [denoms, setDenoms] = useState({})
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    setData(null)
    Promise.all([
      supabase.from('store_sales').select('*').eq('sale_date', day).limit(5000),
      supabase.from('store_returns').select('*').eq('return_date', day),
      supabase.from('store_day_closings').select('*').eq('close_date', day).order('created_at', { ascending: false }).limit(1),
    ]).then(([s, r, c]) => {
      if (cancelled) return
      if (s.error) { showToast('Could not load the day: ' + s.error.message, '#dc2626'); return }
      setData({ sales: s.data || [], returns: r.error ? [] : r.data || [], prev: c.error ? null : (c.data || [])[0], canSave: !c.error })
    })
    return () => { cancelled = true }
  }, [day, showToast])

  const counted = DENOMS.reduce((a, d) => a + d * (Number(denoms[d]) || 0), 0)
  const r = useMemo(() => {
    if (!data) return null
    const live = data.sales.filter(s => s.status !== 'void'), voids = data.sales.filter(s => s.status === 'void')
    const byMode = {}, byStaff = {}, refundsByMode = {}
    live.forEach(s => {
      if (Number(s.amount_paid) > 0) byMode[s.pay_mode || 'Unspecified'] = (byMode[s.pay_mode || 'Unspecified'] || 0) + Number(s.amount_paid)
      const k = s.collected_by || '—'
      byStaff[k] = byStaff[k] || { bills: 0, amt: 0 }; byStaff[k].bills++; byStaff[k].amt += Number(s.amount_paid)
    })
    data.returns.forEach(x => { refundsByMode[x.refund_mode || 'Cash'] = (refundsByMode[x.refund_mode || 'Cash'] || 0) + Number(x.refund) })
    const sum = (arr, k) => arr.reduce((a, s) => a + Number(s[k] || 0), 0)
    return {
      bills: live.length, gross: sum(live, 'total'), discount: sum(live, 'discount'), received: sum(live, 'amount_paid'), dues: sum(live, 'due_amount'),
      online: live.filter(s => s.source === 'online').length, voids: voids.length, voidAmt: sum(voids, 'total'),
      refunds: sum(data.returns, 'refund'), byMode, byStaff, refundsByMode,
      cashIn: byMode.Cash || 0, cashOut: refundsByMode.Cash || 0,
    }
  }, [data])
  const expected = r ? (Number(float) || 0) + r.cashIn - r.cashOut : 0
  const variance = counted - expected

  const printZ = () => {
    const rows = o => Object.entries(o).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">₹${n(typeof v === 'object' ? v.amt : v)}</td>${typeof v === 'object' ? `<td class="r">${v.bills}</td>` : ''}</tr>`).join('') || '<tr><td colspan="3">—</td></tr>'
    openPrint(`Z-report ${day}`, `${HEADER_HTML('Day-end closing (Z-report) · ' + day)}
<table style="margin-top:10px"><tbody>
<tr><td>Bills</td><td class="r">${r.bills} (${r.online} online)</td></tr><tr><td>Gross sales</td><td class="r">₹${n(r.gross)}</td></tr>
<tr><td>Discounts given</td><td class="r">₹${n(r.discount)}</td></tr><tr><td>Received</td><td class="r b">₹${n(r.received)}</td></tr>
<tr><td>Put on student dues</td><td class="r">₹${n(r.dues)}</td></tr><tr><td>Refunds</td><td class="r">₹${n(r.refunds)}</td></tr>
<tr><td>Voided bills</td><td class="r">${r.voids} (₹${n(r.voidAmt)})</td></tr></tbody></table>
<h2>Collections by mode</h2><table><tbody>${rows(r.byMode)}</tbody></table>
<h2>By staff</h2><table><thead><tr><th>Staff</th><th class="r">Collected</th><th class="r">Bills</th></tr></thead><tbody>${rows(r.byStaff)}</tbody></table>
<h2>Cash drawer</h2><table><tbody>
<tr><td>Opening float</td><td class="r">₹${n(Number(float) || 0)}</td></tr><tr><td>+ Cash sales</td><td class="r">₹${n(r.cashIn)}</td></tr>
<tr><td>− Cash refunds</td><td class="r">₹${n(r.cashOut)}</td></tr><tr><td class="b">Expected in drawer</td><td class="r b">₹${n(expected)}</td></tr>
${DENOMS.filter(d => Number(denoms[d]) > 0).map(d => `<tr><td>₹${d} × ${denoms[d]}</td><td class="r">₹${n(d * denoms[d])}</td></tr>`).join('')}
<tr><td class="b">Counted</td><td class="r b">₹${n(counted)}</td></tr>
<tr><td class="b">Variance</td><td class="r b" style="color:${variance === 0 ? '#166534' : '#b91c1c'}">${variance > 0 ? '+' : ''}₹${n(variance)}</td></tr></tbody></table>
${note ? `<div class="s" style="margin-top:8px">Note: ${esc(note)}</div>` : ''}
<div class="s" style="margin-top:8px">Due payments received today against older bills are not counted here — see Accounts.</div>
<div class="s" style="margin-top:26px">Closed by ${esc(by)} ____________________ &nbsp;&nbsp; Verified by ____________________</div>`, '', 560)
  }

  const saveAndPrint = async () => {
    if (!r) return
    if (!counted && !window.confirm('No cash counted yet. Close the day anyway?')) return
    if (data.canSave) {
      setSaving(true)
      const { error } = await supabase.from('store_day_closings').insert([{
        close_date: day, closed_by: by, opening_float: Number(float) || 0, cash_expected: expected, cash_counted: counted, variance, note: note || null,
        summary: { ...r, denominations: denoms },
      }])
      setSaving(false)
      if (error) { showToast('Could not save closing: ' + error.message, '#dc2626'); return }
      showToast(`✅ Day closed for ${day}${variance ? ` · variance ₹${n(variance)}` : ''}`, variance ? '#d97706' : '#16a34a')
    } else showToast('Printed only — ' + MIGRATION_HINT, '#d97706')
    printZ(); onClose()
  }

  const Line = ({ l, v, c, b }) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, fontWeight: b ? 800 : 500, color: c || '#334155' }}><span>{l}</span><span>{v}</span></div>

  return (
    <Modal onClose={onClose} busy={saving} width={680}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f766e' }}>🧮 Day-end closing</div>
        <input type="date" value={day} onChange={e => setDay(e.target.value)} style={{ ...inp, width: 160 }} />
      </div>
      {!r ? <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div> : (
        <>
          {data.prev && <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '7px 11px', fontSize: 12, marginBottom: 10 }}>This day was already closed by {data.prev.closed_by} at {new Date(data.prev.created_at).toLocaleTimeString('en-IN', { timeStyle: 'short' })} (counted ₹{n(data.prev.cash_counted)}, variance ₹{n(data.prev.variance)}). Saving again adds a new closing record.</div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 16 }}>
            <div>
              <Line l={`Bills (${r.online} online)`} v={r.bills} />
              <Line l="Gross sales" v={`₹${n(r.gross)}`} />
              <Line l="Received" v={`₹${n(r.received)}`} b />
              <Line l="Put on student dues" v={`₹${n(r.dues)}`} c="#b91c1c" />
              <Line l="Refunds" v={`₹${n(r.refunds)}`} c="#9333ea" />
              <Line l="Voided" v={`${r.voids} · ₹${n(r.voidAmt)}`} c="#64748b" />
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', margin: '10px 0 2px' }}>BY MODE</div>
              {Object.entries(r.byMode).map(([k, v]) => <Line key={k} l={k} v={`₹${n(v)}`} />)}
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', margin: '10px 0 2px' }}>BY STAFF</div>
              {Object.entries(r.byStaff).map(([k, v]) => <Line key={k} l={`${k} (${v.bills})`} v={`₹${n(v.amt)}`} />)}
            </div>
            <div>
              <label style={lbl}>Opening float ₹</label>
              <input type="number" min={0} value={float} onChange={e => setFloat(e.target.value)} placeholder="0" style={{ ...inp, marginBottom: 8 }} />
              <div style={{ fontSize: 11, fontWeight: 800, color: '#475569', marginBottom: 4 }}>CASH COUNT</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {DENOMS.map(d => (
                  <label key={d} style={{ fontSize: 11, color: '#64748b' }}>₹{d} ×
                    <input type="number" min={0} value={denoms[d] ?? ''} onChange={e => setDenoms(x => ({ ...x, [d]: e.target.value }))} style={{ ...inp, padding: '5px 7px' }} />
                  </label>
                ))}
              </div>
              <div style={{ marginTop: 10, background: '#f8fafc', borderRadius: 8, padding: '8px 12px' }}>
                <Line l="Expected in drawer" v={`₹${n(expected)}`} />
                <Line l="Counted" v={`₹${n(counted)}`} b />
                <Line l="Variance" v={`${variance > 0 ? '+' : ''}₹${n(variance)}`} b c={variance === 0 ? '#16a34a' : '#dc2626'} />
              </div>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (e.g. reason for variance)" style={{ ...inp, marginTop: 8 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={saveAndPrint} disabled={saving} style={{ ...btn('#0f766e'), flex: 1, padding: 12, fontSize: 14 }}>{saving ? 'Saving…' : 'Close day & print Z-report'}</button>
            <button onClick={printZ} style={btn('#f1f5f9', '#334155', { padding: '12px 16px', border: '1px solid #e2e8f0' })}>Print only</button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS TAB
// ═══════════════════════════════════════════════════════════════════════════
function ReportsTab({ products, categories, refreshKey }) {
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(1); return d.toLocaleDateString('en-CA') })
  const [to, setTo] = useState(todayStr())
  const [sales, setSales] = useState([])
  const [dues, setDues] = useState([])
  const [bestSellers, setBestSellers] = useState([])
  const [ratings, setRatings] = useState({})
  const [prevSales, setPrevSales] = useState([])
  const [returns, setReturns] = useState([])
  const [loading, setLoading] = useState(true)

  // Previous period of equal length, immediately before `from` — for % change.
  const prevRange = useMemo(() => {
    const f = new Date(from + 'T00:00:00'), t = new Date(to + 'T00:00:00')
    const days = Math.max(1, Math.round((t - f) / 86400000) + 1)
    const pt = new Date(f); pt.setDate(pt.getDate() - 1)
    const pf = new Date(pt); pf.setDate(pf.getDate() - (days - 1))
    return { from: pf.toLocaleDateString('en-CA'), to: pt.toLocaleDateString('en-CA'), days }
  }, [from, to])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('store_sales').select('*, store_sale_items(*)').gte('sale_date', from).lte('sale_date', to).neq('status', 'void').limit(5000),
      supabase.from('store_sales').select('id,bill_no,customer_name,gcc_no,due_amount,sale_date').eq('status', 'due').order('sale_date'),
      supabase.from('store_best_sellers').select('*').limit(10),
      supabase.from('store_product_ratings').select('*'),
      supabase.from('store_sales').select('total,sale_date').gte('sale_date', prevRange.from).lte('sale_date', prevRange.to).neq('status', 'void').limit(5000),
      supabase.from('store_returns').select('refund,return_date,store_return_items(product_id,qty,amount)').gte('return_date', from).lte('return_date', to),
    ]).then(([a, b, c, d, e, f]) => {
      if (cancelled) return
      setSales(a.data || []); setDues(b.data || []); setBestSellers(c.data || []); setRatings(Object.fromEntries((d.data || []).map(r => [r.product_id, r])))
      setPrevSales(e.data || []); setReturns(f.error ? [] : f.data || []); setLoading(false)
    })
    return () => { cancelled = true }
  }, [from, to, refreshKey, prevRange])

  const catName = useMemo(() => { const m = new Map(categories.map(c => [c.id, c.name])); return id => m.get(id) || 'Uncategorised' }, [categories])
  const prodById = useMemo(() => new Map(products.map(p => [p.id, p])), [products])

  const revenue = sales.reduce((a, s) => a + Number(s.total), 0)
  const byMode = {}, byProduct = {}, byCat = {}
  sales.forEach(s => {
    if (Number(s.amount_paid) > 0) byMode[s.pay_mode || 'Unspecified'] = (byMode[s.pay_mode || 'Unspecified'] || 0) + Number(s.amount_paid)
    ;(s.store_sale_items || []).forEach(i => {
      const k = `${i.name}${i.size ? ' — ' + i.size : ''}`
      byProduct[k] = byProduct[k] || { qty: 0, amt: 0 }; byProduct[k].qty += i.qty; byProduct[k].amt += Number(i.amount)
      const c = catName(prodById.get(i.product_id)?.category_id)
      byCat[c] = (byCat[c] || 0) + Number(i.amount)
    })
  })
  const top = Object.entries(byProduct).sort((a, b) => b[1].amt - a[1].amt).slice(0, 10)
  const low = products.filter(p => p.active && p.stock <= (p.reorder_level ?? 5)).sort((a, b) => a.stock - b.stock)
  const stockValue = products.filter(p => p.active).reduce((a, p) => a + p.stock * Number(p.price), 0)
  const totalDue = dues.reduce((a, d) => a + Number(d.due_amount), 0)

  // Profit — item revenue is shared down by the bill's discount ratio, cost is the product's current cost_price.
  const hasCost = products.length > 0 && 'cost_price' in products[0]
  let costed = 0, costedRev = 0, cogs = 0, allRev = 0
  sales.forEach(s => {
    const ratio = Number(s.subtotal) > 0 ? Number(s.total) / Number(s.subtotal) : 1
    ;(s.store_sale_items || []).forEach(i => {
      const rev = Number(i.amount) * ratio, cp = prodById.get(i.product_id)?.cost_price
      allRev += rev
      if (cp != null && Number(cp) > 0) { costed++; costedRev += rev; cogs += Number(cp) * i.qty }
    })
  })
  const refundTotal = returns.reduce((a, r) => a + Number(r.refund), 0)
  // Returned items (costed ones) give back both their revenue and their cost.
  const refundAdj = returns.reduce((a, r) => a + (r.store_return_items || []).reduce((b, i) => {
    const cp = prodById.get(i.product_id)?.cost_price
    return cp != null && Number(cp) > 0 ? b + Number(i.amount) - Number(cp) * i.qty : b
  }, 0), 0)
  const profit = costedRev - cogs - refundAdj
  const margin = costedRev > 0 ? Math.round(profit / costedRev * 100) : null
  const coverage = allRev > 0 ? Math.round(costedRev / allRev * 100) : 0

  const prevRevenue = prevSales.reduce((a, s) => a + Number(s.total), 0)
  const change = prevRevenue > 0 ? Math.round((revenue - prevRevenue) / prevRevenue * 100) : null

  // Daily trend (capped at 62 bars; longer ranges are grouped by month).
  const trend = useMemo(() => {
    const byDay = {}
    sales.forEach(s => { byDay[s.sale_date] = (byDay[s.sale_date] || 0) + Number(s.total) })
    const out = []
    const d = new Date(from + 'T00:00:00'), end = new Date(to + 'T00:00:00')
    if (prevRange.days <= 62) {
      for (; d <= end; d.setDate(d.getDate() + 1)) { const k = d.toLocaleDateString('en-CA'); out.push({ k, label: k.slice(8), full: k, v: byDay[k] || 0 }) }
    } else {
      const byMonth = {}
      Object.entries(byDay).forEach(([k, v]) => { byMonth[k.slice(0, 7)] = (byMonth[k.slice(0, 7)] || 0) + v })
      for (d.setDate(1); d <= end; d.setMonth(d.getMonth() + 1)) { const k = d.toLocaleDateString('en-CA').slice(0, 7); out.push({ k, label: d.toLocaleDateString('en-IN', { month: 'short' }), full: k, v: byMonth[k] || 0 }) }
    }
    return out
  }, [sales, from, to, prevRange.days])
  const trendMax = Math.max(1, ...trend.map(t => t.v))

  // ── ABC analysis + dead stock ──
  const abc = useMemo(() => {
    const rev = new Map()
    sales.forEach(s => (s.store_sale_items || []).forEach(i => rev.set(i.product_id, (rev.get(i.product_id) || 0) + Number(i.amount))))
    const total = [...rev.values()].reduce((a, v) => a + v, 0) || 1
    let cum = 0
    const ranked = [...rev.entries()].sort((a, b) => b[1] - a[1]).map(([id, v]) => { cum += v; const pct = cum / total; return { id, v, p: prodById.get(id), cls: pct <= 0.8 || cum === v ? 'A' : pct <= 0.95 ? 'B' : 'C' } })
    const dead = products.filter(p => p.active && p.stock > 0 && !rev.has(p.id)).map(p => ({ p, value: p.stock * Number(p.cost_price ?? p.price) })).sort((a, b) => b.value - a.value)
    const k = c => ranked.filter(r => r.cls === c)
    return { ranked, dead, A: k('A'), B: k('B'), C: k('C'), total, deadValue: dead.reduce((a, d) => a + d.value, 0) }
  }, [sales, products, prodById])
  const exportABC = () => downloadFile(`gnsi-store-abc-${from}-to-${to}.csv`, toCSV(['class', 'product', 'size', 'revenue', 'share_%', 'stock'],
    [...abc.ranked.map(r => [r.cls, r.p?.name || r.id, r.p?.size, Math.round(r.v), (r.v / abc.total * 100).toFixed(1), r.p?.stock]), ...abc.dead.map(d => ['Dead', d.p.name, d.p.size, 0, 0, d.p.stock])]))

  // ── When we sell: weekday × hour heatmap ──
  const heat = useMemo(() => {
    const m = {}; let max = 0
    sales.forEach(s => { if (!s.created_at) return; const d = new Date(s.created_at), k = `${(d.getDay() + 6) % 7}-${d.getHours()}`; m[k] = (m[k] || 0) + Number(s.total); max = Math.max(max, m[k]) })
    const hours = Object.keys(m).map(k => Number(k.split('-')[1]))
    const lo = Math.min(8, ...hours), hi = Math.max(18, ...hours)
    return { m, max: max || 1, hours: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i) }
  }, [sales])

  // ── Customers: students by GCC, others by phone ──
  const cust = useMemo(() => {
    const m = new Map()
    sales.forEach(s => {
      const key = s.gcc_no ? `GCC-${s.gcc_no}` : s.phone ? String(s.phone).replace(/\D/g, '').slice(-10) : null
      if (!key) return
      const c = m.get(key) || { key, name: s.customer_name || '—', phone: s.phone, bills: 0, spend: 0, last: '' }
      c.bills++; c.spend += Number(s.total); if (s.sale_date > c.last) c.last = s.sale_date; if (s.customer_name) c.name = s.customer_name
      m.set(key, c)
    })
    const list = [...m.values()].sort((a, b) => b.spend - a.spend)
    const known = list.reduce((a, c) => a + c.bills, 0)
    return { list, repeat: list.filter(c => c.bills > 1).length, walkins: sales.length - known, avg: sales.length ? revenue / sales.length : 0 }
  }, [sales, revenue])

  const byStaff = {}
  sales.forEach(s => { const k = s.collected_by || '—'; byStaff[k] = byStaff[k] || { bills: 0, amt: 0 }; byStaff[k].bills++; byStaff[k].amt += Number(s.amount_paid) })

  const Box =({ title, children }) => <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 10 }}>{title}</div>{children}</div>
  const Row = ({ l, r, c }) => <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f8fafc', fontSize: 12.5 }}><span style={{ color: '#475569' }}>{l}</span><span style={{ fontWeight: 800, color: c || '#0f172a' }}>{r}</span></div>

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div><label style={lbl}>From</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, width: 150 }} /></div>
        <div><label style={lbl}>To</label><input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...inp, width: 150 }} /></div>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginBottom: 16 }}>
            {[
              ['Sales in range', `₹${n(revenue)}`, '#16a34a', '#f0fdf4', change == null ? 'no sales in previous period' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}% vs previous ${prevRange.days} day${prevRange.days > 1 ? 's' : ''}`],
              ['Bills', sales.length, NAVY, '#eff6ff', sales.length ? `avg bill ₹${n(Math.round(revenue / sales.length))}` : ''],
              ...(hasCost ? [['Est. gross profit', `₹${n(Math.round(profit))}`, '#0f766e', '#f0fdfa', margin == null ? 'add cost prices to products' : `${margin}% margin · ${coverage}% of sales costed`]] : []),
              ['Outstanding dues', `₹${n(totalDue)}`, '#dc2626', '#fef2f2', `${dues.length} bill${dues.length === 1 ? '' : 's'}`],
              ['Stock value (at price)', `₹${n(stockValue)}`, '#7c3aed', '#f5f3ff', hasCost ? `at cost ₹${n(Math.round(products.filter(p => p.active).reduce((a, p) => a + p.stock * Number(p.cost_price || 0), 0)))}` : ''],
              ...(refundTotal > 0 ? [['Refunds', `₹${n(refundTotal)}`, '#9333ea', '#faf5ff', `${returns.length} return${returns.length === 1 ? '' : 's'}`]] : []),
            ].map(([l, v, c, bg, sub]) => (
              <div key={l} style={{ background: bg, borderRadius: 10, padding: '12px 14px', borderLeft: `4px solid ${c}` }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: c }}>{l}</div><div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div>
                {sub && <div style={{ fontSize: 10.5, fontWeight: 600, color: l === 'Sales in range' && change != null ? (change >= 0 ? '#16a34a' : '#dc2626') : '#64748b', marginTop: 2 }}>{sub}</div>}
              </div>
            ))}
          </div>

          <div style={{ ...card, padding: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>📈 Sales trend</div>
              <div style={{ fontSize: 11, color: '#94a3b8' }}>peak ₹{n(trendMax === 1 ? 0 : trendMax)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 140, borderBottom: '1px solid #e2e8f0' }}>
              {trend.map(t => (
                <div key={t.k} title={`${t.full}: ₹${n(t.v)}`} style={{ flex: 1, minWidth: 3, height: `${Math.max(t.v ? 3 : 0, t.v / trendMax * 100)}%`, background: t.v ? '#2563eb' : 'transparent', borderRadius: '3px 3px 0 0' }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
              {trend.map((t, i) => <div key={t.k} style={{ flex: 1, minWidth: 3, fontSize: 9.5, color: '#94a3b8', textAlign: 'center', overflow: 'hidden' }}>{trend.length <= 16 || i % Math.ceil(trend.length / 12) === 0 ? t.label : ''}</div>)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
            <Box title="👤 Collections by staff">{Object.keys(byStaff).length ? Object.entries(byStaff).sort((a, b) => b[1].amt - a[1].amt).map(([k, v]) => <Row key={k} l={`${k} (${v.bills} bill${v.bills > 1 ? 's' : ''})`} r={`₹${n(v.amt)}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales</div>}</Box>
            <Box title="🏆 Top products">{top.length ? top.map(([k, v]) => <Row key={k} l={`${k} (×${v.qty})`} r={`₹${n(v.amt)}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales</div>}</Box>
            <Box title="📂 By category">{Object.keys(byCat).length ? Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Row key={k} l={k} r={`₹${n(v)}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales</div>}</Box>
            <Box title="💳 Collected by mode">{Object.keys(byMode).length ? Object.entries(byMode).map(([k, v]) => <Row key={k} l={k} r={`₹${n(v)}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No payments</div>}</Box>
            <Box title={`⚠️ Low / out of stock (${low.length})`}><div style={{ maxHeight: 240, overflowY: 'auto' }}>{low.length ? low.map(p => <Row key={p.id} l={`${p.name}${p.size ? ' — ' + p.size : ''}`} r={p.stock <= 0 ? 'OUT' : `${p.stock} left`} c={p.stock <= 0 ? '#dc2626' : '#d97706'} />) : <div style={{ color: '#16a34a', fontSize: 12 }}>All stocked ✓</div>}</div></Box>
            <Box title="🔥 Best sellers (last 30 days)"><div style={{ maxHeight: 240, overflowY: 'auto' }}>{bestSellers.length ? bestSellers.map(b => <Row key={b.product_id} l={`${b.name}${b.size ? ' — ' + b.size : ''}`} r={`×${b.qty_sold_30d}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales in the last 30 days</div>}</div></Box>
            <Box title="⭐ Product ratings"><div style={{ maxHeight: 240, overflowY: 'auto' }}>{Object.keys(ratings).length ? products.filter(p => ratings[p.id]).sort((a, b) => ratings[b.id].review_count - ratings[a.id].review_count).map(p => <Row key={p.id} l={`${p.name}${p.size ? ' — ' + p.size : ''}`} r={`${ratings[p.id].avg_rating}★ (${ratings[p.id].review_count})`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No reviews yet</div>}</div></Box>
            <Box title={`🧾 Student dues (${dues.length})`}><div style={{ maxHeight: 240, overflowY: 'auto' }}>{dues.length ? dues.map(d => <Row key={d.id} l={`${d.customer_name || '—'} · GCC-${d.gcc_no} · ${d.bill_no}`} r={`₹${n(d.due_amount)}`} c="#dc2626" />) : <div style={{ color: '#16a34a', fontSize: 12 }}>No outstanding dues ✓</div>}</div></Box>
          </div>

          <div style={{ ...card, padding: 16, marginTop: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <div><div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>🔤 ABC analysis &amp; dead stock</div><div style={{ fontSize: 11.5, color: '#94a3b8' }}>A = items making the top 80% of sales in this range · B = next 15% · C = last 5% · Dead = in stock but no sales in this range</div></div>
              <button onClick={exportABC} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>⬇ CSV</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
              {[['A · focus', abc.A, '#16a34a', '#f0fdf4'], ['B · steady', abc.B, '#0e7490', '#ecfeff'], ['C · slow', abc.C, '#d97706', '#fffbeb']].map(([l, list, c, bg]) => (
                <div key={l} style={{ background: bg, borderRadius: 10, padding: '10px 12px', borderLeft: `4px solid ${c}` }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: c }}>{l}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: c }}>{list.length} item{list.length === 1 ? '' : 's'}</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{Math.round(list.reduce((a, r) => a + r.v, 0) / abc.total * 100)}% of sales</div>
                </div>
              ))}
              <div style={{ background: '#fef2f2', borderRadius: 10, padding: '10px 12px', borderLeft: '4px solid #dc2626' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#dc2626' }}>Dead stock</div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#dc2626' }}>{abc.dead.length} item{abc.dead.length === 1 ? '' : 's'}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>₹{n(Math.round(abc.deadValue))} tied up{hasCost ? ' (at cost)' : ''}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
              <div><div style={{ fontSize: 12, fontWeight: 800, color: '#16a34a', marginBottom: 4 }}>A items — never let these run out</div><div style={{ maxHeight: 200, overflowY: 'auto' }}>{abc.A.length ? abc.A.map(r => <Row key={r.id} l={`${r.p?.name || 'Removed'}${r.p?.size ? ' — ' + r.p.size : ''} · stock ${r.p?.stock ?? '—'}`} r={`₹${n(Math.round(r.v))}`} c={r.p && r.p.stock <= (r.p.reorder_level ?? 5) ? '#dc2626' : undefined} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales</div>}</div></div>
              <div><div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 4 }}>Dead stock — consider a deal or kit</div><div style={{ maxHeight: 200, overflowY: 'auto' }}>{abc.dead.length ? abc.dead.map(d => <Row key={d.p.id} l={`${d.p.name}${d.p.size ? ' — ' + d.p.size : ''} · ${d.p.stock} in stock`} r={`₹${n(Math.round(d.value))}`} c="#dc2626" />) : <div style={{ color: '#16a34a', fontSize: 12 }}>Everything in stock sold at least once ✓</div>}</div></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14, marginTop: 14 }}>
            <div style={{ ...card, padding: 16, overflowX: 'auto' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>🕒 When we sell</div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 10 }}>Sales by weekday and hour — plan counter staff for the dark cells</div>
              <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 10.5 }}>
                <thead><tr><th />{heat.hours.map(h => <th key={h} style={{ color: '#94a3b8', fontWeight: 600, minWidth: 22 }}>{h > 12 ? h - 12 : h}{h < 12 ? 'a' : 'p'}</th>)}</tr></thead>
                <tbody>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, di) => (
                  <tr key={d}><td style={{ color: '#64748b', fontWeight: 700, paddingRight: 4 }}>{d}</td>
                    {heat.hours.map(h => { const v = heat.m[`${di}-${h}`] || 0; return <td key={h} title={`${d} ${h}:00 — ₹${n(v)}`} style={{ height: 22, borderRadius: 4, background: v ? `rgba(30,58,95,${0.15 + 0.85 * v / heat.max})` : '#f1f5f9' }} /> })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div style={{ ...card, padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: NAVY }}>👪 Customers</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '10px 0' }}>
                {[['Known customers', cust.list.length], ['Came back', cust.list.length ? `${Math.round(cust.repeat / cust.list.length * 100)}%` : '—'], ['Avg bill', `₹${n(Math.round(cust.avg))}`]].map(([l, v]) => (
                  <div key={l} style={{ background: '#f8fafc', borderRadius: 9, padding: '8px 10px' }}><div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748b' }}>{l}</div><div style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>{v}</div></div>
                ))}
              </div>
              <div style={{ fontSize: 11.5, color: '#94a3b8', marginBottom: 4 }}>Top customers · {cust.walkins} anonymous walk-in bill{cust.walkins === 1 ? '' : 's'} not counted</div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>{cust.list.slice(0, 15).map(c => <Row key={c.key} l={`${c.name} · ${c.key.startsWith('GCC') ? c.key : c.phone} · ${c.bills} bill${c.bills > 1 ? 's' : ''} · last ${c.last}`} r={`₹${n(Math.round(c.spend))}`} />)}{!cust.list.length && <div style={{ color: '#94a3b8', fontSize: 12 }}>No named customers in this range</div>}</div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMOTIONS TAB — discount codes + student loyalty points (admin only)
// ═══════════════════════════════════════════════════════════════════════════
const EMPTY_PROMO = { code: '', kind: 'percent', value: '', min_subtotal: '', max_discount: '', starts_at: '', ends_at: '', usage_limit: '', active: true }

function PromotionsTab({ currentUser, showToast }) {
  const [promos, setPromos] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_PROMO)
  const [saving, setSaving] = useState(false)
  const [gccLookup, setGccLookup] = useState('')
  const [gccBalance, setGccBalance] = useState(null)
  const [gccLedger, setGccLedger] = useState([])
  const [lookingUp, setLookingUp] = useState(false)
  const by = currentUser?.userName || currentUser?.name || 'Admin'

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('store_promo_codes').select('*').order('created_at', { ascending: false })
    if (error) showToast('Could not load promo codes: ' + error.message, '#dc2626')
    setPromos(data || [])
    setLoading(false)
  }, [showToast])
  useEffect(() => { load() }, [load])

  const openNew = () => { setForm(EMPTY_PROMO); setEditing({}) }
  const openEdit = p => {
    setForm({ ...EMPTY_PROMO, ...p, value: p.value ?? '', min_subtotal: p.min_subtotal ?? '', max_discount: p.max_discount ?? '',
      starts_at: p.starts_at ? p.starts_at.slice(0, 16) : '', ends_at: p.ends_at ? p.ends_at.slice(0, 16) : '', usage_limit: p.usage_limit ?? '' })
    setEditing(p)
  }
  const f = (k, v) => setForm(x => ({ ...x, [k]: v }))

  const save = async () => {
    const code = form.code.trim().toUpperCase()
    if (!code) { showToast('Enter a code.', '#dc2626'); return }
    if (form.value === '' || Number(form.value) <= 0) { showToast('Enter a discount value greater than 0.', '#dc2626'); return }
    if (form.kind === 'percent' && Number(form.value) > 100) { showToast('A percent discount cannot exceed 100.', '#dc2626'); return }
    setSaving(true)
    const payload = {
      code, kind: form.kind, value: Number(form.value),
      min_subtotal: form.min_subtotal === '' ? 0 : Number(form.min_subtotal),
      max_discount: form.max_discount === '' ? null : Number(form.max_discount),
      starts_at: form.starts_at || null, ends_at: form.ends_at || null,
      usage_limit: form.usage_limit === '' ? null : parseInt(form.usage_limit, 10),
      active: !!form.active,
    }
    const q = editing.id
      ? supabase.from('store_promo_codes').update(payload).eq('id', editing.id)
      : supabase.from('store_promo_codes').insert([payload])
    const { error } = await q
    setSaving(false)
    if (error) { showToast('Save failed: ' + error.message, '#dc2626'); return }
    showToast(editing.id ? '✅ Promo code updated' : '✅ Promo code created')
    setEditing(null); load()
  }

  const toggleActive = async p => {
    const { error } = await supabase.from('store_promo_codes').update({ active: !p.active }).eq('id', p.id)
    if (error) { showToast('Update failed: ' + error.message, '#dc2626'); return }
    load()
  }

  const lookupGcc = async () => {
    const gcc = gccLookup.trim()
    if (!gcc) return
    setLookingUp(true)
    const [{ data: bal }, { data: ledger, error }] = await Promise.all([
      supabase.rpc('store_loyalty_balance', { p_gcc: gcc }),
      supabase.from('store_loyalty_ledger').select('*').eq('gcc_no', gcc).order('created_at', { ascending: false }).limit(30),
    ])
    setLookingUp(false)
    if (error) { showToast('Lookup failed: ' + error.message, '#dc2626'); return }
    setGccBalance(Number(bal) || 0)
    setGccLedger(ledger || [])
  }

  const adjustPoints = async () => {
    const gcc = gccLookup.trim()
    if (!gcc) { showToast('Enter a GCC No. first.', '#dc2626'); return }
    const raw = window.prompt(`Adjust points for GCC-${gcc} (current balance ${gccBalance ?? '—'}).\nEnter +N to add, −N to remove:`)
    if (raw === null) return
    const delta = parseInt(raw, 10)
    if (!delta) { showToast('Enter a non-zero whole number.', '#dc2626'); return }
    const reason = window.prompt('Reason:', 'Manual adjustment') || 'Adjustment'
    const { error } = await supabase.rpc('store_loyalty_adjust', { p_gcc: gcc, p_delta: delta, p_reason: reason, p_by: by })
    if (error) { showToast('Adjust failed: ' + error.message, '#dc2626'); return }
    showToast(`Points ${delta > 0 ? '+' : ''}${delta} applied`); lookupGcc()
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 18, alignItems: 'start' }}>
        {/* Promo codes */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>🏷️ Discount codes</div>
            <button onClick={openNew} style={btn(NAVY)}>+ New code</button>
          </div>
          {loading ? <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {promos.map(p => {
                const expired = p.ends_at && new Date(p.ends_at) < new Date()
                const exhausted = p.usage_limit != null && p.used_count >= p.usage_limit
                const live = p.active && !expired && !exhausted
                return (
                  <div key={p.id} style={{ ...card, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, fontFamily: 'monospace' }}>{p.code}</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          {p.kind === 'percent' ? `${p.value}% off` : `₹${n(p.value)} off`}
                          {p.max_discount ? ` (max ₹${n(p.max_discount)})` : ''}
                          {p.min_subtotal > 0 ? ` · min ₹${n(p.min_subtotal)}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
                          Used {p.used_count}{p.usage_limit ? ` / ${p.usage_limit}` : ''}
                          {p.starts_at ? ` · from ${new Date(p.starts_at).toLocaleDateString('en-IN')}` : ''}
                          {p.ends_at ? ` · until ${new Date(p.ends_at).toLocaleDateString('en-IN')}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 99, background: live ? '#dcfce7' : '#f1f5f9', color: live ? '#16a34a' : '#94a3b8' }}>
                        {!p.active ? 'OFF' : expired ? 'EXPIRED' : exhausted ? 'USED UP' : 'LIVE'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                      <button onClick={() => openEdit(p)} style={btn('#f1f5f9', '#334155', { padding: '4px 10px' })}>Edit</button>
                      <button onClick={() => toggleActive(p)} style={btn(p.active ? '#fef2f2' : '#dcfce7', p.active ? '#dc2626' : '#16a34a', { padding: '4px 10px' })}>{p.active ? 'Turn off' : 'Turn on'}</button>
                    </div>
                  </div>
                )
              })}
              {promos.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>No promo codes yet</div>}
            </div>
          )}
        </div>

        {/* Loyalty lookup */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 12 }}>⭐ Student loyalty points</div>
          <div style={{ ...card, padding: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={gccLookup} onChange={e => setGccLookup(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookupGcc()}
                placeholder="GCC No…" style={{ ...inp, flex: 1 }} />
              <button onClick={lookupGcc} disabled={lookingUp} style={btn(NAVY)}>{lookingUp ? '…' : 'Look up'}</button>
            </div>
            {gccBalance !== null && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, background: '#fefce8', border: '1px solid #fde047', borderRadius: 8, padding: '10px 14px' }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#854d0e', textTransform: 'uppercase' }}>Balance</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#854d0e' }}>{gccBalance} pts <span style={{ fontSize: 12, fontWeight: 600 }}>(₹{n(gccBalance)})</span></div>
                  </div>
                  <button onClick={adjustPoints} style={btn('#854d0e')}>± Adjust</button>
                </div>
                <div style={{ marginTop: 12, maxHeight: 220, overflowY: 'auto' }}>
                  {gccLedger.map(l => (
                    <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 }}>
                      <span style={{ color: '#475569' }}>{l.reason}</span>
                      <span style={{ fontWeight: 800, color: l.delta > 0 ? '#16a34a' : '#dc2626' }}>{l.delta > 0 ? '+' : ''}{l.delta}</span>
                    </div>
                  ))}
                  {gccLedger.length === 0 && <div style={{ padding: 12, textAlign: 'center', color: '#94a3b8', fontSize: 12 }}>No point activity yet</div>}
                </div>
              </>
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>
            Students earn 1 point per ₹100 paid on a bill (paid in full, on a student account). 1 point = ₹1 off a future bill, redeemable at the POS.
          </div>
        </div>
      </div>

      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.5)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => !saving && setEditing(null)}>
          <div style={{ ...card, width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', padding: 20 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 14 }}>{editing.id ? 'Edit promo code' : 'New promo code'}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Code *</label><input value={form.code} onChange={e => f('code', e.target.value.toUpperCase())} style={{ ...inp, fontFamily: 'monospace' }} placeholder="e.g. WELCOME10" /></div>
              <div><label style={lbl}>Type</label>
                <select value={form.kind} onChange={e => f('kind', e.target.value)} style={inp}><option value="percent">Percent %</option><option value="flat">Flat ₹</option></select></div>
              <div><label style={lbl}>Value *</label><input type="number" min={0} value={form.value} onChange={e => f('value', e.target.value)} style={inp} placeholder={form.kind === 'percent' ? '10' : '100'} /></div>
              <div><label style={lbl}>Min. order ₹</label><input type="number" min={0} value={form.min_subtotal} onChange={e => f('min_subtotal', e.target.value)} style={inp} placeholder="0" /></div>
              <div><label style={lbl}>Max discount ₹{form.kind === 'flat' ? ' (n/a)' : ''}</label><input type="number" min={0} disabled={form.kind === 'flat'} value={form.max_discount} onChange={e => f('max_discount', e.target.value)} style={{ ...inp, background: form.kind === 'flat' ? '#f1f5f9' : 'white' }} placeholder="No cap" /></div>
              <div><label style={lbl}>Starts</label><input type="datetime-local" value={form.starts_at} onChange={e => f('starts_at', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Ends</label><input type="datetime-local" value={form.ends_at} onChange={e => f('ends_at', e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Usage limit</label><input type="number" min={0} value={form.usage_limit} onChange={e => f('usage_limit', e.target.value)} style={inp} placeholder="Unlimited" /></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={form.active} onChange={e => f('active', e.target.checked)} /> Active</label>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={save} disabled={saving} style={{ ...btn(NAVY), flex: 1, padding: 12, fontSize: 14 }}>{saving ? 'Saving…' : 'Save'}</button>
              <button onClick={() => setEditing(null)} disabled={saving} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA SCANNER — phone/laptop camera as a barcode scanner (Chrome, Edge, Android)
// ═══════════════════════════════════════════════════════════════════════════
function CameraScanner({ onCode, onClose }) {
  const vid = useRef(null)
  const cb = useRef(onCode); cb.current = onCode
  const [msg, setMsg] = useState('Starting camera…')
  const [hits, setHits] = useState([])
  const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    if (!supported) return
    let stream, timer, alive = true, lastCode = '', lastAt = 0
    ;(async () => {
      try {
        const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf', 'qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return }
        vid.current.srcObject = stream; await vid.current.play()
        setMsg('Point the camera at a barcode — items are added automatically')
        const tick = async () => {
          if (!alive) return
          try {
            const [code] = await det.detect(vid.current)
            const now = Date.now()
            if (code && (code.rawValue !== lastCode || now - lastAt > 2000)) {
              lastCode = code.rawValue; lastAt = now
              const name = cb.current(code.rawValue)
              setHits(h => [{ code: code.rawValue, name, at: now }, ...h].slice(0, 6))
            }
          } catch {}
          timer = setTimeout(tick, 220)
        }
        tick()
      } catch (e) {
        setMsg(e?.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow the camera for this site in the browser settings.' : 'Could not start the camera: ' + (e?.message || e))
      }
    })()
    return () => { alive = false; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()) }
  }, [supported])

  return (
    <Modal onClose={onClose} width={520}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>📷 Camera scanner</div>
        <button onClick={onClose} style={btn('#f1f5f9', '#334155')}>Done</button>
      </div>
      {!supported ? (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 14, fontSize: 13, color: '#92400e', lineHeight: 1.55 }}>
          This browser can't read barcodes from the camera. Use <b>Chrome or Edge</b> (Android phone, Windows or Mac), or a USB barcode scanner in the search box.
        </div>
      ) : (
        <>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#0f172a', aspectRatio: '4/3' }}>
            <video ref={vid} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', left: '12%', right: '12%', top: '38%', height: '24%', border: '3px solid #b8923a', borderRadius: 10, boxShadow: '0 0 0 999px rgba(0,0,0,.25)' }} />
          </div>
          <div style={{ fontSize: 12.5, color: '#64748b', marginTop: 8 }}>{msg}</div>
          {hits.map(h => (
            <div key={h.at} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
              <span style={{ fontWeight: 700, color: h.name ? '#166534' : '#b91c1c' }}>{h.name ? `✓ ${h.name}` : '✗ Not in the product list'}</span>
              <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>{h.code}</span>
            </div>
          ))}
        </>
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// BULK PRICE UPDATE — % or ₹ change with rounding, preview, cost warnings
// ═══════════════════════════════════════════════════════════════════════════
function BulkPriceModal({ products, hasCost, onClose, onDone, showToast }) {
  const [field, setField] = useState('price')
  const [mode, setMode] = useState('pct_up')
  const [value, setValue] = useState('')
  const [round, setRound] = useState(1)
  const [skip, setSkip] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const v = Number(value) || 0
  const calc = old => {
    const o = Number(old) || 0
    let x = { pct_up: o * (1 + v / 100), pct_down: o * (1 - v / 100), amt_up: o + v, amt_down: o - v, set: v }[mode]
    if (round > 0) x = Math.round(x / round) * round
    return Math.max(0, Math.round(x * 100) / 100)
  }
  const rows = products.map(p => {
    const old = field === 'price' ? Number(p.price) : Number(p.mrp) || 0
    const nu = calc(old)
    const price = field === 'price' ? nu : Number(p.price), mrp = field === 'mrp' ? nu : Number(p.mrp) || 0
    const warn = hasCost && p.cost_price != null && price < Number(p.cost_price) ? `below cost ₹${n(p.cost_price)}` : mrp > 0 && price > mrp ? 'price above M.R.P.' : ''
    return { p, old, nu, warn }
  })
  const todo = rows.filter(r => !skip.has(r.p.id) && r.nu !== r.old && value !== '')

  const apply = async () => {
    if (!todo.length) return
    if (!window.confirm(`Change the ${field === 'price' ? 'selling price' : 'M.R.P.'} of ${todo.length} product${todo.length > 1 ? 's' : ''}?`)) return
    setBusy(true); let done = 0
    for (const r of todo) {
      const { error } = await supabase.from('store_products').update({ [field]: r.nu, updated_at: new Date().toISOString() }).eq('id', r.p.id)
      if (error) { showToast(`Stopped at ${r.p.name}: ${error.message}`, '#dc2626'); break }
      setProgress(++done)
    }
    setBusy(false); onDone()
    if (done === todo.length) { showToast(`✅ ${done} price${done > 1 ? 's' : ''} updated`); onClose() }
  }

  return (
    <Modal onClose={onClose} busy={busy} width={760}>
      <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 4 }}>₹ Bulk price update</div>
      <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>Applies to the {products.length} products in your current Products filter. Untick any to leave them alone. Sale prices are not changed.</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginBottom: 12 }}>
        <div><label style={lbl}>Change</label><select value={field} onChange={e => setField(e.target.value)} style={inp}><option value="price">Selling price</option><option value="mrp">M.R.P.</option></select></div>
        <div><label style={lbl}>How</label><select value={mode} onChange={e => setMode(e.target.value)} style={inp}>
          <option value="pct_up">Increase by %</option><option value="pct_down">Decrease by %</option><option value="amt_up">Increase by ₹</option><option value="amt_down">Decrease by ₹</option><option value="set">Set to ₹</option></select></div>
        <div><label style={lbl}>{mode.startsWith('pct') ? 'Percent' : 'Amount ₹'}</label><input type="number" min={0} value={value} onChange={e => setValue(e.target.value)} style={inp} placeholder={mode.startsWith('pct') ? 'e.g. 5' : 'e.g. 20'} /></div>
        <div><label style={lbl}>Round to</label><select value={round} onChange={e => setRound(Number(e.target.value))} style={inp}><option value={0}>No rounding</option><option value={1}>Nearest ₹1</option><option value={5}>Nearest ₹5</option><option value={10}>Nearest ₹10</option></select></div>
      </div>
      <div style={{ maxHeight: 340, overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead><tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>{['', 'Product', 'Now', 'New', ''].map((h, i) => <th key={i} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 11, color: '#475569' }}>{h}</th>)}</tr></thead>
          <tbody>{rows.map(r => (
            <tr key={r.p.id} style={{ borderTop: '1px solid #f1f5f9', opacity: skip.has(r.p.id) ? .45 : 1 }}>
              <td style={{ padding: '5px 8px' }}><input type="checkbox" checked={!skip.has(r.p.id)} onChange={() => setSkip(s => { const x = new Set(s); x.has(r.p.id) ? x.delete(r.p.id) : x.add(r.p.id); return x })} /></td>
              <td style={{ padding: '5px 8px' }}><b>{r.p.name}</b>{r.p.size ? ` — ${r.p.size}` : ''}</td>
              <td style={{ padding: '5px 8px', color: '#64748b' }}>₹{n(r.old)}</td>
              <td style={{ padding: '5px 8px', fontWeight: 800, color: value === '' || r.nu === r.old ? '#94a3b8' : r.nu > r.old ? '#16a34a' : '#dc2626' }}>{value === '' ? '—' : `₹${n(r.nu)}`}</td>
              <td style={{ padding: '5px 8px', fontSize: 11, fontWeight: 700, color: '#b45309' }}>{value !== '' && r.warn ? `⚠ ${r.warn}` : ''}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button onClick={apply} disabled={busy || !todo.length} style={{ ...btn(busy || !todo.length ? '#94a3b8' : NAVY), flex: 1, padding: 12, fontSize: 14 }}>{busy ? `Updating… ${progress}/${todo.length}` : `Update ${todo.length} price${todo.length === 1 ? '' : 's'}`}</button>
        <button onClick={onClose} disabled={busy} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Cancel</button>
      </div>
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT INSIGHTS — 90-day sales, velocity, cover, recent bills
// ═══════════════════════════════════════════════════════════════════════════
function ProductInsights({ product, onClose }) {
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const from = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 90); return d.toLocaleDateString('en-CA') }, [])
  useEffect(() => {
    supabase.from('store_sale_items').select('qty, price, amount, store_sales!inner(sale_date, bill_no, status, customer_name, subtotal, total)')
      .eq('product_id', product.id).gte('store_sales.sale_date', from).limit(5000)
      .then(({ data, error }) => { if (error) setErr(error.message); setRows((data || []).filter(r => r.store_sales && r.store_sales.status !== 'void')) })
  }, [product.id, from])

  const s = useMemo(() => {
    if (!rows) return null
    const units = rows.reduce((a, r) => a + Number(r.qty), 0)
    const revenue = rows.reduce((a, r) => { const st = r.store_sales, ratio = Number(st.subtotal) > 0 ? Number(st.total) / Number(st.subtotal) : 1; return a + Number(r.amount) * ratio }, 0)
    const weeks = Array.from({ length: 13 }, (_, i) => { const end = new Date(); end.setDate(end.getDate() - (12 - i) * 7); const start = new Date(end); start.setDate(start.getDate() - 6); return { start: start.toLocaleDateString('en-CA'), end: end.toLocaleDateString('en-CA'), label: start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), u: 0 } })
    rows.forEach(r => { const w = weeks.find(w => r.store_sales.sale_date >= w.start && r.store_sales.sale_date <= w.end); if (w) w.u += Number(r.qty) })
    const perDay = units / 90
    const last = rows.map(r => r.store_sales.sale_date).sort().pop()
    const cost = product.cost_price != null ? Number(product.cost_price) * units : null
    return { units, revenue, weeks, perDay, cover: perDay > 0 ? Math.floor(product.stock / perDay) : null, last, profit: cost != null ? revenue - cost : null, bills: new Set(rows.map(r => r.store_sales.bill_no)).size }
  }, [rows, product])
  const max = s ? Math.max(1, ...s.weeks.map(w => w.u)) : 1
  const Kpi = ({ l, v, c = NAVY }) => <div style={{ background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}><div style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{l}</div><div style={{ fontSize: 18, fontWeight: 900, color: c }}>{v}</div></div>

  return (
    <Modal onClose={onClose} width={680}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div><div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '.06em' }}>SALES INSIGHTS · LAST 90 DAYS</div><div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{product.name}{product.size ? ` — ${product.size}` : ''}</div></div>
        <button onClick={onClose} style={btn('#f1f5f9', '#334155')}>Close</button>
      </div>
      {err ? <div style={{ color: '#b91c1c', fontSize: 13, marginTop: 12 }}>{err}</div> : !s ? <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 8, margin: '14px 0' }}>
            <Kpi l="Units sold" v={s.units} />
            <Kpi l="Revenue" v={`₹${n(Math.round(s.revenue))}`} c="#16a34a" />
            {s.profit != null && <Kpi l="Est. profit" v={`₹${n(Math.round(s.profit))}`} c="#0f766e" />}
            <Kpi l="Sells per week" v={(s.perDay * 7).toFixed(1)} />
            <Kpi l="Stock lasts" v={s.cover == null ? '—' : `${s.cover} days`} c={s.cover != null && s.cover < 14 ? '#dc2626' : NAVY} />
            <Kpi l="Last sold" v={s.last ? new Date(s.last + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Never'} c="#64748b" />
          </div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', marginBottom: 6 }}>Units per week</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110, borderBottom: '1px solid #e2e8f0' }}>
            {s.weeks.map(w => <div key={w.start} title={`${w.label}: ${w.u}`} style={{ flex: 1, height: `${Math.max(w.u ? 4 : 0, w.u / max * 100)}%`, background: '#2563eb', borderRadius: '3px 3px 0 0' }} />)}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>{s.weeks.map((w, i) => <div key={w.start} style={{ flex: 1, fontSize: 9, color: '#94a3b8', textAlign: 'center' }}>{i % 3 === 0 ? w.label : ''}</div>)}</div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#475569', margin: '14px 0 6px' }}>Recent bills ({s.bills})</div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {rows.slice().sort((a, b) => b.store_sales.sale_date.localeCompare(a.store_sales.sale_date)).slice(0, 25).map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
                <span><b style={{ fontFamily: 'monospace', color: NAVY }}>{r.store_sales.bill_no}</b> · {r.store_sales.sale_date} · {r.store_sales.customer_name || 'Walk-in'}</span><span>×{r.qty} · ₹{n(r.amount)}</span>
              </div>
            ))}
            {rows.length === 0 && <div style={{ color: '#94a3b8', fontSize: 12.5, padding: 10 }}>No sales in the last 90 days.</div>}
          </div>
        </>
      )}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// STOCK REQUESTS — parents waiting for out-of-stock items
// ═══════════════════════════════════════════════════════════════════════════
function StockRequestsModal({ requests, products, by, onClose, onChanged, showToast }) {
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products])
  const groups = useMemo(() => {
    const m = new Map()
    requests.forEach(r => { if (!m.has(r.product_id)) m.set(r.product_id, []); m.get(r.product_id).push(r) })
    return [...m.entries()].map(([pid, list]) => ({ p: byId.get(pid), pid, list })).sort((a, b) => ((b.p?.stock || 0) > 0) - ((a.p?.stock || 0) > 0) || b.list.length - a.list.length)
  }, [requests, byId])

  const mark = async (ids, status) => {
    const { error } = await supabase.from('store_stock_alerts').update({ status, notified_at: new Date().toISOString(), notified_by: by }).in('id', ids)
    if (error) { showToast('Update failed: ' + error.message, '#dc2626'); return }
    onChanged()
  }
  const msg = (r, p) => `Dear ${r.name || 'Parent'},\n\nGood news — *${p?.name}${p?.size ? ' (' + p.size + ')' : ''}* is back in stock at the GNSI Store (₹${n(p ? effPrice(p) : 0)}).\n\nOrder online for pickup, or buy at the institute counter.\n\n— GNSI Store, Guidance Navodaya & Sainik Institute, Khangabok`

  return (
    <Modal onClose={onClose} width={680}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>📣 Back-in-stock requests</div>
        <button onClick={onClose} style={btn('#f1f5f9', '#334155')}>Close</button>
      </div>
      <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 12 }}>Parents ask for these on the online store when an item is sold out. Message them when it's back — tapping WhatsApp marks them as told.</div>
      {groups.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No one is waiting right now ✓</div>}
      {groups.map(({ p, pid, list }) => {
        const inStock = (p?.stock || 0) > 0
        return (
          <div key={pid} style={{ ...card, padding: 12, marginBottom: 10, borderLeft: `4px solid ${inStock ? '#16a34a' : '#d97706'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <div><b>{p ? `${p.name}${p.size ? ' — ' + p.size : ''}` : 'Deleted product'}</b> <span style={{ fontSize: 11.5, fontWeight: 800, color: inStock ? '#16a34a' : '#d97706', marginLeft: 6 }}>{inStock ? `✓ ${p.stock} in stock now` : 'still out of stock'}</span></div>
              <div style={{ display: 'flex', gap: 6 }}>
                {inStock && <button onClick={() => mark(list.map(r => r.id), 'notified')} style={btn('#f0fdf4', '#166534', { padding: '4px 10px' })}>Mark all told</button>}
                <button onClick={() => window.confirm('Close these requests without messaging?') && mark(list.map(r => r.id), 'closed')} style={btn('#f1f5f9', '#64748b', { padding: '4px 10px' })}>Close</button>
              </div>
            </div>
            {list.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f1f5f9', marginTop: 6, fontSize: 12.5 }}>
                <span>{r.name || '—'} · <a href={`tel:${r.phone}`} style={{ color: NAVY }}>{r.phone}</a>{r.gcc_no ? ` · GCC-${r.gcc_no}` : ''} <span style={{ color: '#94a3b8' }}>· asked {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></span>
                {inStock && <a href={waLink(r.phone, msg(r, p))} target="_blank" rel="noopener noreferrer" onClick={() => mark([r.id], 'notified')} style={{ ...btn('#16a34a', 'white', { padding: '4px 10px' }), textDecoration: 'none' }}>💬 WhatsApp</a>}
              </div>
            ))}
          </div>
        )
      })}
    </Modal>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// KITS TAB — bundles like "Class 6 starter kit" (POS one-tap + online store)
// ═══════════════════════════════════════════════════════════════════════════
const EMPTY_KIT = { name: '', description: '', image_url: '', items: [], active: true, sort_order: 0 }
function KitsTab({ kits, ready, products, reload, showToast }) {
  const [editing, setEditing] = useState(null)
  const [f, setF] = useState(EMPTY_KIT)
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products])
  const kitTotal = items => items.reduce((a, i) => a + (byId.get(i.product_id) ? effPrice(byId.get(i.product_id)) * (Number(i.qty) || 1) : 0), 0)
  const kitShort = items => items.filter(i => { const p = byId.get(i.product_id); return !p || !p.active || p.stock < (Number(i.qty) || 1) })
  const hits = useMemo(() => { const s = q.trim().toLowerCase(); return s ? products.filter(p => p.active && [p.name, p.size, p.sku].some(v => (v || '').toLowerCase().includes(s))).slice(0, 8) : [] }, [q, products])

  const open = k => { setF(k ? { ...EMPTY_KIT, ...k, items: arr(k.items), description: k.description || '', image_url: k.image_url || '' } : EMPTY_KIT); setEditing(k || {}); setQ('') }
  const addItem = p => setF(x => x.items.some(i => i.product_id === p.id) ? { ...x, items: x.items.map(i => i.product_id === p.id ? { ...i, qty: i.qty + 1 } : i) } : { ...x, items: [...x.items, { product_id: p.id, qty: 1 }] })
  const save = async () => {
    if (!f.name.trim()) { showToast('Kit name is required.', '#dc2626'); return }
    if (!f.items.length) { showToast('Add at least one item.', '#dc2626'); return }
    setSaving(true)
    const row = { name: f.name.trim(), description: f.description.trim() || null, image_url: f.image_url.trim() || null, items: f.items.map(i => ({ product_id: i.product_id, qty: Math.max(1, Number(i.qty) || 1) })), active: !!f.active, sort_order: Number(f.sort_order) || 0, updated_at: new Date().toISOString() }
    const { error } = editing.id ? await supabase.from('store_kits').update(row).eq('id', editing.id) : await supabase.from('store_kits').insert([row])
    setSaving(false)
    if (error) { showToast('Save failed: ' + error.message, '#dc2626'); return }
    showToast(editing.id ? '✅ Kit updated' : '✅ Kit created'); setEditing(null); reload()
  }
  const remove = async k => {
    if (!window.confirm(`Delete kit "${k.name}"? Products are not affected.`)) return
    const { error } = await supabase.from('store_kits').delete().eq('id', k.id)
    if (error) { showToast('Delete failed: ' + error.message, '#dc2626'); return }
    reload()
  }

  if (!ready) return <div style={{ ...card, padding: 24, color: '#92400e', background: '#fffbeb', borderColor: '#fde68a' }}><b>Kits are not set up yet.</b><div style={{ fontSize: 13, marginTop: 6 }}>Run store_advanced.sql in the Supabase SQL Editor to enable this.</div></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ fontSize: 12.5, color: '#64748b', maxWidth: 620 }}>Kits group items parents usually buy together — e.g. <b>Class 6 starter kit</b>. They appear as one-tap buttons at the POS and as "Complete kits" on the online store. Items are charged at their own prices.</div>
        <button onClick={() => open(null)} style={btn(NAVY)}>+ New kit</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {kits.map(k => {
          const items = arr(k.items), short = kitShort(items)
          return (
            <div key={k.id} style={{ ...card, padding: 14, opacity: k.active ? 1 : .55 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 54, height: 54, borderRadius: 10, background: '#fbf6ea', display: 'grid', placeItems: 'center', fontSize: 24, overflow: 'hidden', flex: 'none' }}>{k.image_url ? <img src={k.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '🎒'}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, color: NAVY }}>{k.name}{!k.active && <span style={{ fontSize: 10, color: '#94a3b8', marginLeft: 6 }}>(hidden)</span>}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{items.length} items · ₹{n(kitTotal(items))}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: short.length ? '#d97706' : '#16a34a' }}>{short.length ? `⚠ ${short.length} item${short.length > 1 ? 's' : ''} short of stock` : '✓ All in stock'}</div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 8, lineHeight: 1.5 }}>{items.map(i => { const p = byId.get(i.product_id); return p ? `${p.name}${p.size ? ' ' + p.size : ''} ×${i.qty}` : 'Removed product' }).join(' · ')}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button onClick={() => open(k)} style={btn('#f1f5f9', '#334155', { padding: '4px 10px' })}>Edit</button>
                <button onClick={() => remove(k)} style={btn('#fef2f2', '#dc2626', { padding: '4px 10px' })}>Delete</button>
              </div>
            </div>
          )
        })}
        {kits.length === 0 && <div style={{ ...card, padding: 30, textAlign: 'center', color: '#94a3b8', gridColumn: '1/-1' }}>No kits yet — create your first one.</div>}
      </div>

      {editing && (
        <Modal onClose={() => !saving && setEditing(null)} busy={saving} width={600}>
          <div style={{ fontSize: 16, fontWeight: 800, color: NAVY, marginBottom: 12 }}>{editing.id ? 'Edit kit' : 'New kit'}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Kit name *</label><input value={f.name} onChange={e => setF(x => ({ ...x, name: e.target.value }))} style={inp} placeholder="e.g. Class 6 JNVST starter kit" /></div>
            <div style={{ gridColumn: '1/-1' }}><label style={lbl}>Description</label><textarea rows={2} value={f.description} onChange={e => setF(x => ({ ...x, description: e.target.value }))} style={{ ...inp, resize: 'vertical' }} placeholder="Who it's for and what's inside" /></div>
            <div><label style={lbl}>Image link</label><input value={f.image_url} onChange={e => setF(x => ({ ...x, image_url: e.target.value }))} style={inp} placeholder="https://…" /></div>
            <div><label style={lbl}>Order on store</label><input type="number" value={f.sort_order} onChange={e => setF(x => ({ ...x, sort_order: e.target.value }))} style={inp} /></div>
          </div>
          <label style={lbl}><span style={{ display: 'block', marginTop: 12 }}>Items</span></label>
          <div style={{ position: 'relative' }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search a product to add" style={inp} onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { addItem(hits[0]); setQ('') } }} />
            {hits.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
                {hits.map(p => <div key={p.id} onClick={() => { addItem(p); setQ('') }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}><b>{p.name}</b>{p.size ? ` — ${p.size}` : ''} <span style={{ color: '#94a3b8' }}>· ₹{n(effPrice(p))} · stock {p.stock}</span></div>)}
              </div>
            )}
          </div>
          {f.items.map(i => { const p = byId.get(i.product_id); return (
            <div key={i.product_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
              <div style={{ flex: 1 }}><b>{p?.name || 'Removed product'}</b>{p?.size ? ` — ${p.size}` : ''} <span style={{ color: '#94a3b8', fontSize: 11.5 }}>₹{n(p ? effPrice(p) : 0)}</span></div>
              <input type="number" min={1} value={i.qty} onChange={e => setF(x => ({ ...x, items: x.items.map(y => y.product_id === i.product_id ? { ...y, qty: e.target.value } : y) }))} style={{ ...inp, width: 70, padding: '5px 8px' }} />
              <button onClick={() => setF(x => ({ ...x, items: x.items.filter(y => y.product_id !== i.product_id) }))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ) })}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={f.active} onChange={e => setF(x => ({ ...x, active: e.target.checked }))} /> Show at POS &amp; online</label>
            <b style={{ color: NAVY }}>Kit total ₹{n(kitTotal(f.items))}</b>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={save} disabled={saving} style={{ ...btn(NAVY), flex: 1, padding: 12, fontSize: 14 }}>{saving ? 'Saving…' : 'Save kit'}</button>
            <button onClick={() => setEditing(null)} disabled={saving} style={btn('#f1f5f9', '#334155', { padding: '12px 20px' })}>Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASES TAB — suppliers, goods received (GRN), smart reorder (admin only)
// ═══════════════════════════════════════════════════════════════════════════
const printGRN = p => openPrint(p.purchase_no, `${HEADER_HTML('Goods received note')}
<table style="margin-top:12px"><tr><td>GRN: <b>${esc(p.purchase_no)}</b></td><td>Date: ${esc(p.purchase_date)}</td></tr>
<tr><td>Supplier: <b>${esc(p.supplier_name || '—')}</b></td><td>Supplier invoice: ${esc(p.invoice_no || '—')}</td></tr></table>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Cost</th><th class="r">Amount</th></tr></thead><tbody>
${(p.items || []).map((i, k) => `<tr><td>${k + 1}</td><td>${esc(i.name)}${i.size ? ' — ' + esc(i.size) : ''}</td><td class="r">${i.qty}</td><td class="r">₹${n(i.cost)}</td><td class="r">₹${n(i.amount)}</td></tr>`).join('')}
<tr><td colspan="4" class="b">Total</td><td class="r b">₹${n(p.total)}</td></tr>
<tr><td colspan="4">Paid${p.pay_mode ? ' (' + esc(p.pay_mode) + ')' : ''}</td><td class="r">₹${n(p.paid)}</td></tr>
<tr><td colspan="4" class="b">Balance payable</td><td class="r b">₹${n(Number(p.total) - Number(p.paid))}</td></tr></tbody></table>
${p.note ? `<div class="s" style="margin-top:8px">Note: ${esc(p.note)}</div>` : ''}
<div class="s" style="margin-top:26px">Received by ${esc(p.created_by || '')} ____________________</div>`)

function PurchasesTab({ products, currentUser, reload, showToast }) {
  const by = staffName(currentUser)
  const [suppliers, setSuppliers] = useState([])
  const [purchases, setPurchases] = useState([])
  const [velocity, setVelocity] = useState({})
  const [missing, setMissing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ supplier_id: '', invoice_no: '', purchase_date: todayStr(), paid: '', pay_mode: 'Cash', note: '' })
  const [lines, setLines] = useState([]) // [{product_id, qty, cost}]
  const [pq, setPq] = useState('')
  const [saving, setSaving] = useState(false)
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products])

  const load = useCallback(async () => {
    setLoading(true)
    const [s, p, v] = await Promise.all([
      supabase.from('store_suppliers').select('*').order('name'),
      supabase.from('store_purchases').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('store_best_sellers').select('*'),
    ])
    if (isMissingTable(s.error) || isMissingTable(p.error)) { setMissing(true); setLoading(false); return }
    if (s.error || p.error) showToast('Could not load purchases: ' + (s.error || p.error).message, '#dc2626')
    setSuppliers(s.data || []); setPurchases(p.data || [])
    setVelocity(Object.fromEntries((v.data || []).map(b => [b.product_id, Number(b.qty_sold_30d) || 0])))
    setLoading(false)
  }, [showToast])
  useEffect(() => { load() }, [load])

  // Reorder suggestion: cover 30 days of sales + the safety level, minus what's on the shelf.
  const suggestions = useMemo(() => products.filter(p => p.active).map(p => {
    const perDay = (velocity[p.id] || 0) / 30
    const cover = perDay > 0 ? Math.floor(p.stock / perDay) : null
    const level = p.reorder_level ?? 5
    const need = Math.ceil(perDay * 30) + level - p.stock
    const urgent = p.stock <= level || (cover != null && cover < 14)
    return { p, perDay, cover, qty: Math.max(need, urgent ? level : 0), urgent }
  }).filter(x => x.urgent && x.qty > 0).sort((a, b) => (a.cover ?? 999) - (b.cover ?? 999) || a.p.stock - b.p.stock), [products, velocity])

  const addLine = (p, qty = 1) => setLines(ls => ls.some(l => l.product_id === p.id)
    ? ls.map(l => l.product_id === p.id ? { ...l, qty: Number(l.qty) + qty } : l)
    : [...ls, { product_id: p.id, qty, cost: p.cost_price ?? '' }])
  const setLine = (id, k, v) => setLines(ls => ls.map(l => l.product_id === id ? { ...l, [k]: v } : l))
  const total = lines.reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0)
  const hits = useMemo(() => {
    const s = pq.trim().toLowerCase()
    return s ? products.filter(p => [p.name, p.size, p.sku, p.barcode].some(v => (v || '').toLowerCase().includes(s))).slice(0, 8) : []
  }, [products, pq])

  const addSupplier = async () => {
    const name = window.prompt('Supplier name:')
    if (!name?.trim()) return
    const phone = window.prompt('Phone (optional):') || null
    const gstin = window.prompt('GSTIN (optional):') || null
    const { data, error } = await supabase.from('store_suppliers').insert([{ name: name.trim(), phone, gstin }]).select().single()
    if (error) { showToast('Could not add supplier: ' + error.message, '#dc2626'); return }
    await load(); setForm(f => ({ ...f, supplier_id: String(data.id) }))
  }

  const save = async () => {
    if (!lines.length) { showToast('Add at least one item.', '#dc2626'); return }
    if (lines.some(l => !(Number(l.qty) > 0))) { showToast('Every line needs a quantity.', '#dc2626'); return }
    const paid = Math.min(Number(form.paid) || 0, total)
    const sup = suppliers.find(s => String(s.id) === String(form.supplier_id))
    setSaving(true)
    const { data, error } = await supabase.rpc('store_record_purchase', { p: {
      supplier_id: sup?.id ?? '', supplier_name: sup?.name || 'Unspecified', invoice_no: form.invoice_no.trim(), purchase_date: form.purchase_date,
      paid, pay_mode: paid > 0 ? form.pay_mode : null, note: form.note.trim(), by,
      items: lines.map(l => ({ product_id: l.product_id, qty: Number(l.qty), cost: Number(l.cost) || 0 })),
    } })
    if (error) { setSaving(false); showToast('Purchase failed: ' + error.message, '#dc2626'); return }
    const posted = await postToAccounts({ amount: paid, date: form.purchase_date, type: 'Expense', category: 'Store Purchases',
      desc: `Store purchase ${data.purchase_no} — ${sup?.name || 'supplier'}${form.invoice_no ? ' inv ' + form.invoice_no : ''}`, ref: `store_${data.purchase_no}_pay0` })
    setSaving(false)
    showToast(posted ? `✅ ${data.purchase_no} · ₹${n(data.total)} received into stock` : 'Stock received, but posting the payment to Accounts failed.', posted ? '#16a34a' : '#d97706')
    const { data: full } = await supabase.from('store_purchases').select('*').eq('id', data.id).single()
    if (full) printGRN(full)
    setLines([]); setForm({ supplier_id: form.supplier_id, invoice_no: '', purchase_date: todayStr(), paid: '', pay_mode: 'Cash', note: '' })
    load(); reload()
  }

  // Purchase order to the supplier — print/PDF plus a WhatsApp copy (nothing is saved or stocked).
  const draftPO = () => {
    const sup = suppliers.find(s => String(s.id) === String(form.supplier_id))
    if (!sup) { showToast('Choose the supplier first.', '#dc2626'); return }
    const poNo = `PO-${todayStr().replace(/-/g, '').slice(2)}-${String(Date.now()).slice(-4)}`
    const rows = lines.map(l => ({ p: byId.get(l.product_id), qty: Number(l.qty) || 0, cost: Number(l.cost) || 0 }))
    openPrint(poNo, `${HEADER_HTML('Purchase order')}
<table style="margin-top:12px"><tr><td>PO no: <b>${poNo}</b></td><td>Date: ${todayStr()}</td></tr>
<tr><td>To: <b>${esc(sup.name)}</b>${sup.phone ? ' · ' + esc(sup.phone) : ''}${sup.gstin ? '<br/>GSTIN ' + esc(sup.gstin) : ''}</td><td>Deliver to: GNSI Store, Khangabok, Thoubal, Manipur</td></tr></table>
<table><thead><tr><th>#</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>
${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.p?.name)}${r.p?.size ? ' — ' + esc(r.p.size) : ''}${r.p?.sku ? ' <span class="s">(' + esc(r.p.sku) + ')</span>' : ''}</td><td class="r">${r.qty}</td><td class="r">${r.cost ? '₹' + n(r.cost) : '—'}</td><td class="r">${r.cost ? '₹' + n(r.qty * r.cost) : '—'}</td></tr>`).join('')}
<tr><td colspan="4" class="b">Estimated total</td><td class="r b">₹${n(total)}</td></tr></tbody></table>
<div class="s" style="margin-top:10px">Please confirm availability, rates and delivery date. Quote ${poNo} on your invoice.</div>
<div class="s" style="margin-top:26px">Authorised by ____________________</div>`)
    if (sup.phone) {
      const text = `*Purchase order ${poNo}* — GNSI Store, Khangabok\n\n${rows.map((r, i) => `${i + 1}. ${r.p?.name}${r.p?.size ? ' (' + r.p.size + ')' : ''} — ${r.qty}${r.cost ? ' @ ₹' + n(r.cost) : ''}`).join('\n')}\n\nEstimated total: ₹${n(total)}\nPlease confirm availability, rates and delivery date.`
      window.open(waLink(sup.phone, text), '_blank', 'noopener')
    }
  }

  const payable = useMemo(() => {
    const m = {}
    purchases.forEach(p => { const k = p.supplier_id ?? 'none'; m[k] = m[k] || { total: 0, paid: 0 }; m[k].total += Number(p.total); m[k].paid += Number(p.paid) })
    return m
  }, [purchases])

  if (missing) return <div style={{ ...card, padding: 24, color: '#92400e', background: '#fffbeb', borderColor: '#fde68a' }}><b>Purchases are not set up yet.</b><div style={{ fontSize: 13, marginTop: 6 }}>{MIGRATION_HINT}</div></div>
  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div>

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {/* Smart reorder */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>🧠 Reorder suggestions ({suggestions.length})</div>
            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Items at/below their alert level or with under 14 days of stock at the last-30-day sales rate. Qty covers 30 days + alert level.</div>
          </div>
          {suggestions.length > 0 && <button onClick={() => suggestions.forEach(s => addLine(s.p, s.qty))} style={btn(NAVY)}>+ Add all to purchase</button>}
        </div>
        {suggestions.length === 0 ? <div style={{ color: '#16a34a', fontSize: 13 }}>Nothing needs reordering ✓</div> : (
          <div style={{ maxHeight: 250, overflowY: 'auto' }}>
            {suggestions.map(({ p, perDay, cover, qty }) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
                <div style={{ flex: 1 }}>
                  <b>{p.name}</b>{p.size ? ` — ${p.size}` : ''}
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    Stock <b style={{ color: p.stock <= 0 ? '#dc2626' : '#d97706' }}>{p.stock}</b> · sells {perDay ? (perDay * 7).toFixed(1) + '/week' : 'rarely'}{cover != null ? ` · ~${cover} day${cover === 1 ? '' : 's'} left` : ''}
                  </div>
                </div>
                <span style={{ fontWeight: 800, color: NAVY }}>order {qty}</span>
                <button onClick={() => addLine(p, qty)} style={btn('#eff6ff', NAVY, { padding: '4px 10px' })}>+ Add</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New purchase */}
      <div style={{ ...card, padding: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: NAVY, marginBottom: 12 }}>📥 Receive stock (new purchase)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Supplier</label>
            <div style={{ display: 'flex', gap: 5 }}>
              <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))} style={inp}>
                <option value="">— Select —</option>{suppliers.filter(s => s.active !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button onClick={addSupplier} title="New supplier" style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0', padding: '0 11px' })}>+</button>
            </div>
          </div>
          <div><label style={lbl}>Supplier invoice no.</label><input value={form.invoice_no} onChange={e => setForm(f => ({ ...f, invoice_no: e.target.value }))} style={inp} /></div>
          <div><label style={lbl}>Date</label><input type="date" value={form.purchase_date} onChange={e => setForm(f => ({ ...f, purchase_date: e.target.value }))} style={inp} /></div>
        </div>
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input value={pq} onChange={e => setPq(e.target.value)} placeholder="🔍 Add item — search name, SKU or barcode" style={inp}
            onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { addLine(hits[0]); setPq('') } }} />
          {hits.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #d1d5db', borderRadius: 8, zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,.12)' }}>
              {hits.map(p => (
                <div key={p.id} onClick={() => { addLine(p); setPq('') }} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                  <b>{p.name}</b>{p.size ? ` — ${p.size}` : ''} <span style={{ color: '#94a3b8' }}>· stock {p.stock}{p.cost_price != null ? ` · last cost ₹${n(p.cost_price)}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {lines.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 520 }}>
              <thead><tr style={{ background: '#f8fafc' }}>{['Item', 'Qty', 'Cost ₹ / unit', 'Amount', ''].map(h => <th key={h} style={{ padding: '7px 8px', textAlign: 'left', fontSize: 11, color: '#475569' }}>{h}</th>)}</tr></thead>
              <tbody>
                {lines.map(l => {
                  const p = byId.get(l.product_id)
                  const m = p && Number(l.cost) > 0 ? Math.round((effPrice(p) - Number(l.cost)) / effPrice(p) * 100) : null
                  return (
                    <tr key={l.product_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px' }}><b>{p?.name}</b>{p?.size ? ` — ${p.size}` : ''}<div style={{ fontSize: 10.5, color: '#94a3b8' }}>sells at ₹{n(p ? effPrice(p) : 0)}{m != null ? ` · margin ${m}%` : ''}</div></td>
                      <td style={{ padding: '4px 8px' }}><input type="number" min={1} value={l.qty} onChange={e => setLine(l.product_id, 'qty', e.target.value)} style={{ ...inp, width: 80, padding: '5px 8px' }} /></td>
                      <td style={{ padding: '4px 8px' }}><input type="number" min={0} value={l.cost} onChange={e => setLine(l.product_id, 'cost', e.target.value)} style={{ ...inp, width: 100, padding: '5px 8px', borderColor: m != null && m < 0 ? '#fca5a5' : '#d1d5db' }} /></td>
                      <td style={{ padding: '6px 8px', fontWeight: 800 }}>₹{n((Number(l.qty) || 0) * (Number(l.cost) || 0))}</td>
                      <td style={{ padding: '6px 8px' }}><button onClick={() => setLines(ls => ls.filter(x => x.product_id !== l.product_id))} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15 }}>×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10, marginTop: 12, alignItems: 'end' }}>
          <div><label style={lbl}>Paid now ₹</label><input type="number" min={0} value={form.paid} onChange={e => setForm(f => ({ ...f, paid: e.target.value }))} placeholder="0 = on credit" style={inp} /></div>
          <div><label style={lbl}>Mode</label><select value={form.pay_mode} onChange={e => setForm(f => ({ ...f, pay_mode: e.target.value }))} style={inp}>{PAY_MODES.map(m => <option key={m}>{m}</option>)}</select></div>
          <div style={{ gridColumn: 'span 2' }}><label style={lbl}>Note</label><input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} style={inp} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: NAVY }}>Total ₹{n(total)}{Number(form.paid) > 0 && Number(form.paid) < total && <span style={{ fontSize: 12, color: '#dc2626', marginLeft: 10 }}>balance ₹{n(total - Number(form.paid))} on credit</span>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {lines.length > 0 && <button onClick={() => setLines([])} style={btn('#f1f5f9', '#334155')}>Clear</button>}
            {lines.length > 0 && <button onClick={draftPO} style={btn('#eff6ff', NAVY, { padding: '11px 16px', fontSize: 13 })}>📄 Send purchase order</button>}
            <button onClick={save} disabled={saving || !lines.length} style={btn(saving || !lines.length ? '#94a3b8' : '#16a34a', 'white', { padding: '11px 20px', fontSize: 13 })}>{saving ? 'Saving…' : 'Receive stock & print GRN'}</button>
          </div>
        </div>
      </div>

      {/* History + suppliers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18, alignItems: 'start' }}>
        <div style={{ ...card, overflow: 'auto', gridColumn: 'span 2' }}>
          <div style={{ padding: '12px 14px', fontSize: 14, fontWeight: 800, color: NAVY }}>🧾 Purchase history</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 620 }}>
            <thead><tr style={{ background: NAVY }}>{['GRN', 'Date', 'Supplier', 'Invoice', 'Items', 'Total', 'Balance', ''].map(h => <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'white', fontSize: 11 }}>{h}</th>)}</tr></thead>
            <tbody>
              {purchases.map(p => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: NAVY }}>{p.purchase_no}</td>
                  <td style={{ padding: '7px 10px', color: '#64748b' }}>{p.purchase_date}</td>
                  <td style={{ padding: '7px 10px' }}>{p.supplier_name || '—'}</td>
                  <td style={{ padding: '7px 10px', color: '#64748b' }}>{p.invoice_no || '—'}</td>
                  <td style={{ padding: '7px 10px' }}>{(p.items || []).reduce((a, i) => a + i.qty, 0)}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 800 }}>₹{n(p.total)}</td>
                  <td style={{ padding: '7px 10px', fontWeight: 700, color: Number(p.total) > Number(p.paid) ? '#dc2626' : '#94a3b8' }}>{Number(p.total) > Number(p.paid) ? `₹${n(Number(p.total) - Number(p.paid))}` : '—'}</td>
                  <td style={{ padding: '7px 10px' }}><button onClick={() => printGRN(p)} style={btn('#f1f5f9', '#334155', { padding: '4px 9px' })}>🖨</button></td>
                </tr>
              ))}
              {purchases.length === 0 && <tr><td colSpan={8} style={{ padding: 30, textAlign: 'center', color: '#94a3b8' }}>No purchases recorded yet</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ ...card, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: NAVY }}>🏭 Suppliers</div>
            <button onClick={addSupplier} style={btn(NAVY, 'white', { padding: '5px 11px' })}>+ Add</button>
          </div>
          {suppliers.map(s => {
            const pay = payable[s.id] || { total: 0, paid: 0 }
            return (
              <div key={s.id} style={{ padding: '7px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <b>{s.name}</b>
                  {pay.total - pay.paid > 0 && <span style={{ fontWeight: 800, color: '#dc2626' }}>owe ₹{n(pay.total - pay.paid)}</span>}
                </div>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  {s.phone ? <a href={`tel:${s.phone}`} style={{ color: NAVY }}>{s.phone}</a> : 'no phone'}{s.gstin ? ` · GSTIN ${s.gstin}` : ''} · bought ₹{n(pay.total)}
                </div>
              </div>
            )
          })}
          {suppliers.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: '#94a3b8', fontSize: 12.5 }}>No suppliers yet</div>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ROOT
// ═══════════════════════════════════════════════════════════════════════════
export default function Store() {
  const w = useWindowWidth()
  const isMobile = w < 768
  const currentUser = useMemo(() => {
    try { const s = localStorage.getItem('gnsi_session'); return s ? JSON.parse(s).user : {} } catch { return {} }
  }, [])
  const isAdmin = isAdminRole(currentUser?.role)

  const [tab, setTab] = useState('pos')
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [toast, setToast] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOrders, setNewOrders] = useState(0)
  const [kits, setKits] = useState([])
  const [kitsReady, setKitsReady] = useState(false)
  const [requests, setRequests] = useState([]) // waiting back-in-stock requests
  const [showRequests, setShowRequests] = useState(false)
  const [liveTick, setLiveTick] = useState(0)
  const [alertsOn, setAlertsOn] = useState(() => { try { return localStorage.getItem('gnsi_store_alerts') !== 'off' } catch { return true } })
  const seenOrders = useRef(null)

  const showToast = useCallback((msg, color = '#16a34a') => {
    setToast({ msg, color })
    setTimeout(() => setToast(null), 3800)
  }, [])

  const reload = useCallback(async () => {
    const [p, c] = await Promise.all([
      supabase.from('store_products').select('*').order('name').limit(5000),
      supabase.from('store_categories').select('*').order('sort_order'),
    ])
    if (p.error || c.error) { setLoadError((p.error || c.error).message); return }
    setLoadError(null); setProducts(p.data || []); setCategories(c.data || [])
    const { count } = await supabase.from('store_orders').select('id', { count: 'exact', head: true }).eq('status', 'new')
    setNewOrders(count || 0)
    const [k, r] = await Promise.all([
      supabase.from('store_kits').select('*').order('sort_order').order('name'),
      supabase.from('store_stock_alerts').select('*').eq('status', 'waiting').order('created_at'),
    ])
    setKitsReady(!k.error); setKits(k.error ? [] : k.data || []); setRequests(r.error ? [] : r.data || [])
  }, [])

  // ── Live order alerts: Supabase Realtime, with a 45-second check as backup ──
  const alertsRef = useRef(alertsOn); alertsRef.current = alertsOn
  useEffect(() => {
    let alive = true
    const announce = o => {
      if (!alive || !o?.id || seenOrders.current?.has(o.id)) return
      seenOrders.current?.add(o.id)
      setNewOrders(c => c + 1); setLiveTick(t => t + 1)
      showToast(`🔔 New online order ${o.order_no || ''} · ${o.customer_name || ''} · ₹${n(o.total)}`, '#1d4ed8')
      if (!alertsRef.current) return
      chime()
      try { if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) new Notification('New GNSI Store order', { body: `${o.order_no} · ${o.customer_name} · ₹${n(o.total)}`, tag: String(o.id) }) } catch {}
    }
    const latest = () => supabase.from('store_orders').select('id,order_no,customer_name,total').order('created_at', { ascending: false }).limit(10)
    latest().then(({ data }) => { seenOrders.current = new Set((data || []).map(o => o.id)) })
    let ch = null
    try { ch = supabase.channel('gnsi-store-orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'store_orders' }, p => announce(p.new)).subscribe() } catch {}
    const t = setInterval(() => { if (seenOrders.current) latest().then(({ data }) => (data || []).slice().reverse().forEach(announce)) }, 45000)
    return () => { alive = false; clearInterval(t); try { ch && supabase.removeChannel(ch) } catch {} }
  }, [showToast])

  const toggleAlerts = async () => {
    const on = !alertsOn
    setAlertsOn(on); try { localStorage.setItem('gnsi_store_alerts', on ? 'on' : 'off') } catch {}
    if (on) { chime(); try { if (typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission() } catch {} }
    showToast(on ? '🔔 Order alerts on — sound + desktop notification' : '🔕 Order alerts muted', on ? '#16a34a' : '#64748b')
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reload()
      try { const s = await getActiveStudents('*'); if (!cancelled) setStudents(s || []) } catch (e) { console.error('Store: students load failed', e.message) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [reload])

  const onSaleDone = useCallback(() => { reload(); setRefreshKey(k => k + 1) }, [reload])

  const lowStockCount = useMemo(() => products.filter(p => p.active && p.stock <= (p.reorder_level ?? 5)).length, [products])
  const restocked = useMemo(() => { const m = new Map(products.map(p => [p.id, p])); return requests.filter(r => (m.get(r.product_id)?.stock || 0) > 0) }, [requests, products])

  const TABS = [
    { id: 'pos', label: '🛒 Counter POS' },
    { id: 'products', label: '📦 Products & Stock' },
    { id: 'orders', label: `🌐 Online Orders${newOrders ? ` (${newOrders})` : ''}` },
    { id: 'sales', label: '🧾 Sales' },
    ...(isAdmin ? [{ id: 'purchases', label: '📥 Purchases' }, { id: 'kits', label: '🎒 Kits' }, { id: 'promotions', label: '🏷️ Promotions' }] : []),
    { id: 'reports', label: '📊 Reports' },
  ]

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 24, fontFamily: 'system-ui,sans-serif' }}>
      <Toast toast={toast} />
      <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 'bold', color: NAVY, margin: 0 }}>🏬 GNSI Store</h1>
          <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Uniforms · Books · Hostel items — counter billing, stock, online orders</p>
        </div>
        <button onClick={toggleAlerts} title="Sound + desktop notification for new online orders"
          style={btn(alertsOn ? '#eff6ff' : '#f1f5f9', alertsOn ? '#1d4ed8' : '#64748b', { border: `1px solid ${alertsOn ? '#bfdbfe' : '#e2e8f0'}` })}>{alertsOn ? '🔔 Order alerts on' : '🔕 Order alerts off'}</button>
      </div>

      {!loading && !loadError && (newOrders > 0 || lowStockCount > 0 || restocked.length > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {newOrders > 0 && (
            <button onClick={() => setTab('orders')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              🔔 {newOrders} new online order{newOrders > 1 ? 's' : ''} to confirm
            </button>
          )}
          {restocked.length > 0 && (
            <button onClick={() => setShowRequests(true)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #86efac', background: '#f0fdf4', color: '#166534', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              📣 {restocked.length} parent{restocked.length > 1 ? 's' : ''} waiting — item{restocked.length > 1 ? 's' : ''} back in stock
            </button>
          )}
          {lowStockCount > 0 && (
            <button onClick={() => setTab('reports')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #fca5a5', background: '#fef2f2', color: '#b91c1c', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              ⚠️ {lowStockCount} item{lowStockCount > 1 ? 's' : ''} low or out of stock
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', borderBottom: '2px solid #e2e8f0', marginBottom: 22, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '9px 20px', border: 'none', borderBottom: tab === t.id ? `3px solid ${NAVY}` : '3px solid transparent', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? NAVY : '#64748b', marginBottom: -2, whiteSpace: 'nowrap' }}>
            {t.label}
          </button>
        ))}
      </div>

      {loadError ? (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: 24, color: '#991B1B' }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Store tables not ready</div>
          <div style={{ fontSize: 13 }}>{loadError}</div>
          <div style={{ fontSize: 12, marginTop: 8 }}>Run <code>store_schema.sql</code> in the Supabase SQL Editor, then reload.</div>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>⏳ Loading store…</div>
      ) : (
        <>
          {tab === 'pos' && <POSTab products={products} categories={categories} students={students} kits={kits} isAdmin={isAdmin} currentUser={currentUser} onSaleDone={onSaleDone} showToast={showToast} />}
          {tab === 'products' && <ProductsTab products={products} categories={categories} isAdmin={isAdmin} currentUser={currentUser} reload={reload} showToast={showToast} requestCount={requests.length} onRequests={() => setShowRequests(true)} />}
          {tab === 'orders' && <OrdersTab currentUser={currentUser} showToast={showToast} onSaleDone={onSaleDone} liveTick={liveTick} />}
          {tab === 'sales' && <SalesTab isAdmin={isAdmin} currentUser={currentUser} showToast={showToast} onSaleDone={onSaleDone} refreshKey={refreshKey} />}
          {tab === 'purchases' && isAdmin && <PurchasesTab products={products} currentUser={currentUser} reload={reload} showToast={showToast} />}
          {tab === 'kits' && isAdmin && <KitsTab kits={kits} ready={kitsReady} products={products} reload={reload} showToast={showToast} />}
          {tab === 'promotions' && isAdmin && <PromotionsTab currentUser={currentUser} showToast={showToast} />}
          {tab === 'reports' && <ReportsTab products={products} categories={categories} refreshKey={refreshKey} />}
        </>
      )}
      {showRequests && <StockRequestsModal requests={requests} products={products} by={staffName(currentUser)} onClose={() => setShowRequests(false)} onChanged={reload} showToast={showToast} />}
    </div>
  )
}
import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { getActiveStudents } from './studentQueries'
import { isAdminRole } from './roles'
import { gccStr } from './feeEngine'

// ═══════════════════════════════════════════════════════════════════════════
// GNSI Store — counter POS, inventory, online orders, sales, reports.
// Run store_schema.sql in Supabase first.
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

const inp = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box', background: 'white' }
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
    <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 99999, background: 'white', border: '1px solid #e2e8f0', borderLeft: `3px solid ${toast.color}`, borderRadius: 10, padding: '11px 16px', fontSize: 13, fontWeight: 600, boxShadow: '0 8px 32px rgba(0,0,0,.12)', maxWidth: 340, color: '#1e293b' }}>
      {toast.msg}
    </div>
  )
}

// ── Accounts posting ────────────────────────────────────────────────────────
// Posts store income to the same `accounts` ledger the Fees module feeds.
// If your accounts table uses different column names, only this function
// needs adjusting — sales still save either way (account_posted stays false).
async function postToAccounts({ amount, date, desc, ref }) {
  if (!(amount > 0)) return true
  const { error } = await supabase.from('accounts').insert([{
    entry_date: date, type: 'Income', amount, category: 'Store Sales',
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
function POSTab({ products, categories, students, isAdmin, currentUser, onSaleDone, showToast }) {
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
    setPromoCode(''); setPromoResult(null); setRedeemPts(''); setLoyaltyBalance(null)
  }

  const checkout = async () => {
    if (!lines.length || saving) return
    if (!collectedBy.trim()) { showToast('Collected By is required.', '#dc2626'); return }
    if (custType === 'student' && !student) { showToast('Select the student for this bill.', '#dc2626'); return }
    if (dueNum > 0 && custType !== 'student') { showToast('Part-payment is only allowed on a student account.', '#dc2626'); return }
    if (paidNum > 0 && payMode !== 'Cash' && !txnRef.trim()) { showToast(`Transaction reference required for ${payMode}.`, '#dc2626'); return }

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

      printBill(data)
      reset()
      onSaleDone()
    } catch (err) {
      showToast('Sale failed: ' + err.message, '#dc2626')
    }
    setSaving(false)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.6fr 1fr', gap: 18, alignItems: 'start' }}>
      {/* Catalogue */}
      <div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onSearchKey}
            placeholder="🔍 Search name / size — or scan barcode & press Enter" style={{ ...inp, flex: 1, minWidth: 220 }} />
        </div>
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
          {lines.length > 0 && <button onClick={reset} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Clear</button>}
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
const EMPTY_PRODUCT = { name: '', sku: '', barcode: '', category_id: '', price: '', mrp: '', size: '', sizes: '', stock: '', reorder_level: '5', unit: 'pc', description: '', image_url: '', online_visible: true, active: true, sale_price: '', sale_starts: '', sale_ends: '' }

function ProductsTab({ products, categories, isAdmin, currentUser, reload, showToast }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [stockF, setStockF] = useState('All')
  const [editing, setEditing] = useState(null) // product object or {} for new
  const [form, setForm] = useState(EMPTY_PRODUCT)
  const [saving, setSaving] = useState(false)
  const [newCat, setNewCat] = useState('')
  const byCat = useMemo(() => new Map(categories.map(c => [c.id, c.name])), [categories])
  const by = currentUser?.userName || currentUser?.name || 'Admin'

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
    setForm({ ...EMPTY_PRODUCT, ...p, category_id: p.category_id ?? '', price: p.price ?? '', mrp: p.mrp ?? '', size: p.size ?? '', sizes: '', stock: p.stock, reorder_level: p.reorder_level ?? '', sku: p.sku ?? '', barcode: p.barcode ?? '', description: p.description ?? '', image_url: p.image_url ?? '',
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
              {['Product', 'Category', 'SKU / Barcode', 'Price', 'MRP', 'Stock', 'Online', ''].map(h => <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'white', fontSize: 11, fontWeight: 700 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(p => {
              const out = p.stock <= 0, low = !out && p.stock <= (p.reorder_level ?? 5)
              const price = effPrice(p), onSale = price < Number(p.price)
              return (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: p.active ? 1 : .5 }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: '#1e293b' }}>{p.name}{p.size ? ` — ${p.size}` : ''}{!p.active && <span style={{ marginLeft: 6, fontSize: 10, color: '#94a3b8' }}>(inactive)</span>}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b', fontSize: 12 }}>{byCat.get(p.category_id) || '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace', fontSize: 11 }}>{p.sku || '—'}{p.barcode ? ` · ${p.barcode}` : ''}</td>
                  <td style={{ padding: '9px 12px', fontWeight: 800, color: onSale ? '#dc2626' : NAVY }}>₹{n(price)}{onSale && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: 'white', background: '#dc2626', padding: '1px 5px', borderRadius: 4 }}>SALE</span>}</td>
                  <td style={{ padding: '9px 12px', color: '#94a3b8' }}>{onSale ? <span style={{ textDecoration: 'line-through' }}>₹{n(p.price)}</span> : p.mrp ? `₹${n(p.mrp)}` : '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <span style={{ fontWeight: 800, color: out ? '#dc2626' : low ? '#d97706' : '#16a34a' }}>{p.stock}</span>
                    {out && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#dc2626' }}>OUT</span>}
                    {low && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#d97706' }}>LOW</span>}
                  </td>
                  <td style={{ padding: '9px 12px', fontSize: 12 }}>{p.online_visible ? '🌐 Yes' : '—'}</td>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>
                    {isAdmin && <button onClick={() => adjust(p)} style={btn('#eff6ff', NAVY, { padding: '4px 10px', marginRight: 6 })}>± Stock</button>}
                    {isAdmin && <button onClick={() => openEdit(p)} style={btn('#f1f5f9', '#334155', { padding: '4px 10px' })}>Edit</button>}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No products found</td></tr>}
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
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ORDERS TAB (online orders from the public storefront)
// ═══════════════════════════════════════════════════════════════════════════
function OrdersTab({ currentUser, showToast, onSaleDone }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusF, setStatusF] = useState('open')
  const [busy, setBusy] = useState(null)
  const [payModes, setPayModes] = useState({})

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('store_orders').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) showToast('Could not load orders: ' + error.message, '#dc2626')
    setOrders(data || [])
    setLoading(false)
  }, [showToast])
  useEffect(() => { load() }, [load])

  const shown = orders.filter(o => statusF === 'all' ? true : statusF === 'open' ? ['new', 'confirmed', 'ready'].includes(o.status) : o.status === statusF)

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
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {[['open', 'Open'], ['new', 'New'], ['confirmed', 'Confirmed'], ['ready', 'Ready'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All']].map(([id, label]) => (
          <button key={id} onClick={() => setStatusF(id)}
            style={{ padding: '6px 13px', borderRadius: 99, border: `1.5px solid ${statusF === id ? NAVY : '#e2e8f0'}`, background: statusF === id ? NAVY : 'white', color: statusF === id ? 'white' : '#475569', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
        ))}
        <button onClick={load} style={btn('#f1f5f9', '#334155', { border: '1px solid #e2e8f0' })}>↻ Refresh</button>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>⏳ Loading…</div> : shown.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>No orders here</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {shown.map(o => {
            const [bg, fg] = ORDER_COLORS[o.status] || ORDER_COLORS.delivered
            const active = ['new', 'confirmed', 'ready'].includes(o.status)
            return (
              <div key={o.id} style={{ ...card, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: NAVY }}>{o.order_no} <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 800, padding: '2px 9px', borderRadius: 99, background: bg, color: fg }}>{o.status.toUpperCase()}</span></div>
                    <div style={{ fontSize: 12.5, color: '#334155', marginTop: 3 }}>{o.customer_name} · <a href={`tel:${o.phone}`} style={{ color: NAVY }}>{o.phone}</a>{o.gcc_no ? ` · GCC-${o.gcc_no}` : ''}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: NAVY }}>₹{n(o.total)}</div>
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
  const by = currentUser?.userName || currentUser?.name || 'Admin'

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('store_sales').select('*, store_sale_items(*)')
      .gte('sale_date', from || '2000-01-01').lte('sale_date', to || '2100-01-01')
      .order('created_at', { ascending: false }).limit(1000)
    if (error) showToast('Could not load sales: ' + error.message, '#dc2626')
    setSales(data || [])
    setLoading(false)
  }, [from, to, showToast])
  useEffect(() => { load() }, [load, refreshKey])

  const shown = sales.filter(s => {
    if (statusF !== 'All' && s.status !== statusF) return false
    const q = search.trim().toLowerCase()
    return !q || [s.bill_no, s.customer_name, s.gcc_no, s.phone].some(v => (v || '').toString().toLowerCase().includes(q))
  })
  const live = shown.filter(s => s.status !== 'void')
  const totals = { revenue: live.reduce((a, s) => a + Number(s.total), 0), paid: live.reduce((a, s) => a + Number(s.amount_paid), 0), due: live.reduce((a, s) => a + Number(s.due_amount), 0) }

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
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 14 }}>
        {[['Bills', live.length, NAVY, '#eff6ff'], ['Sales value', `₹${n(totals.revenue)}`, '#16a34a', '#f0fdf4'], ['Received', `₹${n(totals.paid)}`, '#0e7490', '#ecfeff'], ['Outstanding', `₹${n(totals.due)}`, '#dc2626', '#fef2f2']].map(([l, v, c, bg]) => (
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
                      {isAdmin && s.status !== 'void' && <button onClick={() => voidSale(s)} style={btn('#fef2f2', '#dc2626', { padding: '4px 9px' })}>Void</button>}
                    </td>
                  </tr>,
                  isOpen && (
                    <tr key={s.id + 'd'} style={{ background: '#f8fafc' }}>
                      <td colSpan={10} style={{ padding: '10px 16px', fontSize: 12.5, color: '#475569' }}>
                        {items.map(i => <div key={i.id}>• {i.name}{i.size ? ` — ${i.size}` : ''} × {i.qty} @ ₹{n(i.price)} = ₹{n(i.amount)}</div>)}
                        {Number(s.discount) > 0 && <div>Discount: ₹{n(s.discount)}</div>}
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
    </div>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      supabase.from('store_sales').select('*, store_sale_items(*)').gte('sale_date', from).lte('sale_date', to).neq('status', 'void').limit(5000),
      supabase.from('store_sales').select('id,bill_no,customer_name,gcc_no,due_amount,sale_date').eq('status', 'due').order('sale_date'),
      supabase.from('store_best_sellers').select('*').limit(10),
      supabase.from('store_product_ratings').select('*'),
    ]).then(([a, b, c, d]) => { if (!cancelled) { setSales(a.data || []); setDues(b.data || []); setBestSellers(c.data || []); setRatings(Object.fromEntries((d.data || []).map(r => [r.product_id, r]))); setLoading(false) } })
    return () => { cancelled = true }
  }, [from, to, refreshKey])

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

  const Box = ({ title, children }) => <div style={{ ...card, padding: 16 }}><div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginBottom: 10 }}>{title}</div>{children}</div>
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
            {[['Sales in range', `₹${n(revenue)}`, '#16a34a', '#f0fdf4'], ['Bills', sales.length, NAVY, '#eff6ff'], ['Outstanding dues', `₹${n(totalDue)}`, '#dc2626', '#fef2f2'], ['Stock value (at price)', `₹${n(stockValue)}`, '#7c3aed', '#f5f3ff']].map(([l, v, c, bg]) => (
              <div key={l} style={{ background: bg, borderRadius: 10, padding: '12px 14px', borderLeft: `4px solid ${c}` }}><div style={{ fontSize: 11, fontWeight: 700, color: c }}>{l}</div><div style={{ fontSize: 20, fontWeight: 900, color: c }}>{v}</div></div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
            <Box title="🏆 Top products">{top.length ? top.map(([k, v]) => <Row key={k} l={`${k} (×${v.qty})`} r={`₹${n(v.amt)}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales</div>}</Box>
            <Box title="📂 By category">{Object.keys(byCat).length ? Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => <Row key={k} l={k} r={`₹${n(v)}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales</div>}</Box>
            <Box title="💳 Collected by mode">{Object.keys(byMode).length ? Object.entries(byMode).map(([k, v]) => <Row key={k} l={k} r={`₹${n(v)}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No payments</div>}</Box>
            <Box title={`⚠️ Low / out of stock (${low.length})`}><div style={{ maxHeight: 240, overflowY: 'auto' }}>{low.length ? low.map(p => <Row key={p.id} l={`${p.name}${p.size ? ' — ' + p.size : ''}`} r={p.stock <= 0 ? 'OUT' : `${p.stock} left`} c={p.stock <= 0 ? '#dc2626' : '#d97706'} />) : <div style={{ color: '#16a34a', fontSize: 12 }}>All stocked ✓</div>}</div></Box>
            <Box title="🔥 Best sellers (last 30 days)"><div style={{ maxHeight: 240, overflowY: 'auto' }}>{bestSellers.length ? bestSellers.map(b => <Row key={b.product_id} l={`${b.name}${b.size ? ' — ' + b.size : ''}`} r={`×${b.qty_sold_30d}`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No sales in the last 30 days</div>}</div></Box>
            <Box title="⭐ Product ratings"><div style={{ maxHeight: 240, overflowY: 'auto' }}>{Object.keys(ratings).length ? products.filter(p => ratings[p.id]).sort((a, b) => ratings[b.id].review_count - ratings[a.id].review_count).map(p => <Row key={p.id} l={`${p.name}${p.size ? ' — ' + p.size : ''}`} r={`${ratings[p.id].avg_rating}★ (${ratings[p.id].review_count})`} />) : <div style={{ color: '#94a3b8', fontSize: 12 }}>No reviews yet</div>}</div></Box>
            <Box title={`🧾 Student dues (${dues.length})`}><div style={{ maxHeight: 240, overflowY: 'auto' }}>{dues.length ? dues.map(d => <Row key={d.id} l={`${d.customer_name || '—'} · GCC-${d.gcc_no} · ${d.bill_no}`} r={`₹${n(d.due_amount)}`} c="#dc2626" />) : <div style={{ color: '#16a34a', fontSize: 12 }}>No outstanding dues ✓</div>}</div></Box>
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
  }, [])

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

  const TABS = [
    { id: 'pos', label: '🛒 Counter POS' },
    { id: 'products', label: '📦 Products & Stock' },
    { id: 'orders', label: `🌐 Online Orders${newOrders ? ` (${newOrders})` : ''}` },
    { id: 'sales', label: '🧾 Sales' },
    ...(isAdmin ? [{ id: 'promotions', label: '🏷️ Promotions' }] : []),
    { id: 'reports', label: '📊 Reports' },
  ]

  return (
    <div style={{ padding: isMobile ? '16px 12px' : 24, fontFamily: 'system-ui,sans-serif' }}>
      <Toast toast={toast} />
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 26, fontWeight: 'bold', color: NAVY, margin: 0 }}>🏬 GNSI Store</h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '4px 0 0' }}>Uniforms · Books · Hostel items — counter billing, stock, online orders</p>
      </div>

      {!loading && !loadError && (newOrders > 0 || lowStockCount > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {newOrders > 0 && (
            <button onClick={() => setTab('orders')} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              🔔 {newOrders} new online order{newOrders > 1 ? 's' : ''} to confirm
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
          {tab === 'pos' && <POSTab products={products} categories={categories} students={students} isAdmin={isAdmin} currentUser={currentUser} onSaleDone={onSaleDone} showToast={showToast} />}
          {tab === 'products' && <ProductsTab products={products} categories={categories} isAdmin={isAdmin} currentUser={currentUser} reload={reload} showToast={showToast} />}
          {tab === 'orders' && <OrdersTab currentUser={currentUser} showToast={showToast} onSaleDone={onSaleDone} />}
          {tab === 'sales' && <SalesTab isAdmin={isAdmin} currentUser={currentUser} showToast={showToast} onSaleDone={onSaleDone} refreshKey={refreshKey} />}
          {tab === 'promotions' && isAdmin && <PromotionsTab currentUser={currentUser} showToast={showToast} />}
          {tab === 'reports' && <ReportsTab products={products} categories={categories} refreshKey={refreshKey} />}
        </>
      )}
    </div>
  )
}
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════════════
// GNSI Store — public storefront (no login). Route it at /store.
// Reads store_public_catalog, places orders via store_place_order().
// Payment is at the institute counter on pickup.
// ═══════════════════════════════════════════════════════════════════════════

const NAVY = '#1e3a5f'
const n = v => Number(v || 0).toLocaleString('en-IN')
const inp = { width: '100%', padding: '11px 13px', borderRadius: 9, border: '1px solid #d1d5db', fontSize: 14, outline: 'none', boxSizing: 'border-box', background: 'white' }

export default function StorePublic() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [cart, setCart] = useState({}) // { [id]: qty }
  const [showCart, setShowCart] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', gcc_no: '', note: '' })
  const [placing, setPlacing] = useState(false)
  const [placed, setPlaced] = useState(null)
  const [formErr, setFormErr] = useState('')
  const [promoCode, setPromoCode] = useState('')
  const [promoResult, setPromoResult] = useState(null) // { valid, amount_off, reason, code }
  const [checkingPromo, setCheckingPromo] = useState(false)

  useEffect(() => {
    supabase.from('store_public_catalog').select('*').order('name').then(({ data, error }) => {
      if (error) setError(error.message)
      else setItems(data || [])
      setLoading(false)
    })
  }, [])

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))], [items])
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items])

  const shown = items.filter(i => {
    if (cat !== 'All' && i.category !== cat) return false
    const s = q.trim().toLowerCase()
    return !s || [i.name, i.size, i.category].some(v => (v || '').toLowerCase().includes(s))
  })

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter(l => l.p)
  const count = lines.reduce((a, l) => a + l.qty, 0)
  const subtotal = lines.reduce((a, l) => a + l.p.price * l.qty, 0)
  const promoOff = promoResult?.valid ? Math.min(Number(promoResult.amount_off) || 0, subtotal) : 0
  const total = Math.max(subtotal - promoOff, 0)

  const setQty = (p, qty) => {
    const q2 = Math.max(0, Math.min(qty, p.stock, 50))
    setCart(c => { const x = { ...c }; if (q2 === 0) delete x[p.id]; else x[p.id] = q2; return x })
  }

  const checkPromo = async () => {
    const code = promoCode.trim()
    if (!code) { setPromoResult(null); return }
    setCheckingPromo(true)
    const { data, error } = await supabase.rpc('store_validate_promo', { p_code: code, p_subtotal: subtotal })
    setCheckingPromo(false)
    if (error) { setPromoResult({ valid: false, reason: error.message }); return }
    setPromoResult(data)
    if (!data?.valid) setFormErr(data?.reason || 'Invalid promo code')
    else setFormErr('')
  }

  const placeOrder = async () => {
    setFormErr('')
    if (!form.name.trim()) { setFormErr('Please enter your name.'); return }
    if (form.phone.replace(/\D/g, '').length < 10) { setFormErr('Please enter a valid 10-digit phone number.'); return }
    setPlacing(true)
    const { data, error } = await supabase.rpc('store_place_order', { p: {
      name: form.name, phone: form.phone, gcc_no: form.gcc_no, note: form.note,
      promo_code: promoResult?.valid ? promoCode.trim() : '',
      items: lines.map(l => ({ product_id: l.p.id, qty: l.qty })),
    } })
    setPlacing(false)
    if (error) { setFormErr(error.message); return }
    setPlaced({ no: data.order_no, total: data.total, name: form.name })
    setCart({}); setShowCart(false); setPromoCode(''); setPromoResult(null)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui,sans-serif', paddingBottom: 90 }}>
      <header style={{ background: `linear-gradient(135deg,${NAVY},#1e40af)`, color: 'white', padding: '22px 16px 18px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', opacity: .75 }}>GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE</div>
          <h1 style={{ margin: '4px 0 2px', fontSize: 26, fontWeight: 900 }}>GNSI Store</h1>
          <div style={{ fontSize: 13, opacity: .85 }}>Uniforms · Books &amp; stationery · Hostel essentials — order online, pay &amp; collect at the institute.</div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 14px' }}>
        {placed && (
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#166534' }}>✅ Order placed — {placed.no}</div>
            <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>
              Thank you, {placed.name}. Total ₹{n(placed.total)}. We'll contact you when it's ready — please pay at the institute counter on collection and quote <b>{placed.no}</b>.
            </div>
            <button onClick={() => setPlaced(null)} style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: 'none', background: '#166534', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Continue shopping</button>
          </div>
        )}

        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search products…" style={{ ...inp, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
          {categories.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ flexShrink: 0, padding: '7px 15px', borderRadius: 99, border: `1.5px solid ${cat === c ? NAVY : '#e2e8f0'}`, background: cat === c ? NAVY : 'white', color: cat === c ? 'white' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{c}</button>
          ))}
        </div>

        {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
          : error ? <div style={{ textAlign: 'center', padding: 48, color: '#b91c1c' }}>The store is not available right now. Please try again later.</div>
          : shown.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>No products found</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(165px,1fr))', gap: 12 }}>
              {shown.map(p => {
                const qty = cart[p.id] || 0
                const strikePrice = p.on_sale ? p.mrp_price : p.mrp
                return (
                  <div key={p.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: p.in_stock ? 1 : .55, position: 'relative' }}>
                    {p.on_sale && <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, fontSize: 10, fontWeight: 800, color: 'white', background: '#dc2626', padding: '3px 8px', borderRadius: 6 }}>SALE</span>}
                    <div style={{ height: 120, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                      {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : '📦'}
                    </div>
                    <div style={{ padding: 11, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>{p.name}</div>
                      {p.size && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Size: {p.size}</div>}
                      {p.description && <div style={{ fontSize: 11.5, color: '#94a3b8', marginTop: 3, lineHeight: 1.3 }}>{p.description}</div>}
                      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: p.on_sale ? '#dc2626' : NAVY }}>₹{n(p.price)}</span>
                          {strikePrice > p.price && <span style={{ fontSize: 11.5, color: '#94a3b8', textDecoration: 'line-through' }}>₹{n(strikePrice)}</span>}
                        </div>
                        {!p.in_stock ? <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginTop: 6 }}>Out of stock</div>
                          : qty === 0 ? (
                            <button onClick={() => setQty(p, 1)} style={{ width: '100%', marginTop: 8, padding: '9px 0', borderRadius: 8, border: 'none', background: NAVY, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Add to cart</button>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, background: '#eff6ff', borderRadius: 8, padding: 3 }}>
                              <button onClick={() => setQty(p, qty - 1)} style={{ width: 34, height: 32, border: 'none', borderRadius: 6, background: 'white', fontSize: 18, fontWeight: 800, cursor: 'pointer' }}>−</button>
                              <span style={{ fontWeight: 800, color: NAVY }}>{qty}</span>
                              <button onClick={() => setQty(p, qty + 1)} style={{ width: 34, height: 32, border: 'none', borderRadius: 6, background: 'white', fontSize: 18, fontWeight: 800, cursor: 'pointer' }}>+</button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
      </main>

      {count > 0 && !showCart && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, background: 'white', borderTop: '1px solid #e2e8f0', padding: '10px 14px', boxShadow: '0 -4px 16px rgba(0,0,0,.08)', zIndex: 50 }}>
          <button onClick={() => setShowCart(true)} style={{ width: '100%', maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', padding: '13px 18px', borderRadius: 10, border: 'none', background: '#16a34a', color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
            <span>🛒 View cart · {count} item{count > 1 ? 's' : ''}</span><span>₹{n(total)}</span>
          </button>
        </div>
      )}

      {showCart && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 100, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={() => !placing && setShowCart(false)}>
          <div style={{ background: 'white', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 18 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>Your cart</div>
              <button onClick={() => setShowCart(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
            </div>
            {lines.map(l => (
              <div key={l.p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{l.p.name}{l.p.size ? ` — ${l.p.size}` : ''}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>₹{n(l.p.price)} × {l.qty}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button onClick={() => setQty(l.p, l.qty - 1)} style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', fontSize: 16, cursor: 'pointer' }}>−</button>
                  <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 800 }}>{l.qty}</span>
                  <button onClick={() => setQty(l.p, l.qty + 1)} style={{ width: 30, height: 30, border: '1px solid #e2e8f0', borderRadius: 6, background: 'white', fontSize: 16, cursor: 'pointer' }}>+</button>
                </div>
                <div style={{ width: 66, textAlign: 'right', fontWeight: 800 }}>₹{n(l.p.price * l.qty)}</div>
              </div>
            ))}
            <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Promo code</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null) }}
                  onKeyDown={e => e.key === 'Enter' && checkPromo()} placeholder="Optional" style={{ ...inp, flex: 1 }} />
                <button onClick={checkPromo} disabled={checkingPromo || !promoCode.trim()} style={{ padding: '0 16px', borderRadius: 9, border: 'none', background: NAVY, color: 'white', fontWeight: 700, cursor: 'pointer' }}>{checkingPromo ? '…' : 'Apply'}</button>
              </div>
              {promoResult?.valid && (
                <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', display: 'flex', justifyContent: 'space-between' }}>
                  <span>✓ {promoResult.code} applied — ₹{n(promoResult.amount_off)} off</span>
                  <button onClick={() => { setPromoCode(''); setPromoResult(null) }} style={{ background: 'none', border: 'none', color: '#dc2626', fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>Remove</button>
                </div>
              )}
            </div>

            <div style={{ fontSize: 13, color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}><span>Subtotal</span><span>₹{n(subtotal)}</span></div>
              {promoOff > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#16a34a' }}><span>Promo discount</span><span>− ₹{n(promoOff)}</span></div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900, color: NAVY, padding: '12px 0' }}><span>Total</span><span>₹{n(total)}</span></div>

            <div style={{ display: 'grid', gap: 9 }}>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Parent / student name *" style={inp} />
              <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone number *" inputMode="tel" style={inp} />
              <input value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} placeholder="Student GCC No. (if enrolled)" style={inp} />
              <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (size details, etc.)" rows={2} style={{ ...inp, resize: 'vertical' }} />
            </div>
            {formErr && <div style={{ marginTop: 10, background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>{formErr}</div>}
            <button onClick={placeOrder} disabled={placing} style={{ width: '100%', marginTop: 12, padding: 14, borderRadius: 10, border: 'none', background: placing ? '#94a3b8' : '#16a34a', color: 'white', fontSize: 15, fontWeight: 800, cursor: placing ? 'not-allowed' : 'pointer' }}>
              {placing ? 'Placing order…' : `Place order · ₹${n(total)}`}
            </button>
            <div style={{ fontSize: 11.5, color: '#94a3b8', textAlign: 'center', marginTop: 8 }}>No online payment needed — pay at the institute counter when you collect.</div>
          </div>
        </div>
      )}
    </div>
  )
}
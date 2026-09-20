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
const WISHLIST_KEY = 'gnsi_store_wishlist'
const stars = r => '★★★★★☆☆☆☆☆'.slice(5 - Math.round(r || 0), 10 - Math.round(r || 0))

const loadWishlist = () => {
  try { return new Set(JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]')) } catch { return new Set() }
}
const saveWishlist = set => { try { localStorage.setItem(WISHLIST_KEY, JSON.stringify([...set])) } catch {} }

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
  const [ratings, setRatings] = useState({}) // { [product_id]: { review_count, avg_rating } }
  const [wishlist, setWishlist] = useState(loadWishlist)
  const [showWishlist, setShowWishlist] = useState(false)
  const [detail, setDetail] = useState(null) // product being viewed in detail/review modal
  const [showTrack, setShowTrack] = useState(false)

  useEffect(() => {
    supabase.from('store_public_catalog').select('*').order('name').then(({ data, error }) => {
      if (error) setError(error.message)
      else setItems(data || [])
      setLoading(false)
    })
    supabase.from('store_product_ratings').select('*').then(({ data }) => {
      if (data) setRatings(Object.fromEntries(data.map(r => [r.product_id, r])))
    })
  }, [])

  const toggleWishlist = id => {
    setWishlist(w => {
      const x = new Set(w)
      x.has(id) ? x.delete(id) : x.add(id)
      saveWishlist(x)
      return x
    })
  }

  const categories = useMemo(() => ['All', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))], [items])
  const byId = useMemo(() => new Map(items.map(i => [i.id, i])), [items])

  const shown = items.filter(i => {
    if (showWishlist) return wishlist.has(i.id)
    if (cat !== 'All' && i.category !== cat) return false
    const s = q.trim().toLowerCase()
    return !s || [i.name, i.size, i.category].some(v => (v || '').toLowerCase().includes(s))
  })

  const related = useMemo(() => {
    if (!detail) return []
    return items.filter(i => i.id !== detail.id && i.category === detail.category).slice(0, 6)
  }, [detail, items])

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
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={() => setShowWishlist(w => !w)} style={{ padding: '7px 13px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,.4)', background: showWishlist ? 'white' : 'transparent', color: showWishlist ? NAVY : 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              ♥ Wishlist{wishlist.size > 0 ? ` (${wishlist.size})` : ''}
            </button>
            <button onClick={() => setShowTrack(true)} style={{ padding: '7px 13px', borderRadius: 8, border: '1.5px solid rgba(255,255,255,.4)', background: 'transparent', color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
              📦 Track my order
            </button>
          </div>
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

        {showWishlist ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: NAVY }}>♥ Your wishlist</div>
            <button onClick={() => setShowWishlist(false)} style={{ padding: '7px 13px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>← Back to store</button>
          </div>
        ) : (
          <>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Search products…" style={{ ...inp, marginBottom: 12 }} />
            <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 6, marginBottom: 12 }}>
              {categories.map(c => (
                <button key={c} onClick={() => setCat(c)}
                  style={{ flexShrink: 0, padding: '7px 15px', borderRadius: 99, border: `1.5px solid ${cat === c ? NAVY : '#e2e8f0'}`, background: cat === c ? NAVY : 'white', color: cat === c ? 'white' : '#475569', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{c}</button>
              ))}
            </div>
          </>
        )}

        {loading ? <div style={{ textAlign: 'center', padding: 48, color: '#64748b' }}>Loading…</div>
          : error ? <div style={{ textAlign: 'center', padding: 48, color: '#b91c1c' }}>The store is not available right now. Please try again later.</div>
          : shown.length === 0 ? <div style={{ textAlign: 'center', padding: 48, color: '#94a3b8' }}>{showWishlist ? 'Nothing saved yet — tap ♡ on a product to add it here.' : 'No products found'}</div>
          : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(165px,1fr))', gap: 12 }}>
              {shown.map(p => {
                const qty = cart[p.id] || 0
                const strikePrice = p.on_sale ? p.mrp_price : p.mrp
                const rate = ratings[p.id]
                return (
                  <div key={p.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', opacity: p.in_stock ? 1 : .55, position: 'relative' }}>
                    {p.on_sale && <span style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, fontSize: 10, fontWeight: 800, color: 'white', background: '#dc2626', padding: '3px 8px', borderRadius: 6 }}>SALE</span>}
                    <button onClick={() => toggleWishlist(p.id)} title="Save for later" style={{ position: 'absolute', top: 6, right: 6, zIndex: 1, width: 28, height: 28, borderRadius: 99, border: 'none', background: 'rgba(255,255,255,.9)', fontSize: 15, cursor: 'pointer', color: wishlist.has(p.id) ? '#dc2626' : '#94a3b8' }}>
                      {wishlist.has(p.id) ? '♥' : '♡'}
                    </button>
                    <div onClick={() => setDetail(p)} style={{ height: 120, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, cursor: 'pointer' }}>
                      {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" /> : '📦'}
                    </div>
                    <div style={{ padding: 11, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div onClick={() => setDetail(p)} style={{ fontSize: 13.5, fontWeight: 700, color: '#0f172a', lineHeight: 1.3, cursor: 'pointer' }}>{p.name}</div>
                      {p.size && <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>Size: {p.size}</div>}
                      {rate && <div style={{ fontSize: 11, color: '#d97706', marginTop: 3 }}>{stars(rate.avg_rating)} <span style={{ color: '#94a3b8' }}>({rate.review_count})</span></div>}
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

      {detail && (
        <ProductDetail product={detail} related={related} ratings={ratings}
          onClose={() => setDetail(null)}
          onAdd={p => { setQty(p, (cart[p.id] || 0) + 1); }}
          onOpenRelated={p => setDetail(p)}
          refreshRatings={() => supabase.from('store_product_ratings').select('*').then(({ data }) => { if (data) setRatings(Object.fromEntries(data.map(r => [r.product_id, r]))) })}
        />
      )}

      {showTrack && <TrackOrderModal onClose={() => setShowTrack(false)} />}
    </div>
  )
}

// ── Product detail: reviews, ratings, related products ──────────────────────
function ProductDetail({ product, related, ratings, onClose, onAdd, onOpenRelated, refreshRatings }) {
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rf, setRf] = useState({ customer_name: '', phone: '', gcc_no: '', rating: 5, comment: '' })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const rate = ratings[product.id]

  useEffect(() => {
    setLoadingReviews(true)
    supabase.from('store_reviews').select('*').eq('product_id', product.id).eq('approved', true)
      .order('created_at', { ascending: false }).then(({ data }) => { setReviews(data || []); setLoadingReviews(false) })
  }, [product.id])

  const submitReview = async () => {
    setErr(''); setOk(false)
    if (!rf.customer_name.trim()) { setErr('Please enter your name.'); return }
    if (!rf.phone.trim() && !rf.gcc_no.trim()) { setErr('Enter the phone number or GCC No. used on your order.'); return }
    setSubmitting(true)
    const { data, error } = await supabase.rpc('store_submit_review', { p: {
      product_id: product.id, rating: rf.rating, customer_name: rf.customer_name,
      phone: rf.phone, gcc_no: rf.gcc_no, comment: rf.comment,
    } })
    setSubmitting(false)
    if (error) { setErr(error.message); return }
    setOk(true); setShowForm(false); setRf({ customer_name: '', phone: '', gcc_no: '', rating: 5, comment: '' })
    supabase.from('store_reviews').select('*').eq('product_id', product.id).eq('approved', true)
      .order('created_at', { ascending: false }).then(({ data }) => setReviews(data || []))
    refreshRatings()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'white', width: '100%', maxWidth: 560, maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>{product.name}</div>
            {product.size && <div style={{ fontSize: 12, color: '#64748b' }}>Size: {product.size}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ height: 140, background: '#f1f5f9', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 10 }}>
          {product.image_url ? <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} /> : '📦'}
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 19, fontWeight: 900, color: product.on_sale ? '#dc2626' : NAVY }}>₹{n(product.price)}</span>
          {product.on_sale && <span style={{ fontSize: 13, color: '#94a3b8', textDecoration: 'line-through' }}>₹{n(product.mrp_price)}</span>}
        </div>
        {rate ? <div style={{ fontSize: 13, color: '#d97706', marginBottom: 8 }}>{stars(rate.avg_rating)} {rate.avg_rating} <span style={{ color: '#94a3b8' }}>({rate.review_count} review{rate.review_count > 1 ? 's' : ''})</span></div>
          : <div style={{ fontSize: 12.5, color: '#94a3b8', marginBottom: 8 }}>No reviews yet</div>}
        {product.description && <div style={{ fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 1.4 }}>{product.description}</div>}

        {product.in_stock ? (
          <button onClick={() => onAdd(product)} style={{ width: '100%', padding: '11px 0', borderRadius: 9, border: 'none', background: NAVY, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}>Add to cart</button>
        ) : <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', marginBottom: 14 }}>Out of stock</div>}

        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>Reviews</div>
            <button onClick={() => setShowForm(s => !s)} style={{ padding: '6px 12px', borderRadius: 7, border: `1.5px solid ${NAVY}`, background: 'white', color: NAVY, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Write a review</button>
          </div>

          {ok && <div style={{ background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, marginBottom: 10 }}>Thanks — your review has been posted.</div>}

          {showForm && (
            <div style={{ background: '#f8fafc', borderRadius: 10, padding: 12, marginBottom: 12, display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4, 5].map(v => (
                  <button key={v} onClick={() => setRf(f => ({ ...f, rating: v }))} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: v <= rf.rating ? '#d97706' : '#e2e8f0', padding: 0 }}>★</button>
                ))}
              </div>
              <input value={rf.customer_name} onChange={e => setRf(f => ({ ...f, customer_name: e.target.value }))} placeholder="Your name *" style={inp} />
              <input value={rf.phone} onChange={e => setRf(f => ({ ...f, phone: e.target.value }))} placeholder="Phone used on order" inputMode="tel" style={inp} />
              <input value={rf.gcc_no} onChange={e => setRf(f => ({ ...f, gcc_no: e.target.value }))} placeholder="or Student GCC No." style={inp} />
              <textarea value={rf.comment} onChange={e => setRf(f => ({ ...f, comment: e.target.value }))} placeholder="Your review (optional)" rows={2} style={{ ...inp, resize: 'vertical' }} />
              <div style={{ fontSize: 11, color: '#94a3b8' }}>We verify against a completed order/purchase before posting — enter the phone or GCC No. used on it.</div>
              {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}
              <button onClick={submitReview} disabled={submitting} style={{ padding: '9px 0', borderRadius: 8, border: 'none', background: submitting ? '#94a3b8' : NAVY, color: 'white', fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? 'Submitting…' : 'Submit review'}</button>
            </div>
          )}

          {loadingReviews ? <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Loading reviews…</div>
            : reviews.length === 0 ? <div style={{ fontSize: 12.5, color: '#94a3b8' }}>Be the first to review this product.</div>
            : reviews.map(r => (
              <div key={r.id} style={{ borderBottom: '1px solid #f1f5f9', padding: '8px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{r.customer_name}</span>
                  <span style={{ fontSize: 12, color: '#d97706' }}>{stars(r.rating)}</span>
                </div>
                {r.comment && <div style={{ fontSize: 12.5, color: '#475569', marginTop: 3 }}>{r.comment}</div>}
              </div>
            ))}
        </div>

        {related.length > 0 && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>You may also like</div>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
              {related.map(p => (
                <div key={p.id} onClick={() => onOpenRelated(p)} style={{ flexShrink: 0, width: 110, cursor: 'pointer' }}>
                  <div style={{ height: 80, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {p.image_url ? <img src={p.image_url} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : '📦'}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, marginTop: 4, lineHeight: 1.25 }}>{p.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: NAVY }}>₹{n(p.price)}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Track my order: lookup by phone (+ optional order no.) ─────────────────
function TrackOrderModal({ onClose }) {
  const [phone, setPhone] = useState('')
  const [orderNo, setOrderNo] = useState('')
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const STATUS_LABEL = { new: 'Order received', confirmed: 'Confirmed', ready: 'Ready for pickup', delivered: 'Delivered / collected', cancelled: 'Cancelled' }
  const STATUS_COLOR = { new: '#2563eb', confirmed: '#7c3aed', ready: '#d97706', delivered: '#16a34a', cancelled: '#dc2626' }

  const lookup = async () => {
    setErr(''); setOrders(null)
    if (phone.replace(/\D/g, '').length < 10) { setErr('Enter the 10-digit phone number used on your order.'); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('store_lookup_orders', { p_phone: phone, p_order_no: orderNo || null })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setOrders(data || [])
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'white', width: '100%', maxWidth: 520, maxHeight: '92vh', overflowY: 'auto', borderRadius: '16px 16px 0 0', padding: 18 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: NAVY }}>📦 Track my order</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>

        <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
          <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} placeholder="Phone number used on the order *" inputMode="tel" style={inp} />
          <input value={orderNo} onChange={e => setOrderNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} placeholder="Order number (optional)" style={inp} />
          <button onClick={lookup} disabled={loading} style={{ padding: '10px 0', borderRadius: 9, border: 'none', background: loading ? '#94a3b8' : NAVY, color: 'white', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Looking up…' : 'Find my orders'}</button>
        </div>

        {err && <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 10 }}>{err}</div>}

        {orders && orders.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8', fontSize: 13 }}>No orders found for that phone number.</div>}

        {orders && orders.map(o => (
          <div key={o.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 12, marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, fontWeight: 800, color: NAVY }}>{o.order_no}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: STATUS_COLOR[o.status] || '#475569', background: (STATUS_COLOR[o.status] || '#475569') + '1a', padding: '3px 9px', borderRadius: 99 }}>
                {STATUS_LABEL[o.status] || o.status}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{new Date(o.created_at).toLocaleString('en-IN')}</div>
            {Array.isArray(o.items) && (
              <div style={{ fontSize: 12.5, color: '#475569', marginTop: 6 }}>
                {o.items.map((it, idx) => <div key={idx}>{it.name || it.qty + ' item'}{it.qty ? ` × ${it.qty}` : ''}</div>)}
              </div>
            )}
            {o.total != null && <div style={{ fontSize: 13, fontWeight: 800, color: NAVY, marginTop: 6 }}>Total ₹{n(o.total)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
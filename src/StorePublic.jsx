import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from './supabase'

// ═══════════════════════════════════════════════════════════════════════════
// GNSI Store — public storefront (no login). Route it at /store.
// Order online → we pack it → pay & collect at the institute counter.
// Reads store_public_catalog, places orders via store_place_order().
// Deep link to a product: /store?p=<product id>
// ═══════════════════════════════════════════════════════════════════════════

// ── Settings ────────────────────────────────────────────────────────────────
// Set UPI_ID (e.g. 'gnsi@sbi') to let parents pay ahead by UPI from the pickup
// pass. Leave '' to keep pay-at-counter only. Staff still confirm the payment
// (with the UTR) when billing the order in Store → Online Orders.
const UPI_ID = ''
const UPI_NAME = 'Guidance Navodaya and Sainik Institute'
const COUNTER = { place: 'GNSI Store counter, Khangabok campus', hours: 'Mon–Sat · 9:00 AM – 5:00 PM' }
const QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'
// Pickup slots offered at checkout. Days the counter is closed (0 = Sunday) are skipped.
const PICKUP = { closedDays: [0], daysAhead: 6, slots: [['Morning', '9 AM – 12 PM'], ['Afternoon', '12 – 5 PM']] }

const n = v => Number(v || 0).toLocaleString('en-IN')
const WISHLIST_KEY = 'gnsi_store_wishlist'
const CART_KEY = 'gnsi_store_cart'
const CUSTOMER_KEY = 'gnsi_store_customer'
const RECENT_KEY = 'gnsi_store_recent'
const SEARCHES_KEY = 'gnsi_store_searches'
const WISH_PRICE_KEY = 'gnsi_store_wish_prices'
const LOW_STOCK_AT = 5
const esc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const readLS = (k, fallback) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback } catch { return fallback } }
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }
const upiLink = (amount, note) => `upi://pay?pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent(UPI_NAME)}&am=${Number(amount || 0).toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`

// Sizes sort naturally: XS < S < M < L < XL…, then numbers, then text.
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL']
const sizeRank = s => {
  const u = String(s || '').trim().toUpperCase(), i = SIZE_ORDER.indexOf(u)
  if (i >= 0) return [0, i, '']
  const num = parseFloat(u)
  return isNaN(num) ? [2, 0, u] : [1, num, '']
}
const bySize = (a, b) => { const x = sizeRank(a.size), y = sizeRank(b.size); return x[0] - y[0] || x[1] - y[1] || x[2].localeCompare(y[2]) }
const groupKey = p => `${(p.name || '').trim().toLowerCase()}|${p.category || ''}`
const strikeOf = p => p.on_sale ? p.mrp_price : p.mrp
const discountPct = p => { const s = Number(strikeOf(p)); return s > Number(p.price) ? Math.round((s - p.price) / s * 100) : 0 }
const catIcon = c => {
  const s = String(c || '').toLowerCase()
  return /uniform|dress|shirt|track|wear/.test(s) ? '👕' : /book|guide|text/.test(s) ? '📚' : /station|pen|note/.test(s) ? '✏️'
    : /hostel|bed|toilet|bath/.test(s) ? '🛏️' : /sport|shoe|game/.test(s) ? '👟' : /bag/.test(s) ? '🎒' : '🎁'
}

const SORTS = [['featured', 'Featured'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['rating', 'Top rated'], ['discount', 'Biggest discount']]
const STATUS = {
  new: { label: 'Order received', tone: '#2563eb' }, confirmed: { label: 'Confirmed · packing', tone: '#7c3aed' },
  ready: { label: 'Ready for pickup', tone: '#b7791f' }, delivered: { label: 'Collected', tone: '#15803d' }, cancelled: { label: 'Cancelled', tone: '#dc2626' },
}
const STEPS = ['new', 'confirmed', 'ready', 'delivered']

// ── Design system ───────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap');
.gs{--ink:#0e1b33;--ink2:#334155;--mute:#64748b;--faint:#94a3b8;--line:#e7e3da;--line2:#f0ece4;--bg:#f7f5f0;--card:#ffffff;
  --navy:#132a4f;--navy2:#1e3a6e;--gold:#b8923a;--gold2:#e9d9b0;--goldbg:#fbf6ea;--green:#15803d;--greenbg:#ecfdf3;--red:#c2410c;--redbg:#fff4ed;
  --r:16px;--sh:0 1px 2px rgba(14,27,51,.04),0 4px 16px rgba(14,27,51,.06);--sh2:0 12px 40px rgba(14,27,51,.16);
  min-height:100vh;background:var(--bg);color:var(--ink);font-family:'Plus Jakarta Sans',system-ui,-apple-system,'Segoe UI',sans-serif;
  -webkit-font-smoothing:antialiased;padding-bottom:96px}
.gs *{box-sizing:border-box}
.gs button{font-family:inherit;cursor:pointer}
.gs input,.gs select,.gs textarea{font-family:inherit}
.gs-wrap{max-width:1180px;margin:0 auto;padding:0 18px}
.gs-serif{font-family:'Fraunces',Georgia,serif;letter-spacing:-.01em}

/* header */
.gs-head{position:sticky;top:0;z-index:60;background:rgba(19,42,79,.94);backdrop-filter:saturate(1.4) blur(12px);-webkit-backdrop-filter:saturate(1.4) blur(12px);color:#fff;border-bottom:1px solid rgba(255,255,255,.08)}
.gs-head-in{display:flex;align-items:center;gap:12px;height:64px}
.gs-mark{width:38px;height:38px;border-radius:11px;background:linear-gradient(145deg,#e9d9b0,#b8923a);color:#132a4f;display:grid;place-items:center;font-family:'Fraunces',serif;font-weight:700;font-size:20px;box-shadow:inset 0 -2px 0 rgba(0,0,0,.12)}
.gs-brand{line-height:1.1}.gs-brand b{display:block;font-size:16px;font-weight:800;letter-spacing:-.01em}.gs-brand span{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6)}
.gs-hbtn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 13px;border-radius:10px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font-size:13px;font-weight:600;transition:background .15s}
.gs-hbtn:hover{background:rgba(255,255,255,.14)}.gs-hbtn.on{background:#fff;color:var(--navy)}
.gs-cartbtn{background:var(--gold);border-color:transparent;color:#132a4f;font-weight:800}.gs-cartbtn:hover{background:#c9a24a}
.gs-badge{min-width:20px;height:20px;padding:0 6px;border-radius:99px;background:#132a4f;color:#fff;font-size:11px;font-weight:800;display:inline-grid;place-items:center}
.gs-bump{animation:gs-pop .35s ease}

/* hero */
.gs-hero{background:radial-gradient(1200px 400px at 85% -10%,rgba(184,146,58,.28),transparent 60%),linear-gradient(160deg,#132a4f 0%,#1e3a6e 70%,#23457f 100%);color:#fff;padding:38px 0 30px;position:relative;overflow:hidden}
.gs-hero h1{font-size:clamp(28px,4.4vw,44px);line-height:1.08;margin:10px 0 10px;max-width:640px;font-weight:700}
.gs-hero p{margin:0;color:rgba(255,255,255,.78);font-size:15px;max-width:560px;line-height:1.55}
.gs-eyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--gold2)}
.gs-eyebrow:before{content:'';width:22px;height:1px;background:var(--gold2)}
.gs-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:24px;max-width:760px}
.gs-step{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:12px 14px;display:flex;gap:11px;align-items:flex-start}
.gs-step i{font-style:normal;flex:none;width:26px;height:26px;border-radius:99px;background:var(--gold);color:#132a4f;font-weight:800;font-size:12.5px;display:grid;place-items:center}
.gs-step b{display:block;font-size:13.5px}.gs-step span{font-size:12px;color:rgba(255,255,255,.66)}
@media(max-width:720px){.gs-hero{padding:24px 0 20px}.gs-hero p{font-size:14px}.gs-steps{gap:6px;margin-top:18px}
  .gs-step{flex-direction:column;gap:6px;padding:10px}.gs-step span{display:none}.gs-step b{font-size:12px;line-height:1.25}.gs-step i{width:22px;height:22px;font-size:11px}}

/* toolbar */
.gs-tools{position:sticky;top:64px;z-index:40;background:rgba(247,245,240,.92);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:14px 0 10px;border-bottom:1px solid var(--line2)}
.gs-search{position:relative}.gs-search svg{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--faint)}
.gs-input{width:100%;height:46px;padding:0 14px;border-radius:12px;border:1px solid var(--line);background:#fff;font-size:14.5px;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
.gs-input:focus{border-color:var(--navy2);box-shadow:0 0 0 4px rgba(30,58,110,.1)}
.gs-search .gs-input{padding-left:42px}
textarea.gs-input{height:auto;padding:12px 14px;resize:vertical}
.gs-chips{display:flex;gap:8px;overflow-x:auto;padding:12px 0 2px;scrollbar-width:none}.gs-chips::-webkit-scrollbar{display:none}
.gs-chip{flex:none;height:36px;padding:0 15px;border-radius:99px;border:1px solid var(--line);background:#fff;color:var(--ink2);font-size:13px;font-weight:600;display:inline-flex;align-items:center;gap:7px;transition:all .15s}
.gs-chip:hover{border-color:#cfc7b6}.gs-chip.on{background:var(--navy);border-color:var(--navy);color:#fff}
.gs-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px}
.gs-select{height:36px;border-radius:10px;border:1px solid var(--line);background:#fff;padding:0 10px;font-size:13px;color:var(--ink2);outline:none}
.gs-switch{display:inline-flex;align-items:center;gap:9px;font-size:13px;font-weight:600;color:var(--ink2);cursor:pointer;user-select:none}
.gs-switch input{appearance:none;-webkit-appearance:none;width:36px;height:21px;border-radius:99px;background:#d6d0c4;position:relative;transition:background .2s;margin:0;cursor:pointer}
.gs-switch input:after{content:'';position:absolute;top:2.5px;left:2.5px;width:16px;height:16px;border-radius:99px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:transform .2s}
.gs-switch input:checked{background:var(--navy)}.gs-switch input:checked:after{transform:translateX(15px)}
.gs-count{font-size:12.5px;color:var(--faint)}
@media(max-width:767px){.gs-tools{position:static;padding-top:12px}.gs-row{flex-wrap:nowrap}.gs-brand span{display:none}.gs-count{display:none}}

/* grid + cards */
.gs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;padding:18px 0}
@media(max-width:520px){.gs-grid{grid-template-columns:repeat(2,1fr);gap:10px}}
.gs-card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;position:relative;transition:transform .2s,box-shadow .2s,border-color .2s;animation:gs-up .35s both}
.gs-card:hover{transform:translateY(-3px);box-shadow:var(--sh2);border-color:transparent}
.gs-card.out{opacity:.62}
.gs-media{aspect-ratio:4/3;background:linear-gradient(145deg,#f3efe6,#e9e3d6);display:grid;place-items:center;font-size:44px;cursor:pointer;overflow:hidden;position:relative}
.gs-media img{width:100%;height:100%;object-fit:cover;transition:transform .5s}.gs-card:hover .gs-media img{transform:scale(1.04)}
.gs-tag{position:absolute;top:10px;left:10px;z-index:2;font-size:10.5px;font-weight:800;letter-spacing:.04em;padding:4px 9px;border-radius:7px}
.gs-tag.sale{background:#132a4f;color:var(--gold2)}.gs-tag.low{background:var(--redbg);color:var(--red)}
.gs-heart{position:absolute;top:8px;right:8px;z-index:2;width:34px;height:34px;border-radius:99px;border:none;background:rgba(255,255,255,.92);display:grid;place-items:center;font-size:16px;color:var(--faint);box-shadow:0 2px 8px rgba(0,0,0,.08);transition:transform .15s}
.gs-heart:hover{transform:scale(1.08)}.gs-heart.on{color:#e11d48}
.gs-body{padding:13px 14px 14px;display:flex;flex-direction:column;flex:1;gap:6px}
.gs-name{font-size:14.5px;font-weight:700;line-height:1.3;color:var(--ink);cursor:pointer}
.gs-desc{font-size:12px;color:var(--mute);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.gs-stars{font-size:11.5px;color:#b7791f;letter-spacing:.5px}.gs-stars span{color:var(--faint);letter-spacing:0;margin-left:3px}
.gs-sizes{display:flex;gap:5px;flex-wrap:wrap}
.gs-size{min-width:32px;height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--line);background:#fff;font-size:11.5px;font-weight:700;color:var(--ink2);transition:all .12s}
.gs-size:hover{border-color:var(--navy2)}.gs-size.on{background:var(--navy);border-color:var(--navy);color:#fff}.gs-size.na{color:#c7c1b4;text-decoration:line-through}
.gs-size.big{height:40px;min-width:48px;font-size:13.5px;border-radius:10px}
.gs-foot{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding-top:6px}
.gs-price b{font-size:18px;font-weight:800;color:var(--ink);letter-spacing:-.01em}.gs-price s{font-size:12px;color:var(--faint);margin-left:6px}
.gs-price.sale b{color:#9a3412}
.gs-add{height:38px;padding:0 14px;border-radius:11px;border:none;background:var(--navy);color:#fff;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;transition:background .15s,transform .1s}
.gs-add:hover{background:var(--navy2)}.gs-add:active{transform:scale(.96)}.gs-add:disabled{background:#cbd5e1;cursor:not-allowed}
.gs-stepper{display:inline-flex;align-items:center;height:38px;border-radius:11px;background:var(--goldbg);border:1px solid var(--gold2)}
.gs-stepper button{width:34px;height:36px;border:none;background:none;font-size:18px;font-weight:700;color:var(--navy)}
.gs-stepper span{min-width:22px;text-align:center;font-weight:800;font-size:14px;color:var(--navy)}
.gs-oos{font-size:12px;font-weight:700;color:var(--red)}
@media(max-width:520px){.gs-body{padding:10px 10px 11px}.gs-name{font-size:13.5px}.gs-price b{font-size:16px}.gs-add{height:36px;padding:0 11px;font-size:12.5px}.gs-stepper span{font-size:12.5px}}

/* skeleton */
.gs-skel{border-radius:var(--r);background:#fff;border:1px solid var(--line);overflow:hidden}
.gs-shim{background:linear-gradient(90deg,#efebe2 0%,#f8f6f1 50%,#efebe2 100%);background-size:200% 100%;animation:gs-shim 1.2s infinite}

/* overlay, drawer, dialog */
.gs-ov{position:fixed;inset:0;z-index:100;background:rgba(10,20,40,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);animation:gs-fade .2s}
.gs-drawer{position:fixed;z-index:101;top:0;right:0;bottom:0;width:min(460px,100%);background:#fff;display:flex;flex-direction:column;box-shadow:var(--sh2);animation:gs-right .28s cubic-bezier(.2,.8,.2,1)}
.gs-dialog{position:fixed;z-index:101;left:50%;top:50%;transform:translate(-50%,-50%);width:min(920px,calc(100% - 32px));max-height:calc(100vh - 48px);overflow:auto;background:#fff;border-radius:22px;box-shadow:var(--sh2);animation:gs-zoom .25s cubic-bezier(.2,.8,.2,1)}
.gs-dialog.sm{width:min(520px,calc(100% - 32px))}
@media(max-width:767px){
  .gs-drawer{top:auto;left:0;width:100%;max-height:94vh;border-radius:22px 22px 0 0;animation:gs-upsheet .3s cubic-bezier(.2,.8,.2,1)}
  .gs-dialog,.gs-dialog.sm{top:auto;bottom:0;left:0;transform:none;width:100%;max-height:94vh;border-radius:22px 22px 0 0;animation:gs-upsheet .3s cubic-bezier(.2,.8,.2,1)}
}
.gs-grab{display:none}@media(max-width:767px){.gs-grab{display:block;width:40px;height:4px;border-radius:9px;background:#d6d0c4;margin:8px auto 0}}
.gs-dhead{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line2)}
.gs-dhead h3{margin:0;font-size:18px;font-weight:800}
.gs-x{width:36px;height:36px;border-radius:99px;border:none;background:#f3f0e9;font-size:18px;color:var(--ink2);display:grid;place-items:center}
.gs-x:hover{background:#e9e4d9}
.gs-dbody{padding:16px 20px;overflow-y:auto;flex:1}
.gs-dfoot{padding:14px 20px 18px;border-top:1px solid var(--line2);background:#fff}
.gs-progress{display:flex;gap:6px;padding:12px 20px 0}.gs-progress div{flex:1;height:4px;border-radius:9px;background:#ece7dc}.gs-progress div.on{background:var(--navy)}
.gs-plabel{display:flex;justify-content:space-between;padding:6px 20px 0;font-size:11px;font-weight:700;color:var(--faint);letter-spacing:.06em;text-transform:uppercase}.gs-plabel .on{color:var(--navy)}
.gs-line{display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line2)}
.gs-thumb{width:56px;height:56px;border-radius:12px;background:linear-gradient(145deg,#f3efe6,#e9e3d6);display:grid;place-items:center;font-size:24px;flex:none;overflow:hidden}.gs-thumb img{width:100%;height:100%;object-fit:cover}
.gs-sum{display:flex;justify-content:space-between;font-size:13.5px;color:var(--ink2);padding:4px 0}
.gs-total{display:flex;justify-content:space-between;align-items:baseline;font-size:15px;font-weight:700;padding:10px 0 2px}.gs-total b{font-size:24px;font-weight:800;letter-spacing:-.02em}
.gs-cta{width:100%;height:52px;border:none;border-radius:14px;background:var(--navy);color:#fff;font-size:15.5px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;transition:background .15s,transform .1s}
.gs-cta:hover{background:var(--navy2)}.gs-cta:active{transform:scale(.99)}.gs-cta:disabled{background:#b8c0cc;cursor:not-allowed}
.gs-cta.gold{background:var(--gold);color:#132a4f}.gs-cta.gold:hover{background:#c9a24a}
.gs-ghost{height:44px;padding:0 16px;border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--ink);font-size:13.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.gs-ghost:hover{border-color:#cfc7b6;background:#fcfbf8}
.gs-link{background:none;border:none;color:var(--navy2);font-weight:700;font-size:12.5px;padding:0}
.gs-label{display:block;font-size:11.5px;font-weight:700;color:var(--mute);letter-spacing:.05em;text-transform:uppercase;margin:0 0 6px}
.gs-field{margin-bottom:12px}
.gs-err{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;border-radius:12px;padding:10px 12px;font-size:13px;margin-top:10px}
.gs-note{display:flex;gap:10px;align-items:flex-start;background:var(--goldbg);border:1px solid var(--gold2);border-radius:14px;padding:12px 14px;font-size:12.5px;color:#6b5320;line-height:1.5}
.gs-ok{background:var(--greenbg);border:1px solid #bbf7d0;color:var(--green);border-radius:12px;padding:9px 12px;font-size:12.5px;font-weight:600}
.gs-empty{text-align:center;padding:64px 16px;color:var(--mute)}.gs-empty .i{font-size:44px;margin-bottom:10px}.gs-empty b{display:block;color:var(--ink);font-size:17px;margin-bottom:4px}

/* pickup pass */
.gs-pass{background:linear-gradient(160deg,#132a4f,#1e3a6e);color:#fff;border-radius:20px;overflow:hidden;position:relative}
.gs-pass-top{padding:20px 22px 16px}
.gs-pass-cut{position:relative;height:0;border-top:2px dashed rgba(255,255,255,.25);margin:0 16px}
.gs-pass-cut:before,.gs-pass-cut:after{content:'';position:absolute;top:-13px;width:24px;height:24px;border-radius:99px;background:#fff}
.gs-pass-cut:before{left:-29px}.gs-pass-cut:after{right:-29px}
.gs-pass-bot{padding:18px 22px 22px;display:flex;gap:18px;align-items:center}
.gs-qr{width:128px;height:128px;flex:none;background:#fff;border-radius:14px;padding:9px;display:grid;place-items:center;color:#132a4f;font-size:11px;text-align:center}
.gs-qr svg{width:100%;height:100%;display:block}
.gs-code{font-family:'Fraunces',serif;font-size:30px;font-weight:700;letter-spacing:.02em;color:var(--gold2);line-height:1}
.gs-track{display:flex;gap:4px;margin-top:10px}.gs-track div{flex:1;height:5px;border-radius:9px;background:rgba(255,255,255,.18)}
.gs-mini{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.6);font-weight:700}

/* detail */
.gs-detail{display:grid;grid-template-columns:1.05fr 1fr}
.gs-detail-media{background:linear-gradient(145deg,#f3efe6,#e6dfcf);min-height:380px;display:grid;place-items:center;font-size:84px;position:relative}
.gs-detail-media img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
@media(max-width:767px){.gs-detail{grid-template-columns:1fr}.gs-detail-media{min-height:240px}}
.gs-review{padding:12px 0;border-bottom:1px solid var(--line2)}
.gs-rel{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px}
.gs-rel-i{flex:none;width:130px;cursor:pointer}.gs-rel-i .gs-thumb{width:130px;height:96px;font-size:30px}

/* toast + mobile bar */
.gs-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:300;background:#0e1b33;color:#fff;padding:12px 18px;border-radius:14px;font-size:13.5px;font-weight:600;box-shadow:var(--sh2);display:flex;align-items:center;gap:10px;max-width:calc(100% - 32px);animation:gs-toast .3s cubic-bezier(.2,.8,.2,1)}
.gs-toast.lift{bottom:96px}
.gs-mbar{position:fixed;left:0;right:0;bottom:0;z-index:50;padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:rgba(255,255,255,.96);backdrop-filter:blur(10px);border-top:1px solid var(--line);animation:gs-upsheet .3s}
.gs-mbar button{width:100%;max-width:1180px;margin:0 auto;height:54px;border:none;border-radius:15px;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:15px;font-weight:800}
.gs-mbar .pill{background:var(--gold);color:#132a4f;border-radius:10px;padding:5px 11px}
@media(min-width:768px){.gs-mbar{display:none}}
@media(max-width:767px){.gs-hide-m{display:none!important}}
.gs-footer{text-align:center;color:var(--faint);font-size:12px;padding:28px 16px 8px;line-height:1.7}

/* ── advanced pack ─────────────────────────────────────────────── */
.gs-sbox{position:relative;flex:1;max-width:680px;margin:0 8px;display:flex}.gs-sbox .gs-hsearch{margin:0;max-width:none}
@media(max-width:767px){.gs-head .gs-sbox.d{display:none}.gs-msearch .gs-sbox{margin:0;max-width:none}}
.gs-mic{background:#fff!important;color:var(--mute)!important;width:40px!important;font-size:16px}.gs-mic.on{color:#dc2626!important;animation:gs-pop 1s infinite}
.gs-suggest{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:80;background:#fff;border:1px solid var(--line);border-radius:14px;box-shadow:var(--sh2);padding:6px;max-height:70vh;overflow-y:auto;color:var(--ink)}
.gs-suggest .h{display:flex;justify-content:space-between;align-items:center;padding:6px 10px 4px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
.gs-suggest>button{display:flex;align-items:center;gap:10px;width:100%;border:none;background:none;text-align:left;padding:8px 10px;border-radius:10px;font-size:13.5px;color:var(--ink2)}
.gs-suggest>button.on{background:#f3f0e9}.gs-suggest .ic{width:24px;text-align:center}
.gs-kits{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.gs-kit{background:#fff;border:1px solid var(--line);border-radius:var(--r);overflow:hidden;display:flex;flex-direction:column;transition:box-shadow .2s,transform .2s}
.gs-kit:hover{box-shadow:var(--sh2);transform:translateY(-2px)}
.gs-kit-media{height:150px;background:linear-gradient(145deg,#fbf6ea,#efe4c8);position:relative;display:grid;place-items:center;overflow:hidden}
.gs-kit-media>img{width:100%;height:100%;object-fit:cover}.gs-kit-media .grid{display:grid;grid-template-columns:1fr 1fr;width:100%;height:100%;gap:2px}.gs-kit-media .grid img{width:100%;height:100%;object-fit:cover}
.gs-ctray{position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:55;display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:8px 10px 8px 12px;box-shadow:var(--sh2);animation:gs-toast .3s;max-width:calc(100% - 24px)}
.gs-ctray.lift{bottom:18px}@media(max-width:767px){.gs-ctray.lift{bottom:84px}}
.gs-ctray .gs-thumb button{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:99px;border:none;background:#0e1b33;color:#fff;font-size:11px;line-height:1}
.gs-cmpchk{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--mute);cursor:pointer;user-select:none}.gs-cmpchk input{accent-color:var(--navy)}
.gs-cmp{border-collapse:collapse;min-width:520px;width:100%;font-size:13.5px;table-layout:fixed}
.gs-cmp td{padding:10px;border-bottom:1px solid var(--line2);vertical-align:top}.gs-cmp td.k{width:120px;font-weight:700;color:var(--mute);font-size:12.5px;background:#faf8f3}
.gs-drop{font-size:11.5px;font-weight:800;color:#15803d;background:var(--greenbg);border-radius:7px;padding:3px 8px;display:inline-block}
.gs-days{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.gs-days::-webkit-scrollbar{display:none}
.gs-days button{flex:none;min-width:74px;padding:8px 6px;border-radius:12px;border:1px solid var(--line);background:#fff;display:flex;flex-direction:column;align-items:center;gap:1px;font-size:13px;color:var(--ink2)}
.gs-days button span{font-size:11px;color:var(--faint)}.gs-days button.on{background:var(--navy);border-color:var(--navy);color:#fff}.gs-days button.on span{color:rgba(255,255,255,.7)}
@keyframes gs-fade{from{opacity:0}to{opacity:1}}
@keyframes gs-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes gs-right{from{transform:translateX(100%)}to{transform:none}}
@keyframes gs-upsheet{from{transform:translateY(100%)}to{transform:none}}
@keyframes gs-zoom{from{opacity:0;transform:translate(-50%,-48%) scale(.97)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
@keyframes gs-pop{0%{transform:scale(1)}40%{transform:scale(1.25)}100%{transform:scale(1)}}
@keyframes gs-shim{from{background-position:200% 0}to{background-position:-200% 0}}
@keyframes gs-toast{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}
@media(prefers-reduced-motion:reduce){.gs *{animation:none!important;transition:none!important}}

/* ── marketplace layout ─────────────────────────────────────────── */
.gs-hsearch{flex:1;display:flex;height:42px;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 0 0 2px transparent;transition:box-shadow .15s;max-width:680px;margin:0 8px}
.gs-hsearch:focus-within{box-shadow:0 0 0 3px var(--gold)}
.gs-hsearch select{border:none;background:#f3f0e9;color:var(--ink2);font-size:12.5px;font-weight:600;padding:0 8px;max-width:130px;outline:none;border-right:1px solid var(--line)}
.gs-hsearch input{flex:1;min-width:0;border:none;outline:none;padding:0 12px;font-size:14.5px;color:var(--ink)}
.gs-hsearch button{border:none;background:var(--gold);color:#132a4f;width:50px;display:grid;place-items:center}
.gs-hsearch button:hover{background:#c9a24a}
.gs-msearch{display:none;padding:0 0 10px}
@media(max-width:767px){.gs-head .gs-hsearch.d{display:none}.gs-msearch{display:block}.gs-msearch .gs-hsearch{margin:0;max-width:none}}
.gs-subnav{background:#1a3563;color:#fff}
.gs-subnav .gs-wrap{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;height:40px;align-items:center}.gs-subnav .gs-wrap::-webkit-scrollbar{display:none}
.gs-subnav button{flex:none;height:30px;padding:0 12px;border-radius:8px;border:1px solid transparent;background:none;color:rgba(255,255,255,.85);font-size:13px;font-weight:600;white-space:nowrap}
.gs-subnav button:hover{border-color:rgba(255,255,255,.35)}.gs-subnav button.on{background:rgba(255,255,255,.14);color:#fff}
.gs-banner{margin:16px 0 0;border-radius:18px;overflow:hidden;background:radial-gradient(900px 300px at 90% -20%,rgba(184,146,58,.35),transparent 60%),linear-gradient(120deg,#132a4f,#23457f);color:#fff;padding:22px 24px;display:flex;justify-content:space-between;gap:18px;align-items:center;flex-wrap:wrap}
.gs-banner h2{margin:6px 0 4px;font-size:clamp(20px,3vw,28px);line-height:1.15}
.gs-banner p{margin:0;color:rgba(255,255,255,.75);font-size:13.5px}
.gs-bsteps{display:flex;gap:8px;flex-wrap:wrap}.gs-bsteps span{background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:99px;padding:7px 12px;font-size:12.5px;font-weight:600}
.gs-bsteps b{color:var(--gold2);margin-right:5px}
.gs-layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:22px;padding-top:16px;align-items:start}
@media(max-width:1023px){.gs-layout{grid-template-columns:1fr}.gs-side{display:none}}
.gs-side{position:sticky;top:80px;max-height:calc(100vh - 96px);overflow-y:auto;padding-right:4px;scrollbar-width:thin}
.gs-fgroup{padding:14px 0;border-bottom:1px solid var(--line)}.gs-fgroup:first-child{padding-top:0}
.gs-fgroup h5{margin:0 0 8px;font-size:13.5px;font-weight:800;color:var(--ink)}
.gs-fopt{display:flex;align-items:center;gap:9px;width:100%;padding:5px 0;border:none;background:none;text-align:left;font-size:13.5px;color:var(--ink2)}
.gs-fopt:hover{color:var(--navy2)}.gs-fopt.on{color:var(--navy);font-weight:700}
.gs-fopt .bx{width:17px;height:17px;border-radius:5px;border:1.5px solid #bdb5a4;display:grid;place-items:center;font-size:11px;color:#fff;flex:none;background:#fff}
.gs-fopt.on .bx{background:var(--navy);border-color:var(--navy)}
.gs-fopt .ct{margin-left:auto;font-size:11.5px;color:var(--faint)}
.gs-fsizes{display:flex;gap:6px;flex-wrap:wrap}
.gs-prange{display:flex;gap:6px;align-items:center;margin-top:8px}.gs-prange input{width:0;flex:1;height:34px;border-radius:9px;border:1px solid var(--line);padding:0 9px;font-size:13px;outline:none}
.gs-prange button{height:34px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:#fff;font-weight:700;font-size:12.5px}
.gs-rhead{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px 14px}
.gs-rhead .t{font-size:13.5px;color:var(--ink2)}.gs-rhead .t b{color:var(--ink)}.gs-rhead .q{color:#9a3412;font-weight:700}
.gs-vt{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}
.gs-vt button{width:36px;height:34px;border:none;background:#fff;color:var(--mute);display:grid;place-items:center}.gs-vt button.on{background:var(--navy);color:#fff}
.gs-achips{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.gs-achip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 6px 0 11px;border-radius:99px;background:#fff;border:1px solid var(--line);font-size:12.5px;font-weight:600;color:var(--ink2)}
.gs-achip button{width:20px;height:20px;border-radius:99px;border:none;background:#f3f0e9;font-size:12px;color:var(--mute)}
.gs-mfbar{display:none;gap:8px;align-items:center;margin-bottom:10px}
@media(max-width:1023px){.gs-mfbar{display:flex}}
/* list rows */
.gs-list{display:grid;gap:12px;padding:14px 0}
.gs-lrow{display:grid;grid-template-columns:200px minmax(0,1fr) 200px;gap:18px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:14px;position:relative;animation:gs-up .3s both;transition:box-shadow .2s}
.gs-lrow:hover{box-shadow:var(--sh)}
.gs-lrow .gs-media{border-radius:12px;aspect-ratio:1}
.gs-ltitle{font-size:16.5px;font-weight:700;line-height:1.35;color:var(--ink);cursor:pointer;margin:0}
.gs-ltitle:hover{color:#9a3412}
.gs-bul{margin:8px 0 0;padding-left:17px;font-size:13px;color:var(--ink2);line-height:1.55}
.gs-bul li{margin-bottom:2px}
.gs-lbuy{border-left:1px solid var(--line2);padding-left:16px;display:flex;flex-direction:column;gap:6px}
.gs-pbig{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap}.gs-pbig .off{color:#c2410c;font-size:17px;font-weight:600}.gs-pbig b{font-size:24px;font-weight:800;letter-spacing:-.02em}
.gs-pbig b sup{font-size:12px;font-weight:700;top:-.7em;margin-right:1px}
.gs-mrp{font-size:12px;color:var(--mute)}.gs-mrp s{margin-left:3px}
.gs-deal{display:inline-block;background:#9a3412;color:#fff;font-size:11px;font-weight:800;padding:3px 8px;border-radius:5px}
.gs-pick{font-size:12.5px;color:var(--ink2)}.gs-pick b{color:var(--green)}
.gs-urg{font-size:12.5px;color:var(--red);font-weight:700}
.gs-instock{font-size:13px;color:var(--green);font-weight:700}
@media(max-width:860px){.gs-lrow{grid-template-columns:130px minmax(0,1fr);gap:12px;padding:12px}.gs-lbuy{grid-column:2;border-left:none;padding-left:0}.gs-lrow .gs-bul{display:none}.gs-ltitle{font-size:14.5px}}
.gs-pager{display:flex;justify-content:center;gap:6px;padding:10px 0 4px;flex-wrap:wrap}
.gs-pager button{min-width:38px;height:38px;border-radius:10px;border:1px solid var(--line);background:#fff;font-weight:700;font-size:13.5px;color:var(--ink2);padding:0 10px}
.gs-pager button.on{background:var(--navy);color:#fff;border-color:var(--navy)}.gs-pager button:disabled{opacity:.4;cursor:default}
.gs-mrpline{font-size:11.5px;color:var(--mute);margin-top:-2px}
/* product page */
.gs-crumb{display:flex;gap:6px;align-items:center;font-size:12.5px;color:var(--mute);padding:14px 0 10px;flex-wrap:wrap}
.gs-crumb button{border:none;background:none;padding:0;color:var(--navy2);font-weight:600;font-size:12.5px}.gs-crumb button:hover{text-decoration:underline}
.gs-pp{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1.15fr) 300px;gap:26px;align-items:start}
@media(max-width:1100px){.gs-pp{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.gs-buybox{grid-column:2}}
@media(max-width:767px){.gs-pp{grid-template-columns:1fr;gap:16px}.gs-buybox{grid-column:auto}}
.gs-gal{display:grid;grid-template-columns:62px minmax(0,1fr);gap:10px;position:sticky;top:84px}
.gs-gthumbs{display:flex;flex-direction:column;gap:8px}
.gs-gthumbs button{width:62px;height:62px;border-radius:10px;border:1.5px solid var(--line);background:#fff;padding:0;overflow:hidden;display:grid;place-items:center;font-size:22px}
.gs-gthumbs button.on{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold2)}
.gs-gthumbs img{width:100%;height:100%;object-fit:cover}
.gs-gmain{aspect-ratio:1;border-radius:18px;background:linear-gradient(145deg,#f3efe6,#e6dfcf);overflow:hidden;position:relative;display:grid;place-items:center;font-size:96px;border:1px solid var(--line)}
.gs-gmain img{width:100%;height:100%;object-fit:contain;background:#fff;transition:transform .15s ease-out}
@media(hover:hover){.gs-gmain.zoom img{transform:scale(1.9);cursor:zoom-in}}
.gs-gslide{display:none}
@media(max-width:767px){.gs-gal{grid-template-columns:1fr;position:static}.gs-gthumbs,.gs-gmain.d{display:none}
  .gs-gslide{display:flex;overflow-x:auto;scroll-snap-type:x mandatory;border-radius:18px;border:1px solid var(--line);scrollbar-width:none;background:#fff}.gs-gslide::-webkit-scrollbar{display:none}
  .gs-gslide>div{flex:none;width:100%;aspect-ratio:1;scroll-snap-align:center;display:grid;place-items:center;font-size:84px;background:linear-gradient(145deg,#f3efe6,#e6dfcf)}
  .gs-gslide img{width:100%;height:100%;object-fit:contain;background:#fff}}
.gs-dots{display:none;justify-content:center;gap:6px;margin-top:8px}.gs-dots i{width:7px;height:7px;border-radius:99px;background:#d6d0c4}.gs-dots i.on{background:var(--navy);width:18px}
@media(max-width:767px){.gs-dots{display:flex}}
.gs-ptitle{font-size:clamp(21px,2.6vw,27px);line-height:1.25;margin:0;font-weight:700}
.gs-hr{border:none;border-top:1px solid var(--line);margin:14px 0}
.gs-buybox{background:#fff;border:1px solid var(--line);border-radius:18px;padding:18px;display:flex;flex-direction:column;gap:10px;position:sticky;top:84px;box-shadow:var(--sh)}
.gs-qty{height:40px;border-radius:10px;border:1px solid var(--line);background:#f7f5f0;padding:0 10px;font-size:13.5px;font-weight:600;outline:none}
.gs-kv{width:100%;border-collapse:collapse;font-size:13.5px}.gs-kv td{padding:10px 12px;border-bottom:1px solid var(--line2);vertical-align:top}
.gs-kv td:first-child{width:38%;background:#faf8f3;font-weight:700;color:var(--ink2)}
.gs-sec{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;margin-top:18px}
.gs-sec h3{margin:0 0 12px;font-size:19px}
.gs-hist{display:grid;grid-template-columns:44px 1fr 38px;gap:8px;align-items:center;font-size:12.5px;color:var(--navy2);font-weight:600;margin:6px 0}
.gs-hist div{height:18px;border-radius:5px;background:#f0ece4;overflow:hidden;border:1px solid var(--line)}.gs-hist div i{display:block;height:100%;background:linear-gradient(90deg,#d9a632,#b7791f)}
.gs-revgrid{display:grid;grid-template-columns:280px minmax(0,1fr);gap:26px}
@media(max-width:767px){.gs-revgrid{grid-template-columns:1fr}}
.gs-carousel{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(170px,190px);gap:12px;overflow-x:auto;padding-bottom:6px;scroll-snap-type:x proximity}
.gs-carousel .gs-card{scroll-snap-align:start}
`

const Stars = ({ r, count }) => {
  const k = Math.round(r || 0)
  return <span className="gs-stars" aria-label={`${r} out of 5`}>{'★'.repeat(k)}{'☆'.repeat(5 - k)}{count != null && <span>({count})</span>}</span>
}
const SearchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
const BagIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h12l-1 13H7L6 7Z" /><path d="M9 7a3 3 0 0 1 6 0" /></svg>

// Loads the tiny QR library once from the CDN; falls back to the text code if offline.
let qrPromise = null
function useQR(text) {
  const [svg, setSvg] = useState(null)
  useEffect(() => {
    if (!text) return
    let alive = true
    if (!qrPromise) {
      qrPromise = new Promise((resolve, reject) => {
        if (window.qrcode) return resolve(window.qrcode)
        const s = document.createElement('script'); s.src = QR_LIB; s.async = true
        s.onload = () => resolve(window.qrcode); s.onerror = () => { qrPromise = null; reject(new Error('qr')) }
        document.head.appendChild(s)
      })
    }
    qrPromise.then(qrcode => {
      if (!alive || !qrcode) return
      const qr = qrcode(0, 'M'); qr.addData(text); qr.make()
      setSvg(qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true }))
    }).catch(() => {})
    return () => { alive = false }
  }, [text])
  return svg
}

// Close top overlay on Esc and stop the page scrolling behind it.
function useOverlay(onClose) {
  const ref = useRef(onClose); ref.current = onClose
  useEffect(() => {
    const k = e => { if (e.key === 'Escape') ref.current() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', k)
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [])
}

const arr = v => Array.isArray(v) ? v : (() => { try { const x = JSON.parse(v || '[]'); return Array.isArray(x) ? x : [] } catch { return [] } })()
const PER_PAGE = 24
const PRICE_BANDS = [[0, 100, 'Under ₹100'], [100, 300, '₹100 – ₹300'], [300, 700, '₹300 – ₹700'], [700, Infinity, 'Over ₹700']]
const NO_FILTERS = { price: null, sizes: [], rating: 0, deals: false, brands: [], inStock: false }
const Price = ({ v }) => <b><sup>₹</sup>{n(v)}</b>
const GridIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="8" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /><rect x="13" y="13" width="8" height="8" rx="2" /></svg>
const ListIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="6" height="6" rx="1.5" /><rect x="11" y="5" width="10" height="2" rx="1" /><rect x="11" y="8" width="7" height="1.6" rx=".8" /><rect x="3" y="14" width="6" height="6" rx="1.5" /><rect x="11" y="15" width="10" height="2" rx="1" /><rect x="11" y="18" width="7" height="1.6" rx=".8" /></svg>

export default function StorePublic() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('All')
  const [sort, setSort] = useState('featured')
  const [flt, setFlt] = useState(NO_FILTERS)
  const [view, setView] = useState(() => readLS('gnsi_store_view', 'grid'))
  const [page, setPage] = useState(1)
  const [showFilters, setShowFilters] = useState(false)
  const [cart, setCart] = useState(() => readLS(CART_KEY, {}))
  const [showCart, setShowCart] = useState(false)
  const [form, setForm] = useState(() => ({ name: '', phone: '', gcc_no: '', ...readLS(CUSTOMER_KEY, {}), note: '' }))
  const [remembered, setRemembered] = useState(() => !!readLS(CUSTOMER_KEY, null))
  const [pass, setPass] = useState(null)
  const [promoCode, setPromoCode] = useState('')
  const [promoResult, setPromoResult] = useState(null)
  const [ratings, setRatings] = useState({})
  const [wishlist, setWishlist] = useState(() => new Set(readLS(WISHLIST_KEY, [])))
  const [showWishlist, setShowWishlist] = useState(false)
  const [detail, setDetail] = useState(null)
  const [showTrack, setShowTrack] = useState(false)
  const [sel, setSel] = useState({})
  const [toast, setToast] = useState(null)
  const [bump, setBump] = useState(0)
  const listScroll = useRef(0)
  const [recent, setRecent] = useState(() => readLS(RECENT_KEY, []))
  const [compare, setCompare] = useState([])
  const [showCompare, setShowCompare] = useState(false)
  const [wishPrices, setWishPrices] = useState(() => readLS(WISH_PRICE_KEY, {}))
  const [kits, setKits] = useState([])

  const loadRatings = () => supabase.from('store_product_ratings').select('*').then(({ data }) => {
    if (data) setRatings(Object.fromEntries(data.map(r => [r.product_id, r])))
  })

  // Catalogue + rich listing details (photos, bullets, specs) merged by id.
  useEffect(() => {
    Promise.all([
      supabase.from('store_public_catalog').select('*').order('name'),
      supabase.from('store_public_listing').select('*'),
    ]).then(([c, l]) => {
      if (c.error) { setError(c.error.message); setLoading(false); return }
      const L = new Map((l.error ? [] : l.data || []).map(x => [x.id, x]))
      setItems((c.data || []).map(p => {
        const x = L.get(p.id) || {}
        const gallery = [...new Set([p.image_url, ...arr(x.images)].filter(Boolean))]
        return { ...p, brand: x.brand || null, bullets: arr(x.bullets).filter(Boolean), specs: arr(x.specs).filter(s => s?.k && s?.v), keywords: x.keywords || '', gallery }
      }))
      setLoading(false)
    })
    loadRatings()
    supabase.from('store_public_kits').select('*').order('sort_order').then(({ data, error }) => { if (!error) setKits(data || []) })
  }, [])

  // Sizes of one product share listing content: a size without its own photos,
  // bullets or specs borrows the richest sibling's (its own main photo stays first).
  const catalog = useMemo(() => {
    const fam = new Map()
    items.forEach(p => { const k = groupKey(p); if (!fam.has(k)) fam.set(k, []); fam.get(k).push(p) })
    const richest = (vs, f) => vs.map(f).reduce((a, b) => ((b?.length || 0) > (a?.length || 0) ? b : a), null)
    return items.map(p => {
      const vs = fam.get(groupKey(p))
      if (vs.length < 2) return p
      return {
        ...p,
        gallery: [...new Set([...p.gallery, ...(richest(vs, v => v.gallery) || [])])],
        bullets: p.bullets.length ? p.bullets : richest(vs, v => v.bullets) || [],
        specs: p.specs.length ? p.specs : richest(vs, v => v.specs) || [],
        brand: p.brand || vs.find(v => v.brand)?.brand || null,
        description: p.description || richest(vs, v => v.description) || null,
      }
    })
  }, [items])

  const byId = useMemo(() => new Map(catalog.map(i => [i.id, i])), [catalog])
  useEffect(() => { writeLS(CART_KEY, cart) }, [cart])
  useEffect(() => { writeLS('gnsi_store_view', view) }, [view])
  useEffect(() => {
    if (!items.length) return
    setCart(c => {
      const x = {}
      Object.entries(c).forEach(([id, qty]) => { const p = byId.get(Number(id)); if (p && p.in_stock) x[id] = Math.min(qty, p.stock, 50) })
      return x
    })
  }, [items, byId])

  // Deep link /store?p=<id>
  const [deepId, setDeepId] = useState(() => { try { return Number(new URLSearchParams(window.location.search).get('p')) || null } catch { return null } })
  useEffect(() => {
    if (!deepId || !items.length) return
    if (byId.get(deepId)) setDetail(byId.get(deepId))
    setDeepId(null)
  }, [deepId, items, byId])
  useEffect(() => {
    if (deepId) return
    try {
      const url = new URL(window.location.href)
      if (detail) url.searchParams.set('p', detail.id); else url.searchParams.delete('p')
      window.history.replaceState(null, '', url.pathname + url.search + url.hash)
    } catch {}
  }, [detail, deepId])

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3200); return () => clearTimeout(t) }, [toast])
  const notify = (msg, icon = '✓') => setToast({ msg, icon, k: Date.now() })

  const toggleWishlist = id => {
    const on = !wishlist.has(id)
    setWishlist(w => { const x = new Set(w); on ? x.add(id) : x.delete(id); writeLS(WISHLIST_KEY, [...x]); return x })
    setWishPrices(m => { const x = { ...m }; if (on) x[id] = byId.get(id)?.price ?? null; else delete x[id]; writeLS(WISH_PRICE_KEY, x); return x })
    if (on) notify('Saved — we\'ll show you if the price drops', '♥')
  }
  // Price dropped since it was saved to the wishlist?
  const dropOf = p => { const was = Number(wishPrices[p.id]); return wishlist.has(p.id) && was > Number(p.price) ? was - Number(p.price) : 0 }
  const drops = useMemo(() => [...wishlist].map(id => byId.get(id)).filter(p => p && Number(wishPrices[p.id]) > Number(p.price)), [wishlist, wishPrices, byId])
  const dropNotified = useRef(false)
  useEffect(() => {
    if (dropNotified.current || !drops.length) return
    dropNotified.current = true
    notify(`${drops.length} wishlist item${drops.length > 1 ? 's are' : ' is'} cheaper now`, '📉')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops.length])

  const toggleCompare = p => setCompare(c => {
    if (c.includes(p.id)) return c.filter(x => x !== p.id)
    if (c.length >= 3) { notify('Compare up to 3 products at a time', '!'); return c }
    return [...c, p.id]
  })

  // ── Size variants grouped into one product ──
  const groups = useMemo(() => {
    const m = new Map()
    catalog.forEach(p => { const k = groupKey(p); if (!m.has(k)) m.set(k, []); m.get(k).push(p) })
    return [...m.entries()].map(([key, variants]) => ({ key, variants: variants.sort(bySize) }))
  }, [catalog])
  const groupOf = useMemo(() => { const m = new Map(); groups.forEach(g => g.variants.forEach(v => m.set(v.id, g))); return m }, [groups])
  const pick = g => g.variants.find(v => v.id === sel[g.key]) || (flt.sizes.length && g.variants.find(v => flt.sizes.includes(v.size) && v.in_stock)) || g.variants.find(v => v.in_stock) || g.variants[0]
  const groupRating = g => {
    let c = 0, s = 0
    g.variants.forEach(v => { const r = ratings[v.id]; if (r) { c += Number(r.review_count); s += Number(r.avg_rating) * Number(r.review_count) } })
    return c ? { review_count: c, avg_rating: Math.round(s / c * 10) / 10 } : null
  }
  const categories = useMemo(() => ['All', ...Array.from(new Set(catalog.map(i => i.category).filter(Boolean)))], [catalog])

  // Search + category first; the sidebar facets are counted from this set.
  const base = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
    return groups.filter(g => {
      if (showWishlist) return g.variants.some(v => wishlist.has(v.id))
      if (cat !== 'All' && g.variants[0].category !== cat) return false
      if (!words.length) return true
      const hay = g.variants.map(i => [i.name, i.size, i.category, i.description, i.brand, i.keywords, ...(i.bullets || [])].join(' ')).join(' ').toLowerCase()
      return words.every(w => hay.includes(w))
    })
  }, [groups, q, cat, showWishlist, wishlist])

  const facets = useMemo(() => {
    const sizes = new Map(), brands = new Map()
    base.forEach(g => {
      new Set(g.variants.map(v => v.size).filter(Boolean)).forEach(s => sizes.set(s, (sizes.get(s) || 0) + 1))
      const b = g.variants[0].brand; if (b) brands.set(b, (brands.get(b) || 0) + 1)
    })
    return {
      sizes: [...sizes.keys()].sort((a, b) => bySize({ size: a }, { size: b })),
      brands: [...brands.entries()].sort((a, b) => b[1] - a[1]),
      bands: PRICE_BANDS.map(([lo, hi, l]) => ({ lo, hi, l, c: base.filter(g => g.variants.some(v => v.price >= lo && v.price < hi)).length })),
      deals: base.filter(g => g.variants.some(v => v.on_sale)).length,
      rating: [4, 3].map(r => ({ r, c: base.filter(g => (groupRating(g)?.avg_rating || 0) >= r).length })),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, ratings])

  const results = useMemo(() => {
    const list = base.filter(g => {
      const v = g.variants
      if (flt.inStock && !v.some(x => x.in_stock)) return false
      if (flt.deals && !v.some(x => x.on_sale)) return false
      if (flt.price && !v.some(x => x.price >= flt.price[0] && x.price <= flt.price[1])) return false
      if (flt.sizes.length && !v.some(x => flt.sizes.includes(x.size))) return false
      if (flt.brands.length && !flt.brands.includes(v[0].brand)) return false
      if (flt.rating && (groupRating(g)?.avg_rating || 0) < flt.rating) return false
      return true
    })
    const minPrice = g => Math.min(...g.variants.map(v => Number(v.price)))
    const cmp = {
      featured: (a, b) => Number(b.variants.some(v => v.in_stock)) - Number(a.variants.some(v => v.in_stock)) || (b.variants[0].gallery?.length ? 1 : 0) - (a.variants[0].gallery?.length ? 1 : 0) || a.variants[0].name.localeCompare(b.variants[0].name),
      price_asc: (a, b) => minPrice(a) - minPrice(b),
      price_desc: (a, b) => minPrice(b) - minPrice(a),
      rating: (a, b) => (groupRating(b)?.avg_rating || 0) - (groupRating(a)?.avg_rating || 0) || (groupRating(b)?.review_count || 0) - (groupRating(a)?.review_count || 0),
      discount: (a, b) => Math.max(...b.variants.map(discountPct)) - Math.max(...a.variants.map(discountPct)),
    }[sort]
    return list.sort(cmp)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, flt, sort, ratings])

  useEffect(() => { setPage(1) }, [q, cat, flt, sort, showWishlist])
  const pages = Math.max(1, Math.ceil(results.length / PER_PAGE))
  const pageItems = results.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const goPage = p => { setPage(p); window.scrollTo?.({ top: 0, behavior: 'smooth' }) }

  const activeChips = [
    ...(cat !== 'All' ? [[cat, () => setCat('All')]] : []),
    ...(flt.price ? [[flt.price[1] === Infinity ? `Over ₹${n(flt.price[0])}` : `₹${n(flt.price[0])} – ₹${n(flt.price[1])}`, () => setFlt(f => ({ ...f, price: null }))]] : []),
    ...flt.sizes.map(s => [`Size ${s}`, () => setFlt(f => ({ ...f, sizes: f.sizes.filter(x => x !== s) }))]),
    ...flt.brands.map(b => [b, () => setFlt(f => ({ ...f, brands: f.brands.filter(x => x !== b) }))]),
    ...(flt.rating ? [[`${flt.rating}★ & up`, () => setFlt(f => ({ ...f, rating: 0 }))]] : []),
    ...(flt.deals ? [['Deals', () => setFlt(f => ({ ...f, deals: false }))]] : []),
    ...(flt.inStock ? [['In stock', () => setFlt(f => ({ ...f, inStock: false }))]] : []),
  ]
  const clearAll = () => { setFlt(NO_FILTERS); setCat('All'); setQ('') }
  const filterCount = activeChips.length - (cat !== 'All' ? 1 : 0)

  const lines = Object.entries(cart).map(([id, qty]) => ({ p: byId.get(Number(id)), qty })).filter(l => l.p)
  const count = lines.reduce((a, l) => a + l.qty, 0)
  const subtotal = lines.reduce((a, l) => a + l.p.price * l.qty, 0)
  const promoOff = promoResult?.valid ? Math.min(Number(promoResult.amount_off) || 0, subtotal) : 0
  const total = Math.max(subtotal - promoOff, 0)
  const savings = lines.reduce((a, l) => a + Math.max(0, (Number(strikeOf(l.p)) || 0) - l.p.price) * l.qty, 0) + promoOff

  const setQty = (p, qty, announce) => {
    const q2 = Math.max(0, Math.min(qty, p.stock, 50))
    setCart(c => { const x = { ...c }; if (q2 === 0) delete x[p.id]; else x[p.id] = q2; return x })
    if (qty > p.stock) notify(`Only ${p.stock} available in ${p.size ? 'size ' + p.size : 'stock'}`, '!')
    else if (announce && q2 > 0) { notify(`${p.name}${p.size ? ' · ' + p.size : ''} added to bag`, '🛍️'); setBump(b => b + 1) }
  }

  const reorder = order => {
    let added = 0, missing = 0
    const next = { ...cart }
    ;(order.items || []).forEach(it => {
      const p = byId.get(Number(it.product_id))
      if (!p || !p.in_stock) { missing++; return }
      next[p.id] = Math.min((next[p.id] || 0) + (Number(it.qty) || 1), p.stock, 50); added++
    })
    setCart(next); setShowTrack(false)
    if (added) { setShowCart(true); notify(missing ? `${added} added · ${missing} no longer available` : 'Added to your bag', '🔁') }
    else notify('Sorry — those items are not available right now.', '!')
  }

  const onPlaced = placed => {
    const customer = { name: form.name.trim(), phone: form.phone.trim(), gcc_no: form.gcc_no.trim() }
    writeLS(CUSTOMER_KEY, customer); setRemembered(true)
    setPass({ ...placed, ...customer, status: 'new', fresh: true })
    setCart({}); setShowCart(false); setPromoCode(''); setPromoResult(null); setForm(f => ({ ...f, note: '' }))
  }

  const openProduct = p => { listScroll.current = window.scrollY || 0; setDetail(p); window.scrollTo?.(0, 0) }
  useEffect(() => {
    if (!detail) return
    const key = groupOf.get(detail.id)?.key || String(detail.id)
    setRecent(r => { const x = [{ id: detail.id, key }, ...r.filter(e => e.key !== key)].slice(0, 12); writeLS(RECENT_KEY, x); return x })
  }, [detail, groupOf])
  const recentItems = recent.map(e => byId.get(e.id)).filter(Boolean)
  const kitList = useMemo(() => kits.map(k => {
    const items = arr(k.items).map(i => ({ p: byId.get(Number(i.product_id)), qty: Number(i.qty) || 1 })).filter(i => i.p)
    return { ...k, list: items, total: items.reduce((a, i) => a + i.p.price * i.qty, 0), short: items.filter(i => !i.p.in_stock || i.p.stock < i.qty) }
  }).filter(k => k.list.length), [kits, byId])
  const addKit = k => {
    const next = { ...cart }; let added = 0
    k.list.forEach(({ p, qty }) => { if (!p.in_stock) return; next[p.id] = Math.min((next[p.id] || 0) + qty, p.stock, 50); added++ })
    setCart(next); setBump(b => b + 1)
    notify(added === k.list.length ? `${k.name} added to bag` : `${added} of ${k.list.length} kit items added — the rest are sold out`, '🎒')
  }
  const closeProduct = () => { setDetail(null); requestAnimationFrame(() => window.scrollTo?.(0, listScroll.current)) }
  const goCategory = c => { setDetail(null); setShowWishlist(false); setCat(c); window.scrollTo?.(0, 0) }
  const onSearch = v => { setQ(v); if (detail) setDetail(null); if (showWishlist) setShowWishlist(false) }

  const overlayOpen = showCart || showTrack || pass || showFilters || showCompare
  const banner = !detail && !showWishlist && !q && cat === 'All' && !filterCount && page === 1

  const searchBar = cls => <SearchBox cls={cls} q={q} onSearch={onSearch} cat={cat} categories={categories} goCategory={goCategory} groups={groups} pick={pick} onOpen={openProduct} />

  const filterPanel = (
    <>
      <div className="gs-fgroup">
        <h5>Category</h5>
        {categories.map(c => <button key={c} className={`gs-fopt${cat === c ? ' on' : ''}`} onClick={() => setCat(c)}>{c === 'All' ? 'All products' : <><span>{catIcon(c)}</span>{c}</>}</button>)}
      </div>
      {facets.rating.some(r => r.c) && (
        <div className="gs-fgroup">
          <h5>Customer reviews</h5>
          {facets.rating.map(({ r, c }) => <button key={r} className={`gs-fopt${flt.rating === r ? ' on' : ''}`} onClick={() => setFlt(f => ({ ...f, rating: f.rating === r ? 0 : r }))}><Stars r={r} /><span>&amp; up</span><span className="ct">{c}</span></button>)}
        </div>
      )}
      <div className="gs-fgroup">
        <h5>Price</h5>
        {facets.bands.filter(b => b.c).map(b => {
          const on = flt.price && flt.price[0] === b.lo && flt.price[1] === (b.hi === Infinity ? Infinity : b.hi - 0.01)
          return <button key={b.l} className={`gs-fopt${on ? ' on' : ''}`} onClick={() => setFlt(f => ({ ...f, price: on ? null : [b.lo, b.hi === Infinity ? Infinity : b.hi - 0.01] }))}>{b.l}<span className="ct">{b.c}</span></button>
        })}
        <PriceRange onApply={r => setFlt(f => ({ ...f, price: r }))} />
      </div>
      {facets.sizes.length > 0 && (
        <div className="gs-fgroup">
          <h5>Size</h5>
          <div className="gs-fsizes">{facets.sizes.map(s => <button key={s} className={`gs-size${flt.sizes.includes(s) ? ' on' : ''}`} onClick={() => setFlt(f => ({ ...f, sizes: f.sizes.includes(s) ? f.sizes.filter(x => x !== s) : [...f.sizes, s] }))}>{s}</button>)}</div>
        </div>
      )}
      {facets.brands.length > 0 && (
        <div className="gs-fgroup">
          <h5>Brand</h5>
          {facets.brands.map(([b, c]) => { const on = flt.brands.includes(b); return <button key={b} className={`gs-fopt${on ? ' on' : ''}`} onClick={() => setFlt(f => ({ ...f, brands: on ? f.brands.filter(x => x !== b) : [...f.brands, b] }))}><span className="bx">{on ? '✓' : ''}</span>{b}<span className="ct">{c}</span></button> })}
        </div>
      )}
      <div className="gs-fgroup">
        <h5>Deals &amp; availability</h5>
        <button className={`gs-fopt${flt.deals ? ' on' : ''}`} onClick={() => setFlt(f => ({ ...f, deals: !f.deals }))}><span className="bx">{flt.deals ? '✓' : ''}</span>Today's deals<span className="ct">{facets.deals}</span></button>
        <button className={`gs-fopt${flt.inStock ? ' on' : ''}`} onClick={() => setFlt(f => ({ ...f, inStock: !f.inStock }))}><span className="bx">{flt.inStock ? '✓' : ''}</span>In stock only</button>
      </div>
    </>
  )

  return (
    <div className="gs">
      <style>{CSS}</style>

      <header className="gs-head">
        <div className="gs-wrap">
          <div className="gs-head-in">
            <button onClick={() => { clearAll(); setDetail(null); setShowWishlist(false) }} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#fff', padding: 0 }} aria-label="Store home">
              <div className="gs-mark">G</div>
              <div className="gs-brand" style={{ textAlign: 'left' }}><b>GNSI Store</b><span>Campus pickup</span></div>
            </button>
            {searchBar('d')}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button className="gs-hbtn" onClick={() => setShowTrack(true)} aria-label="My orders">📦<span className="gs-hide-m">Orders</span></button>
              <button className={`gs-hbtn${showWishlist ? ' on' : ''}`} onClick={() => { setDetail(null); setShowWishlist(w => !w) }} aria-label="Wishlist">♥{wishlist.size > 0 && <span className="gs-badge" style={showWishlist ? {} : { background: 'rgba(255,255,255,.2)' }}>{wishlist.size}</span>}</button>
              <button className="gs-hbtn gs-cartbtn" onClick={() => setShowCart(true)} aria-label="Bag">
                <BagIcon /><span className="gs-hide-m">Bag</span><span key={bump} className={`gs-badge${bump ? ' gs-bump' : ''}`}>{count}</span>
              </button>
            </div>
          </div>
          <div className="gs-msearch">{searchBar('m')}</div>
        </div>
      </header>
      <nav className="gs-subnav" aria-label="Categories">
        <div className="gs-wrap">
          {categories.map(c => <button key={c} className={cat === c && !showWishlist ? 'on' : ''} onClick={() => goCategory(c)}>{c === 'All' ? '☰ All' : `${catIcon(c)} ${c}`}</button>)}
          <button className={flt.deals ? 'on' : ''} onClick={() => { setDetail(null); setFlt(f => ({ ...f, deals: !f.deals })) }}>🏷️ Today's deals</button>
        </div>
      </nav>

      <main className="gs-wrap">
        {detail ? (
          <ProductPage product={detail} variants={groupOf.get(detail.id)?.variants || [detail]} ratings={ratings}
            related={(() => { const own = groupOf.get(detail.id)?.key; return groups.filter(g => g.key !== own && g.variants[0].category === detail.category).slice(0, 12).map(pick) })()}
            inCart={cart[detail.id] || 0} wished={wishlist.has(detail.id)} onWish={() => toggleWishlist(detail.id)}
            onBack={closeProduct} onCategory={goCategory}
            onAdd={(p, k) => setQty(p, (cart[p.id] || 0) + k, true)}
            onBuy={(p, k) => { if (!cart[p.id]) setQty(p, k); setShowCart(true) }}
            onOpenVariant={p => { setDetail(p); const g = groupOf.get(p.id); if (g) setSel(s => ({ ...s, [g.key]: p.id })) }}
            onOpenRelated={p => { setDetail(p); window.scrollTo?.({ top: 0, behavior: 'smooth' }) }}
            refreshRatings={loadRatings} wishlist={wishlist} toggleWishlist={toggleWishlist} cart={cart} setQty={setQty}
            drop={dropOf(detail)} customer={form} comparing={compare.includes(detail.id)} onCompare={() => toggleCompare(detail)}
            recent={recentItems.filter(p => groupOf.get(p.id)?.key !== groupOf.get(detail.id)?.key).slice(0, 10)} />
        ) : (
          <>
            {banner && (
              <section className="gs-banner">
                <div>
                  <span className="gs-eyebrow">Official campus store</span>
                  <h2 className="gs-serif">Everything your child needs, packed and waiting at the counter.</h2>
                  <p>Order in a minute · pay when you collect · Cash, UPI &amp; card</p>
                </div>
                <div className="gs-bsteps"><span><b>1</b>Order online</span><span><b>2</b>We pack it</span><span><b>3</b>Pay &amp; collect</span></div>
              </section>
            )}

            {banner && kitList.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <h3 className="gs-serif" style={{ margin: 0, fontSize: 21 }}>🎒 Complete kits</h3>
                  <span className="gs-count">Everything for the term in one tap</span>
                </div>
                <div className="gs-kits">{kitList.map(k => <KitCard key={k.id} k={k} onAdd={() => addKit(k)} onOpen={openProduct} />)}</div>
              </section>
            )}
            {banner && recentItems.length > 0 && (
              <section style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <h3 className="gs-serif" style={{ margin: 0, fontSize: 21 }}>Recently viewed</h3>
                  <button className="gs-link" onClick={() => { setRecent([]); writeLS(RECENT_KEY, []) }}>Clear</button>
                </div>
                <div className="gs-carousel">{recentItems.map((p, i) => <GridCard key={p.id} g={{ variants: [p] }} p={p} idx={i} rate={ratings[p.id] ? { avg_rating: ratings[p.id].avg_rating, review_count: ratings[p.id].review_count } : null} qty={cart[p.id] || 0} wished={wishlist.has(p.id)} onWish={() => toggleWishlist(p.id)} onOpen={() => openProduct(p)} onSize={() => {}} setQty={setQty} drop={dropOf(p)} />)}</div>
              </section>
            )}

            <div className="gs-layout">
              <aside className="gs-side" aria-label="Filters">{filterPanel}</aside>
              <section>
                <div className="gs-mfbar">
                  <button className="gs-ghost" style={{ height: 38 }} onClick={() => setShowFilters(true)}>⚙ Filters{filterCount ? ` (${filterCount})` : ''}</button>
                  <select className="gs-select" style={{ height: 38, flex: 1 }} value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  <div className="gs-vt"><button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view"><GridIcon /></button><button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view"><ListIcon /></button></div>
                </div>
                <div className="gs-rhead">
                  <div className="t">
                    {showWishlist ? <><b>Your wishlist</b> · {results.length} saved</>
                      : loading ? 'Loading products…'
                      : <>{results.length ? <><b>{(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, results.length)}</b> of <b>{results.length}</b> result{results.length === 1 ? '' : 's'}</> : 'No results'}{q && <> for <span className="q">“{q}”</span></>}{cat !== 'All' && !q && <> in <b>{cat}</b></>}</>}
                  </div>
                  <div className="gs-hide-m" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span className="gs-count">Sort by</span>
                    <select className="gs-select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort products desktop">{SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <div className="gs-vt"><button className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} aria-label="Grid view"><GridIcon /></button><button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} aria-label="List view"><ListIcon /></button></div>
                  </div>
                </div>
                {activeChips.length > 0 && (
                  <div className="gs-achips">
                    {activeChips.map(([l, clear]) => <span key={l} className="gs-achip">{l}<button onClick={clear} aria-label={`Remove ${l}`}>×</button></span>)}
                    <button className="gs-link" onClick={clearAll}>Clear all</button>
                  </div>
                )}

                {loading ? (
                  <div className="gs-grid">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div key={i} className="gs-skel"><div className="gs-shim" style={{ aspectRatio: '4/3' }} /><div style={{ padding: 14 }}><div className="gs-shim" style={{ height: 14, borderRadius: 6, width: '70%' }} /><div className="gs-shim" style={{ height: 12, borderRadius: 6, width: '40%', marginTop: 10 }} /><div className="gs-shim" style={{ height: 34, borderRadius: 10, marginTop: 16 }} /></div></div>
                    ))}
                  </div>
                ) : error ? (
                  <div className="gs-empty"><div className="i">🛠️</div><b>The store is taking a short break</b>Please try again in a little while.</div>
                ) : results.length === 0 ? (
                  <div className="gs-empty">
                    <div className="i">{showWishlist ? '♡' : '🔍'}</div>
                    <b>{showWishlist ? 'Nothing saved yet' : 'No products match'}</b>
                    {showWishlist ? 'Tap ♡ on any product to keep it here.' : <>Try fewer filters or another word. <button className="gs-link" onClick={clearAll}>Clear all</button></>}
                  </div>
                ) : (
                  <>
                    <div className={view === 'list' ? 'gs-list' : 'gs-grid'}>
                      {pageItems.map((g, idx) => {
                        const p = showWishlist ? (g.variants.find(v => v.id === sel[g.key] && wishlist.has(v.id)) || g.variants.find(v => wishlist.has(v.id))) : pick(g)
                        const props = { g, p, idx, rate: groupRating(g), qty: cart[p.id] || 0, wished: wishlist.has(p.id), onWish: () => toggleWishlist(p.id), onOpen: () => openProduct(p), onSize: v => setSel(s => ({ ...s, [g.key]: v.id })), setQty, drop: dropOf(p), comparing: compare.includes(p.id), onCompare: () => toggleCompare(p) }
                        return view === 'list' ? <ListRow key={g.key} {...props} /> : <GridCard key={g.key} {...props} />
                      })}
                    </div>
                    {pages > 1 && (
                      <div className="gs-pager">
                        <button disabled={page === 1} onClick={() => goPage(page - 1)}>‹ Previous</button>
                        {Array.from({ length: pages }, (_, i) => i + 1).filter(p => p === 1 || p === pages || Math.abs(p - page) <= 1).map((p, i, a) => (
                          <span key={p} style={{ display: 'contents' }}>{i > 0 && p - a[i - 1] > 1 && <button disabled>…</button>}<button className={p === page ? 'on' : ''} onClick={() => goPage(p)}>{p}</button></span>
                        ))}
                        <button disabled={page === pages} onClick={() => goPage(page + 1)}>Next ›</button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
          </>
        )}
        <div className="gs-footer">
          Pay at pickup · Cash, UPI &amp; card accepted · {COUNTER.place} · {COUNTER.hours}<br />
          © Guidance Navodaya &amp; Sainik Institute, Khangabok, Thoubal, Manipur
        </div>
      </main>

      {count > 0 && !overlayOpen && (
        <div className="gs-mbar">
          <button onClick={() => setShowCart(true)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><BagIcon /> View bag · {count} item{count > 1 ? 's' : ''}</span>
            <span className="pill">₹{n(total)}</span>
          </button>
        </div>
      )}

      {toast && <div key={toast.k} role="status" className={`gs-toast${count > 0 && !overlayOpen ? ' lift' : ''}`}><span>{toast.icon}</span>{toast.msg}</div>}

      {compare.length > 0 && !overlayOpen && !showCompare && (
        <div className={`gs-ctray${count > 0 ? ' lift' : ''}`}>
          {compare.map(id => { const p = byId.get(id); return p && <div key={id} className="gs-thumb" style={{ width: 44, height: 44, fontSize: 18, position: 'relative' }}>{p.gallery?.[0] ? <img src={p.gallery[0]} alt="" /> : catIcon(p.category)}<button onClick={() => toggleCompare(p)} aria-label="Remove">×</button></div> })}
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--mute)' }}>{compare.length}/3</span>
          <button className="gs-cta" style={{ width: 'auto', height: 40, padding: '0 16px', fontSize: 13.5 }} disabled={compare.length < 2} onClick={() => setShowCompare(true)}>Compare{compare.length < 2 ? ' (pick 2+)' : ''}</button>
          <button className="gs-link" onClick={() => setCompare([])}>Clear</button>
        </div>
      )}
      {showCompare && <CompareModal items={compare.map(id => byId.get(id)).filter(Boolean)} ratings={ratings} groupOf={groupOf} cart={cart} setQty={setQty}
        onRemove={id => setCompare(c => { const x = c.filter(y => y !== id); if (x.length < 2) setShowCompare(false); return x })}
        onOpen={p => { setShowCompare(false); openProduct(p) }} onClose={() => setShowCompare(false)} />}

      {showFilters && <FilterSheet count={results.length} onClose={() => setShowFilters(false)} onClear={clearAll}>{filterPanel}</FilterSheet>}

      {showCart && (
        <Checkout lines={lines} count={count} subtotal={subtotal} promoOff={promoOff} total={total} savings={savings}
          setQty={setQty} form={form} setForm={setForm} remembered={remembered}
          onForget={() => { try { localStorage.removeItem(CUSTOMER_KEY) } catch {} setRemembered(false); setForm(f => ({ name: '', phone: '', gcc_no: '', note: f.note })) }}
          promoCode={promoCode} setPromoCode={setPromoCode} promoResult={promoResult} setPromoResult={setPromoResult}
          onClose={() => setShowCart(false)} onPlaced={onPlaced} />
      )}

      {showTrack && <MyOrders defaultPhone={form.phone} onClose={() => setShowTrack(false)} onReorder={reorder} onPass={o => { setShowTrack(false); setPass(o) }} />}
      {pass && <PickupPass order={pass} onClose={() => setPass(null)} onTrack={() => { setPass(null); setShowTrack(true) }} />}
    </div>
  )
}

// ── Smart search: suggestions, recent searches, keyboard, voice ─────────────
function SearchBox({ cls, q, onSearch, cat, categories, goCategory, groups, pick, onOpen }) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const [listening, setListening] = useState(false)
  const [history, setHistory] = useState(() => readLS(SEARCHES_KEY, []))
  const wrap = useRef(null)
  const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const prods = words.length ? groups.filter(g => { const hay = g.variants.map(i => [i.name, i.size, i.category, i.brand, i.keywords, ...(i.bullets || [])].join(' ')).join(' ').toLowerCase(); return words.every(w => hay.includes(w)) }).slice(0, 6).map(pick) : []
  const cats = words.length ? categories.filter(c => c !== 'All' && c.toLowerCase().includes(words.join(' '))).slice(0, 3) : []
  const recents = !words.length ? history.slice(0, 6) : []
  const opts = [...recents.map(t => ({ t: 'recent', v: t })), ...cats.map(c => ({ t: 'cat', v: c })), ...prods.map(p => ({ t: 'prod', v: p }))]

  const remember = term => { const t = term.trim(); if (t.length < 2) return; const x = [t, ...history.filter(h => h.toLowerCase() !== t.toLowerCase())].slice(0, 8); setHistory(x); writeLS(SEARCHES_KEY, x) }
  const choose = o => {
    setOpen(false); setHi(-1)
    if (o.t === 'recent') { onSearch(o.v); remember(o.v) }
    else if (o.t === 'cat') { onSearch(''); goCategory(o.v) }
    else { remember(q); onOpen(o.v) }
  }
  useEffect(() => {
    const close = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  const voice = () => {
    if (!SR) return
    try {
      const r = new SR(); r.lang = 'en-IN'; r.interimResults = false; r.maxAlternatives = 1
      r.onresult = e => { const t = e.results?.[0]?.[0]?.transcript || ''; onSearch(t); remember(t); setOpen(true) }
      r.onend = () => setListening(false); r.onerror = () => setListening(false)
      setListening(true); r.start()
    } catch { setListening(false) }
  }

  return (
    <div ref={wrap} className={`gs-sbox ${cls}`}>
      <form className={`gs-hsearch ${cls}`} role="search" onSubmit={e => { e.preventDefault(); if (hi >= 0 && opts[hi]) choose(opts[hi]); else { remember(q); setOpen(false); e.currentTarget.querySelector('input')?.blur() } }}>
        <select value={cat} onChange={e => goCategory(e.target.value)} aria-label="Category">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <input value={q} onChange={e => { onSearch(e.target.value); setOpen(true); setHi(-1) }} onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi(h => Math.min(h + 1, opts.length - 1)) }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(h - 1, -1)) }
            else if (e.key === 'Escape') { setOpen(false); setHi(-1) }
          }}
          placeholder={listening ? 'Listening…' : 'Search GNSI Store'} aria-label="Search products" aria-expanded={open && opts.length > 0} role="combobox" autoComplete="off" />
        {SR && <button type="button" className={`gs-mic${listening ? ' on' : ''}`} onClick={voice} aria-label="Search by voice" title="Search by voice">🎤</button>}
        <button type="submit" aria-label="Search"><SearchIcon /></button>
      </form>
      {open && opts.length > 0 && (
        <div className="gs-suggest" role="listbox">
          {recents.length > 0 && <div className="h">Recent searches <button className="gs-link" onMouseDown={e => e.preventDefault()} onClick={() => { setHistory([]); writeLS(SEARCHES_KEY, []) }}>Clear</button></div>}
          {opts.map((o, i) => (
            <button key={o.t + (o.v.id || o.v)} role="option" aria-selected={i === hi} className={i === hi ? 'on' : ''} onMouseEnter={() => setHi(i)} onClick={() => choose(o)}>
              {o.t === 'recent' ? <><span className="ic">🕘</span>{o.v}</>
                : o.t === 'cat' ? <><span className="ic">{catIcon(o.v)}</span>in <b>{o.v}</b></>
                : <><span className="gs-thumb" style={{ width: 36, height: 36, fontSize: 16, borderRadius: 8 }}>{o.v.gallery?.[0] ? <img src={o.v.gallery[0]} alt="" /> : catIcon(o.v.category)}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.v.name}</span><b>₹{n(o.v.price)}</b></>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Kit card ────────────────────────────────────────────────────────────────
function KitCard({ k, onAdd, onOpen }) {
  const [openList, setOpenList] = useState(false)
  const pics = k.list.map(i => i.p.gallery?.[0]).filter(Boolean).slice(0, 4)
  return (
    <article className="gs-kit">
      <div className="gs-kit-media">
        {k.image_url ? <img src={k.image_url} alt={k.name} /> : pics.length ? <div className="grid">{pics.map((src, i) => <img key={i} src={src} alt="" />)}</div> : <span style={{ fontSize: 44 }}>🎒</span>}
        <span className="gs-tag sale" style={{ background: 'var(--gold)', color: '#132a4f' }}>{k.list.length} ITEMS</span>
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
        <b style={{ fontSize: 15 }}>{k.name}</b>
        {k.description && <div className="gs-desc">{k.description}</div>}
        <button className="gs-link" style={{ textAlign: 'left' }} onClick={() => setOpenList(o => !o)}>{openList ? 'Hide items ▲' : 'See what\'s inside ▼'}</button>
        {openList && <div style={{ fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6 }}>{k.list.map(({ p, qty }) => <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span onClick={() => onOpen(p)} style={{ cursor: 'pointer', textDecoration: p.in_stock ? 'none' : 'line-through' }}>{p.name}{p.size ? ` · ${p.size}` : ''} × {qty}</span><span>₹{n(p.price * qty)}</span></div>)}</div>}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 6 }}>
          <div><div className="gs-pbig"><Price v={k.total} /></div>{k.short.length > 0 && <div className="gs-urg" style={{ fontSize: 11.5 }}>{k.short.length} item{k.short.length > 1 ? 's' : ''} sold out</div>}</div>
          <button className="gs-add" style={{ background: 'var(--gold)', color: '#132a4f' }} onClick={onAdd} disabled={k.short.length === k.list.length}>🎒 Add kit</button>
        </div>
      </div>
    </article>
  )
}

// ── Compare up to 3 products ────────────────────────────────────────────────
function CompareModal({ items, ratings, groupOf, cart, setQty, onRemove, onOpen, onClose }) {
  useOverlay(onClose)
  const specKeys = [...new Set(items.flatMap(p => (p.specs || []).map(s => s.k)))]
  const rate = p => { let c = 0, s = 0; (groupOf.get(p.id)?.variants || [p]).forEach(v => { const r = ratings[v.id]; if (r) { c += Number(r.review_count); s += Number(r.avg_rating) * Number(r.review_count) } }); return c ? { avg: Math.round(s / c * 10) / 10, c } : null }
  const minPrice = Math.min(...items.map(p => Number(p.price)))
  const Row = ({ label, render }) => <tr><td className="k">{label}</td>{items.map(p => <td key={p.id}>{render(p)}</td>)}</tr>
  return (
    <>
      <div className="gs-ov" onClick={onClose} />
      <div className="gs-dialog" role="dialog" aria-label="Compare products">
        <div className="gs-grab" />
        <div className="gs-dhead"><h3>Compare products</h3><button className="gs-x" onClick={onClose} aria-label="Close">×</button></div>
        <div style={{ overflowX: 'auto', padding: '4px 20px 20px' }}>
          <table className="gs-cmp">
            <tbody>
              <tr><td className="k" />{items.map(p => (
                <td key={p.id}>
                  <div className="gs-thumb" style={{ width: '100%', height: 130, fontSize: 40, borderRadius: 12, cursor: 'pointer' }} onClick={() => onOpen(p)}>{p.gallery?.[0] ? <img src={p.gallery[0]} alt="" /> : catIcon(p.category)}</div>
                  <div style={{ fontWeight: 700, margin: '8px 0 4px', cursor: 'pointer' }} onClick={() => onOpen(p)}>{p.name}{p.size ? ` · ${p.size}` : ''}</div>
                  <button className="gs-link" style={{ color: '#b91c1c' }} onClick={() => onRemove(p.id)}>Remove</button>
                </td>
              ))}</tr>
              <Row label="Price" render={p => <><b style={{ fontSize: 17 }}>₹{n(p.price)}</b>{Number(p.price) === minPrice && items.length > 1 && <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 800, color: 'var(--green)' }}>LOWEST</span>}</>} />
              <Row label="M.R.P." render={p => strikeOf(p) > p.price ? <><s>₹{n(strikeOf(p))}</s> <span style={{ color: '#c2410c', fontWeight: 700 }}>−{discountPct(p)}%</span></> : '—'} />
              <Row label="Rating" render={p => { const r = rate(p); return r ? <><Stars r={r.avg} /> <span style={{ fontSize: 12 }}>{r.avg} ({r.c})</span></> : <span style={{ color: 'var(--faint)' }}>No ratings</span> }} />
              <Row label="Brand" render={p => p.brand || '—'} />
              <Row label="Sizes in stock" render={p => (groupOf.get(p.id)?.variants || [p]).filter(v => v.in_stock).map(v => v.size).filter(Boolean).join(', ') || (p.in_stock ? 'One size' : 'None')} />
              <Row label="Availability" render={p => p.in_stock ? (p.stock <= LOW_STOCK_AT ? <span className="gs-urg">Only {p.stock} left</span> : <span className="gs-instock">In stock</span>) : <span className="gs-urg">Sold out</span>} />
              {specKeys.map(k => <Row key={k} label={k} render={p => (p.specs || []).find(s => s.k === k)?.v || '—'} />)}
              <Row label="Highlights" render={p => p.bullets?.length ? <ul className="gs-bul" style={{ margin: 0 }}>{p.bullets.slice(0, 4).map((b, i) => <li key={i}>{b}</li>)}</ul> : '—'} />
              <Row label="" render={p => p.in_stock ? (cart[p.id] ? <span className="gs-instock">✓ {cart[p.id]} in bag</span> : <button className="gs-add" style={{ background: 'var(--gold)', color: '#132a4f' }} onClick={() => setQty(p, 1, true)}>+ Add to bag</button>) : null} />
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

function PriceRange({ onApply }) {
  const [lo, setLo] = useState(''), [hi, setHi] = useState('')
  const apply = () => { if (lo === '' && hi === '') return; onApply([Number(lo) || 0, hi === '' ? Infinity : Number(hi)]) }
  return (
    <div className="gs-prange">
      <input value={lo} onChange={e => setLo(e.target.value.replace(/\D/g, ''))} placeholder="₹ Min" inputMode="numeric" aria-label="Minimum price" />
      <input value={hi} onChange={e => setHi(e.target.value.replace(/\D/g, ''))} placeholder="₹ Max" inputMode="numeric" aria-label="Maximum price" onKeyDown={e => e.key === 'Enter' && apply()} />
      <button onClick={apply}>Go</button>
    </div>
  )
}

function FilterSheet({ children, count, onClose, onClear }) {
  useOverlay(onClose)
  return (
    <>
      <div className="gs-ov" onClick={onClose} />
      <aside className="gs-drawer" role="dialog" aria-label="Filters">
        <div className="gs-grab" />
        <div className="gs-dhead"><h3>Filters</h3><button className="gs-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="gs-dbody">{children}</div>
        <div className="gs-dfoot" style={{ display: 'flex', gap: 8 }}>
          <button className="gs-ghost" style={{ height: 50, whiteSpace: 'nowrap' }} onClick={onClear}>Clear all</button>
          <button className="gs-cta" onClick={onClose}>Show {count} result{count === 1 ? '' : 's'}</button>
        </div>
      </aside>
    </>
  )
}

// ── Result cards ────────────────────────────────────────────────────────────
function BuyControl({ g, p, qty, setQty, compact }) {
  if (!p.in_stock) return <span className="gs-oos">{g.variants.length > 1 ? 'Size sold out' : 'Currently unavailable'}</span>
  if (qty === 0) return <button className="gs-add" style={compact ? {} : { width: '100%', justifyContent: 'center', background: 'var(--gold)', color: '#132a4f' }} onClick={() => setQty(p, 1, true)}><span style={{ fontSize: 16, lineHeight: 1 }}>+</span><span className="t">Add to bag</span></button>
  return <div className="gs-stepper" style={compact ? {} : { justifyContent: 'space-between', width: '100%' }}><button onClick={() => setQty(p, qty - 1)} aria-label="Decrease">−</button><span>{qty} in bag</span><button onClick={() => setQty(p, qty + 1)} aria-label="Increase">+</button></div>
}

function Sizes({ g, p, onSize }) {
  if (g.variants.length < 2) return null
  return <div className="gs-sizes">{g.variants.map(v => <button key={v.id} className={`gs-size${v.id === p.id ? ' on' : ''}${v.in_stock ? '' : ' na'}`} onClick={() => onSize(v)} title={v.in_stock ? `${v.stock} in stock` : 'Out of stock'}>{v.size || '—'}</button>)}</div>
}

function GridCard({ g, p, idx, rate, qty, wished, onWish, onOpen, onSize, setQty, drop, comparing, onCompare }) {
  const strike = strikeOf(p), off = discountPct(p), low = p.in_stock && p.stock <= LOW_STOCK_AT, anyIn = g.variants.some(v => v.in_stock)
  return (
    <article className={`gs-card${anyIn ? '' : ' out'}`} style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}>
      {p.on_sale ? <span className="gs-tag sale">DEAL{off ? ` −${off}%` : ''}</span> : low ? <span className="gs-tag low">Only {p.stock} left</span> : null}
      <button className={`gs-heart${wished ? ' on' : ''}`} onClick={onWish} aria-label="Save for later">{wished ? '♥' : '♡'}</button>
      <div className="gs-media" onClick={onOpen}>{p.gallery?.[0] ? <img src={p.gallery[0]} alt={p.name} loading="lazy" /> : <span>{catIcon(p.category)}</span>}</div>
      <div className="gs-body">
        <div className="gs-name" onClick={onOpen}>{p.name}</div>
        {p.brand && <div style={{ fontSize: 11.5, color: 'var(--mute)', marginTop: -3 }}>by {p.brand}</div>}
        {rate && <Stars r={rate.avg_rating} count={rate.review_count} />}
        <Sizes g={g} p={p} onSize={onSize} />
        <div className="gs-foot" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
          <div className="gs-pbig">{off > 0 && <span className="off" style={{ fontSize: 14 }}>−{off}%</span>}<Price v={p.price} /></div>
          {strike > p.price && <div className="gs-mrpline">M.R.P.: <s>₹{n(strike)}</s></div>}
          {drop > 0 && <div className="gs-drop">📉 ₹{n(drop)} cheaper since you saved it</div>}
          <div className="gs-pick" style={{ fontSize: 11.5 }}><b>FREE</b> pickup at campus</div>
          {onCompare && <label className="gs-cmpchk"><input type="checkbox" checked={!!comparing} onChange={onCompare} /> Compare</label>}
          <BuyControl g={g} p={p} qty={qty} setQty={setQty} />
        </div>
      </div>
    </article>
  )
}

function ListRow({ g, p, idx, rate, qty, wished, onWish, onOpen, onSize, setQty, drop, comparing, onCompare }) {
  const strike = strikeOf(p), off = discountPct(p), low = p.in_stock && p.stock <= LOW_STOCK_AT
  return (
    <article className="gs-lrow" style={{ animationDelay: `${Math.min(idx, 12) * 25}ms` }}>
      <div style={{ position: 'relative' }}>
        <button className={`gs-heart${wished ? ' on' : ''}`} onClick={onWish} aria-label="Save for later">{wished ? '♥' : '♡'}</button>
        <div className="gs-media" onClick={onOpen}>{p.gallery?.[0] ? <img src={p.gallery[0]} alt={p.name} loading="lazy" /> : <span>{catIcon(p.category)}</span>}</div>
        {p.gallery?.length > 1 && <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(14,27,51,.75)', color: '#fff', fontSize: 10.5, fontWeight: 700, borderRadius: 6, padding: '2px 7px' }}>📷 {p.gallery.length}</div>}
      </div>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {p.on_sale && <span><span className="gs-deal">Limited time deal</span></span>}
        <h3 className="gs-ltitle" onClick={onOpen}>{p.name}</h3>
        {p.brand && <div style={{ fontSize: 12.5, color: 'var(--mute)' }}>Brand: <b style={{ color: 'var(--navy2)' }}>{p.brand}</b></div>}
        {rate && <div><Stars r={rate.avg_rating} /> <span style={{ fontSize: 12.5, color: 'var(--navy2)', fontWeight: 600 }}>{rate.avg_rating} · {rate.review_count} rating{rate.review_count > 1 ? 's' : ''}</span></div>}
        <Sizes g={g} p={p} onSize={onSize} />
        {p.bullets?.length > 0 ? <ul className="gs-bul">{p.bullets.slice(0, 3).map((b, i) => <li key={i}>{b}</li>)}</ul>
          : p.description ? <div className="gs-desc" style={{ marginTop: 4 }}>{p.description}</div> : null}
      </div>
      <div className="gs-lbuy">
        <div className="gs-pbig">{off > 0 && <span className="off">−{off}%</span>}<Price v={p.price} /></div>
        {strike > p.price && <div className="gs-mrp">M.R.P.: <s>₹{n(strike)}</s></div>}
        {drop > 0 && <div className="gs-drop">📉 ₹{n(drop)} cheaper since you saved it</div>}
        <div className="gs-pick"><b>FREE pickup</b> at campus counter</div>
        {p.in_stock ? (low ? <div className="gs-urg">Only {p.stock} left — order soon</div> : <div className="gs-instock">In stock</div>) : null}
        <div style={{ marginTop: 4 }}><BuyControl g={g} p={p} qty={qty} setQty={setQty} /></div>
        {onCompare && <label className="gs-cmpchk"><input type="checkbox" checked={!!comparing} onChange={onCompare} /> Compare</label>}
      </div>
    </article>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Checkout — bag → details → review, in one drawer
// ═══════════════════════════════════════════════════════════════════════════
function Checkout({ lines, count, subtotal, promoOff, total, savings, setQty, form, setForm, remembered, onForget, promoCode, setPromoCode, promoResult, setPromoResult, onClose, onPlaced }) {
  const [step, setStep] = useState(0) // 0 bag, 1 details, 2 review
  const [slot, setSlot] = useState('') // '' = any time
  const days = useMemo(() => {
    const out = []; const d = new Date()
    for (let i = 0; out.length < PICKUP.daysAhead && i < 21; i++) {
      const x = new Date(d); x.setDate(d.getDate() + i)
      if (PICKUP.closedDays.includes(x.getDay())) continue
      out.push({ key: x.toLocaleDateString('en-CA'), label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : x.toLocaleDateString('en-IN', { weekday: 'short' }), sub: x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), full: x.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) })
    }
    return out
  }, [])
  const [day, setDay] = useState(null)
  const slotText = day && slot ? `${days.find(d => d.key === day)?.full} · ${slot} (${PICKUP.slots.find(s => s[0] === slot)?.[1]})` : ''
  const [err, setErr] = useState('')
  const [checking, setChecking] = useState(false)
  const [placing, setPlacing] = useState(false)
  useOverlay(() => !placing && onClose())
  const labels = ['Bag', 'Details', 'Review']

  const checkPromo = async () => {
    const code = promoCode.trim()
    if (!code) { setPromoResult(null); return }
    setChecking(true)
    const { data, error } = await supabase.rpc('store_validate_promo', { p_code: code, p_subtotal: subtotal })
    setChecking(false)
    if (error) { setPromoResult({ valid: false }); setErr(error.message); return }
    setPromoResult(data); setErr(data?.valid ? '' : data?.reason || 'This code is not valid.')
  }

  const next = () => {
    setErr('')
    if (step === 1) {
      if (!form.name.trim()) { setErr('Please enter the parent or student name.'); return }
      if (form.phone.replace(/\D/g, '').length < 10) { setErr('Please enter a valid 10-digit mobile number — we use it to tell you when your order is ready.'); return }
    }
    setStep(s => s + 1)
  }

  const place = async () => {
    setErr(''); setPlacing(true)
    const { data, error } = await supabase.rpc('store_place_order', { p: {
      name: form.name, phone: form.phone, gcc_no: form.gcc_no, note: [slotText && `Pickup: ${slotText}`, form.note.trim()].filter(Boolean).join(' | '),
      promo_code: promoResult?.valid ? promoCode.trim() : '',
      items: lines.map(l => ({ product_id: l.p.id, qty: l.qty })),
    } })
    setPlacing(false)
    if (error) { setErr(error.message); return }
    onPlaced({
      pickup: slotText,
      order_no: data.order_no, total: data.total ?? total, note: form.note, created_at: new Date().toISOString(),
      items: lines.map(l => ({ product_id: l.p.id, name: l.p.name, size: l.p.size, qty: l.qty, price: l.p.price })), subtotal, promoOff,
    })
  }

  const Summary = () => (
    <>
      <div className="gs-sum"><span>Subtotal · {count} item{count === 1 ? '' : 's'}</span><span>₹{n(subtotal)}</span></div>
      {promoOff > 0 && <div className="gs-sum" style={{ color: 'var(--green)' }}><span>Promo {promoResult?.code}</span><span>− ₹{n(promoOff)}</span></div>}
      <div className="gs-sum"><span>Pickup at campus</span><span style={{ color: 'var(--green)', fontWeight: 700 }}>Free</span></div>
      <div className="gs-total"><span>Pay at pickup</span><b>₹{n(total)}</b></div>
      {savings > 0 && <div style={{ textAlign: 'right', fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>You save ₹{n(savings)}</div>}
    </>
  )

  return (
    <>
      <div className="gs-ov" onClick={() => !placing && onClose()} />
      <aside className="gs-drawer" role="dialog" aria-label="Checkout">
        <div className="gs-grab" />
        <div className="gs-dhead">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step > 0 && <button className="gs-x" onClick={() => { setErr(''); setStep(s => s - 1) }} aria-label="Back">←</button>}
            <h3>{['Your bag', 'Pickup details', 'Review & place'][step]}</h3>
          </div>
          <button className="gs-x" onClick={() => !placing && onClose()} aria-label="Close">×</button>
        </div>
        {lines.length > 0 && <>
          <div className="gs-progress">{labels.map((l, i) => <div key={l} className={i <= step ? 'on' : ''} />)}</div>
          <div className="gs-plabel">{labels.map((l, i) => <span key={l} className={i <= step ? 'on' : ''}>{l}</span>)}</div>
        </>}

        <div className="gs-dbody">
          {lines.length === 0 ? (
            <div className="gs-empty" style={{ padding: '48px 8px' }}><div className="i">🛍️</div><b>Your bag is empty</b>Add items from the store and they will appear here.</div>
          ) : step === 0 ? (
            <>
              {lines.map(l => (
                <div key={l.p.id} className="gs-line">
                  <div className="gs-thumb">{l.p.image_url ? <img src={l.p.image_url} alt="" /> : catIcon(l.p.category)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{l.p.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--mute)' }}>{l.p.size ? `Size ${l.p.size} · ` : ''}₹{n(l.p.price)} each</div>
                    <div className="gs-stepper" style={{ height: 32, marginTop: 6 }}>
                      <button style={{ height: 30 }} onClick={() => setQty(l.p, l.qty - 1)} aria-label="Decrease">{l.qty === 1 ? '🗑' : '−'}</button><span>{l.qty}</span><button style={{ height: 30 }} onClick={() => setQty(l.p, l.qty + 1)} aria-label="Increase">+</button>
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>₹{n(l.p.price * l.qty)}</div>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <label className="gs-label">Promo code</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input className="gs-input" value={promoCode} onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null) }} onKeyDown={e => e.key === 'Enter' && checkPromo()} placeholder="Have a code?" style={{ height: 44 }} />
                  <button className="gs-ghost" onClick={checkPromo} disabled={checking || !promoCode.trim()}>{checking ? '…' : 'Apply'}</button>
                </div>
                {promoResult?.valid && <div className="gs-ok" style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}><span>✓ {promoResult.code} applied — ₹{n(promoResult.amount_off)} off</span><button className="gs-link" style={{ color: '#b91c1c' }} onClick={() => { setPromoCode(''); setPromoResult(null) }}>Remove</button></div>}
              </div>
            </>
          ) : step === 1 ? (
            <>
              {remembered && <div className="gs-ok" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>Welcome back{form.name ? `, ${form.name.split(' ')[0]}` : ''} — we filled in your details.</span><button className="gs-link" style={{ color: '#b91c1c' }} onClick={onForget}>Not you?</button></div>}
              <div className="gs-field"><label className="gs-label">Parent / student name *</label><input className="gs-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoComplete="name" autoFocus /></div>
              <div className="gs-field"><label className="gs-label">Mobile number *</label><input className="gs-input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} inputMode="tel" autoComplete="tel" placeholder="10-digit mobile" /></div>
              <div className="gs-field"><label className="gs-label">Student GCC No. <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(if enrolled)</span></label><input className="gs-input" value={form.gcc_no} onChange={e => setForm(f => ({ ...f, gcc_no: e.target.value }))} /></div>
              <div className="gs-field">
                <label className="gs-label">Preferred pickup <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>(optional)</span></label>
                <div className="gs-days">
                  {days.map(d => <button key={d.key} type="button" className={day === d.key ? 'on' : ''} onClick={() => { setDay(day === d.key ? null : d.key); if (!slot) setSlot(PICKUP.slots[0][0]) }}><b>{d.label}</b><span>{d.sub}</span></button>)}
                </div>
                {day && <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>{PICKUP.slots.map(([sName, sTime]) => <button key={sName} type="button" className={`gs-chip${slot === sName ? ' on' : ''}`} style={{ flex: 1, height: 'auto', padding: '7px 10px', flexDirection: 'column', gap: 1, borderRadius: 12 }} onClick={() => setSlot(sName)}><b>{sName}</b><span style={{ fontSize: 11, fontWeight: 500, opacity: .8 }}>{sTime}</span></button>)}</div>}
                {!day && <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 6 }}>Any time the counter is open — or pick a day so we have it ready.</div>}
              </div>
              <div className="gs-field"><label className="gs-label">Note for the store</label><textarea className="gs-input" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Anything we should know — size advice, pickup day…" /></div>
              <div className="gs-note"><span>🔒</span><span>Your details are used only for this order and saved on this device to make your next order faster.</span></div>
            </>
          ) : (
            <>
              <div className="gs-note" style={{ marginBottom: 14 }}><span>🏫</span><span><b>Pickup:</b> {COUNTER.place}<br />{slotText ? <b>{slotText}</b> : COUNTER.hours}. We'll let you know on <b>{form.phone}</b> when it's packed.</span></div>
              {lines.map(l => (
                <div key={l.p.id} className="gs-sum" style={{ padding: '7px 0', borderBottom: '1px solid var(--line2)' }}>
                  <span style={{ color: 'var(--ink)' }}>{l.p.name}{l.p.size ? ` · ${l.p.size}` : ''} <span style={{ color: 'var(--faint)' }}>× {l.qty}</span></span><span>₹{n(l.p.price * l.qty)}</span>
                </div>
              ))}
              <div style={{ fontSize: 13, color: 'var(--mute)', margin: '12px 0 4px' }}>For <b style={{ color: 'var(--ink)' }}>{form.name}</b> · {form.phone}{form.gcc_no ? ` · GCC ${form.gcc_no}` : ''}</div>
              {form.note && <div style={{ fontSize: 12.5, color: 'var(--mute)' }}>Note: {form.note}</div>}
            </>
          )}
          {err && <div className="gs-err">{err}</div>}
        </div>

        {lines.length > 0 && (
          <div className="gs-dfoot">
            <Summary />
            <div style={{ marginTop: 12 }}>
              {step < 2
                ? <button className="gs-cta" onClick={next}>{step === 0 ? 'Continue to details' : 'Review order'} →</button>
                : <button className="gs-cta gold" onClick={place} disabled={placing}>{placing ? 'Placing your order…' : `Place order · Pay ₹${n(total)} at pickup`}</button>}
            </div>
            <div style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>No online payment needed · Cash, UPI &amp; card at the counter</div>
          </div>
        )}
      </aside>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Pickup pass — show at the counter; QR = order number for a quick scan
// ═══════════════════════════════════════════════════════════════════════════
function PickupPass({ order, onClose, onTrack }) {
  useOverlay(onClose)
  const qr = useQR(order.order_no)
  const upiQr = useQR(UPI_ID ? upiLink(order.total, order.order_no) : '')
  const [copied, setCopied] = useState(false)
  const step = STEPS.indexOf(order.status || 'new')
  const st = STATUS[order.status || 'new'] || STATUS.new
  const items = order.items || []
  const payable = order.status !== 'delivered' && order.status !== 'cancelled'
  const pickup = order.pickup || (String(order.note || '').match(/Pickup:\s*([^|\n]+)/) || [])[1]?.trim()
  const summary = `GNSI Store — pickup pass ${order.order_no}\n${items.map(i => `• ${i.name}${i.size ? ' (' + i.size + ')' : ''} × ${i.qty}`).join('\n')}\nPay at pickup: ₹${n(order.total)}\n${COUNTER.place} · ${COUNTER.hours}`

  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: `GNSI order ${order.order_no}`, text: summary }); return } catch { return } }
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, '_blank', 'noopener')
  }
  const copy = async () => { try { await navigator.clipboard.writeText(order.order_no); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {} }

  const print = () => {
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>${esc(order.order_no)}</title>
<script src="${QR_LIB}"></script><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#0e1b33;padding:24px;background:#f7f5f0}
.p{max-width:420px;margin:0 auto;background:#fff;border:1px solid #e7e3da;border-radius:18px;overflow:hidden}
.t{background:#132a4f;color:#fff;padding:18px 20px}.m{font-size:10px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;font-weight:700}
.c{font-family:Georgia,serif;font-size:30px;font-weight:700;color:#e9d9b0;margin-top:4px}.b{padding:18px 20px;display:flex;gap:16px;align-items:center}
#qr{width:120px;height:120px}#qr svg{width:100%;height:100%}table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:4px}td{padding:5px 0;border-bottom:1px solid #f0ece4}.r{text-align:right}
.tot{display:flex;justify-content:space-between;font-weight:800;font-size:16px;padding:12px 20px;background:#fbf6ea}.f{padding:12px 20px;font-size:11px;color:#64748b;line-height:1.6}
.np{text-align:center;margin-bottom:14px}button{padding:9px 20px;background:#132a4f;color:#fff;border:none;border-radius:8px;font-weight:700;cursor:pointer}@media print{.np{display:none}body{background:#fff;padding:0}}</style></head>
<body><div class="np"><button onclick="window.print()">Print / Save as PDF</button></div><div class="p">
<div class="t"><div class="m">GNSI Store · Pickup pass</div><div class="c">${esc(order.order_no)}</div><div style="font-size:12.5px;opacity:.8;margin-top:4px">${esc(order.name || '')}${order.phone ? ' · ' + esc(order.phone) : ''}</div></div>
<div class="b"><div id="qr"></div><div style="font-size:12px;color:#334155;line-height:1.55">Show this pass at the<br/><b>${esc(COUNTER.place)}</b><br/>${esc(COUNTER.hours)}</div></div>
<div style="padding:0 20px 8px"><table>${items.map(i => `<tr><td>${esc(i.name)}${i.size ? ' · ' + esc(i.size) : ''} × ${i.qty}</td><td class="r">${i.price != null ? '₹' + n(i.price * i.qty) : ''}</td></tr>`).join('')}</table></div>
<div class="tot"><span>Pay at pickup</span><span>₹${n(order.total)}</span></div>
<div class="f">Cash, UPI and card accepted. Placed ${esc(new Date(order.created_at || Date.now()).toLocaleString('en-IN'))}. Guidance Navodaya &amp; Sainik Institute, Khangabok, Thoubal, Manipur.</div></div>
<script>window.addEventListener('load',function(){try{var q=qrcode(0,'M');q.addData(${JSON.stringify(order.order_no)});q.make();document.getElementById('qr').innerHTML=q.createSvgTag({cellSize:4,margin:0,scalable:true})}catch(e){}})</script></body></html>`
    const win = window.open('', '_blank', 'width=520,height=760,scrollbars=yes')
    if (!win) { alert('Please allow pop-ups to save your pickup pass.'); return }
    win.document.write(html); win.document.close()
  }

  return (
    <>
      <div className="gs-ov" onClick={onClose} />
      <div className="gs-dialog sm" role="dialog" aria-label="Pickup pass">
        <div className="gs-grab" />
        <div style={{ padding: '18px 20px 6px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div>
            {order.fresh && <div style={{ color: 'var(--green)', fontWeight: 800, fontSize: 13, marginBottom: 2 }}>✓ Order placed — thank you{order.name ? `, ${order.name.split(' ')[0]}` : ''}!</div>}
            <div className="gs-serif" style={{ fontSize: 22, fontWeight: 700 }}>Your pickup pass</div>
          </div>
          <button className="gs-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div style={{ padding: '10px 20px 20px' }}>
          <div className="gs-pass">
            <div className="gs-pass-top">
              <div className="gs-mini">Order number</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <div className="gs-code">{order.order_no}</div>
                <button onClick={copy} style={{ border: '1px solid rgba(255,255,255,.2)', background: 'rgba(255,255,255,.08)', color: '#fff', borderRadius: 8, fontSize: 11, fontWeight: 700, padding: '4px 9px' }}>{copied ? 'Copied' : 'Copy'}</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5 }}>
                <span style={{ fontWeight: 700, color: st.tone === '#b7791f' ? 'var(--gold2)' : '#fff' }}>● {st.label}</span>
                <span style={{ color: 'rgba(255,255,255,.65)' }}>{new Date(order.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
              </div>
              {step >= 0 && <div className="gs-track">{STEPS.map((s, i) => <div key={s} style={{ background: i <= step ? 'var(--gold)' : undefined }} />)}</div>}
            </div>
            <div className="gs-pass-cut" />
            <div className="gs-pass-bot">
              <div className="gs-qr">{qr ? <span dangerouslySetInnerHTML={{ __html: qr }} style={{ width: '100%', height: '100%' }} /> : <b style={{ fontSize: 15 }}>{order.order_no}</b>}</div>
              <div style={{ minWidth: 0 }}>
                <div className="gs-mini">{payable ? 'Pay at pickup' : 'Order total'}</div>
                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-.02em', margin: '2px 0 6px' }}>₹{n(order.total)}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,.72)', lineHeight: 1.5 }}>Show this at the counter.<br />{pickup ? <b style={{ color: 'var(--gold2)' }}>🕒 {pickup}</b> : COUNTER.hours}</div>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {items.map((i, k) => (
                <div key={k} className="gs-sum" style={{ borderBottom: '1px solid var(--line2)', padding: '7px 0' }}>
                  <span style={{ color: 'var(--ink)' }}>{i.name}{i.size ? ` · ${i.size}` : ''} <span style={{ color: 'var(--faint)' }}>× {i.qty}</span></span>
                  {i.price != null && <span>₹{n(i.price * i.qty)}</span>}
                </div>
              ))}
            </div>
          )}

          {UPI_ID && payable && (
            <div className="gs-note" style={{ marginTop: 14, alignItems: 'center' }}>
              {upiQr && <div className="gs-qr gs-hide-m" style={{ width: 92, height: 92, padding: 6, border: '1px solid var(--gold2)' }} dangerouslySetInnerHTML={{ __html: upiQr }} />}
              <div style={{ flex: 1 }}>
                <b>Skip the queue — pay ahead by UPI</b><br />
                Pay ₹{n(order.total)} to <b>{UPI_ID}</b> and show the payment screen with this pass.
                <div style={{ marginTop: 8 }}><a href={upiLink(order.total, order.order_no)} className="gs-ghost" style={{ height: 38, textDecoration: 'none', color: 'var(--navy)' }}>Pay with UPI app</a></div>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
            <button className="gs-ghost" onClick={print}>⬇ Save pass</button>
            <button className="gs-ghost" onClick={share}>📤 Share</button>
          </div>
          <button className="gs-cta" style={{ marginTop: 8, height: 48 }} onClick={order.fresh ? onClose : onTrack}>{order.fresh ? 'Continue shopping' : '← Back to my orders'}</button>
        </div>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Product page — gallery, buy box, about this item, specs, reviews, related
// ═══════════════════════════════════════════════════════════════════════════
function ProductPage({ product, variants, related, ratings, inCart, wished, onWish, onBack, onCategory, onAdd, onBuy, onOpenVariant, onOpenRelated, refreshRatings, wishlist, toggleWishlist, cart, setQty, drop, customer, comparing, onCompare, recent = [] }) {
  const [img, setImg] = useState(0)
  const [zoom, setZoom] = useState(null) // transform-origin while hovering
  const [slide, setSlide] = useState(0)
  const [qty, setQtyPick] = useState(1)
  const [reviews, setReviews] = useState([])
  const [loadingReviews, setLoadingReviews] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rf, setRf] = useState({ customer_name: '', phone: '', gcc_no: '', rating: 5, comment: '' })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const [copied, setCopied] = useState(false)
  const reviewsRef = useRef(null)
  const gallery = product.gallery?.length ? product.gallery : []
  const ids = variants.map(v => v.id)
  const strike = strikeOf(product), off = discountPct(product), max = Math.max(1, Math.min(product.stock, 10))
  const low = product.in_stock && product.stock <= LOW_STOCK_AT

  useEffect(() => { setImg(0); setSlide(0); setQtyPick(1) }, [product.id])
  const loadReviews = () => supabase.from('store_reviews').select('*').in('product_id', ids).eq('approved', true)
    .order('created_at', { ascending: false }).then(({ data }) => { setReviews(data || []); setLoadingReviews(false) })
  useEffect(() => { setLoadingReviews(true); loadReviews() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.join(',')])

  const rate = (() => {
    if (reviews.length) return { avg: Math.round(reviews.reduce((a, r) => a + Number(r.rating), 0) / reviews.length * 10) / 10, count: reviews.length }
    let c = 0, s = 0; variants.forEach(v => { const r = ratings[v.id]; if (r) { c += Number(r.review_count); s += Number(r.avg_rating) * Number(r.review_count) } })
    return c ? { avg: Math.round(s / c * 10) / 10, count: c } : null
  })()
  const hist = [5, 4, 3, 2, 1].map(s => ({ s, c: reviews.filter(r => Math.round(r.rating) === s).length }))

  const submitReview = async () => {
    setErr(''); setOk(false)
    if (!rf.customer_name.trim()) { setErr('Please enter your name.'); return }
    if (!rf.phone.trim() && !rf.gcc_no.trim()) { setErr('Enter the phone number or GCC No. used on your order.'); return }
    setSubmitting(true)
    const { error } = await supabase.rpc('store_submit_review', { p: { product_id: product.id, rating: rf.rating, customer_name: rf.customer_name, phone: rf.phone, gcc_no: rf.gcc_no, comment: rf.comment } })
    setSubmitting(false)
    if (error) { setErr(error.message); return }
    setOk(true); setShowForm(false); setRf({ customer_name: '', phone: '', gcc_no: '', rating: 5, comment: '' })
    loadReviews(); refreshRatings()
  }

  const share = async () => {
    const url = `${window.location.origin}${window.location.pathname}?p=${product.id}`
    const text = `${product.name}${product.size ? ' (' + product.size + ')' : ''} — ₹${n(product.price)} at GNSI Store`
    if (navigator.share) { try { await navigator.share({ title: product.name, text, url }); return } catch { return } }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank', 'noopener') }
  }

  const specs = [
    ...(product.brand ? [{ k: 'Brand', v: product.brand }] : []),
    ...(product.category ? [{ k: 'Category', v: product.category }] : []),
    ...(variants.length > 1 ? [{ k: 'Sizes available', v: variants.filter(v => v.in_stock).map(v => v.size).join(', ') || 'Currently none' }] : product.size ? [{ k: 'Size', v: product.size }] : []),
    ...(product.specs || []),
  ]
  const about = product.bullets?.length ? product.bullets
    : ((product.description || '').match(/[^.!?]+[.!?]*/g) || []).map(s => s.trim()).filter(s => s.length > 12).slice(0, 4)

  const picture = (src, big) => src ? <img src={src} alt={product.name} /> : <span style={{ fontSize: big ? 96 : 22 }}>{catIcon(product.category)}</span>

  return (
    <div style={{ paddingBottom: 10 }}>
      <nav className="gs-crumb" aria-label="Breadcrumb">
        <button onClick={onBack}>← Back to results</button><span>·</span>
        <button onClick={() => onCategory('All')}>Store</button>
        {product.category && <><span>›</span><button onClick={() => onCategory(product.category)}>{product.category}</button></>}
        <span>›</span><span style={{ color: 'var(--ink2)' }}>{product.name}</span>
      </nav>

      <div className="gs-pp">
        {/* gallery */}
        <div>
          <div className="gs-gal">
            <div className="gs-gthumbs">
              {(gallery.length ? gallery : [null]).map((src, i) => (
                <button key={i} className={i === img ? 'on' : ''} onMouseEnter={() => setImg(i)} onClick={() => setImg(i)} aria-label={`Photo ${i + 1}`}>{picture(src)}</button>
              ))}
            </div>
            <div className={`gs-gmain d${zoom ? ' zoom' : ''}`}
              onMouseMove={e => { if (!gallery[img]) return; const r = e.currentTarget.getBoundingClientRect(); setZoom(`${(e.clientX - r.left) / r.width * 100}% ${(e.clientY - r.top) / r.height * 100}%`) }}
              onMouseLeave={() => setZoom(null)}>
              {gallery[img] ? <img src={gallery[img]} alt={product.name} style={zoom ? { transformOrigin: zoom } : undefined} /> : picture(null, true)}
              {product.on_sale && <span className="gs-tag sale" style={{ top: 14, left: 14 }}>DEAL{off ? ` −${off}%` : ''}</span>}
            </div>
            <div className="gs-gslide" onScroll={e => { const el = e.currentTarget; setSlide(Math.round(el.scrollLeft / el.clientWidth)) }}>
              {(gallery.length ? gallery : [null]).map((src, i) => <div key={i}>{picture(src, true)}</div>)}
            </div>
          </div>
          {gallery.length > 1 && <div className="gs-dots">{gallery.map((_, i) => <i key={i} className={i === slide ? 'on' : ''} />)}</div>}
        </div>

        {/* info */}
        <div>
          <h1 className="gs-ptitle">{product.name}</h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 6, fontSize: 13 }}>
            {product.brand && <span style={{ color: 'var(--navy2)', fontWeight: 700 }}>Brand: {product.brand}</span>}
            {rate ? <button className="gs-link" style={{ fontSize: 13 }} onClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth' })}><span style={{ color: 'var(--ink)' }}>{rate.avg}</span> <Stars r={rate.avg} /> {rate.count} rating{rate.count > 1 ? 's' : ''}</button> : <span style={{ color: 'var(--faint)' }}>No ratings yet</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button className="gs-x" onClick={onWish} aria-label="Save for later" style={{ color: wished ? '#e11d48' : undefined }}>{wished ? '♥' : '♡'}</button>
              <button className="gs-x" onClick={share} aria-label="Share" style={{ fontSize: 15 }}>{copied ? '✓' : '↗'}</button>
            </span>
          </div>
          {copied && <div className="gs-ok" style={{ marginTop: 6 }}>Link copied — paste it in WhatsApp or SMS.</div>}
          <hr className="gs-hr" />
          {product.on_sale && <span className="gs-deal">Limited time deal</span>}
          <div className="gs-pbig" style={{ marginTop: 6 }}>{off > 0 && <span className="off" style={{ fontSize: 24, fontWeight: 300 }}>−{off}%</span>}<b style={{ fontSize: 32 }}><sup>₹</sup>{n(product.price)}</b></div>
          {strike > product.price && <div className="gs-mrp">M.R.P.: <s>₹{n(strike)}</s></div>}
          {drop > 0 && <div className="gs-drop" style={{ marginTop: 6 }}>📉 Price dropped ₹{n(drop)} since you saved it</div>}
          <div style={{ fontSize: 12.5, color: 'var(--mute)', marginTop: 4 }}>No online payment · Pay at the counter when you collect</div>

          {variants.length > 1 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13.5, marginBottom: 7 }}>Size: <b>{product.size || '—'}</b></div>
              <div className="gs-sizes">{variants.map(v => <button key={v.id} className={`gs-size big${v.id === product.id ? ' on' : ''}${v.in_stock ? '' : ' na'}`} onClick={() => onOpenVariant(v)}>{v.size || '—'}</button>)}</div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, margin: '16px 0 4px' }}>
            {[['🏫', 'Campus pickup'], ['💳', 'Pay at counter'], ['🧾', 'Bill with every order']].map(([i, t]) => (
              <div key={t} style={{ textAlign: 'center', background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 4px', fontSize: 11.5, fontWeight: 700, color: 'var(--ink2)' }}><div style={{ fontSize: 18 }}>{i}</div>{t}</div>
            ))}
          </div>

          {about.length > 0 && (
            <>
              <hr className="gs-hr" />
              <h4 style={{ margin: '0 0 6px', fontSize: 16 }}>About this item</h4>
              <ul className="gs-bul" style={{ fontSize: 14, marginTop: 0 }}>{about.map((b, i) => <li key={i}>{b}</li>)}</ul>
            </>
          )}
        </div>

        {/* buy box */}
        <aside className="gs-buybox">
          <div className="gs-pbig"><b style={{ fontSize: 28 }}><sup>₹</sup>{n(product.price)}</b></div>
          <div className="gs-pick"><b>FREE pickup</b> at {COUNTER.place}</div>
          <div style={{ fontSize: 12, color: 'var(--mute)' }}>{COUNTER.hours}</div>
          {product.in_stock
            ? (low ? <div className="gs-urg">Only {product.stock} left in stock — order soon.</div> : <div className="gs-instock" style={{ fontSize: 16 }}>In stock</div>)
            : <><div className="gs-urg" style={{ fontSize: 15 }}>Currently unavailable{variants.some(v => v.in_stock) ? ' in this size' : ''}</div><NotifyMe key={product.id} product={product} customer={customer} /></>}
          {product.in_stock && (
            <>
              <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>Quantity:
                <select className="gs-qty" value={qty} onChange={e => setQtyPick(Number(e.target.value))}>{Array.from({ length: max }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select>
              </label>
              <button className="gs-cta gold" style={{ height: 46, borderRadius: 99, fontSize: 14.5 }} disabled={inCart >= Math.min(product.stock, 50)} onClick={() => onAdd(product, qty)}>{inCart ? `Add to bag · ${inCart} already in` : 'Add to bag'}</button>
              <button className="gs-cta" style={{ height: 46, borderRadius: 99, fontSize: 14.5 }} onClick={() => onBuy(product, qty)}>Order now</button>
            </>
          )}
          <table style={{ fontSize: 12.5, color: 'var(--mute)', borderCollapse: 'collapse', marginTop: 4 }}>
            <tbody>
              <tr><td style={{ padding: '3px 12px 3px 0' }}>Pay at</td><td style={{ color: 'var(--ink)' }}>Institute counter</td></tr>
              <tr><td style={{ padding: '3px 12px 3px 0' }}>Accepts</td><td style={{ color: 'var(--ink)' }}>Cash · UPI · Card</td></tr>
              <tr><td style={{ padding: '3px 12px 3px 0' }}>Sold by</td><td style={{ color: 'var(--ink)' }}>GNSI Store</td></tr>
            </tbody>
          </table>
          <hr className="gs-hr" style={{ margin: '4px 0' }} />
          <button className="gs-ghost" style={{ height: 40 }} onClick={onWish}>{wished ? '♥ Saved to wishlist' : '♡ Add to wishlist'}</button>
          <label className="gs-cmpchk" style={{ justifyContent: 'center' }}><input type="checkbox" checked={!!comparing} onChange={onCompare} /> Add to compare</label>
        </aside>
      </div>

      {(product.description || specs.length > 0) && (
        <div className="gs-sec">
          {product.description && <><h3>Product description</h3><p style={{ margin: '0 0 18px', fontSize: 14, lineHeight: 1.7, color: 'var(--ink2)', whiteSpace: 'pre-line' }}>{product.description}</p></>}
          {specs.length > 0 && <><h3>Product details</h3><table className="gs-kv"><tbody>{specs.map((s, i) => <tr key={i}><td>{s.k}</td><td>{s.v}</td></tr>)}</tbody></table></>}
        </div>
      )}

      {related.length > 0 && (
        <div className="gs-sec">
          <h3>Parents also viewed</h3>
          <div className="gs-carousel">
            {related.map((p, i) => {
              const g = { variants: [p] }
              return <GridCard key={p.id} g={g} p={p} idx={i} rate={ratings[p.id] ? { avg_rating: ratings[p.id].avg_rating, review_count: ratings[p.id].review_count } : null}
                qty={cart[p.id] || 0} wished={wishlist.has(p.id)} onWish={() => toggleWishlist(p.id)} onOpen={() => onOpenRelated(p)} onSize={() => {}} setQty={setQty} />
            })}
          </div>
        </div>
      )}

      <div className="gs-sec" ref={reviewsRef}>
        <div className="gs-revgrid">
          <div>
            <h3>Customer reviews</h3>
            {rate ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}><Stars r={rate.avg} /><b>{rate.avg} out of 5</b></div> : <div style={{ color: 'var(--faint)', fontSize: 13.5 }}>No reviews yet</div>}
            {rate && <div style={{ fontSize: 12.5, color: 'var(--mute)', margin: '4px 0 10px' }}>{rate.count} rating{rate.count > 1 ? 's' : ''}</div>}
            {reviews.length > 0 && hist.map(h => (
              <div key={h.s} className="gs-hist"><span>{h.s} star</span><div><i style={{ width: `${reviews.length ? h.c / reviews.length * 100 : 0}%` }} /></div><span style={{ textAlign: 'right' }}>{reviews.length ? Math.round(h.c / reviews.length * 100) : 0}%</span></div>
            ))}
            <hr className="gs-hr" />
            <div style={{ fontSize: 14, fontWeight: 800 }}>Review this product</div>
            <div style={{ fontSize: 12.5, color: 'var(--mute)', margin: '3px 0 10px' }}>Share your thoughts with other parents</div>
            <button className="gs-ghost" style={{ width: '100%', borderRadius: 99 }} onClick={() => setShowForm(s => !s)}>Write a product review</button>
          </div>
          <div>
            {ok && <div className="gs-ok" style={{ marginBottom: 10 }}>Thank you — your review has been posted.</div>}
            {showForm && (
              <div style={{ background: '#faf8f3', border: '1px solid var(--line2)', borderRadius: 14, padding: 14, marginBottom: 14, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', gap: 2 }}>{[1, 2, 3, 4, 5].map(v => <button key={v} onClick={() => setRf(f => ({ ...f, rating: v }))} aria-label={`${v} star${v > 1 ? 's' : ''}`} style={{ background: 'none', border: 'none', fontSize: 28, color: v <= rf.rating ? '#b7791f' : '#e0dace', padding: 0 }}>★</button>)}</div>
                <input className="gs-input" value={rf.customer_name} onChange={e => setRf(f => ({ ...f, customer_name: e.target.value }))} placeholder="Your name *" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input className="gs-input" value={rf.phone} onChange={e => setRf(f => ({ ...f, phone: e.target.value }))} placeholder="Phone used on order" inputMode="tel" />
                  <input className="gs-input" value={rf.gcc_no} onChange={e => setRf(f => ({ ...f, gcc_no: e.target.value }))} placeholder="or GCC No." />
                </div>
                <textarea className="gs-input" rows={3} value={rf.comment} onChange={e => setRf(f => ({ ...f, comment: e.target.value }))} placeholder="How was the fit, quality, finish?" />
                <div style={{ fontSize: 11.5, color: 'var(--faint)' }}>We check this against a completed purchase before posting.</div>
                {err && <div className="gs-err" style={{ marginTop: 0 }}>{err}</div>}
                <button className="gs-cta" style={{ height: 46 }} onClick={submitReview} disabled={submitting}>{submitting ? 'Submitting…' : 'Submit review'}</button>
              </div>
            )}
            {loadingReviews ? <div style={{ fontSize: 13, color: 'var(--faint)' }}>Loading reviews…</div>
              : reviews.length === 0 ? <div style={{ fontSize: 13.5, color: 'var(--mute)', paddingTop: 8 }}>No reviews yet — be the first parent to review this product.</div>
              : reviews.slice(0, 30).map(r => (
                <div key={r.id} className="gs-review">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 99, background: '#e9e3d6', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: 'var(--navy)' }}>{(r.customer_name || '?').trim()[0]?.toUpperCase()}</span>
                    <b style={{ fontSize: 13.5 }}>{r.customer_name}</b>
                  </div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 8, alignItems: 'center' }}><Stars r={r.rating} /><span style={{ fontSize: 11.5, color: 'var(--green)', fontWeight: 700 }}>Verified purchase</span></div>
                  {r.created_at && <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 2 }}>Reviewed on {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>}
                  {r.comment && <div style={{ fontSize: 14, color: 'var(--ink2)', marginTop: 6, lineHeight: 1.55 }}>{r.comment}</div>}
                </div>
              ))}
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="gs-sec">
          <h3>Your recently viewed items</h3>
          <div className="gs-carousel">
            {recent.map((p, i) => <GridCard key={p.id} g={{ variants: [p] }} p={p} idx={i} rate={ratings[p.id] ? { avg_rating: ratings[p.id].avg_rating, review_count: ratings[p.id].review_count } : null}
              qty={cart[p.id] || 0} wished={wishlist.has(p.id)} onWish={() => toggleWishlist(p.id)} onOpen={() => onOpenRelated(p)} onSize={() => {}} setQty={setQty} />)}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Back-in-stock request ───────────────────────────────────────────────────
function NotifyMe({ product, customer }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(customer?.name || '')
  const [phone, setPhone] = useState(customer?.phone || '')
  const [state, setState] = useState(null) // null | 'busy' | 'done' | error text
  const submit = async () => {
    if (phone.replace(/\D/g, '').length < 10) { setState('Please enter a valid 10-digit mobile number.'); return }
    setState('busy')
    const { error } = await supabase.rpc('store_request_stock_alert', { p_product: String(product.id), p_name: name.trim(), p_phone: phone, p_gcc: customer?.gcc_no || null })
    if (error) setState(/function|schema cache|not find/i.test(error.message) ? 'Stock alerts are not available right now — please ask at the counter.' : error.message)
    else setState('done')
  }
  if (state === 'done') return <div className="gs-ok">🔔 Done — the store will message you on {phone} when it's back.</div>
  if (!open) return <button className="gs-cta" style={{ height: 44, borderRadius: 99, fontSize: 14 }} onClick={() => setOpen(true)}>🔔 Notify me when available</button>
  return (
    <div style={{ display: 'grid', gap: 8, background: '#faf8f3', border: '1px solid var(--line2)', borderRadius: 12, padding: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--ink2)' }}>We'll WhatsApp you when <b>{product.name}{product.size ? ` (${product.size})` : ''}</b> is back in stock.</div>
      <input className="gs-input" style={{ height: 42 }} value={name} onChange={e => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
      <input className="gs-input" style={{ height: 42 }} value={phone} onChange={e => setPhone(e.target.value)} placeholder="Mobile number *" inputMode="tel" autoComplete="tel" />
      {state && state !== 'busy' && <div className="gs-err" style={{ marginTop: 0 }}>{state}</div>}
      <button className="gs-cta" style={{ height: 44, fontSize: 14 }} disabled={state === 'busy'} onClick={submit}>{state === 'busy' ? 'Saving…' : 'Notify me'}</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// My orders — live status, pickup pass, order again
// ═══════════════════════════════════════════════════════════════════════════
function MyOrders({ defaultPhone, onClose, onReorder, onPass }) {
  useOverlay(onClose)
  const [phone, setPhone] = useState(defaultPhone || '')
  const [orderNo, setOrderNo] = useState('')
  const [orders, setOrders] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const lookup = async (ph = phone) => {
    setErr(''); setOrders(null)
    if (ph.replace(/\D/g, '').length < 10) { setErr('Enter the 10-digit mobile number used on your order.'); return }
    setLoading(true)
    const { data, error } = await supabase.rpc('store_lookup_orders', { p_phone: ph, p_order_no: orderNo || null })
    setLoading(false)
    if (error) { setErr(error.message); return }
    setOrders(data || [])
  }
  // Returning customers see their orders straight away.
  useEffect(() => { if ((defaultPhone || '').replace(/\D/g, '').length >= 10) lookup(defaultPhone) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className="gs-ov" onClick={onClose} />
      <aside className="gs-drawer" role="dialog" aria-label="My orders">
        <div className="gs-grab" />
        <div className="gs-dhead"><h3>My orders</h3><button className="gs-x" onClick={onClose} aria-label="Close">×</button></div>
        <div className="gs-dbody">
          <div className="gs-field"><label className="gs-label">Mobile number</label><input className="gs-input" value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} inputMode="tel" placeholder="Used when ordering" /></div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="gs-input" value={orderNo} onChange={e => setOrderNo(e.target.value)} onKeyDown={e => e.key === 'Enter' && lookup()} placeholder="Order no. (optional)" />
            <button className="gs-cta" style={{ width: 'auto', padding: '0 20px', height: 46, fontSize: 14 }} onClick={() => lookup()} disabled={loading}>{loading ? '…' : 'Find'}</button>
          </div>
          {err && <div className="gs-err">{err}</div>}
          {loading && <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>{[0, 1].map(i => <div key={i} className="gs-shim" style={{ height: 120, borderRadius: 16 }} />)}</div>}
          {orders && orders.length === 0 && <div className="gs-empty" style={{ padding: '40px 8px' }}><div className="i">📭</div><b>No orders found</b>Check the number you used when ordering.</div>}
          {orders && orders.map(o => {
            const s = STATUS[o.status] || { label: o.status, tone: '#475569' }, step = STEPS.indexOf(o.status)
            return (
              <div key={o.id ?? o.order_no} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 14, marginTop: 12, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <b className="gs-serif" style={{ fontSize: 18 }}>{o.order_no}</b>
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: s.tone, background: s.tone + '14', padding: '4px 10px', borderRadius: 99 }}>{s.label}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>{new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div>
                {step >= 0 && <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>{STEPS.map((x, i) => <div key={x} title={STATUS[x].label} style={{ flex: 1, height: 5, borderRadius: 9, background: i <= step ? s.tone : '#ece7dc' }} />)}</div>}
                {o.status === 'ready' && <div className="gs-note" style={{ marginTop: 10, padding: '8px 12px' }}><span>🎉</span><span><b>Ready for pickup.</b> Show your pass at the counter.</span></div>}
                {Array.isArray(o.items) && <div style={{ fontSize: 13, color: 'var(--ink2)', marginTop: 10, lineHeight: 1.6 }}>{o.items.map((it, i) => <div key={i}>{it.name || 'Item'}{it.size ? ` · ${it.size}` : ''}{it.qty ? ` × ${it.qty}` : ''}</div>)}</div>}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, gap: 8, flexWrap: 'wrap' }}>
                  {o.total != null ? <b style={{ fontSize: 16 }}>₹{n(o.total)}</b> : <span />}
                  <div style={{ display: 'flex', gap: 6 }}>
                    {Array.isArray(o.items) && o.items.some(it => it.product_id) && <button className="gs-ghost" style={{ height: 36, fontSize: 12.5 }} onClick={() => onReorder(o)}>🔁 Order again</button>}
                    {!['delivered', 'cancelled'].includes(o.status) && <button className="gs-cta" style={{ width: 'auto', height: 36, padding: '0 14px', fontSize: 12.5, borderRadius: 11 }} onClick={() => onPass({ ...o, phone })}>Pickup pass</button>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </aside>
    </>
  )
}
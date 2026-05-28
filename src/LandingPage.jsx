import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from './supabase'
import SEOHead from './SEOHead'
import PrivacyPolicy from './PrivacyPolicy'

// ─── Config ───────────────────────────────────────────────────────────────────
const NAVY = '#0B1E3D'
const NAVY2 = '#0f2548'
const GOLD = '#C9A84C'
const GOLD_L = '#E8C96A'
const MUTED = '#8899BB'
const WA_NUM = '918974298074'
const YT_EMBED = '' // paste YouTube video ID here e.g. 'dQw4w9WgXcQ'
const MAPS_SRC = 'https://maps.google.com/maps?q=Khangabok+Thoubal+Manipur&output=embed'
const TAWKTO_ID = '' // paste Tawk.to property ID here e.g. '6123abc/default'

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useMobile() {
  const [m, setM] = useState(() => window.innerWidth <= 768)
  useEffect(() => {
    const mq = window.matchMedia('(max-width:768px)')
    const h = e => setM(e.matches)
    mq.addEventListener('change', h)
    return () => mq.removeEventListener('change', h)
  }, [])
  return m
}

function useCountUp(target, duration = 1800, start = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!start) return
    let st = null
    const step = ts => {
      if (!st) st = ts
      const p = Math.min((ts - st) / duration, 1)
      setCount(Math.floor((1 - Math.pow(1 - p, 3)) * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return count
}

function useInView(ref, threshold = 0.3) {
  const [v, setV] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, threshold])
  return v
}

// ─── Counter ──────────────────────────────────────────────────────────────────
function Counter({ value, suffix = '' }) {
  const ref = useRef()
  const inView = useInView(ref)
  const n = useCountUp(value, 1800, inView)
  return <span ref={ref}>{n}{suffix}</span>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ h = 120 }) {
  return (
    <div style={{ background: NAVY2, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, height: h, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.04) 50%,transparent 100%)', animation: 'shimmer 1.5s infinite' }} />
    </div>
  )
}

// ─── Notice Tag ───────────────────────────────────────────────────────────────
function NTag({ priority, category }) {
  const pC = priority === 'Urgent' ? ['#fee2e2','#dc2626'] : priority === 'Important' ? ['#fef3c7','#b45309'] : ['#e0f2fe','#0369a1']
  const cC = { Exam:['#ede9fe','#6d28d9'], Holiday:['#fce7f3','#9d174d'], Fee:['#fef3c7','#92400e'], Event:['#d1fae5','#065f46'], Academic:['#dbeafe','#1e40af'] }[category] || ['#f1f5f9','#475569']
  return (
    <div style={{ display:'flex', gap:6, marginBottom:8, flexWrap:'wrap' }}>
      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:700, background:pC[0], color:pC[1] }}>{priority}</span>
      <span style={{ fontSize:10, padding:'2px 8px', borderRadius:99, fontWeight:700, background:cC[0], color:cC[1] }}>{category}</span>
    </div>
  )
}

// ─── Notice Modal ─────────────────────────────────────────────────────────────
function NModal({ notice, onClose }) {
  if (!notice) return null
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:3000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:NAVY2, border:`1px solid rgba(201,168,76,0.2)`, borderRadius:'20px 20px 0 0', padding:28, width:'100%', maxWidth:600, maxHeight:'85vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div style={{ flex:1, marginRight:12 }}>
            {notice.pinned && <div style={{ fontSize:11, color:GOLD, fontWeight:700, marginBottom:4 }}>📌 PINNED</div>}
            <h2 style={{ fontFamily:'Georgia,serif', fontSize:18, fontWeight:700, color:'#fff', marginBottom:8 }}>{notice.title}</h2>
            <NTag priority={notice.priority} category={notice.category} />
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:14 }}>✕</button>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, background:'rgba(255,255,255,0.04)', borderRadius:10, padding:12, marginBottom:14, fontSize:12 }}>
          {[['👥 Audience',notice.audience],['📅 Date',notice.publish_date||'—'],['⏳ Expiry',notice.expiry_date||'No expiry'],['✍️ By',notice.created_by||'GNSI Admin']].map(([k,v]) => (
            <div key={k}><div style={{ color:MUTED }}>{k}</div><div style={{ fontWeight:700, color:'#fff' }}>{v}</div></div>
          ))}
        </div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.75)', lineHeight:1.8, whiteSpace:'pre-wrap', background:'rgba(255,255,255,0.03)', borderRadius:8, padding:14, marginBottom:12 }}>{notice.description}</div>
        {notice.attachment_url && <a href={notice.attachment_url} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:6, color:GOLD_L, fontSize:13, fontWeight:700, textDecoration:'none', background:'rgba(201,168,76,0.1)', padding:'8px 14px', borderRadius:8, border:`1px solid rgba(201,168,76,0.2)` }}>📎 Open Attachment</a>}
      </div>
    </div>
  )
}

// ─── Image Lightbox ───────────────────────────────────────────────────────────
function Lightbox({ img, caption, onClose }) {
  if (!img) return null
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:3000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:24, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', borderRadius:8, padding:'8px 14px', cursor:'pointer', fontSize:18 }}>✕</button>
      <img src={img} alt={caption} onClick={e => e.stopPropagation()} style={{ maxWidth:'90vw', maxHeight:'80vh', objectFit:'contain', borderRadius:12 }} />
      {caption && <p style={{ color:'rgba(255,255,255,0.7)', marginTop:16, fontSize:14 }}>{caption}</p>}
    </div>
  )
}

// ─── Splash Screen ────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{ position:'fixed', inset:0, background:NAVY, zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
      <div style={{ width:72, height:72, background:`rgba(201,168,76,0.15)`, border:`2px solid rgba(201,168,76,0.4)`, borderRadius:18, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Georgia,serif', fontWeight:900, color:GOLD_L, fontSize:'2rem', animation:'splashPulse 1s infinite' }}>G</div>
      <div style={{ fontFamily:'Georgia,serif', fontSize:'1.3rem', fontWeight:700, color:GOLD_L }}>GNSI Portal</div>
      <div style={{ fontSize:'0.75rem', color:MUTED, letterSpacing:'0.15em', textTransform:'uppercase' }}>Loading…</div>
      <div style={{ width:160, height:3, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden', marginTop:8 }}>
        <div style={{ height:'100%', background:GOLD, borderRadius:99, animation:'loadBar 1.2s ease forwards' }} />
      </div>
    </div>
  )
}

// ─── Cookie Banner ────────────────────────────────────────────────────────────
function CookieBanner({ onAccept, onDecline }) {
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:2000, background:'rgba(11,30,61,0.97)', backdropFilter:'blur(16px)', borderTop:'1px solid rgba(201,168,76,0.2)', padding:'1rem 5%', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
      <div style={{ flex:1, minWidth:200 }}>
        <p style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.8)', margin:0, lineHeight:1.6 }}>
          🍪 We use cookies to improve your experience and analyze website traffic.
          <button onClick={() => window.open('/privacy', '_blank')} style={{ background:'none', border:'none', color:GOLD_L, cursor:'pointer', fontSize:'0.85rem', textDecoration:'underline', padding:0, marginLeft:4, fontFamily:'inherit' }}>Learn more</button>
        </p>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <button onClick={onDecline} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'rgba(255,255,255,0.7)', padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:'0.82rem', fontFamily:'inherit' }}>Decline</button>
        <button onClick={onAccept} style={{ background:GOLD, color:NAVY, padding:'8px 20px', borderRadius:8, cursor:'pointer', fontSize:'0.82rem', fontWeight:700, border:'none', fontFamily:'inherit' }}>Accept All</button>
      </div>
    </div>
  )
}

// ─── Notification Bar ─────────────────────────────────────────────────────────
function NotifBar({ onDismiss }) {
  return (
    <div style={{ background:`linear-gradient(90deg,#1e3d70,${NAVY2})`, borderBottom:`1px solid rgba(201,168,76,0.2)`, padding:'10px 5%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, position:'relative', zIndex:102 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, flexWrap:'wrap' }}>
        <span style={{ background:GOLD, color:NAVY, fontSize:'0.7rem', fontWeight:800, padding:'2px 8px', borderRadius:99, whiteSpace:'nowrap' }}>🎉 NEW</span>
        <span style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.85)' }}>Admissions Open for 2026-27 Batch — Limited seats available. <strong style={{ color:GOLD_L }}>Apply before June 30</strong></span>
      </div>
      <button onClick={onDismiss} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:16, padding:'0 4px', flexShrink:0, lineHeight:1 }}>✕</button>
    </div>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState(null)
  const items = [
    ['What classes does GNSI prepare students for?','GNSI prepares students for Jawahar Navodaya Vidyalaya (Class 6 & 9), Sainik School, and RMS entrance examinations.'],
    ['Is hostel facility available?','Yes, GNSI has a safe boarding hostel with 24/7 supervision, nutritious meals, and a dedicated study hall for outstation students.'],
    ['When does the new batch start?','New batches start in June (summer) and January. Call +91 89742 98074 for the current schedule and seat availability.'],
    ["How can parents track their child's progress?",'Parents access the GNSI Portal to view fee receipts, attendance, exam marks, and notices in real-time from any device.'],
    ['What is the fee structure?','Fees vary by course and hostel type. Contact our admin office at Khangabok or call +91 89742 98074 for the current fee structure.'],
    ['How many students get selected each year?','Our selection rate is consistently above 90%. In 2025-26, 66 students were selected across NVS and Sainik School.'],
    ['Is GNSI government recognized?','GNSI operates as a registered private coaching institute in Manipur, specializing exclusively in Navodaya and Sainik School entrance preparation.'],
  ]
  return (
    <div>
      {items.map(([q, a], i) => (
        <div key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => setOpen(open===i?null:i)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', padding:'1.1rem 0', background:'none', border:'none', color:'#fff', fontSize:'0.95rem', fontWeight:500, cursor:'pointer', gap:'1rem', textAlign:'left', fontFamily:'inherit' }}>
            {q}<span style={{ color:GOLD, fontSize:'1.2rem', minWidth:20, transition:'transform 0.3s', transform:open===i?'rotate(45deg)':'rotate(0)', display:'inline-block' }}>+</span>
          </button>
          <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.5)', lineHeight:1.7, maxHeight:open===i?200:0, overflow:'hidden', transition:'max-height 0.35s ease', paddingBottom:open===i?'1.1rem':0 }}>{a}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage({ onLogin }) {
  const mobile = useMobile()

  // Data
  const [notices, setNotices] = useState([])
  const [results, setResults] = useState([])
  const [events, setEvents]   = useState([])
  const [gallery, setGallery] = useState([])
  const [lN, setLN] = useState(true)
  const [lR, setLR] = useState(true)
  const [lE, setLE] = useState(true)
  const [lG, setLG] = useState(true)

  // UI state
  const [preview, setPreview]       = useState(null)
  const [lightbox, setLightbox]     = useState(null)
  const [menuOpen, setMenuOpen]     = useState(false)
  const [scrolled, setScrolled]     = useState(false)
  const [showTop, setShowTop]       = useState(false)
  const [showCookie, setShowCookie] = useState(false)
  const [showNotif, setShowNotif]   = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [tickerPaused, setTP]       = useState(false)
  const [pwaPrompt, setPwaPrompt]   = useState(null)

  // Enquiry form
  const [enq, setEnq]   = useState({ name:'', phone:'', class_interest:'', message:'' })
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)

  const statsRef   = useRef()
  const statsInView = useInView(statsRef, 0.2)
  const [viewCount] = useState(() => Math.floor(Math.random() * 600) + 900)

  // ── Splash ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 1800)
    return () => clearTimeout(t)
  }, [])

  // ── Cookie consent ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem('gnsi_cookie_consent')) {
      const t = setTimeout(() => setShowCookie(true), 2500)
      return () => clearTimeout(t)
    }
  }, [])

  // ── PWA install prompt ───────────────────────────────────────────────────────
  useEffect(() => {
    const h = e => { e.preventDefault(); setPwaPrompt(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  // ── Tawk.to live chat ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!TAWKTO_ID || document.querySelector('#tawkto-script')) return
    const s = document.createElement('script')
    s.id = 'tawkto-script'; s.async = true; s.charset = 'UTF-8'
    s.src = `https://embed.tawk.to/${TAWKTO_ID}`
    document.head.appendChild(s)
  }, [])

  // ── Data fetch ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('notices').select('*').eq('is_public',true).eq('status','Published').or(`expiry_date.is.null,expiry_date.gte.${today}`).order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(6)
      .then(({data,error}) => { if(!error) setNotices(data||[]); setLN(false) })
    supabase.from('yearly_results').select('*').order('display_order',{ascending:true})
      .then(({data,error}) => { if(!error) setResults(data||[]); setLR(false) })
    supabase.from('events').select('*').eq('is_public',true).gte('event_date',today).order('event_date',{ascending:true}).limit(5)
      .then(({data,error}) => { if(!error) setEvents(data||[]); setLE(false) })
    supabase.from('social_posts').select('*').eq('is_public',true).order('created_at',{ascending:false}).limit(6)
      .then(({data,error}) => { if(!error) setGallery(data||[]); setLG(false) })
  }, [])

  // ── Scroll ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = () => { setScrolled(window.scrollY>40); setShowTop(window.scrollY>600) }
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const scrollTo = id => { document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); setMenuOpen(false) }

  // ── Cookie handlers ──────────────────────────────────────────────────────────
  const acceptCookie = () => { localStorage.setItem('gnsi_cookie_consent','accepted'); setShowCookie(false) }
  const declineCookie = () => { localStorage.setItem('gnsi_cookie_consent','declined'); setShowCookie(false) }

  // ── Enquiry ───────────────────────────────────────────────────────────────────
  const handleEnquiry = async e => {
    e.preventDefault()
    if (!enq.name || !enq.phone) return
    setSending(true)
    try {
      await supabase.from('enquiries').insert([{ ...enq, source:'Landing Page', status:'New', created_at: new Date().toISOString() }])
      setSent(true); setEnq({ name:'', phone:'', class_interest:'', message:'' })
    } catch(err) { console.error(err) }
    setSending(false)
  }

  // ── PWA install ───────────────────────────────────────────────────────────────
  const handlePwaInstall = async () => {
    if (!pwaPrompt) return
    pwaPrompt.prompt()
    const { outcome } = await pwaPrompt.userChoice
    if (outcome === 'accepted') setPwaPrompt(null)
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const fmtDate = d => { const dt = new Date(d); return { day:dt.getDate().toString().padStart(2,'0'), month:dt.toLocaleString('en-IN',{month:'short'}) } }
  const tagC = { green:['#dcfce7','#166534'], blue:['#dbeafe','#1e40af'], gold:['#fef3c7','#b45309'], red:['#fee2e2','#dc2626'], purple:['#ede9fe','#6d28d9'] }
  const cd = (extra={}) => ({ background:NAVY2, border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'1.4rem', transition:'all 0.25s', ...extra })
  const inp = { width:'100%', padding:'12px 16px', borderRadius:10, border:'1px solid rgba(255,255,255,0.12)', background:'rgba(255,255,255,0.05)', color:'#fff', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' }
  const sL = { display:'inline-block', fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', color:GOLD, marginBottom:'0.7rem' }
  const sT = { fontFamily:'Georgia,serif', fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:700, lineHeight:1.2, marginBottom:'0.7rem', color:'#fff' }
  const sS = { fontSize:'0.95rem', color:'rgba(255,255,255,0.5)', maxWidth:480, lineHeight:1.7, fontWeight:300, marginBottom:'2.5rem' }
  const btnP = { display:'inline-flex', alignItems:'center', gap:8, background:GOLD, color:NAVY, padding:'0.9rem 2rem', borderRadius:50, fontWeight:700, fontSize:'1rem', border:'none', cursor:'pointer', transition:'all 0.2s', fontFamily:'inherit' }
  const btnS = { display:'inline-flex', alignItems:'center', gap:8, background:'transparent', color:'#fff', padding:'0.9rem 2rem', borderRadius:50, border:'1px solid rgba(255,255,255,0.2)', fontWeight:500, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit' }

  const TICKER = ['📢 Admissions Open for 2026-27 Batch — Limited Seats','🏆 2025-26: 66 Students Selected in NVS & Sainik School','📅 Summer Batch Starts June 1, 2026','📝 Monthly Mock Tests Every Sunday','🎓 10+ Years · 200+ Officers Produced','📞 +91 89742 98074']

  if (showPrivacy) return <PrivacyPolicy onBack={() => setShowPrivacy(false)} />
  if (showSplash) return <Splash />

  return (
    <div style={{ background:NAVY, color:'#fff', minHeight:'100vh', fontFamily:"'DM Sans','Segoe UI',sans-serif", overflowX:'hidden' }}>
      <SEOHead />

      <style>{`
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(0.85)}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes splashPulse{0%,100%{box-shadow:0 0 0 0 rgba(201,168,76,0.4)}70%{box-shadow:0 0 0 16px rgba(201,168,76,0)}}
        @keyframes loadBar{0%{width:0%}100%{width:100%}}
        .gnsi-nav-links{display:none!important}
        .gnsi-menu-btn{display:block!important}
        @media(min-width:769px){.gnsi-nav-links{display:flex!important}.gnsi-menu-btn{display:none!important}}
        .hov-card:hover{border-color:rgba(201,168,76,0.35)!important;transform:translateY(-4px)!important}
        .hov-ev:hover{border-color:rgba(201,168,76,0.25)!important;transform:translateX(4px)!important}
        .hov-fac:hover{border-color:rgba(201,168,76,0.3)!important;transform:translateY(-3px)!important}
        .hov-res:hover{border-color:rgba(201,168,76,0.3)!important;transform:translateY(-4px)!important}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.3)}
        select option{background:#0f2548;color:#fff}
        *{box-sizing:border-box}
        html{scroll-behavior:smooth}
        ::-webkit-scrollbar{width:6px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(201,168,76,0.3);border-radius:3px}
      `}</style>

      {/* ── NOTIFICATION BAR ── */}
      {showNotif && !localStorage.getItem('gnsi_notif_dismissed') && (
        <NotifBar onDismiss={() => { setShowNotif(false); localStorage.setItem('gnsi_notif_dismissed','1') }} />
      )}

      {/* ── TICKER ── */}
      <div style={{ background:`linear-gradient(90deg,${GOLD},#b8922a)`, padding:'7px 0', overflow:'hidden', position:'relative', zIndex:101 }}
        onMouseEnter={() => setTP(true)} onMouseLeave={() => setTP(false)}>
        <div style={{ display:'flex', gap:'4rem', whiteSpace:'nowrap', animation:`ticker ${tickerPaused?'none':'30s'} linear infinite` }}>
          {[...TICKER,...TICKER].map((t,i) => <span key={i} style={{ fontSize:'0.78rem', fontWeight:600, color:NAVY, flexShrink:0 }}>{t}</span>)}
        </div>
      </div>

      {/* ── NAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.9rem 5%', background:scrolled?'rgba(11,30,61,0.97)':'rgba(11,30,61,0.9)', backdropFilter:'blur(20px)', borderBottom:'1px solid rgba(201,168,76,0.15)', transition:'all 0.3s', boxShadow:scrolled?'0 4px 24px rgba(0,0,0,0.3)':'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:40, height:40, background:'rgba(201,168,76,0.15)', border:`1px solid rgba(201,168,76,0.3)`, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:GOLD_L, fontSize:'1rem', fontFamily:'Georgia,serif' }}>G</div>
          <div>
            <div style={{ fontFamily:'Georgia,serif', fontSize:'1rem', fontWeight:700, color:GOLD_L, lineHeight:1.2 }}>GNSI Portal</div>
            <span style={{ fontSize:'0.6rem', color:MUTED, letterSpacing:'0.1em', textTransform:'uppercase', display:'block' }}>Khangabok, Manipur</span>
          </div>
        </div>
        <ul className="gnsi-nav-links" style={{ display:'flex', alignItems:'center', gap:'1.4rem', listStyle:'none', margin:0, padding:0 }}>
          {[['notices','Notices'],['results','Results'],['gallery','Gallery'],['events','Events'],['enquiry','Enquire'],['contact','Contact']].map(([id,label]) => (
            <li key={id}><button onClick={() => scrollTo(id)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.75)', fontSize:'0.83rem', cursor:'pointer', fontFamily:'inherit' }} onMouseEnter={e=>e.target.style.color=GOLD_L} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.75)'}>{label}</button></li>
          ))}
          <li><button onClick={onLogin} style={{ background:GOLD, color:NAVY, padding:'0.5rem 1.3rem', borderRadius:50, fontWeight:700, fontSize:'0.83rem', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Login →</button></li>
        </ul>
        <button className="gnsi-menu-btn" onClick={() => setMenuOpen(v=>!v)} style={{ background:'none', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', borderRadius:8, padding:'6px 10px', cursor:'pointer', fontSize:18 }}>{menuOpen?'✕':'☰'}</button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(11,30,61,0.99)', zIndex:200, padding:'5rem 5% 2rem', overflowY:'auto' }}>
          <button onClick={() => setMenuOpen(false)} style={{ position:'absolute', top:16, right:20, background:'none', border:'none', color:'#fff', fontSize:24, cursor:'pointer' }}>✕</button>
          {[['notices','📢 Notices'],['results','🏆 Results'],['gallery','📸 Gallery'],['events','📅 Events'],['enquiry','✏️ Enquire'],['contact','📍 Contact']].map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ display:'block', width:'100%', textAlign:'left', background:'none', border:'none', borderBottom:'1px solid rgba(255,255,255,0.06)', color:'rgba(255,255,255,0.85)', padding:'16px 0', fontSize:17, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:24 }}>
            <button onClick={onLogin} style={{ ...btnP, justifyContent:'center' }}>Login →</button>
            <a href={`https://wa.me/${WA_NUM}`} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'#25D366', color:'#fff', padding:'0.9rem', borderRadius:50, fontWeight:600, fontSize:'0.9rem', textDecoration:'none' }}>💬 WhatsApp</a>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ minHeight:'100vh', display:'flex', alignItems:'center', padding:'6rem 5% 4rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'radial-gradient(ellipse 60% 60% at 70% 50%,rgba(201,168,76,0.08) 0%,transparent 60%),radial-gradient(ellipse 40% 80% at 10% 50%,rgba(30,61,112,0.6) 0%,transparent 60%)' }} />
        <div style={{ position:'absolute', inset:0, opacity:0.04, backgroundImage:'linear-gradient(rgba(201,168,76,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.8) 1px,transparent 1px)', backgroundSize:'60px 60px' }} />
        <div style={{ position:'relative', zIndex:2, maxWidth:680, animation:'fadeUp 0.8s ease both' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', fontSize:'0.7rem', padding:'0.35rem 0.9rem', borderRadius:50, marginBottom:'1rem' }}>
            <span style={{ width:6, height:6, background:'#4ade80', borderRadius:'50%', animation:'pulse 2s infinite', display:'inline-block' }} />
            {viewCount.toLocaleString()} people visited this month
          </div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(201,168,76,0.12)', border:'1px solid rgba(201,168,76,0.3)', color:GOLD_L, fontSize:'0.72rem', fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase', padding:'0.4rem 1rem', borderRadius:50, marginBottom:'1.5rem' }}>
            <span style={{ width:6, height:6, background:GOLD, borderRadius:'50%', display:'inline-block' }} />
            Trusted since 2016 · Manipur's #1 Coaching Institute
          </div>
          <h1 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(2.8rem,6vw,5rem)', fontWeight:900, lineHeight:1.06, marginBottom:'1.5rem' }}>
            Shape Your Future<br />as a <span style={{ color:GOLD }}>Future Officer</span>
          </h1>
          <p style={{ fontSize:'1.05rem', lineHeight:1.8, color:'rgba(255,255,255,0.65)', maxWidth:520, marginBottom:'2.5rem', fontWeight:300 }}>
            Guidance Navodaya & Sainik Institute — Khangabok's premier coaching centre for Navodaya, Sainik, and RMS entrance exam preparation. Over 200 officers produced in 10 years.
          </p>
          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'2rem' }}>
            <button onClick={() => scrollTo('enquiry')} style={btnP} onMouseEnter={e=>e.currentTarget.style.background=GOLD_L} onMouseLeave={e=>e.currentTarget.style.background=GOLD}>Enquire Now →</button>
            <button onClick={onLogin} style={btnS}>Staff Login</button>
            <a href={`https://wa.me/${WA_NUM}?text=Hello, I want to enquire about admissions at GNSI Khangabok`} target="_blank" rel="noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#25D366', color:'#fff', padding:'0.9rem 1.5rem', borderRadius:50, fontWeight:600, fontSize:'1rem', textDecoration:'none' }}>💬 WhatsApp</a>
          </div>
          <div style={{ display:'flex', gap:'0.7rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
            {['✅ 95% Selection Rate','🏆 10+ Years','🛡️ Safe Hostel','📱 Digital Portal','🔒 SSL Secured'].map(b => (
              <span key={b} style={{ fontSize:'0.72rem', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:50, padding:'0.3rem 0.8rem', color:'rgba(255,255,255,0.7)' }}>{b}</span>
            ))}
          </div>
          {pwaPrompt && (
            <button onClick={handlePwaInstall} style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(201,168,76,0.12)', border:`1px solid rgba(201,168,76,0.3)`, color:GOLD_L, padding:'0.6rem 1.2rem', borderRadius:50, fontSize:'0.82rem', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
              📱 Add to Home Screen
            </button>
          )}
        </div>
      </section>

      {/* ── STATS ── */}
      <div ref={statsRef} style={{ padding:'3rem 5%', borderTop:'1px solid rgba(255,255,255,0.06)', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'2rem', textAlign:'center', background:'rgba(255,255,255,0.01)' }}>
        {[{n:10,s:'+',l:'Years'},{n:500,s:'+',l:'Students'},{n:95,s:'%',l:'Selection Rate'},{n:200,s:'+',l:'Officers'},{n:15,s:'+',l:'Modules'}].map(({n,s,l}) => (
          <div key={l}>
            <div style={{ fontFamily:'Georgia,serif', fontSize:'2.5rem', fontWeight:700, color:GOLD, lineHeight:1 }}><Counter value={n} suffix={s} /></div>
            <div style={{ fontSize:'0.82rem', color:MUTED, marginTop:6 }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── PROGRESS BARS ── */}
      <section style={{ padding:'5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={sL}>Our Strength</div>
        <div style={sT}>Why students choose GNSI</div>
        <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'1fr 1fr', gap:'3rem', marginTop:'2rem' }}>
          <div>
            {[['NVS Selection Rate',94],['Sainik School Rate',88],['Student Satisfaction',98],['Hostel Occupancy',92],['Faculty Rating',96]].map(([label,pct]) => (
              <div key={label} style={{ marginBottom:'1.4rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginBottom:6 }}>
                  <span style={{ color:'rgba(255,255,255,0.8)', fontWeight:500 }}>{label}</span>
                  <span style={{ color:GOLD, fontWeight:700 }}>{pct}%</span>
                </div>
                <div style={{ height:8, background:'rgba(255,255,255,0.08)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, background:`linear-gradient(90deg,${GOLD},${GOLD_L})`, width:statsInView?`${pct}%`:'0%', transition:'width 1.6s cubic-bezier(0.4,0,0.2,1)' }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', alignContent:'start' }}>
            {[['🏫','Est. 2016','Over a decade'],['👨‍🎓','500+ Alumni','Across Manipur'],['🏆','#1 Rated','In Thoubal'],['📱','Digital ERP','Custom portal']].map(([icon,label,desc]) => (
              <div key={label} style={{ ...cd({ textAlign:'center', padding:'1.5rem 1rem' }) }} className="hov-fac">
                <div style={{ fontSize:'1.8rem', marginBottom:'0.6rem' }}>{icon}</div>
                <div style={{ fontSize:'0.9rem', fontWeight:700, marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:'0.75rem', color:MUTED }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOTICES ── */}
      <section id="notices" style={{ padding:'5.5rem 5%' }}>
        <div style={sL}>Notice Board</div>
        <div style={sT}>Latest Announcements</div>
        <p style={sS}>Stay updated with admissions, exams, and events from GNSI.</p>
        {lN ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>{[1,2,3,4].map(i=><Sk key={i} h={160}/>)}</div>
        : notices.length === 0 ? <div style={{ textAlign:'center', color:MUTED, padding:'3rem', ...cd() }}><div style={{ fontSize:'2rem', marginBottom:12 }}>📢</div>No public notices right now.</div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1rem' }}>
            {notices.map(n => (
              <div key={n.id} onClick={() => setPreview(n)} className="hov-card"
                style={{ ...cd({ borderLeft:`4px solid ${n.priority==='Urgent'?'#dc2626':n.priority==='Important'?'#d97706':'rgba(201,168,76,0.3)'}`, cursor:'pointer', position:'relative' }) }}>
                {n.pinned && <span style={{ position:'absolute', top:10, right:10, fontSize:14 }}>📌</span>}
                <NTag priority={n.priority} category={n.category} />
                <h3 style={{ fontSize:'0.95rem', fontWeight:700, color:'#fff', marginBottom:8, lineHeight:1.4, paddingRight:n.pinned?24:0 }}>{n.title}</h3>
                <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', lineHeight:1.6, marginBottom:12, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{n.description}</p>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:MUTED }}>
                  <span>📅 {n.publish_date||'—'}</span>
                  <span style={{ color:GOLD_L, fontWeight:600 }}>Read more →</span>
                </div>
              </div>
            ))}
          </div>}
      </section>

      {/* ── RESULTS ── */}
      <section id="results" style={{ padding:'5.5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={sL}>Our Results</div>
        <div style={sT}>Year-wise Selections</div>
        <p style={sS}>Consistently clearing Navodaya, Sainik and RMS with top ranks.</p>
        {lR ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1.2rem' }}>{[1,2,3,4].map(i=><Sk key={i} h={140}/>)}</div>
        : results.length === 0 ? <div style={{ textAlign:'center', color:MUTED, padding:'3rem', ...cd() }}><div style={{ fontSize:'2rem', marginBottom:12 }}>🏆</div>Results coming soon.</div>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1.2rem' }}>
            {results.map(r => (
              <div key={r.id} className="hov-res" style={{ ...cd({ textAlign:'center', position:'relative', overflow:'hidden' }) }}>
                <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${GOLD},transparent)` }} />
                <div style={{ fontSize:'0.7rem', color:MUTED, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'0.5rem' }}>{r.year}</div>
                <div style={{ fontFamily:'Georgia,serif', fontSize:'3rem', fontWeight:900, color:GOLD, lineHeight:1 }}>{r.total_selections}</div>
                <div style={{ fontSize:'0.85rem', color:'rgba(255,255,255,0.7)', marginTop:6 }}>Total Selections</div>
                <div style={{ fontSize:'0.75rem', color:MUTED, marginTop:4 }}>
                  {r.nvs_count>0&&`${r.nvs_count} NVS`}{r.nvs_count>0&&r.sainik_count>0&&' · '}{r.sainik_count>0&&`${r.sainik_count} Sainik`}{r.rms_count>0&&` · ${r.rms_count} RMS`}
                </div>
              </div>
            ))}
          </div>}
      </section>

      {/* ── GALLERY ── */}
      <section id="gallery" style={{ padding:'5.5rem 5%' }}>
        <div style={sL}>Photo Gallery</div>
        <div style={sT}>Life at GNSI</div>
        <p style={sS}>Campus, classrooms, events, and proud moments of our students.</p>
        {lG ? <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>{[1,2,3].map(i=><Sk key={i} h={180}/>)}</div>
        : gallery.length === 0
          ? <div style={{ display:'grid', gridTemplateColumns:mobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:'1rem' }}>
              {[{span:mobile?2:2,h:mobile?180:300,icon:'🏫',label:'GNSI Campus'},{span:1,h:140,icon:'📚',label:'Study Hall'},{span:1,h:140,icon:'🏆',label:'Prize Distribution'},{span:1,h:140,icon:'👨‍🎓',label:'2025 Selections'},{span:1,h:140,icon:'⚽',label:'Sports Day'}].map((item,i) => (
                <div key={i} style={{ gridColumn:`span ${item.span}`, ...cd({ padding:0, minHeight:item.h, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }) }}>
                  <span style={{ fontSize:item.span===2?'3rem':'2rem' }}>{item.icon}</span>
                  <span style={{ fontSize:'0.78rem', color:MUTED }}>{item.label}</span>
                </div>
              ))}
            </div>
          : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem' }}>
              {gallery.map((post,i) => (
                <div key={post.id} onClick={() => post.image_url && setLightbox({ img:post.image_url, caption:post.caption||post.title })}
                  style={{ ...cd({ padding:0, overflow:'hidden', position:'relative', minHeight:180, gridColumn:i===0?'span 2':'span 1', cursor:post.image_url?'zoom-in':'default' }) }}
                  onMouseEnter={e=>e.currentTarget.style.transform='scale(1.02)'}
                  onMouseLeave={e=>e.currentTarget.style.transform='scale(1)'}>
                  {post.image_url
                    ? <img src={post.image_url} alt={post.caption||post.title} loading="lazy" style={{ width:'100%', height:'100%', minHeight:180, objectFit:'cover', display:'block' }} />
                    : <div style={{ width:'100%', minHeight:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background:NAVY2 }}><span style={{ fontSize:'2rem' }}>📸</span><span style={{ fontSize:'0.78rem', color:MUTED }}>{post.content_type}</span></div>}
                  <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(11,30,61,0.8) 0%,transparent 50%)', display:'flex', alignItems:'flex-end', padding:'1rem' }}>
                    <div><div style={{ fontSize:'0.82rem', fontWeight:600 }}>{post.caption||post.title}</div><div style={{ fontSize:'0.7rem', color:MUTED }}>{post.platform} · {post.post_date}</div></div>
                  </div>
                </div>
              ))}
            </div>}
        <p style={{ textAlign:'center', color:MUTED, fontSize:'0.8rem', marginTop:'1.5rem' }}>📸 Photos managed from Social module · Mark posts as public to appear here</p>
      </section>

      {/* ── EVENTS ── */}
      <section id="events" style={{ padding:'5.5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={sL}>Upcoming Events</div>
        <div style={sT}>Mark your calendar</div>
        {lE ? <div style={{ display:'flex', flexDirection:'column', gap:'1rem', marginTop:'2rem' }}>{[1,2,3].map(i=><Sk key={i} h={90}/>)}</div>
        : events.length === 0 ? <div style={{ textAlign:'center', color:MUTED, padding:'3rem', ...cd({ marginTop:'2rem' }) }}><div style={{ fontSize:'2rem', marginBottom:12 }}>📅</div>No upcoming events.</div>
        : <div style={{ display:'flex', flexDirection:'column', gap:'1rem', marginTop:'2rem' }}>
            {events.map(ev => {
              const {day,month} = fmtDate(ev.event_date)
              const [tBg,tC] = tagC[ev.tag_color] || tagC.blue
              return (
                <div key={ev.id} className="hov-ev" style={cd({ display:'flex', gap:'1.5rem', alignItems:'flex-start' })}>
                  <div style={{ minWidth:56, textAlign:'center', background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:12, padding:'0.7rem 0.5rem', flexShrink:0 }}>
                    <div style={{ fontFamily:'Georgia,serif', fontSize:'1.6rem', fontWeight:700, color:GOLD, lineHeight:1 }}>{day}</div>
                    <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.08em', color:MUTED }}>{month}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.95rem', fontWeight:600, marginBottom:4 }}>{ev.title}</div>
                    {ev.description && <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginBottom:8 }}>{ev.description}</div>}
                    <span style={{ fontSize:'0.65rem', padding:'2px 8px', borderRadius:99, fontWeight:700, background:tBg, color:tC }}>{ev.tag}</span>
                  </div>
                </div>
              )
            })}
          </div>}
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding:'5.5rem 5%' }}>
        <div style={sL}>Testimonials</div>
        <div style={sT}>What parents & students say</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1.2rem', marginTop:'2.5rem' }}>
          {[{i:'RD',name:'Romen Devi',sub:'Parent · Thoubal',text:'"My son got selected in NVS Class 6 after just one year at GNSI. The teachers are dedicated and the results speak for themselves."'},
            {i:'KS',name:'Kiran Singh',sub:'Parent · Imphal',text:'"The hostel is clean and safe. GNSI gave my daughter the discipline to crack Sainik School on her first attempt."'},
            {i:'BM',name:'Bikash Meetei',sub:'NVS Selected 2025',text:'"Weekly mock tests helped me identify weak areas and improve fast. I got selected in NVS — GNSI made it possible."'}
          ].map(t => (
            <div key={t.name} style={cd()} className="hov-card">
              <div style={{ color:GOLD, fontSize:'0.9rem', letterSpacing:2, marginBottom:'1rem' }}>★★★★★</div>
              <p style={{ fontSize:'0.87rem', color:'rgba(255,255,255,0.65)', lineHeight:1.7, fontStyle:'italic', marginBottom:'1.2rem' }}>{t.text}</p>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(201,168,76,0.15)', border:'1px solid rgba(201,168,76,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.85rem', color:GOLD }}>{t.i}</div>
                <div><div style={{ fontSize:'0.88rem', fontWeight:600 }}>{t.name}</div><div style={{ fontSize:'0.72rem', color:MUTED }}>{t.sub}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FACILITIES ── */}
      <section style={{ padding:'5.5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={sL}>Our Facilities</div>
        <div style={sT}>Everything for your child's success</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1.2rem', marginTop:'2.5rem' }}>
          {[['🏠','Boarding Hostel','Safe, clean and 24/7 supervised for outstation students.'],['📚','Study Hall','Dedicated quiet area with proper lighting for focused prep.'],['🍽️','Mess & Nutrition','Balanced nutritious meals three times daily.'],['⚽','Sports Ground','Outdoor area essential for Sainik School fitness.'],['👨‍🏫','Expert Faculty','Specialists in NVS and Sainik exam syllabus.'],['📱','Digital Portal','Parents track fees, attendance and marks anytime.']].map(([icon,name,desc]) => (
            <div key={name} style={{ ...cd({ textAlign:'center' }) }} className="hov-fac">
              <div style={{ fontSize:'2rem', marginBottom:'0.8rem' }}>{icon}</div>
              <div style={{ fontSize:'0.95rem', fontWeight:600, marginBottom:'0.4rem' }}>{name}</div>
              <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── VIDEO ── */}
      {YT_EMBED && (
        <section style={{ padding:'5.5rem 5%' }}>
          <div style={sL}>See GNSI</div>
          <div style={sT}>Watch our institute</div>
          <div style={{ borderRadius:20, overflow:'hidden', border:`1px solid rgba(201,168,76,0.2)`, marginTop:'2rem', aspectRatio:'16/9', maxWidth:800, margin:'2rem auto 0' }}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${YT_EMBED}`} title="GNSI" frameBorder="0" allowFullScreen style={{ display:'block' }} />
          </div>
        </section>
      )}

      {/* ── ENQUIRY ── */}
      <section id="enquiry" style={{ padding:'5.5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={sL}>Get in Touch</div>
        <div style={sT}>Send an Enquiry</div>
        <p style={sS}>Fill this form and our team will call you back within 24 hours.</p>
        <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'1fr 1fr', gap:'3rem', alignItems:'start', maxWidth:900 }}>
          <div style={{ ...cd({ border:`1px solid rgba(201,168,76,0.2)`, position:'relative', overflow:'hidden' }) }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:`linear-gradient(90deg,${GOLD},${GOLD_L},transparent)` }} />
            {sent
              ? <div style={{ textAlign:'center', padding:'2rem 0' }}>
                  <div style={{ fontSize:'3rem', marginBottom:'1rem' }}>✅</div>
                  <h3 style={{ fontFamily:'Georgia,serif', fontSize:'1.3rem', color:GOLD_L, marginBottom:'0.5rem' }}>Enquiry Sent!</h3>
                  <p style={{ color:'rgba(255,255,255,0.6)', fontSize:'0.9rem', lineHeight:1.6 }}>Our team will call you back within 24 hours.</p>
                  <button onClick={() => setSent(false)} style={{ marginTop:'1.5rem', background:'rgba(201,168,76,0.15)', border:`1px solid rgba(201,168,76,0.3)`, color:GOLD_L, padding:'0.6rem 1.4rem', borderRadius:50, cursor:'pointer', fontSize:'0.85rem', fontFamily:'inherit' }}>Send Another</button>
                </div>
              : <form onSubmit={handleEnquiry}>
                  <h3 style={{ fontFamily:'Georgia,serif', fontSize:'1.2rem', color:'#fff', marginBottom:'1.5rem' }}>Admission Enquiry</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                    {[['name','Student / Parent Name *','Full name',true],['phone','Phone Number *','+91 XXXXX XXXXX',true]].map(([field,label,ph,req]) => (
                      <div key={field}>
                        <label style={{ display:'block', fontSize:'0.72rem', fontWeight:600, color:MUTED, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</label>
                        <input style={inp} placeholder={ph} required={req} value={enq[field]} onChange={e => setEnq({...enq,[field]:e.target.value})} />
                      </div>
                    ))}
                    <div>
                      <label style={{ display:'block', fontSize:'0.72rem', fontWeight:600, color:MUTED, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Class Interest</label>
                      <select style={{ ...inp, cursor:'pointer' }} value={enq.class_interest} onChange={e => setEnq({...enq,class_interest:e.target.value})}>
                        <option value="">Select class…</option>
                        {['NVS Class 6','NVS Class 9','Sainik School Class 6','Sainik School Class 9','RMS','Other'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'0.72rem', fontWeight:600, color:MUTED, marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Message (optional)</label>
                      <textarea rows={3} style={{ ...inp, resize:'vertical' }} placeholder="Any questions?" value={enq.message} onChange={e => setEnq({...enq,message:e.target.value})} />
                    </div>
                    <button type="submit" disabled={sending} style={{ ...btnP, width:'100%', justifyContent:'center', opacity:sending?0.7:1 }}>
                      {sending?'⏳ Sending…':'📨 Send Enquiry'}
                    </button>
                    <p style={{ fontSize:'0.72rem', color:MUTED, textAlign:'center' }}>
                      Or WhatsApp: <a href={`https://wa.me/${WA_NUM}`} target="_blank" rel="noreferrer" style={{ color:GOLD_L }}>+91 89742 98074</a>
                    </p>
                    <p style={{ fontSize:'0.68rem', color:'rgba(255,255,255,0.3)', textAlign:'center' }}>
                      By submitting you agree to our <button onClick={() => setShowPrivacy(true)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', textDecoration:'underline', fontSize:'0.68rem', fontFamily:'inherit', padding:0 }}>Privacy Policy</button>
                    </p>
                  </div>
                </form>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {[['📍','Address','Khangabok Sorok Wangma, Near Community Hall, Thoubal, Manipur — 795138'],['📞','Phone','+91 89742 98074'],['🕐','Office Hours','Mon–Sat: 8:00 AM – 6:00 PM'],['🌐','Portal','gnsi-erp.vercel.app']].map(([icon,label,val]) => (
              <div key={label} style={cd({ display:'flex', gap:'1rem', alignItems:'flex-start' })} className="hov-card">
                <div style={{ fontSize:'1.3rem', minWidth:36 }}>{icon}</div>
                <div><div style={{ fontSize:'0.72rem', color:MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div><div style={{ fontSize:'0.9rem', fontWeight:500 }}>{val}</div></div>
              </div>
            ))}
            <a href={`https://wa.me/${WA_NUM}?text=Hello, I want to enquire about admissions at GNSI Khangabok`} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:'#25D366', color:'#fff', padding:'0.9rem 1.5rem', borderRadius:14, fontWeight:700, fontSize:'1rem', textDecoration:'none' }}>
              💬 Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── MAP ── */}
      <section id="contact" style={{ padding:'5.5rem 5%' }}>
        <div style={sL}>Location</div>
        <div style={sT}>Find us in Khangabok</div>
        <div style={{ borderRadius:20, overflow:'hidden', border:`1px solid rgba(201,168,76,0.2)`, marginTop:'2rem', height:380 }}>
          <iframe src={MAPS_SRC} width="100%" height="100%" frameBorder="0" style={{ display:'block' }} allowFullScreen title="GNSI Location" loading="lazy" />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding:'5.5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={sL}>FAQ</div>
        <div style={sT}>Frequently asked questions</div>
        <div style={{ maxWidth:700, marginTop:'2.5rem' }}><FAQ /></div>
      </section>

      {/* ── CTA ── */}
      <div style={{ margin:'0 5% 5.5rem', background:`linear-gradient(135deg,#1e3d70 0%,${NAVY2} 100%)`, border:`1px solid rgba(201,168,76,0.25)`, borderRadius:28, padding:'5rem 3rem', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:400, height:400, background:'radial-gradient(circle,rgba(201,168,76,0.1) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />
        <h2 style={{ fontFamily:'Georgia,serif', fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:700, marginBottom:'1rem' }}>Admissions Open for 2026-27</h2>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.95rem', maxWidth:420, margin:'0 auto 2.5rem', lineHeight:1.7 }}>Limited seats. Don't miss this opportunity for your child's future.</p>
        <div style={{ display:'flex', justifyContent:'center', gap:'1rem', flexWrap:'wrap' }}>
          <button onClick={() => scrollTo('enquiry')} style={{ ...btnP, fontSize:'1rem' }}>Enquire Now →</button>
          <a href={`https://wa.me/${WA_NUM}`} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#25D366', color:'#fff', padding:'0.9rem 1.8rem', borderRadius:50, fontWeight:600, fontSize:'1rem', textDecoration:'none' }}>💬 WhatsApp Us</a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ padding:'3rem 5% 2rem', borderTop:'1px solid rgba(255,255,255,0.06)', background:NAVY2 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'2rem', marginBottom:'2rem' }}>
          <div>
            <div style={{ fontFamily:'Georgia,serif', fontSize:'1.1rem', color:GOLD_L, marginBottom:'0.8rem' }}>GNSI Portal</div>
            <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.4)', lineHeight:1.7, maxWidth:260, marginBottom:'1rem' }}>Guidance Navodaya & Sainik Institute — Khangabok's premier coaching centre since 2016.</p>
            <div style={{ display:'flex', gap:8 }}>
              <a href={`https://wa.me/${WA_NUM}`} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.2)', color:'#4ade80', padding:'5px 10px', borderRadius:7, textDecoration:'none', fontSize:'0.75rem', fontWeight:600 }}>💬 WA</a>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.5)', padding:'5px 10px', borderRadius:7, fontSize:'0.75rem' }}>🔒 SSL Secured</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:MUTED, marginBottom:'1rem' }}>Quick Links</div>
            {[['notices','Notices'],['results','Results'],['gallery','Gallery'],['events','Events'],['enquiry','Enquire'],['contact','Location']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ display:'block', background:'none', border:'none', color:'rgba(255,255,255,0.45)', fontSize:'0.82rem', padding:'4px 0', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>{label}</button>
            ))}
          </div>
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:MUTED, marginBottom:'1rem' }}>Contact</div>
            {['📞 +91 89742 98074','📍 Khangabok, Thoubal','🗺️ Manipur — 795138','🕐 Mon–Sat 8AM–6PM'].map(t => (
              <div key={t} style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.45)', padding:'4px 0' }}>{t}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:MUTED, marginBottom:'1rem' }}>Portal</div>
            <button onClick={onLogin} style={{ display:'block', background:GOLD, color:NAVY, padding:'8px 16px', borderRadius:8, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.85rem', marginBottom:12, fontFamily:'inherit', width:'100%' }}>Staff Login →</button>
            {pwaPrompt && <button onClick={handlePwaInstall} style={{ display:'block', background:'rgba(201,168,76,0.12)', border:`1px solid rgba(201,168,76,0.3)`, color:GOLD_L, padding:'8px 16px', borderRadius:8, cursor:'pointer', fontSize:'0.82rem', fontFamily:'inherit', width:'100%' }}>📱 Install App</button>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem', paddingTop:'2rem', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:'0.75rem', color:MUTED }}>© {new Date().getFullYear()} Guidance Navodaya & Sainik Institute, Khangabok, Manipur.</div>
          <div style={{ display:'flex', gap:16 }}>
            <button onClick={() => setShowPrivacy(true)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', fontSize:'0.75rem', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>Privacy Policy</button>
            <span style={{ fontSize:'0.75rem', color:MUTED }}>Built with GNSI ERP</span>
          </div>
        </div>
      </footer>

      {/* ── FLOATING WhatsApp ── */}
      <a href={`https://wa.me/${WA_NUM}?text=Hello, I want to enquire about admissions at GNSI Khangabok`} target="_blank" rel="noreferrer"
        style={{ position:'fixed', bottom:mobile?90:28, right:24, zIndex:999, width:56, height:56, borderRadius:'50%', background:'#25D366', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', boxShadow:'0 4px 20px rgba(37,211,102,0.5)', textDecoration:'none', animation:'bounce 2.5s infinite' }}>
        💬
      </a>

      {/* ── BACK TO TOP ── */}
      {showTop && (
        <button onClick={() => window.scrollTo({top:0,behavior:'smooth'})}
          style={{ position:'fixed', bottom:mobile?155:90, right:24, zIndex:998, width:44, height:44, borderRadius:'50%', background:'rgba(201,168,76,0.2)', border:`1px solid rgba(201,168,76,0.4)`, color:GOLD_L, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
          ↑
        </button>
      )}

      {/* ── STICKY MOBILE CTA ── */}
      {mobile && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:997, background:'rgba(11,30,61,0.97)', backdropFilter:'blur(16px)', borderTop:`1px solid rgba(201,168,76,0.2)`, padding:'10px 16px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <a href={`tel:+918974298074`} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'8px 4px', textDecoration:'none', color:'#fff' }}>
            <span style={{ fontSize:'1.2rem' }}>📞</span><span style={{ fontSize:'0.65rem', color:MUTED }}>Call</span>
          </a>
          <a href={`https://wa.me/${WA_NUM}`} target="_blank" rel="noreferrer" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'rgba(37,211,102,0.15)', border:'1px solid rgba(37,211,102,0.25)', borderRadius:10, padding:'8px 4px', textDecoration:'none', color:'#4ade80' }}>
            <span style={{ fontSize:'1.2rem' }}>💬</span><span style={{ fontSize:'0.65rem' }}>WhatsApp</span>
          </a>
          <button onClick={() => scrollTo('enquiry')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:`rgba(201,168,76,0.15)`, border:`1px solid rgba(201,168,76,0.3)`, borderRadius:10, padding:'8px 4px', cursor:'pointer', color:GOLD_L, fontFamily:'inherit' }}>
            <span style={{ fontSize:'1.2rem' }}>✏️</span><span style={{ fontSize:'0.65rem' }}>Enquire</span>
          </button>
        </div>
      )}

      {/* ── MODALS ── */}
      {preview && <NModal notice={preview} onClose={() => setPreview(null)} />}
      {lightbox && <Lightbox img={lightbox.img} caption={lightbox.caption} onClose={() => setLightbox(null)} />}
      {showCookie && <CookieBanner onAccept={acceptCookie} onDecline={declineCookie} />}
    </div>
  )
}
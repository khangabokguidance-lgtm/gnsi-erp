import { useEffect, useState, useRef } from 'react'
import { supabase } from './supabase'
import SEOHead from './SEOHead'
import PrivacyPolicy from './PrivacyPolicy'

// ─── Design System ────────────────────────────────────────────────────────────
const C = {
  navy:    '#040D1E',
  navy2:   '#071428',
  navy3:   '#0A1F3D',
  navy4:   '#0F2A52',
  gold:    '#D4A843',
  goldL:   '#F0C866',
  goldD:   '#A87C2A',
  muted:   '#6B85A8',
  white:   '#FFFFFF',
  red:     '#E8443A',
  green:   '#2ECC8A',
  blue:    '#4A9EF0',
  purple:  '#8B5CF6',
  wa:      '#25D366',
}
const WA = '918974298074'
const MAPS = 'https://maps.google.com/maps?q=Khangabok+Thoubal+Manipur&output=embed'
const YT = ''

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

function useInView(ref, threshold = 0.2) {
  const [v, setV] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold })
    if (ref?.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, threshold])
  return v
}

function useCountUp(target, duration = 2000, start = false) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!start) return
    let st = null
    const step = ts => {
      if (!st) st = ts
      const p = Math.min((ts - st) / duration, 1)
      setN(Math.floor((1 - Math.pow(1 - p, 4)) * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [start, target, duration])
  return n
}

// ─── Counter ──────────────────────────────────────────────────────────────────
function Counter({ value, suffix = '', prefix = '' }) {
  const ref = useRef()
  const iv = useInView(ref)
  const n = useCountUp(value, 2000, iv)
  return <span ref={ref}>{prefix}{n}{suffix}</span>
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Sk({ h = 120 }) {
  return (
    <div style={{ background: C.navy3, border: `1px solid rgba(212,168,67,0.08)`, borderRadius: 20, height: h, overflow: 'hidden', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(212,168,67,0.06),transparent)', animation: 'shimmer 1.8s infinite' }} />
    </div>
  )
}

// ─── Notice Modal ─────────────────────────────────────────────────────────────
function NModal({ n, onClose }) {
  if (!n) return null
  const pC = n.priority === 'Urgent' ? [C.red,'#fff'] : n.priority === 'Important' ? [C.gold, C.navy] : [C.blue,'#fff']
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(4,13,30,0.9)', zIndex:3000, display:'flex', alignItems:'flex-end', justifyContent:'center', backdropFilter:'blur(8px)' }}>
      <div onClick={e=>e.stopPropagation()} style={{ background:`linear-gradient(160deg,${C.navy3},${C.navy2})`, border:`1px solid rgba(212,168,67,0.2)`, borderRadius:'24px 24px 0 0', padding:32, width:'100%', maxWidth:640, maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ flex:1, marginRight:16 }}>
            {n.pinned && <span style={{ fontSize:11, background:'rgba(212,168,67,0.15)', color:C.gold, padding:'3px 10px', borderRadius:99, fontWeight:700, display:'inline-block', marginBottom:8 }}>📌 PINNED</span>}
            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:20, fontWeight:700, color:'#fff', marginBottom:10, lineHeight:1.3 }}>{n.title}</h2>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, fontWeight:700, background:pC[0], color:pC[1] }}>{n.priority}</span>
              <span style={{ fontSize:11, padding:'3px 10px', borderRadius:99, fontWeight:700, background:'rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.8)' }}>{n.category}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:16 }}>✕</button>
        </div>
        <div style={{ background:'rgba(255,255,255,0.04)', borderRadius:14, padding:16, marginBottom:16, display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, fontSize:13 }}>
          {[['👥',n.audience],['📅',n.publish_date||'—'],['⏳',n.expiry_date||'No expiry'],['✍️',n.created_by||'GNSI Admin']].map(([k,v]) => (
            <div key={k}><span style={{ color:C.muted }}>{k} </span><span style={{ fontWeight:600, color:'#fff' }}>{v}</span></div>
          ))}
        </div>
        <p style={{ fontSize:14, color:'rgba(255,255,255,0.75)', lineHeight:1.9, whiteSpace:'pre-wrap', background:'rgba(255,255,255,0.03)', borderRadius:12, padding:16 }}>{n.description}</p>
        {n.attachment_url && <a href={n.attachment_url} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:8, color:C.goldL, fontSize:13, fontWeight:700, textDecoration:'none', background:'rgba(212,168,67,0.1)', padding:'10px 16px', borderRadius:10, border:`1px solid rgba(212,168,67,0.2)`, marginTop:16 }}>📎 Open Attachment</a>}
      </div>
    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────
function Lightbox({ img, caption, onClose }) {
  if (!img) return null
  useEffect(() => {
    const h = e => { if (e.key==='Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(4,13,30,0.95)', zIndex:4000, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', backdropFilter:'blur(12px)' }}>
      <button onClick={onClose} style={{ position:'absolute', top:24, right:28, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', borderRadius:10, padding:'8px 16px', cursor:'pointer', fontSize:18 }}>✕</button>
      <img src={img} alt={caption} onClick={e=>e.stopPropagation()} style={{ maxWidth:'88vw', maxHeight:'78vh', objectFit:'contain', borderRadius:16, boxShadow:'0 32px 80px rgba(0,0,0,0.6)' }} />
      {caption && <p style={{ color:'rgba(255,255,255,0.6)', marginTop:20, fontSize:14, textAlign:'center' }}>{caption}</p>}
    </div>
  )
}

// ─── Splash ───────────────────────────────────────────────────────────────────
function Splash() {
  return (
    <div style={{ position:'fixed', inset:0, background:`radial-gradient(ellipse at center,${C.navy3} 0%,${C.navy} 70%)`, zIndex:9999, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:24 }}>
      <div style={{ position:'relative' }}>
        <div style={{ width:80, height:80, borderRadius:20, background:`linear-gradient(135deg,${C.navy4},${C.navy3})`, border:`2px solid ${C.gold}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'2.2rem', fontFamily:"'Playfair Display',serif", fontWeight:900, color:C.gold, animation:'splashPulse 1.2s ease-in-out infinite', boxShadow:`0 0 40px rgba(212,168,67,0.3)` }}>G</div>
        <div style={{ position:'absolute', inset:-8, borderRadius:28, border:`1px solid rgba(212,168,67,0.2)`, animation:'splashRing 1.2s ease-in-out infinite' }} />
      </div>
      <div>
        <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'1.6rem', fontWeight:800, color:C.goldL, textAlign:'center', letterSpacing:'0.02em' }}>GNSI Portal</div>
        <div style={{ fontSize:'0.72rem', color:C.muted, textAlign:'center', letterSpacing:'0.2em', textTransform:'uppercase', marginTop:4 }}>Guidance Navodaya & Sainik Institute</div>
      </div>
      <div style={{ width:200, height:2, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', background:`linear-gradient(90deg,${C.gold},${C.goldL})`, borderRadius:99, animation:'loadBar 1.5s ease forwards' }} />
      </div>
    </div>
  )
}

// ─── Cookie Banner ────────────────────────────────────────────────────────────
function Cookie({ onAccept, onDecline }) {
  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:2000, background:`linear-gradient(90deg,${C.navy3},${C.navy2})`, backdropFilter:'blur(20px)', borderTop:`1px solid rgba(212,168,67,0.15)`, padding:'1rem 5%', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
      <p style={{ fontSize:'0.84rem', color:'rgba(255,255,255,0.75)', margin:0, lineHeight:1.6, flex:1, minWidth:200 }}>🍪 We use cookies to enhance your experience and analyze traffic.</p>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onDecline} style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.65)', padding:'8px 18px', borderRadius:10, cursor:'pointer', fontSize:'0.82rem', fontFamily:'inherit' }}>Decline</button>
        <button onClick={onAccept} style={{ background:`linear-gradient(135deg,${C.gold},${C.goldD})`, color:C.navy, padding:'8px 22px', borderRadius:10, cursor:'pointer', fontSize:'0.82rem', fontWeight:700, border:'none', fontFamily:'inherit', boxShadow:`0 4px 16px rgba(212,168,67,0.3)` }}>Accept All</button>
      </div>
    </div>
  )
}

// ─── NotifBar ─────────────────────────────────────────────────────────────────
function NotifBar({ onDismiss }) {
  return (
    <div style={{ background:`linear-gradient(90deg,#1a0a3d,#0d1a40,#1a0a3d)`, borderBottom:`1px solid rgba(139,92,246,0.3)`, padding:'9px 5%', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, flexWrap:'wrap' }}>
        <span style={{ background:`linear-gradient(135deg,${C.purple},#a78bfa)`, color:'#fff', fontSize:'0.68rem', fontWeight:800, padding:'3px 10px', borderRadius:99, whiteSpace:'nowrap', letterSpacing:'0.05em' }}>🎉 NEW</span>
        <span style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.85)' }}>Admissions Open for 2026-27 — Limited seats. <strong style={{ color:'#c4b5fd' }}>Apply before June 30</strong></span>
      </div>
      <button onClick={onDismiss} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.35)', cursor:'pointer', fontSize:18, padding:'0 4px', lineHeight:1, flexShrink:0 }}>✕</button>
    </div>
  )
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState(null)
  const items = [
    ['What classes does GNSI prepare students for?','GNSI prepares students for Jawahar Navodaya Vidyalaya (Class 6 & 9), Sainik School, and RMS entrance examinations.'],
    ['Is hostel facility available?','Yes — safe boarding hostel with 24/7 supervision, nutritious meals, and dedicated study hall for outstation students.'],
    ['When does the new batch start?','New batches start in June and January. Call +91 89742 98074 for current schedule and seat availability.'],
    ["How can parents track progress?",'Parents access the GNSI Portal to view fee receipts, attendance, exam marks, and notices in real-time from any device.'],
    ['What is the fee structure?','Fees vary by course and hostel type. Contact admin at Khangabok or call +91 89742 98074 for current details.'],
    ['How many students get selected each year?','Selection rate is consistently above 90%. In 2025-26, 66 students were selected across NVS and Sainik School.'],
  ]
  return (
    <div>
      {items.map(([q,a],i) => (
        <div key={i} style={{ borderBottom:`1px solid rgba(255,255,255,0.07)` }}>
          <button onClick={()=>setOpen(open===i?null:i)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', width:'100%', padding:'1.2rem 0', background:'none', border:'none', color:'#fff', fontSize:'0.95rem', fontWeight:500, cursor:'pointer', gap:'1rem', textAlign:'left', fontFamily:'inherit' }}>
            <span style={{ fontFamily:"'DM Sans',sans-serif" }}>{q}</span>
            <span style={{ width:28, height:28, borderRadius:'50%', background:open===i?`rgba(212,168,67,0.2)`:'rgba(255,255,255,0.06)', border:`1px solid ${open===i?C.gold:'rgba(255,255,255,0.1)'}`, display:'flex', alignItems:'center', justifyContent:'center', color:open===i?C.gold:'rgba(255,255,255,0.4)', fontSize:'1rem', transition:'all 0.3s', transform:open===i?'rotate(45deg)':'rotate(0)', flexShrink:0 }}>+</span>
          </button>
          <div style={{ fontSize:'0.88rem', color:'rgba(255,255,255,0.55)', lineHeight:1.8, maxHeight:open===i?200:0, overflow:'hidden', transition:'max-height 0.4s cubic-bezier(0.4,0,0.2,1)', paddingBottom:open===i?'1.2rem':0 }}>{a}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────
function SH({ label, title, sub, center = false, accent = C.gold }) {
  return (
    <div style={{ textAlign:center?'center':'left', marginBottom:'2.5rem' }}>
      <div style={{ display:'inline-flex', alignItems:'center', gap:8, marginBottom:'0.8rem' }}>
        <div style={{ width:24, height:2, background:accent, borderRadius:2 }} />
        <span style={{ fontSize:'0.7rem', fontWeight:700, letterSpacing:'0.18em', textTransform:'uppercase', color:accent }}>{label}</span>
        <div style={{ width:24, height:2, background:accent, borderRadius:2 }} />
      </div>
      <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'clamp(1.9rem,3.5vw,2.8rem)', fontWeight:800, lineHeight:1.15, color:'#fff', marginBottom:'0.8rem' }}>{title}</h2>
      {sub && <p style={{ fontSize:'0.95rem', color:C.muted, maxWidth:520, lineHeight:1.8, margin:center?'0 auto':0 }}>{sub}</p>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LandingPage({ onLogin }) {
  const mobile = useMobile()
  const [notices, setNotices] = useState([])
  const [results, setResults] = useState([])
  const [events,  setEvents]  = useState([])
  const [gallery, setGallery] = useState([])
  const [lN,setLN]=useState(true), [lR,setLR]=useState(true), [lE,setLE]=useState(true), [lG,setLG]=useState(true)
  const [preview,  setPreview]  = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showTop,  setShowTop]  = useState(false)
  const [cookie,   setCookie]   = useState(false)
  const [notif,    setNotif]    = useState(true)
  const [splash,   setSplash]   = useState(true)
  const [privacy,  setPrivacy]  = useState(false)
  const [ticker,   setTicker]   = useState(false)
  const [pwa,      setPwa]      = useState(null)
  const [enq, setEnq] = useState({ name:'', phone:'', class_interest:'', message:'' })
  const [sending, setSending] = useState(false)
  const [sent,    setSent]    = useState(false)
  const statsRef  = useRef()
  const statsInView = useInView(statsRef, 0.2)
  const [views] = useState(() => Math.floor(Math.random()*600)+900)

  useEffect(() => { setTimeout(()=>setSplash(false), 1800) }, [])
  useEffect(() => { if (!localStorage.getItem('gnsi_cookie')) setTimeout(()=>setCookie(true),2800) }, [])
  useEffect(() => {
    const h = e => { e.preventDefault(); setPwa(e) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('notices').select('*').eq('is_public',true).eq('status','Published').or(`expiry_date.is.null,expiry_date.gte.${today}`).order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(6).then(({data,error})=>{ if(!error) setNotices(data||[]); setLN(false) })
    supabase.from('yearly_results').select('*').order('display_order',{ascending:true}).then(({data,error})=>{ if(!error) setResults(data||[]); setLR(false) })
    supabase.from('events').select('*').eq('is_public',true).gte('event_date',today).order('event_date',{ascending:true}).limit(5).then(({data,error})=>{ if(!error) setEvents(data||[]); setLE(false) })
    supabase.from('social_posts').select('*').eq('is_public',true).order('created_at',{ascending:false}).limit(6).then(({data,error})=>{ if(!error) setGallery(data||[]); setLG(false) })
  }, [])
  useEffect(() => {
    const h = () => { setScrolled(window.scrollY>50); setShowTop(window.scrollY>700) }
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const go = id => { document.getElementById(id)?.scrollIntoView({behavior:'smooth'}); setMenuOpen(false) }
  const acceptC = () => { localStorage.setItem('gnsi_cookie','1'); setCookie(false) }
  const declineC = () => { localStorage.setItem('gnsi_cookie','0'); setCookie(false) }
  const handleEnq = async e => {
    e.preventDefault()
    setSending(true)
    try { await supabase.from('enquiries').insert([{...enq,source:'Landing Page',status:'New'}]); setSent(true); setEnq({name:'',phone:'',class_interest:'',message:''}) } catch{}
    setSending(false)
  }
  const installPwa = async () => { if(!pwa) return; pwa.prompt(); const {outcome}=await pwa.userChoice; if(outcome==='accepted') setPwa(null) }
  const fmtDate = d => { const dt=new Date(d); return { day:dt.getDate().toString().padStart(2,'0'), month:dt.toLocaleString('en-IN',{month:'short'}) } }

  const TICKER_ITEMS = ['📢 Admissions Open 2026-27','🏆 66 Selected in NVS & Sainik 2025-26','📅 Summer Batch June 1','📝 Mock Tests Every Sunday','🎓 10+ Years · 200+ Officers','📞 +91 89742 98074']

  // Style helpers
  const card = (x={}) => ({ background:`linear-gradient(145deg,${C.navy3},${C.navy2})`, border:`1px solid rgba(212,168,67,0.1)`, borderRadius:20, padding:'1.5rem', transition:'all 0.3s', ...x })
  const inp = { width:'100%', padding:'13px 18px', borderRadius:12, border:`1px solid rgba(212,168,67,0.15)`, background:'rgba(255,255,255,0.04)', color:'#fff', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box', transition:'border-color 0.2s' }
  const btnG = { display:'inline-flex', alignItems:'center', gap:8, background:`linear-gradient(135deg,${C.gold},${C.goldD})`, color:C.navy, padding:'0.95rem 2.2rem', borderRadius:50, fontWeight:800, fontSize:'1rem', border:'none', cursor:'pointer', boxShadow:`0 8px 32px rgba(212,168,67,0.35)`, transition:'all 0.25s', fontFamily:'inherit', letterSpacing:'0.02em' }
  const btnO = { display:'inline-flex', alignItems:'center', gap:8, background:'transparent', color:'#fff', padding:'0.95rem 2rem', borderRadius:50, border:`1px solid rgba(255,255,255,0.18)`, fontWeight:500, fontSize:'1rem', cursor:'pointer', fontFamily:'inherit', transition:'all 0.25s' }
  const tagColor = { green:['rgba(46,204,138,0.15)',C.green], blue:['rgba(74,158,240,0.15)',C.blue], gold:[`rgba(212,168,67,0.15)`,C.gold], red:['rgba(232,68,58,0.15)',C.red], purple:['rgba(139,92,246,0.15)',C.purple] }

  if (privacy) return <PrivacyPolicy onBack={()=>setPrivacy(false)} />
  if (splash)  return <Splash />

  return (
    <div style={{ background:C.navy, color:'#fff', minHeight:'100vh', fontFamily:"'DM Sans','Segoe UI',sans-serif", overflowX:'hidden' }}>
      <SEOHead />

      {/* ── GLOBAL CSS ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes ticker{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(0.8);opacity:0.5}}
        @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes float{0%,100%{transform:translateY(0) rotate(0deg)}33%{transform:translateY(-12px) rotate(2deg)}66%{transform:translateY(-6px) rotate(-1deg)}}
        @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(212,168,67,0.2)}50%{box-shadow:0 0 40px rgba(212,168,67,0.5)}}
        @keyframes splashPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @keyframes splashRing{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.4)}}
        @keyframes loadBar{0%{width:0}100%{width:100%}}
        @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        .gnsi-nav-links{display:none!important}
        .gnsi-menu-btn{display:block!important}
        @media(min-width:769px){.gnsi-nav-links{display:flex!important}.gnsi-menu-btn{display:none!important}}
        .hov:hover{border-color:rgba(212,168,67,0.3)!important;transform:translateY(-5px)!important;box-shadow:0 20px 60px rgba(0,0,0,0.4)!important}
        .hov-x:hover{border-color:rgba(212,168,67,0.25)!important;transform:translateX(6px)!important}
        .btn-g:hover{transform:translateY(-2px)!important;box-shadow:0 16px 48px rgba(212,168,67,0.5)!important}
        .btn-o:hover{border-color:${C.gold}!important;color:${C.gold}!important}
        input:focus,textarea:focus,select:focus{border-color:rgba(212,168,67,0.5)!important;box-shadow:0 0 0 3px rgba(212,168,67,0.08)!important}
        input::placeholder,textarea::placeholder{color:rgba(255,255,255,0.25)}
        select option{background:#071428;color:#fff}
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(212,168,67,0.25);border-radius:3px}
        html{scroll-behavior:smooth}
        *{box-sizing:border-box;margin:0;padding:0}
      `}</style>

      {/* ── NOTIF BAR ── */}
      {notif && !localStorage.getItem('gnsi_notif') && (
        <NotifBar onDismiss={()=>{ setNotif(false); localStorage.setItem('gnsi_notif','1') }} />
      )}

      {/* ── TICKER ── */}
      <div style={{ background:`linear-gradient(90deg,${C.goldD},${C.gold},${C.goldD})`, padding:'7px 0', overflow:'hidden' }}
        onMouseEnter={()=>setTicker(true)} onMouseLeave={()=>setTicker(false)}>
        <div style={{ display:'flex', gap:'5rem', whiteSpace:'nowrap', animation:`ticker ${ticker?'none':'28s'} linear infinite` }}>
          {[...TICKER_ITEMS,...TICKER_ITEMS].map((t,i)=><span key={i} style={{ fontSize:'0.76rem', fontWeight:700, color:C.navy, flexShrink:0, letterSpacing:'0.04em' }}>{t}</span>)}
        </div>
      </div>

      {/* ── NAV ── */}
      <nav style={{ position:'sticky', top:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.85rem 5%', background:scrolled?'rgba(4,13,30,0.97)':'rgba(4,13,30,0.88)', backdropFilter:'blur(24px)', borderBottom:`1px solid rgba(212,168,67,${scrolled?0.2:0.08})`, transition:'all 0.4s', boxShadow:scrolled?`0 8px 40px rgba(0,0,0,0.5)`:'' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:42, height:42, background:`linear-gradient(135deg,${C.navy4},${C.navy3})`, border:`1.5px solid ${C.gold}`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Playfair Display',serif", fontWeight:900, color:C.gold, fontSize:'1.1rem', boxShadow:`0 4px 16px rgba(212,168,67,0.2)` }}>G</div>
          <div>
            <div style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'1.05rem', fontWeight:800, color:C.goldL, lineHeight:1.2, letterSpacing:'0.01em' }}>GNSI Portal</div>
            <span style={{ fontSize:'0.58rem', color:C.muted, letterSpacing:'0.12em', textTransform:'uppercase', display:'block' }}>Khangabok, Manipur</span>
          </div>
        </div>
        <ul className="gnsi-nav-links" style={{ display:'flex', alignItems:'center', gap:'1.4rem', listStyle:'none' }}>
          {[['notices','Notices'],['results','Results'],['gallery','Gallery'],['events','Events'],['enquiry','Enquire'],['contact','Contact']].map(([id,label])=>(
            <li key={id}><button onClick={()=>go(id)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', fontSize:'0.84rem', cursor:'pointer', fontFamily:'inherit', fontWeight:500, transition:'color 0.2s' }} onMouseEnter={e=>e.target.style.color=C.goldL} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.7)'}>{label}</button></li>
          ))}
          <li><button onClick={onLogin} style={{ background:`linear-gradient(135deg,${C.gold},${C.goldD})`, color:C.navy, padding:'0.5rem 1.4rem', borderRadius:50, fontWeight:800, fontSize:'0.84rem', border:'none', cursor:'pointer', fontFamily:'inherit', boxShadow:`0 4px 16px rgba(212,168,67,0.3)` }}>Login →</button></li>
        </ul>
        <button className="gnsi-menu-btn" onClick={()=>setMenuOpen(v=>!v)} style={{ background:'rgba(255,255,255,0.06)', border:`1px solid rgba(255,255,255,0.1)`, color:'#fff', borderRadius:10, padding:'8px 12px', cursor:'pointer', fontSize:18 }}>{menuOpen?'✕':'☰'}</button>
      </nav>

      {/* Mobile Menu */}
      {menuOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(4,13,30,0.98)', zIndex:200, padding:'5rem 6% 3rem', overflowY:'auto', backdropFilter:'blur(20px)' }}>
          <button onClick={()=>setMenuOpen(false)} style={{ position:'absolute', top:20, right:24, background:'rgba(255,255,255,0.08)', border:`1px solid rgba(255,255,255,0.1)`, color:'#fff', borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:20 }}>✕</button>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem', color:C.goldL, marginBottom:'2rem', fontWeight:800 }}>GNSI Portal</div>
          {[['notices','📢 Notices'],['results','🏆 Results'],['gallery','📸 Gallery'],['events','📅 Events'],['enquiry','✏️ Enquire'],['contact','📍 Contact']].map(([id,label])=>(
            <button key={id} onClick={()=>go(id)} style={{ display:'block', width:'100%', textAlign:'left', background:'none', border:'none', borderBottom:`1px solid rgba(255,255,255,0.06)`, color:'rgba(255,255,255,0.85)', padding:'16px 0', fontSize:17, cursor:'pointer', fontFamily:'inherit' }}>{label}</button>
          ))}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:24 }}>
            <button onClick={onLogin} style={{ ...btnG, justifyContent:'center', borderRadius:14 }}>Login →</button>
            <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:C.wa, color:'#fff', borderRadius:14, fontWeight:700, textDecoration:'none', fontSize:'0.95rem' }}>💬 WA</a>
          </div>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ minHeight:'100vh', display:'flex', alignItems:'center', padding:'5rem 5% 4rem', position:'relative', overflow:'hidden' }}>
        {/* BG layers */}
        <div style={{ position:'absolute', inset:0, background:`radial-gradient(ellipse 80% 70% at 65% 40%,rgba(139,92,246,0.08) 0%,transparent 55%),radial-gradient(ellipse 60% 80% at 20% 60%,rgba(74,158,240,0.07) 0%,transparent 55%),radial-gradient(ellipse 50% 50% at 80% 80%,rgba(212,168,67,0.06) 0%,transparent 50%)` }} />
        <div style={{ position:'absolute', inset:0, backgroundImage:`radial-gradient(circle at 1px 1px, rgba(212,168,67,0.08) 1px, transparent 0)`, backgroundSize:'40px 40px' }} />
        {/* Floating orbs */}
        <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:`radial-gradient(circle,rgba(139,92,246,0.06) 0%,transparent 70%)`, top:-100, right:-100, pointerEvents:'none' }} />
        <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:`radial-gradient(circle,rgba(74,158,240,0.06) 0%,transparent 70%)`, bottom:-80, left:-80, pointerEvents:'none' }} />

        <div style={{ position:'relative', zIndex:2, maxWidth:700, animation:'fadeUp 0.9s ease both' }}>
          {/* Live badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(46,204,138,0.1)', border:`1px solid rgba(46,204,138,0.2)`, color:C.green, fontSize:'0.72rem', padding:'0.38rem 1rem', borderRadius:50, marginBottom:'1.2rem', fontWeight:600 }}>
            <span style={{ width:7, height:7, background:C.green, borderRadius:'50%', animation:'pulse 2s infinite', display:'inline-block' }} />
            {views.toLocaleString()} people visited this month
          </div>

          {/* Trust badge */}
          <div style={{ display:'inline-flex', alignItems:'center', gap:10, background:`rgba(212,168,67,0.1)`, border:`1px solid rgba(212,168,67,0.25)`, color:C.goldL, fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', padding:'0.42rem 1.1rem', borderRadius:50, marginBottom:'1.8rem', marginLeft:8 }}>
            ✦ Trusted since 2016 · Manipur's #1 Coaching Institute
          </div>

          <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:'clamp(3rem,6.5vw,5.5rem)', fontWeight:900, lineHeight:1.04, marginBottom:'1.6rem', letterSpacing:'-0.01em' }}>
            Shape Your Future<br />
            <span style={{ background:`linear-gradient(135deg,${C.gold},${C.goldL},${C.gold})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', backgroundSize:'200% 200%', animation:'gradientShift 3s ease infinite' }}>as a Future Officer</span>
          </h1>

          <p style={{ fontSize:'1.08rem', lineHeight:1.85, color:'rgba(255,255,255,0.6)', maxWidth:540, marginBottom:'2.8rem', fontWeight:300 }}>
            Guidance Navodaya & Sainik Institute — Khangabok's premier coaching centre for Navodaya, Sainik, and RMS entrance examination preparation. Over <strong style={{ color:'rgba(255,255,255,0.9)', fontWeight:600 }}>200 officers produced</strong> in 10 years.
          </p>

          <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'2rem' }}>
            <button onClick={()=>go('enquiry')} style={btnG} className="btn-g">✏️ Enquire Now →</button>
            <button onClick={onLogin} style={btnO} className="btn-o">Staff Login</button>
            <a href={`https://wa.me/${WA}?text=Hello, enquiring about GNSI admissions`} target="_blank" rel="noreferrer"
              style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(37,211,102,0.15)', border:`1px solid rgba(37,211,102,0.3)`, color:C.wa, padding:'0.95rem 1.6rem', borderRadius:50, fontWeight:600, fontSize:'1rem', textDecoration:'none', transition:'all 0.25s' }}>
              💬 WhatsApp
            </a>
          </div>

          {/* Trust badges */}
          <div style={{ display:'flex', gap:'0.6rem', flexWrap:'wrap' }}>
            {[['✅','95% Selection'],['🏆','10+ Years'],['🛡️','Safe Hostel'],['📱','Digital ERP'],['🔒','SSL Secured']].map(([icon,label])=>(
              <span key={label} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:'0.72rem', background:'rgba(255,255,255,0.05)', border:`1px solid rgba(255,255,255,0.08)`, borderRadius:50, padding:'0.32rem 0.8rem', color:'rgba(255,255,255,0.65)', fontWeight:500 }}>{icon} {label}</span>
            ))}
          </div>

          {pwa && (
            <button onClick={installPwa} style={{ marginTop:'1.5rem', display:'inline-flex', alignItems:'center', gap:8, background:'rgba(212,168,67,0.1)', border:`1px solid rgba(212,168,67,0.25)`, color:C.goldL, padding:'0.6rem 1.3rem', borderRadius:50, fontSize:'0.82rem', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
              📱 Add to Home Screen
            </button>
          )}
        </div>

        {/* Hero decoration */}
        {!mobile && (
          <div style={{ position:'absolute', right:'5%', top:'50%', transform:'translateY(-50%)', width:320, animation:'float 6s ease-in-out infinite' }}>
            <div style={{ background:`linear-gradient(145deg,${C.navy3},${C.navy2})`, border:`1px solid rgba(212,168,67,0.15)`, borderRadius:24, padding:'1.8rem', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
              <div style={{ fontSize:'0.7rem', color:C.muted, letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:'1.2rem', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:6, height:6, background:C.green, borderRadius:'50%', animation:'pulse 2s infinite', display:'inline-block' }} />Live Dashboard
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:'1.2rem' }}>
                {[['387','Students',C.blue],['24','Staff',C.purple],['98%','Present',C.green]].map(([n,l,c])=>(
                  <div key={l} style={{ background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'0.8rem 0.5rem', textAlign:'center', border:`1px solid rgba(255,255,255,0.06)` }}>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem', fontWeight:700, color:c, lineHeight:1 }}>{n}</div>
                    <div style={{ fontSize:'0.65rem', color:C.muted, marginTop:4 }}>{l}</div>
                  </div>
                ))}
              </div>
              {[['Fee Collected','₹2.4L this month',C.green],['Upcoming Exams','3 scheduled',C.gold],['New Enquiries','12 this week',C.blue]].map(([label,val,c])=>(
                <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0.6rem 0', borderBottom:`1px solid rgba(255,255,255,0.05)`, fontSize:'0.8rem' }}>
                  <span style={{ color:'rgba(255,255,255,0.6)' }}>{label}</span>
                  <span style={{ color:c, fontWeight:600 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── STATS ── */}
      <div ref={statsRef} style={{ padding:'3rem 5%', background:`linear-gradient(90deg,${C.navy2},${C.navy3},${C.navy2})`, borderTop:`1px solid rgba(212,168,67,0.08)`, borderBottom:`1px solid rgba(212,168,67,0.08)`, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:'2rem', textAlign:'center' }}>
        {[{n:10,s:'+',l:'Years',c:C.gold},{n:500,s:'+',l:'Students',c:C.blue},{n:95,s:'%',l:'Selection',c:C.green},{n:200,s:'+',l:'Officers',c:C.purple},{n:15,s:'+',l:'Modules',c:C.goldL}].map(({n,s,l,c})=>(
          <div key={l}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'2.6rem', fontWeight:900, color:c, lineHeight:1, textShadow:`0 0 30px ${c}40` }}><Counter value={n} suffix={s} /></div>
            <div style={{ fontSize:'0.78rem', color:C.muted, marginTop:8, fontWeight:500, letterSpacing:'0.05em' }}>{l}</div>
          </div>
        ))}
      </div>

      {/* ── PROGRESS BARS ── */}
      <section style={{ padding:'5.5rem 5%', background:C.navy }}>
        <SH label="Our Strength" title="Why students choose GNSI" sub="A decade of proven results, expert faculty, and holistic development." />
        <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'1fr 1fr', gap:'3rem' }}>
          <div>
            {[['NVS Selection Rate',94,C.green],['Sainik School Rate',88,C.blue],['Student Satisfaction',98,C.gold],['Hostel Occupancy',92,C.purple],['Faculty Rating',96,C.goldL]].map(([label,pct,c])=>(
              <div key={label} style={{ marginBottom:'1.6rem' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.85rem', marginBottom:8 }}>
                  <span style={{ color:'rgba(255,255,255,0.8)', fontWeight:500 }}>{label}</span>
                  <span style={{ color:c, fontWeight:700 }}>{pct}%</span>
                </div>
                <div style={{ height:7, background:'rgba(255,255,255,0.06)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:99, background:`linear-gradient(90deg,${c},${c}aa)`, width:statsInView?`${pct}%`:'0%', transition:'width 1.8s cubic-bezier(0.4,0,0.2,1)', boxShadow:`0 0 10px ${c}60` }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', alignContent:'start' }}>
            {[['🏫',C.blue,'Est. 2016','A decade of excellence'],['👨‍🎓',C.green,'500+ Alumni','Across Manipur & beyond'],['🏆',C.gold,'#1 Rated','In Thoubal District'],['📱',C.purple,'Digital ERP','Custom-built portal']].map(([icon,c,label,desc])=>(
              <div key={label} className="hov" style={{ ...card({ textAlign:'center', padding:'1.6rem 1rem', borderTop:`2px solid ${c}40` }) }}>
                <div style={{ fontSize:'1.8rem', marginBottom:'0.7rem' }}>{icon}</div>
                <div style={{ fontSize:'0.88rem', fontWeight:700, marginBottom:4, color:'rgba(255,255,255,0.95)' }}>{label}</div>
                <div style={{ fontSize:'0.72rem', color:C.muted }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NOTICES ── */}
      <section id="notices" style={{ padding:'5.5rem 5%', background:C.navy2 }}>
        <SH label="Notice Board" title="Latest Announcements" sub="Stay updated with admissions, exams, and events from GNSI." />
        {lN
          ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1.2rem' }}>{[1,2,3,4].map(i=><Sk key={i} h={170}/>)}</div>
          : notices.length===0
            ? <div style={{ textAlign:'center', color:C.muted, padding:'4rem', ...card({ maxWidth:400, margin:'0 auto' }) }}><div style={{ fontSize:'3rem', marginBottom:16 }}>📢</div>No public notices right now.</div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'1.2rem' }}>
                {notices.map(n=>{
                  const bC = n.priority==='Urgent'?C.red:n.priority==='Important'?C.gold:C.blue
                  return (
                    <div key={n.id} onClick={()=>setPreview(n)} className="hov"
                      style={{ ...card({ borderTop:`3px solid ${bC}`, cursor:'pointer', position:'relative' }) }}>
                      {n.pinned && <span style={{ position:'absolute', top:12, right:12, fontSize:16 }}>📌</span>}
                      <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                        <span style={{ fontSize:10, padding:'3px 10px', borderRadius:99, fontWeight:700, background:`${bC}20`, color:bC }}>{n.priority}</span>
                        <span style={{ fontSize:10, padding:'3px 10px', borderRadius:99, fontWeight:700, background:'rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.7)' }}>{n.category}</span>
                      </div>
                      <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', fontWeight:700, color:'#fff', marginBottom:8, lineHeight:1.4, paddingRight:n.pinned?28:0 }}>{n.title}</h3>
                      <p style={{ fontSize:'0.82rem', color:C.muted, lineHeight:1.65, marginBottom:14, display:'-webkit-box', WebkitLineClamp:3, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{n.description}</p>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.72rem', color:C.muted, borderTop:`1px solid rgba(255,255,255,0.06)`, paddingTop:10 }}>
                        <span>📅 {n.publish_date||'—'}</span>
                        <span style={{ color:C.goldL, fontWeight:600 }}>Read more →</span>
                      </div>
                    </div>
                  )
                })}
              </div>}
      </section>

      {/* ── RESULTS ── */}
      <section id="results" style={{ padding:'5.5rem 5%', background:C.navy }}>
        <SH label="Our Results" title="Year-wise Selections" sub="Consistently clearing Navodaya, Sainik and RMS with outstanding ranks." />
        {lR
          ? <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1.2rem' }}>{[1,2,3,4].map(i=><Sk key={i} h={150}/>)}</div>
          : results.length===0
            ? <div style={{ textAlign:'center', color:C.muted, padding:'4rem', ...card() }}><div style={{ fontSize:'3rem', marginBottom:16 }}>🏆</div>Results coming soon.</div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'1.2rem' }}>
                {results.map((r,i)=>{
                  const cs=[C.gold,C.blue,C.green,C.purple][i%4]
                  return (
                    <div key={r.id} className="hov" style={{ ...card({ textAlign:'center', position:'relative', overflow:'hidden' }) }}>
                      <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:`linear-gradient(90deg,${cs},${cs}44)` }} />
                      <div style={{ position:'absolute', top:-30, right:-30, width:100, height:100, borderRadius:'50%', background:`radial-gradient(circle,${cs}15,transparent)` }} />
                      <div style={{ fontSize:'0.68rem', color:C.muted, letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:'0.6rem', fontWeight:600 }}>{r.year}</div>
                      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'3.2rem', fontWeight:900, color:cs, lineHeight:1, textShadow:`0 0 30px ${cs}50` }}>{r.total_selections}</div>
                      <div style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.7)', marginTop:8, fontWeight:500 }}>Total Selections</div>
                      <div style={{ fontSize:'0.73rem', color:C.muted, marginTop:6 }}>
                        {r.nvs_count>0&&`${r.nvs_count} NVS`}{r.nvs_count>0&&r.sainik_count>0&&' · '}{r.sainik_count>0&&`${r.sainik_count} Sainik`}{r.rms_count>0&&` · ${r.rms_count} RMS`}
                      </div>
                    </div>
                  )
                })}
              </div>}
      </section>

      {/* ── GALLERY ── */}
      <section id="gallery" style={{ padding:'5.5rem 5%', background:C.navy2 }}>
        <SH label="Photo Gallery" title="Life at GNSI" sub="Campus, classrooms, events and proud moments of our students." />
        {lG
          ? <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'1rem' }}>{[1,2,3].map(i=><Sk key={i} h={200}/>)}</div>
          : gallery.length===0
            ? <div style={{ display:'grid', gridTemplateColumns:mobile?'repeat(2,1fr)':'repeat(4,1fr)', gap:'1rem' }}>
                {[{s:mobile?2:2,h:mobile?180:280,icon:'🏫',label:'GNSI Campus',c:C.blue},{s:1,h:130,icon:'📚',label:'Study Hall',c:C.purple},{s:1,h:130,icon:'🏆',label:'Prize Day',c:C.gold},{s:1,h:130,icon:'👨‍🎓',label:'Selections',c:C.green},{s:1,h:130,icon:'⚽',label:'Sports',c:C.red}].map((item,i)=>(
                  <div key={i} style={{ gridColumn:`span ${item.s}`, ...card({ padding:0, minHeight:item.h, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, borderTop:`2px solid ${item.c}40` }) }}>
                    <span style={{ fontSize:item.s===2?'3rem':'2rem' }}>{item.icon}</span>
                    <span style={{ fontSize:'0.78rem', color:C.muted, fontWeight:500 }}>{item.label}</span>
                  </div>
                ))}
              </div>
            : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'1rem' }}>
                {gallery.map((post,i)=>(
                  <div key={post.id} onClick={()=>post.image_url&&setLightbox({img:post.image_url,caption:post.caption||post.title})}
                    style={{ ...card({ padding:0, overflow:'hidden', position:'relative', minHeight:180, gridColumn:i===0?'span 2':'span 1', cursor:post.image_url?'zoom-in':'default', transition:'all 0.3s' }) }}
                    onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.02)';e.currentTarget.style.boxShadow='0 20px 60px rgba(0,0,0,0.5)'}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.boxShadow=''}}>
                    {post.image_url
                      ? <img src={post.image_url} alt={post.caption||post.title} loading="lazy" style={{ width:'100%', height:'100%', minHeight:180, objectFit:'cover', display:'block' }} />
                      : <div style={{ width:'100%', minHeight:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}><span style={{ fontSize:'2.5rem' }}>📸</span><span style={{ fontSize:'0.78rem', color:C.muted }}>{post.content_type}</span></div>}
                    <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(4,13,30,0.85) 0%,transparent 55%)', display:'flex', alignItems:'flex-end', padding:'1.2rem' }}>
                      <div><div style={{ fontSize:'0.84rem', fontWeight:600, color:'#fff' }}>{post.caption||post.title}</div><div style={{ fontSize:'0.7rem', color:C.muted }}>{post.platform} · {post.post_date}</div></div>
                    </div>
                  </div>
                ))}
              </div>}
        <p style={{ textAlign:'center', color:C.muted, fontSize:'0.78rem', marginTop:'1.5rem' }}>📸 Manage photos from Social module · Mark posts as public to appear here</p>
      </section>

      {/* ── EVENTS ── */}
      <section id="events" style={{ padding:'5.5rem 5%', background:C.navy }}>
        <SH label="Upcoming Events" title="Mark Your Calendar" />
        {lE
          ? <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>{[1,2,3].map(i=><Sk key={i} h={100}/>)}</div>
          : events.length===0
            ? <div style={{ textAlign:'center', color:C.muted, padding:'4rem', ...card() }}><div style={{ fontSize:'3rem', marginBottom:16 }}>📅</div>No upcoming events.</div>
            : <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                {events.map((ev,i)=>{
                  const {day,month}=fmtDate(ev.event_date)
                  const [tBg,tC]=(tagColor[ev.tag_color]||tagColor.blue)
                  const accents=[C.blue,C.purple,C.gold,C.green,C.red]
                  const ac=accents[i%accents.length]
                  return (
                    <div key={ev.id} className="hov-x" style={{ ...card({ display:'flex', gap:'1.5rem', alignItems:'flex-start', borderLeft:`3px solid ${ac}` }) }}>
                      <div style={{ minWidth:60, textAlign:'center', background:`${ac}15`, border:`1px solid ${ac}40`, borderRadius:14, padding:'0.8rem 0.6rem', flexShrink:0 }}>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.8rem', fontWeight:900, color:ac, lineHeight:1 }}>{day}</div>
                        <div style={{ fontSize:'0.62rem', textTransform:'uppercase', letterSpacing:'0.1em', color:C.muted, marginTop:3 }}>{month}</div>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1rem', fontWeight:700, marginBottom:5, color:'#fff' }}>{ev.title}</div>
                        {ev.description && <div style={{ fontSize:'0.82rem', color:C.muted, lineHeight:1.6, marginBottom:10 }}>{ev.description}</div>}
                        <span style={{ fontSize:'0.68rem', padding:'3px 10px', borderRadius:99, fontWeight:700, background:tBg, color:tC }}>{ev.tag}</span>
                      </div>
                    </div>
                  )
                })}
              </div>}
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding:'5.5rem 5%', background:C.navy2 }}>
        <SH label="Testimonials" title="What Parents & Students Say" center />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1.2rem' }}>
          {[{i:'RD',name:'Romen Devi',sub:'Parent · Thoubal',text:'"My son got selected in NVS Class 6 after just one year at GNSI. Dedicated teachers, excellent study material — results speak for themselves."',c:C.blue},
            {i:'KS',name:'Kiran Singh',sub:'Parent · Imphal',text:'"The hostel is clean and safe. GNSI gave my daughter the discipline to crack Sainik School on her very first attempt. We are grateful."',c:C.purple},
            {i:'BM',name:'Bikash Meetei',sub:'NVS Selected 2025',text:'"Weekly mock tests helped me identify weak areas and improve fast. I got selected in NVS — GNSI made my dream possible."',c:C.gold}
          ].map(t=>(
            <div key={t.name} className="hov" style={{ ...card({ borderTop:`3px solid ${t.c}60`, position:'relative', overflow:'hidden' }) }}>
              <div style={{ position:'absolute', top:-20, right:-20, width:80, height:80, borderRadius:'50%', background:`radial-gradient(circle,${t.c}12,transparent)` }} />
              <div style={{ color:C.gold, fontSize:'1rem', letterSpacing:3, marginBottom:'1rem' }}>★★★★★</div>
              <p style={{ fontSize:'0.88rem', color:'rgba(255,255,255,0.65)', lineHeight:1.8, fontStyle:'italic', marginBottom:'1.4rem' }}>{t.text}</p>
              <div style={{ display:'flex', alignItems:'center', gap:12, borderTop:`1px solid rgba(255,255,255,0.06)`, paddingTop:14 }}>
                <div style={{ width:42, height:42, borderRadius:'50%', background:`${t.c}20`, border:`1.5px solid ${t.c}50`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'0.9rem', color:t.c, fontFamily:"'Playfair Display',serif" }}>{t.i}</div>
                <div><div style={{ fontSize:'0.9rem', fontWeight:600, color:'rgba(255,255,255,0.9)' }}>{t.name}</div><div style={{ fontSize:'0.72rem', color:C.muted }}>{t.sub}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FACILITIES ── */}
      <section style={{ padding:'5.5rem 5%', background:C.navy }}>
        <SH label="Our Facilities" title="Everything for Your Child's Success" center />
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1.2rem' }}>
          {[['🏠',C.blue,'Boarding Hostel','Safe, clean 24/7 supervised hostel for outstation students.'],['📚',C.purple,'Study Hall','Dedicated quiet area with proper lighting for focused prep.'],['🍽️',C.green,'Mess & Nutrition','Balanced nutritious meals three times daily for hostel students.'],['⚽',C.red,'Sports Ground','Outdoor area essential for Sainik School physical requirements.'],['👨‍🏫',C.gold,'Expert Faculty','Specialists in NVS and Sainik School exam syllabus.'],['📱',C.goldL,'Digital Portal','Parents track fees, attendance and marks anytime, anywhere.']].map(([icon,c,name,desc])=>(
            <div key={name} className="hov" style={{ ...card({ textAlign:'center', borderTop:`2px solid ${c}40` }) }}>
              <div style={{ width:54, height:54, borderRadius:14, background:`${c}15`, border:`1px solid ${c}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', margin:'0 auto 1rem', boxShadow:`0 0 20px ${c}20` }}>{icon}</div>
              <div style={{ fontSize:'0.92rem', fontWeight:700, marginBottom:6, color:'rgba(255,255,255,0.95)' }}>{name}</div>
              <div style={{ fontSize:'0.78rem', color:C.muted, lineHeight:1.65 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── VIDEO ── */}
      {YT && (
        <section style={{ padding:'5.5rem 5%', background:C.navy2 }}>
          <SH label="See GNSI" title="Watch Our Institute" center />
          <div style={{ borderRadius:24, overflow:'hidden', border:`1px solid rgba(212,168,67,0.15)`, maxWidth:820, margin:'0 auto', aspectRatio:'16/9', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${YT}`} title="GNSI" frameBorder="0" allowFullScreen style={{ display:'block' }} />
          </div>
        </section>
      )}

      {/* ── ENQUIRY ── */}
      <section id="enquiry" style={{ padding:'5.5rem 5%', background:C.navy2 }}>
        <SH label="Get in Touch" title="Send an Enquiry" sub="Fill the form and our team will call you back within 24 hours." />
        <div style={{ display:'grid', gridTemplateColumns:mobile?'1fr':'1fr 1fr', gap:'3rem', alignItems:'start', maxWidth:920 }}>
          <div style={{ ...card({ border:`1px solid rgba(212,168,67,0.2)`, position:'relative', overflow:'hidden' }) }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:`linear-gradient(90deg,${C.gold},${C.blue},${C.purple})` }} />
            {sent
              ? <div style={{ textAlign:'center', padding:'2.5rem 0' }}>
                  <div style={{ fontSize:'3.5rem', marginBottom:'1.2rem', animation:'bounce 1s infinite' }}>✅</div>
                  <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.4rem', color:C.goldL, marginBottom:'0.6rem' }}>Enquiry Sent!</h3>
                  <p style={{ color:C.muted, fontSize:'0.9rem', lineHeight:1.7 }}>Our team will call you back within 24 hours.</p>
                  <button onClick={()=>setSent(false)} style={{ marginTop:'1.5rem', background:'rgba(212,168,67,0.12)', border:`1px solid rgba(212,168,67,0.25)`, color:C.goldL, padding:'0.6rem 1.6rem', borderRadius:50, cursor:'pointer', fontSize:'0.85rem', fontFamily:'inherit', fontWeight:600 }}>Send Another</button>
                </div>
              : <form onSubmit={handleEnq}>
                  <h3 style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.3rem', color:'#fff', marginBottom:'1.6rem', fontWeight:800 }}>Admission Enquiry</h3>
                  <div style={{ display:'flex', flexDirection:'column', gap:'1.1rem' }}>
                    {[['name','Student / Parent Name *','Full name',true],['phone','Phone Number *','+91 XXXXX XXXXX',true]].map(([f,l,p,r])=>(
                      <div key={f}>
                        <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.muted, marginBottom:7, textTransform:'uppercase', letterSpacing:'0.08em' }}>{l}</label>
                        <input style={inp} placeholder={p} required={r} value={enq[f]} onChange={e=>setEnq({...enq,[f]:e.target.value})} />
                      </div>
                    ))}
                    <div>
                      <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.muted, marginBottom:7, textTransform:'uppercase', letterSpacing:'0.08em' }}>Class Interest</label>
                      <select style={{ ...inp, cursor:'pointer' }} value={enq.class_interest} onChange={e=>setEnq({...enq,class_interest:e.target.value})}>
                        <option value="">Select class…</option>
                        {['NVS Class 6','NVS Class 9','Sainik School Class 6','Sainik School Class 9','RMS','Other'].map(c=><option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display:'block', fontSize:'0.7rem', fontWeight:700, color:C.muted, marginBottom:7, textTransform:'uppercase', letterSpacing:'0.08em' }}>Message (optional)</label>
                      <textarea rows={3} style={{ ...inp, resize:'vertical' }} placeholder="Any questions?" value={enq.message} onChange={e=>setEnq({...enq,message:e.target.value})} />
                    </div>
                    <button type="submit" disabled={sending} style={{ ...btnG, width:'100%', justifyContent:'center', opacity:sending?0.7:1 }} className="btn-g">
                      {sending?'⏳ Sending…':'📨 Send Enquiry'}
                    </button>
                    <p style={{ fontSize:'0.7rem', color:'rgba(255,255,255,0.3)', textAlign:'center' }}>
                      By submitting you agree to our <button onClick={()=>setPrivacy(true)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', textDecoration:'underline', fontSize:'0.7rem', fontFamily:'inherit', padding:0 }}>Privacy Policy</button>
                    </p>
                  </div>
                </form>}
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {[['📍',C.blue,'Address','Khangabok Sorok Wangma, Near Community Hall, Thoubal, Manipur — 795138'],['📞',C.green,'Phone','+91 89742 98074'],['🕐',C.gold,'Office Hours','Mon–Sat: 8:00 AM – 6:00 PM'],['🌐',C.purple,'Portal','gnsi-erp.vercel.app']].map(([icon,c,label,val])=>(
              <div key={label} className="hov" style={{ ...card({ display:'flex', gap:'1rem', alignItems:'flex-start', borderLeft:`3px solid ${c}60` }) }}>
                <div style={{ width:40, height:40, borderRadius:10, background:`${c}15`, border:`1px solid ${c}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', flexShrink:0 }}>{icon}</div>
                <div><div style={{ fontSize:'0.7rem', color:C.muted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:600 }}>{label}</div><div style={{ fontSize:'0.9rem', fontWeight:500, color:'rgba(255,255,255,0.9)' }}>{val}</div></div>
              </div>
            ))}
            <a href={`https://wa.me/${WA}?text=Hello, enquiring about GNSI admissions`} target="_blank" rel="noreferrer"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, background:`linear-gradient(135deg,rgba(37,211,102,0.2),rgba(37,211,102,0.1))`, border:`1px solid rgba(37,211,102,0.3)`, color:C.wa, padding:'1rem 1.5rem', borderRadius:16, fontWeight:700, fontSize:'1rem', textDecoration:'none', transition:'all 0.25s' }}>
              💬 Chat on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* ── MAP ── */}
      <section id="contact" style={{ padding:'5.5rem 5%', background:C.navy }}>
        <SH label="Location" title="Find Us in Khangabok" />
        <div style={{ borderRadius:24, overflow:'hidden', border:`1px solid rgba(212,168,67,0.15)`, height:400, boxShadow:'0 24px 80px rgba(0,0,0,0.4)' }}>
          <iframe src={MAPS} width="100%" height="100%" frameBorder="0" style={{ display:'block' }} allowFullScreen title="GNSI Location" loading="lazy" />
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding:'5.5rem 5%', background:C.navy2 }}>
        <SH label="FAQ" title="Frequently Asked Questions" />
        <div style={{ maxWidth:720 }}><FAQ /></div>
      </section>

      {/* ── CTA ── */}
      <div style={{ margin:'0 5% 5.5rem', background:`linear-gradient(135deg,#12082a,${C.navy3},#0a1a3d)`, border:`1px solid rgba(212,168,67,0.2)`, borderRadius:28, padding:'5rem 3rem', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-120, left:'50%', transform:'translateX(-50%)', width:500, height:500, background:'radial-gradient(circle,rgba(139,92,246,0.1) 0%,transparent 65%)', borderRadius:'50%', pointerEvents:'none' }} />
        <div style={{ position:'absolute', bottom:-80, left:-80, width:300, height:300, background:'radial-gradient(circle,rgba(74,158,240,0.08) 0%,transparent 65%)', borderRadius:'50%', pointerEvents:'none' }} />
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:'clamp(2rem,4vw,3rem)', fontWeight:900, marginBottom:'1rem', position:'relative' }}>
          Admissions Open <span style={{ color:C.gold }}>2026-27</span>
        </h2>
        <p style={{ color:C.muted, fontSize:'1rem', maxWidth:440, margin:'0 auto 2.5rem', lineHeight:1.8 }}>Limited seats available. Give your child the best chance at a bright future as an officer.</p>
        <div style={{ display:'flex', justifyContent:'center', gap:'1rem', flexWrap:'wrap', position:'relative' }}>
          <button onClick={()=>go('enquiry')} style={{ ...btnG, fontSize:'1.05rem' }} className="btn-g">✏️ Enquire Now →</button>
          <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:8, background:'rgba(37,211,102,0.15)', border:`1px solid rgba(37,211,102,0.3)`, color:C.wa, padding:'0.95rem 2rem', borderRadius:50, fontWeight:700, fontSize:'1rem', textDecoration:'none' }}>💬 WhatsApp Us</a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ padding:'3.5rem 5% 2rem', borderTop:`1px solid rgba(212,168,67,0.08)`, background:C.navy2 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'2.5rem', marginBottom:'2.5rem' }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:'1.2rem', color:C.goldL, marginBottom:'0.8rem', fontWeight:800 }}>GNSI Portal</div>
            <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.4)', lineHeight:1.8, maxWidth:260, marginBottom:'1rem' }}>Guidance Navodaya & Sainik Institute — Khangabok's premier coaching centre since 2016.</p>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer" style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(37,211,102,0.1)', border:'1px solid rgba(37,211,102,0.2)', color:C.wa, padding:'5px 12px', borderRadius:8, textDecoration:'none', fontSize:'0.75rem', fontWeight:700 }}>💬 WhatsApp</a>
              <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'rgba(255,255,255,0.5)', padding:'5px 12px', borderRadius:8, fontSize:'0.75rem' }}>🔒 SSL</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.muted, marginBottom:'1.2rem' }}>Quick Links</div>
            {[['notices','Notices'],['results','Results'],['gallery','Gallery'],['events','Events'],['enquiry','Enquire'],['contact','Location']].map(([id,label])=>(
              <button key={id} onClick={()=>go(id)} style={{ display:'block', background:'none', border:'none', color:'rgba(255,255,255,0.4)', fontSize:'0.84rem', padding:'5px 0', cursor:'pointer', textAlign:'left', fontFamily:'inherit', transition:'color 0.2s' }} onMouseEnter={e=>e.target.style.color=C.goldL} onMouseLeave={e=>e.target.style.color='rgba(255,255,255,0.4)'}>{label}</button>
            ))}
          </div>
          <div>
            <div style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.muted, marginBottom:'1.2rem' }}>Contact</div>
            {['📞 +91 89742 98074','📍 Khangabok, Thoubal','🗺️ Manipur — 795138','🕐 Mon–Sat 8AM–6PM'].map(t=>(
              <div key={t} style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.4)', padding:'5px 0' }}>{t}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:'0.68rem', fontWeight:700, letterSpacing:'0.15em', textTransform:'uppercase', color:C.muted, marginBottom:'1.2rem' }}>Portal Access</div>
            <button onClick={onLogin} style={{ ...btnG, width:'100%', justifyContent:'center', borderRadius:12, marginBottom:10, padding:'10px 16px', fontSize:'0.88rem' }} className="btn-g">Staff Login →</button>
            {pwa && <button onClick={installPwa} style={{ width:'100%', background:'rgba(212,168,67,0.1)', border:`1px solid rgba(212,168,67,0.25)`, color:C.goldL, padding:'10px 16px', borderRadius:12, cursor:'pointer', fontSize:'0.82rem', fontFamily:'inherit', fontWeight:600 }}>📱 Install App</button>}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem', paddingTop:'2rem', borderTop:`1px solid rgba(255,255,255,0.05)` }}>
          <div style={{ fontSize:'0.73rem', color:'rgba(255,255,255,0.3)' }}>© {new Date().getFullYear()} Guidance Navodaya & Sainik Institute, Khangabok, Manipur. All rights reserved.</div>
          <div style={{ display:'flex', gap:16 }}>
            <button onClick={()=>setPrivacy(true)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.3)', fontSize:'0.73rem', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>Privacy Policy</button>
            <span style={{ fontSize:'0.73rem', color:'rgba(255,255,255,0.2)' }}>Built with GNSI ERP</span>
          </div>
        </div>
      </footer>

      {/* ── FLOATING WA ── */}
      <a href={`https://wa.me/${WA}?text=Hello, enquiring about GNSI admissions`} target="_blank" rel="noreferrer"
        style={{ position:'fixed', bottom:mobile?94:28, right:24, zIndex:999, width:58, height:58, borderRadius:'50%', background:`linear-gradient(135deg,#25D366,#128C7E)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.6rem', boxShadow:'0 8px 32px rgba(37,211,102,0.5)', textDecoration:'none', animation:'bounce 3s infinite' }}>
        💬
      </a>

      {/* ── BACK TO TOP ── */}
      {showTop && (
        <button onClick={()=>window.scrollTo({top:0,behavior:'smooth'})}
          style={{ position:'fixed', bottom:mobile?160:94, right:24, zIndex:998, width:46, height:46, borderRadius:'50%', background:`rgba(212,168,67,0.15)`, border:`1px solid rgba(212,168,67,0.35)`, color:C.goldL, fontSize:'1.1rem', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(10px)', boxShadow:`0 4px 16px rgba(212,168,67,0.2)` }}>
          ↑
        </button>
      )}

      {/* ── MOBILE STICKY CTA ── */}
      {mobile && (
        <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:997, background:'rgba(4,13,30,0.97)', backdropFilter:'blur(20px)', borderTop:`1px solid rgba(212,168,67,0.15)`, padding:'10px 16px', display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <a href="tel:+918974298074" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'rgba(74,158,240,0.1)', border:`1px solid rgba(74,158,240,0.2)`, borderRadius:12, padding:'8px 4px', textDecoration:'none', color:C.blue }}>
            <span style={{ fontSize:'1.2rem' }}>📞</span><span style={{ fontSize:'0.62rem', fontWeight:600 }}>Call</span>
          </a>
          <a href={`https://wa.me/${WA}`} target="_blank" rel="noreferrer" style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'rgba(37,211,102,0.12)', border:`1px solid rgba(37,211,102,0.25)`, borderRadius:12, padding:'8px 4px', textDecoration:'none', color:C.wa }}>
            <span style={{ fontSize:'1.2rem' }}>💬</span><span style={{ fontSize:'0.62rem', fontWeight:600 }}>WhatsApp</span>
          </a>
          <button onClick={()=>go('enquiry')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:`rgba(212,168,67,0.12)`, border:`1px solid rgba(212,168,67,0.25)`, borderRadius:12, padding:'8px 4px', cursor:'pointer', color:C.goldL, fontFamily:'inherit' }}>
            <span style={{ fontSize:'1.2rem' }}>✏️</span><span style={{ fontSize:'0.62rem', fontWeight:600 }}>Enquire</span>
          </button>
        </div>
      )}

      {/* ── MODALS ── */}
      {preview  && <NModal n={preview} onClose={()=>setPreview(null)} />}
      {lightbox  && <Lightbox img={lightbox.img} caption={lightbox.caption} onClose={()=>setLightbox(null)} />}
      {cookie    && <Cookie onAccept={acceptC} onDecline={declineC} />}
    </div>
  )
}
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

const NAVY = '#0B1E3D'
const GOLD = '#C9A84C'
const GOLD_LIGHT = '#E8C96A'
const CARD_BG = '#0f2548'
const TEXT_MUTED = '#8899BB'

const S = {
  nav: { position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 5%', background: 'rgba(11,30,61,0.92)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(201,168,76,0.15)' },
  navLogoBox: { width: 40, height: 40, background: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: GOLD_LIGHT, fontSize: '1rem', fontFamily: 'Georgia, serif' },
  navLogoText: { fontFamily: 'Georgia, serif', fontSize: '1rem', fontWeight: 700, color: GOLD_LIGHT, lineHeight: 1.2 },
  navLogoSub: { fontSize: '0.62rem', fontFamily: 'sans-serif', color: TEXT_MUTED, fontWeight: 400, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'block' },
  navLinks: { display: 'flex', alignItems: 'center', gap: '1.5rem', listStyle: 'none', margin: 0, padding: 0 },
  navCta: { background: GOLD, color: NAVY, padding: '0.5rem 1.4rem', borderRadius: 50, fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', border: 'none', cursor: 'pointer' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, background: GOLD, color: NAVY, padding: '0.9rem 2rem', borderRadius: 50, fontWeight: 700, fontSize: '1rem', textDecoration: 'none', border: 'none', cursor: 'pointer' },
  btnSecondary: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: '#fff', padding: '0.9rem 2rem', borderRadius: 50, border: '1px solid rgba(255,255,255,0.2)', fontWeight: 500, fontSize: '1rem', textDecoration: 'none', cursor: 'pointer' },
  sectionLabel: { display: 'inline-block', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: GOLD, marginBottom: '0.7rem' },
  sectionTitle: { fontFamily: 'Georgia, serif', fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.7rem', color: '#fff' },
  sectionSub: { fontSize: '0.95rem', color: 'rgba(255,255,255,0.5)', maxWidth: 480, lineHeight: 1.7, fontWeight: 300, marginBottom: '2.5rem' },
  card: { background: CARD_BG, border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '1.4rem', transition: 'all 0.25s' },
}

function SkeletonCard() {
  return (
    <div style={{ ...S.card, opacity: 0.4, minHeight: 140 }}>
      <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 8, height: 12, width: '40%', marginBottom: 10 }} />
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, height: 14, width: '80%', marginBottom: 8 }} />
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, height: 10, width: '90%', marginBottom: 6 }} />
      <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, height: 10, width: '70%' }} />
    </div>
  )
}

function NoticeTag({ priority, category }) {
  const pColor = priority === 'Urgent' ? ['#fee2e2','#dc2626'] : priority === 'Important' ? ['#fef3c7','#b45309'] : ['#e0f2fe','#0369a1']
  const cColor = category === 'Exam' ? ['#ede9fe','#6d28d9'] : category === 'Holiday' ? ['#fce7f3','#9d174d'] : category === 'Fee' ? ['#fef3c7','#92400e'] : category === 'Event' ? ['#d1fae5','#065f46'] : category === 'Academic' ? ['#dbeafe','#1e40af'] : ['#f1f5f9','#475569']
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700, background: pColor[0], color: pColor[1] }}>{priority}</span>
      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700, background: cColor[0], color: cColor[1] }}>{category}</span>
    </div>
  )
}

function NoticeModal({ notice, onClose }) {
  if (!notice) return null
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0f2548', border: '1px solid rgba(201,168,76,0.2)', borderRadius: '20px 20px 0 0', padding: 28, width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div style={{ flex: 1, marginRight: 12 }}>
            {notice.pinned && <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginBottom: 4 }}>📌 PINNED NOTICE</div>}
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{notice.title}</h2>
            <NoticeTag priority={notice.priority} category={notice.category} />
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 12 }}>
          {[['👥 Audience', notice.audience],['📅 Date', notice.publish_date||'—'],['⏳ Expiry', notice.expiry_date||'No expiry'],['✍️ By', notice.created_by||'GNSI Admin']].map(([k,v]) => (
            <div key={k}><div style={{ color: TEXT_MUTED }}>{k}</div><div style={{ fontWeight: 700, color: '#fff' }}>{v}</div></div>
          ))}
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, whiteSpace: 'pre-wrap', background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 14, marginBottom: 12 }}>{notice.description}</div>
        {notice.attachment_url && (
          <a href={notice.attachment_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: GOLD_LIGHT, fontSize: 13, fontWeight: 700, textDecoration: 'none', background: 'rgba(201,168,76,0.1)', padding: '8px 14px', borderRadius: 8, border: `1px solid rgba(201,168,76,0.2)` }}>📎 Open Attachment</a>
        )}
      </div>
    </div>
  )
}

function FaqList() {
  const [open, setOpen] = useState(null)
  const faqs = [
    ['What classes does GNSI prepare students for?','GNSI prepares students for Jawahar Navodaya Vidyalaya (Class 6 & 9), Sainik School, and RMS entrance examinations.'],
    ['Is hostel facility available?','Yes, GNSI has a boarding hostel for outstation students with 24/7 supervision, nutritious meals, and a dedicated study hall.'],
    ['When does the new batch start?','New batches typically start in June (summer batch) and January. Contact the admin at +91 89742 98074 for the current schedule.'],
    ["How can parents track their child's progress?",'Parents can access the GNSI Portal to view fee receipts, attendance records, exam marks, and notices in real-time.'],
    ['What is the fee structure?','Fee varies by course and hostel type. Please contact the admin office at Khangabok or call +91 89742 98074 for current details.'],
  ]
  return (
    <div>
      {faqs.map(([q, a], i) => (
        <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <button onClick={() => setOpen(open === i ? null : i)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '1.2rem 0', background: 'none', border: 'none', color: '#fff', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer', gap: '1rem', textAlign: 'left' }}>
            {q}
            <span style={{ color: GOLD, fontSize: '1.2rem', minWidth: 20, transition: 'transform 0.3s', transform: open === i ? 'rotate(45deg)' : 'rotate(0)', display: 'inline-block' }}>+</span>
          </button>
          <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxHeight: open === i ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.3s', paddingBottom: open === i ? '1.2rem' : 0 }}>{a}</div>
        </div>
      ))}
    </div>
  )
}

export default function LandingPage({ onLogin }) {
  const [notices, setNotices]         = useState([])
  const [results, setResults]         = useState([])
  const [events, setEvents]           = useState([])
  const [gallery, setGallery]         = useState([])
  const [loadingNotices, setLN]       = useState(true)
  const [loadingResults, setLR]       = useState(true)
  const [loadingEvents, setLE]        = useState(true)
  const [loadingGallery, setLG]       = useState(true)
  const [previewNotice, setPreview]   = useState(null)
  const [menuOpen, setMenuOpen]       = useState(false)
  const [scrolled, setScrolled]       = useState(false)

  // ── Fetch notices ──────────────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('notices')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'Published')
      .or(`expiry_date.is.null,expiry_date.gte.${today}`)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error) setNotices(data || [])
        setLN(false)
      })
  }, [])

  // ── Fetch yearly results ───────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('yearly_results')
      .select('*')
      .order('display_order', { ascending: true })
      .then(({ data, error }) => {
        if (!error) setResults(data || [])
        setLR(false)
      })
  }, [])

  // ── Fetch upcoming events ──────────────────────────────────────────────────
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0]
    supabase.from('events')
      .select('*')
      .eq('is_public', true)
      .gte('event_date', today)
      .order('event_date', { ascending: true })
      .limit(5)
      .then(({ data, error }) => {
        if (!error) setEvents(data || [])
        setLE(false)
      })
  }, [])

  // ── Fetch gallery (public social posts with image_url) ─────────────────────
  useEffect(() => {
    supabase.from('social_posts')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error) setGallery(data || [])
        setLG(false)
      })
  }, [])

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', h)
    return () => window.removeEventListener('scroll', h)
  }, [])

  const scrollTo = id => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); setMenuOpen(false) }

  const tagColors = {
    green: ['#dcfce7','#166534'], blue: ['#dbeafe','#1e40af'],
    gold: ['#fef3c7','#b45309'], red: ['#fee2e2','#dc2626'],
    purple: ['#ede9fe','#6d28d9'], General: ['#f1f5f9','#475569'],
  }

  const formatEventDate = (dateStr) => {
    const d = new Date(dateStr)
    return { day: d.getDate().toString().padStart(2,'0'), month: d.toLocaleString('en-IN', { month: 'short' }) }
  }

  const contentTypeIcon = (type) => {
    const map = { Admission: '📋', Result: '🏆', Event: '📅', Topper: '👨‍🎓', Announcement: '📢' }
    return map[type] || '📸'
  }

  return (
    <div style={{ background: NAVY, color: '#fff', minHeight: '100vh', fontFamily: "'DM Sans','Segoe UI',sans-serif", overflowX: 'hidden' }}>

      {/* ── NAV ── */}
      <nav style={{ ...S.nav, boxShadow: scrolled ? '0 4px 24px rgba(0,0,0,0.3)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={S.navLogoBox}>G</div>
          <div>
            <div style={S.navLogoText}>GNSI Portal</div>
            <span style={S.navLogoSub}>Khangabok, Manipur</span>
          </div>
        </div>
        <ul style={S.navLinks} className="gnsi-nav-links">
          {[['notices','Notices'],['results','Results'],['gallery','Gallery'],['events','Events'],['contact','Contact']].map(([id,label]) => (
            <li key={id}><button onClick={() => scrollTo(id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', cursor: 'pointer' }}>{label}</button></li>
          ))}
          <li><button onClick={onLogin} style={S.navCta}>Login →</button></li>
        </ul>
        <button onClick={() => setMenuOpen(v => !v)} className="gnsi-menu-btn" style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 18 }}>
          {menuOpen ? '✕' : '☰'}
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 64, left: 0, right: 0, background: 'rgba(11,30,61,0.98)', zIndex: 99, padding: '1rem 5%', borderBottom: '1px solid rgba(201,168,76,0.15)' }}>
          {[['notices','📢 Notices'],['results','🏆 Results'],['gallery','📸 Gallery'],['events','📅 Events'],['contact','📍 Contact']].map(([id,label]) => (
            <button key={id} onClick={() => scrollTo(id)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none', color: 'rgba(255,255,255,0.8)', padding: '12px 0', fontSize: 15, cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{label}</button>
          ))}
          <button onClick={onLogin} style={{ ...S.navCta, marginTop: 12, display: 'block', width: '100%', textAlign: 'center' }}>Login to Portal →</button>
        </div>
      )}

      {/* ── HERO ── */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', padding: '8rem 5% 4rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 60% at 70% 50%, rgba(201,168,76,0.07) 0%, transparent 60%), radial-gradient(ellipse 40% 80% at 10% 50%, rgba(30,61,112,0.6) 0%, transparent 60%)' }} />
        <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'linear-gradient(rgba(201,168,76,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.8) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div style={{ position: 'relative', zIndex: 2, maxWidth: 640 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.3)', color: GOLD_LIGHT, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0.4rem 1rem', borderRadius: 50, marginBottom: '2rem' }}>
            <span style={{ width: 6, height: 6, background: GOLD, borderRadius: '50%', display: 'inline-block' }} />
            Trusted since 2016 · Manipur's #1 Coaching Institute
          </div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(2.6rem,5.5vw,4.5rem)', fontWeight: 900, lineHeight: 1.08, marginBottom: '1.5rem' }}>
            Shape Your Future<br />as a <span style={{ color: GOLD }}>Future Officer</span>
          </h1>
          <p style={{ fontSize: '1.05rem', lineHeight: 1.8, color: 'rgba(255,255,255,0.65)', maxWidth: 500, marginBottom: '2.5rem', fontWeight: 300 }}>
            Guidance Navodaya & Sainik Institute — Khangabok's premier coaching centre for Navodaya, Sainik, and RMS entrance examination preparation since 2016.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <button onClick={onLogin} style={S.btnPrimary}>Access Portal →</button>
            <button onClick={() => scrollTo('notices')} style={S.btnSecondary}>Latest Notices</button>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <div style={{ padding: '2.5rem 5%', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '2rem', textAlign: 'center' }}>
        {[['10+','Years of excellence'],['500+','Students enrolled'],['95%','Selection rate'],['200+','Officers produced'],['15+','Portal modules']].map(([num,label]) => (
          <div key={label}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '2.5rem', fontWeight: 700, color: GOLD, lineHeight: 1 }}>{num}</div>
            <div style={{ fontSize: '0.82rem', color: TEXT_MUTED, marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── NOTICE BOARD ── */}
      <section id="notices" style={{ padding: '5.5rem 5%', background: 'rgba(255,255,255,0.015)' }}>
        <div style={S.sectionLabel}>Notice Board</div>
        <div style={S.sectionTitle}>Latest Announcements</div>
        <p style={S.sectionSub}>Stay updated with the latest news, admissions, and exam schedules from GNSI.</p>
        {loadingNotices ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : notices.length === 0 ? (
          <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '3rem', background: CARD_BG, borderRadius: 16, border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>📢</div>
            <div>No public notices at the moment. Check back soon.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '1rem' }}>
            {notices.map(notice => {
              const priorityBorder = notice.priority === 'Urgent' ? '#dc2626' : notice.priority === 'Important' ? '#d97706' : 'rgba(201,168,76,0.3)'
              return (
                <div key={notice.id} onClick={() => setPreview(notice)}
                  style={{ ...S.card, borderLeft: `4px solid ${priorityBorder}`, cursor: 'pointer', position: 'relative' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(201,168,76,0.4)'; e.currentTarget.style.transform='translateY(-3px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateY(0)' }}>
                  {notice.pinned && <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 14 }}>📌</span>}
                  <NoticeTag priority={notice.priority} category={notice.category} />
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', marginBottom: 8, lineHeight: 1.4, paddingRight: notice.pinned ? 24 : 0 }}>{notice.title}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{notice.description}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: TEXT_MUTED }}>
                    <span>📅 {notice.publish_date || '—'}</span>
                    <span style={{ color: GOLD_LIGHT, fontWeight: 600 }}>Read more →</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── RESULTS ── */}
      <section id="results" style={{ padding: '5.5rem 5%' }}>
        <div style={S.sectionLabel}>Our Results</div>
        <div style={S.sectionTitle}>Year-wise Selections</div>
        <p style={S.sectionSub}>Our students consistently clear Navodaya, Sainik, and RMS entrance examinations with top ranks.</p>
        {loadingResults ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.2rem' }}>
            {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : results.length === 0 ? (
          <div style={{ textAlign: 'center', color: TEXT_MUTED, padding: '3rem', background: CARD_BG, borderRadius: 16 }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏆</div>
            <div>Results coming soon.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.2rem' }}>
            {results.map(r => (
              <div key={r.id} style={{ ...S.card, textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(201,168,76,0.3)'; e.currentTarget.style.transform='translateY(-4px)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateY(0)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
                <div style={{ fontSize: '0.7rem', color: TEXT_MUTED, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{r.year}</div>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '2.8rem', fontWeight: 900, color: GOLD, lineHeight: 1 }}>{r.total_selections}</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginTop: 6 }}>Total Selections</div>
                <div style={{ fontSize: '0.75rem', color: TEXT_MUTED, marginTop: 4 }}>
                  {r.nvs_count > 0 && `${r.nvs_count} NVS`}
                  {r.nvs_count > 0 && r.sainik_count > 0 && ' · '}
                  {r.sainik_count > 0 && `${r.sainik_count} Sainik`}
                  {r.rms_count > 0 && ` · ${r.rms_count} RMS`}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── GALLERY ── */}
      <section id="gallery" style={{ padding: '5.5rem 5%', background: 'rgba(255,255,255,0.015)' }}>
        <div style={S.sectionLabel}>Photo Gallery</div>
        <div style={S.sectionTitle}>Life at GNSI</div>
        <p style={S.sectionSub}>Glimpses of our campus, classrooms, events, and proud moments of our students.</p>
        {loadingGallery ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem' }}>
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : gallery.length === 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gridTemplateRows: 'auto', gap: '1rem' }}>
            {[
              { span:2, row:2, icon:'🏫', label:'GNSI Campus' },
              { span:1, row:1, icon:'📚', label:'Study Hall' },
              { span:1, row:1, icon:'🏆', label:'Prize Distribution' },
              { span:1, row:1, icon:'👨‍🎓', label:'Selected Students' },
              { span:1, row:1, icon:'⚽', label:'Sports Day' },
            ].map((item,i) => (
              <div key={i} style={{ gridColumn:`span ${item.span}`, background: CARD_BG, border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, minHeight: item.row===2?320:150, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8 }}>
                <span style={{ fontSize: item.row===2?'3rem':'2rem' }}>{item.icon}</span>
                <span style={{ fontSize:'0.78rem', color: TEXT_MUTED }}>{item.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '1rem' }}>
            {gallery.map((post, i) => (
              <div key={post.id} style={{ ...S.card, padding: 0, overflow: 'hidden', position: 'relative', minHeight: 180, gridColumn: i === 0 ? 'span 2' : 'span 1', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.transform='scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
                {post.image_url ? (
                  <img src={post.image_url} alt={post.caption || post.title} style={{ width:'100%', height:'100%', minHeight:180, objectFit:'cover', display:'block' }} />
                ) : (
                  <div style={{ width:'100%', minHeight:180, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8, background: CARD_BG }}>
                    <span style={{ fontSize:'2rem' }}>{contentTypeIcon(post.content_type)}</span>
                    <span style={{ fontSize:'0.78rem', color: TEXT_MUTED }}>{post.content_type}</span>
                  </div>
                )}
                <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top, rgba(11,30,61,0.8) 0%, transparent 50%)', display:'flex', alignItems:'flex-end', padding:'1rem' }}>
                  <div>
                    <div style={{ fontSize:'0.82rem', fontWeight:600 }}>{post.caption || post.title}</div>
                    <div style={{ fontSize:'0.7rem', color: TEXT_MUTED }}>{post.platform} · {post.post_date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p style={{ textAlign:'center', color: TEXT_MUTED, fontSize:'0.8rem', marginTop:'1.5rem' }}>
          📸 Photos managed from the portal's Social module · Mark posts as public to show here
        </p>
      </section>

      {/* ── EVENTS ── */}
      <section id="events" style={{ padding: '5.5rem 5%' }}>
        <div style={S.sectionLabel}>Upcoming Events</div>
        <div style={S.sectionTitle}>Mark your calendar</div>
        {loadingEvents ? (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem', marginTop:'2rem' }}>
            {[1,2,3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign:'center', color: TEXT_MUTED, padding:'3rem', background: CARD_BG, borderRadius:16, border:'1px solid rgba(255,255,255,0.07)', marginTop:'2rem' }}>
            <div style={{ fontSize:'2rem', marginBottom:12 }}>📅</div>
            <div>No upcoming events. Check back soon.</div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem', marginTop:'2rem' }}>
            {events.map(ev => {
              const { day, month } = formatEventDate(ev.event_date)
              const [tagBg, tagColor] = tagColors[ev.tag_color] || tagColors.blue
              return (
                <div key={ev.id} style={{ ...S.card, display:'flex', gap:'1.5rem', alignItems:'flex-start' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(201,168,76,0.25)'; e.currentTarget.style.transform='translateX(4px)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateX(0)' }}>
                  <div style={{ minWidth:56, textAlign:'center', background:'rgba(201,168,76,0.1)', border:'1px solid rgba(201,168,76,0.2)', borderRadius:12, padding:'0.7rem 0.5rem', flexShrink:0 }}>
                    <div style={{ fontFamily:'Georgia, serif', fontSize:'1.6rem', fontWeight:700, color: GOLD, lineHeight:1 }}>{day}</div>
                    <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.08em', color: TEXT_MUTED }}>{month}</div>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'0.95rem', fontWeight:600, marginBottom:4 }}>{ev.title}</div>
                    {ev.description && <div style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.5)', lineHeight:1.5, marginBottom:8 }}>{ev.description}</div>}
                    <span style={{ fontSize:'0.65rem', padding:'2px 8px', borderRadius:99, fontWeight:700, background: tagBg, color: tagColor }}>{ev.tag}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding:'5.5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={S.sectionLabel}>Testimonials</div>
        <div style={S.sectionTitle}>What parents & students say</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:'1.2rem', marginTop:'2.5rem' }}>
          {[
            { initials:'RD', name:'Romen Devi', sub:'Parent · Thoubal', text:'"My son got selected in Jawahar Navodaya Vidyalaya Class 6 after just one year at GNSI. The teachers are dedicated and the study material is excellent."' },
            { initials:'KS', name:'Kiran Singh', sub:'Parent · Imphal', text:'"The hostel facility is clean and safe. GNSI gave my daughter the discipline and knowledge to crack Sainik School entrance on her first attempt."' },
            { initials:'BM', name:'Bikash Meetei', sub:'NVS Selected 2025', text:'"I joined GNSI in Class 5 and got selected in NVS. The mock tests every week really helped me understand my weak areas and improve fast."' },
          ].map(t => (
            <div key={t.name} style={S.card}>
              <div style={{ color: GOLD, fontSize:'0.9rem', letterSpacing:2, marginBottom:'1rem' }}>★★★★★</div>
              <p style={{ fontSize:'0.87rem', color:'rgba(255,255,255,0.65)', lineHeight:1.7, fontStyle:'italic', marginBottom:'1.2rem' }}>{t.text}</p>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(201,168,76,0.15)', border:'1px solid rgba(201,168,76,0.3)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'0.85rem', color: GOLD }}>{t.initials}</div>
                <div>
                  <div style={{ fontSize:'0.88rem', fontWeight:600 }}>{t.name}</div>
                  <div style={{ fontSize:'0.72rem', color: TEXT_MUTED }}>{t.sub}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FACILITIES ── */}
      <section style={{ padding:'5.5rem 5%' }}>
        <div style={S.sectionLabel}>Our Facilities</div>
        <div style={S.sectionTitle}>Everything for your child's success</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1.2rem', marginTop:'2.5rem' }}>
          {[['🏠','Boarding Hostel','Safe, clean and 24/7 supervised hostel for outstation students.'],['📚','Study Hall','Dedicated quiet study area with proper lighting for focused prep.'],['🍽️','Mess & Nutrition','Balanced nutritious meals served three times daily for hostel students.'],['⚽','Sports Ground','Outdoor play area — essential for Sainik School physical fitness.'],['👨‍🏫','Expert Faculty','Experienced teachers specializing in NVS and Sainik exam syllabus.'],['📱','Digital Portal','Parents track fees, attendance, and results online anytime.']].map(([icon,name,desc]) => (
            <div key={name} style={{ ...S.card, textAlign:'center' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='rgba(201,168,76,0.3)'; e.currentTarget.style.transform='translateY(-3px)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='rgba(255,255,255,0.07)'; e.currentTarget.style.transform='translateY(0)' }}>
              <div style={{ fontSize:'2rem', marginBottom:'0.8rem' }}>{icon}</div>
              <div style={{ fontSize:'0.95rem', fontWeight:600, marginBottom:'0.4rem' }}>{name}</div>
              <div style={{ fontSize:'0.78rem', color:'rgba(255,255,255,0.45)', lineHeight:1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section style={{ padding:'5.5rem 5%', background:'rgba(255,255,255,0.015)' }}>
        <div style={S.sectionLabel}>FAQ</div>
        <div style={S.sectionTitle}>Frequently asked questions</div>
        <div style={{ maxWidth:700, marginTop:'2.5rem' }}><FaqList /></div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact" style={{ padding:'5.5rem 5%' }}>
        <div style={S.sectionLabel}>Contact Us</div>
        <div style={S.sectionTitle}>Get in touch</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'1rem', marginTop:'2.5rem' }}>
          {[['📍','Address','Khangabok Sorok Wangma, Near Community Hall, Thoubal, Manipur — 795138'],['📞','Phone','+91 89742 98074'],['🌐','Portal','gnsi-erp.vercel.app'],['🕐','Office Hours','Mon–Sat: 8:00 AM – 6:00 PM']].map(([icon,label,val]) => (
            <div key={label} style={{ ...S.card, display:'flex', gap:'1rem', alignItems:'flex-start' }}>
              <div style={{ fontSize:'1.3rem', minWidth:36 }}>{icon}</div>
              <div>
                <div style={{ fontSize:'0.72rem', color: TEXT_MUTED, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
                <div style={{ fontSize:'0.9rem', fontWeight:500 }}>{val}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <div style={{ margin:'0 5% 5.5rem', background:'linear-gradient(135deg,#1e3d70 0%,#0f2548 100%)', border:'1px solid rgba(201,168,76,0.25)', borderRadius:28, padding:'5rem 3rem', textAlign:'center', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:-100, left:'50%', transform:'translateX(-50%)', width:400, height:400, background:'radial-gradient(circle,rgba(201,168,76,0.1) 0%,transparent 70%)', borderRadius:'50%', pointerEvents:'none' }} />
        <h2 style={{ fontFamily:'Georgia, serif', fontSize:'clamp(1.8rem,3.5vw,2.6rem)', fontWeight:700, marginBottom:'1rem' }}>Ready to join GNSI?</h2>
        <p style={{ color:'rgba(255,255,255,0.5)', fontSize:'0.95rem', maxWidth:420, margin:'0 auto 2.5rem', lineHeight:1.7 }}>Admissions open for 2026-27 batch. Limited seats. Contact us today or access the portal.</p>
        <button onClick={onLogin} style={{ ...S.btnPrimary, fontSize:'1rem', padding:'0.9rem 2.2rem' }}>Access GNSI Portal →</button>
      </div>

      {/* ── FOOTER ── */}
      <footer style={{ padding:'3rem 5% 2rem', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'2rem', marginBottom:'2rem' }}>
          <div>
            <div style={{ fontFamily:'Georgia, serif', fontSize:'1.1rem', color: GOLD_LIGHT, marginBottom:'0.8rem' }}>GNSI Portal</div>
            <p style={{ fontSize:'0.8rem', color:'rgba(255,255,255,0.4)', lineHeight:1.7, maxWidth:260 }}>Guidance Navodaya & Sainik Institute — Khangabok's premier coaching centre for Navodaya, Sainik, and RMS entrance examinations since 2016.</p>
          </div>
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color: TEXT_MUTED, marginBottom:'1rem' }}>Quick Links</div>
            {[['notices','Notices'],['results','Results'],['gallery','Gallery'],['events','Events'],['contact','Contact']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)} style={{ display:'block', background:'none', border:'none', color:'rgba(255,255,255,0.45)', fontSize:'0.82rem', padding:'4px 0', cursor:'pointer', textAlign:'left' }}>{label}</button>
            ))}
          </div>
          <div>
            <div style={{ fontSize:'0.72rem', fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color: TEXT_MUTED, marginBottom:'1rem' }}>Contact</div>
            {['+91 89742 98074','Khangabok, Thoubal','Manipur — 795138'].map(t => (
              <div key={t} style={{ fontSize:'0.82rem', color:'rgba(255,255,255,0.45)', padding:'4px 0' }}>{t}</div>
            ))}
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem', paddingTop:'2rem', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize:'0.75rem', color: TEXT_MUTED }}>© {new Date().getFullYear()} Guidance Navodaya & Sainik Institute, Khangabok, Manipur. All rights reserved.</div>
          <button onClick={onLogin} style={{ ...S.navCta, border:'none', cursor:'pointer' }}>Staff Login →</button>
        </div>
      </footer>

      {previewNotice && <NoticeModal notice={previewNotice} onClose={() => setPreview(null)} />}

      <style>{`
        @media (max-width: 768px) {
          .gnsi-nav-links { display: none !important; }
          .gnsi-menu-btn { display: block !important; }
        }
        @media (min-width: 769px) {
          .gnsi-nav-links { display: flex !important; }
          .gnsi-menu-btn { display: none !important; }
        }
      `}</style>
    </div>
  )
}
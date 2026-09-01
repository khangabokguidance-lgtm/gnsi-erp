// LandingPage.jsx — GNSI Khangabok public website
// Premium commercial landing page. Every section reads live data through
// websiteApi.js (Supabase-backed) with sane fallbacks so the page still
// looks complete before the admin has filled in every field from
// WebsiteTab.jsx. Design language: "Ledger & Crest" — the same navy/gold
// campus-ledger identity already established across the admin panel,
// carried through here as a public-facing military-academy-meets-archive
// aesthetic (fitting: this trains children for Sainik School and Navodaya
// entrance, i.e. cadet and residential-school admission).
//
// Fonts: EB Garamond (serif, display — ledger/certificate register) +
// Rajdhani (condensed sans — labels, nav, buttons, structural text).
// Load once via the <Fonts /> component below.

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  getSettings, getStats, getActiveNotices, getRankers, getGallery,
  getVideos, getPublishedPosts, getFeaturedReviews, getActiveBanners,
  getFaculty, getEvents, getFeaturedTestimonials, getExamCalendar,
  getTimeline, getYouTubeThumb, getYouTubeEmbed,
  submitEnquiry, submitScholarRegistration,
} from './websiteApi';

// ─────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────
const C = {
  navy: '#0B1F3A', navy2: '#0F2A4E', navy3: '#153561',
  gold: '#B8922A', goldL: '#D4AE50', goldLL: '#EDD180',
  cream: '#F8F3E8', paper: '#FBF8F1', ink: '#1B2431',
  slate: '#3D4F6B', mist: '#7A8FA8', line: 'rgba(184,146,42,.22)',
  red: '#8B1A1A', green: '#1A5C2A',
};

const FONT_SERIF = "'EB Garamond', Georgia, serif";
const FONT_SANS = "'Rajdhani', 'Segoe UI', sans-serif";

function Fonts() {
  useEffect(() => {
    if (document.getElementById('gnsi-landing-fonts')) return;
    const link = document.createElement('link');
    link.id = 'gnsi-landing-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Rajdhani:wght@500;600;700&display=swap';
    document.head.appendChild(link);
  }, []);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Small utilities
// ─────────────────────────────────────────────────────────────────────────
function useReveal() {
  // Single orchestrated reveal per section — not per-card. Intersection
  // observer flips one class on the section wrapper; children are staged
  // with CSS transition-delay, not individually observed.
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) { setShown(true); return; }
    const io = new IntersectionObserver(
      (entries) => { entries.forEach(e => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }); },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, shown];
}

function useCountUp(target, shown, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!shown) return;
    const num = parseInt(String(target).replace(/[^\d]/g, ''), 10);
    if (!num) { setVal(0); return; }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(num * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, target, duration]);
  const suffix = String(target).replace(/[\d,]/g, '');
  return `${val}${suffix}`;
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' ? window.innerWidth < 860 : false);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 860);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return m;
}

const waLink = (phone, text) =>
  `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

// ─────────────────────────────────────────────────────────────────────────
// Shared visual primitives
// ─────────────────────────────────────────────────────────────────────────

// Gold hairline divider with a small centered mark — replaces the generic
// tracked-out ALL-CAPS eyebrow label. This is a structural device (a
// register break, like the rule between entries in a ledger), not a label.
function Divider({ dark }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '0 0 2.2rem', maxWidth: 560 }}>
      <span style={{ width: 34, height: 1, background: dark ? C.line : 'rgba(11,31,58,.25)' }} />
      <span style={{ width: 6, height: 6, transform: 'rotate(45deg)', background: C.gold, flexShrink: 0 }} />
      <span style={{ flex: 1, height: 1, background: dark ? C.line : 'rgba(11,31,58,.25)' }} />
    </div>
  );
}

function SectionHead({ title, sub, dark, center }) {
  return (
    <div style={{ maxWidth: center ? 640 : 620, margin: center ? '0 auto 2.6rem' : '0 0 2.6rem', textAlign: center ? 'center' : 'left' }}>
      <h2 style={{
        fontFamily: FONT_SERIF, fontWeight: 500, fontStyle: 'italic',
        fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)', lineHeight: 1.15,
        color: dark ? C.cream : C.navy, margin: '0 0 1rem',
      }}>
        {title}
      </h2>
      <div style={{ margin: center ? '0 auto 1rem' : '0 0 1rem' }}><Divider dark={dark} /></div>
      {sub && (
        <p style={{
          fontFamily: FONT_SANS, fontSize: '1.02rem', fontWeight: 500, lineHeight: 1.6,
          color: dark ? 'rgba(248,243,232,.72)' : C.slate, maxWidth: 62 + 'ch', margin: center ? '0 auto' : 0,
        }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function GoldButton({ children, onClick, href, variant = 'solid', size = 'md' }) {
  const pad = size === 'lg' ? '.95rem 2.1rem' : '.7rem 1.5rem';
  const fs = size === 'lg' ? '1.02rem' : '.92rem';
  const base = {
    fontFamily: FONT_SANS, fontWeight: 700, fontSize: fs, letterSpacing: '.02em',
    padding: pad, cursor: 'pointer', border: `1.5px solid ${C.gold}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'background .2s, color .2s, transform .15s', textDecoration: 'none',
  };
  const style = variant === 'solid'
    ? { ...base, background: C.gold, color: C.navy }
    : { ...base, background: 'transparent', color: C.goldL };
  const El = href ? 'a' : 'button';
  return (
    <El
      href={href} onClick={onClick} target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={style}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {children}
    </El>
  );
}

function Seal({ size = 64 }) {
  // The signature mark: a ledger/cadet-crest emblem built from CSS, not an
  // image — keeps the hero crisp at any resolution and costs no request.
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block' }}>
      <polygon points="50,4 92,26 92,68 50,96 8,68 8,26" fill="none" stroke={C.gold} strokeWidth="1.5" />
      <polygon points="50,14 84,32 84,63 50,86 16,63 16,32" fill="none" stroke={C.goldL} strokeWidth="1" opacity="0.6" />
      <text x="50" y="47" textAnchor="middle" fontFamily={FONT_SERIF} fontStyle="italic" fontSize="22" fill={C.goldLL}>G</text>
      <text x="50" y="68" textAnchor="middle" fontFamily={FONT_SANS} fontWeight="700" fontSize="7" letterSpacing="1" fill={C.goldL}>EST. 2016</text>
    </svg>
  );
}

function Stars({ n = 5 }) {
  return (
    <span style={{ color: C.goldL, fontSize: '.9rem', letterSpacing: 2 }}>
      {'★'.repeat(Math.max(0, Math.min(5, n)))}{'☆'.repeat(5 - Math.max(0, Math.min(5, n)))}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Enquiry modal — the conversion point the whole page funnels toward
// ─────────────────────────────────────────────────────────────────────────
function EnquiryModal({ open, onClose, courses, contactPhone }) {
  const [form, setForm] = useState({ student_name: '', parent_name: '', phone: '', class_grade: '', course: '', message: '' });
  const [state, setState] = useState('idle'); // idle | sending | done | error

  useEffect(() => { if (open) { setForm({ student_name: '', parent_name: '', phone: '', class_grade: '', course: courses?.[0] || '', message: '' }); setState('idle'); } }, [open, courses]);

  if (!open) return null;

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.student_name.trim() || !form.phone.trim()) { setState('error'); return; }
    setState('sending');
    const { error } = await submitEnquiry(form);
    setState(error ? 'error' : 'done');
  };

  const field = { width: '100%', padding: '.75rem .9rem', fontFamily: FONT_SANS, fontWeight: 500, fontSize: '.95rem', border: `1.5px solid ${C.line}`, background: C.paper, color: C.ink, outline: 'none', boxSizing: 'border-box', marginBottom: 12 };
  const label = { display: 'block', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.72rem', letterSpacing: '.04em', color: C.slate, marginBottom: 6 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,.72)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div style={{ background: C.paper, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto', border: `1px solid ${C.line}`, position: 'relative' }} onClick={e => e.stopPropagation()}>
        <div style={{ background: C.navy, padding: '1.3rem 1.6rem', position: 'relative' }}>
          <button onClick={onClose} aria-label="Close" style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: C.goldL, fontSize: '1.3rem', cursor: 'pointer', lineHeight: 1 }}>×</button>
          <h3 style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: '1.4rem', color: C.cream, margin: 0 }}>Request a callback</h3>
          <p style={{ fontFamily: FONT_SANS, color: 'rgba(248,243,232,.65)', fontSize: '.85rem', margin: '.35rem 0 0' }}>Our counsellor will call you within one working day.</p>
        </div>

        <div style={{ padding: '1.6rem' }}>
          {state === 'done' ? (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>✓</div>
              <p style={{ fontFamily: FONT_SERIF, fontSize: '1.15rem', color: C.navy, margin: '0 0 6px' }}>Enquiry received</p>
              <p style={{ fontFamily: FONT_SANS, color: C.slate, fontSize: '.9rem', margin: '0 0 20px' }}>We've noted {form.student_name}'s details. Prefer to talk now?</p>
              {contactPhone && <GoldButton href={waLink(contactPhone, `Hello, I just submitted an enquiry for ${form.student_name}.`)}>Message on WhatsApp</GoldButton>}
            </div>
          ) : (
            <>
              <label style={label}>Student's name *</label>
              <input style={field} value={form.student_name} onChange={e => set('student_name', e.target.value)} placeholder="Full name" />
              <label style={label}>Parent / guardian name</label>
              <input style={field} value={form.parent_name} onChange={e => set('parent_name', e.target.value)} placeholder="Full name" />
              <label style={label}>Phone number *</label>
              <input style={field} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
              <label style={label}>Class / age</label>
              <input style={field} value={form.class_grade} onChange={e => set('class_grade', e.target.value)} placeholder="e.g. Class 5" />
              {courses?.length > 0 && (
                <>
                  <label style={label}>Course of interest</label>
                  <select style={field} value={form.course} onChange={e => set('course', e.target.value)}>
                    {courses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </>
              )}
              <label style={label}>Message</label>
              <textarea style={{ ...field, minHeight: 70, resize: 'vertical', fontFamily: FONT_SANS }} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Anything you'd like us to know" />

              {state === 'error' && (
                <p style={{ fontFamily: FONT_SANS, color: C.red, fontSize: '.85rem', margin: '0 0 12px' }}>
                  {!form.student_name.trim() || !form.phone.trim() ? "Student's name and phone number are required." : 'Something went wrong — please try again or call us directly.'}
                </p>
              )}

              <button
                onClick={submit} disabled={state === 'sending'}
                style={{ width: '100%', marginTop: 6, padding: '.9rem', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '1rem', border: 'none', background: C.gold, color: C.navy, cursor: state === 'sending' ? 'default' : 'pointer', opacity: state === 'sending' ? .7 : 1 }}
              >
                {state === 'sending' ? 'Sending…' : 'Send enquiry'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Header
// ─────────────────────────────────────────────────────────────────────────
function Header({ schoolName, settings, onEnquire, mobile, notice }) {
  const [scrolled, setScrolled] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);

  const links = [
    ['Results', '#results'], ['Programmes', '#programmes'], ['Campus life', '#campus'],
    ['Faculty', '#faculty'], ['Calendar', '#calendar'], ['Contact', '#contact'],
  ];

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 500,
      background: scrolled ? 'rgba(11,31,58,.96)' : 'transparent',
      borderBottom: scrolled ? `1px solid ${C.line}` : '1px solid transparent',
      backdropFilter: scrolled ? 'blur(8px)' : 'none',
      transition: 'background .3s, border-color .3s',
    }}>
      {/* Notice strip lives inside the fixed stack so it never overlaps
          the nav row below it — both are fixed, so DOM order alone can't
          keep them apart. */}
      {notice && (
        <div style={{ background: C.goldL, padding: '.5rem 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: mobile ? '0 1.1rem' : '0 2rem', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.7rem', letterSpacing: '.04em', color: C.navy, flexShrink: 0 }}>NOTICE</span>
            <span style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: '.82rem', color: C.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notice}</span>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: mobile ? '.8rem 1.1rem' : '.9rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Seal size={38} />
          <div>
            <div style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: mobile ? '1rem' : '1.15rem', color: C.cream, lineHeight: 1.1 }}>{schoolName}</div>
            <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: '.62rem', letterSpacing: '.1em', color: C.goldL }}>KHANGABOK · MANIPUR</div>
          </div>
        </div>

        {!mobile && (
          <nav style={{ display: 'flex', gap: 28 }}>
            {links.map(([label, href]) => (
              <a key={href} href={href} style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: '.9rem', color: 'rgba(248,243,232,.85)', textDecoration: 'none' }}>{label}</a>
            ))}
          </nav>
        )}

        {!mobile ? (
          <GoldButton onClick={onEnquire}>Enquire now</GoldButton>
        ) : (
          <button onClick={() => setNavOpen(o => !o)} aria-label="Menu" style={{ background: 'none', border: `1.5px solid ${C.gold}`, color: C.goldL, padding: '.4rem .7rem', fontSize: '1.1rem', cursor: 'pointer' }}>
            {navOpen ? '×' : '☰'}
          </button>
        )}
      </div>

      {mobile && navOpen && (
        <div style={{ background: C.navy, borderTop: `1px solid ${C.line}`, padding: '1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {links.map(([label, href]) => (
            <a key={href} href={href} onClick={() => setNavOpen(false)} style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: '1rem', color: 'rgba(248,243,232,.9)', textDecoration: 'none' }}>{label}</a>
          ))}
          <GoldButton onClick={() => { setNavOpen(false); onEnquire(); }}>Enquire now</GoldButton>
        </div>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────
function Hero({ settings, stats, mobile, onEnquire, hasNotice }) {
  const [ref, shown] = useReveal();
  const selRate = useCountUp(stats.selection_rate, shown);
  const officers = useCountUp(stats.officers_produced, shown);
  const years = useCountUp(stats.years_of_excellence, shown);

  return (
    <section ref={ref} style={{
      position: 'relative', background: `radial-gradient(ellipse at 30% -10%, ${C.navy3} 0%, ${C.navy} 55%)`,
      paddingTop: (mobile ? 110 : 150) + (hasNotice ? (mobile ? 40 : 44) : 0), paddingBottom: mobile ? 70 : 100, overflow: 'hidden',
    }}>
      {/* faint ledger rule texture */}
      <div aria-hidden style={{
        position: 'absolute', inset: 0, opacity: 0.05, pointerEvents: 'none',
        backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 38px, ${C.gold} 39px)`,
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: mobile ? '0 1.1rem' : '0 2rem', position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 40 : 60, alignItems: 'center' }}>
          <div style={{ flex: '1 1 55%', opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(14px)', transition: 'opacity .7s ease, transform .7s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <span style={{ width: 26, height: 1, background: C.gold }} />
              <span style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.78rem', letterSpacing: '.1em', color: C.goldL }}>
                {settings.established_year ? `A RESIDENTIAL INSTITUTE SINCE ${settings.established_year}` : 'A RESIDENTIAL INSTITUTE FOR ENTRANCE PREPARATION'}
              </span>
            </div>

            <h1 style={{
              fontFamily: FONT_SERIF, fontWeight: 500, fontStyle: 'italic',
              fontSize: mobile ? '2.3rem' : 'clamp(2.6rem, 4.6vw, 3.6rem)', lineHeight: 1.12,
              color: C.cream, margin: '0 0 1.4rem',
            }}>
              {mobile
                ? <>Where Manipur's children earn their place at Navodaya and Sainik School.</>
                : <>Where Manipur's children<br />earn their place at<br />Navodaya and Sainik School.</>}
            </h1>

            <p style={{ fontFamily: FONT_SANS, fontWeight: 500, fontSize: mobile ? '1rem' : '1.1rem', lineHeight: 1.65, color: 'rgba(248,243,232,.7)', maxWidth: 480, margin: '0 0 2.2rem' }}>
              {settings.tagline || `${settings.school_name || 'GNSI'} is a residential coaching campus in Khangabok, Thoubal — built for one purpose: getting rural Manipur's brightest children through JNVST, AISSEE and RMS entrance exams, and keeping them there once they're admitted.`}
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <GoldButton size="lg" onClick={onEnquire}>Enquire about admission</GoldButton>
              <GoldButton size="lg" variant="outline" href="#results">See our results</GoldButton>
            </div>
          </div>

          <div style={{ flex: '1 1 40%', display: 'flex', justifyContent: 'center', opacity: shown ? 1 : 0, transition: 'opacity 1s ease .2s' }}>
            <div style={{ position: 'relative' }}>
              <Seal size={mobile ? 160 : 220} />
            </div>
          </div>
        </div>

        {/* Stat strip — a ledger tally, not generic SaaS metric cards */}
        <div style={{
          marginTop: mobile ? 50 : 76, display: 'grid',
          gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          borderTop: `1px solid ${C.line}`, borderLeft: `1px solid ${C.line}`,
        }}>
          {[
            [selRate, 'Selection rate'],
            [officers, 'Officers & cadets produced'],
            [years, 'Years running'],
            [stats.students_trained, 'Students trained'],
          ].map(([val, label]) => (
            <div key={label} style={{ padding: mobile ? '1.1rem .9rem' : '1.5rem 1.6rem', borderRight: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
              <div style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: mobile ? '1.7rem' : '2.3rem', color: C.goldLL, lineHeight: 1 }}>{val}</div>
              <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: '.78rem', color: 'rgba(248,243,232,.6)', marginTop: 6 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Selection Roster — the one signature motion moment: a scrolling honour
// roll of actual rankers, styled like a results board, not a testimonial
// carousel.
// ─────────────────────────────────────────────────────────────────────────
function SelectionRoster({ rankers }) {
  if (!rankers?.length) return null;
  const doubled = [...rankers, ...rankers]; // seamless loop
  return (
    <div style={{ background: C.navy2, borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}`, overflow: 'hidden', padding: '.9rem 0' }}>
      <style>{`
        @keyframes gnsiRosterScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .gnsi-roster-track { display: flex; width: max-content; animation: gnsiRosterScroll 38s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .gnsi-roster-track { animation: none; overflow-x: auto; } }
      `}</style>
      <div className="gnsi-roster-track">
        {doubled.map((r, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 2rem', whiteSpace: 'nowrap', borderRight: `1px solid ${C.line}` }}>
            <span style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', color: C.goldLL, fontSize: '1.05rem' }}>{r.name}</span>
            {r.rank && <span style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.7rem', letterSpacing: '.05em', color: C.gold, border: `1px solid ${C.gold}`, padding: '.15rem .5rem' }}>{r.rank}</span>}
            {r.school && <span style={{ fontFamily: FONT_SANS, fontSize: '.8rem', color: 'rgba(248,243,232,.55)' }}>{r.school}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Ranker Wall of Honour — id-card / plaque framing rather than rounded
// avatar cards
// ─────────────────────────────────────────────────────────────────────────
function RankerWall({ rankers, mobile }) {
  const [ref, shown] = useReveal();
  if (!rankers?.length) return null;
  return (
    <section id="results" ref={ref} style={{ background: C.paper, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHead title="The wall of honour" sub="Every name here made it through JNVST, AISSEE or RMS on merit — from the same classrooms, the same campus, the same routine." />
        <div style={{
          display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(180px, 1fr))', gap: mobile ? 14 : 20,
          opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(16px)', transition: 'opacity .6s ease, transform .6s ease',
        }}>
          {rankers.map((r, i) => (
            <div key={r.id ?? i} style={{ background: C.navy, border: `1px solid ${C.line}`, position: 'relative' }}>
              <div style={{ position: 'absolute', top: 8, left: 8, width: 10, height: 10, borderTop: `1.5px solid ${C.gold}`, borderLeft: `1.5px solid ${C.gold}` }} />
              <div style={{ position: 'absolute', bottom: 8, right: 8, width: 10, height: 10, borderBottom: `1.5px solid ${C.gold}`, borderRight: `1.5px solid ${C.gold}` }} />
              <div style={{ aspectRatio: '1', background: `linear-gradient(160deg, ${C.navy3}, ${C.navy})`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                {r.photo_url
                  ? <img src={r.photo_url} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                  : <span style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '2.2rem', color: C.goldL }}>{r.name?.[0] ?? '?'}</span>}
              </div>
              <div style={{ padding: '.9rem 1rem 1.1rem' }}>
                <div style={{ fontFamily: FONT_SERIF, fontWeight: 500, fontSize: '1.05rem', color: C.cream, lineHeight: 1.25 }}>{r.name}</div>
                {r.rank && <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.7rem', letterSpacing: '.04em', color: C.goldL, marginTop: 5 }}>{r.rank}</div>}
                {(r.school || r.batch) && <div style={{ fontFamily: FONT_SANS, fontSize: '.75rem', color: 'rgba(248,243,232,.5)', marginTop: 3 }}>{[r.school, r.batch].filter(Boolean).join(' · ')}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Result banners strip (image banners, e.g. year-wise results posters)
// ─────────────────────────────────────────────────────────────────────────
function ResultBanners({ banners, mobile }) {
  if (!banners?.length) return null;
  return (
    <div style={{ background: C.paper, padding: mobile ? '0 1.1rem 3rem' : '0 2rem 4rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: mobile ? '1fr' : `repeat(${Math.min(banners.length, 3)}, 1fr)`, gap: 18 }}>
        {banners.slice(0, 3).map((b, i) => (
          <div key={b.id ?? i} style={{ border: `1px solid ${C.line}`, background: C.navy, position: 'relative' }}>
            {b.image_url && <img src={b.image_url} alt={b.title} style={{ width: '100%', display: 'block' }} onError={e => { e.target.style.display = 'none'; }} />}
            <div style={{ padding: '1rem 1.2rem' }}>
              <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.7rem', letterSpacing: '.05em', color: C.goldL }}>{b.year_label}</div>
              <div style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '1.15rem', color: C.cream, marginTop: 4 }}>{b.title}</div>
              {b.subtitle && <div style={{ fontFamily: FONT_SANS, fontSize: '.85rem', color: 'rgba(248,243,232,.6)', marginTop: 4 }}>{b.subtitle}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Programmes — left-aligned, ledger-row layout instead of a card grid
// ─────────────────────────────────────────────────────────────────────────
const PROGRAMMES = [
  { code: 'JNVST', name: 'Navodaya Vidyalaya (Class VI & IX)', desc: 'Full-length mock series, mental-ability drills, and a Hindi-medium bridge programme for first-generation entrants.' },
  { code: 'AISSEE', name: 'Sainik School (Class VI & IX)', desc: 'Physical training alongside academics — PET/PFT conditioning is built into the daily residential schedule, not left to chance.' },
  { code: 'RMS', name: 'Rashtriya Military School', desc: 'Interview and SSB-orientation coaching layered on top of the same written-exam preparation as our Sainik track.' },
];

function Programmes({ mobile, onEnquire }) {
  const [ref, shown] = useReveal();
  return (
    <section id="programmes" ref={ref} style={{ background: C.navy, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionHead dark title="Three exams, one residential routine" sub="Every programme shares the same campus, the same house-parents, and the same daily rhythm — only the syllabus and the interview preparation differ." />
        <div style={{ opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(16px)', transition: 'opacity .6s ease, transform .6s ease' }}>
          {PROGRAMMES.map((p, i) => (
            <div key={p.code} style={{ display: 'flex', gap: mobile ? 16 : 32, padding: mobile ? '1.4rem 0' : '1.8rem 0', borderTop: i === 0 ? `1px solid ${C.line}` : 'none', borderBottom: `1px solid ${C.line}`, flexDirection: mobile ? 'column' : 'row' }}>
              <div style={{ flex: '0 0 140px', fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.85rem', letterSpacing: '.05em', color: C.goldL }}>{p.code}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '1.3rem', color: C.cream, marginBottom: 8 }}>{p.name}</div>
                <p style={{ fontFamily: FONT_SANS, fontWeight: 500, fontSize: '.95rem', lineHeight: 1.6, color: 'rgba(248,243,232,.65)', margin: 0, maxWidth: 62 + 'ch' }}>{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 34 }}><GoldButton size="lg" onClick={onEnquire}>Talk to a counsellor</GoldButton></div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Founder section
// ─────────────────────────────────────────────────────────────────────────
function Founder({ settings, mobile }) {
  if (!settings.founder_quote && !settings.founder_bio) return null;
  return (
    <section style={{ background: C.cream, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}><Seal size={56} /></div>
        {settings.founder_quote && (
          <blockquote style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: mobile ? '1.3rem' : '1.7rem', lineHeight: 1.5, color: C.navy, margin: '0 0 1.6rem' }}>
            “{settings.founder_quote}”
          </blockquote>
        )}
        {settings.founder_bio && (
          <p style={{ fontFamily: FONT_SANS, fontWeight: 500, fontSize: '.95rem', lineHeight: 1.7, color: C.slate, margin: 0 }}>{settings.founder_bio}</p>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Campus life — gallery + videos
// ─────────────────────────────────────────────────────────────────────────
function CampusLife({ gallery, videos, mobile }) {
  const [ref, shown] = useReveal();
  const [activeVideo, setActiveVideo] = useState(null);
  if (!gallery?.length && !videos?.length) return null;
  return (
    <section id="campus" ref={ref} style={{ background: C.paper, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHead title="Life on campus" sub="Classrooms, drill ground, hostel, and mess — the residential routine that turns preparation into habit." />
        <div style={{
          display: 'grid', gap: 14,
          gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(16px)', transition: 'opacity .6s ease, transform .6s ease',
        }}>
          {videos?.slice(0, 2).map((v, i) => (
            <div key={'v' + (v.id ?? i)} onClick={() => setActiveVideo(v)} style={{ gridColumn: mobile ? 'span 2' : 'span 2', gridRow: 'span 1', position: 'relative', cursor: 'pointer', aspectRatio: '16/10', background: C.navy, overflow: 'hidden' }}>
              {v.youtube_url && <img src={getYouTubeThumb(v.youtube_url)} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: .75 }} />}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'rgba(11,31,58,.75)', border: `1.5px solid ${C.gold}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.goldL, fontSize: '1.1rem' }}>▶</div>
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '.6rem .8rem', background: 'linear-gradient(to top, rgba(11,31,58,.9), transparent)', fontFamily: FONT_SANS, fontWeight: 600, fontSize: '.78rem', color: C.cream }}>{v.title}</div>
            </div>
          ))}
          {gallery?.slice(0, mobile ? 2 : 4).map((g, i) => (
            <div key={'g' + (g.id ?? i)} style={{ aspectRatio: '1', background: C.navy, overflow: 'hidden' }}>
              {g.image_url && <img src={g.image_url} alt={g.caption || 'Campus'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.opacity = 0; }} />}
            </div>
          ))}
        </div>
      </div>

      {activeVideo && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,31,58,.9)', zIndex: 9998, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setActiveVideo(null)}>
          <div style={{ width: '100%', maxWidth: 860, aspectRatio: '16/9' }} onClick={e => e.stopPropagation()}>
            <iframe title={activeVideo.title} src={getYouTubeEmbed(activeVideo.youtube_url)} allow="autoplay; encrypted-media" allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }} />
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Testimonials — quote slider, no reviewer name shown (privacy, per API notes)
// ─────────────────────────────────────────────────────────────────────────
function Testimonials({ testimonials, mobile }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!testimonials?.length) return;
    const t = setInterval(() => setIdx(i => (i + 1) % testimonials.length), 6000);
    return () => clearInterval(t);
  }, [testimonials]);
  if (!testimonials?.length) return null;
  const t = testimonials[idx];
  return (
    <section style={{ background: C.navy, padding: mobile ? '4rem 1.1rem' : '5.5rem 2rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
        <div style={{ marginBottom: 18 }}><Stars n={t.rating ?? 5} /></div>
        <blockquote key={idx} style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: mobile ? '1.25rem' : '1.55rem', lineHeight: 1.55, color: C.cream, margin: '0 0 1.2rem', animation: 'gnsiFade .5s ease' }}>
          <style>{'@keyframes gnsiFade { from { opacity: 0; } to { opacity: 1; } }'}</style>
          “{t.quote}”
        </blockquote>
        <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.8rem', letterSpacing: '.04em', color: C.goldL }}>— {t.attribution || 'Parent'}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          {testimonials.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Testimonial ${i + 1}`} style={{ width: 7, height: 7, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === idx ? C.gold : 'rgba(184,146,42,.3)' }} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Faculty
// ─────────────────────────────────────────────────────────────────────────
function Faculty({ faculty, mobile }) {
  const [ref, shown] = useReveal();
  if (!faculty?.length) return null;
  return (
    <section id="faculty" ref={ref} style={{ background: C.paper, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHead title="The people running the programme" sub="Subject teachers and house-parents who live on campus alongside the students they teach." />
        <div style={{
          display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: mobile ? 16 : 24,
          opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(16px)', transition: 'opacity .6s ease, transform .6s ease',
        }}>
          {faculty.map((f, i) => (
            <div key={f.id ?? i}>
              <div style={{ aspectRatio: '4/5', background: `linear-gradient(160deg, ${C.navy3}, ${C.navy})`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: 12 }}>
                {f.photo_url
                  ? <img src={f.photo_url} alt={f.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} />
                  : <span style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '2rem', color: C.goldL }}>{f.name?.[0] ?? '?'}</span>}
              </div>
              <div style={{ fontFamily: FONT_SERIF, fontWeight: 500, fontSize: '1.05rem', color: C.navy }}>{f.name}</div>
              <div style={{ fontFamily: FONT_SANS, fontWeight: 600, fontSize: '.78rem', color: C.gold, marginTop: 2 }}>{f.role}{f.subject ? ` · ${f.subject}` : ''}</div>
              {f.experience && <div style={{ fontFamily: FONT_SANS, fontSize: '.75rem', color: C.mist, marginTop: 2 }}>{f.experience}</div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Exam calendar + timeline — genuinely sequential, so numbering is earned
// ─────────────────────────────────────────────────────────────────────────
function ExamCalendar({ rows, mobile }) {
  if (!rows?.length) return null;
  return (
    <section id="calendar" style={{ background: C.navy, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <SectionHead dark title="This year's exam calendar" sub="Application windows and result dates for every entrance exam we prepare students for." />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: mobile ? 640 : 'auto' }}>
            <thead>
              <tr>
                {['Exam', 'Applications open', 'Applications close', 'Exam date', 'Result', 'Status'].map(h => (
                  <th key={h} style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.72rem', letterSpacing: '.04em', color: C.goldL, textAlign: 'left', padding: '0 1rem .9rem 0', borderBottom: `1px solid ${C.line}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? i}>
                  <td style={{ padding: '.9rem 1rem .9rem 0', borderBottom: `1px solid ${C.line}`, fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '1.02rem', color: C.cream }}>
                    {r.exam_name}{r.sub_label && <div style={{ fontFamily: FONT_SANS, fontStyle: 'normal', fontSize: '.72rem', color: 'rgba(248,243,232,.5)' }}>{r.sub_label}</div>}
                  </td>
                  <td style={{ ...tdStyle }}>{r.application_opens || '—'}</td>
                  <td style={{ ...tdStyle }}>{r.application_closes || '—'}</td>
                  <td style={{ ...tdStyle }}>{r.exam_date || '—'}</td>
                  <td style={{ ...tdStyle }}>{r.result_date || '—'}</td>
                  <td style={{ padding: '.9rem 1rem .9rem 0', borderBottom: `1px solid ${C.line}` }}>
                    <span style={{
                      fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.68rem', letterSpacing: '.03em', padding: '.25rem .6rem',
                      color: r.status === 'Open' ? C.green : r.status === 'Closed' ? C.red : C.goldL,
                      border: `1px solid ${r.status === 'Open' ? C.green : r.status === 'Closed' ? C.red : C.gold}`,
                    }}>{r.status || 'Upcoming'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
const tdStyle = { padding: '.9rem 1rem .9rem 0', borderBottom: `1px solid ${C.line}`, fontFamily: FONT_SANS, fontWeight: 500, fontSize: '.9rem', color: 'rgba(248,243,232,.75)' };

function Timeline({ items, mobile }) {
  if (!items?.length) return null;
  return (
    <section style={{ background: C.paper, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <SectionHead title="Between now and admission" sub="What happens, and when, once you've made an enquiry." />
        <div style={{ position: 'relative', paddingLeft: 28 }}>
          <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 1, background: C.line }} />
          {items.map((it, i) => (
            <div key={it.id ?? i} style={{ position: 'relative', paddingBottom: i === items.length - 1 ? 0 : 30 }}>
              <div style={{ position: 'absolute', left: -28, top: 4, width: 11, height: 11, transform: 'rotate(45deg)', background: it.status === 'done' ? C.gold : C.paper, border: `1.5px solid ${C.gold}` }} />
              <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.72rem', letterSpacing: '.04em', color: C.gold, marginBottom: 4 }}>{i + 1 < 10 ? `0${i + 1}` : i + 1}{it.event_date ? ` · ${it.event_date}` : ''}</div>
              <div style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '1.15rem', color: C.navy, marginBottom: 4 }}>{it.title}</div>
              {it.description && <p style={{ fontFamily: FONT_SANS, fontSize: '.88rem', color: C.slate, margin: 0, lineHeight: 1.55 }}>{it.description}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Blog
// ─────────────────────────────────────────────────────────────────────────

function BlogSection({ posts, mobile }) {
  if (!posts?.length) return null;
  return (
    <section style={{ background: C.paper, padding: mobile ? '4rem 1.1rem' : '6rem 2rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <SectionHead title="From the campus notice board" sub="Updates, results, and news from GNSI." />
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(3, 1fr)', gap: 24 }}>
          {posts.slice(0, 3).map((p, i) => (
            <div key={p.id ?? i}>
              {p.image_url && <div style={{ aspectRatio: '16/10', background: C.navy, overflow: 'hidden', marginBottom: 14 }}><img src={p.image_url} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none'; }} /></div>}
              <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.68rem', letterSpacing: '.04em', color: C.gold, marginBottom: 6 }}>{p.category?.toUpperCase()}</div>
              <div style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '1.2rem', color: C.navy, marginBottom: 8, lineHeight: 1.3 }}>{p.title}</div>
              <p style={{ fontFamily: FONT_SANS, fontSize: '.88rem', color: C.slate, lineHeight: 1.6, margin: 0, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Fee / admission callout
// ─────────────────────────────────────────────────────────────────────────
function AdmissionCallout({ settings, onEnquire, mobile }) {
  return (
    <section style={{ background: `linear-gradient(135deg, ${C.navy3}, ${C.navy})`, padding: mobile ? '3.6rem 1.1rem' : '5rem 2rem', textAlign: 'center', borderTop: `1px solid ${C.line}`, borderBottom: `1px solid ${C.line}` }}>
      <div style={{ maxWidth: 620, margin: '0 auto' }}>
        <h2 style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontWeight: 500, fontSize: mobile ? '1.7rem' : '2.1rem', color: C.cream, margin: '0 0 1rem' }}>
          {settings.admission_deadline ? `Admissions close ${settings.admission_deadline}` : 'Admissions are open for the next batch'}
        </h2>
        <p style={{ fontFamily: FONT_SANS, fontWeight: 500, fontSize: '1rem', color: 'rgba(248,243,232,.7)', margin: '0 0 2rem' }}>
          {settings.batch_start_date ? `Classes for the incoming batch begin ${settings.batch_start_date}.` : 'Seats are limited to keep our teacher-to-student ratio close.'}
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <GoldButton size="lg" onClick={onEnquire}>Enquire about admission</GoldButton>
          {settings.brochure_url && <GoldButton size="lg" variant="outline" href={settings.brochure_url}>Download brochure</GoldButton>}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Footer / contact
// ─────────────────────────────────────────────────────────────────────────
function Footer({ settings, schoolName, mobile }) {
  const social = [
    ['Facebook', settings.social_facebook], ['YouTube', settings.social_youtube],
    ['Instagram', settings.social_instagram], ['WhatsApp Channel', settings.social_whatsapp_channel],
  ].filter(([, url]) => url);

  return (
    <footer id="contact" style={{ background: C.navy, borderTop: `1px solid ${C.line}`, padding: mobile ? '3.5rem 1.1rem 2rem' : '5rem 2rem 2.5rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1.4fr 1fr 1fr', gap: mobile ? 36 : 50, marginBottom: 50 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Seal size={40} />
              <div style={{ fontFamily: FONT_SERIF, fontStyle: 'italic', fontSize: '1.2rem', color: C.cream }}>{schoolName}</div>
            </div>
            <p style={{ fontFamily: FONT_SANS, fontSize: '.88rem', lineHeight: 1.7, color: 'rgba(248,243,232,.55)', maxWidth: 340, margin: 0 }}>
              {settings.contact_address || 'Khangabok, Thoubal District, Manipur 795138'}
            </p>
          </div>

          <div>
            <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.75rem', letterSpacing: '.04em', color: C.goldL, marginBottom: 16 }}>CONTACT</div>
            {settings.contact_phone && <div style={{ marginBottom: 10 }}><a href={`tel:${settings.contact_phone}`} style={{ fontFamily: FONT_SANS, fontSize: '.9rem', color: 'rgba(248,243,232,.75)', textDecoration: 'none' }}>{settings.contact_phone}</a></div>}
            {settings.contact_email && <div style={{ marginBottom: 10 }}><a href={`mailto:${settings.contact_email}`} style={{ fontFamily: FONT_SANS, fontSize: '.9rem', color: 'rgba(248,243,232,.75)', textDecoration: 'none' }}>{settings.contact_email}</a></div>}
            {settings.contact_phone && <div><a href={waLink(settings.contact_phone, 'Hello, I have a question about admission at GNSI.')} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_SANS, fontSize: '.9rem', color: C.goldL, textDecoration: 'none' }}>Message on WhatsApp</a></div>}
          </div>

          <div>
            <div style={{ fontFamily: FONT_SANS, fontWeight: 700, fontSize: '.75rem', letterSpacing: '.04em', color: C.goldL, marginBottom: 16 }}>FOLLOW</div>
            {social.length > 0 ? social.map(([label, url]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_SANS, fontSize: '.9rem', color: 'rgba(248,243,232,.75)', textDecoration: 'none' }}>{label}</a>
              </div>
            )) : <div style={{ fontFamily: FONT_SANS, fontSize: '.85rem', color: 'rgba(248,243,232,.4)' }}>—</div>}
            {settings.app_apk_url && <div style={{ marginTop: 16 }}><a href={settings.app_apk_url} style={{ fontFamily: FONT_SANS, fontSize: '.85rem', color: C.goldL, textDecoration: 'none' }}>Download our app →</a></div>}
          </div>
        </div>

        <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 20, display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between', fontFamily: FONT_SANS, fontSize: '.75rem', color: 'rgba(248,243,232,.4)' }}>
          <span>© {new Date().getFullYear()} {schoolName}. All rights reserved.</span>
          {settings.google_review_score && <span>{settings.google_review_score} ★ on Google ({settings.google_review_count || 'reviews'})</span>}
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Floating WhatsApp CTA
// ─────────────────────────────────────────────────────────────────────────
function FloatingWhatsApp({ phone }) {
  if (!phone) return null;
  return (
    <a
      href={waLink(phone, 'Hello, I have a question about admission at GNSI.')}
      target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"
      style={{
        position: 'fixed', bottom: 22, right: 22, zIndex: 400, width: 54, height: 54, borderRadius: '50%',
        background: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 6px 18px rgba(0,0,0,.35)', textDecoration: 'none', fontSize: '1.5rem',
      }}
    >
      💬
    </a>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const mobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [data, setData] = useState({
    settings: {}, stats: {}, notices: [], rankers: [], gallery: [], videos: [],
    posts: [], reviews: [], banners: [], faculty: [], events: [], testimonials: [],
    examCalendar: [], timeline: [],
  });

  const load = useCallback(async () => {
    const [
      settings, stats, notices, rankers, gallery, videos, posts, reviews,
      banners, faculty, events, testimonials, examCalendar, timeline,
    ] = await Promise.all([
      getSettings(), getStats(), getActiveNotices(3), getRankers(), getGallery(),
      getVideos(), getPublishedPosts(3), getFeaturedReviews(6), getActiveBanners(),
      getFaculty(), getEvents(6), getFeaturedTestimonials(8), getExamCalendar(), getTimeline(),
    ]);
    setData({ settings, stats, notices, rankers, gallery, videos, posts, reviews, banners, faculty, events, testimonials, examCalendar, timeline });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const schoolName = data.settings.school_name || 'GNSI Khangabok';
  const courses = useMemo(() => ['Navodaya (JNVST)', 'Sainik School (AISSEE)', 'RMS'], []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: C.navy, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Fonts />
        <Seal size={64} />
      </div>
    );
  }

  return (
    <div style={{ background: C.paper, minHeight: '100vh' }}>
      <Fonts />
      <Header schoolName={schoolName} settings={data.settings} onEnquire={() => setModalOpen(true)} mobile={mobile} notice={data.notices?.[0]?.title} />
      <Hero settings={data.settings} stats={data.stats} mobile={mobile} onEnquire={() => setModalOpen(true)} hasNotice={!!data.notices?.[0]?.title} />
      <SelectionRoster rankers={data.rankers} />
      <RankerWall rankers={data.rankers} mobile={mobile} />
      <ResultBanners banners={data.banners} mobile={mobile} />
      <Programmes mobile={mobile} onEnquire={() => setModalOpen(true)} />
      <Founder settings={data.settings} mobile={mobile} />
      <CampusLife gallery={data.gallery} videos={data.videos} mobile={mobile} />
      <Testimonials testimonials={data.testimonials} mobile={mobile} />
      <Faculty faculty={data.faculty} mobile={mobile} />
      <ExamCalendar rows={data.examCalendar} mobile={mobile} />
      <Timeline items={data.timeline} mobile={mobile} />
      <BlogSection posts={data.posts} mobile={mobile} />
      <AdmissionCallout settings={data.settings} onEnquire={() => setModalOpen(true)} mobile={mobile} />
      <Footer settings={data.settings} schoolName={schoolName} mobile={mobile} />
      <FloatingWhatsApp phone={data.settings.contact_phone} />
      <EnquiryModal open={modalOpen} onClose={() => setModalOpen(false)} courses={courses} contactPhone={data.settings.contact_phone} />
    </div>
  );
}
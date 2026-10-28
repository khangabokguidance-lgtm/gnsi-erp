// LandingCreative.jsx — signature motion & storytelling layer for the landing page:
// scroll-progress bar, a cinematic "Legacy" section (starfield + count-up stats +
// marquee), an animated "Your path to selection" journey, and pointer-driven
// spotlight/tilt on cards. Everything respects prefers-reduced-motion and can be
// switched off from Website → Settings → "Creative Effects" = off.
import { useEffect, useRef, useState } from 'react';
import './LandingCreative.css';

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ── Scroll progress bar + pointer spotlight/tilt (event delegation, no per-card state) ──
export function CreativeFX() {
  useEffect(() => {
    const bar = document.getElementById('cxProgress');
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement.scrollHeight - window.innerHeight;
        if (bar) bar.style.transform = `scaleX(${h > 0 ? Math.min(1, window.scrollY / h) : 0})`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
    const SEL = '.lx-tile,.sec-tile,.course-card,.cx-step,.cx-stat,.papers-card,.mock-card';
    let last = null;
    const reset = (el) => { if (el) { el.style.removeProperty('--ang'); el.classList.remove('cx-tilt'); } };
    const onMove = (e) => {
      const el = e.target instanceof Element ? e.target.closest(SEL) : null;
      if (last && last !== el) reset(last);
      last = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
      if (!reduceMotion()) {
        // rotate around the axis perpendicular to the pointer offset (max ~5°)
        const dx = px - 0.5, dy = py - 0.5;
        el.style.setProperty('--ax', (-dy).toFixed(3));
        el.style.setProperty('--ay', dx.toFixed(3));
        el.style.setProperty('--ang', (Math.hypot(dx, dy) * 9).toFixed(2) + 'deg');
        el.classList.add('cx-tilt');
      }
    };
    // magnetic pull on primary buttons (a few px toward the pointer)
    const MAG = '.btn-gold,.adm-btn-primary,.cx-btn-p,.mm-act-p,.nv-primary,.mm-burger';
    let mag = null;
    const onMag = (e) => {
      const el = e.target instanceof Element ? e.target.closest(MAG) : null;
      if (mag && mag !== el) { mag.style.translate = ''; }
      mag = el;
      if (!el || reduceMotion()) return;
      const r = el.getBoundingClientRect();
      const dx = ((e.clientX - r.left) / r.width - 0.5) * 8, dy = ((e.clientY - r.top) / r.height - 0.5) * 6;
      el.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
    };
    const onLeave = () => { reset(last); last = null; if (mag) { mag.style.translate = ''; mag = null; } };
    if (fine) {
      document.addEventListener('pointermove', onMove, { passive: true });
      document.addEventListener('pointermove', onMag, { passive: true });
      document.addEventListener('pointerleave', onLeave);
    }
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointermove', onMag);
      document.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(raf);
    };
  }, []);
  return <div id="cxProgress" className="cx-progress" aria-hidden="true" />;
}

// ── Count-up number (starts when scrolled into view) ──
function CountUp({ value }) {
  const ref = useRef(null);
  const m = /^(\D*)(\d[\d,]*)(.*)$/.exec(String(value));
  const target = m ? parseInt(m[2].replace(/,/g, ''), 10) : NaN;
  const [n, setN] = useState(reduceMotion() ? target : 0);
  useEffect(() => {
    if (!m || Number.isNaN(target) || reduceMotion()) return undefined;
    const el = ref.current;
    let raf = 0;
    const io = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), dur = 1600;
      const tick = (t) => {
        const k = Math.min(1, (t - t0) / dur);
        setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || Number.isNaN(target)) return <span ref={ref}>{value}</span>;
  return <span ref={ref}>{m[1]}{n.toLocaleString('en-IN')}{m[3]}</span>;
}

// ── Drifting gold/white starfield on a canvas (pauses off-screen) ──
function Starfield() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv || reduceMotion()) return undefined;
    const ctx = cv.getContext('2d');
    let w = 0, h = 0, raf = 0, visible = true;
    const stars = Array.from({ length: 70 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4,
      s: Math.random() * 0.00006 + 0.00002, a: Math.random() * Math.PI * 2,
      gold: Math.random() > 0.55,
    }));
    const fit = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(cv);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) raf = requestAnimationFrame(draw); });
    io.observe(cv);
    function draw(t) {
      if (!visible) return;
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.y -= s.s * 16; if (s.y < -0.02) { s.y = 1.02; s.x = Math.random(); }
        const tw = 0.45 + 0.55 * Math.sin(t / 900 + s.a);
        ctx.globalAlpha = tw * 0.9;
        ctx.fillStyle = s.gold ? '#F2C66B' : '#FFFFFF';
        ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); };
  }, []);
  return <canvas ref={ref} className="cx-stars" aria-hidden="true" />;
}

const MARQUEE = [
  'Sainik Schools · AISSEE', 'Jawahar Navodaya Vidyalayas · JNVST', 'Rashtriya Military Schools · RMS CET',
  'Residential campus', 'Weekly mock tests', 'Experienced faculty', 'Parents Portal', 'Online admission',
];

// ── Legacy: cinematic stats band + marquee ──
export function LegacySection({ site, goToTab }) {
  const stats = site.stats;
  return (
    <section className="cx-legacy" aria-label="GNSI results at a glance">
      <Starfield />
      <div className="cx-aurora" aria-hidden="true" />
      <div className="lx-wrap cx-legacy-in">
        <div className="cx-kicker">A decade of selections</div>
        <h2 className="cx-title">Where discipline becomes <em>distinction</em></h2>
        <p className="cx-sub">Every year, students from Khangabok walk into Sainik Schools, Navodaya Vidyalayas and Military Schools across India. These are their numbers.</p>
        <div className="cx-stats" style={{ '--n': stats.length }}>
          {stats.map((s) => (
            <div className="cx-stat" key={s.label}>
              <div className="cx-num"><CountUp value={s.value} /></div>
              <div className="cx-lbl">{s.label}</div>
            </div>
          ))}
        </div>
        <div className="cx-cta">
          <button type="button" className="cx-btn cx-btn-p" onClick={() => goToTab('results')}>See the results</button>
          <button type="button" className="cx-btn" onClick={() => goToTab('rankers')}>Meet the toppers</button>
        </div>
      </div>
      <div className="cx-marquee" aria-hidden="true">
        <div className="cx-marquee-track">
          {[0, 1].map((k) => MARQUEE.map((t) => <span key={k + t}>{t}<i>◆</i></span>))}
        </div>
      </div>
    </section>
  );
}

// ── Journey: five steps with an animated connecting line ──
const STEPS = [
  { n: 1, t: 'Enquire & apply', d: 'Apply online or talk to our office — the first call is within a day.', href: '/apply', cta: 'Apply online' },
  { n: 2, t: 'Scholarship test', d: 'A free demo class and a monthly test open to every aspirant.', tab: 'scholarship', cta: 'Register free' },
  { n: 3, t: 'Admission & hostel', d: 'Confirm your seat and settle into a disciplined residential campus.', tab: 'hostel', cta: 'Hostel life' },
  { n: 4, t: 'Train with mentors', d: 'Daily classes, weekly mock tests, fitness and interview readiness.', tab: 'courses', cta: 'View courses' },
  { n: 5, t: 'Selection', d: 'Sit the national entrance exam — and wear the uniform.', tab: 'results', cta: 'See results' },
];

export function JourneySection({ goToTab }) {
  const ref = useRef(null);
  const [on, setOn] = useState(reduceMotion());
  useEffect(() => {
    if (on) return undefined;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [on]);
  return (
    <section className={'cx-journey' + (on ? ' cx-on' : '')} ref={ref} aria-label="Your path to selection">
      <div className="lx-wrap">
        <div className="cx-kicker cx-kicker-d">Your path</div>
        <h2 className="cx-title cx-title-d">From first call to <em>final selection</em></h2>
        <ol className="cx-steps">
          <li className="cx-line" aria-hidden="true"><i /></li>
          {STEPS.map((s, i) => (
            <li className="cx-step" key={s.n} style={{ '--d': `${0.25 + i * 0.22}s` }}>
              <span className="cx-node">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
              {s.href
                ? <a className="cx-link" href={s.href}>{s.cta} →</a>
                : <button type="button" className="cx-link" onClick={() => goToTab(s.tab)}>{s.cta} →</button>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Back-to-top button (appears after the first screen) ──
export function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 700);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <button type="button" className={'cx-top' + (show ? ' show' : '')} aria-label="Back to top" tabIndex={show ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: reduceMotion() ? 'auto' : 'smooth' })}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
    </button>
  );
}

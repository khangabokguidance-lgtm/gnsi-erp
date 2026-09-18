import React, { useEffect, useState, useRef } from 'react';
import {
  getActiveNotices, getRankers, getGallery, getVideos, getYouTubeThumb, getYouTubeEmbed,
  getPublishedPosts, getFeaturedReviews, getPapers, getActiveBanners, getFaculty,
  getLiveKPIs, getEvents, submitEnquiry, submitScholarRegistration, submitGrievance,
  getStats, getFeaturedTestimonials, getExamCalendar, getTimeline
} from './websiteApi';
import { supabase } from './supabase';
import ParentsPortal from './ParentsPortal';
import PublicFeeLookup from './PublicFeeLookup';

// TODO: consider moving to Supabase storage for consistency with other site assets
const FOUNDER_PHOTO_URL = "https://i.postimg.cc/Vsd7VXZ7/DSC05195.jpg";

// GNSI logo/emblem (crest + "GNSI" wordmark + tagline, square format) —
// used in the nav bar, favicon, and header. Lives in the gnsi-public
// bucket's "emblem" folder (same bucket as TEN_YEARS_BANNER_URL/
// RESULT_POSTER_URL below).
const EMBLEM_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/emblem/gnsi-emblem-new.png";

// 10-Years celebration banner — replaces the old rotating result-banner
// slider below with a single static photo. Lives in the gnsi-public
// bucket's existing "banners" folder (same bucket as EMBLEM_URL above).
const TEN_YEARS_BANNER_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/gnsi-10-years-banner.png";

// Latest result/achievement poster — shown as a popup 10s after page load,
// then collapses into a small sticky corner badge. Swap this URL (or the
// path inside it) whenever there's a new poster to feature; upload to the
// same gnsi-public bucket, "posters" folder, following the pattern of
// TEN_YEARS_BANNER_URL above.
const RESULT_POSTER_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/gnsi-result-poster.png";

export default function LandingPage({ onLogin }) {
  // ═══ DROPDOWN NAVIGATION — categories & subsections ═══
  const [expandedCat, setExpandedCat] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { catIdx, itemIdx }
  const [isPortalOpen, setIsPortalOpen] = useState(false);
  const [isFeeOpen, setIsFeeOpen] = useState(false);
  const [feePaymentInfo, setFeePaymentInfo] = useState({ upi_id: '', upi_qr_url: '' });
  const [activeTab, setActiveTab] = useState('home');
  const tabContentRef = useRef(null);

  // ═══ ADMIT CARD / RESULT PORTAL (public, fee-gated, real data) ═══
  // examTypes: live list pulled from the real `exam_types` table so the
  // "Select Exam" dropdowns always match whatever exams actually exist in
  // the exam module (Exams.jsx / ParentsPortal), instead of a hardcoded
  // guess list that can silently drift out of sync.
  const [portalExamTypes, setPortalExamTypes] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.from('exam_types').select('id, name').order('name', { ascending: true });
        if (!cancelled) setPortalExamTypes(data || []);
      } catch (e) {
        console.error('Failed to load exam types:', e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ═══ RESULT POSTER POPUP ═══
  // 'hidden' → nothing shown yet (first 10s of the visit)
  // 'popup'  → full popup shown (auto-appears at 10s)
  // 'badge'  → collapsed into a small sticky corner badge (after popup is closed)
  // 'closed' → fully dismissed for this visit, nothing shown
  const [posterState, setPosterState] = useState('hidden');

  const defaultGalleryData = [
    {
      title: 'Campus & Facilities',
      count: '12 Photos',
      items: [
        { icon: '🏫', label: 'Main Academic Block' },
        { icon: '📚', label: 'Library' },
        { icon: '⚽', label: 'Sports Ground' },
        { icon: '🌳', label: 'Campus Grounds' },
        { icon: '🛡️', label: 'Front Gate & Entrance' },
        { icon: '🚪', label: 'Reception & Office' },
      ]
    },
    {
      title: 'Classrooms & Academics',
      count: '15 Photos',
      items: [
        { icon: '✍️', label: 'Classroom Session' },
        { icon: '📝', label: 'Mock Test Day' },
        { icon: '🔬', label: 'Science Lab' },
        { icon: '🧮', label: 'Doubt Clearing Session' },
        { icon: '👨‍🏫', label: 'Faculty Teaching' },
        { icon: '📊', label: 'Progress Review' },
      ]
    },
    {
      title: 'Hostel Life',
      count: '10 Photos',
      items: [
        { icon: '🏠', label: 'Hostel Block' },
        { icon: '🍽️', label: 'Dining Hall' },
        { icon: '🌅', label: 'Morning Assembly' },
        { icon: '📖', label: 'Evening Study Hour' },
        { icon: '🎯', label: 'Discipline Drill' },
        { icon: '🛏️', label: 'Hostel Rooms' },
      ]
    },
    {
      title: 'Events & Ceremonies',
      count: '18 Photos',
      items: [
        { icon: '🎖️', label: 'Award Ceremony' },
        { icon: '🎉', label: '10th Anniversary Celebration' },
        { icon: '🇮🇳', label: 'Republic Day Parade' },
        { icon: '🎤', label: 'Guest Lecture' },
        { icon: '🏆', label: 'Topper Felicitation' },
        { icon: '🎭', label: 'Annual Function' },
      ]
    },
    {
      title: 'Achievements & Awards',
      count: '9 Photos',
      items: [
        { icon: '🏅', label: 'Sainik School Selection 2026' },
        { icon: '📜', label: 'Institute Certificate of Excellence' },
        { icon: '🥇', label: 'RMS Rank Holders' },
        { icon: '🎓', label: 'Navodaya Batch Success' },
        { icon: '🖼️', label: 'Founder with Toppers' },
        { icon: '⭐', label: 'State-level Recognition' },
      ]
    },
  ];

  const [galleryData, setGalleryData] = useState(defaultGalleryData);

  useEffect(() => {
    (async () => {
      try {
        const images = await getGallery();
        if (!images.length) return; // keep defaultGalleryData placeholders

        // Group flat rows by category (falls back to a single "Gallery" bucket
        // if the table has no category column set on any row)
        const byCat = {};
        images.forEach((img) => {
          const cat = img.category || 'Gallery';
          if (!byCat[cat]) byCat[cat] = [];
          byCat[cat].push({
            icon: '📷',
            label: img.caption || '',
            img: img.image_url,
          });
        });

        const grouped = Object.entries(byCat).map(([title, items]) => ({
          title,
          count: `${items.length} Photo${items.length === 1 ? '' : 's'}`,
          items,
        }));

        if (grouped.length) setGalleryData(grouped);
      } catch (e) {
        console.error('Gallery load failed:', e);
        // keep defaultGalleryData placeholders on error
      }
    })();
  }, []);

  // ═══ VIDEOS (Home preview) ═══
  // Mirrors the galleryData pattern above: real data from getVideos()
  // once loaded, used only for the small Home-tab preview grid below.
  // The full Videos tab itself still uses its own existing DOM-injection
  // script (script block "VIDEOS" further down) — untouched here.
  const [videosData, setVideosData] = useState([]);
  useEffect(() => {
    (async () => {
      try {
        const list = await getVideos();
        if (list.length) setVideosData(list);
      } catch (e) {
        console.error('Home videos preview load failed:', e);
      }
    })();
  }, []);

  const openLightbox = (catIdx, itemIdx) => setLightbox({ catIdx, itemIdx });
  const closeLightbox = () => setLightbox(null);
  const navLightbox = (dir) => {
    setLightbox((cur) => {
      if (!cur) return cur;
      const items = galleryData[cur.catIdx].items;
      const nextIdx = (cur.itemIdx + dir + items.length) % items.length;
      return { catIdx: cur.catIdx, itemIdx: nextIdx };
    });
  };

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') navLightbox(1);
      if (e.key === 'ArrowLeft') navLightbox(-1);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightbox]);

  // ═══ RESULT POSTER — auto-popup 10s after page load ═══
  // Shows once per visit (sessionStorage-gated), then collapses to a small
  // sticky corner badge instead of disappearing entirely, so visitors who
  // dismissed the popup can still reopen it later in the same visit.
  useEffect(() => {
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem('gnsi_poster_shown') === '1';
    } catch (err) { /* sessionStorage unavailable — fall back to showing once per tab load */ }
    if (alreadyShown) return;
    const timer = setTimeout(() => {
      setPosterState('popup');
      try { sessionStorage.setItem('gnsi_poster_shown', '1'); } catch (err) { /* ignore */ }
    }, 10000);
    return () => clearTimeout(timer);
  }, []);


  // Nav priority, per site review: surface only what a prospective parent
  // needs fastest (Admissions, Results, Fee Payment, Contact, Courses,
  // Portal) as direct links; everything else (syllabus, gallery, faculty,
  // blog, etc.) lives under one "More" menu instead of five separate
  // dropdowns competing for attention.
  //
  // A category with a single link renders as a direct clickable item (no
  // dropdown arrow); a category with multiple links still expands like
  // before. "More" bundles every lower-priority section into one dropdown.
  const navCategories = [
    { label: 'Admissions', icon: '📋', links: [{ label: 'Admissions', href: '#enquiry' }] },
    { label: 'Results', icon: '🏆', links: [{ label: 'Results', href: '#results' }] },
    { label: 'Fee Payment', icon: '💳', links: [{ label: 'Fee Payment', href: '#fee-payment' }] },
    { label: 'Contact', icon: '📍', links: [{ label: 'Contact', href: '#contact' }] },
    { label: 'Courses', icon: '📚', links: [{ label: 'Courses', href: '#courses' }] },
    { label: 'Portal', icon: '🔑', links: [{ label: 'Admit Card / Portal', href: '#portal' }] },
    {
      label: 'More',
      icon: '⋯',
      links: [
        { label: 'Syllabus', href: '#syllabus' },
        { label: 'Question Papers', href: '#question-papers' },
        { label: 'Exam Calendar', href: '#exam-calendar' },
        { label: 'Mock Tests', href: '#mock-tests' },
        { label: "Toppers' Wall", href: '#rankers' },
        { label: 'Student Reviews', href: '#reviews' },
        { label: 'Notices', href: '#notices' },
        { label: 'Blog & News', href: '#blog' },
        { label: 'Scholarship / Free Test', href: '#scholarship' },
        { label: 'Important Dates', href: '#important-dates' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Faculty', href: '#faculty' },
        { label: 'Facilities', href: '#facilities' },
        { label: 'Gallery', href: '#gallery' },
        { label: 'Videos', href: '#videos' },
        { label: 'Events', href: '#events' },
        { label: 'About GNSI', href: '#about' },
        { label: "Director's Message", href: '#head-institute' },
        { label: 'Download App', href: '#app-download' },
        { label: 'Helpdesk / Grievance', href: '#helpdesk' },
      ]
    },
  ];

  const toggleCat = (idx) => setExpandedCat(expandedCat === idx ? null : idx);
  const closeCats = () => setExpandedCat(null);
  const closeMobile = () => { setMobileOpen(false); setExpandedCat(null); };

  // ═══ TABBED SECTIONS ═══
  // isPopRef guards against re-pushing history when we're the ones
  // reacting to a popstate (back/forward) event — without this, every
  // Back press would immediately push a new forward entry right back on
  // top, and the user would need to press Back twice to actually move.
  const isPopRef = useRef(false);

  // NOTE: we deliberately do NOT replaceState() the initial history entry
  // on load. That entry represents "how the user arrived here" — a
  // Google result, a WhatsApp link, a bookmark — and rewriting it (even
  // just to attach {tab:'home'} state) risks the browser treating it as
  // an in-page navigation rather than the real referrer, which can leave
  // Back unable to exit the site at all (confirmed in the wild, worse
  // than the smaller issue this was meant to fix). onPopState below
  // already treats a null/missing e.state as 'home', so the first entry
  // needs no special handling — leave it exactly as the browser made it.

  // Switches the visible content section and, if a specific in-page
  // element id is given (e.g. the #contact block inside "enquiry"),
  // scrolls to it once that tab's content has rendered.
  const goToTab = (id, scrollToId) => {
    setActiveTab((prev) => {
      // Only touch history when the tab is actually changing, and never
      // push a new entry while we're mid-way through handling a
      // popstate (back/forward) — that would immediately cancel out the
      // Back press the user just made.
      if (prev !== id && !isPopRef.current) {
        try {
          window.history.pushState({ tab: id }, '', '#' + id);
        } catch (e) { /* history API unavailable — ignore */ }
      }
      return id;
    });
    setTimeout(() => {
      const targetEl = document.getElementById(scrollToId || id);
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  // Browser/phone back button: pop back through tab history and land on
  // Home rather than leaving the site. If the popped state carries a tab
  // id, show that tab; otherwise (e.g. the very first history entry) fall
  // back to Home.
  useEffect(() => {
    const onPopState = (e) => {
      isPopRef.current = true;
      const tab = e.state && e.state.tab ? e.state.tab : 'home';
      setActiveTab(tab);
      // Release the guard on the next tick, after this render (and any
      // effects it triggers) has settled, so a later real goToTab() call
      // can push history normally again.
      setTimeout(() => { isPopRef.current = false; }, 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Outside-click auto-close: when on any tab other than Home, a click that
  // lands outside the tabbed content region (and outside the tab strip,
  // nav and mobile menu, which have their own interactive elements) sends
  // the user back to Home. Clicks inside a section, or on the tab strip
  // itself, never trigger this.
  useEffect(() => {
    if (activeTab === 'home') return;
    const handleOutsideTabClick = (e) => {
      if (tabContentRef.current && tabContentRef.current.contains(e.target)) return;
      if (e.target.closest('.tab-nav-strip')) return;
      if (e.target.closest('.hero')) return;
      if (e.target.closest('nav')) return;
      if (e.target.closest('.mob-menu')) return;
      if (e.target.closest('.lb-overlay')) return;
      goToTab('home');
    };
    document.addEventListener('click', handleOutsideTabClick);
    return () => document.removeEventListener('click', handleOutsideTabClick);
  }, [activeTab]);

  // Nav-menu links point at in-page hashes (e.g. "#enquiry", "#contact").
  // "#contact" is a sub-element inside the "enquiry" tab, not a tab of its
  // own, so it maps to the enquiry tab and then scrolls to #contact.
  const goToHash = (href) => {
    const hashId = (href || '').replace('#', '');
    if (!hashId) return;
    if (hashId === 'contact') { goToTab('enquiry', 'contact'); return; }
    goToTab(hashId);
  };

  // cat drives the tab pill's accent color (see .tab-nav-btn.cat-* CSS):
  // gold = core/home, blue = institute info, green = results & community,
  // red = academics/exam-prep, purple = admin/utility.
  const tabList = [
    { id: 'home', label: 'Home', cat: 'gold' },
    { id: 'courses', label: 'Courses', cat: 'red' },
    { id: 'rankers', label: 'Toppers', cat: 'green' },
    { id: 'results', label: 'Results', cat: 'green' },
    { id: 'reviews', label: 'Reviews', cat: 'green' },
    { id: 'about', label: 'About Us', cat: 'blue' },
    { id: 'head-institute', label: 'Head of Institute', cat: 'blue' },
    { id: 'faculty', label: 'Faculty', cat: 'blue' },
    { id: 'facilities', label: 'Facilities', cat: 'blue' },
    { id: 'videos', label: 'Videos', cat: 'blue' },
    { id: 'notices', label: 'Notices', cat: 'purple' },
    { id: 'blog', label: 'Blog', cat: 'blue' },
    { id: 'gallery', label: 'Gallery', cat: 'green' },
    { id: 'events', label: 'Events', cat: 'purple' },
    { id: 'scholarship', label: 'Scholarship', cat: 'red' },
    { id: 'mock-tests', label: 'Mock Tests', cat: 'red' },
    { id: 'question-papers', label: 'Question Papers', cat: 'red' },
    { id: 'syllabus', label: 'Syllabus', cat: 'red' },
    { id: 'exam-calendar', label: 'Exam Calendar', cat: 'red' },
    { id: 'important-dates', label: 'Important Dates', cat: 'purple' },
    { id: 'faq', label: 'FAQ', cat: 'purple' },
    { id: 'enquiry', label: 'Enquire', cat: 'gold' },
    { id: 'fee-payment', label: 'Fee Payment', cat: 'gold' },
    { id: 'portal', label: 'Parents Portal', cat: 'gold' },
    { id: 'app-download', label: 'App Download', cat: 'purple' },
    { id: 'helpdesk', label: 'Helpdesk', cat: 'purple' },
  ];

  // Click-to-open nav dropdowns (not hover) close on an outside click,
  // since there's no mouseleave handler doing that anymore.
  useEffect(() => {
    if (expandedCat === null) return;
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.nav-cat') && !e.target.closest('.mob-cat')) setExpandedCat(null);
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [expandedCat]);

  // Lock body scroll while the mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
  }, [mobileOpen]);

  useEffect(() => {
    // Scroll reveal animation
    const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('vis');
        }
      });
    }, { threshold: 0.1 });
    reveals.forEach(el => observer.observe(el));

    // Countdown timer removed along with the countdown bar (admissions closed Feb).
    // If you bring back a countdown for the next cycle, restore this block and
    // re-add the .countdown-bar JSX with #cd-d/#cd-h/#cd-m/#cd-s elements.

    // Sticky bar
    const stickyBar = document.getElementById('stickyBar');
    let stickyShown = false;
    const stickyHandler = () => {
      if (window.scrollY > 400 && !stickyShown) {
        stickyBar?.classList.add('show');
        stickyShown = true;
      }
    };
    window.addEventListener('scroll', stickyHandler);

    // Scroll progress
    const sp = document.getElementById('sp');
    const scrollHandler = () => {
      const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (sp) sp.style.width = (scrollTop / scrollHeight * 100) + '%';
    };
    window.addEventListener('scroll', scrollHandler);

    // Result banner slider
    let rbIndex = 0;
    const rbTrack = document.getElementById('rbTrack');
    const rbDots = document.getElementById('rbDots');
    const rbSlides = rbTrack?.children.length || 0;
    if (rbDots && rbSlides > 0) {
      for (let i = 0; i < rbSlides; i++) {
        const dot = document.createElement('div');
        dot.className = 'rb-dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => { rbIndex = i; updateRB(); };
        rbDots.appendChild(dot);
      }
    }
    window.rbSlide = (dir) => {
      rbIndex = (rbIndex + dir + rbSlides) % rbSlides;
      updateRB();
    };
    const updateRB = () => {
      if (rbTrack) rbTrack.style.transform = 'translateX(-' + (rbIndex * 100) + '%)';
      rbDots?.querySelectorAll('.rb-dot').forEach((d, i) => d.classList.toggle('active', i === rbIndex));
    };
    const rbAuto = setInterval(() => { rbIndex = (rbIndex + 1) % rbSlides; updateRB(); }, 5000);

    // Testimonials slider
    let tIndex = 0;
    const testiTrack = document.getElementById('testiTrack');
    const testiDots = document.getElementById('testiDots');
    const testiCards = testiTrack?.children.length || 0;
    if (testiDots && testiCards > 0) {
      for (let i = 0; i < testiCards; i++) {
        const dot = document.createElement('div');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => { tIndex = i; updateT(); };
        testiDots.appendChild(dot);
      }
    }
    window.tSlide = (dir) => {
      tIndex = (tIndex + dir + testiCards) % testiCards;
      updateT();
    };
    const updateT = () => {
      if (testiTrack) testiTrack.style.transform = 'translateX(-' + (tIndex * 100) + '%)';
      testiDots?.querySelectorAll('.slider-dot').forEach((d, i) => d.classList.toggle('active', i === tIndex));
    };

    // Bar fill animation
    const bars = document.querySelectorAll('.bar-fill');
    const barObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const w = entry.target.getAttribute('data-w');
          if (w) entry.target.style.width = w + '%';
        }
      });
    }, { threshold: 0.5 });
    bars.forEach(b => barObserver.observe(b));

    // Count up animation
    const counters = document.querySelectorAll('.count-up');
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.getAttribute('data-target'));
          const suffix = el.getAttribute('data-suffix') || '';
          let current = 0;
          const step = Math.max(1, Math.floor(target / 50));
          const timer = setInterval(() => {
            current += step;
            if (current >= target) { current = target; clearInterval(timer); }
            el.textContent = current + suffix;
          }, 30);
          countObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(c => countObserver.observe(c));
// helpers
const escapeHtml = (str) =>
  (str ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// ---- 1. LIVE KPI DASHBOARD ----
(async () => {
  try {
    const kpi = await getLiveKPIs();
    const set = (id, val) => { const el = document.getElementById(id); if (el) { el.textContent = val; el.classList.remove('lpulse'); } };
    set('kpi-staff', kpi.staff);
    set('kpi-att', kpi.present);
    set('kpi-exams', kpi.exams);
    set('kpi-enq', kpi.enquiries);
    set('kpi-notice', kpi.latestNotice);
  } catch (e) { console.error('KPI load failed:', e); }
})();

// ---- 2. NOTICES (top 3 active, into #publicNoticeCards) ----
(async () => {
  const grid = document.getElementById('publicNoticeCards');
  if (!grid) return;
  try {
    const notices = await getActiveNotices(3);
    if (!notices.length) return; // leave existing static cards as fallback
    grid.innerHTML = notices.map(n => {
      const cls = n.priority === 'High' ? 'urgent' : n.priority === 'Low' ? '' : 'success';
      const badgeCls = n.priority === 'High' ? 'badge-limited' : n.priority === 'Low' ? 'badge-weekly' : 'badge-open';
      return `
        <div class="notice-card ${cls}">
          <span class="notice-badge ${badgeCls}">${escapeHtml(n.priority || 'Notice')}</span>
          <h3>${escapeHtml(n.title)}</h3>
          <p>${escapeHtml(n.body)}</p>
          <div class="notice-date">${fmtDate(n.notice_date)}</div>
        </div>`;
    }).join('');
  } catch (e) { console.error('Notices load failed:', e); }
})();

// ---- 3. RANKER WALL (into #rankerGrid) ----
(async () => {
  const grid = document.getElementById('rankerGrid');
  if (!grid) return;
  try {
    const rankers = await getRankers();
    if (!rankers.length) return;
    grid.innerHTML = rankers.map((r, i) => `
      <div class="ranker-card reveal-scale vis">
        ${r.rank ? `<div class="ranker-badge">${escapeHtml(r.rank)}</div>` : ''}
        <div class="rc-rank">${String(i + 1).padStart(2, '0')}</div>
        <div class="ranker-photo">
          ${r.photo_url ? `<img src="${escapeHtml(r.photo_url)}" alt="${escapeHtml(r.name)}" onerror="this.style.display='none'" />` : escapeHtml((r.name || 'S')[0])}
        </div>
        <div class="rc-shade"></div>
        <div class="rc-edge"></div>
        <div class="rc-cap">
          <h4>${escapeHtml(r.name)}</h4>
          <div class="ranker-school">${escapeHtml(r.school || '')}</div>
          <div class="ranker-batch">${escapeHtml(r.batch || '')}</div>
        </div>
      </div>`).join('');
    } catch (e) { console.error('Rankers load failed:', e); }
})();

// ---- 4. GOOGLE REVIEWS (into #reviewsGrid) ----
(async () => {
  const grid = document.getElementById('reviewsGrid');
  if (!grid) return;
  try {
    const reviews = await getFeaturedReviews(6);
    if (!reviews.length) return;
    grid.innerHTML = reviews.map(r => `
      <div class="review-card">
        <div class="review-top">
          <div class="review-av">${escapeHtml((r.reviewer_name || 'A')[0])}</div>
          <div>
            <div class="review-name">${escapeHtml(r.reviewer_name)}</div>
            <div class="review-date">${fmtDate(r.review_date)}</div>
          </div>
        </div>
        <div class="review-stars">${'★'.repeat(r.rating || 5)}${'☆'.repeat(5 - (r.rating || 5))}</div>
        <p class="review-text">"${escapeHtml(r.review_text)}"</p>
      </div>`).join('');
  } catch (e) { console.error('Reviews load failed:', e); }
})();

// ---- 5. BLOG / NEWS (into #blogGrid) ----
(async () => {
  const grid = document.getElementById('blogGrid');
  if (!grid) return;
  try {
    const posts = await getPublishedPosts(6);
    if (!posts.length) return;
    grid.innerHTML = posts.map(p => `
      <div class="blog-card">
        <div class="blog-thumb">
          ${p.image_url ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" onerror="this.style.display='none'" />` : '📰'}
          <span class="blog-cat">${escapeHtml(p.category || 'News')}</span>
        </div>
        <div class="blog-body">
          <div class="blog-date">${fmtDate(p.published_date)}</div>
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml((p.body || '').slice(0, 140))}${(p.body || '').length > 140 ? '…' : ''}</p>
        </div>
      </div>`).join('');
  } catch (e) { console.error('Blog load failed:', e); }
})();

// (Gallery data is now fetched via a React useEffect inside the component,
// grouped by category into `galleryData` state — see near the top of the
// component body. The old #galleryGrid DOM-injection block was removed.)

// ---- 7. VIDEOS (main embed into #mainVideoEmbed, list into #videoListEl) ----
(async () => {
  const list = document.getElementById('videoListEl');
  if (!list) return;
  try {
    const videos = await getVideos();
    if (!videos.length) {
      list.innerHTML = '<p style="color:rgba(230,230,230,.85);font-family:Inter,sans-serif;font-size:.8rem;letter-spacing:.02em;text-transform:uppercase;padding:.5rem 0">Videos coming soon</p>';
      return;
    }
    list.innerHTML = videos.map((v, i) => `
      <div class="video-item" data-embed-url="${escapeHtml(v.youtube_url || '')}" data-index="${i}">
        <div class="video-thumb">
          ${getYouTubeThumb(v.youtube_url) ? `<img src="${getYouTubeThumb(v.youtube_url)}" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'" />` : '▶'}
        </div>
        <div>
          <div class="video-item-title">${escapeHtml(v.title)}</div>
          <div class="video-item-sub">${escapeHtml(v.category || '')}${v.description ? ' · ' + escapeHtml(v.description) : ''}</div>
        </div>
      </div>`).join('');

    // Wire click handlers + load first video into the main embed automatically
    list.querySelectorAll('.video-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = item.getAttribute('data-embed-url');
        if (url && window.loadMainVideo) window.loadMainVideo(url);
      });
    });
    if (videos[0]?.youtube_url && window.loadMainVideo) {
      window.loadMainVideo(videos[0].youtube_url);
    }
  } catch (e) { console.error('Videos load failed:', e); }
})();

// ---- 7b. EVENTS & SCHEDULE (into #eventsListEl) ----
(async () => {
  const list = document.getElementById('eventsListEl');
  if (!list) return;
  try {
    const events = await getEvents();
    if (!events.length) {
      list.innerHTML = '<p style="color:var(--mist);font-family:Inter,sans-serif;font-size:.85rem;letter-spacing:.02em;padding:.5rem 0">No upcoming events scheduled right now — check back soon.</p>';
      return;
    }
    const monthAbbr = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    list.innerHTML = events.map(ev => {
      const d = new Date(ev.event_date + 'T00:00:00');
      const day = String(d.getDate()).padStart(2, '0');
      const month = monthAbbr[d.getMonth()];
      return `
        <div class="event-card reveal">
          <div class="event-date-block">
            <div class="day">${day}</div>
            <div class="month">${month}</div>
          </div>
          <div class="event-body">
            <h3>${escapeHtml(ev.title)}</h3>
            ${ev.description ? `<span>${escapeHtml(ev.description)}</span>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) { console.error('Events load failed:', e); }
})();

// ---- 8. QUESTION PAPERS (grouped by exam_type, into #papersGrid) ----
(async () => {
  const grid = document.getElementById('papersGrid');
  if (!grid) return;
  try {
    const papers = await getPapers();
    if (!papers.length) return;
    const grouped = papers.reduce((acc, p) => {
      const k = p.exam_type || 'NVS';
      (acc[k] = acc[k] || []).push(p);
      return acc;
    }, {});
    const examClass = { NVS: 'nvs', Sainik: 'sainik', RMS: 'rms' };
    grid.innerHTML = Object.entries(grouped).map(([exam, papers]) => `
      <div class="papers-card ${examClass[exam] || ''}">
        <h3>${escapeHtml(exam)} Question Papers</h3>
        <div class="papers-sub">${papers.length} paper${papers.length > 1 ? 's' : ''} available</div>
        ${papers.map(p => `
          <a class="paper-link" href="${p.pdf_url ? escapeHtml(p.pdf_url) : '#'}" target="_blank" rel="noopener noreferrer">
            <span class="paper-name">${escapeHtml(p.title)} (${escapeHtml(p.class_level || '')})</span>
            <span class="paper-dl">⬇</span>
          </a>`).join('')}
      </div>`).join('');
  } catch (e) { console.error('Papers load failed:', e); }
})();

// ---- 9. RESULT BANNERS (into #rbTrack, replacing slider slides) ----
(async () => {
  const track = document.getElementById('rbTrack');
  if (!track) return;
  try {
    const banners = await getActiveBanners();
    if (!banners.length) return;
    track.innerHTML = banners.map(b => `
      <div class="result-banner-slide${b.image_url ? '' : ' no-photo'}">
        ${b.image_url
          ? `<img src="${escapeHtml(b.image_url)}" alt="${escapeHtml(b.title)}" onerror="this.parentElement.classList.add('no-photo'); this.style.display='none';" />`
          : `<div class="rb-ghost">${escapeHtml(b.year_label || '')}</div>`}
        <div class="result-banner-overlay">
          <div class="result-banner-content">
            <div class="result-banner-year">${escapeHtml(b.year_label || '')}</div>
            <div class="result-banner-title">${escapeHtml(b.title)}</div>
            <div class="result-banner-sub">${escapeHtml(b.subtitle || '')}</div>
          </div>
        </div>
      </div>`).join('');

    // Rebuild the dot navigation to match the new slide count
    const dots = document.getElementById('rbDots');
    if (dots) {
      dots.innerHTML = '';
      banners.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'rb-dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => { rbIndex = i; updateRB(); };
        dots.appendChild(dot);
      });
    }
  } catch (e) { console.error('Banners load failed:', e); }
})();

// ---- 10. FACULTY (into #facultyGrid) ----
(async () => {
  const grid = document.getElementById('facultyGrid');
  if (!grid) return;
  try {
    const faculty = await getFaculty();
    if (!faculty.length) return;
    grid.innerHTML = faculty.map((f, idx) => {
      const initials = (f.name || 'F').split(' ').map(w => w[0]).join('').slice(0, 2);
      return `
        <div class="faculty-card">
          <div class="fc-rank">${String(idx + 1).padStart(2, '0')}</div>
          <div class="faculty-photo">
            ${f.photo_url ? `<img src="${escapeHtml(f.photo_url)}" alt="${escapeHtml(f.name)}" onerror="this.style.display='none'" />` : escapeHtml(initials)}
          </div>
          <div class="fc-shade"></div>
          <div class="fc-edge"></div>
          <div class="fc-cap">
            <h3>${escapeHtml(f.name)}</h3>
            <div class="role">${escapeHtml(f.role || '')}</div>
            ${f.subject ? `<div class="subj">${escapeHtml(f.subject)}</div>` : ''}
            ${f.experience ? `<div class="exp">${escapeHtml(f.experience)}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) { console.error('Faculty load failed:', e); }
})();

// ---- 10b. SITE STATS (stats-bar, ribbon, dashboard, reviews header) ----
// Reads website_settings via getStats(). Any key an admin hasn't set yet
// falls back to the STATS_DEFAULTS baked into websiteApi.js, so this is
// safe to run even before WebsiteTab has a stats editor wired up.
(async () => {
  try {
    const stats = await getStats();

    // "97%" -> {target:97, suffix:'%'} ; "220+" -> {target:220, suffix:'+'} ; "66" -> {target:66, suffix:''}
    const parseStat = (val) => {
      const m = String(val ?? '').match(/^(\d+)(.*)$/);
      return m ? { target: parseInt(m[1], 10), suffix: m[2] || '' } : { target: 0, suffix: '' };
    };

    const setCountUp = (id, rawVal) => {
      const el = document.getElementById(id);
      if (!el || rawVal == null) return;
      const { target, suffix } = parseStat(rawVal);
      el.setAttribute('data-target', target);
      el.setAttribute('data-suffix', suffix);
      el.textContent = `${target}${suffix}`;
    };

    const setText = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.textContent = val;
    };

    setCountUp('stat-selection-rate', stats.selection_rate);
    setCountUp('stat-years', stats.years_of_excellence);
    setCountUp('stat-officers', stats.students_selected);
    setCountUp('stat-trained', stats.students_trained);
    setCountUp('stat-selected-year', stats.selected_current_year);
    setText('stat-selected-year-label', stats.selected_current_year_label);

    setCountUp('ribbon-years', stats.years_of_excellence);
    setCountUp('ribbon-trained', stats.students_trained);
    setCountUp('ribbon-selection-rate', stats.selection_rate);
    setCountUp('ribbon-officers', stats.students_selected);
    setCountUp('ribbon-selected-year', stats.selected_current_year);
    setText('ribbon-selected-year-label', stats.selected_current_year_label);

    setText('stat-hostel-occupancy', stats.hostel_occupancy);
    setText('stat-next-mock-test', stats.next_mock_test);

    setText('reviews-score-num', stats.google_review_score);
    setText('reviews-score-count', `Based on ${stats.google_review_count} Reviews`);
  } catch (e) { console.error('Stats load failed:', e); }
})();

// ---- 10c. TESTIMONIALS (into #testiTrack, replacing the quote slider) ----
(async () => {
  const track = document.getElementById('testiTrack');
  if (!track) return;
  try {
    const testimonials = await getFeaturedTestimonials(8);
    if (!testimonials.length) return; // leave existing static cards as fallback
    track.innerHTML = testimonials.map(t => `
      <div class="testi-card">
        <div class="stars">${'★'.repeat(t.rating || 5)}${'☆'.repeat(5 - (t.rating || 5))}</div>
        <blockquote>"${escapeHtml(t.quote)}"</blockquote>
        <div class="testi-foot">
          <div class="testi-avatar">🎓</div>
          <div class="testi-id">
            <cite>Parent</cite>
            <span class="testi-meta">${escapeHtml(t.attribution || '')}</span>
          </div>
        </div>
      </div>`).join('');

    // Rebuild the dot navigation to match the real card count
    const dots = document.getElementById('testiDots');
    if (dots) {
      dots.innerHTML = '';
      testimonials.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.onclick = () => { tIndex = i; updateT(); };
        dots.appendChild(dot);
      });
    }
  } catch (e) { console.error('Testimonials load failed:', e); }
})();

// ---- 10d. EXAM CALENDAR (into #examCalBody) ----
(async () => {
  const body = document.getElementById('examCalBody');
  if (!body) return;
  try {
    const rows = await getExamCalendar();
    if (!rows.length) return; // leave existing static rows as fallback
    const badgeClass = { NVS: 'cb-nvs', Sainik: 'cb-sainik', RMS: 'cb-rms' };
    const statusClass = { Upcoming: 'cs-upcoming', Open: 'cs-open', Closed: 'cs-closed', Done: 'cs-done' };
    body.innerHTML = rows.map(r => `
      <tr>
        <td>
          <div class="cal-exam">${escapeHtml(r.exam_name)}</div>
          ${r.sub_label ? `<small style="color:var(--mist);font-size:.72rem">${escapeHtml(r.sub_label)}</small>` : ''}
        </td>
        <td><span class="cal-badge ${badgeClass[r.exam_type] || 'cb-gnsi'}">${escapeHtml(r.exam_type || '')}</span></td>
        <td>${escapeHtml(r.application_opens || '')}</td>
        <td>${escapeHtml(r.application_closes || '')}</td>
        <td><strong>${escapeHtml(r.exam_date || '')}</strong></td>
        <td>${escapeHtml(r.result_date || '')}</td>
        <td><span class="cal-status ${statusClass[r.status] || 'cs-upcoming'}">● ${escapeHtml(r.status || 'Upcoming')}</span></td>
      </tr>`).join('');
  } catch (e) { console.error('Exam calendar load failed:', e); }
})();

// ---- 10e. IMPORTANT DATES TIMELINE (into #timelineList) ----
(async () => {
  const list = document.getElementById('timelineList');
  if (!list) return;
  try {
    const items = await getTimeline();
    if (!items.length) return; // leave existing static timeline as fallback
    const monthAbbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    list.innerHTML = items.map(t => {
      let month = t.month_label, day = t.day_label;
      if (t.event_date) {
        const d = new Date(t.event_date + 'T00:00:00');
        month = monthAbbr[d.getMonth()];
        day = String(d.getDate()).padStart(2, '0');
      }
      const status = t.status || 'upcoming'; // done | open | upcoming
      return `
        <div class="tl-item">
          <div class="tl-date">
            <span class="tl-month">${escapeHtml(month || '')}</span>
            <span class="tl-day">${escapeHtml(day || '—')}</span>
          </div>
          <div class="tl-dot ${status}"></div>
          <div class="tl-content ${status}">
            <h4>${escapeHtml(t.title)}</h4>
            ${t.description ? `<p>${escapeHtml(t.description)}</p>` : ''}
            ${t.tag_html ? `<div class="tl-tag">${t.tag_html}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  } catch (e) { console.error('Timeline load failed:', e); }
})();

// ---- 10f. FEE PAYMENT — LIVE UPI + BANK DETAILS (into #feeUpiBox / #feeBankBox) ----
// Reads upi_id, upi_qr_url, bank_name, account_holder_name, account_number,
// ifsc_code, branch_name via getStats() (Settings -> Fee Payment in the
// Website Manager). Each block only renders once real data exists, so
// nothing fake or placeholder ever appears here.
(async () => {
  const upiBox = document.getElementById('feeUpiBox');
  const bankBox = document.getElementById('feeBankBox');
  if (!upiBox && !bankBox) return;
  try {
    const stats = await getStats();
    setFeePaymentInfo({ upi_id: stats.upi_id || '', upi_qr_url: stats.upi_qr_url || '' });

    if (upiBox && (stats.upi_id || stats.upi_qr_url)) {
      upiBox.innerHTML = `
        <div class="fee-upi-card">
          ${stats.upi_qr_url ? `<img class="fee-upi-qr" src="${escapeHtml(stats.upi_qr_url)}" alt="UPI QR Code" onerror="this.style.display='none';" />` : ''}
          <div class="fee-upi-info">
            <div class="fee-upi-label">Scan or Pay via UPI ID</div>
            ${stats.upi_id ? `
              <div class="fee-upi-id">
                <strong id="feeUpiIdText">${escapeHtml(stats.upi_id)}</strong>
                <button type="button" class="fee-upi-copy" id="feeUpiCopyBtn">Copy</button>
              </div>` : ''}
          </div>
        </div>`;

      const copyBtn = document.getElementById('feeUpiCopyBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(stats.upi_id).then(() => {
            copyBtn.textContent = 'Copied ✓';
            copyBtn.classList.add('copied');
            setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
          }).catch(() => {});
        });
      }
    }

    if (bankBox && (stats.bank_name || stats.account_number || stats.ifsc_code)) {
      const rows = [
        ['Account Holder', stats.account_holder_name],
        ['Bank Name', stats.bank_name],
        ['Account Number', stats.account_number],
        ['IFSC Code', stats.ifsc_code],
        ['Branch', stats.branch_name],
      ].filter(([, v]) => v);

      bankBox.innerHTML = `
        <table class="fee-bank-table">
          ${rows.map(([label, val]) => `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(val)}</td></tr>`).join('')}
        </table>`;
    }
  } catch (e) { console.error('Fee payment details load failed:', e); }
})();

// ---- 11. LIVE FORM SUBMISSIONS (replaces the 3 mock window.submit* functions) ----
window.submitEnquiry = async () => {
  const msg = document.getElementById('formMsg');
  const btn = document.getElementById('fBtn');
  const studentName = document.getElementById('fStuName')?.value.trim();
  const parentName = document.getElementById('fParName')?.value.trim();
  const phone = document.getElementById('fPhone')?.value.trim();
  const classGrade = document.getElementById('fClass')?.value.trim();
  const course = document.getElementById('fCourse')?.value;
  const message = document.getElementById('fMsg')?.value.trim();

  if (!studentName || !phone) {
    if (msg) { msg.style.display = 'block'; msg.className = 'form-msg error'; msg.textContent = 'Please enter student name and phone number.'; }
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  try {
    const { error } = await submitEnquiry({
      student_name: studentName, parent_name: parentName, phone,
      class_grade: classGrade, course, message,
    });
    if (error) throw error;
    if (msg) { msg.style.display = 'block'; msg.className = 'form-msg success'; msg.textContent = 'Thank you! We will contact you shortly.'; }
    ['fStuName', 'fParName', 'fPhone', 'fClass', 'fMsg'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) {
    console.error('Enquiry submit failed:', e);
    if (msg) { msg.style.display = 'block'; msg.className = 'form-msg error'; msg.textContent = 'Something went wrong. Please try again or call us directly.'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit Enquiry →'; }
  }
};

window.submitScholar = async () => {
  const msg = document.getElementById('scholarMsg');
  const studentName = document.getElementById('scName')?.value.trim();
  const phone = document.getElementById('scPhone')?.value.trim();
  const classAge = document.getElementById('scClass')?.value.trim();
  const type = document.getElementById('scType')?.value;

  if (!studentName || !phone) {
    if (msg) { msg.style.display = 'block'; msg.className = 'scholar-msg err'; msg.textContent = 'Please enter student name and phone number.'; }
    return;
  }

  try {
    const { error } = await submitScholarRegistration({ student_name: studentName, phone, class_age: classAge, type });
    if (error) throw error;
    if (msg) { msg.style.display = 'block'; msg.className = 'scholar-msg ok'; msg.textContent = 'Registration successful! We will confirm your slot within 24 hours.'; }
    ['scName', 'scPhone', 'scClass'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) {
    console.error('Scholar registration failed:', e);
    if (msg) { msg.style.display = 'block'; msg.className = 'scholar-msg err'; msg.textContent = 'Something went wrong. Please try again or call us directly.'; }
  }
};

window.submitGrievance = async () => {
  const msg = document.getElementById('grvMsg');
  const name = document.getElementById('grvName')?.value.trim();
  const phone = document.getElementById('grvPhone')?.value.trim();
  const category = document.getElementById('grvCat')?.value;
  const description = document.getElementById('grvMsg2')?.value.trim();

  if (!name || !phone || !description) {
    if (msg) { msg.style.display = 'block'; msg.className = 'grv-msg err'; msg.textContent = 'Please fill in your name, phone, and concern.'; }
    return;
  }

  try {
    const { error } = await submitGrievance({
      student_name: name, parent_name: name, phone,
      message: `[${category}] ${description}`,
    });
    if (error) throw error;
    const ticketId = 'GNSI-GRV-' + Date.now().toString().slice(-6);
    if (msg) { msg.style.display = 'block'; msg.className = 'grv-msg ok'; msg.textContent = 'Grievance submitted! Ticket ID: ' + ticketId; }
    ['grvName', 'grvPhone', 'grvMsg2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) {
    console.error('Grievance submit failed:', e);
    if (msg) { msg.style.display = 'block'; msg.className = 'grv-msg err'; msg.textContent = 'Something went wrong. Please try again or call our helpdesk.'; }
  }
};

    // FAQ accordion
    document.querySelectorAll('.faq-q').forEach(q => {
      q.addEventListener('click', () => {
        const a = q.nextElementSibling;
        const icon = q.querySelector('.faq-icon');
        if (a.style.display === 'block') {
          a.style.display = 'none';
          if (icon) icon.textContent = '+';
        } else {
          document.querySelectorAll('.faq-a').forEach(x => x.style.display = 'none');
          document.querySelectorAll('.faq-icon').forEach(x => x.textContent = '+');
          a.style.display = 'block';
          if (icon) icon.textContent = String.fromCharCode(8722);
        }
      });
    });

    // Language toggle
    window.setLang = (lang, btn) => {
      document.body.classList.toggle('hi', lang === 'hi');
      document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
      btn?.classList.add('active');
    };

    // Syllabus tabs
    window.sylTab = (id, btn) => {
      document.querySelectorAll('.syl-panel').forEach(p => p.classList.remove('active'));
      document.getElementById('syl-' + id)?.classList.add('active');
      document.querySelectorAll('.syl-tab').forEach(b => b.classList.remove('active'));
      btn?.classList.add('active');
    };

    // Map loader
    window.loadMap = () => {
      const wrap = document.getElementById('mapWrap');
      if (wrap) {
        wrap.innerHTML = '<iframe class="map-frame" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d14540.0!2d93.95!3d24.65!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x374927b!2sKhangabok%2C%20Manipur!5e0!3m2!1sen!2sin!4v1" allowfullscreen loading="lazy"></iframe>';
      }
    };

    // Video loader
    window.loadMainVideo = (url) => {
      const embed = document.getElementById('mainVideoEmbed');
      if (!embed) return;
      // Only accept real youtube.com/embed/VIDEO_ID URLs — channel pages,
      // playlist-only URLs, or missing URLs cannot be embedded in an iframe
      // and previously left a broken-image icon in their place.
      const valid = url && /^https:\/\/www\.youtube\.com\/embed\/[A-Za-z0-9_-]{6,}/.test(url);
      if (valid) {
        embed.innerHTML = '<iframe src="' + url + '" allowfullscreen></iframe>';
      } else {
        embed.innerHTML = '<div class="video-placeholder" id="videoPlaceholder"><div class="play-btn">▶</div><p>Video unavailable</p></div>';
      }
    };


    // ── Admit Card: real lookup, fee-gated ──────────────────────────────────
    // Looks the student up by GCC No. (roll/ID field) in the real `students`
    // table, checks real outstanding dues via feeDues.js (same engine the
    // Parents Portal uses), and only reveals admit-card details once fees
    // are fully cleared — otherwise shows the amount due instead.
    window.fetchAdmitCard = async () => {
      const res = document.getElementById('acResult');
      const data = document.getElementById('acData');
      const printBtn = document.querySelector('#acResult .admit-download');
      const gcc = document.getElementById('acRoll')?.value?.trim() || '';
      const examTypeId = document.getElementById('acExam')?.value || '';
      if (!res || !data) return;

      if (!gcc || !examTypeId) {
        res.classList.remove('ok'); res.classList.add('err');
        res.classList.add('show');
        data.innerHTML = '<p style="color:#B91C1C;font-weight:600">Please enter your GCC No. and select an exam.</p>';
        if (printBtn) printBtn.style.display = 'none';
        return;
      }

      res.classList.remove('show', 'ok', 'err');
      data.innerHTML = '<p>Checking your record…</p>';
      res.classList.add('show');

      try {
        const { data: stu, error } = await supabase
          .from('students')
          .select('id, name, course, class_name, batch, status, admission_no, gcc_no, admission_date')
          .eq('gcc_no', gcc)
          .maybeSingle();

        if (error || !stu) {
          res.classList.remove('ok'); res.classList.add('err');
          data.innerHTML = '<p style="color:#B91C1C;font-weight:600">GCC No. not found. Please check and try again, or contact the office.</p>';
          if (printBtn) printBtn.style.display = 'none';
          return;
        }

        // Real fee-due engine — same source of truth as the Parents Portal's
        // Fee Dues tab. If it can't be loaded, fail closed (don't hand out
        // an admit card we can't actually confirm is fee-cleared).
        let dues = null;
        try {
          const feeMod = await import('./feeDues.js');
          dues = await feeMod.getStudentDues(stu);
        } catch (e) {
          console.error('Fee check failed:', e);
        }

        const totalDue = Number(dues?.totalDue ?? NaN);
        const feesClear = dues && !Number.isNaN(totalDue) && totalDue <= 0;
        // dues.failedSources is non-empty when one of the underlying fee
        // queries dropped (network blip) and getStudentDues fell back to a
        // safe default for just that source — totalDue is then only a
        // LOWER bound, not exact. Don't tell a student they owe a specific
        // (possibly wrong) amount in that case; ask them to retry instead.
        const uncertain = dues && dues.failedSources && dues.failedSources.length > 0;

        if (!feesClear) {
          res.classList.remove('ok'); res.classList.add('err');
          let message;
          if (!dues) {
            message = "🔒 We couldn't verify your fee status right now. Please try again in a moment, or contact the office.";
          } else if (uncertain) {
            message = '🔒 Admit card locked — we couldn\'t fully verify your fee status. Please try again shortly or contact the office.';
          } else {
            const dueText = totalDue > 0 ? '₹' + totalDue.toLocaleString('en-IN') + ' due' : 'outstanding dues';
            message = '🔒 Admit card locked — ' + dueText + '. Please clear fees to download your admit card.';
          }
          data.innerHTML = '<div class="portal-row"><span>Student</span><strong>' + stu.name + '</strong></div>' +
            '<p style="color:#B91C1C;font-weight:600;margin-top:.6rem">' + message + '</p>' +
            (dues && !uncertain ? '<button type="button" class="admit-download" style="margin-top:.6rem" onclick="window.__openFeeLookup && window.__openFeeLookup()">Pay Fees Now</button>' : '');
          if (printBtn) printBtn.style.display = 'none';
          return;
        }

        // Fees clear — confirm the student has a scheduled sitting for this
        // exam (exam_schedule, same table Exams.jsx/report cards use).
        const course = stu.class_name || stu.batch || stu.course || '';
        const { data: sched } = await supabase
          .from('exam_schedule')
          .select('id, subject, exam_date, exam_time, venue')
          .eq('exam_type_id', examTypeId)
          .eq('course', course)
          .order('exam_date', { ascending: true });

        const examName = (portalExamTypes.find(t => String(t.id) === String(examTypeId)) || {}).name || 'Selected Exam';

        if (!sched || !sched.length) {
          res.classList.remove('ok'); res.classList.add('err');
          data.innerHTML = '<div class="portal-row"><span>Student</span><strong>' + stu.name + '</strong></div>' +
            '<p style="margin-top:.6rem">No schedule has been published yet for <strong>' + examName + '</strong>. Please check back closer to the exam date.</p>';
          if (printBtn) printBtn.style.display = 'none';
          return;
        }

        const first = sched[0];
        res.classList.remove('err'); res.classList.add('ok');
        data.innerHTML = '<div class="portal-row"><span>Student</span><strong>' + stu.name + '</strong></div>' +
          '<div class="portal-row"><span>GCC No.</span><strong>' + (stu.gcc_no || '—') + '</strong></div>' +
          '<div class="portal-row"><span>Exam</span><strong>' + examName + '</strong></div>' +
          '<div class="portal-row"><span>Date</span><strong>' + (first.exam_date || 'TBA') + '</strong></div>' +
          '<div class="portal-row"><span>Time</span><strong>' + (first.exam_time || 'TBA') + '</strong></div>' +
          '<div class="portal-row"><span>Venue</span><strong>' + (first.venue || 'GNSI Campus, Khangabok') + '</strong></div>';
        if (printBtn) printBtn.style.display = '';
      } catch (e) {
        console.error('Admit card lookup failed:', e);
        res.classList.remove('ok'); res.classList.add('err');
        data.innerHTML = '<p style="color:#B91C1C;font-weight:600">Something went wrong. Please try again.</p>';
        if (printBtn) printBtn.style.display = 'none';
      }
    };

    // ── Result Checker: real lookup against exam_marks ──────────────────────
    window.fetchResult = async () => {
      const res = document.getElementById('rcResult');
      const data = document.getElementById('rcData');
      const gcc = document.getElementById('rcRoll')?.value?.trim() || '';
      const examTypeId = document.getElementById('rcExam')?.value || '';
      if (!res || !data) return;

      if (!gcc || !examTypeId) {
        res.classList.remove('ok'); res.classList.add('err');
        res.classList.add('show');
        data.innerHTML = '<p style="color:#B91C1C;font-weight:600">Please enter your GCC No. and select an exam.</p>';
        return;
      }

      res.classList.remove('show', 'ok', 'err');
      data.innerHTML = '<p>Fetching your result…</p>';
      res.classList.add('show');

      try {
        const { data: stu, error } = await supabase
          .from('students')
          .select('id, name, gcc_no')
          .eq('gcc_no', gcc)
          .maybeSingle();

        if (error || !stu) {
          res.classList.remove('ok'); res.classList.add('err');
          data.innerHTML = '<p style="color:#B91C1C;font-weight:600">GCC No. not found. Please check and try again.</p>';
          return;
        }

        const { data: marks } = await supabase
          .from('exam_marks')
          .select('subject, marks_obtained, total_marks, exam_date')
          .eq('student_id', stu.id)
          .eq('exam_type_id', examTypeId);

        const examName = (portalExamTypes.find(t => String(t.id) === String(examTypeId)) || {}).name || 'Selected Exam';

        if (!marks || !marks.length) {
          res.classList.remove('ok'); res.classList.add('err');
          data.innerHTML = '<div class="portal-row"><span>Student</span><strong>' + stu.name + '</strong></div>' +
            '<p style="margin-top:.6rem">Result not declared yet for <strong>' + examName + '</strong>.</p>';
          return;
        }

        const obtained = marks.reduce((sum, r) => sum + (Number(r.marks_obtained) || 0), 0);
        const total = marks.reduce((sum, r) => sum + (Number(r.total_marks) || 0), 0);
        const pct = total > 0 ? Math.round((obtained / total) * 100) : null;
        const passed = pct === null ? null : pct >= 33;

        res.classList.remove('err'); res.classList.add('ok');
        data.innerHTML = '<div class="portal-row"><span>Student</span><strong>' + stu.name + '</strong></div>' +
          '<div class="portal-row"><span>Exam</span><strong>' + examName + '</strong></div>' +
          '<div class="portal-row"><span>Total Marks</span><strong>' + obtained + ' / ' + total + '</strong></div>' +
          (passed !== null
            ? '<div class="portal-row"><span>Status</span><strong style="color:' + (passed ? '#16A34A' : '#B91C1C') + '">' + (passed ? 'Passed' : 'Not Cleared') + '</strong></div>'
            : '');
      } catch (e) {
        console.error('Result lookup failed:', e);
        res.classList.remove('ok'); res.classList.add('err');
        data.innerHTML = '<p style="color:#B91C1C;font-weight:600">Something went wrong. Please try again.</p>';
      }
    };

    window.printAdmitCard = () => {
      window.print();
    };
    window.__openFeeLookup = () => setIsFeeOpen(true);

    return () => {
      clearInterval(rbAuto);
      window.removeEventListener('scroll', stickyHandler);
      window.removeEventListener('scroll', scrollHandler);
      observer.disconnect();
      barObserver.disconnect();
      countObserver.disconnect();
    };
  }, []);

  return (
<>
  <meta charSet="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>
    GNSI — Guidance Navodaya &amp; Sainik Institute | Khangabok, Manipur
  </title>
  <meta
    name="description"
    content="GNSI is Manipur's premier residential coaching institute for Navodaya Vidyalaya (NVS), Sainik School and RMS entrance exams. 95% selection rate, 200+ students selected. Khangabok, Thoubal District."
  />
  <meta
    name="keywords"
    content="Navodaya coaching Manipur, Sainik School coaching Manipur, NVS coaching Thoubal, GNSI Khangabok, Guidance Navodaya Sainik Institute"
  />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="GNSI Khangabok" />
  <meta
    property="og:title"
    content="GNSI — Guidance Navodaya & Sainik Institute | Khangabok, Manipur"
  />
  <meta
    property="og:description"
    content="Manipur's premier coaching for NVS, Sainik School & RMS. 95% selection rate. 200+ students selected. Admissions open 2026–27."
  />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://guidancekhangabok.in" />
  <meta
    property="og:image"
    content="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/og-image.jpg"
  />
  <meta property="og:image:width" content={1200} />
  <meta property="og:image:height" content={630} />
  <meta property="og:site_name" content="GNSI Khangabok" />
  <meta property="og:locale" content="en_IN" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:title"
    content="GNSI — Guidance Navodaya & Sainik Institute"
  />
  <meta
    name="twitter:description"
    content="Manipur's premier coaching for NVS, Sainik School & RMS. 95% selection rate."
  />
  <meta
    name="twitter:image"
    content="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/og-image.jpg"
  />
  <meta name="theme-color" content="#0A0A0A" />
  <link rel="canonical" href="https://guidancekhangabok.in" />
  <link rel="icon" type="image/png" href={EMBLEM_URL} />
  <link rel="apple-touch-icon" href={EMBLEM_URL} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@400;500;600;700;800&display=swap"
    rel="stylesheet"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        ":root{\n  /* \u2550\u2550\u2550 CORE PALETTE \u2014 official trust + premium editorial \u2550\u2550\u2550 */\n  --navy:#111111;--navy1:#0A0A0A;--navy2:#1A1A1A;--navy3:#2563EB;--navy4:#E4E4E4;\n  --gold:#D97706;--goldL:#F59E0B;--goldLL:#FCD34D;--goldD:#B45309;--goldBtn:#111111;--goldBtnHover:#000000;\n  --saffron:#7C3AED;\n  --slate:#000000;--mist:#3A3A3A;--white:#FFFFFF;--cream:#FFFFFF;\n  --red:#DC2626;--green:#16A34A;--wa:#25D366;\n  --sp-1:.25rem;--sp-2:.5rem;--sp-3:.75rem;--sp-4:1rem;--sp-5:1.5rem;--sp-6:2rem;--sp-7:3rem;--sp-8:4.8rem;\n  --fs-cap:clamp(.68rem,1.7vw,.78rem);--fs-sm:clamp(.78rem,1.9vw,.88rem);--fs-base:clamp(.9rem,2.2vw,1rem);--fs-md:clamp(1rem,2.4vw,1.1rem);--fs-lg:clamp(1.15rem,2.8vw,1.3rem);--fs-xl:clamp(1.5rem,3.6vw,1.9rem);--fs-2xl:clamp(2rem,4.8vw,2.7rem);\n  --sh-1:0 2px 8px rgba(17,17,17,.06);--sh-2:0 8px 24px rgba(17,17,17,.1);--sh-3:0 20px 48px rgba(17,17,17,.18);\n  --radius:14px;\n  --serif:'Fraunces',Georgia,serif;--sans:'Inter',Arial,sans-serif;\n}\n*{box-sizing:border-box;margin:0;padding:0}\nhtml{scroll-behavior:smooth;font-size:clamp(17px,2.4vw,20px)}\nbody{font-family:var(--sans);background:var(--cream);color:var(--slate);overflow-x:hidden;font-size:clamp(0.92rem,2.2vw,1rem);line-height:1.6}\nh1,h2,h3,h4,h5{font-family:var(--serif);font-weight:600;line-height:1.2}\na{text-decoration:none;color:inherit}\nimg{max-width:100%;display:block}\n.container{width:min(1200px,92%);margin:auto}\n\n/* \u2550\u2550\u2550 TOP CONTACT BAR \u2550\u2550\u2550 */\n.top-bar{background:var(--navy1);border-bottom:1px solid rgba(217,119,6,.18);padding:.5rem 5%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem}\n.top-bar-left{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}\n.top-bar-item{display:flex;align-items:center;gap:0.5rem;color:rgba(255,255,255,.78);font-family:var(--sans);font-size:clamp(0.72rem,1.8vw,0.84rem);letter-spacing:.01em;text-decoration:none;transition:.2s;font-weight:500}\n.top-bar-item:hover{color:var(--goldL)}\n.top-bar-item span{color:var(--goldL);font-size:.85rem}\n.top-bar-right{display:flex;align-items:center;gap:0.75rem}\n.top-bar-hours{color:rgba(255,255,255,.7);font-family:var(--sans);font-size:clamp(0.7rem,1.7vw,0.78rem);letter-spacing:.02em}\n.top-bar-social{display:flex;gap:0.5rem}\n.top-bar-soc{width:22px;height:22px;border:1px solid rgba(217,119,6,.25);border-radius:50%;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.75);font-size:.6rem;font-weight:700;transition:.2s;text-decoration:none}\n.top-bar-soc:hover{border-color:var(--goldL);color:var(--goldL)}\n\n/* \u2550\u2550\u2550 RESULT BANNER SLIDER \u2550\u2550\u2550 */\n.ten-years-banner{width:100%;line-height:0;border-bottom:2px solid var(--gold);overflow:hidden}\n.ten-years-banner img{width:100%;height:clamp(140px,26vw,280px);display:block;object-fit:cover;object-position:center}\n.result-banner{background:var(--navy);border-bottom:2px solid var(--gold);overflow:hidden;position:relative}\n.result-banner-track{display:flex;transition:transform .7s cubic-bezier(.25,.46,.45,.94)}\n.result-banner-slide{min-width:100%;position:relative;height:clamp(200px,36vw,340px);display:flex;align-items:center;overflow:hidden}\n.result-banner-slide img{width:100%;height:100%;object-fit:cover;opacity:.5}\n.result-banner-overlay{position:absolute;inset:0;background:linear-gradient(100deg,rgba(17,17,17,.95) 0%,rgba(17,17,17,.72) 48%,rgba(17,17,17,.15) 100%);display:flex;align-items:center;padding:0 8%}\n.result-banner-content{max-width:min(620px,58%);position:relative;z-index:1}\n.result-banner-year{font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,2vw,0.9rem);letter-spacing:.05em;text-transform:uppercase;color:var(--goldL);margin-bottom:.6rem}\n.result-banner-title{font-family:var(--serif);font-weight:600;font-size:clamp(1.6rem,4.2vw,2.9rem);color:#fff;line-height:1.12;margin-bottom:.7rem}\n.result-banner-title strong{color:var(--goldLL);font-weight:700}\n.result-banner-sub{color:rgba(255,255,255,.82);font-size:clamp(0.95rem,2.2vw,1.08rem);font-family:var(--sans);font-weight:400}\n.result-banner-nav{position:absolute;bottom:1rem;right:1.5rem;display:flex;gap:6px}\n.rb-dot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.35);cursor:pointer;transition:.2s;background-clip:content-box;padding:6px;box-sizing:content-box}\n.rb-dot.active{background:var(--gold)}\n.rb-prev,.rb-next{position:absolute;top:50%;transform:translateY(-50%);width:36px;height:36px;background:rgba(17,17,17,.55);border:1px solid rgba(217,119,6,.35);border-radius:50%;color:var(--goldL);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;transition:.2s;z-index:5}\n.rb-prev{left:.9rem}.rb-next{right:.9rem}\n.rb-prev:hover,.rb-next:hover{background:rgba(217,119,6,.25)}\n.result-banner-slide.no-photo{background:linear-gradient(135deg,var(--navy3),var(--navy))}\n.result-banner-slide.no-photo::before{display:none}\n.rb-ghost{display:none}\n.rb-icon{font-size:2rem;margin-bottom:.6rem;display:block}\n\n/* \u2550\u2550\u2550 SCHOLARSHIP / FREE TEST \u2550\u2550\u2550 */\n.scholar-section{background:var(--white);padding:5.5rem 0;position:relative;overflow:hidden}\n.scholar-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:3.5rem;align-items:start}\n.scholar-info .eyebrow{color:var(--goldL)}\n.scholar-info .eyebrow::before{background:var(--gold)}\n.scholar-info h2.st{color:#000}\n.scholar-info p{color:#3A3A3A;line-height:1.8;font-size:clamp(1.0rem,2.4vw,1.08rem);margin-bottom:1.3rem}\n.scholar-benefits{list-style:none;margin-bottom:1.6rem}\n.scholar-benefits li{color:rgba(255,255,255,.88);font-size:clamp(1.0rem,2.3vw,1.02rem);padding:.5rem 0;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:0.65rem}\n.scholar-benefits li::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--gold);flex-shrink:0}\n.scholar-form-box{background:rgba(255,255,255,.05);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:2.2rem}\n.scholar-form-box h3{color:#fff;font-family:var(--serif);font-size:clamp(1.2rem,3vw,1.45rem);margin-bottom:.4rem}\n.scholar-form-box p{color:rgba(255,255,255,.65);font-family:var(--sans);font-size:clamp(0.78rem,1.9vw,0.86rem);letter-spacing:.03em;text-transform:uppercase;margin-bottom:1.3rem}\n.scholar-label{display:block;font-family:var(--sans);font-weight:600;font-size:clamp(0.7rem,1.8vw,0.78rem);letter-spacing:.03em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:.4rem}\n.scholar-input{width:100%;padding:12px 15px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);border-radius:var(--radius);color:#fff;font-size:clamp(1.0rem,2.3vw,1.05rem);font-family:var(--sans);outline:none;margin-bottom:1.05rem;transition:.2s}\n.scholar-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(217,119,6,.15)}\n.scholar-select{width:100%;padding:12px 15px;background:var(--navy2);border:1px solid rgba(255,255,255,.16);border-radius:var(--radius);color:#fff;font-size:clamp(1.0rem,2.3vw,1.05rem);font-family:var(--sans);outline:none;margin-bottom:1.05rem}\n.scholar-btn{width:100%;padding:1rem;background:var(--gold);color:var(--navy);border:none;border-radius:var(--radius);font-family:var(--sans);font-weight:700;font-size:clamp(0.95rem,2.4vw,1.02rem);letter-spacing:.02em;cursor:pointer;transition:.2s}\n.scholar-btn:hover{background:var(--goldLL);transform:translateY(-1px)}\n.scholar-msg{padding:.7rem 1rem;border-radius:var(--radius);margin-bottom:.9rem;font-size:clamp(0.9rem,2.2vw,0.98rem);display:none}\n.scholar-msg.ok{background:rgba(22,163,74,.18);color:#5EE3AC;border:1px solid rgba(22,163,74,.35)}\n.scholar-msg.err{background:rgba(220,38,38,.2);color:#fff;border:1px solid rgba(220,38,38,.4)}\n.test-dates{display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1.3rem}\n.test-date-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:var(--radius);padding:.8rem 1rem;text-align:center}\n.test-date-card .tdate{display:block;font-family:var(--serif);font-weight:600;font-size:clamp(1.05rem,2.8vw,1.25rem);color:var(--goldLL);line-height:1}\n.test-date-card .tlabel{font-family:var(--sans);font-size:clamp(0.68rem,1.7vw,0.76rem);letter-spacing:.03em;text-transform:uppercase;color:rgba(255,255,255,.65);margin-top:.25rem;display:block}\n\n/* \u2550\u2550\u2550 QUESTION PAPERS \u2550\u2550\u2550 */\n.papers-section{padding:5.5rem 0;background:var(--white)}\n.papers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem;margin-top:1.8rem}\n.papers-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);border-top:3px solid var(--navy3);padding:1.6rem;transition:.25s}\n.papers-card.sainik{border-top-color:var(--red)}\n.papers-card.nvs{border-top-color:var(--navy3)}\n.papers-card.rms{border-top-color:var(--green)}\n.papers-card:hover{box-shadow:var(--sh-2);transform:translateY(-3px)}\n.papers-card h3{color:var(--navy);font-size:clamp(1.05rem,2.8vw,1.2rem);margin-bottom:.35rem}\n.papers-card .papers-sub{color:var(--mist);font-family:var(--sans);font-size:clamp(0.78rem,1.9vw,0.86rem);letter-spacing:.02em;text-transform:uppercase;margin-bottom:1.1rem}\n.paper-link{display:flex;align-items:center;justify-content:space-between;padding:.6rem .8rem;border:1px solid var(--navy4);border-radius:var(--radius);margin-bottom:.45rem;background:var(--cream);transition:.2s;text-decoration:none;color:var(--navy)}\n.paper-link:hover{background:var(--gold);border-color:var(--gold);color:var(--navy)}\n.paper-link:hover .paper-dl{color:var(--navy)}\n.paper-name{font-family:var(--sans);font-weight:600;font-size:clamp(0.9rem,2.1vw,0.96rem)}\n.paper-dl{color:var(--goldD);font-size:.9rem;transition:.2s}\n.papers-note{color:var(--mist);font-size:clamp(0.8rem,2vw,0.9rem);margin-top:.9rem;line-height:1.6}\n.papers-cta{margin-top:1.1rem;display:block;width:100%;padding:.7rem;background:var(--navy);color:var(--goldL);border-radius:var(--radius);font-family:var(--sans);font-weight:700;font-size:clamp(0.8rem,2vw,0.9rem);letter-spacing:.02em;cursor:pointer;transition:.2s;text-align:center;border:none}\n.papers-cta:hover{background:var(--navy3)}\n\n/* \u2550\u2550\u2550 SYLLABUS \u2550\u2550\u2550 */\n.syllabus-section{padding:5.5rem 0;background:var(--cream)}\n.syllabus-tabs{display:flex;gap:0.6rem;margin-bottom:1.7rem;flex-wrap:wrap}\n.syl-tab{font-family:var(--sans);font-weight:600;font-size:clamp(0.8rem,2vw,0.92rem);letter-spacing:.02em;padding:.5rem 1.2rem;border:1px solid var(--navy4);border-radius:999px;background:var(--white);color:var(--slate);cursor:pointer;transition:.2s}\n.syl-tab.active{background:var(--navy);color:var(--goldL);border-color:var(--navy)}\n.syl-tab:hover:not(.active){border-color:var(--gold);color:var(--goldD)}\n.syl-panel{display:none}\n.syl-panel.active{display:block}\n.syl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1.1rem}\n.syl-card{background:var(--navy);border-radius:var(--radius);border-left:3px solid var(--gold);padding:1.4rem;transition:.25s}.syl-card:hover{transform:translateY(-5px);box-shadow:var(--sh-2)}\n.syl-card h4{color:#fff;font-family:var(--serif);font-size:clamp(1.05rem,2.6vw,1.2rem);margin-bottom:.8rem;display:flex;align-items:center;gap:0.6rem}\n.syl-card h4 span{font-size:1.1rem}\n.syl-topics{list-style:none}\n.syl-topics li{color:rgba(255,255,255,.82);font-size:clamp(0.9rem,2.2vw,0.98rem);padding:.3rem 0;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:0.55rem}\n.syl-topics li:last-child{border:none}\n.syl-topics li::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--gold);flex-shrink:0}\n.syl-marks{display:inline-block;background:rgba(217,119,6,.2);color:var(--goldL);font-family:var(--sans);font-weight:700;font-size:.62rem;letter-spacing:.02em;padding:.18rem .45rem;margin-left:.4rem;border-radius:6px}\n.syl-download{display:inline-flex;align-items:center;gap:0.55rem;margin-top:1.3rem;padding:.65rem 1.1rem;background:var(--navy);border-radius:var(--radius);color:#fff;font-family:var(--sans);font-weight:600;font-size:clamp(0.8rem,2vw,0.9rem);cursor:pointer;transition:.2s;text-decoration:none}\n.syl-download:hover{background:var(--gold);color:var(--navy)}\n\n/* \u2550\u2550\u2550 LANGUAGE TOGGLE \u2550\u2550\u2550 */\n#langBar{background:var(--navy1);border-bottom:1px solid rgba(217,119,6,.12);padding:.35rem 5%;display:flex;align-items:center;justify-content:flex-end;gap:0.5rem}\n.lang-btn{font-family:var(--sans);font-weight:600;font-size:.7rem;letter-spacing:.02em;text-transform:uppercase;padding:.3rem .8rem;border-radius:999px;border:1px solid rgba(217,119,6,.3);background:transparent;color:rgba(255,255,255,.75);cursor:pointer;transition:.2s}\n.lang-btn.active{background:var(--gold);color:var(--navy);border-color:var(--gold)}\n.lang-btn:hover:not(.active){border-color:var(--goldL);color:var(--goldL)}\n[data-hi]{display:none}\nbody.hi [data-en]{display:none}\nbody.hi [data-hi]{display:block}\nbody.hi span[data-hi]{display:inline}\nbody.hi span[data-en]{display:none}\n\n/* \u2550\u2550\u2550 ADMIT CARD PORTAL \u2550\u2550\u2550 */\n.portal-section{background:var(--white);padding:5.5rem 0;position:relative}\n.portal-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.2rem;margin-top:2.1rem}\n.portal-box{background:var(--cream);border:1px solid var(--navy4);border-radius:var(--radius);padding:2rem;transition:.25s}\n.portal-box:hover{border-color:var(--gold);transform:translateY(-5px);box-shadow:var(--sh-2)}\n.portal-box-hd{display:flex;align-items:center;gap:0.85rem;margin-bottom:1.3rem}\n.portal-icon{width:46px;height:46px;border-radius:var(--radius);background:rgba(217,119,6,.12);border:1px solid rgba(217,119,6,.3);display:flex;align-items:center;justify-content:center;font-size:1.25rem;flex-shrink:0}\n.portal-box-hd h3{color:var(--navy);font-family:var(--serif);font-size:clamp(1.05rem,2.8vw,1.2rem)}\n.portal-box-hd p{color:var(--mist);font-family:var(--sans);font-size:clamp(0.78rem,1.8vw,0.86rem);letter-spacing:.02em;text-transform:uppercase}\n.portal-input{width:100%;padding:12px 15px;background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);color:var(--navy);font-size:clamp(1.0rem,2.3vw,1.05rem);font-family:var(--sans);outline:none;margin-bottom:.85rem;transition:.2s}\n.portal-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(217,119,6,.12)}\n.portal-input::placeholder{color:var(--mist)}\n.portal-select{width:100%;padding:12px 15px;background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);color:var(--navy);font-size:clamp(1.0rem,2.3vw,1.05rem);font-family:var(--sans);outline:none;margin-bottom:.85rem}\n.portal-btn{width:100%;padding:.9rem;background:var(--navy);color:var(--goldL);border:none;border-radius:var(--radius);font-family:var(--sans);font-weight:700;font-size:clamp(1.0rem,2.4vw,1.05rem);letter-spacing:.02em;cursor:pointer;transition:.2s}\n.portal-btn:hover{background:var(--navy3)}\n.portal-btn:disabled{opacity:.5;cursor:not-allowed}\n.portal-result{margin-top:1.05rem;padding:1.1rem;border:1px solid var(--navy4);border-radius:var(--radius);background:var(--white);display:none}\n.portal-result.show{display:block}\n.portal-result.ok{border-color:rgba(22,163,74,.3);background:rgba(22,163,74,.05)}\n.portal-result.err{border-color:rgba(220,38,38,.3);background:rgba(220,38,38,.05)}\n.portal-result h4{color:var(--goldD);font-family:var(--serif);font-size:clamp(0.95rem,2.5vw,1.05rem);margin-bottom:.65rem}\n.portal-row{display:flex;justify-content:space-between;padding:.45rem 0;border-bottom:1px solid var(--navy4);font-size:clamp(0.9rem,2.1vw,0.96rem)}\n.portal-row:last-child{border:none}\n.portal-row span{color:var(--mist);font-family:var(--sans);font-size:clamp(0.78rem,1.8vw,0.86rem);letter-spacing:.02em;text-transform:uppercase}\n.portal-row strong{color:var(--navy)}\n.admit-download{display:flex;width:100%;margin-top:1rem;padding:.8rem;background:var(--green);color:#fff;border-radius:var(--radius);font-family:var(--sans);font-weight:700;font-size:clamp(0.9rem,2.1vw,0.96rem);letter-spacing:.02em;border:none;cursor:pointer;transition:.2s;align-items:center;justify-content:center;gap:0.55rem}\n.admit-download:hover{background:#0c6440}\n\n/* \u2550\u2550\u2550 EXAM CALENDAR \u2550\u2550\u2550 */\n.calendar-section{padding:5.5rem 0;background:var(--cream)}\n.cal-table-wrap{overflow-x:auto;margin-top:1.7rem;border-radius:var(--radius);border:1px solid var(--navy4)}\n.cal-table{width:100%;border-collapse:collapse;min-width:600px}\n.cal-table th{background:var(--navy);color:var(--goldL);font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,1.8vw,0.88rem);letter-spacing:.02em;text-transform:uppercase;padding:.85rem 1.1rem;text-align:left}\n.cal-table td{padding:.8rem 1.1rem;border-bottom:1px solid var(--navy4);font-size:clamp(0.9rem,2.2vw,1rem);color:var(--slate);vertical-align:middle;background:var(--white)}\n.cal-table tr:hover td{background:var(--cream)}\n.cal-table tr:last-child td{border:none}\n.cal-exam{font-weight:700;color:var(--navy);font-family:var(--sans)}\n.cal-badge{display:inline-block;font-family:var(--sans);font-weight:700;font-size:.62rem;letter-spacing:.02em;text-transform:uppercase;padding:.18rem .55rem;border-radius:999px}\n.cb-nvs{background:rgba(37,99,235,.1);color:var(--navy3);border:1px solid rgba(37,99,235,.2)}\n.cb-sainik{background:rgba(220,38,38,.1);color:var(--red);border:1px solid rgba(220,38,38,.2)}\n.cb-rms{background:rgba(22,163,74,.1);color:var(--green);border:1px solid rgba(22,163,74,.2)}\n.cb-gnsi{background:rgba(217,119,6,.14);color:var(--goldD);border:1px solid rgba(217,119,6,.25)}\n.cal-status{display:inline-flex;align-items:center;gap:0.3rem;font-family:var(--sans);font-weight:700;font-size:.64rem;letter-spacing:.02em;text-transform:uppercase}\n.cs-upcoming{color:var(--green)}\n.cs-open{color:var(--navy)}\n.cs-closed{color:var(--mist)}\n.cs-done{color:#4A4A4A}\n.cal-download{display:inline-flex;align-items:center;gap:0.55rem;margin-top:1.3rem;padding:.55rem 1.3rem;background:var(--navy);color:var(--goldL);border-radius:999px;font-family:var(--sans);font-weight:700;font-size:clamp(0.8rem,2vw,0.9rem);border:none;cursor:pointer;transition:.2s;text-decoration:none}\n.cal-download:hover{background:var(--navy3)}\n\n/* \u2550\u2550\u2550 IMPORTANT DATES TIMELINE \u2550\u2550\u2550 */\n.timeline-section{padding:5.5rem 0;background:var(--white)}\n.timeline{position:relative;max-width:860px;margin-top:2.2rem}\n.timeline::before{content:'';position:absolute;left:110px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--gold),rgba(217,119,6,.08))}\n.tl-item{display:flex;gap:1.6rem;margin-bottom:1.6rem;position:relative;align-items:flex-start}\n.tl-date{min-width:100px;text-align:right;flex-shrink:0}\n.tl-month{display:block;font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,2vw,0.92rem);letter-spacing:.02em;text-transform:uppercase;color:var(--mist)}\n.tl-day{display:block;font-family:var(--serif);font-weight:600;font-size:clamp(1.2rem,3vw,1.55rem);color:var(--navy);line-height:1}\n.tl-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--gold);background:var(--white);flex-shrink:0;margin-top:.4rem;position:relative;z-index:2;transition:.2s}\n.tl-item:hover .tl-dot{background:var(--gold)}\n.tl-dot.done{background:var(--navy4);border-color:var(--navy4)}\n.tl-dot.open{background:var(--gold);border-color:var(--gold);box-shadow:0 0 0 4px rgba(217,119,6,.18)}\n.tl-dot.upcoming{background:var(--white);border-color:var(--navy3)}\n.tl-content{flex:1;padding:.7rem 1rem;border:1px solid var(--navy4);border-radius:var(--radius);border-left:3px solid var(--navy4);background:var(--white);transition:.25s}\n.tl-item:hover .tl-content{border-left-color:var(--gold);box-shadow:var(--sh-1)}\n.tl-content.open{border-left-color:var(--gold);background:rgba(217,119,6,.03)}\n.tl-content.done{opacity:.55}\n.tl-content h4{color:var(--navy);font-family:var(--serif);font-size:clamp(0.95rem,2.4vw,1.05rem);margin-bottom:.25rem}\n.tl-content p{color:var(--slate);font-size:clamp(0.9rem,2.1vw,0.96rem);line-height:1.6}\n.tl-tag{display:inline-block;margin-top:.45rem}\n\n/* \u2550\u2550\u2550 MOCK TEST \u2550\u2550\u2550 */\n.mocktest-section{background:var(--white);padding:5.5rem 0;position:relative;overflow:hidden}\n.mocktest-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.2rem;align-items:start}\n.mock-cards{display:flex;flex-direction:column;gap:0.8rem}\n.mock-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:var(--radius);padding:1.2rem 1.4rem;display:flex;align-items:center;gap:1.1rem;transition:.25s;cursor:pointer;text-decoration:none}\n.mock-card:hover{border-color:var(--gold);transform:translateX(4px);background:rgba(255,255,255,.09)}\n.mock-icon{width:46px;height:46px;border-radius:var(--radius);background:rgba(217,119,6,.16);border:1px solid rgba(217,119,6,.3);display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0}\n.mock-card-title{color:#000;font-family:var(--serif);font-size:clamp(1.0rem,2.4vw,1.1rem);margin-bottom:.25rem}\n.mock-card-sub{color:#3A3A3A;font-family:var(--sans);font-size:clamp(0.7rem,1.8vw,0.8rem);letter-spacing:.02em;text-transform:uppercase}\n.mock-card-arrow{color:var(--goldL);font-size:1rem;margin-left:auto;flex-shrink:0}\n.mock-info h3{color:var(--goldL);font-family:var(--serif);font-size:clamp(1.2rem,3vw,1.45rem);margin-bottom:.9rem}\n.mock-info p{color:rgba(255,255,255,.82);line-height:1.8;font-size:clamp(1.0rem,2.3vw,1.08rem);margin-bottom:1.3rem}\n.mock-features{list-style:none;margin-bottom:1.6rem}\n.mock-features li{color:rgba(255,255,255,.85);font-size:clamp(1.0rem,2.3vw,1.02rem);padding:.45rem 0;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:0.55rem}\n.mock-features li::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--gold);flex-shrink:0}\n\n/* \u2550\u2550\u2550 APP DOWNLOAD \u2550\u2550\u2550 */\n.app-section{background:var(--white);padding:4.5rem 0;border-top:1px solid var(--navy4)}\n.app-grid{display:grid;grid-template-columns:1fr 1fr;gap:3.2rem;align-items:center}\n.app-info h2{color:var(--navy);font-family:var(--serif);font-size:clamp(1.6rem,3.5vw,2.1rem);margin-bottom:.8rem}\n.app-info p{color:var(--slate);line-height:1.8;font-size:clamp(1.0rem,2.3vw,1.08rem);margin-bottom:1.5rem}\n.app-features{display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1.6rem}\n.app-feat{background:var(--cream);border:1px solid var(--navy4);border-radius:var(--radius);padding:.7rem .9rem;font-family:var(--sans);font-size:clamp(0.78rem,2vw,0.9rem);color:var(--slate);display:flex;align-items:center;gap:0.55rem}\n.app-btns{display:flex;gap:0.8rem;flex-wrap:wrap}\n.app-btn{display:inline-flex;align-items:center;gap:0.8rem;padding:.8rem 1.4rem;border:1px solid var(--navy4);border-radius:var(--radius);background:var(--navy);color:#fff;text-decoration:none;transition:.25s}\n.app-btn:hover{border-color:var(--gold);background:var(--navy3)}\n.app-btn-icon{font-size:1.4rem;flex-shrink:0}\n.app-btn-txt small{display:block;font-family:var(--sans);font-size:.6rem;letter-spacing:.02em;text-transform:uppercase;color:rgba(255,255,255,.6);margin-bottom:.1rem}\n.app-btn-txt strong{display:block;font-size:clamp(1.0rem,2.3vw,1.05rem);font-weight:600;color:#fff}\n.app-mockup{background:var(--cream);border:1px solid var(--navy4);border-radius:var(--radius);padding:2.2rem;text-align:center;position:relative}\n.app-screen{background:var(--navy);border-radius:14px;padding:1.6rem;max-width:220px;margin:0 auto}\n.app-screen-hd{background:rgba(217,119,6,.14);border-bottom:1px solid rgba(217,119,6,.15);padding:.65rem .85rem;margin:-.55rem -.55rem .85rem;display:flex;align-items:center;gap:0.55rem;border-radius:9px 9px 0 0}\n.app-screen-hd span{font-family:var(--sans);font-size:.65rem;letter-spacing:.02em;text-transform:uppercase;color:var(--goldL)}\n.app-screen-row{display:flex;justify-content:space-between;padding:.45rem 0;border-bottom:1px solid rgba(255,255,255,.07);font-size:.72rem}\n.app-screen-row span{color:rgba(255,255,255,.82);font-family:var(--sans)}\n.app-screen-row strong{color:var(--goldLL);font-family:var(--sans)}\n.app-qr{margin-top:1.3rem;padding:.9rem;background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);display:inline-block}\n.app-qr p{font-family:var(--sans);font-size:.65rem;letter-spacing:.02em;text-transform:uppercase;color:var(--mist);margin-top:.45rem;text-align:center}\n\n/* \u2550\u2550\u2550 GRIEVANCE / HELPDESK \u2550\u2550\u2550 */\n.helpdesk-section{padding:5.5rem 0;background:var(--cream)}\n.helpdesk-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.2rem;align-items:start}\n.helpdesk-info p{color:var(--slate);line-height:1.8;font-size:clamp(1.0rem,2.4vw,1.08rem);margin-bottom:1.3rem}\n.helpdesk-contacts{display:flex;flex-direction:column;gap:0.8rem}\n.hc-item{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);border-left:3px solid var(--gold);padding:1rem 1.1rem;display:flex;align-items:center;gap:1.1rem;transition:.2s}\n.hc-item:hover{box-shadow:var(--sh-1)}\n.hc-icon{font-size:1.3rem;flex-shrink:0}\n.hc-label{font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,1.8vw,0.86rem);letter-spacing:.02em;text-transform:uppercase;color:var(--mist);display:block}\n.hc-val{color:var(--navy);font-size:clamp(1.0rem,2.3vw,1.05rem);font-weight:600}\n.hc-val a{color:var(--navy);text-decoration:underline}\n.hc-val a:hover{color:var(--navy3)}\n.helpdesk-form{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);padding:2rem}\n.helpdesk-form h3{color:var(--navy);font-family:var(--serif);font-size:clamp(1.05rem,2.8vw,1.2rem);margin-bottom:.35rem}\n.helpdesk-form p{color:var(--mist);font-family:var(--sans);font-size:clamp(0.78rem,1.8vw,0.86rem);letter-spacing:.02em;margin-bottom:1.3rem}\n.grv-input{width:100%;padding:12px 15px;border:1px solid var(--navy4);border-radius:var(--radius);background:var(--cream);color:var(--navy);font-size:clamp(1.0rem,2.3vw,1.05rem);font-family:var(--sans);outline:none;margin-bottom:.95rem;transition:.2s}\n.grv-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(217,119,6,.12)}\n.grv-select{width:100%;padding:12px 15px;border:1px solid var(--navy4);border-radius:var(--radius);background:var(--cream);color:var(--navy);font-size:clamp(1.0rem,2.3vw,1.05rem);font-family:var(--sans);outline:none;margin-bottom:.95rem}\n.grv-textarea{width:100%;padding:12px 15px;border:1px solid var(--navy4);border-radius:var(--radius);background:var(--cream);color:var(--navy);font-size:clamp(1.0rem,2.3vw,1.05rem);font-family:var(--sans);outline:none;margin-bottom:.95rem;min-height:100px;resize:vertical}\n.grv-btn{width:100%;padding:.9rem;background:var(--navy);color:var(--goldL);border:none;border-radius:var(--radius);font-family:var(--sans);font-weight:700;font-size:clamp(1.0rem,2.4vw,1.05rem);letter-spacing:.02em;cursor:pointer;transition:.2s}\n.grv-btn:hover{background:var(--navy3)}\n.grv-msg{padding:.7rem 1rem;border-radius:var(--radius);margin-bottom:.9rem;font-size:clamp(0.9rem,2.2vw,1rem);display:none}\n.grv-msg.ok{background:#E4F5EC;color:var(--green);border:1px solid rgba(22,163,74,.3)}\n.grv-msg.err{background:rgba(220,38,38,.1);color:var(--red);border:1px solid rgba(220,38,38,.3)}\n.ticket-id{font-family:var(--sans);font-weight:700;letter-spacing:.02em;color:var(--gold)}\n\n/* SCROLL REVEAL */\n.reveal{opacity:0;transform:translateY(24px);transition:opacity .5s ease,transform .6s cubic-bezier(.22,1,.36,1)}\n.courses-grid>.reveal-scale:nth-child(1){transition-delay:.03s}\n.courses-grid>.reveal-scale:nth-child(2){transition-delay:.09s}\n.courses-grid>.reveal-scale:nth-child(3){transition-delay:.15s}\n.courses-grid>.reveal-scale:nth-child(4){transition-delay:.21s}\n.ranker-grid>*:nth-child(1){transition-delay:.03s}\n.ranker-grid>*:nth-child(2){transition-delay:.08s}\n.ranker-grid>*:nth-child(3){transition-delay:.13s}\n.ranker-grid>*:nth-child(4){transition-delay:.18s}\n.ranker-grid>*:nth-child(5){transition-delay:.23s}\n.ranker-grid>*:nth-child(6){transition-delay:.28s}\n.reveal.vis{opacity:1;transform:none}\n.reveal-left{opacity:0;transform:translateX(-28px);transition:opacity .5s ease,transform .6s cubic-bezier(.22,1,.36,1)}\n.reveal-left.vis{opacity:1;transform:none}\n.reveal-right{opacity:0;transform:translateX(28px);transition:opacity .5s ease,transform .6s cubic-bezier(.22,1,.36,1)}\n.reveal-right.vis{opacity:1;transform:none}\n.reveal-scale{opacity:0;transform:scale(.96);transition:opacity .5s ease,transform .6s cubic-bezier(.22,1,.36,1)}\n.reveal-scale.vis{opacity:1;transform:scale(1)}\n\n/* SCROLL PROGRESS */\n#sp{position:fixed;top:0;left:0;z-index:9999;height:3px;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green));width:0%;transition:width .1s;pointer-events:none}\n\n/* STICKY APPLY BAR */\n#stickyBar{position:fixed;bottom:0;left:0;right:0;z-index:990;background:var(--navy);border-top:2px solid var(--gold);padding:.85rem 5%;display:flex;align-items:center;justify-content:space-between;transform:translateY(100%);transition:transform .4s cubic-bezier(.25,.46,.45,.94);gap:1rem;flex-wrap:wrap}\n#stickyBar.show{transform:translateY(0)}\n#stickyBar p{color:rgba(255,255,255,.85);font-size:clamp(0.9rem,2vw,1rem);letter-spacing:.01em}\n#stickyBar p strong{color:var(--goldL)}\n.sticky-btns{display:flex;gap:0.55rem;align-items:center;flex-shrink:0}\n.sb-btn{font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,2vw,0.92rem);letter-spacing:.02em;padding:.55rem 1.2rem;border-radius:var(--radius);cursor:pointer;border:none;transition:.2s}\n.sb-btn-gold{background:var(--gold);color:var(--navy)}\n.sb-btn-gold:hover{background:var(--goldLL)}\n.sb-btn-wa{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.35)!important;color:#25D366}\n.sb-close{background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:1.1rem;padding:.2rem .4rem;flex-shrink:0}\n\n/* ALERT */\n.alert-strip{background:var(--red);color:#fff;font-size:clamp(0.9rem,2.2vw,1rem);padding:.6rem 5%;display:flex;justify-content:space-between;align-items:center;font-family:var(--sans);font-weight:600}\n.alert-strip button{background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0}\n\n/* TICKER */\n.ticker-wrap{background:var(--navy);overflow:hidden;border-bottom:2px solid var(--gold)}\n.ticker-inner{display:flex;align-items:center;height:38px}\n.ticker-label{background:var(--gold);color:var(--navy);font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,2vw,0.92rem);letter-spacing:.02em;text-transform:uppercase;padding:0 1.3rem;height:100%;display:flex;align-items:center;white-space:nowrap;flex-shrink:0}\n.ticker-scroll{overflow:hidden;flex:1}\n.ticker-track{display:inline-block;min-width:200%;animation:tkscroll 38s linear infinite;color:var(--goldLL);font-size:clamp(0.78rem,2vw,0.92rem);font-family:var(--sans);font-weight:500;white-space:nowrap;padding-left:2rem}\n@keyframes tkscroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}\n\n/* \u2550\u2550\u2550 COUNTDOWN \u2550\u2550\u2550 */\n.countdown-bar{background:linear-gradient(135deg,var(--navy3),var(--navy));border-bottom:1px solid rgba(217,119,6,.3);padding:1rem 5%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.8rem}\n.countdown-label{color:var(--goldL);font-family:var(--sans);font-weight:700;font-size:clamp(0.9rem,2.2vw,1rem);letter-spacing:.02em;text-transform:uppercase;display:flex;align-items:center;gap:0.55rem}\n.countdown-label::before{content:'\u2691';color:var(--saffron)}\n.countdown-units{display:flex;gap:0.55rem;align-items:center}\n.cd-unit{background:rgba(255,255,255,.08);border:1px solid rgba(217,119,6,.3);border-radius:var(--radius);padding:.4rem .65rem;text-align:center;min-width:54px}\n.cd-num{display:block;font-family:var(--serif);font-weight:600;font-size:clamp(1.2rem,3.5vw,1.85rem);color:var(--goldLL);line-height:1}\n.cd-lbl{display:block;font-family:var(--sans);font-size:clamp(0.68rem,1.5vw,0.73rem);color:rgba(255,255,255,.8);letter-spacing:.02em;text-transform:uppercase}\n.cd-sep{color:var(--gold);font-size:1.2rem;font-weight:700;align-self:flex-start;padding-top:.4rem}\n.countdown-cta{font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,2vw,0.9rem);letter-spacing:.02em;padding:.5rem 1.2rem;background:var(--gold);color:var(--navy);border:none;border-radius:var(--radius);cursor:pointer;transition:.2s;white-space:nowrap}\n.countdown-cta:hover{background:var(--goldLL)}\n\n/* \u2550\u2550\u2550 NAV \u2550\u2550\u2550 */\nnav{position:sticky;top:0;z-index:1000;background:rgba(17,17,17,.97);backdrop-filter:blur(16px);border-bottom:1px solid rgba(217,119,6,.28)}\n.nav-inner{width:min(1200px,96%);margin:auto;height:74px;display:flex;align-items:center;justify-content:space-between;gap:.75rem}\n.brand{display:flex;align-items:center;gap:14px;text-decoration:none}\n.crest{width:48px;height:48px;border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}\n.crest-i{width:34px;height:34px;border:1px solid rgba(217,119,6,.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-weight:700;font-size:1.05rem;color:var(--goldL)}\n.brand-text h2{font-family:var(--serif);font-weight:600;color:#fff;font-size:clamp(0.95rem,2.5vw,1.08rem);letter-spacing:.01em}\n.brand-text small{display:block;color:var(--goldL);font-family:var(--sans);font-size:clamp(0.66rem,1.5vw,0.72rem);letter-spacing:.03em;text-transform:uppercase}\n.nav-links{display:flex;list-style:none;gap:0.1rem;align-items:center;flex-wrap:nowrap;flex-shrink:1;min-width:0;overflow:hidden}\n.nav-links li{flex-shrink:0}\n.nav-links a{color:rgba(255,255,255,.82);font-size:clamp(0.64rem,1vw,0.8rem);font-family:var(--sans);font-weight:500;padding:.35rem .4rem;transition:.2s;position:relative;white-space:nowrap;display:inline-block}\n.nav-links a::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transition:.2s}\n.nav-links a:hover{color:var(--goldLL)}\n.nav-links a:hover::after{transform:scaleX(1)}\n.nav-btn{background:transparent;border:1px solid rgba(217,119,6,.45)!important;border-radius:999px!important;color:var(--goldL)!important;padding:.45rem .9rem!important;font-weight:600!important;opacity:1!important;cursor:pointer;transition:.2s!important;white-space:nowrap}\n.nav-btn:hover{background:rgba(217,119,6,.14)!important}\n.nav-par{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.35);border-radius:999px;color:#25D366!important;padding:.45rem .9rem!important;font-weight:600!important;opacity:1!important;transition:.2s!important;white-space:nowrap}\n.nav-fee{background:var(--saffron)!important;color:#fff!important;padding:.45rem .9rem!important;border-radius:999px!important;font-weight:600!important;opacity:1!important;border:none!important;cursor:pointer;transition:.2s!important;white-space:nowrap}\n.nav-fee:hover{background:#1F1F1F!important}\n.nav-links{display:none}\n.hamburger{display:flex;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}\n.nav-fixed-actions{display:flex;align-items:center;gap:.6rem}\n.hamburger span{display:block;width:24px;height:2px;background:#fff;transition:.3s;transform-origin:center}\n.hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}\n.hamburger.open span:nth-child(2){opacity:0}\n.hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}\n.mob-menu{display:none;position:fixed;inset:0;z-index:1100;background:var(--navy);flex-direction:column}\n.mob-menu.open{display:flex}\n.mob-menu-hd{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:1.2rem 5%;border-bottom:1px solid rgba(217,119,6,.2)}\n.mob-menu-brand{display:flex;align-items:center;gap:0.75rem;color:#fff;font-family:var(--serif);font-weight:600;font-size:.9rem}\n.mob-menu-close{background:none;border:1px solid rgba(217,119,6,.3);color:var(--goldL);width:36px;height:36px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s;flex-shrink:0}\n.mob-menu-close:hover{border-color:var(--goldL);background:rgba(217,119,6,.12)}\n.mob-menu-scroll{flex:1;overflow-y:auto;padding:.5rem 0 1rem;-webkit-overflow-scrolling:touch}\n.mob-menu a,.mob-menu button{display:block;width:100%;text-align:left;background:none;border:none;color:rgba(255,255,255,.78);font-family:var(--sans);font-weight:500;font-size:clamp(0.9rem,2.5vw,1rem);padding:.9rem 5%;border-bottom:1px solid rgba(217,119,6,.08);transition:.2s;cursor:pointer}\n.mob-menu a:active,.mob-menu button:active{background:rgba(217,119,6,.08)}\n.mob-menu .mob-par{color:#25D366!important}\n.mob-menu .mob-staff{color:var(--goldL)!important;font-weight:700!important}\n.mob-menu-bottom{flex-shrink:0;display:flex;gap:0.5rem;padding:.9rem 5% calc(.9rem + env(safe-area-inset-bottom));background:var(--navy1);border-top:1px solid rgba(217,119,6,.28);box-shadow:0 -10px 28px rgba(0,0,0,.32)}\n.mob-menu-bottom a,.mob-menu-bottom button{flex:1;display:flex;align-items:center;justify-content:center;gap:0.5rem;padding:.8rem .5rem;font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,2.2vw,0.95rem);border:none;border-radius:var(--radius);transition:.2s;cursor:pointer}\n.mmb-fee{background:var(--saffron);color:#fff!important}\n.mmb-fee:hover{background:#1F1F1F}\n.mmb-apply{background:var(--gold);color:var(--navy)!important}\n.mmb-apply:hover{background:var(--goldLL)}\n\n/* \u2550\u2550\u2550 HERO \u2550\u2550\u2550 */\n.hero{background:var(--cream);color:var(--slate);min-height:auto;padding:3.2rem 0;display:flex;align-items:center;position:relative;overflow:hidden}\n.hero-pattern{display:none}.hero-orb{display:none}\n.hero-wrap{width:min(1200px,92%);margin:auto;display:grid;grid-template-columns:1.45fr .65fr;gap:3rem;align-items:center;position:relative;z-index:2;padding:0}\n.tricolor{display:flex;height:3px;width:60px;margin-bottom:1rem;gap:2px}\n.tricolor div:nth-child(1){background:#FF9933;flex:1}\n.tricolor div:nth-child(2){background:#d8d8d8;flex:1}\n.tricolor div:nth-child(3){background:var(--green);flex:1}\n.hero-eyebrow{font-family:var(--sans);font-weight:600;font-size:clamp(0.75rem,1.6vw,0.85rem);color:var(--goldD);margin-bottom:.7rem;display:flex;align-items:center;gap:8px}\n.hero-eyebrow::before,.hero-eyebrow::after{content:'';display:block;height:1px;width:28px;background:var(--gold)}\n.hero h1{font-family:var(--serif);font-weight:600;font-size:clamp(1.9rem,4vw,3.1rem);line-height:1.12;letter-spacing:-.01em;margin-bottom:1rem;color:var(--navy)}\n.hero h1 em{color:var(--goldD);font-style:italic}\n.hero h1 span:not([data-en]):not([data-hi]){display:block;font-size:clamp(1.15rem,3.5vw,2.8rem);color:var(--mist);font-weight:400}\n.hero p{max-width:600px;color:var(--slate);line-height:1.75;font-size:clamp(0.95rem,1.9vw,1.05rem);margin-bottom:1.4rem}\n.hero-btns{display:flex;gap:0.8rem;flex-wrap:wrap;margin-bottom:1.6rem}\n.hero-quick{display:flex;gap:0.6rem;flex-wrap:wrap;margin-bottom:2.8rem}\n.hero-course-chips{display:grid;grid-template-columns:repeat(4,1fr);gap:.7rem;max-width:640px}.hero-course-chip{display:flex;align-items:center;gap:.65rem;background:var(--white);border:1px solid var(--navy4);border-left:4px solid var(--navy4);border-radius:14px;padding:.85rem .9rem;text-decoration:none;transition:.2s ease;cursor:pointer;box-shadow:var(--sh-1)}\n.hero-course-chip:hover{transform:translateY(-3px);box-shadow:var(--sh-2)}\n.hero-course-chip-icon{font-size:1.3rem;flex-shrink:0;line-height:1}\n.cc-sainik{border-left-color:var(--red)}\n.cc-sainik:hover{border-color:var(--red)}\n.cc-navodaya{border-left-color:var(--navy3)}\n.cc-navodaya:hover{border-color:var(--navy3)}\n.cc-foundation{border-left-color:var(--green)}\n.cc-foundation:hover{border-color:var(--green)}\n.cc-combined{border-left-color:var(--gold)}\n.cc-combined:hover{border-color:var(--gold)}\n.hero-course-chip-label{flex:1;font-family:var(--sans);font-weight:600;font-size:clamp(.74rem,1.8vw,.86rem);color:var(--navy);line-height:1.25}\n.hero-course-chip-arrow{width:24px;height:24px;border-radius:50%;background:var(--navy4);color:var(--navy);display:flex;align-items:center;justify-content:center;font-size:.78rem;flex-shrink:0;transition:.2s}@media (max-width:640px){.hero-course-chips{grid-template-columns:repeat(2,1fr);max-width:100%}}\n.btn-brochure,.btn-demo{display:inline-flex;align-items:center;gap:0.5rem;font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,2vw,0.88rem);padding:.7rem 1.3rem;border-radius:999px;background:var(--white);border:1.5px solid var(--navy4);color:#000;cursor:pointer;transition:.2s ease;box-shadow:var(--sh-1)}\n.btn-brochure:hover,.btn-demo:hover{border-color:#000;transform:translateY(-2px);box-shadow:var(--sh-2)}\n\n\n.btn{display:inline-flex;align-items:center;gap:0.55rem;font-family:var(--sans);font-weight:600;font-size:clamp(0.92rem,2.2vw,1.02rem);padding:clamp(0.78rem,2vw,0.95rem) clamp(1.3rem,3vw,1.8rem);cursor:pointer;transition:.2s;border:none;border-radius:var(--radius)}\n.btn-gold{background:var(--gold);color:var(--navy)}\n.btn-gold:hover{background:var(--goldLL);transform:translateY(-1px);box-shadow:0 8px 22px rgba(217,119,6,.35)}\n.btn-out{background:transparent;border:1px solid var(--navy4);color:var(--navy)}\n.btn-out:hover{border-color:var(--goldD);color:var(--goldD)}\n.cta-block .btn-out{border-color:rgba(255,255,255,.5);color:#fff}\n.cta-block .btn-out:hover{border-color:#fff;color:#fff;background:rgba(255,255,255,.08)}\n.btn-wa{background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.32);color:#0f8a45}\n.btn-wa:hover{background:rgba(37,211,102,.2)}\n.btn-grn{background:var(--green);color:#fff}\n.btn-grn:hover{background:#0c6440;transform:translateY(-1px)}\n.btn-fee{background:var(--saffron);color:#fff}\n.btn-fee:hover{background:#1F1F1F;transform:translateY(-1px)}\n.btn:focus-visible,.btn-gold:focus-visible,.btn-out:focus-visible,.btn-wa:focus-visible,.btn-grn:focus-visible,.btn-fee:focus-visible,.btn-brochure:focus-visible,.btn-demo:focus-visible{outline:2px solid var(--gold);outline-offset:3px}\n.nav-links a:focus-visible{outline:2px solid var(--goldL);outline-offset:2px}\nselect.ff:focus,.scholar-select:focus,.portal-select:focus,.grv-select:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(217,119,6,.12)}\na:focus-visible,button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}\n@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}\n.stats-bar{display:flex;border-bottom:1px solid var(--navy4);padding-bottom:1.6rem;margin-bottom:1.8rem;flex-wrap:wrap;gap:1rem}\n.hero-cta-primary{font-size:clamp(0.95rem,2.4vw,1.05rem)!important;padding:1rem 2rem!important;box-shadow:0 8px 24px rgba(217,119,6,.3)}\n.hero-cta-primary:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(217,119,6,.4)}\n.hero-cta-primary:active{transform:translateY(0) scale(.97)}\n.stat-item{padding-right:2rem;border-right:1px solid var(--navy4)}\n.stat-item:last-child{border:none;padding:0}\n.stat-item strong{display:block;font-family:var(--serif);font-weight:600;font-size:clamp(1.6rem,4vw,2.1rem);color:var(--navy);line-height:1}\n.stat-item span{font-size:clamp(0.7rem,1.8vw,0.86rem);color:var(--mist);letter-spacing:.02em;text-transform:uppercase;font-family:var(--sans);font-weight:600}\n.count-up{display:inline-block}\n\n/* LIVE DASH */\n.dash-panel{background:var(--navy);border-radius:var(--radius);border:1px solid rgba(217,119,6,.25);overflow:hidden;transition:.2s;box-shadow:var(--sh-3)}\n.dash-panel:hover{border-color:rgba(217,119,6,.4)}\n.dash-hd{background:var(--navy1);border-bottom:1px solid rgba(217,119,6,.2);padding:1rem 1.4rem;display:flex;align-items:center;justify-content:space-between}\n.dash-hd-title{font-family:var(--sans);font-weight:700;font-size:clamp(0.9rem,2.2vw,1.02rem);letter-spacing:.02em;text-transform:uppercase;color:var(--goldL)}\n.live-dot{display:flex;align-items:center;gap:6px;font-size:clamp(0.78rem,2vw,0.92rem);color:rgba(255,255,255,.9);font-family:var(--sans)}\n.dot{width:6px;height:6px;border-radius:50%;background:#25D366;animation:pulse 2s infinite}\n@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(37,211,102,.4)}50%{opacity:.6;box-shadow:0 0 0 4px rgba(37,211,102,0)}}\n.dash-kpi{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid rgba(217,119,6,.12)}\n.kpi{padding:1.2rem .8rem;text-align:center;border-right:1px solid rgba(217,119,6,.1);transition:.2s}\n.kpi:hover{background:rgba(217,119,6,.05)}\n.kpi:last-child{border:none}\n.kpi strong{display:block;font-family:var(--serif);font-weight:600;font-size:clamp(1.2rem,4vw,1.85rem);color:var(--goldLL);line-height:1}\n.kpi span{font-size:clamp(0.75rem,2vw,0.88rem);color:rgba(255,255,255,.9);letter-spacing:.02em;text-transform:uppercase;font-family:var(--sans);font-weight:600}\n.dash-body{padding:1rem 1.4rem}\n.dash-row{display:flex;justify-content:space-between;align-items:center;padding:.6rem 0;border-bottom:1px solid rgba(217,119,6,.09);font-size:clamp(0.9rem,2.5vw,1rem);transition:.15s}\n.dash-row:hover{padding-left:.3rem}\n.dash-row:last-child{border:none}\n.dash-row span{color:rgba(255,255,255,.9);font-family:var(--sans)}\n.dash-row strong{color:var(--goldL);font-family:var(--sans);font-weight:600}\n.lpulse{opacity:.4;animation:lpulse 1.5s ease-in-out infinite}\n@keyframes lpulse{0%,100%{opacity:.4}50%{opacity:.8}}\n\n/* SECTIONS */\nsection.pad{padding:5.5rem 0}\nsection.pad-alt{padding:5.5rem 0;background:var(--white)}\n.eyebrow{font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,2vw,0.9rem);letter-spacing:.02em;color:var(--goldD);margin-bottom:.8rem;display:flex;align-items:center;gap:10px}\n.eyebrow::before{content:'';width:22px;height:1px;background:var(--gold)}\nh2.st{font-family:var(--serif);font-weight:600;font-size:clamp(1.6rem,4vw,2.7rem);color:var(--navy);margin-bottom:.9rem;line-height:1.15}\nsection.pad-alt h2.st,.papers-section h2.st,.calendar-section h2.st,.helpdesk-section h2.st,.ranker-section h2.st,.reviews-section h2.st{color:var(--navy)}\n.rule{display:flex;align-items:center;gap:12px;margin-bottom:1.7rem}\n.rule-line{height:1px;flex:1;background:linear-gradient(90deg,var(--gold),transparent)}\n.rule-d{width:7px;height:7px;border:2px solid var(--gold);transform:rotate(45deg);flex-shrink:0}\n\n/* RIBBON */\n.ribbon{background:var(--navy);border-top:3px solid var(--gold);padding:3.4rem 5%;position:relative;overflow:hidden}\n.ribbon::before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,rgba(217,119,6,.08),transparent 55%),radial-gradient(circle at 80% 70%,rgba(217,119,6,.06),transparent 55%);pointer-events:none}\n.ribbon-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;text-align:center;position:relative;z-index:1}\n.ribbon-stat{position:relative;transition:.3s cubic-bezier(.22,1,.36,1);cursor:default;padding:1.1rem 1.2rem .7rem;border-right:1px solid rgba(255,255,255,.12);border-radius:12px}\n.ribbon-stat:last-child{border-right:none}\n.ribbon-stat::after{content:'';position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:0;height:3px;border-radius:3px;background:var(--stat-color,var(--gold));transition:.35s cubic-bezier(.22,1,.36,1)}\n.ribbon-stat:hover{transform:translateY(-5px);background:rgba(255,255,255,.04)}\n.ribbon-stat:hover::after{width:46px}\n.ribbon-stat-icon{font-size:1.4rem;margin-bottom:.45rem;opacity:.85;filter:drop-shadow(0 2px 6px rgba(0,0,0,.4))}\n.ribbon-stat strong{display:block;font-family:var(--serif);font-weight:700;font-size:clamp(2.3rem,5.5vw,3.2rem);color:var(--stat-color,var(--goldL));line-height:1;transition:.3s;margin-bottom:.5rem;text-shadow:0 0 24px var(--stat-glow,rgba(245,158,11,.25))}\n.ribbon-stat span{font-size:clamp(0.72rem,1.9vw,0.82rem);color:rgba(255,255,255,.72);letter-spacing:.06em;text-transform:uppercase;font-family:var(--sans);font-weight:600}\n.ribbon-stat:hover strong{filter:brightness(1.15)}\n.ribbon-stat.rs-gold{--stat-color:var(--goldL);--stat-glow:rgba(245,158,11,.35)}\n.ribbon-stat.rs-blue{--stat-color:#5B9BFF;--stat-glow:rgba(37,99,235,.35)}\n.ribbon-stat.rs-green{--stat-color:#4ADE80;--stat-glow:rgba(22,163,74,.35)}\n.ribbon-stat.rs-red{--stat-color:#F87171;--stat-glow:rgba(220,38,38,.35)}\n.ribbon-stat.rs-purple{--stat-color:#C4B5FD;--stat-glow:rgba(124,58,237,.35)}\n\n\n\n/* \u2550\u2550\u2550 RANKER WALL \u2550\u2550\u2550 */\n.ranker-section{background:var(--white);padding:5.5rem 0;position:relative;overflow:hidden}\n.ranker-section .eyebrow{color:var(--goldD)}\n.ranker-section h2.st{color:var(--navy)}\n.ranker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:1.1rem;margin-top:2.2rem}\n.home-video-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:1.1rem;margin-top:1.6rem}\n.home-video-card{display:block;text-decoration:none;background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);overflow:hidden;transition:.3s cubic-bezier(.22,1,.36,1);box-shadow:var(--sh-1)}\n.home-video-card:hover{transform:translateY(-4px);box-shadow:var(--sh-2)}\n.home-video-thumb{position:relative;aspect-ratio:16/9;background:var(--navy);overflow:hidden}\n.home-video-thumb img{width:100%;height:100%;object-fit:cover;display:block;transition:.4s}\n.home-video-card:hover .home-video-thumb img{transform:scale(1.06)}\n.home-video-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--goldL);font-size:1.8rem}\n.home-video-play-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(17,17,17,.28);color:#fff;font-size:1.6rem;opacity:0;transition:.25s}\n.home-video-card:hover .home-video-play-overlay{opacity:1}\n.home-video-title{padding:.75rem .9rem;font-family:var(--sans);font-weight:600;font-size:.85rem;color:var(--navy);line-height:1.4}\n.ranker-card{background:var(--navy3);border-radius:var(--radius);position:relative;overflow:hidden;aspect-ratio:3/4;transition:.4s cubic-bezier(.25,.46,.45,.94);box-shadow:var(--sh-2)}\n.ranker-card:hover{transform:translateY(-10px);box-shadow:var(--sh-3)}\n.ranker-card .rc-edge{position:absolute;top:0;left:0;right:0;height:3px;z-index:3;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green))}\n.ranker-photo{position:absolute;inset:0;width:100%;height:100%;margin:0;border:none;background:linear-gradient(150deg,var(--navy3),var(--navy4));display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:4.5rem;color:rgba(158,158,158,.4)}\n.ranker-photo img{width:100%;height:100%;object-fit:cover;object-position:top center;transition:transform .6s ease}\n.ranker-card:hover .ranker-photo img{transform:scale(1.05)}\n.ranker-card .rc-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(17,17,17,0) 0%,rgba(17,17,17,.08) 40%,rgba(17,17,17,.9) 76%,rgba(17,17,17,.98) 100%)}\n.ranker-card .rc-rank{position:absolute;top:-.3rem;left:.5rem;z-index:2;font-family:var(--serif);font-weight:600;font-size:clamp(2.7rem,7vw,3.6rem);line-height:1;color:rgba(255,255,255,.09);letter-spacing:-.03em;user-select:none;pointer-events:none}\n.ranker-card h4{position:relative;z-index:2;color:#fff;font-family:var(--serif);font-size:clamp(1.0rem,2.4vw,1.1rem);margin-bottom:.25rem;line-height:1.2}\n.ranker-school{position:relative;z-index:2;color:#fff;font-family:var(--sans);font-size:clamp(0.78rem,1.8vw,0.83rem);text-transform:uppercase;font-weight:700;margin-bottom:.2rem}\n.ranker-batch{position:relative;z-index:2;color:rgba(255,255,255,.78);font-size:clamp(0.68rem,1.7vw,0.76rem);font-family:var(--sans)}\n.ranker-card .rc-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:1.1rem 1rem 1rem}\n.ranker-badge{position:absolute;top:.7rem;right:.7rem;z-index:3;background:var(--gold);color:var(--navy);font-family:var(--sans);font-weight:700;font-size:.6rem;letter-spacing:.02em;text-transform:uppercase;padding:.22rem .55rem;border-radius:999px}\n.ranker-cta{margin-top:2.2rem;text-align:center}\n.ranker-note{color:var(--mist);font-size:clamp(0.8rem,2vw,0.9rem);margin-top:1.1rem;text-align:center}\n\n/* ABOUT */\n.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:start}\n.about-text p{color:var(--slate);line-height:1.85;margin-bottom:1.4rem;font-size:clamp(0.95rem,2.4vw,1.05rem)}\n.feat-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:1.5rem}\n.tile{padding:1rem 1.1rem;border:1px solid var(--navy4);border-radius:var(--radius);border-left:3px solid var(--gold);background:var(--white);transition:.25s;cursor:default}\n.tile:hover{border-left-color:var(--goldL);transform:translateX(4px);box-shadow:var(--sh-1)}\n.tile strong{display:block;color:var(--navy);font-size:clamp(0.92rem,2.2vw,1.02rem);margin:.25rem 0 .12rem;font-family:var(--sans);font-weight:600}\n.tile span{color:var(--mist);font-size:clamp(0.78rem,1.9vw,0.88rem)}\n.bar-block{margin-bottom:1.4rem}\n.bar-label{display:flex;justify-content:space-between;margin-bottom:6px;font-size:clamp(0.92rem,2.2vw,1.02rem)}\n.bar-label span{color:var(--slate)}\n.bar-label strong{color:var(--navy);font-family:var(--sans)}\n.bar-track{height:5px;background:var(--navy4);overflow:hidden;border-radius:3px}\n.bar-fill{height:100%;width:0;transition:width 1.4s cubic-bezier(.25,.46,.45,.94);border-radius:3px}\n\n/* HEAD OF INSTITUTE */\n.head-institute-grid{display:grid;grid-template-columns:.45fr .55fr;gap:5rem;align-items:center}\n.head-institute-img{width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,var(--navy4),var(--navy1));border-radius:var(--radius);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.8);font-family:var(--sans);font-size:.75rem;text-transform:uppercase;position:relative;overflow:hidden;box-shadow:var(--sh-3)}\n.head-institute-img img{width:100%;height:100%;object-fit:cover}\n.head-institute-img-badge{position:absolute;bottom:1.2rem;left:1.2rem;right:1.2rem;background:rgba(17,17,17,.92);border-radius:var(--radius);border:1px solid rgba(217,119,6,.35);padding:.9rem 1.1rem;backdrop-filter:blur(8px)}\n.head-institute-img-badge h4{color:#fff;font-family:var(--serif);font-size:clamp(1.0rem,2.8vw,1.1rem);margin-bottom:.15rem}\n.head-institute-img-badge span{color:var(--goldL);font-family:var(--sans);font-size:clamp(0.78rem,1.8vw,0.86rem);text-transform:uppercase}\n.head-institute-quote{font-family:var(--serif);font-size:clamp(1.1rem,2.8vw,1.35rem);color:var(--navy);line-height:1.7;font-style:italic;border-left:4px solid var(--gold);padding-left:1.5rem;margin-bottom:1.6rem;position:relative}\n.head-institute-quote::before{content:'\\201C';position:absolute;left:-.5rem;top:-.9rem;font-size:4.2rem;color:var(--gold);opacity:.16;font-family:var(--serif);line-height:1}\n.head-institute-body p{color:var(--slate);line-height:1.9;margin-bottom:1.1rem;font-size:clamp(1.0rem,2.4vw,1.07rem)}\n.head-institute-sig{font-family:var(--serif);font-size:clamp(1.15rem,2.8vw,1.3rem);color:var(--navy);margin-top:1.6rem}\n.head-institute-sig span{display:block;font-family:var(--sans);font-size:clamp(0.78rem,1.8vw,0.86rem);color:var(--mist);text-transform:uppercase;font-style:normal;margin-top:.25rem}\n\n/* FACULTY */\n.faculty-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1.6rem}\n.faculty-card{background:var(--navy);border-radius:var(--radius);position:relative;overflow:hidden;aspect-ratio:3/4;transition:.4s cubic-bezier(.25,.46,.45,.94);box-shadow:var(--sh-1)}\n.faculty-card:hover{transform:translateY(-7px);box-shadow:var(--sh-3)}\n.faculty-photo{position:absolute;inset:0;width:100%;height:100%;margin:0;border:none;background:linear-gradient(150deg,var(--navy3),var(--navy4));display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:5.5rem;color:rgba(158,158,158,.45)}\n.faculty-photo img{width:100%;height:100%;object-fit:cover;object-position:top center;transition:transform .6s ease}\n.faculty-card:hover .faculty-photo img{transform:scale(1.05)}\n.faculty-card .fc-rank{position:absolute;top:-.4rem;left:.6rem;z-index:2;font-family:var(--serif);font-weight:600;font-size:clamp(2.7rem,8vw,4.6rem);line-height:1;color:rgba(255,255,255,.09);letter-spacing:-.03em;user-select:none;pointer-events:none}\n.faculty-card .fc-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(17,17,17,.05) 0%,rgba(17,17,17,.05) 38%,rgba(17,17,17,.85) 72%,rgba(17,17,17,.98) 100%)}\n.faculty-card .fc-edge{position:absolute;top:0;left:0;right:0;height:3px;z-index:3;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green));transform:scaleX(0);transform-origin:left;transition:transform .5s ease}\n.faculty-card:hover .fc-edge{transform:scaleX(1)}\n.faculty-card .fc-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:1.4rem 1.25rem 1.25rem;text-align:left}\n.faculty-card h3{color:#fff;font-family:var(--serif);font-size:clamp(1.0rem,2.7vw,1.22rem);margin-bottom:.32rem;line-height:1.16}\n.faculty-card .role{color:var(--goldLL);font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,1.8vw,0.86rem);text-transform:uppercase;margin-bottom:.65rem}\n.faculty-card .subj{color:rgba(255,255,255,.82);font-size:clamp(0.9rem,2.1vw,0.97rem);padding-top:.6rem;border-top:1px solid rgba(217,119,6,.22)}\n.faculty-card .exp{font-family:var(--sans);font-size:clamp(0.68rem,1.7vw,0.76rem);text-transform:uppercase;color:rgba(255,255,255,.75);margin-top:.5rem}\n\n/* COURSES */\n.courses-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.2rem}\n.course-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);border-top:4px solid var(--navy3);padding:1.8rem;transition:.25s;position:relative;overflow:hidden}\n.course-card.sainik{border-top-color:var(--red)}\n.course-card.navodaya{border-top-color:var(--navy3)}\n.course-card.foundation{border-top-color:var(--green)}\n.course-card.combined{border-top-color:var(--gold)}\n.course-card:hover{transform:translateY(-5px);box-shadow:var(--sh-2)}\n.course-badge{display:inline-block;font-family:var(--sans);font-weight:700;font-size:clamp(0.68rem,1.8vw,0.8rem);letter-spacing:.02em;text-transform:uppercase;padding:.22rem .7rem;border-radius:999px;margin-bottom:1rem}\n.cb-sainik{background:rgba(220,38,38,.1);color:var(--red);border:1px solid rgba(220,38,38,.2)}\n.cb-nv{background:rgba(37,99,235,.1);color:var(--navy3);border:1px solid rgba(37,99,235,.2)}\n.cb-fn{background:rgba(22,163,74,.1);color:var(--green);border:1px solid rgba(22,163,74,.2)}\n.cb-co{background:rgba(217,119,6,.1);color:var(--goldD);border:1px solid rgba(217,119,6,.2)}\n.course-card h3{color:var(--navy);font-family:var(--serif);font-size:clamp(1.1rem,3vw,1.3rem);margin-bottom:.35rem}\n.course-card .sub{color:var(--mist);font-size:clamp(0.9rem,2.2vw,0.98rem);margin-bottom:1.1rem}\n.course-features{list-style:none;margin-bottom:1.3rem}\n.course-features li{color:var(--slate);font-size:clamp(0.9rem,2.2vw,1rem);padding:.35rem 0;border-bottom:1px solid var(--navy4);display:flex;align-items:center;gap:0.55rem}\n.course-features li::before{content:'\u2713';color:var(--green);font-weight:700;font-size:.85rem;flex-shrink:0}\n.course-enquire{display:block;width:100%;padding:.7rem;background:var(--navy);border-radius:var(--radius);color:#fff;font-family:var(--sans);font-weight:600;font-size:clamp(0.8rem,2vw,0.9rem);cursor:pointer;transition:.2s;text-align:center}\n.course-enquire:hover{background:var(--gold);color:var(--navy)}\n.fee-note{color:var(--mist);font-size:clamp(0.78rem,1.8vw,0.86rem);text-align:center;margin-top:.5rem}\n\n/* \u2550\u2550\u2550 FACILITIES \u2550\u2550\u2550 */\n.facilities-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.2rem}\n.facility-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);padding:1.8rem;transition:.25s;position:relative;overflow:hidden}\n.facility-card:hover{border-color:var(--gold);transform:translateY(-4px);box-shadow:var(--sh-2)}\n.facility-icon{width:56px;height:56px;border-radius:50%;background:rgba(217,119,6,.1);display:flex;align-items:center;justify-content:center;font-size:1.7rem;margin-bottom:1rem}\n.facility-card h3{color:var(--navy);font-family:var(--serif);font-size:clamp(1.05rem,2.8vw,1.2rem);margin-bottom:.55rem}\n.facility-card p{color:var(--slate);font-size:clamp(0.9rem,2.2vw,1.02rem);line-height:1.75}\n.facility-card ul{list-style:none;margin-top:.75rem}\n.facility-card ul li{color:var(--slate);font-size:clamp(0.9rem,2.2vw,0.98rem);padding:.22rem 0;display:flex;align-items:center;gap:0.55rem}\n.facility-card ul li::before{content:'';width:5px;height:5px;border-radius:50%;background:var(--gold);flex-shrink:0}\n\n/* \u2550\u2550\u2550 VIDEO \u2550\u2550\u2550 */\n.video-section{background:var(--cream);padding:5.5rem 0;position:relative;overflow:hidden}\n.video-section .eyebrow{color:var(--goldD)}\n.video-section h2.st{color:var(--navy)}\n.video-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:2.2rem;align-items:start;margin-top:2.2rem}\n.video-main{position:relative}\n.video-embed{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;background:var(--navy);border-radius:var(--radius)}\n.video-embed iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}\n.video-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;cursor:pointer;background:rgba(17,17,17,.9)}\n.video-placeholder:hover .play-btn{transform:scale(1.1);background:var(--goldL)}\n.play-btn{width:66px;height:66px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.4rem;transition:.25s}\n.video-placeholder p{color:rgba(255,255,255,.85);font-family:var(--sans);font-size:clamp(0.9rem,2.2vw,1.02rem);text-transform:uppercase}\n.video-list{display:flex;flex-direction:column;gap:0.8rem}\n.video-item{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);padding:1.05rem 1.25rem;display:flex;gap:1rem;align-items:center;cursor:pointer;transition:.2s}\n.video-item:hover{border-color:var(--goldL);box-shadow:var(--sh-1)}\n.video-thumb{width:50px;height:50px;background:rgba(217,119,6,.12);border:1px solid rgba(217,119,6,.25);border-radius:var(--radius);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;color:var(--goldD)}\n.video-item-title{color:var(--navy);font-family:var(--serif);font-size:clamp(1.0rem,2.3vw,1.06rem);margin-bottom:.2rem}\n.video-item-sub{color:var(--mist);font-family:var(--sans);font-size:clamp(0.78rem,1.8vw,0.86rem);text-transform:uppercase}\n\n/* NOTICES */\n.cards-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1.1rem}\n.notice-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);border-top:3px solid var(--navy3);padding:1.5rem 1.6rem;transition:.25s}\n.notice-card:hover{box-shadow:var(--sh-2);transform:translateY(-2px)}\n.notice-card.urgent{border-top-color:var(--red)}\n.notice-card.success{border-top-color:var(--green)}\n.notice-badge{display:inline-block;font-family:var(--sans);font-weight:700;font-size:clamp(0.68rem,1.8vw,0.8rem);letter-spacing:.02em;text-transform:uppercase;padding:.22rem .7rem;border-radius:999px;margin-bottom:.8rem}\n.badge-open{background:#E4F5EC;color:var(--green)}\n.badge-weekly{background:#EDEDED;color:var(--navy3)}\n.badge-limited{background:#EDEDED;color:var(--red)}\n.notice-card h3{font-family:var(--serif);font-size:clamp(1.05rem,2.8vw,1.15rem);color:var(--navy);margin-bottom:.55rem}\n.notice-card p{color:var(--slate);font-size:clamp(1.0rem,2.3vw,1.03rem);line-height:1.7}\n.notice-date{font-size:clamp(0.68rem,1.8vw,0.8rem);color:var(--mist);text-transform:uppercase;margin-top:.75rem}\n\n/* \u2550\u2550\u2550 BLOG \u2550\u2550\u2550 */\n.blog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem}\n.blog-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);overflow:hidden;transition:.25s}\n.blog-card:hover{transform:translateY(-4px);box-shadow:var(--sh-2);border-color:var(--goldL)}\n.blog-thumb{height:170px;background:linear-gradient(135deg,var(--navy3),var(--navy));display:flex;align-items:center;justify-content:center;font-size:2.5rem;position:relative;overflow:hidden}\n.blog-thumb img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}\n.blog-cat{position:absolute;top:.8rem;left:.8rem;background:var(--gold);color:var(--navy);font-family:var(--sans);font-weight:700;font-size:.62rem;letter-spacing:.02em;text-transform:uppercase;padding:.2rem .6rem;border-radius:999px}\n.blog-body{padding:1.3rem 1.4rem}\n.blog-date{font-family:var(--sans);font-size:clamp(0.68rem,1.8vw,0.8rem);color:var(--mist);text-transform:uppercase;margin-bottom:.45rem}\n.blog-card h3{color:var(--navy);font-family:var(--serif);font-size:clamp(1.18rem,2.6vw,1.24rem);margin-bottom:.55rem;line-height:1.35}\n.blog-card p{color:var(--slate);font-size:clamp(0.9rem,2.2vw,0.99rem);line-height:1.7}\n.blog-read{display:inline-flex;align-items:center;gap:0.3rem;margin-top:1rem;font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,2vw,0.88rem);color:var(--goldD);transition:.2s}\n.blog-read:hover{color:var(--gold);gap:0.55rem}\n\n/* RESULTS */\n.result-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);padding:1.4rem 1.5rem;display:flex;gap:1.6rem;align-items:flex-start;transition:.25s}\n.result-card:hover{box-shadow:var(--sh-1);transform:translateY(-2px)}\n.year-badge{background:var(--navy);color:var(--goldLL);border-radius:var(--radius);font-family:var(--serif);font-weight:600;font-size:clamp(1.2rem,3.5vw,1.55rem);padding:.7rem 1rem;text-align:center;white-space:nowrap;flex-shrink:0;line-height:1}\n.year-badge small{display:block;font-family:var(--sans);font-size:clamp(0.68rem,1.5vw,0.73rem);text-transform:uppercase;color:var(--goldL);margin-top:4px}\n.result-body h3{font-family:var(--serif);font-size:clamp(0.95rem,2.5vw,1.05rem);color:var(--navy);margin-bottom:.4rem}\n.result-body p{color:var(--slate);font-size:clamp(0.9rem,2.2vw,0.99rem);line-height:1.7}\n.result-number{font-family:var(--serif);font-weight:600;font-size:clamp(1.6rem,4vw,2.1rem);color:var(--gold);float:right;line-height:1}\n\n/* ALUMNI */\n.alumni-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1.1rem}\n.alumni-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);padding:1.4rem;text-align:center;transition:.25s}\n.alumni-card:hover{border-color:var(--gold);transform:translateY(-3px);box-shadow:var(--sh-2)}\n.alumni-avatar{width:64px;height:64px;border-radius:50%;background:var(--navy);border:2px solid var(--gold);margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:1.3rem;color:var(--goldL)}\n.alumni-card h4{color:var(--navy);font-family:var(--serif);font-size:clamp(0.95rem,2.5vw,1.05rem);margin-bottom:.25rem}\n.alumni-card .ach{color:var(--green);font-family:var(--sans);font-size:clamp(0.78rem,1.9vw,0.88rem);text-transform:uppercase;font-weight:700;margin-bottom:.2rem}\n.alumni-card .yr{color:var(--mist);font-size:clamp(0.78rem,1.8vw,0.86rem)}\n\n/* TESTIMONIALS */\n.testi-wrap{overflow:hidden;position:relative}\n.testi-track{display:flex;transition:transform .6s cubic-bezier(.25,.46,.45,.94)}\n.testi-card{min-width:100%;padding:2.8rem 2.5rem 2.2rem;background:var(--white);border-radius:var(--radius);border:1px solid var(--navy4);position:relative;box-shadow:var(--sh-2);overflow:hidden}\n.testi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green))}\n.testi-card::after{content:'\\201C';position:absolute;top:-1rem;left:1.6rem;font-family:var(--serif);font-size:5.5rem;line-height:1;color:var(--gold);opacity:.15;pointer-events:none}\n.testi-card .stars{position:relative;z-index:1;color:var(--gold);font-size:clamp(0.9rem,2.5vw,1rem);margin-bottom:.8rem}\n.testi-card blockquote{position:relative;z-index:1;font-family:var(--serif);font-size:clamp(1.05rem,2.8vw,1.2rem);color:var(--navy);line-height:1.75;font-style:italic;margin-bottom:1.6rem}\n.testi-foot{display:flex;align-items:center;gap:1rem;padding-top:1.2rem;border-top:1px solid var(--navy4)}\n.testi-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(150deg,var(--navy3),var(--navy4));border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.15rem;color:var(--goldLL);flex-shrink:0;overflow:hidden}\n.testi-avatar img{width:100%;height:100%;object-fit:cover;object-position:top center}\n.testi-id{display:flex;flex-direction:column;gap:0.25rem;min-width:0}\n.testi-card cite{font-style:normal;font-family:var(--sans);font-weight:700;font-size:clamp(0.9rem,2.2vw,1.02rem);color:var(--navy)}\n.testi-meta{font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,1.8vw,0.84rem);text-transform:uppercase;color:var(--goldD)}\n.slider-ctrl{display:flex;align-items:center;gap:1rem;margin-top:1.3rem}\n.slider-btn{width:38px;height:38px;border-radius:50%;border:1px solid var(--gold);background:transparent;color:var(--gold);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.9rem;transition:.2s}\n.slider-btn:hover{background:var(--gold);color:var(--navy)}\n.slider-dots{display:flex;gap:0}\n.slider-dot{width:7px;height:7px;border-radius:50%;background:var(--navy4);cursor:pointer;transition:.2s;background-clip:content-box;padding:7px;box-sizing:content-box}\n.slider-dot.active{background:var(--gold)}\n\n/* \u2550\u2550\u2550 GOOGLE REVIEWS \u2550\u2550\u2550 */\n.reviews-section{background:var(--cream);padding:5.5rem 0}\n.reviews-section .eyebrow{color:var(--goldD)}\n.reviews-section h2.st{color:var(--navy)}\n.reviews-header{display:flex;align-items:center;gap:2.2rem;margin-bottom:2.2rem;flex-wrap:wrap}\n.reviews-score{background:var(--navy);border-radius:var(--radius);padding:1.6rem 2.1rem;text-align:center;flex-shrink:0}\n.reviews-score .score-num{font-family:var(--serif);font-weight:600;font-size:clamp(2.7rem,6vw,3.5rem);color:var(--goldLL);line-height:1;display:block}\n.reviews-score .score-stars{color:var(--gold);font-size:1.2rem;margin:.35rem 0}\n.reviews-score .score-count{color:rgba(255,255,255,.85);font-family:var(--sans);font-size:clamp(0.78rem,1.9vw,0.86rem);text-transform:uppercase}\n.reviews-desc{color:var(--slate);line-height:1.85;font-size:clamp(1.0rem,2.5vw,1.15rem);max-width:420px}\n.reviews-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.1rem}\n.review-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);padding:1.4rem;transition:.2s}\n.review-card:hover{border-color:var(--goldL);box-shadow:var(--sh-1)}\n.review-top{display:flex;align-items:center;gap:0.8rem;margin-bottom:.85rem}\n.review-av{width:42px;height:42px;border-radius:50%;background:rgba(217,119,6,.15);border:1px solid rgba(217,119,6,.3);display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:1rem;color:var(--goldD);flex-shrink:0}\n.review-name{color:var(--navy);font-family:var(--serif);font-size:clamp(1.0rem,2.3vw,1.06rem)}\n.review-date{color:var(--mist);font-family:var(--sans);font-size:clamp(0.68rem,1.8vw,0.8rem);text-transform:uppercase}\n.review-stars{color:var(--gold);font-size:.85rem;margin-bottom:.55rem}\n.review-text{color:var(--slate);font-size:clamp(0.9rem,2.2vw,0.99rem);line-height:1.7;font-style:italic}\n.google-badge{display:inline-flex;align-items:center;gap:0.55rem;margin-top:1.6rem;padding:.55rem 1.1rem;border:1px solid var(--navy4);border-radius:999px;background:var(--white);color:var(--navy);font-family:var(--sans);font-size:clamp(0.78rem,2vw,0.93rem);cursor:pointer;transition:.2s}\n.google-badge:hover{border-color:var(--goldD);color:var(--goldD)}\n\n/* GALLERY */\n.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}\n.gcell{background:var(--navy4);aspect-ratio:4/3;position:relative;overflow:hidden;cursor:pointer;border-radius:var(--radius)}\n.gcell:hover .gcell-lbl{background:rgba(217,119,6,.9);color:var(--navy)}\n.gcell:hover img{transform:scale(1.05)}\n.gcell-lbl{position:absolute;bottom:0;left:0;right:0;background:rgba(17,17,17,.78);color:var(--goldLL);font-family:var(--sans);font-size:clamp(0.78rem,1.9vw,0.86rem);text-transform:uppercase;padding:.4rem .7rem;transition:.25s}\n.gcell img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease}\n\n/* EVENTS */\n.event-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);padding:1.2rem 1.4rem;display:flex;gap:1.1rem;align-items:center;transition:.25s}\n.event-card:hover{border-color:var(--gold);box-shadow:var(--sh-1);transform:translateX(4px)}\n.event-date-block{text-align:center;min-width:48px;border-right:1px solid var(--navy4);padding-right:1.2rem}\n.event-date-block .day{font-family:var(--serif);font-weight:600;font-size:clamp(1.6rem,4vw,2rem);color:var(--navy);line-height:1}\n.event-date-block .month{font-family:var(--sans);font-size:clamp(0.68rem,1.7vw,0.79rem);text-transform:uppercase;color:var(--mist)}\n.event-body h3{font-family:var(--serif);font-size:clamp(0.95rem,2.5vw,1.05rem);color:var(--navy);margin-bottom:.3rem}\n.event-body span{font-size:clamp(0.9rem,2.2vw,0.99rem);color:var(--slate)}\n\n/* FAQ */\n.faq{border-top:1px solid var(--navy4)}\n.faq-item{border-bottom:1px solid var(--navy4)}\n.faq-q{font-family:var(--serif);font-weight:500;font-size:clamp(1.1rem,2.7vw,1.22rem);color:var(--navy);cursor:pointer;display:flex;justify-content:space-between;gap:1rem;padding:1.1rem 0;transition:.2s}\n.faq-q:hover{color:var(--goldD)}\n.faq-icon{width:24px;height:24px;border:1px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:.78rem;flex-shrink:0;transition:.25s}\n.faq-a{display:none;color:var(--slate);line-height:1.85;padding-bottom:1.1rem;font-size:clamp(1.0rem,2.3vw,1.05rem);animation:fadedown .25s ease}\n@keyframes fadedown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}\n@keyframes tabEnter{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}\n.tab-enter{animation:tabEnter .5s cubic-bezier(.22,1,.36,1)}\n@keyframes heroFadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}\n.hero-enter-1{animation:heroFadeUp .7s cubic-bezier(.22,1,.36,1) .05s both}\n.hero-enter-2{animation:heroFadeUp .7s cubic-bezier(.22,1,.36,1) .15s both}\n.hero-enter-3{animation:heroFadeUp .7s cubic-bezier(.22,1,.36,1) .28s both}\n.hero-enter-4{animation:heroFadeUp .7s cubic-bezier(.22,1,.36,1) .4s both}\n.hero-enter-5{animation:heroFadeUp .7s cubic-bezier(.22,1,.36,1) .52s both}\n\n/* \u2550\u2550\u2550 ONLINE FEE PAYMENT \u2550\u2550\u2550 */\n.fee-section{background:var(--white);padding:4.8rem 0;position:relative;overflow:hidden}\n.fee-grid{display:grid;grid-template-columns:1fr 1fr;gap:3.2rem;align-items:center}\n.fee-info h2{color:#000;font-family:var(--serif);font-size:clamp(1.6rem,4vw,2.25rem);margin-bottom:1.1rem}\n.fee-info p{color:#3A3A3A;line-height:1.85;font-size:clamp(1.0rem,2.4vw,1.08rem);margin-bottom:1.6rem}\n.fee-methods{display:flex;gap:0.55rem;flex-wrap:wrap;margin-bottom:1.6rem}\n.fee-method{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:.45rem 1rem;font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,2vw,0.9rem);color:rgba(255,255,255,.85)}\n.fee-box{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:2.2rem}\n.fee-box h3{color:var(--goldL);font-family:var(--serif);font-size:clamp(1.2rem,3vw,1.35rem);margin-bottom:1.3rem}\n.fee-step{display:flex;gap:1.1rem;align-items:flex-start;margin-bottom:1.1rem;padding-bottom:1.1rem;border-bottom:1px solid rgba(255,255,255,.08)}\n.fee-step:last-of-type{border:none;margin-bottom:1.3rem}\n.fee-step-num{width:30px;height:30px;border:1px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-weight:700;font-size:.78rem;color:var(--gold);flex-shrink:0}\n.fee-step-txt{color:rgba(255,255,255,.82);font-size:clamp(1.0rem,2.3vw,1.03rem);line-height:1.6}\n.fee-step-txt strong{color:#fff;display:block;margin-bottom:.15rem}\n.pay-btn{display:flex;width:100%;padding:1.05rem;background:var(--gold);color:var(--navy);border-radius:var(--radius);font-family:var(--sans);font-weight:700;font-size:clamp(0.9rem,2.5vw,1rem);border:none;cursor:pointer;transition:.2s;align-items:center;justify-content:center;gap:0.55rem}\n.pay-btn:hover{background:var(--goldLL)}\n.pay-note{color:rgba(255,255,255,.7);font-size:clamp(0.68rem,1.8vw,0.8rem);text-align:center;margin-top:.65rem}\n.fee-upi-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:var(--radius);padding:1.3rem 1.4rem;display:flex;gap:1.1rem;align-items:center;flex-wrap:wrap;transition:.25s}.fee-upi-card:hover{border-color:var(--gold);box-shadow:var(--sh-2)}\n.fee-upi-qr{width:96px;height:96px;object-fit:contain;background:#fff;border-radius:var(--radius);padding:5px;flex-shrink:0}\n.fee-upi-info{flex:1;min-width:180px}\n.fee-upi-label{font-family:var(--sans);font-weight:700;font-size:.65rem;letter-spacing:.02em;text-transform:uppercase;color:var(--goldL);margin-bottom:.3rem}\n.fee-upi-id{display:flex;align-items:center;gap:0.55rem;flex-wrap:wrap}\n.fee-upi-id strong{font-family:var(--sans);font-size:clamp(1.0rem,2.8vw,1.25rem);color:#fff;word-break:break-all}\n.fee-upi-copy{font-family:var(--sans);font-weight:700;font-size:.65rem;letter-spacing:.02em;text-transform:uppercase;padding:.35rem .8rem;border-radius:999px;background:rgba(217,119,6,.2);border:1px solid rgba(217,119,6,.4);color:var(--goldLL);cursor:pointer;transition:.2s;white-space:nowrap}\n.fee-upi-copy:hover{background:var(--gold);color:var(--navy)}\n.fee-upi-copy.copied{background:var(--green);color:#fff;border-color:var(--green)}\n.fee-bank-table{width:100%;border-collapse:collapse;margin:1.1rem 0;font-size:clamp(0.9rem,2.1vw,0.96rem)}\n.fee-bank-table td{padding:.55rem 0;border-bottom:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.82)}\n.fee-bank-table td:first-child{color:rgba(255,255,255,.65);font-family:var(--sans);font-size:.68rem;letter-spacing:.02em;text-transform:uppercase;width:40%}\n.fee-bank-table td:last-child{color:#fff;font-weight:600;text-align:right}\n.fee-bank-table tr:last-child td{border:none}\n\n/* ENQUIRY */\n.enquiry-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:2.2rem}\n.form-panel{background:var(--navy);border-radius:var(--radius);padding:2rem}\nlabel.fl{display:block;font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,1.8vw,0.86rem);letter-spacing:.02em;text-transform:uppercase;color:#fff;margin-bottom:.4rem}\ninput.ff,select.ff,textarea.ff{width:100%;padding:12px 16px;border:1px solid rgba(255,255,255,.16);border-radius:var(--radius);background:rgba(255,255,255,.06);color:#fff;font-size:clamp(1.0rem,2.4vw,1.08rem);font-family:var(--sans);outline:none;margin-bottom:1.15rem;transition:.2s}\ninput.ff:focus,select.ff:focus,textarea.ff:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(217,119,6,.15)}\ninput.ff::placeholder,textarea.ff::placeholder{color:rgba(255,255,255,.4)}\nselect.ff option{background:var(--navy);color:#fff}\ntextarea.ff{min-height:100px;resize:vertical}\n.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}\n.contact-card{background:var(--white);border:1px solid var(--navy4);border-radius:var(--radius);border-left:4px solid var(--gold);padding:1.3rem 1.4rem;margin-bottom:1rem;transition:.2s}\n.contact-card:hover{box-shadow:var(--sh-1)}\n.contact-card h3{color:var(--navy);font-family:var(--serif);margin-bottom:.55rem;font-size:clamp(1.15rem,2.6vw,1.2rem)}\n.contact-card p{color:var(--slate);font-size:clamp(0.9rem,2.2vw,1.02rem);line-height:1.8}\n.form-msg{padding:.75rem 1.05rem;border-radius:var(--radius);margin-bottom:1.05rem;font-size:clamp(0.9rem,2.2vw,1.02rem);display:none}\n.form-msg.success{background:#E4F5EC;color:var(--green);border:1px solid rgba(22,163,74,.3)}\n.form-msg.error{background:rgba(220,38,38,.1);color:var(--red);border:1px solid rgba(220,38,38,.3)}\n\n/* SOCIAL */\n.social-strip{display:flex;gap:1rem;margin-top:1.1rem;flex-wrap:wrap}\n.soc-btn{display:inline-flex;align-items:center;gap:0.55rem;font-family:var(--sans);font-weight:600;font-size:clamp(0.78rem,2vw,0.9rem);padding:.55rem 1.1rem;border-radius:999px;border:1px solid;transition:.2s}\n.soc-fb{border-color:#1877F2;color:#1877F2}\n.soc-fb:hover{background:#1877F2;color:#fff}\n.soc-yt{border-color:#FF0000;color:#FF0000}\n.soc-yt:hover{background:#FF0000;color:#fff}\n.soc-ig{border-color:#E1306C;color:#E1306C}\n.soc-ig:hover{background:#E1306C;color:#fff}\n\n/* CTA */\n.cta-block{background:var(--navy);color:#fff;text-align:center;padding:5.2rem 5%;position:relative;overflow:hidden}\n.cta-block h2{font-family:var(--serif);font-weight:600;font-size:clamp(2.1rem,4.5vw,2.6rem);margin-bottom:1.1rem;position:relative;color:#fff}\n.cta-block p{max-width:620px;margin:0 auto 2.2rem;color:rgba(255,255,255,.82);line-height:1.85;position:relative;font-size:clamp(0.92rem,2.4vw,1.02rem)}\n\n/* FOOTER */\nfooter{background:var(--navy1);color:rgba(255,255,255,.78);border-top:1px solid rgba(217,119,6,.2);padding:4rem 5% 2.2rem;padding-bottom:calc(2.2rem + 60px)}\n.footer-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2.2rem;margin-bottom:2.2rem}\nfooter h4{color:#fff;font-family:var(--serif);font-weight:600;font-size:clamp(1.0rem,2.8vw,1.08rem);margin-bottom:1rem}\nfooter a{display:block;margin-bottom:.6rem;color:rgba(255,255,255,.78);font-size:clamp(0.9rem,2.2vw,0.98rem);transition:.2s}\nfooter a:hover{color:var(--goldL);padding-left:4px}\n.foot-social{display:flex;gap:0.55rem;margin-top:.65rem}\n.foot-soc-icon{width:36px;height:36px;border-radius:50%;border:1px solid rgba(217,119,6,.28);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.78);transition:.2s}\n.foot-soc-icon svg{width:16px;height:16px;fill:currentColor;transition:.2s}\n.foot-soc-icon:hover{border-color:var(--goldL);color:var(--goldL);background:rgba(217,119,6,.12);transform:translateY(-2px)}\n.footer-bottom{border-top:1px solid rgba(217,119,6,.12);padding-top:1.5rem;display:flex;justify-content:space-between;align-items:center;font-size:clamp(0.78rem,1.8vw,0.86rem);color:rgba(255,255,255,.7);flex-wrap:wrap;gap:0.55rem}\n.footer-tricolor{display:flex;gap:3px;height:3px;width:44px}\n.footer-tricolor div{flex:1}\n.footer-tricolor div:nth-child(1){background:var(--saffron)}\n.footer-tricolor div:nth-child(2){background:#fff}\n.footer-tricolor div:nth-child(3){background:var(--green)}\n\n/* MAP */\n.map-wrap{position:relative;width:100%;height:240px;background:var(--navy4);border-radius:var(--radius);overflow:hidden;cursor:pointer}\n.map-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.55rem;background:var(--navy4)}\n.map-placeholder span{font-family:var(--sans);font-size:clamp(0.78rem,2vw,0.95rem);text-transform:uppercase;color:var(--slate)}\n.map-load-btn{font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,2vw,0.92rem);padding:.55rem 1.3rem;border-radius:999px;background:var(--navy);color:var(--goldL);border:1px solid rgba(217,119,6,.3);cursor:pointer;transition:.2s}\n.map-frame{width:100%;height:100%;border:0}\n\n/* WA FLOAT */\n#waFloat{position:fixed;bottom:5.5rem;right:1.5rem;z-index:995;width:52px;height:52px;background:var(--wa);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 20px rgba(37,211,102,.4);cursor:pointer;animation:wab 2.5s ease-in-out infinite;text-decoration:none}\n#waFloat:hover{animation:none;transform:scale(1.1)}\n#waFloat svg{width:25px;height:25px;fill:#fff}\n#waFloat .wa-tooltip{position:absolute;right:64px;background:var(--navy);color:#fff;font-family:var(--sans);font-size:clamp(0.78rem,2vw,0.9rem);padding:.45rem .85rem;white-space:nowrap;border-radius:var(--radius);pointer-events:none;opacity:0;transition:.2s}\n#waFloat:hover .wa-tooltip{opacity:1}\n@keyframes wab{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n.ls{font-family:var(--sans);font-weight:700;font-size:clamp(0.68rem,1.7vw,0.79rem);letter-spacing:.02em;text-transform:uppercase;padding:.2rem .6rem}\n\n/* \u2550\u2550\u2550 PROMO BANNER \u2550\u2550\u2550 */\n.promo-banner{position:relative;background:linear-gradient(120deg,var(--navy) 0%,var(--navy3) 55%,var(--navy2) 100%);overflow:hidden;padding:3.8rem 5%}\n.promo-banner::after{content:'';position:absolute;right:-6%;top:-30%;width:420px;height:420px;border-radius:50%;border:1px solid rgba(217,119,6,.16)}\n.promo-inner{position:relative;z-index:2;width:min(1200px,100%);margin:auto;display:flex;align-items:center;justify-content:space-between;gap:2.2rem;flex-wrap:wrap}\n.promo-badge{display:inline-flex;align-items:center;gap:0.55rem;font-family:var(--sans);font-weight:700;font-size:clamp(0.68rem,1.7vw,0.79rem);letter-spacing:.02em;text-transform:uppercase;color:var(--goldLL);background:rgba(217,119,6,.16);border:1px solid rgba(217,119,6,.35);border-radius:999px;padding:.4rem .9rem;margin-bottom:1rem}\n.promo-badge::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--goldLL)}\n.promo-text{max-width:640px}\n.promo-text h2{font-family:var(--serif);font-weight:600;font-size:clamp(1.6rem,4vw,2.35rem);color:#fff;line-height:1.18;margin-bottom:.65rem}\n.promo-text h2 em{color:var(--goldLL);font-style:italic}\n.promo-text p{color:rgba(255,255,255,.78);font-size:clamp(1.0rem,2.2vw,1.08rem);line-height:1.7;max-width:520px}\n.promo-cta{display:flex;flex-direction:column;align-items:flex-start;gap:0.8rem;flex-shrink:0}\n.promo-cta-row{display:flex;gap:0.8rem;flex-wrap:wrap}\n.promo-note{color:rgba(255,255,255,.75);font-family:var(--sans);font-size:clamp(0.68rem,1.7vw,0.76rem);text-transform:uppercase}\n\n/* \u2550\u2550\u2550 SECTION-WISE GALLERY \u2550\u2550\u2550 */\n.gcat-block{margin-bottom:3.2rem}\n.gcat-block:last-child{margin-bottom:0}\n.gcat-hd{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin-bottom:1.1rem;flex-wrap:wrap}\n.gcat-title{display:flex;align-items:center;gap:0.55rem}\n.gcat-title h3{font-family:var(--serif);font-size:clamp(1.05rem,2.8vw,1.3rem);color:var(--navy)}\n.gcat-count{font-family:var(--sans);font-weight:700;font-size:.65rem;letter-spacing:.02em;text-transform:uppercase;color:var(--mist);background:var(--white);border:1px solid var(--navy4);border-radius:999px;padding:.2rem .65rem}\n.gcat-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n.gph2{position:relative;overflow:hidden;cursor:pointer;background:linear-gradient(150deg,var(--navy1),var(--navy4));aspect-ratio:4/3;transition:.2s;border-radius:var(--radius)}\n.gph2::before{content:attr(data-icon);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2.2rem;opacity:.35;color:var(--navy3)}\n.gph2 img{width:100%;height:100%;object-fit:cover;position:relative;z-index:1;transition:transform .5s ease}\n.gph2:hover{box-shadow:var(--sh-2)}\n.gph2:hover img{transform:scale(1.06)}\n.gph2-zoom{position:absolute;top:.5rem;right:.5rem;z-index:3;width:28px;height:28px;border-radius:50%;background:rgba(17,17,17,.55);color:var(--goldLL);display:flex;align-items:center;justify-content:center;font-size:.85rem;opacity:0;transition:.2s}\n.gph2:hover .gph2-zoom{opacity:1}\n.gph-lbl{position:absolute;left:0;right:0;bottom:0;z-index:2;background:linear-gradient(0deg,rgba(17,17,17,.82),transparent);color:var(--goldLL);font-family:var(--sans);font-weight:700;font-size:clamp(0.68rem,1.7vw,0.79rem);text-transform:uppercase;padding:1.1rem .7rem .5rem}\n\n/* GALLERY LIGHTBOX */\n.lb-overlay{position:fixed;inset:0;z-index:3000;background:rgba(17,17,17,.96);display:flex;align-items:center;justify-content:center;padding:2rem;animation:lbfade .2s ease}\n@keyframes lbfade{from{opacity:0}to{opacity:1}}\n\n/* ═══ RESULT POSTER POPUP + STICKY BADGE ═══ */\n@keyframes posterPopIn{from{opacity:0;transform:scale(.92) translateY(10px)}to{opacity:1;transform:none}}\n@keyframes posterBadgeIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}\n.poster-overlay{position:fixed;inset:0;z-index:3200;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:1.2rem;animation:lbfade .25s ease}\n.poster-modal{position:relative;max-width:min(420px,92vw);max-height:88vh;animation:posterPopIn .35s cubic-bezier(.22,1,.36,1);box-shadow:var(--sh-3);border-radius:16px;overflow:hidden;background:var(--white)}\n.poster-modal img{width:100%;height:100%;max-height:88vh;object-fit:contain;display:block}\n.poster-close{position:absolute;top:.6rem;right:.6rem;z-index:2;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;border:none;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s}\n.poster-close:hover{background:rgba(0,0,0,.85);transform:scale(1.08)}\n.poster-badge{position:fixed;right:1.5rem;bottom:9.6rem;z-index:900;width:64px;height:64px;border-radius:14px;overflow:hidden;border:2px solid var(--gold);box-shadow:var(--sh-3);cursor:pointer;padding:0;background:var(--white);animation:posterBadgeIn .35s cubic-bezier(.22,1,.36,1)}\n.poster-badge img{width:100%;height:100%;object-fit:cover;display:block}\n.poster-badge:hover{transform:translateY(-3px)}\n.poster-badge-close{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:var(--navy);color:#fff;font-size:.6rem;display:flex;align-items:center;justify-content:center;cursor:pointer;border:2px solid var(--white)}\n@media(max-width:640px){.poster-badge{right:1.2rem;bottom:9rem;width:56px;height:56px}}\n.lb-frame{position:relative;width:min(760px,90vw);background:var(--navy);border-radius:var(--radius);overflow:hidden}\n.lb-photo{width:100%;aspect-ratio:16/10;background:linear-gradient(150deg,var(--navy3),var(--navy4));position:relative}\n.lb-photo::before{content:attr(data-icon);position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:4rem;opacity:.4}\n.lb-cap{padding:1.25rem 1.55rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;border-top:1px solid rgba(217,119,6,.2)}\n.lb-cat{font-family:var(--sans);font-weight:700;font-size:.65rem;letter-spacing:.02em;text-transform:uppercase;color:var(--goldL);display:block;margin-bottom:.25rem}\n.lb-cap h4{font-family:var(--serif);font-size:clamp(1.0rem,2.8vw,1.2rem);color:#fff}\n.lb-count{font-family:var(--sans);font-weight:700;font-size:.7rem;letter-spacing:.02em;color:rgba(255,255,255,.78);flex-shrink:0}\n.lb-close{position:absolute;top:1.2rem;right:1.5rem;z-index:3001;background:none;border:1px solid rgba(217,119,6,.35);color:var(--goldL);width:38px;height:38px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s}\n.lb-close:hover{background:rgba(217,119,6,.15);border-color:var(--goldL)}\n.lb-nav{position:absolute;top:50%;transform:translateY(-50%);z-index:3001;background:rgba(17,17,17,.6);border:1px solid rgba(217,119,6,.35);color:var(--goldL);width:48px;height:48px;border-radius:50%;font-size:1.6rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s;line-height:1}\n.lb-nav:hover{background:var(--gold);color:var(--navy);border-color:var(--gold)}\n.lb-prev{left:2rem}\n.lb-next{right:2rem}\n\n@media(max-width:640px){\n  .lb-nav{width:40px;height:40px;font-size:1.3rem}\n  .lb-prev{left:.5rem}\n  .lb-next{right:.5rem}\n  .lb-close{top:.6rem;right:.6rem}\n  .gcat-grid2{gap:8px}\n}\n@media(max-width:1150px){\n  .nav-cat-btn{padding:.5rem .4rem;font-size:.76rem}\n  .nav-links{gap:0.05rem}\n}\n\n@media(max-width:900px){\n  html{font-size:clamp(16px,4.4vw,18px)}\n  .nav-inner{height:auto;min-height:64px;padding:.5rem 0;flex-wrap:nowrap}\n  .brand img{height:36px!important;width:36px!important}\n  .brand-text h2{font-size:.92rem}\n  .brand-text small{font-size:.6rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;display:block}\n  .nav-fixed-actions{gap:.35rem}\n  .nav-fee,.nav-btn{padding:.4rem .6rem!important;font-size:.62rem!important}\n  .hero-wrap,.about-grid,.enquiry-grid,.head-institute-grid,.fee-grid,.video-grid,.scholar-grid,.portal-grid,.mocktest-grid,.app-grid,.helpdesk-grid{grid-template-columns:1fr}\n  .footer-grid{grid-template-columns:1fr 1fr}\n  .nav-links{display:none}\n  .hamburger{display:flex}\n  .dash-panel{margin-top:2rem}\n  .form-row{grid-template-columns:1fr}\n  .gallery-grid{grid-template-columns:1fr 1fr}\n  .result-card{flex-direction:column;gap:0.8rem}\n  .stu-hdr{flex-direction:column;text-align:center}\n  #stickyBar p{display:none}\n  .ranker-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}\n  .top-bar-right{display:none}\n  .result-banner-slide{height:clamp(160px,40vw,240px)}\n  .timeline::before{left:80px}\n  .tl-date{min-width:70px}\n}\n@media(max-width:520px){\n  html{font-size:clamp(15px,5vw,17px)}\n  .brand-text small{display:none}\n  .nav-fee,.nav-btn{padding:.35rem .5rem!important;font-size:.58rem!important}\n  .footer-grid{grid-template-columns:1fr}\n  .hero-btns{flex-direction:column}\n  .courses-grid{grid-template-columns:1fr}\n  .ribbon-grid{grid-template-columns:repeat(2,1fr);row-gap:1.6rem}\n.ribbon-stat{border-right:none!important;border-bottom:1px solid rgba(255,255,255,.12)}\n.ribbon-stat:nth-child(odd){border-right:1px solid rgba(255,255,255,.12)!important}\n.ribbon-grid>.ribbon-stat:nth-last-child(-n+2){border-bottom:none}\n  .stats-bar{gap:0.6rem}\n  .stat-item{padding-right:1.1rem}\n  .ranker-grid{grid-template-columns:repeat(2,1fr)}\n  .reviews-grid{grid-template-columns:1fr}\n  .countdown-units{gap:0.3rem}\n  .cd-unit{min-width:44px;padding:.35rem .55rem}\n  .top-bar{display:none}\n  #langBar{justify-content:center}\n  .test-dates{grid-template-columns:1fr 1fr}\n  .syl-grid{grid-template-columns:1fr}\n  .papers-grid{grid-template-columns:1fr}\n  .timeline::before{display:none}\n  .tl-item{flex-direction:column;gap:0.55rem}\n  .tl-date{text-align:left;min-width:auto;display:flex;gap:0.55rem;align-items:baseline}\n  .tl-dot{display:none}\n  .app-features{grid-template-columns:1fr}\n  .app-btns{flex-direction:column}\n}\n\n/* \u2550\u2550\u2550 PART DIVIDER \u2550\u2550\u2550 */\n.part-divider{position:relative;background:var(--navy);padding:4rem 5% 4.4rem;overflow:hidden;text-align:center}\n.part-divider-inner{position:relative;z-index:2;max-width:640px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:0.55rem}\n.part-divider-fade{position:absolute;left:0;right:0;height:64px;pointer-events:none;z-index:1}\n.part-divider-fade-top{top:0;background:linear-gradient(180deg,rgba(17,17,17,.0),var(--navy))}\n.part-divider-fade-bottom{bottom:0;background:linear-gradient(0deg,rgba(17,17,17,.0),var(--navy))}\n.part-num{font-family:var(--serif);font-weight:600;font-size:clamp(2.7rem,6vw,3.6rem);color:rgba(255,255,255,.14);line-height:1;margin-bottom:-.6rem}\n.part-eyebrow{font-family:var(--sans);font-weight:700;font-size:clamp(0.78rem,2vw,0.9rem);letter-spacing:.02em;text-transform:uppercase;color:var(--goldL)}\n.part-title{font-family:var(--serif);font-weight:600;font-size:clamp(1.6rem,4vw,2.35rem);color:#fff;margin:.2rem 0}\n.part-sub{color:rgba(255,255,255,.78);font-size:clamp(1.0rem,2.2vw,1.07rem);max-width:460px;line-height:1.7}\n.part-ornament{width:64px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);position:relative;margin-top:.35rem}\n.part-ornament::before{content:'\u25c6';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:var(--gold);font-size:.5rem;background:var(--navy);padding:0 6px}\n\n/* \u2550\u2550\u2550 SUBSECTION TAG \u2550\u2550\u2550 */\n.subsection-tag{display:flex;align-items:center;justify-content:center;gap:16px;padding:2.8rem 5% 0;max-width:1200px;margin:0 auto}\n.subsection-tag span{font-family:var(--sans);font-weight:700;font-size:.7rem;letter-spacing:.02em;text-transform:uppercase;color:var(--goldD);white-space:nowrap}\n.subsection-tag::before,.subsection-tag::after{content:'';flex:1;max-width:140px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}\n\n/* NAV CATEGORY DROPDOWN */\n.nav-menu-desktop{align-items:center}\n.nav-cat{position:relative}\n.nav-cat-btn{display:inline-flex;align-items:center;gap:0.3rem;background:transparent;border:none;cursor:pointer;font-family:var(--sans);font-size:.82rem;font-weight:500;color:#fff;padding:.5rem .6rem;border-radius:999px;transition:background .2s ease,color .2s ease}\n.nav-cat-link-flat{display:inline-flex;align-items:center;gap:0.3rem;font-family:var(--sans);font-size:.82rem;font-weight:500;color:#fff;padding:.5rem .6rem;border-radius:999px;transition:background .2s ease,color .2s ease;text-decoration:none}\n.nav-cat-link-flat:hover{background:rgba(217,119,6,.15);color:var(--goldL)}\n.mob-cat-link-flat{display:block;width:100%;text-align:left;background:none;border:none;color:rgba(255,255,255,.78);font-family:var(--sans);font-weight:500;font-size:clamp(0.9rem,2.5vw,1rem);padding:.9rem .25rem;border-bottom:1px solid rgba(217,119,6,.12);text-decoration:none}\n.mob-cat-link-flat:active{background:rgba(217,119,6,.08)}\n.nav-cat-btn:hover,.nav-cat-btn.active{background:rgba(217,119,6,.14);color:var(--goldL)}\n.nav-cat-arrow{font-size:.6rem;transition:transform .2s ease}\n.nav-cat-btn.active .nav-cat-arrow{transform:rotate(180deg)}\n.nav-cat-dropdown{position:absolute;top:calc(100% + 6px);left:0;min-width:220px;background:var(--navy);border:1px solid rgba(217,119,6,.28);border-radius:8px;box-shadow:var(--sh-3);padding:.45rem;z-index:200}\n.nav-cat-link{display:block;padding:.6rem .8rem;font-family:var(--sans);font-size:.82rem;color:#fff;text-decoration:none;border-radius:6px;border-left:2px solid transparent;transition:background .15s ease,color .15s ease,border-color .15s ease}\n.nav-cat-link:hover{background:rgba(217,119,6,.15);color:var(--goldL);border-left-color:var(--gold)}\n.mob-cat{border-bottom:1px solid rgba(217,119,6,.12)}\n.mob-cat-btn{width:100%;display:flex;align-items:center;justify-content:space-between;background:transparent;border:none;cursor:pointer;padding:.9rem .25rem;font-family:var(--sans);font-size:.92rem;font-weight:600;color:#fff}\n.mob-cat-btn.expanded{color:var(--goldL)}\n.mob-cat-arrow{font-size:.7rem;transition:transform .2s ease}\n.mob-cat-btn.expanded .mob-cat-arrow{transform:rotate(180deg)}\n.mob-cat-links{display:flex;flex-direction:column;gap:0.25rem;padding:.25rem 0 .8rem .8rem;border-left:2px solid rgba(217,119,6,.3);margin-left:.25rem}\n.mob-sub-link{padding:.6rem .65rem;font-family:var(--sans);font-size:.82rem;color:rgba(255,255,255,.82);text-decoration:none;border-radius:6px}\n.mob-sub-link:active{background:rgba(217,119,6,.15);color:var(--goldL)}\n.tab-nav-wrap{background:var(--white);border-bottom:1px solid rgba(17,17,17,.08);position:sticky;top:0;z-index:40;box-shadow:var(--sh-1)}.tab-nav-strip{display:flex;gap:.5rem;overflow-x:auto;white-space:nowrap;padding:.7rem 0;-ms-overflow-style:none;scrollbar-width:none}.tab-nav-strip::-webkit-scrollbar{display:none}.tab-nav-btn{flex:0 0 auto;font-family:var(--sans);font-size:.82rem;font-weight:600;letter-spacing:.01em;color:var(--navy);background:var(--navy4);border:1px solid transparent;border-radius:999px;padding:.5rem 1rem;cursor:pointer;transition:.25s cubic-bezier(.22,1,.36,1)}\n.tab-nav-btn:hover{transform:translateY(-1px)}\n.tab-nav-btn:active{transform:scale(.96)}\n.tab-nav-btn.cat-gold{background:rgba(217,119,6,.1);color:var(--goldD)}\n.tab-nav-btn.cat-gold:hover{background:rgba(217,119,6,.2);border-color:var(--goldL)}\n.tab-nav-btn.cat-gold.active{background:var(--gold);color:#fff;border-color:var(--goldD);box-shadow:var(--sh-2)}\n.tab-nav-btn.cat-red{background:rgba(220,38,38,.08);color:#B91C1C}\n.tab-nav-btn.cat-red:hover{background:rgba(220,38,38,.16);border-color:var(--red)}\n.tab-nav-btn.cat-red.active{background:var(--red);color:#fff;border-color:#B91C1C;box-shadow:var(--sh-2)}\n.tab-nav-btn.cat-blue{background:rgba(37,99,235,.08);color:var(--navy3)}\n.tab-nav-btn.cat-blue:hover{background:rgba(37,99,235,.16);border-color:var(--navy3)}\n.tab-nav-btn.cat-blue.active{background:var(--navy3);color:#fff;border-color:#1D4ED8;box-shadow:var(--sh-2)}\n.tab-nav-btn.cat-green{background:rgba(22,163,74,.08);color:#15803D}\n.tab-nav-btn.cat-green:hover{background:rgba(22,163,74,.16);border-color:var(--green)}\n.tab-nav-btn.cat-green.active{background:var(--green);color:#fff;border-color:#15803D;box-shadow:var(--sh-2)}\n.tab-nav-btn.cat-purple{background:rgba(124,58,237,.08);color:#6D28D9}\n.tab-nav-btn.cat-purple:hover{background:rgba(124,58,237,.16);border-color:var(--saffron)}\n.tab-nav-btn.cat-purple.active{background:var(--saffron);color:#fff;border-color:#5B21B6;box-shadow:var(--sh-2)}"
    }}
  />
  {/* NO-JS FALLBACK: Make content visible if JavaScript fails */}
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n/* If JS fails, show content after 3 seconds */\n@media (prefers-reduced-motion: no-preference) {\n  .reveal, .reveal-left, .reveal-right, .reveal-scale {\n    animation: forceVisible 0.1s ease 3s forwards;\n  }\n  @keyframes forceVisible {\n    to { opacity: 1; transform: none; }\n  }\n}\n/* Immediate fallback for no-JS */\n.no-js .reveal, .no-js .reveal-left, .no-js .reveal-right, .no-js .reveal-scale {\n  opacity: 1 !important;\n  transform: none !important;\n}\n"
    }}
  />
  <div id="sp" />
  {/* LANGUAGE BAR */}
  <div id="langBar">
    <span
      style={{
        color: "rgba(230,230,230,.85)",
        fontFamily: 'Inter,sans-serif',
        fontSize: ".65rem",
        letterSpacing: ".1em",
        textTransform: "uppercase"
      }}
    >
      Language:
    </span>
    <button className="lang-btn active" onClick={(e) => window.setLang('en', e.currentTarget)}>
      English
    </button>
    <button className="lang-btn" onClick={(e) => window.setLang('hi', e.currentTarget)}>
      हिंदी
    </button>
  </div>
  {/* ① TOP CONTACT BAR */}
  <div className="top-bar">
    <div className="top-bar-left">
      <a href="tel:+918974298074" className="top-bar-item">
        <span>📞</span>
        <span data-en="">+91 89742 98074</span>
        <span data-hi="">+91 89742 98074</span>
      </a>
      <a href="mailto:gnsikhangabok@gmail.com" className="top-bar-item">
        <span>✉</span> gnsikhangabok@gmail.com
      </a>
      <span className="top-bar-item">
        <span>📍</span>
        <span data-en="">Khangabok, Thoubal, Manipur</span>
        <span data-hi="">खंगाबोक, थौबल, मणिपुर</span>
      </span>
    </div>
    <div className="top-bar-right">
      <span className="top-bar-hours">
        <span data-en="">Mon–Sat: 08:30–17:00</span>
        <span data-hi="">सोम–शनि: 08:30–17:00</span>
      </span>
      <div className="top-bar-social">
        <a
          className="top-bar-soc"
          href="https://facebook.com/gnsikhangabok"
          target="_blank"
          title="Facebook"
        >
          f
        </a>
        <a
          className="top-bar-soc"
          href="https://youtube.com/@gnsikhangabok"
          target="_blank"
          title="YouTube"
        >
          ▶
        </a>
        <a
          className="top-bar-soc"
          href="https://instagram.com/gnsikhangabok"
          target="_blank"
          title="Instagram"
        >
          ◉
        </a>
        <a
          className="top-bar-soc"
          href="https://wa.me/918974298074"
          target="_blank"
          title="WhatsApp"
          style={{ color: "#4AE382", borderColor: "rgba(37,211,102,.3)" }}
        >
          W
        </a>
        <a
          className="top-bar-soc"
          href="https://play.google.com/store"
          target="_blank"
          title="Play Store"
        >
          ▲
        </a>
      </div>
    </div>
  </div>
  {/* STICKY APPLY BAR */}
  <div id="stickyBar">
    <p>
      🏆 <strong>66 students selected</strong> in NVS &amp; Sainik School
      2025–26 — across Manipur.
    </p>
    <div className="sticky-btns">
      <button
        className="sb-btn sb-btn-gold"
        onClick={() => {
          document.getElementById('resultBanner').scrollIntoView({ behavior: 'smooth' });
          document.getElementById('stickyBar').classList.remove('show');
        }}
      >
        View Results →
      </button>
      <a
        href="https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20would%20like%20to%20know%20more%20about%20your%20programs."
        className="sb-btn sb-btn-wa"
        target="_blank"
      >
        WhatsApp
      </a>
      <button
        className="sb-close"
        onClick={(e) => {
          const bar = e.currentTarget.parentElement.parentElement;
          bar.classList.remove('show');
          bar.style.display = 'none';
        }}
        title="Dismiss"
      >
        ✕
      </button>
    </div>
  </div>
  {/* ALERT strip removed — no active admissions messaging (admissions closed Feb) */}
  {/* TICKER */}
  <div className="ticker-wrap">
    <div className="ticker-inner">
      <div className="ticker-label">Latest</div>
      <div className="ticker-scroll">
        <div className="ticker-track">
          RESULT: 66 SELECTED IN NVS &amp; SAINIK
          SCHOOL 2025–26 ◆ SUMMER BATCH COMMENCING JULY 2026 ◆ SUNDAY MOCK TESTS
          ONGOING ◆ EST. 2016 · 200+ OFFICERS PRODUCED ◆ CALL +91 89742 98074 ◆
          KHANGABOK, THOUBAL, MANIPUR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RESULT:
          66 SELECTED IN NVS &amp; SAINIK SCHOOL 2025–26
          ◆ SUMMER BATCH COMMENCING JULY 2026 ◆ SUNDAY MOCK TESTS ONGOING ◆ EST.
          2016 · 200+ OFFICERS PRODUCED ◆ CALL +91 89742 98074 ◆ KHANGABOK,
          THOUBAL, MANIPUR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </div>
      </div>
    </div>
  </div>
  {/* Countdown bar removed — no active admissions deadline (admissions closed Feb) */}
  {/* ② 10-YEARS CELEBRATION BANNER — replaces the old rotating result-banner
      slider; single static full-bleed photo, no text overlay (the banner
      image already carries its own text). */}
  <div className="ten-years-banner">
    <img src={TEN_YEARS_BANNER_URL} alt="Celebrating 10 Years of Success — GNSI" />
  </div>
  {/* NAV */}
  <nav>
    <div className="nav-inner">
      <a className="brand" href="#">
        <img src={EMBLEM_URL} alt="GNSI" style={{ height: 46, width: 46, objectFit: "contain", flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
        <div className="brand-text">
          <h2>GNSI</h2>
          <small>Est. 2016 · Khangabok, Manipur</small>
        </div>
      </a>
      {/* Full nav (Admissions, Results, Courses, etc.) now lives only inside
          the hamburger menu at every screen size — collapsed until the user
          opens it. Only the logo (left, above) and these two frequent
          actions plus the menu toggle stay fixed in the bar. */}
      <div className="nav-fixed-actions">
        <button
          onClick={() => setIsFeeOpen(true)}
          className="nav-fee"
          style={{
            fontFamily: 'Inter,sans-serif',
            fontWeight: 700,
            fontSize: ".72rem",
            letterSpacing: ".07em",
            textTransform: "uppercase",
            display: "inline-block",
            padding: ".5rem 1.1rem",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            cursor: "pointer"
          }}
        >
          Pay Fee →
        </button>
        <button
          onClick={onLogin}
          className="nav-btn"
          style={{
            fontFamily: 'Inter,sans-serif',
            fontWeight: 700,
            fontSize: ".72rem",
            letterSpacing: ".07em",
            textTransform: "uppercase",
            borderRadius: 10
          }}
        >
          Staff Login →
        </button>
        <button
          className={"hamburger" + (mobileOpen ? " open" : "")}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileOpen}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
    </div>
  </nav>
  <div className={"mob-menu" + (mobileOpen ? " open" : "")}>
    <div className="mob-menu-hd">
      <div className="mob-menu-brand">
        <img src={EMBLEM_URL} alt="GNSI" style={{ height: 34, width: 34, objectFit: "contain", flexShrink: 0 }} onError={(e) => { e.target.style.display = "none"; }} />
        <span>GNSI</span>
      </div>
      <button className="mob-menu-close" onClick={closeMobile} aria-label="Close menu">
        ✕
      </button>
    </div>
    <div className="mob-menu-scroll">
      <a
        href="#home"
        onClick={(e) => { e.preventDefault(); closeMobile(); goToTab('home'); }}
        className="mob-cat-link-flat"
      >
        🏠 Home
      </a>
      {navCategories.map((cat, idx) => (
        cat.links.length === 1 ? (
          <a
            key={cat.label}
            href={cat.links[0].href}
            onClick={(e) => { e.preventDefault(); closeMobile(); goToHash(cat.links[0].href); }}
            className="mob-cat-link-flat"
          >
            {cat.icon} {cat.label}
          </a>
        ) : (
          <div className="mob-cat" key={cat.label}>
            <button
              type="button"
              className={"mob-cat-btn" + (expandedCat === idx ? " expanded" : "")}
              onClick={() => toggleCat(idx)}
            >
              <span>{cat.icon} {cat.label}</span>
              <span className="mob-cat-arrow">▾</span>
            </button>
            {expandedCat === idx && (
              <div className="mob-cat-links">
                {cat.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="mob-sub-link"
                    onClick={(e) => { e.preventDefault(); closeMobile(); goToHash(link.href); }}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      ))}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); setIsPortalOpen(true); closeMobile(); }}
        className="mob-par"
      >
        Parents Portal →
      </a>
      <button
        onClick={() => { onLogin(); closeMobile(); }}
        className="mob-staff"
      >
        Staff Login →
      </button>
    </div>
    <div className="mob-menu-bottom">
      <button onClick={() => { setIsFeeOpen(true); closeMobile(); }} className="mmb-fee">
        💳 Pay Fee
      </button>
      <a href="#enquiry" onClick={(e) => { e.preventDefault(); closeMobile(); goToTab('enquiry'); }} className="mmb-apply">
        Apply Now →
      </a>
    </div>
  </div>
  {/* HERO */}
  <section className="hero">
    <div className="hero-pattern" />
    <div className="hero-orb hero-orb1" />
    <div className="hero-orb hero-orb2" />
    <div className="hero-wrap">
      <div>
        <div className="tricolor">
          <div />
          <div />
          <div />
        </div>
        <div className="hero-eyebrow hero-enter-1">Est. 2016 · 200+ Students Selected</div>
        <h1 className="hero-enter-2">
          <em>
            <span data-en="">Forge Discipline.</span>
            <span data-hi="">अनुशासन गढ़ो।</span>
          </em>
          <span>
            <span data-en="">Command Excellence.</span>
            <span data-hi="">श्रेष्ठता का नेतृत्व करो।</span>
          </span>
        </h1>
        <p className="hero-enter-3">
          <span data-en="">
            Guidance Navodaya &amp; Sainik Institute — Manipur's premier
            residential coaching centre for NVS, Sainik School, and RMS entrance
            examinations. Over <strong>200 successful students</strong> selected
            into Navodaya and Sainik School in a decade of dedicated coaching.
          </span>
          <span data-hi="">
            गाइडेंस नवोदय और सैनिक इंस्टीट्यूट — मणिपुर का प्रमुख आवासीय कोचिंग
            केंद्र NVS, सैनिक स्कूल और RMS प्रवेश परीक्षाओं के लिए। एक दशक में{" "}
            <strong>200+ सफल विद्यार्थी</strong> नवोदय और सैनिक स्कूल में चयनित हुए।
          </span>
        </p>
        {/* Proof-first: stats before the ask, so the claim in the eyebrow/
            headline is backed up before we ask for any action. */}
        <div className="stats-bar hero-enter-4">
          <div className="stat-item">
            <strong>
              <span className="count-up" id="stat-selection-rate" data-target={95} data-suffix="%">
                95%
              </span>
            </strong>
            <span>Selection Rate</span>
          </div>
          <div className="stat-item">
            <strong>
              <span className="count-up" id="stat-years" data-target={10} data-suffix="+">
                10+
              </span>
            </strong>
            <span>Years</span>
          </div>
          <div className="stat-item">
            <strong>
              <span className="count-up" id="stat-officers" data-target={200} data-suffix="+">
                200+
              </span>
            </strong>
            <span>Students Selected</span>
          </div>
          <div className="stat-item">
            <strong>
              <span className="count-up" id="stat-trained" data-target={500} data-suffix="+">
                500+
              </span>
            </strong>
            <span>Trained</span>
          </div>
          {/* Current-year proof, not just cumulative totals — matches how
              Allen/Aakash lead with "Session 2026-27" / "in 2023" figures
              rather than only all-time numbers. */}
          <div className="stat-item">
            <strong>
              <span className="count-up" id="stat-selected-year" data-target={66} data-suffix="">
                66
              </span>
            </strong>
            <span id="stat-selected-year-label">Selected 2025–26</span>
          </div>
        </div>
        {/* One dominant CTA — everything else (portal, WhatsApp, brochure,
            demo, fee payment) is still one tap away, just visually
            secondary so it doesn't compete with the primary ask. */}
        <div className="hero-btns hero-enter-5">
          <a href="#enquiry" className="btn btn-gold hero-cta-primary">
            Enquire for Admission →
          </a>
        </div>
        <div className="hero-quick">
          <button onClick={() => setIsPortalOpen(true)} className="btn-demo">
            Parents Portal →
          </button>
          <a
            href="https://wa.me/918974298074?text=Hello%2C+I+am+enquiring+about+GNSI+admissions"
            className="btn-brochure"
            target="_blank"
          >
            WhatsApp Us
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Brochure-2026.pdf"
            className="btn-brochure"
            target="_blank"
            download=""
          >
            📄 Brochure
          </a>
          <button
            className="btn-demo"
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
          >
            🎯 Free Demo Class
          </button>
          <button
            onClick={() => setIsFeeOpen(true)}
            className="btn-brochure"
          >
            💳 Pay Fee Online
          </button>
        </div>
        {/* Quick programme picker — mirrors the big-brand pattern (Allen's
            JEE/NEET/Class 6-10 chip row) of letting a visitor jump straight
            into the course track relevant to them, right under the hero CTA. */}
        <div className="hero-course-chips">
          <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }} className="hero-course-chip cc-sainik">
            <span className="hero-course-chip-icon">🎖️</span>
            <span className="hero-course-chip-label">Sainik<br />Preparation</span>
            <span className="hero-course-chip-arrow">→</span>
          </a>
          <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }} className="hero-course-chip cc-navodaya">
            <span className="hero-course-chip-icon">📘</span>
            <span className="hero-course-chip-label">Navodaya<br />Prep</span>
            <span className="hero-course-chip-arrow">→</span>
          </a>
          <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }} className="hero-course-chip cc-foundation">
            <span className="hero-course-chip-icon">🌱</span>
            <span className="hero-course-chip-label">Foundation<br />Programme</span>
            <span className="hero-course-chip-arrow">→</span>
          </a>
          <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }} className="hero-course-chip cc-combined">
            <span className="hero-course-chip-icon">⭐</span>
            <span className="hero-course-chip-label">Combined<br />Course</span>
            <span className="hero-course-chip-arrow">→</span>
          </a>
        </div>
      </div>
      <div className="dash-panel">
        <div className="dash-hd">
          <div className="dash-hd-title">Live Dashboard</div>
          <div className="live-dot">
            <div className="dot" />
            Live
          </div>
        </div>
        <div className="dash-kpi">
          <div className="kpi">
            <strong id="kpi-staff" className="lpulse">
              —
            </strong>
            <span>Staff</span>
          </div>
          <div className="kpi">
            <strong id="kpi-att" className="lpulse">
              —
            </strong>
            <span>Present Today</span>
          </div>
          <div className="kpi">
            <strong id="kpi-exams" className="lpulse">
              —
            </strong>
            <span>Upcoming Exams</span>
          </div>
        </div>
        <div className="dash-body">
          <div className="dash-row">
            <span>New Enquiries</span>
            <strong id="kpi-enq" className="lpulse">
              —
            </strong>
          </div>
          <div className="dash-row">
            <span>Hostel Occupancy</span>
            <strong id="stat-hostel-occupancy">92%</strong>
          </div>
          <div className="dash-row">
            <span>Next Mock Test</span>
            <strong id="stat-next-mock-test">This Sunday</strong>
          </div>
          <div className="dash-row">
            <span>Latest Notice</span>
            <strong id="kpi-notice" className="lpulse">
              —
            </strong>
          </div>
        </div>
      </div>
    </div>
  </section>
  {/* RIBBON */}
  <div className="ribbon">
    <div className="ribbon-grid">
      <div className="ribbon-stat rs-gold reveal">
        <div className="ribbon-stat-icon">🏛️</div>
        <strong>
          <span className="count-up" id="ribbon-years" data-target={10} data-suffix="+">
            10+
          </span>
        </strong>
        <span>Years of Excellence</span>
      </div>
      <div className="ribbon-stat rs-blue reveal">
        <div className="ribbon-stat-icon">📘</div>
        <strong>
          <span className="count-up" id="ribbon-trained" data-target={500} data-suffix="+">
            500+
          </span>
        </strong>
        <span>Students Trained</span>
      </div>
      <div className="ribbon-stat rs-green reveal">
        <div className="ribbon-stat-icon">📈</div>
        <strong>
          <span className="count-up" id="ribbon-selection-rate" data-target={95} data-suffix="%">
            95%
          </span>
        </strong>
        <span>Selection Rate</span>
      </div>
      <div className="ribbon-stat rs-red reveal">
        <div className="ribbon-stat-icon">🎖️</div>
        <strong>
          <span className="count-up" id="ribbon-officers" data-target={200} data-suffix="+">
            200+
          </span>
        </strong>
        <span>Students Selected</span>
      </div>
      <div className="ribbon-stat rs-purple reveal">
        <div className="ribbon-stat-icon">⭐</div>
        <strong>
          <span className="count-up" id="ribbon-selected-year" data-target={66} data-suffix="">
            66
          </span>
        </strong>
        <span id="ribbon-selected-year-label">Selected 2025–26</span>
      </div>
    </div>
  </div>
  {/* TAB STRIP */}
  <div className="tab-nav-wrap">
    <div className="tab-nav-strip container">
      {tabList.map((t) => (
        <button
          key={t.id}
          type="button"
          className={"tab-nav-btn cat-" + t.cat + (activeTab === t.id ? " active" : "")}
          onClick={() => goToTab(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  </div>
  {/* TAB CONTENT WRAPPER — used by the outside-click auto-close handler.
      key={activeTab} forces a remount on every tab switch, which retriggers
      the .tab-enter CSS animation for a smooth fade/slide transition instead
      of content snapping in instantly. */}
  <div ref={tabContentRef} key={activeTab} className="tab-enter">
  {activeTab !== 'home' && (
    <div className="container" style={{ padding: '1rem 0 0' }}>
      <button
        type="button"
        onClick={() => goToTab('home')}
        className="btn btn-out"
        style={{ fontSize: '.8rem', padding: '.5rem 1rem' }}
      >
        ← Back to Home
      </button>
    </div>
  )}
  {/* HOME */}
  {activeTab === 'home' && (
  <section className="pad-alt" id="home">
    <div className="container">
      <div className="eyebrow reveal">Welcome to GNSI</div>
      <h2 className="st reveal">Gallery</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      {galleryData.slice(0, 1).map((cat, catIdx) => (
        <div className="gcat-block reveal" key={cat.title}>
          <div className="gcat-grid2">
            {cat.items.slice(0, 6).map((item, itemIdx) => (
              <div
                className="gph2"
                data-icon={item.icon}
                key={item.img || `home-${cat.title}-${itemIdx}`}
              >
                {item.img && (
                  <img
                    src={item.img}
                    alt={item.label || cat.title}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                {item.label && <div className="gph-lbl">{item.label}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ marginTop: '1.2rem' }} className="reveal">
        <a
          href="#gallery"
          onClick={(e) => { e.preventDefault(); goToTab('gallery'); }}
          className="btn btn-out"
        >
          View Full Gallery →
        </a>
      </div>
    </div>
    <div className="container" style={{ marginTop: '2.5rem' }}>
      <div className="eyebrow reveal">Our Pride</div>
      <h2 className="st reveal">Toppers 2025–26</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="ranker-grid">
        <div className="ranker-card reveal-scale">
          <div className="ranker-badge">AIR Rank</div>
          <div className="rc-rank">01</div>
          <div className="ranker-photo">L</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">Sainik School Tilaiya</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">02</div>
          <div className="ranker-photo">K</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">NVS Jawahar Navodaya</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">03</div>
          <div className="ranker-photo">R</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">Sainik School Imphal</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">04</div>
          <div className="ranker-photo">M</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">NVS Class 6</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: '1.2rem' }} className="reveal">
        <a
          href="#rankers"
          onClick={(e) => { e.preventDefault(); goToTab('rankers'); }}
          className="btn btn-out"
        >
          View All Toppers →
        </a>
      </div>
    </div>
    <div className="container" style={{ marginTop: '2.5rem' }}>
      <div className="eyebrow reveal">See GNSI in Action</div>
      <h2 className="st reveal">Videos</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      {videosData.length ? (
        <div className="home-video-grid reveal">
          {videosData.slice(0, 3).map((v) => {
            const thumb = getYouTubeThumb(v.youtube_url);
            return (
              <a
                key={v.id}
                href="#videos"
                onClick={(e) => { e.preventDefault(); goToTab('videos'); }}
                className="home-video-card"
              >
                <div className="home-video-thumb">
                  {thumb ? (
                    <img src={thumb} alt={v.title} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <span className="home-video-play">▶</span>
                  )}
                  <span className="home-video-play-overlay">▶</span>
                </div>
                <div className="home-video-title">{v.title}</div>
              </a>
            );
          })}
        </div>
      ) : (
        <p style={{ color: '#3A3A3A', fontFamily: 'Inter,sans-serif', fontSize: '.85rem' }}>
          Campus &amp; classroom videos coming soon.
        </p>
      )}
      <div style={{ marginTop: '1.2rem' }} className="reveal">
        <a
          href="#videos"
          onClick={(e) => { e.preventDefault(); goToTab('videos'); }}
          className="btn btn-out"
        >
          View All Videos →
        </a>
      </div>
    </div>
  </section>
  )}
  {/* COURSES */}
  {activeTab === 'courses' && (
  <section className="pad-alt" id="courses">
    <div className="container">
      <div className="eyebrow reveal">Our Programmes</div>
      <h2 className="st reveal">Courses Offered</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <p
        style={{
          color: "rgba(255,255,255,.85)",
          marginBottom: "2rem",
          maxWidth: 560,
          lineHeight: "1.85",
          fontSize: "clamp(0.92rem,2.4vw,1rem)"
        }}
        className="reveal"
      >
        Structured pathways from foundation to championship level — designed to
        maximise selection probability at India's finest schools.
      </p>
      <div className="courses-grid">
        <div className="course-card sainik reveal-scale">
          <div className="course-badge cb-sainik">Sainik School</div>
          <h3>Sainik Preparation</h3>
          <p className="sub">AISSEE · Class 6 &amp; Class 9 entry</p>
          <ul className="course-features">
            <li>Achiever — Foundation level</li>
            <li>Leader — Intermediate level</li>
            <li>Champion — Advanced level</li>
            <li>Physical fitness training</li>
            <li>Interview preparation</li>
            <li>Hostel &amp; day scholar options</li>
          </ul>
          <button
            className="course-enquire"
            onClick={() => goToTab('enquiry')}
          >
            Enquire for This Course →
          </button>
          <div className="fee-note">Fee details shared on enquiry</div>
        </div>
        <div className="course-card navodaya reveal-scale">
          <div className="course-badge cb-nv">Navodaya · NVS</div>
          <h3>Navodaya Preparation</h3>
          <p className="sub">JNVST · Class 6 &amp; Class 9 entry</p>
          <ul className="course-features">
            <li>Lakshya — Intensive programme</li>
            <li>Umeed — Foundational track</li>
            <li>Mental ability &amp; language focus</li>
            <li>Weekly mock tests</li>
            <li>Previous year paper analysis</li>
            <li>Hostel &amp; day scholar options</li>
          </ul>
          <button
            className="course-enquire"
            onClick={() => goToTab('enquiry')}
          >
            Enquire for This Course →
          </button>
          <div className="fee-note">Fee details shared on enquiry</div>
        </div>
        <div className="course-card foundation reveal-scale">
          <div className="course-badge cb-fn">Foundation</div>
          <h3>Foundation Programme</h3>
          <p className="sub">School readiness &amp; competitive prep</p>
          <ul className="course-features">
            <li>Elite — High-performance track</li>
            <li>Prime — Standard track</li>
            <li>Mathematics &amp; English focus</li>
            <li>Study habit building</li>
            <li>Discipline-first environment</li>
            <li>Day scholar option available</li>
          </ul>
          <button
            className="course-enquire"
            onClick={() => goToTab('enquiry')}
          >
            Enquire for This Course →
          </button>
          <div className="fee-note">Fee details shared on enquiry</div>
        </div>
        <div className="course-card combined reveal-scale">
          <div className="course-badge cb-co">Combined</div>
          <h3>Combined Course</h3>
          <p className="sub">NVS + Sainik dual preparation</p>
          <ul className="course-features">
            <li>Covers both JNVST &amp; AISSEE</li>
            <li>Maximises selection chances</li>
            <li>Integrated timetable</li>
            <li>Dedicated subject teachers</li>
            <li>Weekend booster classes</li>
            <li>Hostel &amp; day scholar options</li>
          </ul>
          <button
            className="course-enquire"
            onClick={() => goToTab('enquiry')}
          >
            Enquire for This Course →
          </button>
          <div className="fee-note">Fee details shared on enquiry</div>
        </div>
      </div>
    </div>
  </section>
  )}
  <div className="subsection-tag"><span>Track Record</span></div>
  {/* ③ RANKER WALL */}
  {activeTab === 'rankers' && (
  <section className="ranker-section" id="rankers">
    <div className="container">
      <div className="eyebrow reveal">Our Pride</div>
      <h2 className="st reveal">2025–26 Selections</h2>
      <div className="rule reveal">
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,var(--gold),transparent)"
          }}
        />
        <div className="rule-d" />
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,transparent,var(--gold))"
          }}
        />
      </div>
      <div className="ranker-grid" id="rankerGrid">
        {/* Static placeholders — replace with real photos from Supabase */}
        <div className="ranker-card reveal-scale">
          <div className="ranker-badge">AIR Rank</div>
          <div className="rc-rank">01</div>
          <div className="ranker-photo">L</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">Sainik School Tilaiya</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">02</div>
          <div className="ranker-photo">K</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">NVS Jawahar Navodaya</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">03</div>
          <div className="ranker-photo">R</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">Sainik School Imphal</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">04</div>
          <div className="ranker-photo">M</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">NVS Class 6</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">05</div>
          <div className="ranker-photo">T</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">RMS Selection</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">06</div>
          <div className="ranker-photo">S</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">NVS Class 9</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">07</div>
          <div className="ranker-photo">P</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">Sainik School Tilaiya</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
        <div className="ranker-card reveal-scale">
          <div className="rc-rank">08</div>
          <div className="ranker-photo">A</div>
          <div className="rc-shade" />
          <div className="rc-edge" />
          <div className="rc-cap">
            <h4>GNSI Student</h4>
            <div className="ranker-school">NVS Jawahar Navodaya</div>
            <div className="ranker-batch">Batch 2025–26</div>
          </div>
        </div>
      </div>
      <div className="ranker-cta">
        <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }} className="btn btn-gold">
          Join the Next Batch →
        </a>
      </div>
      <p className="ranker-note">
        66 students selected in 2025–26 · Names withheld for privacy · Contact
        institute for verified result letters
      </p>
    </div>
  </section>
  )}
  {/* RESULTS */}
  {activeTab === 'results' && (
  <section className="pad-alt" id="results">
    <div className="container">
      <div className="eyebrow reveal">Results</div>
      <h2 className="st reveal">Selections &amp; Achievements</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="cards-row">
        <div className="result-card reveal-left">
          <div className="year-badge">
            2025<small>–26</small>
          </div>
          <div className="result-body">
            <div className="result-number">66</div>
            <h3>NVS &amp; Sainik School</h3>
            <p>
              66 students selected across NVS Jawahar Navodaya and Sainik School
              — our best result to date.
            </p>
          </div>
        </div>
        <div className="result-card reveal">
          <div className="year-badge">
            2024<small>–25</small>
          </div>
          <div className="result-body">
            <h3>Strong District Performance</h3>
            <p>
              Continued high selection rates with district-level recognition
              across military and academic entrance tracks.
            </p>
          </div>
        </div>
        <div className="result-card reveal-right">
          <div className="year-badge">
            2023<small>–24</small>
          </div>
          <div className="result-body">
            <h3>Consistent Growth</h3>
            <p>
              Consistent placement improvement year on year. Students
              continuing to excel at Navodaya and Sainik School.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* TESTIMONIALS */}
  <section className="pad">
    <div className="container">
      <div className="eyebrow reveal">Testimonials</div>
      <h2 className="st reveal">What Parents Say</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div style={{ maxWidth: 680 }} className="reveal">
        <div className="testi-wrap">
          <div className="testi-track" id="testiTrack">
            <div className="testi-card">
              <div className="stars">★★★★★</div>
              <blockquote>
                "My son was selected for Sainik School Tilaiya on his first
                attempt. The discipline and teaching at GNSI is unlike anything
                in Thoubal District. The teachers genuinely care about each
                child's progress."
              </blockquote>
              <div className="testi-foot">
                <div className="testi-avatar">🎓</div>
                <div className="testi-id">
                  <cite>Parent</cite>
                  <span className="testi-meta">Sainik School Tilaiya Selection · 2024</span>
                </div>
              </div>
            </div>
            <div className="testi-card">
              <div className="stars">★★★★★</div>
              <blockquote>
                "We live far from Khangabok but the hostel facility gave us
                complete peace of mind. The Parents Portal means we can check
                attendance and notices from our phone without even calling the
                school."
              </blockquote>
              <div className="testi-foot">
                <div className="testi-avatar">🎓</div>
                <div className="testi-id">
                  <cite>Parent</cite>
                  <span className="testi-meta">Navodaya Vidyalaya Selection · 2025</span>
                </div>
              </div>
            </div>
            <div className="testi-card">
              <div className="stars">★★★★★</div>
              <blockquote>
                "Our daughter was an average student before joining GNSI. Within
                six months the improvement in her confidence and scores was
                visible to everyone. She cleared NVS Class 6 with merit."
              </blockquote>
              <div className="testi-foot">
                <div className="testi-avatar">🎓</div>
                <div className="testi-id">
                  <cite>Parent</cite>
                  <span className="testi-meta">Jawahar Navodaya Selection · 2025</span>
                </div>
              </div>
            </div>
            <div className="testi-card">
              <div className="stars">★★★★★</div>
              <blockquote>
                "The mock test every Sunday is what made the difference. By exam
                day my son had sat through so many practice papers that the real
                exam felt easy to him. Excellent faculty and structured
                programme."
              </blockquote>
              <div className="testi-foot">
                <div className="testi-avatar">🎓</div>
                <div className="testi-id">
                  <cite>Parent</cite>
                  <span className="testi-meta">Sainik School Selection · 2023</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="slider-ctrl">
          <button className="slider-btn" onClick={() => window.tSlide(-1)}>
            ‹
          </button>
          <div className="slider-dots" id="testiDots" />
          <button className="slider-btn" onClick={() => window.tSlide(1)}>
            ›
          </button>
        </div>
      </div>
    </div>
  </section>
  {/* ⑥ GOOGLE REVIEWS */}
  {activeTab === 'reviews' && (
  <section className="reviews-section" id="reviews">
    <div className="container">
      <div className="eyebrow reveal">Verified Reviews</div>
      <h2 className="st reveal">Google Reviews</h2>
      <div className="rule reveal">
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,var(--gold),transparent)"
          }}
        />
        <div className="rule-d" />
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,transparent,var(--gold))"
          }}
        />
      </div>
      <div className="reviews-header reveal">
        <div className="reviews-score">
          <span className="score-num" id="reviews-score-num">4.9</span>
          <div className="score-stars">★★★★★</div>
          <span className="score-count" id="reviews-score-count">Based on 80+ Reviews</span>
        </div>
        <p className="reviews-desc">
          Trusted by hundreds of families across Manipur. Our parents
          consistently rate GNSI as the best coaching institute in Thoubal
          District for Sainik School and NVS preparation.
        </p>
      </div>
      <div className="reviews-grid" id="reviewsGrid">
        <div className="review-card reveal">
          <div className="review-top">
            <div className="review-av">L</div>
            <div>
              <div className="review-name">Laishram Ibeton Singh</div>
              <div className="review-date">May 2026</div>
            </div>
          </div>
          <div className="review-stars">★★★★★</div>
          <p className="review-text">
            "My son got selected in Sainik School Tilaiya. GNSI's structured
            coaching and discipline made all the difference. Highly recommend to
            every parent in Manipur."
          </p>
        </div>
        <div className="review-card reveal">
          <div className="review-top">
            <div className="review-av">N</div>
            <div>
              <div className="review-name">Ningombam Priya Devi</div>
              <div className="review-date">April 2026</div>
            </div>
          </div>
          <div className="review-stars">★★★★★</div>
          <p className="review-text">
            "Best institute in Thoubal District. The teachers are very
            dedicated. My daughter cleared NVS Class 6 on the first attempt. The
            parents portal is very helpful."
          </p>
        </div>
        <div className="review-card reveal">
          <div className="review-top">
            <div className="review-av">K</div>
            <div>
              <div className="review-name">Konthoujam Ranjit Singh</div>
              <div className="review-date">March 2026</div>
            </div>
          </div>
          <div className="review-stars">★★★★★</div>
          <p className="review-text">
            "The Sunday mock tests were the key. My son sat more than 30 full
            papers before the real exam. The practice and review sessions are
            excellent and very systematic."
          </p>
        </div>
        <div className="review-card reveal">
          <div className="review-top">
            <div className="review-av">T</div>
            <div>
              <div className="review-name">Thokchom Sushila Devi</div>
              <div className="review-date">February 2026</div>
            </div>
          </div>
          <div className="review-stars">★★★★★</div>
          <p className="review-text">
            "The hostel is safe and well supervised. As a parent from a distant
            village I was worried, but the warden and staff take excellent care
            of the students. Very satisfied."
          </p>
        </div>
      </div>
      <div style={{ marginTop: "1.5rem" }} className="reveal">
        <a
          href="https://g.page/gnsikhangabok/review"
          target="_blank"
          className="google-badge"
        >
          ⭐ Write a Review on Google · View All Reviews →
        </a>
      </div>
    </div>
  </section>
  )}
  <div className="subsection-tag"><span>Inside the Institute</span></div>
  {/* ABOUT */}
  {activeTab === 'about' && (
  <section className="pad" id="about">
    <div className="container about-grid">
      <div className="about-text">
        <div className="eyebrow reveal">About the Institute</div>
        <h2 className="st reveal">A Decade of Shaping Successful Students</h2>
        <div className="rule reveal">
          <div className="rule-line" />
          <div className="rule-d" />
          <div className="rule-line" />
        </div>
        <p className="reveal">
          GNSI was founded in 2016 with a single purpose — to give students from
          Manipur the preparation and discipline required to earn entry into
          India's finest military and academic schools.
        </p>
        <p className="reveal">
          Located at Khangabok in Thoubal District, the institute has grown from
          a modest classroom to a full residential campus with a structured
          curriculum, expert faculty, and a proven record of results.
        </p>
        <p className="reveal">
          Our digital ERP portal allows parents to track attendance, examination
          results, hostel leave, and institutional notices from any device, from
          anywhere — live.
        </p>
        <div className="feat-tiles">
          <div className="tile reveal">
            <div>🏫</div>
            <strong>Est. 2016</strong>
            <span>A decade of discipline</span>
          </div>
          <div className="tile reveal">
            <div>👨‍🎓</div>
            <strong>500+ Alumni</strong>
            <span>Across Manipur &amp; beyond</span>
          </div>
          <div className="tile reveal">
            <div>🏆</div>
            <strong>Rank 1</strong>
            <span>Thoubal District</span>
          </div>
          <div className="tile reveal">
            <div>📱</div>
            <strong>Parents Portal</strong>
            <span>Live tracking, any device</span>
          </div>
        </div>
      </div>
      <div>
        <div className="eyebrow reveal">Performance Metrics</div>
        <h2 className="st reveal" style={{ marginBottom: "1.4rem" }}>
          Selection Record
        </h2>
        <div className="bar-block reveal">
          <div className="bar-label">
            <span>NVS Selection Rate</span>
            <strong>94%</strong>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              data-w={94}
              style={{ background: "var(--navy)" }}
            />
          </div>
        </div>
        <div className="bar-block reveal">
          <div className="bar-label">
            <span>Sainik School Rate</span>
            <strong>88%</strong>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              data-w={88}
              style={{ background: "var(--red)" }}
            />
          </div>
        </div>
        <div className="bar-block reveal">
          <div className="bar-label">
            <span>Student Satisfaction</span>
            <strong>98%</strong>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              data-w={98}
              style={{ background: "var(--gold)" }}
            />
          </div>
        </div>
        <div className="bar-block reveal">
          <div className="bar-label">
            <span>Hostel Occupancy</span>
            <strong>92%</strong>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              data-w={92}
              style={{ background: "var(--navy3)" }}
            />
          </div>
        </div>
        <div className="bar-block reveal">
          <div className="bar-label">
            <span>Faculty Rating</span>
            <strong>96%</strong>
          </div>
          <div className="bar-track">
            <div
              className="bar-fill"
              data-w={96}
              style={{ background: "#3D3D3D" }}
            />
          </div>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* head-institute */}
  {activeTab === 'head-institute' && (
  <section className="pad" id="head-institute">
    <div className="container head-institute-grid">
      <div className="reveal-left">
        <div className="head-institute-img">
          {FOUNDER_PHOTO_URL ? (
            <img
              src={FOUNDER_PHOTO_URL}
              alt="Moirangthem Himan Singh"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
          ) : null}
          <span
            style={{
              letterSpacing: ".1em",
              fontSize: ".7rem",
              display: FOUNDER_PHOTO_URL ? "none" : "flex"
            }}
          >
            Head of the Institute PHOTO
          </span>
          <div className="head-institute-img-badge">
            <h4>Moirangthem Himan Singh</h4>
            <span>Head of the Institute  · GNSI</span>
          </div>
        </div>
      </div>
      <div className="reveal-right">
        <div className="eyebrow">Head of the Institute's Message</div>
        <h2 className="st">Built on Discipline. Driven by Purpose.</h2>
        <div className="rule">
          <div className="rule-line" />
          <div className="rule-d" />
          <div className="rule-line" />
        </div>
        <blockquote className="head-institute-quote">
          "Every child who walks into GNSI carries the potential to serve the
          nation. Our responsibility is to ensure that potential is never wasted
          for lack of opportunity or preparation."
        </blockquote>
        <p
          style={{
            color: "var(--slate)",
            lineHeight: "1.9",
            marginBottom: "1rem",
            fontSize: "clamp(0.9rem,2.4vw,0.95rem)"
          }}
        >
          GNSI was established in 2016 with a simple conviction: students from
          Manipur deserve the same calibre of preparation as those in metro
          cities. In a decade, we have grown from a single classroom to a full
          residential campus — producing over 200 successful students and achievers.
        </p>
        <p
          style={{
            color: "var(--slate)",
            lineHeight: "1.9",
            marginBottom: "1rem",
            fontSize: "clamp(0.9rem,2.4vw,0.95rem)"
          }}
        >
          Our approach is not just academic. We build character, discipline, and
          resilience — the qualities that Navodaya and Sainik School demand, and
          that life rewards.
        </p>
        <div className="head-institute-sig">
          Moirangthem Himan Singh <span>Head of the Institute , GNSI</span>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* FACULTY */}
  {activeTab === 'faculty' && (
  <section className="pad-alt" id="faculty">
    <div className="container">
      <div className="eyebrow reveal">Our Team</div>
      <h2 className="st reveal">Faculty &amp; Leadership</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="faculty-grid" id="facultyGrid">
        <div className="faculty-card reveal">
          <div className="fc-rank">01</div>
          <div className="faculty-photo">H</div>
          <div className="fc-shade" />
          <div className="fc-edge" />
          <div className="fc-cap">
            <h3>Moirangthem Himan Singh</h3>
            <div className="role">Head of the Institute </div>
            <div className="subj">Mathematics · Strategic Leadership</div>
            <div className="exp">10+ Years · Est. GNSI 2016</div>
          </div>
        </div>
        <div className="faculty-card reveal">
          <div className="fc-rank">02</div>
          <div className="faculty-photo">A</div>
          <div className="fc-shade" />
          <div className="fc-edge" />
          <div className="fc-cap">
            <h3>Moirangthem Arunkumar Singh</h3>
            <div className="role">Vice Principal</div>
            <div className="subj">Academic Oversight · Administration</div>
            <div className="exp">Senior Faculty</div>
          </div>
        </div>
        <div className="faculty-card reveal">
          <div className="fc-rank">03</div>
          <div className="faculty-photo">D</div>
          <div className="fc-shade" />
          <div className="fc-edge" />
          <div className="fc-cap">
            <h3>Ningthoujam Deepak Singh</h3>
            <div className="role">Hostel Superintendent</div>
            <div className="subj">Residential Life · Discipline</div>
            <div className="exp">Hostel Management</div>
          </div>
        </div>
        <div className="faculty-card reveal">
          <div className="fc-rank">04</div>
          <div className="faculty-photo">✦</div>
          <div className="fc-shade" />
          <div className="fc-edge" />
          <div className="fc-cap">
            <h3>Teaching Faculty</h3>
            <div className="role">Subject Specialists</div>
            <div className="subj">Mathematics · Science · English · GK</div>
            <div className="exp">Sainik &amp; NVS Exam Specialists</div>
          </div>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* ④ FACILITIES */}
  {activeTab === 'facilities' && (
  <section className="pad" id="facilities">
    <div className="container">
      <div className="eyebrow reveal">Campus Life</div>
      <h2 className="st reveal">Why Guidance?</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="facilities-grid">
        <div className="facility-card reveal-scale">
          <span className="facility-icon">🏠</span>
          <h3>Residential Hostel</h3>
          <p>
            Supervised residential accommodation modelled on Sainik School
            environment.
          </p>
          <ul>
            <li>Separate boys hostel blocks</li>
            <li>24/7 warden supervision</li>
            <li>Structured study hours</li>
            <li>Daily inspection routine</li>
          </ul>
        </div>
        <div className="facility-card reveal-scale">
          <span className="facility-icon">🍽️</span>
          <h3>Mess &amp; Nutrition</h3>
          <p>
            Balanced, hygienic meals prepared daily to support growing students.
          </p>
          <ul>
            <li>Hygienic Foods</li>
            <li>Proper balanced diet</li>
            <li>Clean kitchen standards</li>
            <li>Special occasion meals</li>
          </ul>
        </div>
        <div className="facility-card reveal-scale">
          <span className="facility-icon">📚</span>
          <h3>Well Furnished Classrooms</h3>
          <p>
            Well-equipped classrooms with focus on interactive, concept-based
            learning.
          </p>
          <ul>
            <li>Knowledge based Learning</li>
            <li>Subject-specialist teachers</li>
            <li>Regular Test &amp; review sessions</li>
            <li>Latest Study materials provided</li>
          </ul>
        </div>
        <div className="facility-card reveal-scale">
          <span className="facility-icon">⚽</span>
          <h3>Sports &amp; PT</h3>
          <p>
            Big Playground for daily Sport Activities 
          </p>
          <ul>
            <li>Morning PT schedule</li>
            <li>Fitness assessment</li>
          </ul>
        </div>
        <div className="facility-card reveal-scale">
          <span className="facility-icon">🏥</span>
          <h3>Health &amp; Welfare</h3>
          <p>
            Student health and wellbeing is monitored regularly throughout the
            academic year.
          </p>
          <ul>
            <li>First aid on campus</li>
            <li>Parent alert for illness</li>
          </ul>
        </div>
        <div className="facility-card reveal-scale">
          <span className="facility-icon">📱</span>
          <h3>Digital ERP Portal</h3>
          <p>
            Parents track attendance, results, leaves and notices from anywhere
            — live.
          </p>
          <ul>
            <li>Live attendance tracking</li>
            <li>Exam score reports</li>
            <li>Hostel leave management</li>
            <li>Real-time alerts &amp; notices</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* ⑤ VIDEO SECTION */}
  {activeTab === 'videos' && (
  <section className="video-section" id="videos">
    <div className="container">
      <div className="eyebrow reveal">See GNSI in Action</div>
      <h2 className="st reveal">Videos &amp; Campus Tour</h2>
      <div className="rule reveal">
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,var(--gold),transparent)"
          }}
        />
        <div className="rule-d" />
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,transparent,var(--gold))"
          }}
        />
      </div>
      <div className="video-grid reveal">
        <div className="video-main">
          <div className="video-embed" id="mainVideoEmbed">
            <div
              className="video-placeholder"
              id="videoPlaceholder"
            >
              <div className="play-btn">▶</div>
              <p>GNSI Campus &amp; Classroom Tour</p>
            </div>
          </div>
          <p
            style={{
              color: "#3A3A3A",
              fontFamily: 'Inter,sans-serif',
              fontSize: "clamp(0.7rem,1.9vw,0.78rem)",
              letterSpacing: ".06em",
              textTransform: "uppercase",
              marginTop: ".7rem"
            }}
          >
            Click a video to play
          </p>
        </div>
        <div className="video-list-wrap">
          <div className="video-list" id="videoListEl">
            {/* Populated dynamically from website_videos via getVideos() — see VIDEOS script block */}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <a
              href="https://youtube.com/@gnsikhangabok"
              target="_blank"
              className="btn btn-out"
              style={{
                display: "inline-flex",
                borderColor: "rgba(255,0,0,.5)",
                color: "#c53030"
              }}
            >
              ▶ View All Videos on YouTube →
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
  )}
  <div className="subsection-tag"><span>Newsroom</span></div>
  {/* NOTICES */}
  {activeTab === 'notices' && (
  <section className="pad" id="notices">
    <div className="container">
      <div className="eyebrow reveal">Notice Board</div>
      <h2 className="st reveal">Official Announcements</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="cards-row" id="publicNoticeCards">
        <div className="notice-card urgent reveal">
          <div className="notice-badge badge-open">Open</div>
          <h3>Admissions 2026–27</h3>
          <p>
            Applications are open for the 2026–27 session. Limited seats
            available for both day scholars and hostel boarders. Contact the
            institute at the earliest.
          </p>
          <div className="notice-date">Issued: June 2026</div>
        </div>
        <div className="notice-card reveal">
          <div className="notice-badge badge-weekly">Weekly</div>
          <h3>Sunday Mock Tests</h3>
          <p>
            Mock test series continues every Sunday for NVS and Sainik School
            aspirants. Detailed review sessions follow each examination.
          </p>
          <div className="notice-date">Ongoing · Every Sunday</div>
        </div>
        <div className="notice-card reveal">
          <div className="notice-badge badge-limited">Limited</div>
          <h3>Hostel Seats</h3>
          <p>
            Very few residential hostel seats remain available for the new
            academic session. Parents are urged to confirm at the earliest.
          </p>
          <div className="notice-date">Issued: June 2026</div>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* ⑦ BLOG / NEWS */}
  {activeTab === 'blog' && (
  <section className="pad-alt" id="blog">
    <div className="container">
      <div className="eyebrow reveal">Updates &amp; Insights</div>
      <h2 className="st reveal">News &amp; Articles</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="blog-grid" id="blogGrid">
        <div className="blog-card reveal-scale">
          <div className="blog-thumb">
            📰<span className="blog-cat">Results</span>
          </div>
          <div className="blog-body">
            <div className="blog-date">June 2026</div>
            <h3>
              GNSI Records Best-Ever Result: 66 Students Selected in 2025–26
            </h3>
            <p>
              Guidance Navodaya &amp; Sainik Institute achieves its highest ever
              annual selection count, with 66 students clearing NVS and Sainik
              School entrance exams across Manipur.
            </p>
            <a href="#results" onClick={(e) => { e.preventDefault(); goToTab('results'); }} className="blog-read">
              Read More →
            </a>
          </div>
        </div>
        <div className="blog-card reveal-scale">
          <div className="blog-thumb">
            📋<span className="blog-cat">Admissions</span>
          </div>
          <div className="blog-body">
            <div className="blog-date">June 2026</div>
            <h3>Admissions Open for 2026–27: What Parents Need to Know</h3>
            <p>
              Seats are limited for the new session beginning July 2026. Here is
              everything you need to know about the admission process, courses,
              hostel options, and fee structure at GNSI.
            </p>
            <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }} className="blog-read">
              Apply Now →
            </a>
          </div>
        </div>
        <div className="blog-card reveal-scale">
          <div className="blog-thumb">
            📝<span className="blog-cat">Exam Tips</span>
          </div>
          <div className="blog-body">
            <div className="blog-date">May 2026</div>
            <h3>
              How to Prepare Your Child for JNVST Class 6: A Parent's Guide
            </h3>
            <p>
              The Jawahar Navodaya Vidyalaya Selection Test is one of India's
              most competitive entrance exams. Our faculty shares the
              preparation strategy that has produced 94% selection rates at
              GNSI.
            </p>
            <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }} className="blog-read">
              Get Guidance →
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* PROMO / ADVERTISEMENT BANNER */}
  <section className="promo-banner">
    <div className="promo-inner">
      <div className="promo-text">
        <div className="promo-badge">Admissions 2026-27 · Now Open</div>
        <h2>
          Ten years of results. <em>One decision</em> your child will thank you for.
        </h2>
        <p>
          Join GNSI&apos;s Sainik School, RMS and Navodaya batches this session — small
          class sizes, disciplined hostel life, and faculty who have shaped a decade of selections
          from Khangabok, Thoubal.
        </p>
      </div>
      <div className="promo-cta">
        <div className="promo-cta-row">
          <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }} className="btn btn-gold">
            Enquire Now →
          </a>
          <a href="#scholarship" onClick={(e) => { e.preventDefault(); goToTab('scholarship'); }} className="btn btn-out">
            Free Scholarship Test
          </a>
        </div>
        <span className="promo-note">Limited seats per batch · Book a campus visit</span>
      </div>
    </div>
  </section>
  {/* SECTION-WISE GALLERY */}
  {activeTab === 'gallery' && (
  <section className="pad" id="gallery">
    <div className="container">
      <div className="eyebrow reveal">Campus Life</div>
      <h2 className="st reveal">Gallery</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>

      {galleryData.map((cat, catIdx) => (
        <div className="gcat-block reveal" key={cat.title}>
          <div className="gcat-hd">
            <div className="gcat-title">
              <h3>{cat.title}</h3>
              <span className="gcat-count">{cat.count}</span>
            </div>
          </div>
          <div className="gcat-grid2">
            {cat.items.map((item, itemIdx) => (
              <div
                className="gph2"
                data-icon={item.icon}
                key={item.img || `${cat.title}-${itemIdx}`}
                onClick={() => openLightbox(catIdx, itemIdx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') openLightbox(catIdx, itemIdx); }}
              >
                {item.img && (
                  <img
                    src={item.img}
                    alt={item.label || cat.title}
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                )}
                <div className="gph2-zoom">⤢</div>
                {item.label && <div className="gph-lbl">{item.label}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}


      <div
        style={{
          marginTop: "1.2rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap"
        }}
        className="reveal"
      >
        <span
          style={{
            color: "var(--mist)",
            fontSize: "clamp(0.75rem,2vw,0.85rem)",
            fontFamily: 'Inter,sans-serif',
            letterSpacing: ".06em"
          }}
        >
          More photos on social media:
        </span>
        <a
          className="soc-btn soc-fb"
          href="https://facebook.com/gnsikhangabok"
          target="_blank"
        >
          f Facebook
        </a>
        <a
          className="soc-btn soc-yt"
          href="https://youtube.com/@gnsikhangabok"
          target="_blank"
        >
          ▶ YouTube
        </a>
        <a
          className="soc-btn soc-ig"
          href="https://instagram.com/gnsikhangabok"
          target="_blank"
        >
          ◉ Instagram
        </a>
      </div>
    </div>
  </section>
  )}
  {/* GALLERY LIGHTBOX */}
  {lightbox && (
    <div className="lb-overlay" onClick={closeLightbox}>
      <button className="lb-close" onClick={closeLightbox} aria-label="Close">
        ✕
      </button>
      <button
        className="lb-nav lb-prev"
        onClick={(e) => { e.stopPropagation(); navLightbox(-1); }}
        aria-label="Previous photo"
      >
        ‹
      </button>
      <div className="lb-frame" onClick={(e) => e.stopPropagation()}>
        <div
          className="lb-photo"
          data-icon={galleryData[lightbox.catIdx].items[lightbox.itemIdx].icon}
        >
          {galleryData[lightbox.catIdx].items[lightbox.itemIdx].img && (
            <img
              src={galleryData[lightbox.catIdx].items[lightbox.itemIdx].img}
              alt={galleryData[lightbox.catIdx].items[lightbox.itemIdx].label || ''}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
        <div className="lb-cap">
          <span className="lb-cat">{galleryData[lightbox.catIdx].title}</span>
          <h4>{galleryData[lightbox.catIdx].items[lightbox.itemIdx].label}</h4>
          <span className="lb-count">
            {lightbox.itemIdx + 1} / {galleryData[lightbox.catIdx].items.length}
          </span>
        </div>
      </div>
      <button
        className="lb-nav lb-next"
        onClick={(e) => { e.stopPropagation(); navLightbox(1); }}
        aria-label="Next photo"
      >
        ›
      </button>
    </div>
  )}

  {activeTab === 'events' && (
  <section className="pad-alt" id="events">
    <div className="container">
      <div className="eyebrow reveal">Upcoming</div>
      <h2 className="st reveal">Events &amp; Schedule</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div
        id="eventsListEl"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: ".75rem",
          maxWidth: 680
        }}
      >
        {/* Populated dynamically from website_events via getEvents() — see EVENTS script block */}
      </div>
    </div>
  </section>
  )}
  <div className="part-divider">
    <div className="part-divider-fade part-divider-fade-top" />
    <div className="part-divider-inner">
      <span className="part-num">II</span>
      <span className="part-eyebrow">Part Two</span>
      <h2 className="part-title">Prepare &amp; Apply</h2>
      <p className="part-sub">Free resources, exam dates, and everything you need to take the next step.</p>
      <div className="part-ornament" />
    </div>
    <div className="part-divider-fade part-divider-fade-bottom" />
  </div>
  <div className="subsection-tag"><span>Free Resources</span></div>
  {/* ③ SCHOLARSHIP / FREE MOCK TEST REGISTRATION */}
  {activeTab === 'scholarship' && (
  <section className="scholar-section" id="scholarship">
    <div className="container scholar-grid">
      <div className="scholar-info">
        <div className="eyebrow reveal">Free Opportunity</div>
        <h2 className="st reveal">Scholarship Test &amp; Free Demo</h2>
        <div className="rule reveal">
          <div
            className="rule-line"
            style={{
              background: "linear-gradient(90deg,var(--gold),transparent)"
            }}
          />
          <div className="rule-d" />
          <div
            className="rule-line"
            style={{
              background: "linear-gradient(90deg,transparent,var(--gold))"
            }}
          />
        </div>
        <p className="reveal">
          GNSI conducts a monthly Scholarship Test open to all students aspiring
          for Sainik School, NVS, and RMS entrance. Top scorers receive fee
          concessions. Attend a free demo class before you enrol.
        </p>
        <ul className="scholar-benefits reveal">
          <li>100% scholarship for AIR Top 3 in district</li>
          <li>50% fee waiver for top 10 scorers</li>
          <li>25% concession for top 20 scorers</li>
          <li>Free demo class — no commitment required</li>
          <li>Mock test paper + answer key provided</li>
          <li>Result declared within 3 days</li>
        </ul>
        <div className="test-dates reveal">
          <div className="test-date-card">
            <span className="tdate">Every Sunday</span>
            <span className="tlabel">Mock Test Day</span>
          </div>
          <div className="test-date-card">
            <span className="tdate">1st Sunday</span>
            <span className="tlabel">Scholarship Test</span>
          </div>
          <div className="test-date-card">
            <span className="tdate">Free</span>
            <span className="tlabel">Demo Class</span>
          </div>
          <div className="test-date-card">
            <span className="tdate">3 Days</span>
            <span className="tlabel">Result Time</span>
          </div>
        </div>
        <a
          href="https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20would%20like%20to%20register%20for%20the%20free%20demo%20class%20and%20scholarship%20test."
          className="btn btn-gold"
          target="_blank"
          style={{ display: "inline-flex" }}
        >
          📲 Register via WhatsApp →
        </a>
      </div>
      <div className="scholar-form-box reveal">
        <h3>Register for Free Demo / Scholarship Test</h3>
        <p>Fill below — our team will confirm your slot within 24 hours</p>
        <div className="scholar-msg" id="scholarMsg" />
        <label className="scholar-label">Student Name *</label>
        <input
          type="text"
          className="scholar-input"
          id="scName"
          placeholder="Full name of student"
        />
        <label className="scholar-label">Parent Phone *</label>
        <input
          type="tel"
          className="scholar-input"
          id="scPhone"
          placeholder="+91 XXXXX XXXXX"
        />
        <label className="scholar-label">Class / Age</label>
        <input
          type="text"
          className="scholar-input"
          id="scClass"
          placeholder="e.g. Class 5, Age 10"
        />
        <label className="scholar-label">Interested In</label>
        <select className="scholar-select" id="scType">
          <option value="Free Demo Class">Free Demo Class</option>
          <option value="Scholarship Test">Scholarship Test (Sunday)</option>
          <option value="Both">Both — Demo + Scholarship Test</option>
        </select>
        <button className="scholar-btn" onClick={() => window.submitScholar()}>
          Register for Free →
        </button>
        <p
          style={{
            color: "#3A3A3A",
            fontSize: "clamp(.65rem,1.8vw,.72rem)",
            fontFamily: 'Inter,sans-serif',
            letterSpacing: ".05em",
            textAlign: "center",
            marginTop: ".6rem"
          }}
        >
          Or call us:{" "}
          <a href="tel:+918974298074" style={{ color: "var(--goldL)" }}>
            +91 89742 98074
          </a>
        </p>
      </div>
    </div>
  </section>
  )}
  {/* ③ MOCK TEST / PRACTICE PORTAL */}
  {activeTab === 'mock-tests' && (
  <section className="mocktest-section" id="mock-tests">
    <div className="container">
      <div className="eyebrow reveal" style={{ color: "var(--goldL)" }}>
        <span data-en="">Practice &amp; Prepare</span>
        <span data-hi="">अभ्यास और तैयारी</span>
      </div>
      <h2 className="st reveal" style={{ color: "#000000" }}>
        <span data-en="">Free Mock Tests &amp; Practice</span>
        <span data-hi="">मुफ्त मॉक टेस्ट और अभ्यास</span>
      </h2>
      <div className="rule reveal">
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,var(--gold),transparent)"
          }}
        />
        <div className="rule-d" />
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,transparent,var(--gold))"
          }}
        />
      </div>
      <div className="mocktest-grid reveal">
        <div className="mock-cards">
          <a className="mock-card" href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}>
            <div className="mock-icon">📝</div>
            <div>
              <div className="mock-card-title">
                <span data-en="">NVS Class 6 Full Mock Test</span>
                <span data-hi="">NVS कक्षा 6 पूर्ण मॉक टेस्ट</span>
              </div>
              <div className="mock-card-sub">
                80 Questions · 90 Minutes · Free
              </div>
            </div>
            <div className="mock-card-arrow">→</div>
          </a>
          <a className="mock-card" href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}>
            <div className="mock-icon">📝</div>
            <div>
              <div className="mock-card-title">
                <span data-en="">Sainik School Class 6 Mock</span>
                <span data-hi="">सैनिक स्कूल कक्षा 6 मॉक</span>
              </div>
              <div className="mock-card-sub">
                125 Questions · 150 Minutes · Free
              </div>
            </div>
            <div className="mock-card-arrow">→</div>
          </a>
          <a className="mock-card" href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}>
            <div className="mock-icon">🧠</div>
            <div>
              <div className="mock-card-title">
                <span data-en="">Mental Ability Practice Set</span>
                <span data-hi="">मानसिक योग्यता अभ्यास सेट</span>
              </div>
              <div className="mock-card-sub">
                50 Questions · 45 Minutes · Free
              </div>
            </div>
            <div className="mock-card-arrow">→</div>
          </a>
          <a className="mock-card" href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}>
            <div className="mock-icon">🔢</div>
            <div>
              <div className="mock-card-title">
                <span data-en="">Mathematics Booster Test</span>
                <span data-hi="">गणित बूस्टर टेस्ट</span>
              </div>
              <div className="mock-card-sub">
                40 Questions · 40 Minutes · Free
              </div>
            </div>
            <div className="mock-card-arrow">→</div>
          </a>
          <a className="mock-card" href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}>
            <div className="mock-icon">📖</div>
            <div>
              <div className="mock-card-title">
                <span data-en="">English Language Practice</span>
                <span data-hi="">अंग्रेजी भाषा अभ्यास</span>
              </div>
              <div className="mock-card-sub">
                35 Questions · 35 Minutes · Free
              </div>
            </div>
            <div className="mock-card-arrow">→</div>
          </a>
          <a
            className="mock-card"
            href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}
            style={{ borderColor: "rgba(80,80,80,.35)" }}
          >
            <div className="mock-icon">🏆</div>
            <div>
              <div
                className="mock-card-title"
                style={{ color: "var(--goldLL)" }}
              >
                <span data-en="">Full Scholarship Mock Test</span>
                <span data-hi="">पूर्ण छात्रवृत्ति मॉक टेस्ट</span>
              </div>
              <div className="mock-card-sub">
                Register for Sunday · Free Entry
              </div>
            </div>
            <div className="mock-card-arrow">→</div>
          </a>
        </div>
        <div className="mock-info">
          <h3>
            <span data-en="">Sunday Mock Test Series</span>
            <span data-hi="">रविवार मॉक टेस्ट श्रृंखला</span>
          </h3>
          <p>
            <span data-en="">
              Every Sunday, GNSI conducts structured mock examinations for NVS
              and Sainik School aspirants. Detailed analysis and review sessions
              follow each test — helping students identify weak areas and
              improve systematically.
            </span>
            <span data-hi="">
              प्रत्येक रविवार, GNSI NVS और सैनिक स्कूल के उम्मीदवारों के लिए
              संरचित मॉक परीक्षाएं आयोजित करता है। प्रत्येक टेस्ट के बाद विस्तृत
              विश्लेषण और समीक्षा सत्र होते हैं।
            </span>
          </p>
          <ul className="mock-features">
            <li>
              <span data-en="">NTA-style exam pattern followed</span>
              <span data-hi="">NTA-शैली परीक्षा पैटर्न का पालन</span>
            </li>
            <li>
              <span data-en="">OMR sheet practice included</span>
              <span data-hi="">OMR शीट अभ्यास शामिल</span>
            </li>
            <li>
              <span data-en="">Detailed answer key discussion</span>
              <span data-hi="">विस्तृत उत्तर कुंजी चर्चा</span>
            </li>
            <li>
              <span data-en="">Rank card issued after each test</span>
              <span data-hi="">प्रत्येक टेस्ट के बाद रैंक कार्ड</span>
            </li>
            <li>
              <span data-en="">Previous year paper analysis</span>
              <span data-hi="">पिछले वर्ष के पेपर का विश्लेषण</span>
            </li>
            <li>
              <span data-en="">Free for enrolled students</span>
              <span data-hi="">नामांकित छात्रों के लिए निःशुल्क</span>
            </li>
          </ul>
          <a href="#scholarship" onClick={(e) => { e.preventDefault(); goToTab('scholarship'); }} className="btn btn-gold">
            <span data-en="">Register for Sunday Mock Test →</span>
            <span data-hi="">रविवार मॉक टेस्ट के लिए पंजीकरण करें →</span>
          </a>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* ④ PREVIOUS YEAR QUESTION PAPERS */}
  {activeTab === 'question-papers' && (
  <section className="papers-section" id="question-papers">
    <div className="container">
      <div className="eyebrow reveal">Free Resources</div>
      <h2 className="st reveal">Previous Year Question Papers</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <p
        style={{
          color: "rgba(255,255,255,.85)",
          maxWidth: 560,
          lineHeight: "1.85",
          fontSize: "clamp(.9rem,2.4vw,.97rem)"
        }}
        className="reveal"
      >
        Download free previous year papers for NVS, Sainik School, and RMS
        entrance examinations. Practice is the key to selection.
      </p>
      <div className="papers-grid" id="papersGrid">
        {/* NVS Papers */}
        <div className="papers-card nvs reveal-scale">
          <h3>Navodaya Vidyalaya (NVS)</h3>
          <div className="papers-sub">JNVST · Class 6 Entry</div>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class6-2025.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">JNVST Class 6 — 2025</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class6-2024.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">JNVST Class 6 — 2024</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class6-2023.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">JNVST Class 6 — 2023</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class9-2025.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">JNVST Class 9 — 2025</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class9-2024.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">JNVST Class 9 — 2024</span>
            <span className="paper-dl">⬇</span>
          </a>
          <button
            className="papers-cta"
            onClick={() => goToTab('enquiry')}
          >
            Get More Papers — Enquire →
          </button>
          <p className="papers-note">
            Upload your PDFs to Supabase Storage at gnsi-public/papers/ to
            activate downloads.
          </p>
        </div>
        {/* Sainik Papers */}
        <div className="papers-card sainik reveal-scale">
          <h3>Sainik School (AISSEE)</h3>
          <div className="papers-sub">
            All India Sainik Schools Entrance · Class 6 &amp; 9
          </div>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class6-2025.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">AISSEE Class 6 — 2025</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class6-2024.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">AISSEE Class 6 — 2024</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class6-2023.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">AISSEE Class 6 — 2023</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class9-2025.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">AISSEE Class 9 — 2025</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class9-2024.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">AISSEE Class 9 — 2024</span>
            <span className="paper-dl">⬇</span>
          </a>
          <button
            className="papers-cta"
            onClick={() => goToTab('enquiry')}
          >
            Get More Papers — Enquire →
          </button>
          <p className="papers-note">
            Files activate once uploaded to Supabase Storage gnsi-public/papers/
          </p>
        </div>
        {/* RMS Papers */}
        <div className="papers-card rms reveal-scale">
          <h3>Rashtriya Military School (RMS)</h3>
          <div className="papers-sub">RMS CET · Class 6 &amp; Class 9</div>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class6-2025.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">RMS CET Class 6 — 2025</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class6-2024.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">RMS CET Class 6 — 2024</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class9-2025.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">RMS CET Class 9 — 2025</span>
            <span className="paper-dl">⬇</span>
          </a>
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class9-2024.pdf"
            className="paper-link"
            target="_blank"
            download=""
          >
            <span className="paper-name">RMS CET Class 9 — 2024</span>
            <span className="paper-dl">⬇</span>
          </a>
          <button
            className="papers-cta"
            onClick={() => window.open('https://wa.me/918974298074?text=Hello%20GNSI%2C%20please%20send%20me%20RMS%20previous%20year%20papers.', '_blank')}
          >
            Request More via WhatsApp →
          </button>
          <p className="papers-note">
            Files activate once uploaded to Supabase Storage gnsi-public/papers/
          </p>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* ⑤ SYLLABUS SECTION */}
  {activeTab === 'syllabus' && (
  <section className="syllabus-section" id="syllabus">
    <div className="container">
      <div className="eyebrow reveal">Exam Preparation</div>
      <h2 className="st reveal">Complete Syllabus Guide</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <p
        style={{
          color: "var(--slate)",
          maxWidth: 560,
          lineHeight: "1.85",
          marginBottom: "1.5rem",
          fontSize: "clamp(.9rem,2.4vw,.97rem)"
        }}
        className="reveal"
      >
        Know exactly what to study. Official syllabus breakdown for each
        entrance examination — with subject weightage and marks distribution.
      </p>
      {/* Tab buttons */}
      <div className="syllabus-tabs reveal">
        <button className="syl-tab active" onClick={(e) => window.sylTab('nvs6', e.currentTarget)}>
          NVS Class 6
        </button>
        <button className="syl-tab" onClick={(e) => window.sylTab('nvs9', e.currentTarget)}>
          NVS Class 9
        </button>
        <button className="syl-tab" onClick={(e) => window.sylTab('sainik6', e.currentTarget)}>
          Sainik Class 6
        </button>
        <button className="syl-tab" onClick={(e) => window.sylTab('sainik9', e.currentTarget)}>
          Sainik Class 9
        </button>
        <button className="syl-tab" onClick={(e) => window.sylTab('rms', e.currentTarget)}>
          RMS
        </button>
      </div>
      {/* NVS Class 6 */}
      <div className="syl-panel active" id="syl-nvs6">
        <div className="syl-grid">
          <div className="syl-card">
            <h4>
              <span>🧠</span> Mental Ability{" "}
              <span className="syl-marks">50 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Odd one out &amp; figures</li>
              <li>Pattern completion</li>
              <li>Mirror &amp; water images</li>
              <li>Figure series &amp; analogy</li>
              <li>Space visualization</li>
              <li>Embedded figures</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>🔢</span> Arithmetic{" "}
              <span className="syl-marks">25 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Number system &amp; operations</li>
              <li>Fractions &amp; decimals</li>
              <li>LCM &amp; HCF</li>
              <li>Percentage &amp; ratio</li>
              <li>Simple interest</li>
              <li>Mensuration (area, perimeter)</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>📖</span> Language{" "}
              <span className="syl-marks">25 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Reading comprehension</li>
              <li>Grammar — tenses, articles</li>
              <li>Fill in the blanks</li>
              <li>Vocabulary &amp; synonyms</li>
              <li>Sentence correction</li>
              <li>Regional language section</li>
            </ul>
          </div>
        </div>
        <a
          href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/syllabus/nvs-class6-syllabus.pdf"
          className="syl-download"
          target="_blank"
          download=""
        >
          📥 Download NVS Class 6 Syllabus PDF
        </a>
      </div>
      {/* NVS Class 9 */}
      <div className="syl-panel" id="syl-nvs9">
        <div className="syl-grid">
          <div className="syl-card">
            <h4>
              <span>🔢</span> Mathematics{" "}
              <span className="syl-marks">35 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Algebra &amp; linear equations</li>
              <li>Geometry &amp; Pythagoras</li>
              <li>Mensuration (area, volume)</li>
              <li>Statistics &amp; probability</li>
              <li>Number theory</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>🔬</span> Science{" "}
              <span className="syl-marks">35 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Physics — motion, force, light</li>
              <li>Chemistry — atoms, reactions</li>
              <li>Biology — cells, life processes</li>
              <li>Environmental science</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>📖</span> English &amp; Hindi{" "}
              <span className="syl-marks">30 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Comprehension passage</li>
              <li>Grammar &amp; usage</li>
              <li>Vocabulary</li>
              <li>Hindi grammar &amp; composition</li>
            </ul>
          </div>
        </div>
        <a
          href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/syllabus/nvs-class9-syllabus.pdf"
          className="syl-download"
          target="_blank"
          download=""
        >
          📥 Download NVS Class 9 Syllabus PDF
        </a>
      </div>
      {/* Sainik Class 6 */}
      <div className="syl-panel" id="syl-sainik6">
        <div className="syl-grid">
          <div className="syl-card">
            <h4>
              <span>🔢</span> Mathematics{" "}
              <span className="syl-marks">200 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Number system &amp; operations</li>
              <li>Fractions, decimals, percentages</li>
              <li>Ratio &amp; proportion</li>
              <li>Basic geometry</li>
              <li>Mensuration</li>
              <li>Simple interest &amp; profit/loss</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>📖</span> English{" "}
              <span className="syl-marks">125 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Reading comprehension</li>
              <li>Grammar — all tenses</li>
              <li>Active &amp; passive voice</li>
              <li>Vocabulary &amp; antonyms</li>
              <li>Sentence improvement</li>
              <li>Error detection</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>🌍</span> General Knowledge{" "}
              <span className="syl-marks">50 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Indian history &amp; culture</li>
              <li>Geography — India &amp; world</li>
              <li>Current affairs</li>
              <li>Science GK</li>
              <li>Sports &amp; awards</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>🧠</span> Intelligence{" "}
              <span className="syl-marks">25 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Verbal reasoning</li>
              <li>Non-verbal reasoning</li>
              <li>Series completion</li>
              <li>Analogy &amp; classification</li>
            </ul>
          </div>
        </div>
        <a
          href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/syllabus/sainik-class6-syllabus.pdf"
          className="syl-download"
          target="_blank"
          download=""
        >
          📥 Download Sainik Class 6 Syllabus PDF
        </a>
      </div>
      {/* Sainik Class 9 */}
      <div className="syl-panel" id="syl-sainik9">
        <div className="syl-grid">
          <div className="syl-card">
            <h4>
              <span>🔢</span> Mathematics{" "}
              <span className="syl-marks">200 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Algebra &amp; quadratic equations</li>
              <li>Geometry — triangles, circles</li>
              <li>Trigonometry basics</li>
              <li>Statistics &amp; data interpretation</li>
              <li>Number system</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>📖</span> English{" "}
              <span className="syl-marks">125 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Reading comprehension</li>
              <li>Advanced grammar</li>
              <li>Essay &amp; letter writing</li>
              <li>Vocabulary in context</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>🔬</span> Science &amp; Tech{" "}
              <span className="syl-marks">50 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Physics — electricity, optics</li>
              <li>Chemistry — acids, metals</li>
              <li>Biology — reproduction, heredity</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>🌍</span> Social Studies{" "}
              <span className="syl-marks">50 Marks</span>
            </h4>
            <ul className="syl-topics">
              <li>Indian history — medieval, modern</li>
              <li>Indian geography</li>
              <li>Civics &amp; Indian Constitution</li>
              <li>Economics basics</li>
            </ul>
          </div>
        </div>
        <a
          href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/syllabus/sainik-class9-syllabus.pdf"
          className="syl-download"
          target="_blank"
          download=""
        >
          📥 Download Sainik Class 9 Syllabus PDF
        </a>
      </div>
      {/* RMS */}
      <div className="syl-panel" id="syl-rms">
        <div className="syl-grid">
          <div className="syl-card">
            <h4>
              <span>🔢</span> Mathematics
            </h4>
            <ul className="syl-topics">
              <li>Arithmetic — all operations</li>
              <li>Algebra — equations</li>
              <li>Geometry &amp; mensuration</li>
              <li>Data handling</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>📖</span> English Language
            </h4>
            <ul className="syl-topics">
              <li>Grammar &amp; usage</li>
              <li>Reading comprehension</li>
              <li>Vocabulary</li>
              <li>Writing skills</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>🌍</span> General Knowledge
            </h4>
            <ul className="syl-topics">
              <li>Current events — national</li>
              <li>Indian armed forces history</li>
              <li>Geography &amp; civics</li>
              <li>Science &amp; technology GK</li>
            </ul>
          </div>
          <div className="syl-card">
            <h4>
              <span>💪</span> Physical Fitness
            </h4>
            <ul className="syl-topics">
              <li>Medical examination</li>
              <li>Physical fitness test</li>
              <li>Vision &amp; hearing standards</li>
              <li>Height &amp; weight norms</li>
            </ul>
          </div>
        </div>
        <a
          href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/syllabus/rms-syllabus.pdf"
          className="syl-download"
          target="_blank"
          download=""
        >
          📥 Download RMS Syllabus PDF
        </a>
      </div>
    </div>
  </section>
  )}
  <div className="subsection-tag"><span>Plan Your Year</span></div>
  {/* ④ EXAM CALENDAR */}
  {activeTab === 'exam-calendar' && (
  <section className="calendar-section" id="exam-calendar">
    <div className="container">
      <div className="eyebrow reveal">
        <span data-en="">Academic Year 2026–27</span>
        <span data-hi="">शैक्षणिक वर्ष 2026–27</span>
      </div>
      <h2 className="st reveal">
        <span data-en="">Exam Calendar &amp; Schedule</span>
        <span data-hi="">परीक्षा कैलेंडर और अनुसूची</span>
      </h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="cal-table-wrap reveal">
        <table className="cal-table">
          <thead>
            <tr>
              <th>Exam</th>
              <th>Type</th>
              <th>Application Opens</th>
              <th>Application Closes</th>
              <th>Exam Date</th>
              <th>Result</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="examCalBody">
            <tr>
              <td>
                <div className="cal-exam">JNVST Class 6</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  Jawahar Navodaya Vidyalaya
                </small>
              </td>
              <td>
                <span className="cal-badge cb-nvs">NVS</span>
              </td>
              <td>Jul 2026</td>
              <td>Oct 2026</td>
              <td>
                <strong>Jan 2027</strong>
              </td>
              <td>Mar 2027</td>
              <td>
                <span className="cal-status cs-upcoming">● Upcoming</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">JNVST Class 9</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  Lateral Entry
                </small>
              </td>
              <td>
                <span className="cal-badge cb-nvs">NVS</span>
              </td>
              <td>Aug 2026</td>
              <td>Nov 2026</td>
              <td>
                <strong>Feb 2027</strong>
              </td>
              <td>Apr 2027</td>
              <td>
                <span className="cal-status cs-upcoming">● Upcoming</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">AISSEE Class 6</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  All India Sainik Schools
                </small>
              </td>
              <td>
                <span className="cal-badge cb-sainik">Sainik</span>
              </td>
              <td>Oct 2026</td>
              <td>Nov 2026</td>
              <td>
                <strong>Jan 2027</strong>
              </td>
              <td>Mar 2027</td>
              <td>
                <span className="cal-status cs-upcoming">● Upcoming</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">AISSEE Class 9</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  All India Sainik Schools
                </small>
              </td>
              <td>
                <span className="cal-badge cb-sainik">Sainik</span>
              </td>
              <td>Oct 2026</td>
              <td>Nov 2026</td>
              <td>
                <strong>Jan 2027</strong>
              </td>
              <td>Mar 2027</td>
              <td>
                <span className="cal-status cs-upcoming">● Upcoming</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">RMS CET Class 6</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  Rashtriya Military School
                </small>
              </td>
              <td>
                <span className="cal-badge cb-rms">RMS</span>
              </td>
              <td>Nov 2026</td>
              <td>Dec 2026</td>
              <td>
                <strong>Feb 2027</strong>
              </td>
              <td>Apr 2027</td>
              <td>
                <span className="cal-status cs-upcoming">● Upcoming</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">GNSI Scholarship Test</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  Internal · Fee Concession
                </small>
              </td>
              <td>
                <span className="cal-badge cb-gnsi">GNSI</span>
              </td>
              <td>Open Always</td>
              <td>Saturday before</td>
              <td>
                <strong>Every 1st Sunday</strong>
              </td>
              <td>3 Days</td>
              <td>
                <span className="cal-status cs-open">★ Open</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">GNSI Sunday Mock Tests</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  Internal · Free
                </small>
              </td>
              <td>
                <span className="cal-badge cb-gnsi">GNSI</span>
              </td>
              <td>—</td>
              <td>—</td>
              <td>
                <strong>Every Sunday</strong>
              </td>
              <td>Same Day</td>
              <td>
                <span className="cal-status cs-open">★ Ongoing</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">Summer Batch 2026</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  GNSI New Session
                </small>
              </td>
              <td>
                <span className="cal-badge cb-gnsi">GNSI</span>
              </td>
              <td colSpan={3} style={{ color: "var(--gold)", fontWeight: 600 }}>
                Commencing 1 July 2026
              </td>
              <td>—</td>
              <td>
                <span className="cal-status cs-open">★ Admissions Open</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <a
        href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Exam-Calendar-2026-27.pdf"
        className="cal-download"
        target="_blank"
        download=""
      >
        📥 <span data-en="">Download Full Exam Calendar PDF</span>
        <span data-hi="">पूर्ण परीक्षा कैलेंडर PDF डाउनलोड करें</span>
      </a>
    </div>
  </section>
  )}
  {/* ⑤ IMPORTANT DATES TIMELINE */}
  {activeTab === 'important-dates' && (
  <section className="timeline-section" id="important-dates">
    <div className="container">
      <div className="eyebrow reveal">
        <span data-en="">Don't Miss These</span>
        <span data-hi="">इन्हें मिस न करें</span>
      </div>
      <h2 className="st reveal">
        <span data-en="">Important Dates 2026–27</span>
        <span data-hi="">महत्वपूर्ण तिथियां 2026–27</span>
      </h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="timeline reveal" id="timelineList">
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Jun</span>
            <span className="tl-day">30</span>
          </div>
          <div className="tl-dot open" />
          <div className="tl-content open">
            <h4>🔴 GNSI Admission Deadline 2026–27</h4>
            <p>
              Last date to apply for GNSI Summer Batch. Hostel seats extremely
              limited. Contact immediately.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-gnsi">GNSI</span>
            </span>
          </div>
        </div>
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Jul</span>
            <span className="tl-day">01</span>
          </div>
          <div className="tl-dot upcoming" />
          <div className="tl-content">
            <h4>🎓 GNSI Summer Batch Begins</h4>
            <p>
              New academic session commences. Fresh batch of NVS, Sainik School,
              and RMS aspirants.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-gnsi">GNSI</span>
            </span>
          </div>
        </div>
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Jul</span>
            <span className="tl-day">—</span>
          </div>
          <div className="tl-dot upcoming" />
          <div className="tl-content">
            <h4>📋 JNVST Class 6 Application Opens</h4>
            <p>
              NVS releases the official application form for Jawahar Navodaya
              Class 6 entry 2026–27. Apply through navodaya.gov.in.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-nvs">NVS</span>
            </span>
          </div>
        </div>
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Oct</span>
            <span className="tl-day">—</span>
          </div>
          <div className="tl-dot upcoming" />
          <div className="tl-content">
            <h4>📋 AISSEE Application Opens</h4>
            <p>
              NTA releases AISSEE application for Sainik School Class 6 and
              Class 9 admission 2027. Register at nta.ac.in.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-sainik">Sainik</span>
            </span>
          </div>
        </div>
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Jan</span>
            <span className="tl-day">—</span>
          </div>
          <div className="tl-dot upcoming" />
          <div className="tl-content">
            <h4>📝 JNVST + AISSEE Exam Day</h4>
            <p>
              Both NVS Class 6 and Sainik School AISSEE examinations typically
              held in January. Mock test series peaks at GNSI.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-nvs">NVS</span>{" "}
              <span className="cal-badge cb-sainik">Sainik</span>
            </span>
          </div>
        </div>
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Feb</span>
            <span className="tl-day">—</span>
          </div>
          <div className="tl-dot upcoming" />
          <div className="tl-content">
            <h4>📝 RMS CET Examination</h4>
            <p>
              Rashtriya Military School Common Entrance Test for Class 6 and
              Class 9 admission. Conducted by NTA.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-rms">RMS</span>
            </span>
          </div>
        </div>
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Mar</span>
            <span className="tl-day">—</span>
          </div>
          <div className="tl-dot upcoming" />
          <div className="tl-content">
            <h4>🏆 NVS &amp; Sainik School Results</h4>
            <p>
              Results declared. GNSI students receive individual counselling and
              guidance for the next steps — document verification, medical, and
              admission.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-nvs">NVS</span>{" "}
              <span className="cal-badge cb-sainik">Sainik</span>
            </span>
          </div>
        </div>
      </div>
      <p
        style={{
          color: "var(--mist)",
          fontSize: "clamp(.72rem,2vw,.8rem)",
          fontFamily: 'Inter,sans-serif',
          letterSpacing: ".06em",
          marginTop: "1.5rem"
        }}
      >
        * Dates are indicative based on previous year schedules. Always verify
        at official websites: navodaya.gov.in · nta.ac.in ·
        sainikschooladmission.in
      </p>
    </div>
  </section>
  )}
  {/* FAQ */}
  {activeTab === 'faq' && (
  <section className="pad" id="faq">
    <div className="container">
      <div className="eyebrow reveal">FAQ</div>
      <h2 className="st reveal">Common Questions</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="faq reveal" style={{ maxWidth: 720 }}>
        <div className="faq-item">
          <div className="faq-q">
            What examinations does GNSI prepare students for?
            <div className="faq-icon">+</div>
          </div>
          <div className="faq-a">
            GNSI prepares students for AISSEE (All India Sainik Schools Entrance
            Examination), JNVST for Class 6 and Class 9 (Jawahar Navodaya
            Vidyalaya), and the RMS (Rashtriya Military School) entrance
            examination.
          </div>
        </div>
        <div className="faq-item">
          <div className="faq-q">
            Is boarding hostel facility available?
            <div className="faq-icon">+</div>
          </div>
          <div className="faq-a">
            Yes. GNSI provides supervised residential hostel accommodation with
            meals, structured study time, and a disciplined daily routine —
            closely modelled on the Sainik School environment. Day boarder and
            day scholar options are also available.
          </div>
        </div>
        <div className="faq-item">
          <div className="faq-q">
            What is the fee structure?<div className="faq-icon">+</div>
          </div>
          <div className="faq-a">
            Fees vary by course, level, and hostel option (Boarder, Day Boarder,
            Day Scholar). We share detailed fee information directly with
            parents after an initial enquiry. Please use the enquiry form or
            call us directly.
          </div>
        </div>
        <div className="faq-item">
          <div className="faq-q">
            How can parents monitor their child's progress?
            <div className="faq-icon">+</div>
          </div>
          <div className="faq-a">
            Parents can log in to the GNSI Parents Portal using their registered
            phone number and Student ID to view live attendance, exam scores,
            notices, hostel leave status, and alerts — directly from our
            database.
          </div>
        </div>
        <div className="faq-item">
          <div className="faq-q">
            When does the next batch commence?<div className="faq-icon">+</div>
          </div>
          <div className="faq-a">
            The Summer 2026 batch commences in July 2026. Applications must be
            submitted before 30 June 2026. Contact the institute by phone or
            WhatsApp for current seat availability.
          </div>
        </div>
        <div className="faq-item">
          <div className="faq-q">
            Can I pay fees online?<div className="faq-icon">+</div>
          </div>
          <div className="faq-a">
            Yes. GNSI accepts online fee payments via UPI (Google Pay, PhonePe,
            Paytm), NEFT/RTGS bank transfer, and direct bank deposit. Use the
            Pay Fee section on this page or contact the institute for bank
            details.
          </div>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* ENQUIRY */}
  {activeTab === 'enquiry' && (
  <section className="pad-alt" id="enquiry">
    <div className="container enquiry-grid">
      <div>
        <div className="eyebrow reveal">Admissions</div>
        <h2 className="st reveal">Enquire Now</h2>
        <div className="rule reveal">
          <div className="rule-line" />
          <div className="rule-d" />
          <div className="rule-line" />
        </div>
        <p
          style={{
            color: "rgba(255,255,255,.85)",
            marginBottom: "2rem",
            lineHeight: "1.85",
            fontSize: "clamp(0.92rem,2.4vw,1rem)"
          }}
          className="reveal"
        >
          Send your details and our team will respond regarding courses, hostel
          availability, and the admission process.
        </p>
        <div className="form-panel reveal">
          <div className="form-msg" id="formMsg" />
          <div className="form-row">
            <div>
              <label className="fl">Student Name</label>
              <input
                type="text"
                className="ff"
                id="fStuName"
                placeholder="Full name"
              />
            </div>
            <div>
              <label className="fl">Parent / Guardian</label>
              <input
                type="text"
                className="ff"
                id="fParName"
                placeholder="Full name"
              />
            </div>
          </div>
          <label className="fl">Phone Number</label>
          <input
            type="tel"
            className="ff"
            id="fPhone"
            placeholder="+91 XXXXX XXXXX"
          />
          <label className="fl">Student Class / Age</label>
          <input
            type="text"
            className="ff"
            id="fClass"
            placeholder="e.g. Class 5, Age 10"
          />
          <label className="fl">Course Interested In</label>
          <select className="ff" id="fCourse">
            <option value="">Select course</option>
            <option>NVS Preparation (Class 6)</option>
            <option>NVS Preparation (Class 9)</option>
            <option>Sainik School Preparation</option>
            <option>RMS Preparation</option>
            <option>Foundation Programme</option>
            <option>Combined Course</option>
            <option>Hostel Enquiry</option>
            <option>Free Demo Class</option>
          </select>
          <label className="fl">Message</label>
          <textarea
            className="ff"
            id="fMsg"
            placeholder="Your question or message"
            defaultValue={""}
          />
          <button
            type="button"
            className="btn btn-gold"
            style={{ width: "100%", justifyContent: "center" }}
            id="fBtn"
            onClick={() => window.submitEnquiry()}
          >
            Submit Enquiry →
          </button>
          <p
            style={{
              color: "rgba(255,255,255,.75)",
              fontSize: "clamp(0.68rem,1.8vw,0.75rem)",
              fontFamily: 'Inter,sans-serif',
              marginTop: ".6rem",
              textAlign: "center"
            }}
          >
            Or call us directly:{" "}
            <a href="tel:+918974298074" style={{ color: "#000000", textDecoration: "underline" }}>
              +91 89742 98074
            </a>
          </p>
        </div>
      </div>
      <div id="contact">
        <div className="eyebrow reveal">Contact</div>
        <h2 className="st reveal">Visit the Campus</h2>
        <div className="rule reveal">
          <div className="rule-line" />
          <div className="rule-d" />
          <div className="rule-line" />
        </div>
        <div className="contact-card reveal">
          <h3>Guidance Navodaya &amp; Sainik Institute</h3>
          <p>
            Khangabok, Thoubal District, Manipur
            <br />
            Phone:{" "}
            <a href="tel:+918974298074" style={{ color: "var(--navy)", textDecoration: "underline" }}>
              +91 89742 98074
            </a>
            <br />
            WhatsApp:{" "}
            <a
              href="https://wa.me/918974298074"
              style={{ color: "var(--wa)" }}
              target="_blank"
            >
              Chat with us →
            </a>
          </p>
        </div>
        <div className="contact-card reveal">
          <h3>Office Hours</h3>
          <p>
            Monday – Saturday: 08:30 to 17:00
            <br />
            Sunday: Test Day — open for enquiries after 14:00
          </p>
        </div>
        <div className="contact-card reveal">
          <h3>Follow Us</h3>
          <div className="social-strip">
            <a
              className="soc-btn soc-fb"
              href="https://facebook.com/gnsikhangabok"
              target="_blank"
            >
              f Facebook
            </a>
            <a
              className="soc-btn soc-yt"
              href="https://youtube.com/@gnsikhangabok"
              target="_blank"
            >
              ▶ YouTube
            </a>
            <a
              className="soc-btn soc-ig"
              href="https://instagram.com/gnsikhangabok"
              target="_blank"
            >
              ◉ Instagram
            </a>
          </div>
        </div>
        <div className="map-wrap reveal" id="mapWrap" onClick={() => window.loadMap()}>
          <div className="map-placeholder" id="mapPlaceholder">
            <span>📍 Khangabok, Thoubal District, Manipur</span>
            <button className="map-load-btn">View on Map →</button>
          </div>
        </div>
      </div>
    </div>
  </section>
  )}
  <div className="part-divider">
    <div className="part-divider-fade part-divider-fade-top" />
    <div className="part-divider-inner">
      <span className="part-num">III</span>
      <span className="part-eyebrow">Part Three</span>
      <h2 className="part-title">For GNSI Families</h2>
      <p className="part-sub">Fees, results, the student app, and support — all in one place for enrolled families.</p>
      <div className="part-ornament" />
    </div>
    <div className="part-divider-fade part-divider-fade-bottom" />
  </div>
  {/* ⑧ ONLINE FEE PAYMENT */}
  {activeTab === 'fee-payment' && (
  <section className="fee-section" id="fee-payment">
    <div className="container fee-grid">
      <div className="fee-info">
        <div className="eyebrow reveal" style={{ color: "var(--goldL)" }}>
          Online Payment
        </div>
        <h2 className="reveal">Pay Fee Online — Fast &amp; Secure</h2>
        <p className="reveal">
          GNSI now accepts fee payments online. Pay from anywhere using UPI,
          internet banking, or direct bank transfer. Safe, instant, and
          hassle-free.
        </p>
        <div className="fee-methods reveal">
          <span className="fee-method">📱 UPI</span>
          <span className="fee-method">🏦 NEFT / RTGS</span>
          <span className="fee-method">💳 Net Banking</span>
          <span className="fee-method">📲 PhonePe</span>
          <span className="fee-method">🟢 Google Pay</span>
        </div>

        {/* Live UPI ID + QR — populated from Settings → Fee Payment in the
            Website Manager via getStats(). Hidden entirely until upi_id or
            upi_qr_url is set, so nothing fake ever shows here. */}
        <div id="feeUpiBox" style={{ marginBottom: "1.5rem" }} className="reveal" />

        <p
          style={{
            color: "#3A3A3A",
            fontSize: "clamp(0.78rem,2.1vw,0.85rem)",
            fontFamily: 'Inter,sans-serif',
            letterSpacing: ".05em"
          }}
          className="reveal"
        >
          For any payment issues contact:{" "}
          <a href="tel:+918974298074" style={{ color: "var(--goldL)" }}>
            +91 89742 98074
          </a>
        </p>
      </div>
      <div className="fee-box reveal">
        <h3>How to Pay</h3>
        <div className="fee-step">
          <div className="fee-step-num">1</div>
          <div className="fee-step-txt">
            <strong>Get Student ID</strong>Contact the institute to receive your
            student admission number and fee amount confirmation.
          </div>
        </div>
        <div className="fee-step">
          <div className="fee-step-num">2</div>
          <div className="fee-step-txt">
            <strong>Choose Payment Method</strong>Pay via UPI to our registered
            number, or use NEFT/RTGS with the bank details provided by the
            institute.
          </div>
        </div>
        {/* Live bank details table — populated from Settings → Fee Payment.
            Stays hidden until bank_name/account_number/ifsc_code are set. */}
        <div id="feeBankBox" />
        <div className="fee-step">
          <div className="fee-step-num">3</div>
          <div className="fee-step-txt">
            <strong>Send Screenshot</strong>WhatsApp your payment screenshot to
            +91 89742 98074 with your student name and ID for confirmation.
          </div>
        </div>
        <button
          className="pay-btn"
          onClick={() => setIsFeeOpen(true)}
        >
          💳 Look Up My Fee &amp; Pay Online →
        </button>
        <p className="pay-note">
          Or WhatsApp your screenshot to{' '}
          <a
            href="https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20would%20like%20to%20pay%20fees%20online.%20Please%20share%20UPI%20and%20bank%20details."
            target="_blank"
            rel="noreferrer"
            style={{ color: '#fff', textDecoration: 'underline' }}
          >
            +91 89742 98074
          </a>{' '}· Receipt issued within 24 hours
        </p>
      </div>
    </div>
  </section>
  )}
  <div className="subsection-tag"><span>Student &amp; Parent Tools</span></div>
  {/* ② ADMIT CARD + RESULT CHECKER PORTAL */}
  {activeTab === 'portal' && (
  <section className="portal-section" id="portal">
    <div className="container">
      <div className="eyebrow reveal" style={{ color: "var(--goldL)" }}>
        <span data-en="">Student Portal</span>
        <span data-hi="">छात्र पोर्टल</span>
      </div>
      <h2 className="st reveal" style={{ color: "var(--navy)" }}>
        <span data-en="">Admit Card &amp; Result Portal</span>
        <span data-hi="">प्रवेश पत्र और परिणाम पोर्टल</span>
      </h2>
      <div className="rule reveal">
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,var(--gold),transparent)"
          }}
        />
        <div className="rule-d" />
        <div
          className="rule-line"
          style={{
            background: "linear-gradient(90deg,transparent,var(--gold))"
          }}
        />
      </div>
      <div className="portal-grid">
        {/* Admit Card */}
        <div className="portal-box reveal-left">
          <div className="portal-box-hd">
            <div className="portal-icon">🪪</div>
            <div>
              <h3>
                <span data-en="">Download Admit Card</span>
                <span data-hi="">प्रवेश पत्र डाउनलोड करें</span>
              </h3>
              <p>
                <span data-en="">Mock test &amp; exam hall ticket</span>
                <span data-hi="">मॉक टेस्ट और परीक्षा हॉल टिकट</span>
              </p>
            </div>
          </div>
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#3A3A3A",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">GCC No. (Student ID)</span>
            <span data-hi="">जीसीसी नंबर (छात्र आईडी)</span>
          </label>
          <input
            className="portal-input"
            id="acRoll"
            placeholder="e.g. GCC-2024-001"
          />
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#3A3A3A",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">Select Exam</span>
            <span data-hi="">परीक्षा चुनें</span>
          </label>
          <select className="portal-select" id="acExam">
            <option value="">-- Select Exam --</option>
            {portalExamTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button className="portal-btn" onClick={() => window.fetchAdmitCard()}>
            🪪 <span data-en="">Download Admit Card</span>
            <span data-hi="">प्रवेश पत्र डाउनलोड करें</span>
          </button>
          <div className="portal-result" id="acResult">
            <h4>Admit Card Status</h4>
            <div id="acData" />
            <button className="admit-download" onClick={() => window.printAdmitCard()}>
              🖨 Print / Download Admit Card
            </button>
          </div>
        </div>
        {/* Result Checker */}
        <div className="portal-box reveal-right">
          <div className="portal-box-hd">
            <div className="portal-icon">📊</div>
            <div>
              <h3>
                <span data-en="">Check Exam Result</span>
                <span data-hi="">परीक्षा परिणाम देखें</span>
              </h3>
              <p>
                <span data-en="">View marks, rank &amp; answer key</span>
                <span data-hi="">अंक, रैंक और उत्तर कुंजी देखें</span>
              </p>
            </div>
          </div>
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#3A3A3A",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">GCC No. (Student ID)</span>
            <span data-hi="">जीसीसी नंबर (छात्र आईडी)</span>
          </label>
          <input
            className="portal-input"
            id="rcRoll"
            placeholder="e.g. GCC-2024-001"
          />
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "#3A3A3A",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">Select Exam</span>
            <span data-hi="">परीक्षा चुनें</span>
          </label>
          <select className="portal-select" id="rcExam">
            <option value="">-- Select Exam --</option>
            {portalExamTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <button
            className="portal-btn"
            style={{ background: "var(--navy3)" }}
            onClick={() => window.fetchResult()}
          >
            📊 <span data-en="">Check My Result</span>
            <span data-hi="">मेरा परिणाम देखें</span>
          </button>
          <div className="portal-result" id="rcResult">
            <h4>Result Status</h4>
            <div id="rcData" />
          </div>
        </div>
      </div>
      <p
        style={{
          color: "#3A3A3A",
          fontFamily: 'Inter,sans-serif',
          fontSize: "clamp(.65rem,1.8vw,.72rem)",
          letterSpacing: ".06em",
          marginTop: "1.2rem",
          textAlign: "center"
        }}
      >
        <span data-en="">
          Portal shows results for GNSI internal mock tests only · For official
          NVS/Sainik results visit nta.ac.in
        </span>
        <span data-hi="">
          पोर्टल केवल GNSI आंतरिक मॉक टेस्ट के परिणाम दिखाता है · आधिकारिक
          परिणाम के लिए nta.ac.in पर जाएं
        </span>
      </p>
    </div>
  </section>
  )}
  {/* ⑥ APP DOWNLOAD */}
  {activeTab === 'app-download' && (
  <section className="app-section" id="app-download">
    <div className="container app-grid">
      <div className="app-info">
        <div className="eyebrow" style={{ color: "var(--goldL)" }}>
          <span data-en="">Mobile App</span>
          <span data-hi="">मोबाइल ऐप</span>
        </div>
        <h2>
          <span data-en="">Download the GNSI App</span>
          <span data-hi="">GNSI ऐप डाउनलोड करें</span>
        </h2>
        <p>
          <span data-en="">
            Access attendance, exam results, notices, hostel leave status, and
            fee receipts from your phone — anywhere, anytime. Built for parents
            and students.
          </span>
          <span data-hi="">
            अपने फोन से उपस्थिति, परीक्षा परिणाम, नोटिस, छात्रावास अवकाश की
            स्थिति और शुल्क रसीदें एक्सेस करें।
          </span>
        </p>
        <div className="app-features">
          <div className="app-feat">
            📊 <span data-en="">Live Attendance</span>
            <span data-hi="">लाइव उपस्थिति</span>
          </div>
          <div className="app-feat">
            📝 <span data-en="">Exam Scores</span>
            <span data-hi="">परीक्षा अंक</span>
          </div>
          <div className="app-feat">
            📣 <span data-en="">Push Notifications</span>
            <span data-hi="">पुश सूचनाएं</span>
          </div>
          <div className="app-feat">
            🏠 <span data-en="">Hostel Leave</span>
            <span data-hi="">छात्रावास अवकाश</span>
          </div>
          <div className="app-feat">
            💳 <span data-en="">Fee Payment</span>
            <span data-hi="">शुल्क भुगतान</span>
          </div>
          <div className="app-feat">
            📰 <span data-en="">Notice Board</span>
            <span data-hi="">सूचना पट्ट</span>
          </div>
        </div>
        <div className="app-btns">
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/gnsi-app.apk"
            className="app-btn"
            target="_blank"
            download=""
          >
            <span className="app-btn-icon">▲</span>
            <div className="app-btn-txt">
              <small>Download for</small>
              <strong>Android APK</strong>
            </div>
          </a>
          <a
            href="https://play.google.com/store"
            className="app-btn"
            target="_blank"
          >
            <span className="app-btn-icon">▲</span>
            <div className="app-btn-txt">
              <small>Get it on</small>
              <strong>Google Play</strong>
            </div>
          </a>
          <a
            href="#"
            className="app-btn"
            style={{ opacity: ".45", cursor: "not-allowed" }}
            title="Coming soon"
          >
            <span className="app-btn-icon">🍎</span>
            <div className="app-btn-txt">
              <small>Coming soon</small>
              <strong>App Store</strong>
            </div>
          </a>
        </div>
      </div>
      <div className="app-mockup">
        <div className="app-screen">
          <div className="app-screen-hd">
            <span>🏫 GNSI Student App</span>
          </div>
          <div className="app-screen-row">
            <span>Attendance</span>
            <strong style={{ color: "#4AE382" }}>94%</strong>
          </div>
          <div className="app-screen-row">
            <span>Last Exam</span>
            <strong>87/100</strong>
          </div>
          <div className="app-screen-row">
            <span>Hostel Leave</span>
            <strong style={{ color: "var(--goldLL)" }}>Approved</strong>
          </div>
          <div className="app-screen-row">
            <span>Fee Status</span>
            <strong style={{ color: "#4AE382" }}>Paid</strong>
          </div>
          <div className="app-screen-row">
            <span>Next Test</span>
            <strong>Sunday</strong>
          </div>
          <div className="app-screen-row">
            <span>Notices</span>
            <strong>2 New</strong>
          </div>
        </div>
        <div className="app-qr">
          <div
            style={{
              width: 80,
              height: 80,
              background:
                "repeating-linear-gradient(0deg,rgba(80,80,80,.15) 0,rgba(80,80,80,.15) 4px,transparent 4px,transparent 8px),repeating-linear-gradient(90deg,rgba(80,80,80,.15) 0,rgba(80,80,80,.15) 4px,transparent 4px,transparent 8px)",
              margin: "0 auto"
            }}
          />
          <p>Scan QR to Download</p>
        </div>
      </div>
    </div>
  </section>
  )}
  {/* ⑦ GRIEVANCE / HELPDESK */}
  {activeTab === 'helpdesk' && (
  <section className="helpdesk-section" id="helpdesk">
    <div className="container">
      <div className="eyebrow reveal">
        <span data-en="">Support</span>
        <span data-hi="">सहायता</span>
      </div>
      <h2 className="st reveal">
        <span data-en="">Grievance &amp; Helpdesk</span>
        <span data-hi="">शिकायत और हेल्पडेस्क</span>
      </h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="helpdesk-grid">
        <div>
          <p className="reveal">
            <span data-en="">
              Have a concern, query, or complaint? GNSI is committed to
              resolving all grievances within 48 hours. Use the form or contact
              us directly — we take every concern seriously.
            </span>
            <span data-hi="">
              कोई चिंता, प्रश्न या शिकायत है? GNSI 48 घंटों के भीतर सभी शिकायतों
              को हल करने के लिए प्रतिबद्ध है।
            </span>
          </p>
          <div className="helpdesk-contacts reveal">
            <div className="hc-item">
              <span className="hc-icon">📞</span>
              <div>
                <span className="hc-label">Primary Helpline</span>
                <span className="hc-val">
                  <a href="tel:+918974298074">+91 89742 98074</a>
                </span>
              </div>
            </div>
            <div className="hc-item">
              <span className="hc-icon">💬</span>
              <div>
                <span className="hc-label">WhatsApp Support</span>
                <span className="hc-val">
                  <a href="https://wa.me/918974298074" target="_blank">
                    Chat on WhatsApp →
                  </a>
                </span>
              </div>
            </div>
            <div className="hc-item">
              <span className="hc-icon">✉</span>
              <div>
                <span className="hc-label">Email</span>
                <span className="hc-val">
                  <a href="mailto:gnsikhangabok@gmail.com">
                    gnsikhangabok@gmail.com
                  </a>
                </span>
              </div>
            </div>
            <div className="hc-item">
              <span className="hc-icon">📍</span>
              <div>
                <span className="hc-label">Visit Campus</span>
                <span className="hc-val">
                  <span data-en="">Khangabok, Thoubal District, Manipur</span>
                  <span data-hi="">खंगाबोक, थौबल जिला, मणिपुर</span>
                </span>
              </div>
            </div>
            <div className="hc-item">
              <span className="hc-icon">🕐</span>
              <div>
                <span className="hc-label">Response Time</span>
                <span className="hc-val">
                  Within 48 hours · WhatsApp: Same day
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="helpdesk-form reveal">
          <h3>
            <span data-en="">Submit a Grievance / Query</span>
            <span data-hi="">शिकायत / प्रश्न सबमिट करें</span>
          </h3>
          <p>Your concern is assigned a ticket ID for tracking</p>
          <div className="grv-msg" id="grvMsg" />
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.85)",
              marginBottom: ".35rem"
            }}
          >
            <span data-en="">Your Name *</span>
            <span data-hi="">आपका नाम *</span>
          </label>
          <input className="grv-input" id="grvName" placeholder="Full name" />
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.85)",
              marginBottom: ".35rem"
            }}
          >
            <span data-en="">Phone Number *</span>
            <span data-hi="">फोन नंबर *</span>
          </label>
          <input
            className="grv-input"
            id="grvPhone"
            placeholder="+91 XXXXX XXXXX"
            type="tel"
          />
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.85)",
              marginBottom: ".35rem"
            }}
          >
            <span data-en="">Category</span>
            <span data-hi="">श्रेणी</span>
          </label>
          <select className="grv-select" id="grvCat">
            <option>Fee / Payment Issue</option>
            <option>Attendance Discrepancy</option>
            <option>Hostel Complaint</option>
            <option>Academic / Teaching Query</option>
            <option>Admission Query</option>
            <option>Portal / App Issue</option>
            <option>Other</option>
          </select>
          <label
            style={{
              display: "block",
              fontFamily: 'Inter,sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(255,255,255,.85)",
              marginBottom: ".35rem"
            }}
          >
            <span data-en="">Describe Your Concern *</span>
            <span data-hi="">अपनी चिंता बताएं *</span>
          </label>
          <textarea
            className="grv-textarea"
            id="grvMsg2"
            placeholder="Please describe your concern or query in detail…"
            defaultValue={""}
          />
          <button className="grv-btn" onClick={() => window.submitGrievance()}>
            📨 <span data-en="">Submit Grievance →</span>
            <span data-hi="">शिकायत सबमिट करें →</span>
          </button>
        </div>
      </div>
    </div>
  </section>
  )}
  </div>
  {/* CTA */}
  <div className="cta-block">
    <h2>Begin the Journey</h2>
    <p>
      Join a disciplined, technology-enabled academic environment built to
      prepare students for elite school entrance success. Over 200 students
      selected — yours could be the next name on that roll.
    </p>
    <div
      style={{
        display: "flex",
        gap: "1rem",
        justifyContent: "center",
        flexWrap: "wrap",
        position: "relative"
      }}
    >
      <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }} className="btn btn-gold">
        Apply / Enquire →
      </a>
      <a
        href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Brochure-2026.pdf"
        className="btn btn-out"
        download=""
        target="_blank"
      >
        📄 Download Brochure
      </a>
      <button onClick={() => setIsPortalOpen(true)} className="btn btn-grn">
        Parents Portal →
      </button>
      <button onClick={() => setIsFeeOpen(true)} className="btn btn-fee">
        💳 Pay Fee →
      </button>
      <a
        href="https://wa.me/918974298074"
        className="btn btn-wa"
        target="_blank"
      >
        WhatsApp →
      </a>
    </div>
  </div>
  {/* FOOTER */}
  <footer>
    <div className="footer-grid">
      <div>
        <h4>GNSI — Guidance Navodaya &amp; Sainik Institute</h4>
        <p
          style={{
            color: "rgba(230,230,230,.85)",
            lineHeight: "1.85",
            fontSize: "clamp(0.82rem,2.2vw,0.88rem)",
            maxWidth: 320,
            marginBottom: "1rem"
          }}
        >
          Residential coaching institution in Khangabok, Thoubal, Manipur —
          focused on NVS, Sainik School, and RMS entrance preparation.
          Established 2016.
        </p>
        <div className="footer-tricolor">
          <div />
          <div />
          <div />
        </div>
        <div className="foot-social" style={{ marginTop: ".9rem" }}>
          <a
            className="foot-soc-icon"
            href="https://facebook.com/gnsikhangabok"
            target="_blank"
            aria-label="Facebook"
          >
            <svg viewBox="0 0 24 24"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.13 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.51 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.44 2.91h-2.34V22c4.78-.81 8.44-4.94 8.44-9.94Z"/></svg>
          </a>
          <a
            className="foot-soc-icon"
            href="https://youtube.com/@gnsikhangabok"
            target="_blank"
            aria-label="YouTube"
          >
            <svg viewBox="0 0 24 24"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6Z"/></svg>
          </a>
          <a
            className="foot-soc-icon"
            href="https://instagram.com/gnsikhangabok"
            target="_blank"
            aria-label="Instagram"
          >
            <svg viewBox="0 0 24 24"><path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.05 1.97.24 2.43.4a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.16.46.35 1.26.4 2.43.07 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.05 1.17-.24 1.97-.4 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.46.16-1.26.35-2.43.4-1.25.07-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.05-1.97-.24-2.43-.4a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.16-.46-.35-1.26-.4-2.43C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.05-1.17.24-1.97.4-2.43a4.9 4.9 0 0 1 1.15-1.77A4.9 4.9 0 0 1 5.6 1.8c.46-.16 1.26-.35 2.43-.4C9.27 2.2 9.67 2.2 12 2.2Zm0 1.8c-3.16 0-3.53 0-4.77.07-.96.04-1.48.2-1.82.34-.46.18-.78.39-1.13.73-.34.35-.55.67-.73 1.13-.13.34-.3.86-.34 1.82C3.14 8.83 3.14 9.2 3.14 12s0 3.17.07 4.41c.04.96.2 1.48.34 1.82.18.46.39.78.73 1.13.35.34.67.55 1.13.73.34.13.86.3 1.82.34 1.24.07 1.61.07 4.77.07s3.53 0 4.77-.07c.96-.04 1.48-.2 1.82-.34.46-.18.78-.39 1.13-.73.34-.35.55-.67.73-1.13.13-.34.3-.86.34-1.82.07-1.24.07-1.61.07-4.41s0-3.17-.07-4.41c-.04-.96-.2-1.48-.34-1.82a2.9 2.9 0 0 0-.73-1.13 2.9 2.9 0 0 0-1.13-.73c-.34-.13-.86-.3-1.82-.34C15.53 3.84 15.16 3.84 12 3.84Zm0 3.3a4.86 4.86 0 1 1 0 9.72 4.86 4.86 0 0 1 0-9.72Zm0 1.8a3.06 3.06 0 1 0 0 6.12 3.06 3.06 0 0 0 0-6.12Zm5.5-3.18a1.13 1.13 0 1 1 0 2.27 1.13 1.13 0 0 1 0-2.27Z"/></svg>
          </a>
          <a
            className="foot-soc-icon"
            href="https://wa.me/918974298074"
            target="_blank"
            aria-label="WhatsApp"
            style={{ color: "#4AE382", borderColor: "rgba(37,211,102,.3)" }}
          >
            <svg viewBox="0 0 24 24"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.16 6.45 6.6 2 12.05 2c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.89-9.88 9.89Z"/></svg>
          </a>
        </div>
      </div>
      <div>
        <h4>Navigate</h4>
        <a href="#notices" onClick={(e) => { e.preventDefault(); goToTab('notices'); }}>Notice Board</a>
        <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }}>Courses</a>
        <a href="#results" onClick={(e) => { e.preventDefault(); goToTab('results'); }}>Results</a>
        <a href="#rankers" onClick={(e) => { e.preventDefault(); goToTab('rankers'); }}>Ranker Wall</a>
        <a href="#facilities" onClick={(e) => { e.preventDefault(); goToTab('facilities'); }}>Facilities</a>
        <a href="#faculty" onClick={(e) => { e.preventDefault(); goToTab('faculty'); }}>Faculty</a>
        <a href="#blog" onClick={(e) => { e.preventDefault(); goToTab('blog'); }}>News &amp; Blog</a>
        <a href="#gallery" onClick={(e) => { e.preventDefault(); goToTab('gallery'); }}>Gallery</a>
      </div>
      <div>
        <h4>Admissions</h4>
        <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }}>Sainik School Prep</a>
        <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }}>Navodaya Prep</a>
        <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }}>Foundation Programme</a>
        <a href="#courses" onClick={(e) => { e.preventDefault(); goToTab('courses'); }}>Combined Course</a>
        <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}>Apply Now</a>
        <a
          href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Brochure-2026.pdf"
          target="_blank"
          download=""
        >
          📄 Download Brochure
        </a>
      </div>
      <div>
        <h4>Contact</h4>
        <a href="tel:+918974298074">+91 89742 98074</a>
        <a
          href="https://wa.me/918974298074"
          target="_blank"
          style={{ color: "#4AE382" }}
        >
          WhatsApp
        </a>
        <button
          onClick={() => setIsFeeOpen(true)}
          style={{ color: "var(--goldL)", background: "none", border: "none", padding: 0, font: "inherit", cursor: "pointer", display: "block", marginBottom: ".6rem", textAlign: "left" }}
        >
          💳 Pay Fee Online
        </button>
        <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }}>Admission Enquiry</a>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); setIsPortalOpen(true); }}
          style={{ color: "#4AE382" }}
        >
          Parents Portal
        </a>
        <button
          onClick={onLogin}
          style={{
            display: "block",
            marginBottom: ".55rem",
            color: "rgba(230,230,230,.85)",
            fontSize: "clamp(0.82rem,2.2vw,0.88rem)",
            background: "none",
            border: "none",
            cursor: "pointer",
            textAlign: "left",
            padding: 0,
            fontFamily: "inherit",
            transition: ".2s"
          }}
        >
          Staff Login
        </button>
      </div>
    </div>
    <div className="footer-bottom">
      <span>
        © 2026 Guidance Navodaya &amp; Sainik Institute, Khangabok, Thoubal,
        Manipur
      </span>
      <span>Established 2016 · guidancekhangabok.in</span>
    </div>
  </footer>
  {/* WA FLOAT */}
  <a
    id="waFloat"
    href="https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20am%20interested%20in%20admissions."
    target="_blank"
  >
    <div className="wa-tooltip">Chat with us on WhatsApp</div>
    <svg viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  </a>
  {/* RESULT POSTER — auto-popup at 10s, collapses to a sticky corner badge */}
  {posterState === 'popup' && (
    <div
      className="poster-overlay"
      onClick={() => setPosterState('badge')}
      role="dialog"
      aria-modal="true"
      aria-label="Latest result poster"
    >
      <div className="poster-modal" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="poster-close"
          onClick={() => setPosterState('badge')}
          aria-label="Minimize"
          title="Minimize"
        >
          ✕
        </button>
        <img src={RESULT_POSTER_URL} alt="Latest GNSI student result — celebrating another selection" />
      </div>
    </div>
  )}
  {posterState === 'badge' && (
    <button
      type="button"
      className="poster-badge"
      onClick={() => setPosterState('popup')}
      aria-label="Show latest result poster"
      title="Latest result — tap to view"
    >
      <img src={RESULT_POSTER_URL} alt="" />
      <span
        className="poster-badge-close"
        onClick={(e) => { e.stopPropagation(); setPosterState('closed'); }}
        role="button"
        aria-label="Dismiss"
        title="Dismiss"
      >
        ✕
      </span>
    </button>
  )}
  <ParentsPortal isOpen={isPortalOpen} onClose={() => setIsPortalOpen(false)} />
  <PublicFeeLookup isOpen={isFeeOpen} onClose={() => setIsFeeOpen(false)} upi={feePaymentInfo} />
</>  );
}
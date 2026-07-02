import { useEffect, useState } from 'react';
import {
  getActiveNotices, getRankers, getGallery, getVideos, getYouTubeThumb, getYouTubeEmbed,
  getPublishedPosts, getFeaturedReviews, getPapers, getActiveBanners, getFaculty,
  getLiveKPIs, getEvents, submitEnquiry, submitScholarRegistration, submitGrievance
} from './websiteApi';
import { supabase } from './supabase';

// TODO: consider moving to Supabase storage for consistency with other site assets
const FOUNDER_PHOTO_URL = "https://i.postimg.cc/Vsd7VXZ7/DSC05195.jpg";

// Upload gnsi-emblem-transparent.png to the gnsi-public Supabase storage bucket,
// then point this at the real path.
const EMBLEM_URL = "https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/gnsi-emblem.png";

export default function LandingPage({ onLogin }) {
  // ═══ DROPDOWN NAVIGATION — categories & subsections ═══
  const [expandedCat, setExpandedCat] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const navCategories = [
    {
      label: 'Academics',
      icon: '📚',
      links: [
        { label: 'Courses', href: '#courses' },
        { label: 'Syllabus', href: '#syllabus' },
        { label: 'Question Papers', href: '#question-papers' },
        { label: 'Exam Calendar', href: '#exam-calendar' },
        { label: 'Mock Tests', href: '#mock-tests' },
      ]
    },
    {
      label: 'Results & News',
      icon: '🏆',
      links: [
        { label: 'Results', href: '#results' },
        { label: "Toppers' Wall", href: '#rankers' },
        { label: 'Student Reviews', href: '#reviews' },
        { label: 'Notices', href: '#notices' },
        { label: 'Blog & News', href: '#blog' },
      ]
    },
    {
      label: 'Admissions',
      icon: '📋',
      links: [
        { label: 'Enquire Now', href: '#enquiry' },
        { label: 'Scholarship / Free Test', href: '#scholarship' },
        { label: 'Fee Payment', href: '#fee-payment' },
        { label: 'Important Dates', href: '#important-dates' },
        { label: 'FAQ', href: '#faq' },
      ]
    },
    {
      label: 'Campus',
      icon: '🎓',
      links: [
        { label: 'Faculty', href: '#faculty' },
        { label: 'Facilities', href: '#facilities' },
        { label: 'Gallery', href: '#gallery' },
        { label: 'Videos', href: '#videos' },
        { label: 'Events', href: '#events' },
      ]
    },
    {
      label: 'About & More',
      icon: 'ℹ️',
      links: [
        { label: 'About GNSI', href: '#about' },
        { label: "Director's Message", href: '#head-institute' },
        { label: 'Admit Card / Portal', href: '#portal' },
        { label: 'Download App', href: '#app-download' },
        { label: 'Helpdesk / Grievance', href: '#helpdesk' },
        { label: 'Contact / Location', href: '#contact' },
      ]
    },
  ];

  const toggleCat = (idx) => setExpandedCat(expandedCat === idx ? null : idx);
  const closeCats = () => setExpandedCat(null);
  const closeMobile = () => { setMobileOpen(false); setExpandedCat(null); };

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

// ---- 2. NOTICES (top 3 active, into #noticesGrid) ----
(async () => {
  const grid = document.getElementById('noticesGrid');
  if (!grid) return; // add id="noticesGrid" to the .cards-row div in the Notices section
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

// ---- 6. GALLERY (into #galleryGrid) ----
(async () => {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;
  try {
    const images = await getGallery();
    if (!images.length) return;
    grid.innerHTML = images.map(img => `
      <div class="gcell">
        <img src="${escapeHtml(img.image_url)}" alt="${escapeHtml(img.caption || '')}" onerror="this.parentElement.style.display='none'" />
        ${img.caption ? `<div class="gcell-lbl">${escapeHtml(img.caption)}</div>` : ''}
      </div>`).join('');
  } catch (e) { console.error('Gallery load failed:', e); }
})();

// ---- 7. VIDEOS (main embed into #mainVideoEmbed, list into #videoListEl) ----
(async () => {
  const list = document.getElementById('videoListEl');
  if (!list) return;
  try {
    const videos = await getVideos();
    if (!videos.length) {
      list.innerHTML = '<p style="color:rgba(248,243,232,.85);font-family:\'Rajdhani\',sans-serif;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;padding:.5rem 0">Videos coming soon</p>';
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
      list.innerHTML = '<p style="color:var(--mist);font-family:\'Rajdhani\',sans-serif;font-size:.85rem;letter-spacing:.04em;padding:.5rem 0">No upcoming events scheduled right now — check back soon.</p>';
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
        dot.onclick = () => { if (window.rbSlide) { /* jump via repeated calls */ } };
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

       // ── PARENTS PORTAL ────────────────────────────────────────────────────────

    window.openPP = () => {
      document.getElementById('ppOverlay')?.classList.add('open');
      document.body.style.overflow = 'hidden';
    };
    window.closePP = () => {
      document.getElementById('ppOverlay')?.classList.remove('open');
      document.body.style.overflow = '';
    };

    window.ppTab = (id, btn) => {
      document.querySelectorAll('.pp-sec').forEach(s => s.classList.remove('active'));
      document.getElementById('sec-' + id)?.classList.add('active');
      document.querySelectorAll('.pp-tab').forEach(b => b.classList.remove('active'));
      btn?.classList.add('active');
      const sid = window._ppStudentId;
      if (!sid) return;
      if (id === 'att')        ppLoadAtt(sid);
      if (id === 'exams')      ppLoadExams(sid);
      if (id === 'reportcard') ppLoadReportCard(sid);
      if (id === 'notices')    ppLoadNotices();
      if (id === 'leave')      ppLoadLeave(sid);
      if (id === 'alerts')     ppLoadAlerts(sid);
    };

    window.ppLogin = async () => {
      const gccNoRaw  = document.getElementById('ppPhone')?.value?.trim();
      const gccNo     = gccNoRaw;
      // FIX #4: Guard against undefined value before calling string methods
      const nameInput = (document.getElementById('ppSid')?.value || '').trim().toUpperCase();
      const err       = document.getElementById('ppErr');
      const btn       = document.getElementById('ppLbtn');

      if (!gccNoRaw || !nameInput) {
        if (err) { err.style.display = 'block'; err.textContent = 'Please enter both GCC No. and Student Name.'; }
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Checking…';
      if (err) err.style.display = 'none';

      try {
        const timeout = (ms) => new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timed out. Please check your connection and try again.')), ms));

        const { data, error } = await Promise.race([
          supabase
            .from('students')
            .select('id, name, course, class_name, batch, hostel_type, status, admission_no, gcc_no')
            .eq('gcc_no', gccNo)
            .single(),
          timeout(15000),
        ]);

        // FIX #5: Guard data.name against null/undefined before comparison
        const normalizedDataName = (data?.name || '').toUpperCase().replace(/\s+/g,' ').trim();
        const normalizedInput    = nameInput.replace(/\s+/g,' ').trim();

        if (error || !data || normalizedDataName !== normalizedInput) {
          const msg = error ? `Error: ${error.message}` : !data ? 'GCC No. not found.' : 'Name does not match.';
          if (err) { err.style.display = 'block'; err.textContent = msg; }
          btn.disabled = false;
          btn.textContent = 'Login to Parents Portal →';
          return;
        }

        window._ppStudentId = data.id;
        window._ppStudent   = data;

        document.getElementById('ppStuName').textContent  = data.name || 'Student';
        document.getElementById('ppDashName').textContent = data.name || 'Student';
        document.getElementById('ppStuClass').textContent = [data.course, data.class_name, data.batch].filter(Boolean).join(' · ');
        document.getElementById('ppAv').textContent       = ((data.name || 'S')[0]).toUpperCase();
        document.getElementById('ppStuType').textContent  = data.hostel_type || '—';
        document.getElementById('ppStuStat').textContent  = data.status || 'Active';

        document.getElementById('ppLoginWrap').style.display = 'none';
        document.getElementById('ppShell').classList.add('show');
        ppLoadAtt(data.id);

      } catch (e) {
        if (err) { err.style.display = 'block'; err.textContent = e?.message || 'Connection error. Try again.'; }
        btn.disabled = false;
        btn.textContent = 'Login to Parents Portal →';
      }
    };

    window.ppLogout = () => {
      window._ppStudentId = null;
      window._ppStudent   = null;
      document.getElementById('ppPhone').value = '';
      document.getElementById('ppSid').value   = '';
      document.getElementById('ppLoginWrap').style.display = 'flex';
      document.getElementById('ppShell').classList.remove('show');
      // FIX: Reset tabs to first (attendance) tab
      document.querySelectorAll('.pp-tab').forEach((b, i) => b.classList.toggle('active', i === 0));
      document.querySelectorAll('.pp-sec').forEach((s, i) => s.classList.toggle('active', i === 0));
    };

    // ── TAB: ATTENDANCE ───────────────────────────────────────────────────────

    async function ppLoadAtt(studentId) {
      const grid   = document.getElementById('attGrid');
      const recent = document.getElementById('attRecent');
      const month  = document.getElementById('attMonth');
      // FIX #1: Guard all required elements
      if (!grid || !recent || !month) return;

      const now  = new Date();
      const y    = now.getFullYear();
      const m    = String(now.getMonth() + 1).padStart(2, '0');
      const from = `${y}-${m}-01`;
      const to   = `${y}-${m}-31`;
      month.textContent = now.toLocaleString('default', { month: 'long', year: 'numeric' });

      try {
        const { data } = await supabase
          .from('attendance')
          .select('date, status')
          .eq('student_id', studentId)
          .gte('date', from)
          .lte('date', to)
          .order('date', { ascending: true });

        const rows = data || [];
        const daysInMonth = new Date(y, now.getMonth() + 1, 0).getDate();
        const byDate = Object.fromEntries(rows.map(r => [r.date.slice(8, 10), r.status]));

        let gridHTML = '';
        for (let d = 1; d <= daysInMonth; d++) {
          const dd  = String(d).padStart(2, '0');
          const st  = byDate[dd];
          const cls = st === 'Present' ? 'att-p' : st === 'Absent' ? 'att-a' : 'att-h';
          gridHTML += `<div class="att-day ${cls}" title="${y}-${m}-${dd}">${d}</div>`;
        }
        grid.innerHTML = gridHTML || '<div class="pp-empty"><p>No data</p></div>';

        const p   = rows.filter(r => r.status === 'Present').length;
        const a   = rows.filter(r => r.status === 'Absent').length;
        const pct = rows.length ? Math.round((p / rows.length) * 100) : 0;
        document.getElementById('attP').textContent   = p;
        document.getElementById('attA').textContent   = a;
        document.getElementById('attPct').textContent = pct + '%';

        const last10 = rows.slice(-10).reverse();
        recent.innerHTML = last10.length
          ? `<table class="pp-table"><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>
              ${last10.map(r => {
                const badge = r.status === 'Present' ? 'sc-hi' : 'sc-lo';
                return `<tr><td>${r.date}</td><td><span class="${badge}">${r.status}</span></td></tr>`;
              }).join('')}
            </tbody></table>`
          : '<div class="pp-empty"><div class="pp-empty-icon">📅</div><p>No recent records</p></div>';
      } catch (e) {
        console.error('Attendance load failed:', e);
        grid.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Failed to load attendance</p></div>';
        recent.innerHTML = '';
      }
    }

    // ── TAB: EXAM SCORES ──────────────────────────────────────────────────────

    async function ppLoadExams(studentId) {
      const el = document.getElementById('examList');
      if (!el) return;
      el.innerHTML = '<div class="pp-loading"><div class="spin"></div>Loading…</div>';

      try {
        const { data: marks } = await supabase
          .from('exam_marks')
          .select('subject, marks_obtained, total_marks, exam_date, exam_type_id')
          .eq('student_id', studentId)
          .order('exam_date', { ascending: false });

        if (!marks?.length) {
          el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">📝</div><p>No results yet</p></div>';
          return;
        }

        const typeIds = [...new Set(marks.map(r => r.exam_type_id).filter(Boolean))];
        const { data: types } = typeIds.length
          ? await supabase.from('exam_types').select('id, name').in('id', typeIds)
          : { data: [] };
        const typeMap = Object.fromEntries((types || []).map(t => [t.id, t.name]));

        el.innerHTML = `<table class="pp-table">
          <thead><tr><th>Exam</th><th>Subject</th><th>Marks</th><th>Date</th></tr></thead>
          <tbody>${marks.map(r => {
            const total    = r.total_marks ?? '—';
            const name     = typeMap[r.exam_type_id] || '—';
            const pct      = total !== '—' ? Math.round((r.marks_obtained / total) * 100) : null;
            const badge    = pct === null ? 'sc-mi' : pct >= 75 ? 'sc-hi' : pct >= 50 ? 'sc-mi' : 'sc-lo';
            const marksStr = total !== '—' ? `${r.marks_obtained}/${total}` : r.marks_obtained;
            return `<tr>
              <td>${name}</td>
              <td>${r.subject || '—'}</td>
              <td><span class="${badge}">${marksStr}</span></td>
              <td>${r.exam_date ? r.exam_date.slice(0, 10) : '—'}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>`;
      } catch (e) {
        console.error('Exams load failed:', e);
        el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Failed to load exam scores</p></div>';
      }
    }

    // ── TAB: REPORT CARD ──────────────────────────────────────────────────────

    const RC_GRADE_PRESETS = [
      { min: 90, label: "A+", color: "#0F6E56", gpa: 4.0 },
      { min: 80, label: "A",  color: "#185FA5", gpa: 3.5 },
      { min: 70, label: "B+", color: "#534AB7", gpa: 3.0 },
      { min: 60, label: "B",  color: "#2563eb", gpa: 2.5 },
      { min: 50, label: "C",  color: "#BA7517", gpa: 2.0 },
      { min: 40, label: "D",  color: "#ea580c", gpa: 1.0 },
      { min: 0,  label: "F",  color: "#A32D2D", gpa: 0.0 },
    ];
    function rcGetGrade(pct) {
      for (const g of RC_GRADE_PRESETS) if (pct >= g.min) return g;
      return RC_GRADE_PRESETS[RC_GRADE_PRESETS.length - 1];
    }
    const RC_COURSE_MAX_MARKS = {
      ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
      ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
      PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
      LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
      UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
      CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
      LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
    };

    async function ppLoadReportCard(studentId) {
      const sel = document.getElementById('rcExamType');
      // FIX #2: Guard all required elements
      if (!sel) return;
      const dateSel = document.getElementById('rcExamDate');
      const btn = document.getElementById('rcPrintBtn');
      if (!dateSel) return;
      
      sel.innerHTML = '<option value="">Loading…</option>';
      dateSel.innerHTML = '<option value="">—</option>';
      if (btn) btn.disabled = true;

      try {
        const { data: marks } = await supabase
          .from('exam_marks')
          .select('exam_type_id')
          .eq('student_id', studentId);

        const typeIds = [...new Set((marks || []).map(r => r.exam_type_id).filter(Boolean))];
        if (!typeIds.length) {
          sel.innerHTML = '<option value="">— No exams recorded —</option>';
          return;
        }
        const { data: types } = await supabase.from('exam_types').select('id, name').in('id', typeIds);
        sel.innerHTML = '<option value="">Select exam…</option>' +
          (types || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
      } catch (e) {
        console.error('Report card load failed:', e);
        sel.innerHTML = '<option value="">— Error loading exams —</option>';
      }
    }

    window.ppRCExamChange = async (examTypeId) => {
      const dateSel = document.getElementById('rcExamDate');
      const btn = document.getElementById('rcPrintBtn');
      if (!dateSel) return;
      if (btn) btn.disabled = true;
      
      if (!examTypeId) { dateSel.innerHTML = '<option value="">—</option>'; return; }
      
      const sid = window._ppStudentId;
      dateSel.innerHTML = '<option value="">Loading…</option>';
      
      try {
        const { data } = await supabase
          .from('exam_marks')
          .select('exam_date')
          .eq('student_id', sid)
          .eq('exam_type_id', examTypeId);
        const dates = [...new Set((data || []).map(r => (r.exam_date || '').slice(0, 10)).filter(Boolean))].sort().reverse();
        dateSel.innerHTML = dates.length
          ? dates.map(d => `<option value="${d}">${d}</option>`).join('')
          : '<option value="">— No dates —</option>';
        if (btn) btn.disabled = !dates.length;
      } catch (e) {
        console.error('Exam date load failed:', e);
        dateSel.innerHTML = '<option value="">— Error —</option>';
        if (btn) btn.disabled = true;
      }
    };

    window.ppPrintReportCard = async () => {
      const btn = document.getElementById('rcPrintBtn');
      const examTypeSel = document.getElementById('rcExamType');
      const examTypeId = examTypeSel?.value;
      const examDate = document.getElementById('rcExamDate')?.value;
      const sid = window._ppStudentId;
      const student = window._ppStudent;
      
      // FIX #3: Guard btn before accessing properties
      if (!examTypeId || !examDate || !sid || !student || !btn) return;

      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳ Preparing…';

      try {
        const course = (student.class_name || student.batch || '').toUpperCase();
        const examTypeName = examTypeSel.selectedOptions[0]?.textContent || 'Examination';

        const { data: sched } = await supabase
          .from('exam_schedule')
          .select('id, subject, total_marks')
          .eq('exam_type_id', examTypeId)
          .eq('course', course);

        let subjects = [], subjectMaxMap = {}, courseMax = 0;
        if (sched && sched.length) {
          subjects = sched.map(s => s.subject);
          sched.forEach(s => { subjectMaxMap[s.subject] = Number(s.total_marks) || 100; });
          courseMax = sched.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0);
        } else {
          const { data: csSetting } = await supabase.from('system_settings').select('value').eq('key', 'course_subjects').maybeSingle();
          let cfg = {};
          try { cfg = JSON.parse(csSetting?.value || '{}'); } catch (_) {}
          subjects = cfg[course] || [];
          subjectMaxMap = RC_COURSE_MAX_MARKS[course] || {};
          courseMax = Object.values(subjectMaxMap).reduce((s, v) => s + v, 0) || 100;
        }

        const { data: classmates } = await supabase
          .from('students')
          .select('id, name, gcc_no, class_name, course, admission_no')
          .ilike('class_name', course);
        const allStudents = (classmates && classmates.length) ? classmates : [student];

        const ids = allStudents.map(s => s.id);
        const [{ data: schedRows }, { data: markRows }] = await Promise.all([
          supabase.from('exam_schedule').select('id, subject').eq('exam_type_id', examTypeId).eq('course', course),
          supabase.from('exam_marks').select('student_id, exam_id, subject, marks_obtained, exam_date').eq('exam_type_id', examTypeId).in('student_id', ids),
        ]);
        const examIdToSubject = {};
        (schedRows || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
        const marksMap = {};
        (markRows || []).forEach(r => {
          if ((r.exam_date || '').slice(0, 10) !== examDate) return;
          const sub = examIdToSubject[r.exam_id] || r.subject;
          if (sub) marksMap[`${r.student_id}-${sub}`] = r.marks_obtained;
        });

        const { data: remarkRow } = await supabase.from('exam_remarks').select('remark')
          .eq('student_id', sid).eq('exam_type_id', examTypeId).eq('exam_date', examDate).maybeSingle();
        const remarkText = remarkRow?.remark || '';

        const { data: instSetting } = await supabase.from('system_settings').select('value').eq('key', 'exam_institute_config').maybeSingle();
        let institute = { name: 'Guidance Navodaya & Sainik Institute', address: 'Khangabok, Thoubal, Manipur', academicYear: '2026-2027' };
        try { institute = { ...institute, ...JSON.parse(instSetting?.value || '{}') }; } catch (_) {}

        const html = buildRCHTML(student, subjects, subjectMaxMap, courseMax, marksMap, allStudents, examTypeName, examDate, institute, remarkText);

        let overlay = document.getElementById('rcPrintOverlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'rcPrintOverlay';
          overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;min-height:100vh;z-index:99999;background:#f4f4f4;';
          document.body.appendChild(overlay);
          document.body.style.overflow = 'hidden';
          window.scrollTo(0, 0);

          if (!document.getElementById('rcPrintStyles')) {
            const styleTag = document.createElement('style');
            styleTag.id = 'rcPrintStyles';
            styleTag.textContent = `
              @media print {
                body > *:not(#rcPrintOverlay) { display: none !important; }
                #rcPrintOverlay .no-print { display: none !important; }
              }
            `;
            document.head.appendChild(styleTag);
          }
        }
        overlay.innerHTML = `
          <style>${RC_CSS}</style>
          <div class="no-print" style="position:sticky;top:0;z-index:2;background:#0B1F3A;padding:.8rem 1.2rem;display:flex;gap:.6rem;justify-content:flex-end;box-shadow:0 2px 10px rgba(0,0,0,.2);">
            <button onclick="window.print()" style="padding:.6rem 1.2rem;background:#B8922A;color:#0B1F3A;border:none;font-weight:700;cursor:pointer;border-radius:4px;">🖨️ Print / Save as PDF</button>
            <button onclick="document.getElementById('rcPrintOverlay').remove();document.body.style.overflow='';" style="padding:.6rem 1.2rem;background:transparent;color:#F8F3E8;border:1px solid #B8922A;cursor:pointer;border-radius:4px;">✕ Close</button>
          </div>
          ${html}
        `;
        overlay.scrollTop = 0;
      } catch (e) {
        console.error('Report card generation failed:', e);
        alert('Could not generate the report card: ' + (e?.message || 'unknown error') + '. Please try again or contact support.');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = origText;
        }
      }
    };

    // ── TAB: NOTICES ─────────────────────────────────────────────────────────

    async function ppLoadNotices() {
      const el = document.getElementById('noticeList');
      if (!el) return;
      el.innerHTML = '<div class="pp-loading"><div class="spin"></div>Loading…</div>';

      try {
        const { data } = await supabase
          .from('notices')
          .select('title, body, priority, notice_date')
          .eq('is_archived', false)
          .order('notice_date', { ascending: false })
          .limit(15);

        const rows = data || [];
        if (!rows.length) {
          el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">📣</div><p>No notices</p></div>';
          return;
        }
        el.innerHTML = rows.map(n => {
          const priCls = n.priority === 'High' ? 'pri-h' : n.priority === 'Medium' ? 'pri-m' : 'pri-l';
          return `<div class="pp-ni">
            <span class="pp-npri ${priCls}">${n.priority || 'Low'}</span>
            <div class="pp-ntitle">${n.title}</div>
            <div class="pp-nbody">${n.body || ''}</div>
            <div class="pp-ndate">${n.notice_date || ''}</div>
          </div>`;
        }).join('');
      } catch (e) {
        console.error('Notices load failed:', e);
        el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Failed to load notices</p></div>';
      }
    }

    // ── TAB: HOSTEL LEAVE ────────────────────────────────────────────────────

    async function ppLoadLeave(studentId) {
      const el = document.getElementById('leaveList');
      if (!el) return;
      el.innerHTML = '<div class="pp-loading"><div class="spin"></div>Loading…</div>';

      try {
        const { data } = await supabase
          .from('leave_requests')
          .select('from_date, to_date, reason, status, created_at')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false })
          .limit(20);

        const rows = data || [];
        if (!rows.length) {
          el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">🏠</div><p>No leave history</p></div>';
          return;
        }
        el.innerHTML = rows.map(r => {
          const stCls = r.status === 'approved' ? 'ls-ap' : r.status === 'rejected' ? 'ls-re' : 'ls-pe';
          return `<div class="leave-item">
            <div class="leave-hd">
              <span>${r.from_date} → ${r.to_date}</span>
              <span class="ls ${stCls}">${r.status || 'pending'}</span>
            </div>
            <div class="leave-rsn">${r.reason || '—'}</div>
          </div>`;
        }).join('');
      } catch (e) {
        console.error('Leave load failed:', e);
        el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Failed to load leave history</p></div>';
      }
    }

    // ── TAB: ALERTS ──────────────────────────────────────────────────────────

    async function ppLoadAlerts(studentId) {
      const el = document.getElementById('alertList');
      if (!el) return;
      el.innerHTML = '<div class="pp-loading"><div class="spin"></div>Loading…</div>';

      try {
        const [attRes, examRes] = await Promise.all([
          supabase
            .from('attendance')
            .select('date, status')
            .eq('student_id', studentId)
            .eq('status', 'Absent')
            .order('date', { ascending: false })
            .limit(5),
          supabase
            .from('exam_marks')
            .select('exam_type_id, marks_obtained, total_marks, exam_date')
            .eq('student_id', studentId)
            .order('exam_date', { ascending: false })
            .limit(20),
        ]);

        const examRows = examRes.data || [];
        const typeIds  = [...new Set(examRows.map(r => r.exam_type_id).filter(Boolean))];
        const { data: types } = typeIds.length
          ? await supabase.from('exam_types').select('id, name').in('id', typeIds)
          : { data: [] };
        const typeMap = Object.fromEntries((types || []).map(t => [t.id, t.name]));

        const alerts = [];
        (attRes.data || []).forEach(r => {
          alerts.push({ type: 'att', msg: `Absent on ${r.date}`, date: r.date });
        });
        examRows.forEach(r => {
          const total = r.total_marks;
          const pct   = total ? Math.round((r.marks_obtained / total) * 100) : null;
          if (pct !== null && pct < 50) {
            const name = typeMap[r.exam_type_id] || 'Exam';
            alerts.push({ type: 'exam', msg: `Low score in ${name}: ${r.marks_obtained}/${total} (${pct}%)`, date: r.exam_date });
          }
        });

        if (!alerts.length) {
          el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">✅</div><p>No alerts — all good!</p></div>';
          return;
        }
        el.innerHTML = alerts.map(a => `
          <div class="alert-item ${a.type}">
            <div class="alert-msg">${a.msg}</div>
            <div class="alert-meta">${a.date ? a.date.slice(0, 10) : ''}</div>
          </div>`).join('');
      } catch (e) {
        console.error('Alerts load failed:', e);
        el.innerHTML = '<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Failed to load alerts</p></div>';
      }
    }
    
    // Form submissions (mock) 
    window.fetchAdmitCard = () => {
      const res = document.getElementById('acResult');
      const data = document.getElementById('acData');
      const roll = document.getElementById('acRoll')?.value || '—';
      const exam = document.getElementById('acExam')?.value || '—';
      if (res && data) {
        res.classList.add('show', 'ok');
        data.innerHTML = '<div class="portal-row"><span>Student</span><strong>GNSI Student</strong></div>' +
          '<div class="portal-row"><span>Roll No</span><strong>' + roll + '</strong></div>' +
          '<div class="portal-row"><span>Exam</span><strong>' + exam + '</strong></div>' +
          '<div class="portal-row"><span>Date</span><strong>This Sunday</strong></div>' +
          '<div class="portal-row"><span>Time</span><strong>10:00 AM</strong></div>' +
          '<div class="portal-row"><span>Venue</span><strong>GNSI Campus, Khangabok</strong></div>';
      }
    };
    window.fetchResult = () => {
      const res = document.getElementById('rcResult');
      const data = document.getElementById('rcData');
      const roll = document.getElementById('rcRoll')?.value || '—';
      if (res && data) {
        res.classList.add('show', 'ok');
        data.innerHTML = '<div class="portal-row"><span>Student</span><strong>GNSI Student</strong></div>' +
          '<div class="portal-row"><span>Roll No</span><strong>' + roll + '</strong></div>' +
          '<div class="portal-row"><span>Total Marks</span><strong>87 / 100</strong></div>' +
          '<div class="portal-row"><span>Rank</span><strong>5th</strong></div>' +
          '<div class="portal-row"><span>Status</span><strong style="color:#4AE382">Passed</strong></div>';
      }
    };
    window.printAdmitCard = () => {
      window.print();
    };

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
    content="GNSI is Manipur's premier residential coaching institute for Navodaya Vidyalaya (NVS), Sainik School and RMS entrance exams. 95% selection rate, 200+ officers produced. Khangabok, Thoubal District."
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
    content="Manipur's premier coaching for NVS, Sainik School & RMS. 95% selection rate. 200+ officers produced. Admissions open 2026–27."
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
  <meta name="theme-color" content="#0B1F3A" />
  <link rel="canonical" href="https://guidancekhangabok.in" />
  <link
    rel="icon"
    href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%230B1F3A'/><text y='.9em' font-size='60' x='50%' text-anchor='middle' fill='%23B8922A' font-family='Georgia'>G</text></svg>"
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
  <link
    href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Source+Sans+3:wght@300;400;600;700&family=Rajdhani:wght@500;600;700&display=swap"
    rel="stylesheet"
  />
  <style
    dangerouslySetInnerHTML={{
      __html:
        "\n:root{\n  --navy:#0B1F3A;--navy2:#0F2A4E;--navy3:#153561;--navy4:#1B4080;\n  --gold:#B8922A;--goldL:#D4AE50;--goldLL:#EDD180;--goldD:#7A5E12;\n  --saffron:#CF5A0D;--cream:#F8F3E8;--creamD:#EDE5CE;--creamDD:#D4C9A8;\n  --slate:#3D4F6B;--mist:#7A8FA8;--white:#FAFBFC;\n  --red:#8B1A1A;--green:#1A5C2A;--wa:#25D366;\n}\n*{box-sizing:border-box;margin:0;padding:0}\nhtml{scroll-behavior:smooth;font-size:clamp(15px,2.2vw,18px)}\nbody{font-family:'Source Sans 3',sans-serif;background:var(--white);color:var(--navy);overflow-x:hidden;font-size:clamp(0.95rem,2.5vw,1.05rem)}\nh1,h2,h3,h4,h5{font-family:'EB Garamond',serif;line-height:1.1}\na{text-decoration:none;color:inherit}\nimg{max-width:100%;display:block}\n.container{width:min(1200px,92%);margin:auto}\n\n/* ═══ TOP CONTACT BAR ═══ */\n.top-bar{background:var(--navy2);border-bottom:1px solid rgba(184,146,42,.15);padding:.45rem 5%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem}\n.top-bar-left{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}\n.top-bar-item{display:flex;align-items:center;gap:.4rem;color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(.65rem,1.8vw,.75rem);letter-spacing:.06em;text-decoration:none;transition:.2s}\n.top-bar-item:hover{color:var(--goldL)}\n.top-bar-item span{color:var(--goldL);font-size:.8rem}\n.top-bar-right{display:flex;align-items:center;gap:.8rem}\n.top-bar-hours{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(.62rem,1.7vw,.72rem);letter-spacing:.06em;text-transform:uppercase}\n.top-bar-social{display:flex;gap:.4rem}\n.top-bar-soc{width:22px;height:22px;border:1px solid rgba(184,146,42,.2);display:flex;align-items:center;justify-content:center;color:rgba(248,243,232,.85);font-size:.6rem;font-weight:700;font-family:'Rajdhani',sans-serif;transition:.2s;text-decoration:none}\n.top-bar-soc:hover{border-color:var(--goldL);color:var(--goldL)}\n\n/* ═══ HERO RESULT BANNER SLIDER ═══ */\n.result-banner{background:var(--navy);border-bottom:2px solid var(--gold);overflow:hidden;position:relative}\n.result-banner-track{display:flex;transition:transform .7s cubic-bezier(.25,.46,.45,.94)}\n.result-banner-slide{min-width:100%;position:relative;height:clamp(180px,35vw,320px);display:flex;align-items:center;overflow:hidden}\n.result-banner-slide img{width:100%;height:100%;object-fit:cover;opacity:.55}\n.result-banner-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,31,58,.92) 0%,rgba(11,31,58,.6) 50%,rgba(11,31,58,.2) 100%);display:flex;align-items:center;padding:0 8%}\n.result-banner-content{max-width:600px}\n.result-banner-year{font-family:'Rajdhani',sans-serif;font-size:clamp(.72rem,2vw,.82rem);letter-spacing:.25em;text-transform:uppercase;color:var(--goldL);margin-bottom:.5rem}\n.result-banner-title{font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,2.8rem);color:var(--cream);line-height:1.1;margin-bottom:.6rem}\n.result-banner-title strong{color:var(--goldLL)}\n.result-banner-sub{color:rgba(248,243,232,.85);font-size:clamp(.82rem,2.2vw,.95rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em}\n.result-banner-nav{position:absolute;bottom:.8rem;right:1.5rem;display:flex;gap:0}\n.rb-dot{width:6px;height:6px;border-radius:50%;background:rgba(248,243,232,.85);border:1px solid rgba(184,146,42,.3);cursor:pointer;transition:.2s;background-clip:content-box;padding:7px;box-sizing:content-box}\n.rb-dot.active{background:var(--gold);border-color:var(--gold)}\n.rb-prev,.rb-next{position:absolute;top:50%;transform:translateY(-50%);width:32px;height:32px;background:rgba(11,31,58,.7);border:1px solid rgba(184,146,42,.3);color:var(--goldL);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;transition:.2s;z-index:5}\n.rb-prev{left:.8rem}.rb-next{right:.8rem}\n.rb-prev:hover,.rb-next:hover{background:rgba(184,146,42,.2)}\n\n/* ═══ RESULT BANNER — NO-PHOTO FALLBACK CARDS ═══ */\n.result-banner-slide.no-photo{background:linear-gradient(135deg,var(--navy3),var(--navy))}.result-banner-slide.no-photo::before{content:'';position:absolute;inset:0;opacity:.05;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 26px)}.rb-ghost{position:absolute;right:4%;top:50%;transform:translateY(-50%);font-family:'EB Garamond',serif;font-weight:600;font-size:clamp(6rem,15vw,11rem);color:rgba(212,174,80,.12);line-height:1;letter-spacing:-.02em;user-select:none;pointer-events:none;white-space:nowrap;z-index:0}.rb-icon{font-size:2rem;margin-bottom:.55rem;display:block}.result-banner-content{position:relative;z-index:1}\n\n/* ═══ SCHOLARSHIP / FREE TEST ═══ */\n.scholar-section{background:linear-gradient(135deg,var(--navy3),var(--navy));padding:4.8rem 0;position:relative;overflow:hidden}\n.scholar-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(60deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 30px)}\n.scholar-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start}\n.scholar-info .eyebrow{color:var(--goldL)}\n.scholar-info .eyebrow::before{background:var(--gold)}\n.scholar-info h2.st{color:var(--cream)}\n.scholar-info p{color:rgba(248,243,232,.85);line-height:1.85;font-size:clamp(.9rem,2.4vw,.97rem);margin-bottom:1.2rem}\n.scholar-benefits{list-style:none;margin-bottom:1.5rem}\n.scholar-benefits li{color:rgba(248,243,232,.85);font-size:clamp(.85rem,2.3vw,.92rem);padding:.45rem 0;border-bottom:1px solid rgba(184,146,42,.1);display:flex;align-items:center;gap:.6rem}\n.scholar-benefits li::before{content:'✦';color:var(--gold);font-size:.7rem;flex-shrink:0}\n.scholar-form-box{background:rgba(11,31,58,.7);border:1px solid rgba(184,146,42,.25);padding:1.8rem}\n.scholar-form-box h3{color:var(--goldL);font-family:'EB Garamond',serif;font-size:clamp(1.1rem,3vw,1.4rem);margin-bottom:.4rem}\n.scholar-form-box p{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.2rem}\n.scholar-label{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.65rem,1.8vw,.72rem);letter-spacing:.14em;text-transform:uppercase;color:rgba(248,243,232,.85);margin-bottom:.35rem}\n.scholar-input{width:100%;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(184,146,42,.2);color:var(--cream);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1rem;transition:.2s}\n.scholar-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}\n.scholar-select{width:100%;padding:10px 14px;background:var(--navy2);border:1px solid rgba(184,146,42,.2);color:var(--cream);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1rem}\n.scholar-btn{width:100%;padding:.9rem;background:var(--gold);color:var(--navy);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.85rem,2.4vw,.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s}\n.scholar-btn:hover{background:var(--goldL)}\n.scholar-msg{padding:.6rem 1rem;margin-bottom:.8rem;font-size:clamp(.8rem,2.2vw,.88rem);font-family:'Rajdhani',sans-serif;display:none}\n.scholar-msg.ok{background:rgba(26,92,42,.3);color:#4AE382;border:1px solid rgba(26,92,42,.4)}\n.scholar-msg.err{background:rgba(139,26,26,.25);color:#f87171;border:1px solid rgba(139,26,26,.4)}\n.test-dates{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:1.2rem}\n.test-date-card{background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.15);padding:.7rem .9rem;text-align:center}\n.test-date-card .tdate{display:block;font-family:'EB Garamond',serif;font-size:clamp(1rem,2.8vw,1.2rem);color:var(--goldLL);line-height:1}\n.test-date-card .tlabel{font-family:'Rajdhani',sans-serif;font-size:clamp(.62rem,1.7vw,.7rem);letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.85);margin-top:.2rem;display:block}\n\n/* ═══ QUESTION PAPERS ═══ */\n.papers-section{padding:4.8rem 0;background:var(--cream)}\n.papers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem;margin-top:1.5rem}\n.papers-card{background:var(--white);border:1px solid var(--creamDD);border-top:3px solid var(--navy3);padding:1.4rem;transition:.25s}\n.papers-card.sainik{border-top-color:var(--red)}\n.papers-card.nvs{border-top-color:var(--navy3)}\n.papers-card.rms{border-top-color:var(--green)}\n.papers-card:hover{box-shadow:0 8px 24px rgba(11,31,58,.1);transform:translateY(-3px)}\n.papers-card h3{color:var(--navy);font-size:clamp(1rem,2.8vw,1.15rem);margin-bottom:.3rem}\n.papers-card .papers-sub{color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.08em;text-transform:uppercase;margin-bottom:1rem}\n.paper-link{display:flex;align-items:center;justify-content:space-between;padding:.5rem .7rem;border:1px solid var(--creamDD);margin-bottom:.4rem;background:var(--cream);transition:.2s;text-decoration:none;color:var(--navy)}\n.paper-link:hover{background:var(--gold);border-color:var(--gold);color:var(--navy)}\n.paper-link:hover .paper-dl{color:var(--navy)}\n.paper-name{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:clamp(.78rem,2.1vw,.85rem);letter-spacing:.04em}\n.paper-dl{color:var(--goldD);font-size:.9rem;transition:.2s}\n.papers-note{color:var(--mist);font-size:clamp(.72rem,2vw,.8rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em;margin-top:.8rem;line-height:1.6}\n.papers-cta{margin-top:1rem;display:block;width:100%;padding:.6rem;background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.2s;text-align:center;border:none}\n.papers-cta:hover{background:var(--navy3)}\n\n/* ═══ SYLLABUS ═══ */\n.syllabus-section{padding:4.8rem 0;background:var(--white)}\n.syllabus-tabs{display:flex;gap:.4rem;margin-bottom:1.5rem;flex-wrap:wrap}\n.syl-tab{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.82rem);letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1.1rem;border:1px solid var(--creamDD);background:transparent;color:var(--slate);cursor:pointer;transition:.2s}\n.syl-tab.active{background:var(--navy);color:var(--goldL);border-color:var(--navy)}\n.syl-tab:hover:not(.active){border-color:var(--gold);color:var(--goldD)}\n.syl-panel{display:none}.syl-panel.active{display:block}\n.syl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}\n.syl-card{background:var(--cream);border:1px solid var(--creamDD);border-left:3px solid var(--gold);padding:1.2rem}\n.syl-card h4{color:var(--navy);font-size:clamp(.95rem,2.6vw,1.05rem);margin-bottom:.7rem;display:flex;align-items:center;gap:.5rem}\n.syl-card h4 span{font-size:1.1rem}\n.syl-topics{list-style:none}\n.syl-topics li{color:var(--slate);font-size:clamp(.8rem,2.2vw,.87rem);padding:.25rem 0;border-bottom:1px solid var(--creamDD);display:flex;align-items:center;gap:.4rem}\n.syl-topics li:last-child{border:none}\n.syl-topics li::before{content:'▸';color:var(--gold);font-size:.7rem;flex-shrink:0}\n.syl-marks{display:inline-block;background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.1em;padding:.15rem .4rem;margin-left:.4rem;vertical-align:middle}\n.syl-download{display:flex;align-items:center;gap:.5rem;margin-top:1.2rem;padding:.55rem 1rem;background:var(--cream);border:1px solid var(--creamDD);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.2s;text-decoration:none;display:inline-flex}\n.syl-download:hover{background:var(--gold);border-color:var(--gold)}\n\n/* ═══ LANGUAGE TOGGLE ═══ */\n#langBar{background:rgba(11,31,58,.98);border-bottom:1px solid rgba(184,146,42,.12);padding:.3rem 5%;display:flex;align-items:center;justify-content:flex-end;gap:.6rem}\n.lang-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;padding:.28rem .75rem;border:1px solid rgba(184,146,42,.25);background:transparent;color:rgba(248,243,232,.85);cursor:pointer;transition:.2s}\n.lang-btn.active{background:var(--gold);color:var(--navy);border-color:var(--gold)}\n.lang-btn:hover:not(.active){border-color:var(--goldL);color:var(--goldL)}\n[data-hi]{display:none}\nbody.hi [data-en]{display:none}\nbody.hi [data-hi]{display:block}\nbody.hi span[data-hi]{display:inline}\nbody.hi span[data-en]{display:none}\n\n/* ═══ ADMIT CARD PORTAL ═══ */\n.portal-section{background:var(--white);padding:4.8rem 0;position:relative;overflow:hidden}\n.portal-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 28px)}\n.portal-grid{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-top:2rem}\n.portal-box{background:var(--cream);border:1px solid var(--creamDD);padding:1.8rem;transition:.2s}\n.portal-box:hover{border-color:var(--gold)}\n.portal-box-hd{display:flex;align-items:center;gap:.8rem;margin-bottom:1.2rem}\n.portal-icon{width:42px;height:42px;background:rgba(184,146,42,.12);border:1px solid rgba(184,146,42,.3);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}\n.portal-box-hd h3{color:var(--navy);font-size:clamp(1rem,2.8vw,1.15rem)}\n.portal-box-hd p{color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.06em;text-transform:uppercase}\n.portal-input{width:100%;padding:11px 14px;background:var(--white);border:1px solid var(--creamDD);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.8rem;transition:.2s}\n.portal-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}\n.portal-input::placeholder{color:var(--mist)}\n.portal-select{width:100%;padding:11px 14px;background:var(--white);border:1px solid var(--creamDD);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.8rem}\n.portal-btn{width:100%;padding:.85rem;background:var(--gold);color:var(--navy);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.85rem,2.4vw,.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s}\n.portal-btn:hover{background:var(--goldL)}\n.portal-btn:disabled{opacity:.5;cursor:not-allowed}\n.portal-result{margin-top:1rem;padding:1rem;border:1px solid var(--creamDD);background:var(--white);display:none}\n.portal-result.show{display:block}\n.portal-result.ok{border-color:rgba(26,92,42,.3);background:rgba(26,92,42,.06)}\n.portal-result.err{border-color:rgba(139,26,26,.3);background:rgba(139,26,26,.06)}\n.portal-result h4{color:var(--goldD);font-size:clamp(.92rem,2.5vw,1rem);margin-bottom:.6rem}\n.portal-row{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid var(--creamDD);font-size:clamp(.78rem,2.1vw,.85rem)}\n.portal-row:last-child{border:none}\n.portal-row span{color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.06em;text-transform:uppercase}\n.portal-row strong{color:var(--navy)}\n.admit-download{display:flex;width:100%;margin-top:.9rem;padding:.7rem;background:var(--green);color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.78rem,2.1vw,.85rem);letter-spacing:.1em;text-transform:uppercase;border:none;cursor:pointer;transition:.2s;align-items:center;justify-content:center;gap:.5rem}\n.admit-download:hover{background:#1e7a34}\n\n/* ═══ EXAM CALENDAR ═══ */\n.calendar-section{padding:4.8rem 0;background:var(--cream)}\n.cal-table-wrap{overflow-x:auto;margin-top:1.5rem}\n.cal-table{width:100%;border-collapse:collapse;min-width:600px}\n.cal-table th{background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.68rem,1.8vw,.78rem);letter-spacing:.12em;text-transform:uppercase;padding:.75rem 1rem;text-align:left;border-bottom:2px solid var(--gold)}\n.cal-table td{padding:.7rem 1rem;border-bottom:1px solid var(--creamDD);font-size:clamp(.8rem,2.2vw,.88rem);color:var(--slate);vertical-align:middle}\n.cal-table tr:hover td{background:rgba(184,146,42,.05)}\n.cal-table tr:last-child td{border:none}\n.cal-exam{font-weight:600;color:var(--navy);font-family:'Rajdhani',sans-serif;letter-spacing:.04em}\n.cal-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.15rem .5rem;border-radius:2px}\n.cb-nvs{background:rgba(21,53,97,.12);color:var(--navy3);border:1px solid rgba(21,53,97,.2)}\n.cb-sainik{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.2)}\n.cb-rms{background:rgba(26,92,42,.1);color:var(--green);border:1px solid rgba(26,92,42,.2)}\n.cb-gnsi{background:rgba(184,146,42,.15);color:var(--goldD);border:1px solid rgba(184,146,42,.25)}\n.cal-status{display:inline-flex;align-items:center;gap:.3rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase}\n.cs-upcoming{color:var(--green)}\n.cs-open{color:var(--gold)}\n.cs-closed{color:var(--mist)}\n.cs-done{color:#f87171}\n.cal-download{display:inline-flex;align-items:center;gap:.4rem;margin-top:1.2rem;padding:.5rem 1.2rem;background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.1em;text-transform:uppercase;border:none;cursor:pointer;transition:.2s;text-decoration:none}\n.cal-download:hover{background:var(--navy3)}\n\n/* ═══ IMPORTANT DATES TIMELINE ═══ */\n.timeline-section{padding:4.8rem 0;background:var(--white)}\n.timeline{position:relative;max-width:860px;margin-top:2rem}\n.timeline::before{content:'';position:absolute;left:110px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--gold),rgba(184,146,42,.1))}\n.tl-item{display:flex;gap:1.5rem;margin-bottom:1.5rem;position:relative;align-items:flex-start}\n.tl-date{min-width:100px;text-align:right;flex-shrink:0}\n.tl-month{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.82rem);letter-spacing:.12em;text-transform:uppercase;color:var(--mist)}\n.tl-day{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.2rem,3vw,1.5rem);color:var(--navy);line-height:1}\n.tl-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--gold);background:var(--white);flex-shrink:0;margin-top:.35rem;position:relative;z-index:2;transition:.2s}\n.tl-item:hover .tl-dot{background:var(--gold)}\n.tl-dot.done{background:var(--creamDD);border-color:var(--creamDD)}\n.tl-dot.open{background:var(--gold);border-color:var(--gold);box-shadow:0 0 0 4px rgba(184,146,42,.2)}\n.tl-dot.upcoming{background:var(--white);border-color:var(--navy3)}\n.tl-content{flex:1;padding:.6rem .9rem;border:1px solid var(--creamDD);border-left:3px solid var(--creamDD);background:var(--white);transition:.25s}\n.tl-item:hover .tl-content{border-left-color:var(--gold);box-shadow:4px 0 12px rgba(184,146,42,.08)}\n.tl-content.open{border-left-color:var(--gold);background:rgba(184,146,42,.03)}\n.tl-content.done{opacity:.6}\n.tl-content h4{color:var(--navy);font-size:clamp(.9rem,2.4vw,1rem);margin-bottom:.2rem}\n.tl-content p{color:var(--slate);font-size:clamp(.78rem,2.1vw,.85rem);line-height:1.6}\n.tl-tag{display:inline-block;margin-top:.4rem}\n\n/* ═══ MOCK TEST ═══ */\n.mocktest-section{background:linear-gradient(135deg,var(--navy2),var(--navy3));padding:4.8rem 0;position:relative;overflow:hidden}\n.mocktest-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(135deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 25px)}\n.mocktest-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start}\n.mock-cards{display:flex;flex-direction:column;gap:.75rem}\n.mock-card{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.18);padding:1.1rem 1.3rem;display:flex;align-items:center;gap:1rem;transition:.25s;cursor:pointer;text-decoration:none}\n.mock-card:hover{border-color:var(--gold);transform:translateX(4px);background:rgba(21,53,97,.8)}\n.mock-icon{width:44px;height:44px;background:rgba(184,146,42,.15);border:1px solid rgba(184,146,42,.25);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}\n.mock-card-title{color:var(--cream);font-size:clamp(.88rem,2.4vw,.97rem);margin-bottom:.2rem}\n.mock-card-sub{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(.65rem,1.8vw,.72rem);letter-spacing:.08em;text-transform:uppercase}\n.mock-card-arrow{color:var(--goldL);font-size:1rem;margin-left:auto;flex-shrink:0}\n.mock-info h3{color:var(--goldL);font-size:clamp(1.1rem,3vw,1.4rem);margin-bottom:.8rem}\n.mock-info p{color:rgba(248,243,232,.85);line-height:1.85;font-size:clamp(.88rem,2.3vw,.95rem);margin-bottom:1.2rem}\n.mock-features{list-style:none;margin-bottom:1.5rem}\n.mock-features li{color:rgba(248,243,232,.85);font-size:clamp(.85rem,2.3vw,.92rem);padding:.4rem 0;border-bottom:1px solid rgba(184,146,42,.1);display:flex;align-items:center;gap:.6rem}\n.mock-features li::before{content:'✦';color:var(--gold);font-size:.7rem;flex-shrink:0}\n\n/* ═══ APP DOWNLOAD ═══ */\n.app-section{background:var(--white);padding:4rem 0;border-top:1px solid var(--creamDD)}\n.app-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center}\n.app-info h2{color:var(--navy);font-size:clamp(1.4rem,3.5vw,2rem);margin-bottom:.7rem}\n.app-info p{color:var(--slate);line-height:1.85;font-size:clamp(.88rem,2.3vw,.95rem);margin-bottom:1.4rem}\n.app-features{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:1.5rem}\n.app-feat{background:var(--cream);border:1px solid var(--creamDD);padding:.6rem .8rem;font-family:'Rajdhani',sans-serif;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.05em;color:var(--slate);display:flex;align-items:center;gap:.4rem}\n.app-btns{display:flex;gap:.8rem;flex-wrap:wrap}\n.app-btn{display:inline-flex;align-items:center;gap:.7rem;padding:.75rem 1.3rem;border:1px solid var(--creamDD);background:var(--cream);color:var(--navy);text-decoration:none;transition:.25s}\n.app-btn:hover{border-color:var(--gold);background:rgba(184,146,42,.08)}\n.app-btn-icon{font-size:1.4rem;flex-shrink:0}\n.app-btn-txt small{display:block;font-family:'Rajdhani',sans-serif;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mist);margin-bottom:.1rem}\n.app-btn-txt strong{display:block;font-size:clamp(.85rem,2.3vw,.95rem);font-weight:600}\n.app-mockup{background:var(--cream);border:1px solid var(--creamDD);padding:2rem;text-align:center;position:relative}\n.app-screen{background:var(--navy2);border:2px solid rgba(184,146,42,.25);border-radius:12px;padding:1.5rem;max-width:220px;margin:0 auto}\n.app-screen-hd{background:rgba(184,146,42,.15);border-bottom:1px solid rgba(184,146,42,.15);padding:.6rem .8rem;margin:-.5rem -.5rem .8rem;display:flex;align-items:center;gap:.5rem;border-radius:8px 8px 0 0}\n.app-screen-hd span{font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--goldL)}\n.app-screen-row{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid rgba(184,146,42,.08);font-size:.72rem}\n.app-screen-row span{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif}\n.app-screen-row strong{color:var(--goldLL);font-family:'Rajdhani',sans-serif}\n.app-qr{margin-top:1.2rem;padding:.8rem;background:var(--white);border:1px solid var(--creamDD);display:inline-block}\n.app-qr p{font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mist);margin-top:.4rem;text-align:center}\n\n/* ═══ GRIEVANCE / HELPDESK ═══ */\n.helpdesk-section{padding:4.8rem 0;background:var(--cream)}\n.helpdesk-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start}\n.helpdesk-info p{color:var(--slate);line-height:1.85;font-size:clamp(.9rem,2.4vw,.97rem);margin-bottom:1.2rem}\n.helpdesk-contacts{display:flex;flex-direction:column;gap:.7rem}\n.hc-item{background:var(--white);border:1px solid var(--creamDD);border-left:3px solid var(--gold);padding:.9rem 1rem;display:flex;align-items:center;gap:.9rem;transition:.2s}\n.hc-item:hover{box-shadow:4px 0 12px rgba(184,146,42,.1)}\n.hc-icon{font-size:1.3rem;flex-shrink:0}\n.hc-label{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.1em;text-transform:uppercase;color:var(--mist);display:block}\n.hc-val{color:var(--navy);font-size:clamp(.85rem,2.3vw,.92rem);font-weight:600}\n.hc-val a{color:var(--goldD);text-decoration:none}\n.hc-val a:hover{color:var(--gold)}\n.helpdesk-form{background:var(--white);border:1px solid var(--creamDD);padding:1.8rem}\n.helpdesk-form h3{color:var(--navy);font-size:clamp(1rem,2.8vw,1.15rem);margin-bottom:.3rem}\n.helpdesk-form p{color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.06em;margin-bottom:1.2rem}\n.grv-input{width:100%;padding:10px 14px;border:1px solid var(--creamDD);background:var(--cream);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.9rem;transition:.2s}\n.grv-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}\n.grv-select{width:100%;padding:10px 14px;border:1px solid var(--creamDD);background:var(--cream);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.9rem}\n.grv-textarea{width:100%;padding:10px 14px;border:1px solid var(--creamDD);background:var(--cream);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.9rem;min-height:90px;resize:vertical}\n.grv-btn{width:100%;padding:.85rem;background:var(--navy);color:var(--goldL);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.85rem,2.4vw,.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s}\n.grv-btn:hover{background:var(--navy3)}\n.grv-msg{padding:.6rem 1rem;margin-bottom:.8rem;font-size:clamp(.8rem,2.2vw,.88rem);font-family:'Rajdhani',sans-serif;display:none}\n.grv-msg.ok{background:#E8F4ED;color:var(--green);border:1px solid rgba(26,92,42,.3)}\n.grv-msg.err{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.3)}\n.ticket-id{font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.1em;color:var(--gold)}\n\n/* SCROLL REVEAL */\n.reveal{opacity:0;transform:translateY(28px);transition:opacity .4s ease,transform .65s ease}\n.reveal.vis{opacity:1;transform:none}\n.reveal-left{opacity:0;transform:translateX(-32px);transition:opacity .4s ease,transform .65s ease}\n.reveal-left.vis{opacity:1;transform:none}\n.reveal-right{opacity:0;transform:translateX(32px);transition:opacity .4s ease,transform .65s ease}\n.reveal-right.vis{opacity:1;transform:none}\n.reveal-scale{opacity:0;transform:scale(.94);transition:opacity .4s ease,transform .65s ease}\n.reveal-scale.vis{opacity:1;transform:scale(1)}\n\n/* SCROLL PROGRESS */\n#sp{position:fixed;top:0;left:0;z-index:9999;height:3px;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green));width:0%;transition:width .1s;pointer-events:none}\n\n/* STICKY APPLY BAR */\n#stickyBar{position:fixed;bottom:0;left:0;right:0;z-index:990;background:var(--navy);border-top:2px solid var(--gold);padding:.75rem 5%;display:flex;align-items:center;justify-content:space-between;transform:translateY(100%);transition:transform .4s cubic-bezier(.25,.46,.45,.94);gap:1rem;flex-wrap:wrap}\n#stickyBar.show{transform:translateY(0)}\n#stickyBar p{color:rgba(248,243,232,.85);font-size:clamp(0.78rem,2vw,0.88rem);font-family:'Rajdhani',sans-serif;letter-spacing:.04em}\n#stickyBar p strong{color:var(--goldL)}\n.sticky-btns{display:flex;gap:.6rem;align-items:center;flex-shrink:0}\n.sb-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.1rem;cursor:pointer;border:none;transition:.2s}\n.sb-btn-gold{background:var(--gold);color:var(--navy)}\n.sb-btn-gold:hover{background:var(--goldL)}\n.sb-btn-wa{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.3)!important;color:#4AE382}\n.sb-close{background:none;border:none;color:rgba(248,243,232,.85);cursor:pointer;font-size:1.1rem;padding:.2rem .4rem;flex-shrink:0}\n\n/* ALERT */\n.alert-strip{background:var(--red);color:#fff;font-size:clamp(0.78rem,2.2vw,0.88rem);letter-spacing:.04em;padding:.55rem 5%;display:flex;justify-content:space-between;align-items:center;font-family:'Rajdhani',sans-serif;font-weight:600;text-transform:uppercase}\n.alert-strip button{background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0}\n\n/* TICKER */\n.ticker-wrap{background:var(--navy);overflow:hidden;border-bottom:2px solid var(--gold)}\n.ticker-inner{display:flex;align-items:center;height:36px}\n.ticker-label{background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.15em;text-transform:uppercase;padding:0 1.2rem;height:100%;display:flex;align-items:center;white-space:nowrap;flex-shrink:0}\n.ticker-scroll{overflow:hidden;flex:1}\n.ticker-track{display:inline-block;min-width:200%;animation:tkscroll 38s linear infinite;color:var(--goldLL);font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.14em;font-family:'Rajdhani',sans-serif;font-weight:500;white-space:nowrap;padding-left:2rem}\n@keyframes tkscroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}\n\n/* ═══ COUNTDOWN TIMER ═══ */\n.countdown-bar{background:linear-gradient(135deg,var(--navy3),var(--navy));border-bottom:1px solid rgba(184,146,42,.3);padding:.9rem 5%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.8rem}\n.countdown-label{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.78rem,2.2vw,0.88rem);letter-spacing:.15em;text-transform:uppercase;display:flex;align-items:center;gap:.5rem}\n.countdown-label::before{content:'⚑';color:var(--saffron)}\n.countdown-units{display:flex;gap:.5rem;align-items:center}\n.cd-unit{background:rgba(11,31,58,.8);border:1px solid rgba(184,146,42,.3);padding:.35rem .6rem;text-align:center;min-width:52px}\n.cd-num{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.3rem,3.5vw,1.8rem);color:var(--goldLL);line-height:1;font-weight:700}\n.cd-lbl{display:block;font-family:'Rajdhani',sans-serif;font-size:clamp(0.55rem,1.5vw,0.65rem);color:rgba(248,243,232,.85);letter-spacing:.1em;text-transform:uppercase}\n.cd-sep{color:var(--gold);font-size:1.2rem;font-weight:700;align-self:flex-start;padding-top:.35rem}\n.countdown-cta{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1.1rem;background:var(--gold);color:var(--navy);border:none;cursor:pointer;transition:.2s;white-space:nowrap}\n.countdown-cta:hover{background:var(--goldL)}\n\n/* NAV */\nnav{position:sticky;top:0;z-index:1000;background:rgba(11,31,58,.97);backdrop-filter:blur(16px);border-bottom:1px solid rgba(184,146,42,.3)}\n.nav-inner{width:min(1200px,92%);margin:auto;height:70px;display:flex;align-items:center;justify-content:space-between}\n.brand{display:flex;align-items:center;gap:14px;text-decoration:none}\n.crest{width:46px;height:46px;border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}\n.crest-i{width:32px;height:32px;border:1px solid rgba(184,146,42,.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-weight:700;font-size:1rem;color:var(--goldL)}\n.brand-text h2{font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--cream);font-size:clamp(0.9rem,2.5vw,1rem);letter-spacing:.12em;text-transform:uppercase}\n.brand-text small{display:block;color:var(--goldL);font-size:clamp(0.58rem,1.5vw,0.65rem);letter-spacing:.2em;text-transform:uppercase;opacity:.8}\n.nav-links{display:flex;list-style:none;gap:.15rem;align-items:center;flex-wrap:nowrap}\n.nav-links li{flex-shrink:0}\n.nav-links a{color:rgba(248,243,232,.85);font-size:clamp(0.6rem,1.1vw,0.74rem);text-transform:uppercase;letter-spacing:.05em;font-family:'Rajdhani',sans-serif;font-weight:600;padding:.3rem .4rem;transition:.2s;position:relative;white-space:nowrap;display:inline-block}\n.nav-links a::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transition:.2s}\n.nav-links a:hover{color:var(--goldLL)}\n.nav-links a:hover::after{transform:scaleX(1)}\n.nav-btn{background:transparent;border:1px solid rgba(184,146,42,.4)!important;color:var(--goldL)!important;padding:.4rem .7rem!important;font-weight:700!important;opacity:1!important;cursor:pointer;transition:.2s!important;white-space:nowrap}\n.nav-btn:hover{background:rgba(184,146,42,.12)!important}\n.nav-par{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.3);color:#4AE382!important;padding:.4rem .7rem!important;font-weight:700!important;opacity:1!important;transition:.2s!important;white-space:nowrap}\n.nav-fee{background:var(--saffron)!important;color:#fff!important;padding:.4rem .7rem!important;font-weight:700!important;opacity:1!important;border:none!important;cursor:pointer;transition:.2s!important;white-space:nowrap}\n.nav-fee:hover{background:#e06810!important}\n.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}\n.hamburger span{display:block;width:24px;height:2px;background:var(--cream);transition:.3s;transform-origin:center}\n.hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}\n.hamburger.open span:nth-child(2){opacity:0}\n.hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}\n.mob-menu{display:none;position:fixed;inset:0;z-index:1100;background:var(--navy);flex-direction:column}\n.mob-menu.open{display:flex}\n.mob-menu-hd{flex-shrink:0;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 5%;border-bottom:1px solid rgba(184,146,42,.2)}\n.mob-menu-brand{display:flex;align-items:center;gap:.7rem;color:var(--cream);font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:.85rem}\n.mob-menu-close{background:none;border:1px solid rgba(184,146,42,.3);color:var(--goldL);width:34px;height:34px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s;flex-shrink:0}\n.mob-menu-close:hover{border-color:var(--goldL);background:rgba(184,146,42,.12)}\n.mob-menu-scroll{flex:1;overflow-y:auto;padding:.5rem 0 1rem;-webkit-overflow-scrolling:touch}\n.mob-menu a,.mob-menu button{display:block;width:100%;text-align:left;background:none;border:none;color:rgba(248,243,232,.75);font-family:'Rajdhani',sans-serif;font-weight:600;font-size:clamp(0.88rem,2.5vw,1rem);letter-spacing:.1em;text-transform:uppercase;padding:.85rem 5%;border-bottom:1px solid rgba(184,146,42,.08);transition:.2s;cursor:pointer}\n.mob-menu a:active,.mob-menu button:active{background:rgba(184,146,42,.08)}\n.mob-menu .mob-par{color:#4AE382!important}\n.mob-menu .mob-staff{color:var(--goldL)!important;font-weight:700!important}\n.mob-menu-bottom{flex-shrink:0;display:flex;gap:.6rem;padding:.85rem 5% calc(.85rem + env(safe-area-inset-bottom));background:rgba(11,31,58,.98);border-top:1px solid rgba(184,146,42,.28);box-shadow:0 -10px 28px rgba(0,0,0,.32)}\n.mob-menu-bottom a{flex:1;display:flex;align-items:center;justify-content:center;gap:.4rem;padding:.78rem .5rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.74rem,2.2vw,0.85rem);letter-spacing:.07em;text-transform:uppercase;border:none;transition:.2s}\n.mmb-fee{background:var(--saffron);color:#fff!important}\n.mmb-fee:hover{background:#e06810}\n.mmb-apply{background:var(--gold);color:var(--navy)!important}\n.mmb-apply:hover{background:var(--goldL)}\n\n/* HERO */\n.hero{background:var(--white);color:var(--navy);min-height:100vh;display:flex;align-items:center;position:relative;overflow:hidden}\n.hero-pattern{position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(0deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 40px),repeating-linear-gradient(90deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 40px)}\n.hero-orb{position:absolute;border-radius:50%;pointer-events:none}\n.hero-orb1{right:-8%;top:-12%;width:560px;height:560px;border:1px solid rgba(184,146,42,.12);animation:orb 6s ease-in-out infinite alternate}\n.hero-orb2{right:-3%;top:-5%;width:360px;height:360px;border:1px solid rgba(184,146,42,.18);animation:orb 6s ease-in-out infinite alternate-reverse}\n@keyframes orb{0%{transform:scale(1) rotate(0deg)}100%{transform:scale(1.04) rotate(3deg)}}\n.hero-wrap{width:min(1200px,92%);margin:auto;display:grid;grid-template-columns:1.3fr .7fr;gap:3.5rem;align-items:center;position:relative;z-index:2;padding:5.5rem 0 4.5rem}\n.tricolor{display:flex;height:4px;width:80px;margin-bottom:2rem;gap:2px}\n.tricolor div:nth-child(1){background:var(--saffron);flex:1}\n.tricolor div:nth-child(2){background:#d8d8d8;flex:1}\n.tricolor div:nth-child(3){background:var(--green);flex:1}\n.hero-eyebrow{font-family:'Rajdhani',sans-serif;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.3em;text-transform:uppercase;color:var(--goldD);margin-bottom:1.2rem;display:flex;align-items:center;gap:12px}\n.hero-eyebrow::before,.hero-eyebrow::after{content:'';display:block;height:1px;width:28px;background:var(--gold)}\n.hero h1{font-size:clamp(2.2rem,6vw,4.8rem);line-height:1.03;letter-spacing:-.01em;margin-bottom:1.5rem;font-weight:600;color:var(--navy)}\n.hero h1 em{color:var(--goldD);font-style:italic}\n.hero h1 span:not([data-en]):not([data-hi]){display:block;font-size:clamp(1.3rem,3.5vw,2.8rem);color:var(--mist);font-weight:400}\n.hero p{max-width:520px;color:var(--slate);line-height:1.9;font-size:clamp(0.95rem,2.5vw,1.05rem);margin-bottom:2rem}\n.hero-btns{display:flex;gap:.85rem;flex-wrap:wrap;margin-bottom:1.5rem}\n\n/* HERO QUICK ACTIONS — brochure + demo */\n.hero-quick{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:2.5rem}\n.btn-brochure{display:inline-flex;align-items:center;gap:.4rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.6rem 1.2rem;background:transparent;border:1px solid var(--creamDD);color:var(--slate);cursor:pointer;transition:.2s}\n.btn-brochure:hover{border-color:var(--goldD);color:var(--goldD)}\n.btn-demo{display:inline-flex;align-items:center;gap:.4rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.6rem 1.2rem;background:rgba(207,90,13,.15);border:1px solid rgba(207,90,13,.4);color:#CF5A0D;cursor:pointer;transition:.2s}\n.btn-demo:hover{background:rgba(207,90,13,.25)}\n\n.btn{display:inline-flex;align-items:center;gap:.45rem;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(0.78rem,2.2vw,0.88rem);padding:clamp(.65rem,2vw,.82rem) clamp(1.2rem,3vw,1.7rem);cursor:pointer;transition:.2s;border:none}\n.btn-gold{background:var(--gold);color:var(--navy)}\n.btn-gold:hover{background:var(--goldL);transform:translateY(-1px);box-shadow:0 6px 20px rgba(184,146,42,.4)}\n.btn-out{background:transparent;border:1px solid rgba(248,243,232,.85);color:var(--cream)}\n.btn-out:hover{border-color:var(--goldL);color:var(--goldL)}\n.btn-wa{background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.3);color:#4AE382}\n.btn-wa:hover{background:rgba(37,211,102,.2)}\n.btn-grn{background:var(--green);color:#fff}\n.btn-grn:hover{background:#1e7a34;transform:translateY(-1px)}\n.btn-fee{background:var(--saffron);color:#fff}\n.btn-fee:hover{background:#e06810;transform:translateY(-1px)}\n.btn:focus-visible,.btn-gold:focus-visible,.btn-out:focus-visible,.btn-wa:focus-visible,.btn-grn:focus-visible,.btn-fee:focus-visible,.btn-brochure:focus-visible,.btn-demo:focus-visible{outline:2px solid var(--gold);outline-offset:3px}\n.nav-links a:focus-visible{outline:2px solid var(--goldL);outline-offset:2px}\nselect.ff:focus,.scholar-select:focus,.portal-select:focus,.grv-select:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}\na:focus-visible,button:focus-visible{outline:2px solid var(--gold);outline-offset:2px}\n@media(prefers-reduced-motion:reduce){*{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}\n\n.stats-bar{display:flex;border-top:1px solid rgba(184,146,42,.2);padding-top:1.8rem;flex-wrap:wrap;gap:1rem}\n.stat-item{padding-right:1.8rem;border-right:1px solid rgba(184,146,42,.18)}\n.stat-item:last-child{border:none;padding:0}\n.stat-item strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,2rem);color:var(--goldL);line-height:1}\n.stat-item span{font-size:clamp(0.65rem,1.8vw,0.75rem);color:rgba(248,243,232,.85);letter-spacing:.12em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;font-weight:600}\n.count-up{display:inline-block}\n\n/* LIVE DASH */\n.dash-panel{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.25);overflow:hidden;transition:.2s}\n.dash-panel:hover{border-color:rgba(184,146,42,.4)}\n.dash-hd{background:rgba(11,31,58,.8);border-bottom:1px solid rgba(184,146,42,.2);padding:.9rem 1.3rem;display:flex;align-items:center;justify-content:space-between}\n.dash-hd-title{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.82rem,2.2vw,0.92rem);letter-spacing:.2em;text-transform:uppercase;color:var(--goldL)}\n.live-dot{display:flex;align-items:center;gap:6px;font-size:clamp(0.75rem,2vw,0.85rem);color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase}\n.dot{width:6px;height:6px;border-radius:50%;background:#4AE382;animation:pulse 2s infinite}\n@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(74,227,130,.4)}50%{opacity:.6;box-shadow:0 0 0 4px rgba(74,227,130,0)}}\n.dash-kpi{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid rgba(184,146,42,.1)}\n.kpi{padding:1.1rem .8rem;text-align:center;border-right:1px solid rgba(184,146,42,.08);transition:.2s}\n.kpi:hover{background:rgba(184,146,42,.05)}\n.kpi:last-child{border:none}\n.kpi strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.3rem,4vw,1.8rem);color:var(--goldLL);line-height:1}\n.kpi span{font-size:clamp(0.72rem,2vw,0.82rem);color:rgba(248,243,232,.85);text-transform:uppercase;letter-spacing:.1em;font-family:'Rajdhani',sans-serif;font-weight:600}\n.dash-body{padding:.9rem 1.3rem}\n.dash-row{display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid rgba(184,146,42,.07);font-size:clamp(0.85rem,2.5vw,1rem);transition:.15s}\n.dash-row:hover{padding-left:.3rem}\n.dash-row:last-child{border:none}\n.dash-row span{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif}\n.dash-row strong{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:600}\n.lpulse{opacity:.4;animation:lpulse 1.5s ease-in-out infinite}\n@keyframes lpulse{0%,100%{opacity:.4}50%{opacity:.8}}\n\n/* SECTIONS */\nsection.pad{padding:4.8rem 0}\nsection.pad-alt{padding:4.8rem 0;background:var(--cream)}\n.eyebrow{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.3em;text-transform:uppercase;color:var(--goldD);margin-bottom:.7rem;display:flex;align-items:center;gap:10px}\n.eyebrow::before{content:'';width:22px;height:1px;background:var(--gold)}\nh2.st{font-size:clamp(1.5rem,4vw,2.6rem);color:var(--navy);margin-bottom:.8rem}\n.rule{display:flex;align-items:center;gap:12px;margin-bottom:1.5rem}\n.rule-line{height:1px;flex:1;background:linear-gradient(90deg,var(--gold),transparent)}\n.rule-d{width:7px;height:7px;border:2px solid var(--gold);transform:rotate(45deg);flex-shrink:0}\n\n/* RIBBON */\n.ribbon{background:var(--cream);border-top:3px solid var(--gold);border-bottom:1px solid var(--creamDD);padding:2.2rem 5%}\n.ribbon-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1.2rem;text-align:center}\n.ribbon-stat{transition:.2s;cursor:default}\n.ribbon-stat:hover strong{color:var(--goldD)}\n.ribbon-stat strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.8rem,5vw,2.8rem);color:var(--navy);line-height:1;transition:.3s}\n.ribbon-stat span{font-size:clamp(0.78rem,2.2vw,0.88rem);color:var(--mist);letter-spacing:.1em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;font-weight:600}\n\n/* ═══ RANKER WALL — magazine passport cards ═══ */\n.ranker-section{background:var(--cream);padding:4.8rem 0;position:relative;overflow:hidden}\n.ranker-section::before{content:'';position:absolute;inset:0;opacity:.035;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 28px)}\n.ranker-section .eyebrow{color:var(--goldD)}\n.ranker-section .eyebrow::before{background:var(--gold)}\n.ranker-section h2.st{color:var(--navy)}\n.ranker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:1.2rem;margin-top:2rem}\n.ranker-card{background:var(--navy3);position:relative;overflow:hidden;aspect-ratio:3/4;transition:.4s cubic-bezier(.25,.46,.45,.94);box-shadow:0 6px 18px rgba(0,0,0,.25)}\n.ranker-card:hover{transform:translateY(-12px);box-shadow:0 24px 48px rgba(0,0,0,.4)}\n.ranker-card .rc-edge{position:absolute;top:0;left:0;right:0;height:3px;z-index:3;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green))}\n.ranker-photo{position:absolute;inset:0;width:100%;height:100%;margin:0;border:none;border-radius:0;background:linear-gradient(150deg,var(--navy3),var(--navy4));display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:4.5rem;color:rgba(212,174,80,.4)}\n.ranker-photo img{width:100%;height:100%;object-fit:cover;object-position:top center;transition:transform .6s ease}\n.ranker-card:hover .ranker-photo img{transform:scale(1.05)}\n.ranker-card .rc-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(11,31,58,0) 0%,rgba(11,31,58,.08) 40%,rgba(11,31,58,.88) 76%,rgba(11,31,58,.98) 100%)}\n.ranker-card .rc-rank{position:absolute;top:-.3rem;left:.5rem;z-index:2;font-family:'EB Garamond',serif;font-weight:600;font-size:clamp(2.6rem,7vw,3.6rem);line-height:1;color:rgba(248,243,232,.1);letter-spacing:-.03em;user-select:none;pointer-events:none}\n.ranker-card h4{position:relative;z-index:2;color:var(--cream);font-size:clamp(0.86rem,2.4vw,0.98rem);margin-bottom:.22rem;line-height:1.2}\n.ranker-school{position:relative;z-index:2;color:var(--goldL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.66rem,1.8vw,0.74rem);letter-spacing:.07em;text-transform:uppercase;font-weight:700;margin-bottom:.18rem}\n.ranker-batch{position:relative;z-index:2;color:rgba(248,243,232,.85);font-size:clamp(0.62rem,1.7vw,0.68rem);font-family:'Rajdhani',sans-serif}\n.ranker-card .rc-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:1.1rem 1rem 1rem}\n.ranker-badge{position:absolute;top:.7rem;right:.7rem;z-index:3;background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.08em;text-transform:uppercase;padding:.2rem .5rem}\n.ranker-cta{margin-top:2rem;text-align:center}\n.ranker-note{color:var(--mist);font-size:clamp(0.72rem,2vw,0.8rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;margin-top:1rem;text-align:center}\n\n/* ABOUT */\n.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:start}\n.about-text p{color:var(--slate);line-height:1.9;margin-bottom:1.3rem;font-size:clamp(0.92rem,2.4vw,1rem)}\n.feat-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:1.4rem}\n.tile{padding:.9rem 1rem;border:1px solid var(--creamDD);border-left:3px solid var(--gold);background:var(--white);transition:.25s;cursor:default}\n.tile:hover{border-left-color:var(--goldL);transform:translateX(4px);box-shadow:4px 0 12px rgba(184,146,42,.1)}\n.tile strong{display:block;color:var(--navy);font-size:clamp(0.82rem,2.2vw,0.9rem);margin:.25rem 0 .12rem;font-family:'Rajdhani',sans-serif;font-weight:600;letter-spacing:.04em}\n.tile span{color:var(--mist);font-size:clamp(0.7rem,1.9vw,0.78rem)}\n.bar-block{margin-bottom:1.3rem}\n.bar-label{display:flex;justify-content:space-between;margin-bottom:6px;font-size:clamp(0.82rem,2.2vw,0.9rem)}\n.bar-label span{color:var(--slate)}\n.bar-label strong{color:var(--navy);font-family:'EB Garamond',serif}\n.bar-track{height:4px;background:var(--creamDD);overflow:hidden;border-radius:2px}\n.bar-fill{height:100%;width:0;transition:width 1.4s cubic-bezier(.25,.46,.45,.94);border-radius:2px}\n\n/* head-institute */\n.head-institute-grid{display:grid;grid-template-columns:.45fr .55fr;gap:4rem;align-items:center}\n.head-institute-img{width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,var(--creamDD),var(--creamD));border:3px solid var(--creamD);display:flex;align-items:center;justify-content:center;color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;position:relative;overflow:hidden}\n.head-institute-img img{width:100%;height:100%;object-fit:cover}\n.head-institute-img-badge{position:absolute;bottom:1.2rem;left:1.2rem;right:1.2rem;background:rgba(11,31,58,.92);border:1px solid rgba(184,146,42,.35);padding:.8rem 1rem;backdrop-filter:blur(8px)}\n.head-institute-img-badge h4{color:var(--cream);font-size:clamp(1rem,2.8vw,1.1rem);margin-bottom:.15rem}\n.head-institute-img-badge span{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.1em;text-transform:uppercase}\n.head-institute-quote{font-family:'EB Garamond',serif;font-size:clamp(1.05rem,2.8vw,1.25rem);color:var(--navy);line-height:1.75;font-style:italic;border-left:4px solid var(--gold);padding-left:1.4rem;margin-bottom:1.5rem;position:relative}\n.head-institute-quote::before{content:'\"';position:absolute;left:-.5rem;top:-.8rem;font-size:4rem;color:var(--gold);opacity:.15;font-family:'EB Garamond',serif;line-height:1}\n.head-institute-body p{color:var(--slate);line-height:1.9;margin-bottom:1rem;font-size:clamp(0.9rem,2.4vw,0.95rem)}\n.head-institute-sig{font-family:'EB Garamond',serif;font-size:clamp(1.1rem,2.8vw,1.3rem);color:var(--navy);margin-top:1.5rem}\n.head-institute-sig span{display:block;font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);color:var(--mist);letter-spacing:.1em;text-transform:uppercase;font-style:normal;margin-top:.2rem}\n\n/* FACULTY \xe2\x80\x94 magazine passport cards */\n.faculty-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:1.4rem}\n.faculty-card{background:var(--navy);position:relative;overflow:hidden;aspect-ratio:3/4;transition:.4s cubic-bezier(.25,.46,.45,.94);box-shadow:0 6px 20px rgba(11,31,58,.2)}\n.faculty-card:hover{transform:translateY(-7px);box-shadow:0 26px 52px rgba(11,31,58,.34)}\n.faculty-photo{position:absolute;inset:0;width:100%;height:100%;margin:0;border:none;border-radius:0;background:linear-gradient(150deg,var(--navy3),var(--navy4));display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:5.5rem;color:rgba(212,174,80,.45)}\n.faculty-photo img{width:100%;height:100%;object-fit:cover;object-position:top center;transition:transform .6s ease}\n.faculty-card:hover .faculty-photo img{transform:scale(1.05)}\n.faculty-card .fc-rank{position:absolute;top:-.4rem;left:.6rem;z-index:2;font-family:'EB Garamond',serif;font-weight:600;font-size:clamp(3.2rem,8vw,4.6rem);line-height:1;color:rgba(248,243,232,.1);letter-spacing:-.03em;user-select:none;pointer-events:none}\n.faculty-card .fc-shade{position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,rgba(11,31,58,.05) 0%,rgba(11,31,58,.05) 38%,rgba(11,31,58,.82) 72%,rgba(11,31,58,.97) 100%)}\n.faculty-card .fc-edge{position:absolute;top:0;left:0;right:0;height:3px;z-index:3;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green));transform:scaleX(0);transform-origin:left;transition:transform .5s ease}\n.faculty-card:hover .fc-edge{transform:scaleX(1)}\n.faculty-card .fc-cap{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:1.4rem 1.25rem 1.25rem;text-align:left}\n.faculty-card h3{color:var(--cream);font-size:clamp(1.05rem,2.7vw,1.22rem);margin-bottom:.32rem;line-height:1.16}\n.faculty-card .role{color:var(--goldLL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.66rem,1.8vw,0.75rem);letter-spacing:.17em;text-transform:uppercase;margin-bottom:.6rem}\n.faculty-card .subj{color:rgba(248,243,232,.68);font-size:clamp(0.78rem,2.1vw,0.86rem);padding-top:.55rem;border-top:1px solid rgba(184,146,42,.25)}\n.faculty-card .exp{font-family:'Rajdhani',sans-serif;font-size:clamp(0.6rem,1.7vw,0.68rem);letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.85);margin-top:.45rem}\n\n/* COURSES */\n.courses-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.2rem}\n.course-card{background:var(--white);border:1px solid var(--creamDD);border-top:4px solid var(--navy3);padding:1.6rem;transition:.25s;position:relative;overflow:hidden}\n.course-card.sainik{border-top-color:var(--red)}\n.course-card.navodaya{border-top-color:var(--navy3)}\n.course-card.foundation{border-top-color:var(--green)}\n.course-card.combined{border-top-color:var(--gold)}\n.course-card:hover{transform:translateY(-5px);box-shadow:0 16px 40px rgba(11,31,58,.14)}\n.course-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.14em;text-transform:uppercase;padding:.2rem .65rem;margin-bottom:.9rem}\n.cb-sainik{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.2)}\n.cb-nv{background:rgba(21,53,97,.1);color:var(--navy3);border:1px solid rgba(21,53,97,.2)}\n.cb-fn{background:rgba(26,92,42,.1);color:var(--green);border:1px solid rgba(26,92,42,.2)}\n.cb-co{background:rgba(184,146,42,.1);color:var(--goldD);border:1px solid rgba(184,146,42,.2)}\n.course-card h3{color:var(--navy);font-size:clamp(1rem,3vw,1.2rem);margin-bottom:.3rem}\n.course-card .sub{color:var(--slate);font-size:clamp(0.8rem,2.2vw,0.88rem);margin-bottom:1rem}\n.course-features{list-style:none;margin-bottom:1.2rem}\n.course-features li{color:var(--slate);font-size:clamp(0.82rem,2.2vw,0.9rem);padding:.3rem 0;border-bottom:1px solid var(--creamDD);display:flex;align-items:center;gap:.5rem}\n.course-features li::before{content:'✓';color:var(--green);font-weight:700;font-size:.8rem;flex-shrink:0}\n.course-enquire{display:block;width:100%;padding:.6rem;background:var(--cream);border:1px solid var(--creamDD);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.2s;text-align:center}\n.course-enquire:hover{background:var(--gold);border-color:var(--gold);color:var(--navy)}\n.fee-note{color:var(--mist);font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif;text-align:center;margin-top:.4rem;letter-spacing:.04em}\n\n/* ═══ FACILITIES ═══ */\n.facilities-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.2rem}\n.facility-card{background:var(--white);border:1px solid var(--creamDD);padding:1.6rem;transition:.25s;position:relative;overflow:hidden}\n.facility-card:hover{border-color:var(--gold);transform:translateY(-4px);box-shadow:0 12px 30px rgba(11,31,58,.1)}\n.facility-icon{font-size:2.2rem;margin-bottom:.9rem;display:block}\n.facility-card h3{color:var(--navy);font-size:clamp(1rem,2.8vw,1.15rem);margin-bottom:.5rem}\n.facility-card p{color:var(--slate);font-size:clamp(0.84rem,2.2vw,0.9rem);line-height:1.75}\n.facility-card ul{list-style:none;margin-top:.7rem}\n.facility-card ul li{color:var(--slate);font-size:clamp(0.8rem,2.2vw,0.87rem);padding:.2rem 0;display:flex;align-items:center;gap:.4rem}\n.facility-card ul li::before{content:'▸';color:var(--gold);font-size:.75rem;flex-shrink:0}\n\n/* ═══ VIDEO SECTION ═══ */\n.video-section{background:var(--white);padding:4.8rem 0;position:relative;overflow:hidden}\n.video-section::before{content:'';position:absolute;inset:0;opacity:.045;background-image:repeating-linear-gradient(0deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 50px)}\n.video-section .eyebrow{color:var(--goldD)}\n.video-section .eyebrow::before{background:var(--gold)}\n.video-section h2.st{color:var(--navy)}\n.video-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:2.5rem;align-items:start;margin-top:2rem}\n.video-main{position:relative}\n.video-embed{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.2)}\n.video-embed iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}\n.video-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;cursor:pointer;background:rgba(11,31,58,.85)}\n.video-placeholder:hover .play-btn{transform:scale(1.1);background:var(--goldL)}\n.play-btn{width:64px;height:64px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.4rem;transition:.25s}\n.video-placeholder p{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(0.8rem,2.2vw,0.9rem);letter-spacing:.08em;text-transform:uppercase}\n.video-list{display:flex;flex-direction:column;gap:.75rem}\n.video-item{background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.15);padding:1rem 1.2rem;display:flex;gap:1rem;align-items:center;cursor:pointer;transition:.2s}\n.video-item:hover{border-color:var(--goldL);background:rgba(21,53,97,.8)}\n.video-thumb{width:48px;height:48px;background:rgba(184,146,42,.15);border:1px solid rgba(184,146,42,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;color:var(--goldL)}\n.video-item-title{color:var(--cream);font-size:clamp(0.85rem,2.3vw,0.95rem);margin-bottom:.2rem}\n.video-item-sub{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.06em;text-transform:uppercase}\n\n/* NOTICES */\n.cards-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1rem}\n.notice-card{background:var(--white);border:1px solid var(--creamDD);border-top:3px solid var(--navy3);padding:1.3rem 1.4rem;transition:.25s}\n.notice-card:hover{box-shadow:0 8px 24px rgba(11,31,58,.1);transform:translateY(-2px)}\n.notice-card.urgent{border-top-color:var(--red)}\n.notice-card.success{border-top-color:var(--green)}\n.notice-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.14em;text-transform:uppercase;padding:.2rem .65rem;margin-bottom:.7rem}\n.badge-open{background:#E8F4ED;color:var(--green)}\n.badge-weekly{background:#EDF2F8;color:var(--navy3)}\n.badge-limited{background:#FDF0E8;color:var(--saffron)}\n.notice-card h3{font-size:clamp(1rem,2.8vw,1.1rem);color:var(--navy);margin-bottom:.5rem}\n.notice-card p{color:var(--slate);font-size:clamp(0.85rem,2.3vw,0.92rem);line-height:1.7}\n.notice-date{font-size:clamp(0.65rem,1.8vw,0.72rem);color:var(--mist);font-family:'Rajdhani',sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-top:.7rem}\n\n/* ═══ BLOG / NEWS ═══ */\n.blog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem}\n.blog-card{background:var(--white);border:1px solid var(--creamDD);overflow:hidden;transition:.25s}\n.blog-card:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(11,31,58,.1);border-color:var(--goldL)}\n.blog-thumb{height:160px;background:linear-gradient(135deg,var(--navy3),var(--navy));display:flex;align-items:center;justify-content:center;font-size:2.5rem;position:relative;overflow:hidden}\n.blog-thumb img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}\n.blog-cat{position:absolute;top:.7rem;left:.7rem;background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;padding:.18rem .55rem}\n.blog-body{padding:1.2rem 1.3rem}\n.blog-date{font-family:'Rajdhani',sans-serif;font-size:clamp(0.65rem,1.8vw,0.72rem);color:var(--mist);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.4rem}\n.blog-card h3{color:var(--navy);font-size:clamp(0.97rem,2.6vw,1.08rem);margin-bottom:.5rem;line-height:1.4}\n.blog-card p{color:var(--slate);font-size:clamp(0.82rem,2.2vw,0.88rem);line-height:1.7}\n.blog-read{display:inline-flex;align-items:center;gap:.3rem;margin-top:.9rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.78rem);letter-spacing:.1em;text-transform:uppercase;color:var(--goldD);transition:.2s}\n.blog-read:hover{color:var(--gold);gap:.5rem}\n\n/* RESULTS */\n.result-card{background:var(--white);border:1px solid var(--creamDD);padding:1.3rem 1.4rem;display:flex;gap:1.3rem;align-items:flex-start;transition:.25s}\n.result-card:hover{box-shadow:0 6px 20px rgba(11,31,58,.1);transform:translateY(-2px)}\n.year-badge{background:var(--navy);color:var(--goldLL);font-family:'EB Garamond',serif;font-size:clamp(1.2rem,3.5vw,1.5rem);padding:.65rem .9rem;text-align:center;white-space:nowrap;flex-shrink:0;line-height:1}\n.year-badge small{display:block;font-family:'Rajdhani',sans-serif;font-size:clamp(0.58rem,1.5vw,0.65rem);letter-spacing:.12em;text-transform:uppercase;color:var(--goldL);margin-top:4px}\n.result-body h3{font-size:clamp(0.95rem,2.5vw,1rem);color:var(--navy);margin-bottom:.4rem}\n.result-body p{color:var(--slate);font-size:clamp(0.82rem,2.2vw,0.88rem);line-height:1.7}\n.result-number{font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,2rem);color:var(--gold);float:right;line-height:1}\n\n/* ALUMNI */\n.alumni-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}\n.alumni-card{background:var(--white);border:1px solid var(--creamDD);padding:1.3rem;text-align:center;transition:.25s}\n.alumni-card:hover{border-color:var(--gold);transform:translateY(-3px);box-shadow:0 8px 20px rgba(184,146,42,.1)}\n.alumni-avatar{width:64px;height:64px;border-radius:50%;background:var(--navy);border:2px solid var(--gold);margin:0 auto .9rem;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.3rem;color:var(--goldL)}\n.alumni-card h4{color:var(--navy);font-size:clamp(0.95rem,2.5vw,1rem);margin-bottom:.2rem}\n.alumni-card .ach{color:var(--green);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:.2rem}\n.alumni-card .yr{color:var(--mist);font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif}\n\n/* TESTIMONIALS — premium card with avatar */\n.testi-wrap{overflow:hidden;position:relative}\n.testi-track{display:flex;transition:transform .6s cubic-bezier(.25,.46,.45,.94)}\n.testi-card{min-width:100%;padding:2.6rem 2.3rem 2.1rem;background:var(--white);border-left:4px solid var(--gold);border:1px solid var(--creamDD);position:relative;box-shadow:0 12px 32px rgba(11,31,58,.08);overflow:hidden}\n.testi-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green))}\n.testi-card::after{content:'\\201C';position:absolute;top:-1rem;left:1.5rem;font-family:'EB Garamond',serif;font-size:5.5rem;line-height:1;color:var(--gold);opacity:.13;pointer-events:none}\n.testi-card .stars{position:relative;z-index:1;color:var(--gold);font-size:clamp(0.9rem,2.5vw,1rem);margin-bottom:.7rem;letter-spacing:.1em}\n.testi-card blockquote{position:relative;z-index:1;font-family:'EB Garamond',serif;font-size:clamp(1rem,2.8vw,1.15rem);color:var(--navy);line-height:1.8;font-style:italic;margin-bottom:1.5rem}\n.testi-foot{display:flex;align-items:center;gap:.9rem;padding-top:1.15rem;border-top:1px solid var(--creamDD)}\n.testi-avatar{width:48px;height:48px;border-radius:50%;background:linear-gradient(150deg,var(--navy3),var(--navy4));border:2px solid var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.15rem;color:var(--goldLL);flex-shrink:0;overflow:hidden}\n.testi-avatar img{width:100%;height:100%;object-fit:cover;object-position:top center}\n.testi-id{display:flex;flex-direction:column;gap:.15rem;min-width:0}\n.testi-card cite{font-style:normal;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.8rem,2.2vw,0.9rem);letter-spacing:.05em;color:var(--navy)}\n.testi-meta{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:clamp(0.66rem,1.8vw,0.74rem);letter-spacing:.08em;text-transform:uppercase;color:var(--goldD)}\n.slider-ctrl{display:flex;align-items:center;gap:1rem;margin-top:1.2rem}\n.slider-btn{width:36px;height:36px;border:1px solid var(--gold);background:transparent;color:var(--gold);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.9rem;transition:.2s}\n.slider-btn:hover{background:var(--gold);color:var(--navy)}\n.slider-dots{display:flex;gap:0}\n.slider-dot{width:7px;height:7px;border-radius:50%;background:var(--creamDD);border:1px solid var(--mist);cursor:pointer;transition:.2s;background-clip:content-box;padding:7px;box-sizing:content-box}\n.slider-dot.active{background:var(--gold);border-color:var(--gold)}\n\n/* ═══ GOOGLE REVIEWS ═══ */\n.reviews-section{background:var(--cream);padding:4.8rem 0}\n.reviews-section .eyebrow{color:var(--goldD)}\n.reviews-section .eyebrow::before{background:var(--gold)}\n.reviews-section h2.st{color:var(--navy)}\n.reviews-header{display:flex;align-items:center;gap:2rem;margin-bottom:2rem;flex-wrap:wrap}\n.reviews-score{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.25);padding:1.5rem 2rem;text-align:center;flex-shrink:0}\n.reviews-score .score-num{font-family:'EB Garamond',serif;font-size:clamp(2.5rem,6vw,3.5rem);color:var(--goldLL);line-height:1;display:block}\n.reviews-score .score-stars{color:var(--gold);font-size:1.2rem;letter-spacing:.1em;margin:.3rem 0}\n.reviews-score .score-count{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.08em;text-transform:uppercase}\n.reviews-desc{color:rgba(248,243,232,.85);line-height:1.85;font-size:clamp(0.9rem,2.4vw,0.97rem);max-width:420px}\n.reviews-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}\n.review-card{background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.15);padding:1.3rem;transition:.2s}\n.review-card:hover{border-color:rgba(184,146,42,.35)}\n.review-top{display:flex;align-items:center;gap:.8rem;margin-bottom:.8rem}\n.review-av{width:40px;height:40px;border-radius:50%;background:rgba(184,146,42,.2);border:1px solid rgba(184,146,42,.35);display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1rem;color:var(--goldL);flex-shrink:0}\n.review-name{color:var(--cream);font-size:clamp(0.88rem,2.3vw,0.95rem)}\n.review-date{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.06em;text-transform:uppercase}\n.review-stars{color:var(--gold);font-size:.85rem;letter-spacing:.05em;margin-bottom:.5rem}\n.review-text{color:rgba(248,243,232,.85);font-size:clamp(0.82rem,2.2vw,0.88rem);line-height:1.7;font-style:italic}\n.google-badge{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.5rem;padding:.5rem 1rem;border:1px solid rgba(184,146,42,.2);background:rgba(21,53,97,.4);color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:.2s}\n.google-badge:hover{border-color:var(--goldL);color:var(--goldL)}\n\n/* GALLERY */\n.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}\n.gcell{background:var(--creamDD);aspect-ratio:4/3;position:relative;overflow:hidden;cursor:pointer}\n.gcell:hover .gcell-lbl{background:rgba(184,146,42,.85);color:var(--navy)}\n.gcell:hover img{transform:scale(1.05)}\n.gcell-lbl{position:absolute;bottom:0;left:0;right:0;background:rgba(11,31,58,.75);color:var(--goldLL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.9vw,0.78rem);letter-spacing:.1em;text-transform:uppercase;padding:.38rem .65rem;transition:.25s}\n.gcell img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease}\n\n/* EVENTS */\n.event-card{background:var(--white);border:1px solid var(--creamDD);padding:1.1rem 1.3rem;display:flex;gap:1.1rem;align-items:center;transition:.25s}\n.event-card:hover{border-color:var(--gold);box-shadow:0 4px 16px rgba(11,31,58,.08);transform:translateX(4px)}\n.event-date-block{text-align:center;min-width:48px;border-right:1px solid var(--creamDD);padding-right:1.1rem}\n.event-date-block .day{font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,1.9rem);color:var(--navy);line-height:1}\n.event-date-block .month{font-family:'Rajdhani',sans-serif;font-size:clamp(0.62rem,1.7vw,0.7rem);letter-spacing:.12em;text-transform:uppercase;color:var(--mist)}\n.event-body h3{font-size:clamp(0.92rem,2.5vw,1rem);color:var(--navy);margin-bottom:.25rem}\n.event-body span{font-size:clamp(0.8rem,2.2vw,0.88rem);color:var(--slate)}\n\n/* FAQ */\n.faq{border-top:1px solid var(--creamDD)}\n.faq-item{border-bottom:1px solid var(--creamDD)}\n.faq-q{font-family:'EB Garamond',serif;font-size:clamp(0.97rem,2.7vw,1.08rem);color:var(--navy);cursor:pointer;display:flex;justify-content:space-between;gap:1rem;padding:1rem 0;transition:.2s}\n.faq-q:hover{color:var(--goldD)}\n.faq-icon{width:22px;height:22px;border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:.78rem;flex-shrink:0;transition:.25s}\n.faq-a{display:none;color:var(--slate);line-height:1.85;padding-bottom:1rem;font-size:clamp(0.88rem,2.3vw,0.95rem);animation:fadedown .25s ease}\n@keyframes fadedown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}\n\n/* ═══ ONLINE FEE PAYMENT ═══ */\n.fee-section{background:linear-gradient(135deg,var(--navy2),var(--navy3));padding:4rem 0;position:relative;overflow:hidden}\n.fee-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 30px)}\n.fee-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center}\n.fee-info h2{color:var(--cream);font-size:clamp(1.5rem,4vw,2.2rem);margin-bottom:1rem}\n.fee-info p{color:rgba(248,243,232,.85);line-height:1.85;font-size:clamp(0.9rem,2.4vw,0.97rem);margin-bottom:1.5rem}\n.fee-methods{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1.5rem}\n.fee-method{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);padding:.4rem .9rem;font-family:'Rajdhani',sans-serif;font-weight:600;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.08em;text-transform:uppercase;color:rgba(248,243,232,.85)}\n.fee-box{background:rgba(11,31,58,.6);border:1px solid rgba(184,146,42,.25);padding:2rem}\n.fee-box h3{color:var(--goldL);font-size:clamp(1.1rem,3vw,1.3rem);margin-bottom:1.2rem}\n.fee-step{display:flex;gap:1rem;align-items:flex-start;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(184,146,42,.1)}\n.fee-step:last-of-type{border:none;margin-bottom:1.2rem}\n.fee-step-num{width:28px;height:28px;border:1px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.75rem;color:var(--gold);flex-shrink:0}\n.fee-step-txt{color:rgba(248,243,232,.85);font-size:clamp(0.85rem,2.3vw,0.92rem);line-height:1.6}\n.fee-step-txt strong{color:var(--cream);display:block;margin-bottom:.15rem}\n.pay-btn{display:flex;width:100%;padding:1rem;background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.88rem,2.5vw,1rem);letter-spacing:.12em;text-transform:uppercase;border:none;cursor:pointer;transition:.2s;align-items:center;justify-content:center;gap:.5rem}\n.pay-btn:hover{background:var(--goldL)}\n.pay-note{color:rgba(248,243,232,.85);font-size:clamp(0.65rem,1.8vw,0.72rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em;text-align:center;margin-top:.6rem}\n\n/* ENQUIRY */\n.enquiry-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:2.5rem}\n.form-panel{background:var(--cream);border:1px solid var(--creamDD);padding:1.8rem}\nlabel.fl{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.14em;text-transform:uppercase;color:var(--slate);margin-bottom:.38rem}\ninput.ff,select.ff,textarea.ff{width:100%;padding:11px 15px;border:1px solid var(--creamDD);background:var(--white);color:var(--navy);font-size:clamp(0.9rem,2.4vw,0.97rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1.1rem;transition:.2s}\ninput.ff:focus,select.ff:focus,textarea.ff:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}\ntextarea.ff{min-height:100px;resize:vertical}\n.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}\n.contact-card{background:var(--white);border:1px solid var(--creamDD);border-left:4px solid var(--gold);padding:1.2rem 1.3rem;margin-bottom:.9rem;transition:.2s}\n.contact-card:hover{box-shadow:4px 0 12px rgba(184,146,42,.1)}\n.contact-card h3{color:var(--navy);margin-bottom:.5rem;font-size:clamp(0.97rem,2.6vw,1.05rem)}\n.contact-card p{color:var(--slate);font-size:clamp(0.84rem,2.2vw,0.9rem);line-height:1.8}\n.form-msg{padding:.7rem 1rem;margin-bottom:1rem;font-size:clamp(0.82rem,2.2vw,0.9rem);font-family:'Rajdhani',sans-serif;display:none}\n.form-msg.success{background:#E8F4ED;color:var(--green);border:1px solid rgba(26,92,42,.3)}\n.form-msg.error{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.3)}\n\n/* SOCIAL */\n.social-strip{display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap}\n.soc-btn{display:inline-flex;align-items:center;gap:.5rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1rem;border:1px solid;transition:.2s}\n.soc-fb{border-color:#1877F2;color:#1877F2}\n.soc-fb:hover{background:#1877F2;color:#fff}\n.soc-yt{border-color:#FF0000;color:#FF0000}\n.soc-yt:hover{background:#FF0000;color:#fff}\n.soc-ig{border-color:#E1306C;color:#E1306C}\n.soc-ig:hover{background:#E1306C;color:#fff}\n\n/* CTA */\n.cta-block{background:var(--navy);color:var(--cream);text-align:center;padding:4.5rem 5%;position:relative;overflow:hidden}\n.cta-block::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 32px)}\n.cta-block h2{font-size:clamp(1.8rem,4.5vw,2.5rem);margin-bottom:1rem;position:relative;color:var(--cream)}\n.cta-block p{max-width:620px;margin:0 auto 2rem;color:rgba(248,243,232,.85);line-height:1.85;position:relative;font-size:clamp(0.92rem,2.4vw,1rem)}\n\n/* FOOTER */\nfooter{background:var(--navy2);color:rgba(248,243,232,.8);border-top:1px solid rgba(184,146,42,.2);padding:3.5rem 5% 2rem;padding-bottom:calc(2rem + 60px)}\n.footer-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2rem;margin-bottom:2rem}\nfooter h4{color:var(--cream);font-family:'EB Garamond',serif;font-size:clamp(1rem,2.8vw,1.05rem);margin-bottom:.9rem}\nfooter a{display:block;margin-bottom:.55rem;color:rgba(248,243,232,.85);font-size:clamp(0.82rem,2.2vw,0.88rem);transition:.2s}\nfooter a:hover{color:var(--goldL);padding-left:4px}\n.foot-social{display:flex;gap:.6rem;margin-top:.6rem}\n.foot-soc-icon{width:34px;height:34px;border-radius:50%;border:1px solid rgba(184,146,42,.25);display:flex;align-items:center;justify-content:center;color:rgba(248,243,232,.85);transition:.2s}\n.foot-soc-icon svg{width:16px;height:16px;fill:currentColor;transition:.2s}\n.foot-soc-icon:hover{border-color:var(--goldL);color:var(--goldL);background:rgba(184,146,42,.12);transform:translateY(-2px)}\n.footer-bottom{border-top:1px solid rgba(184,146,42,.1);padding-top:1.4rem;display:flex;justify-content:space-between;align-items:center;font-size:clamp(0.68rem,1.8vw,0.75rem);color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;flex-wrap:wrap;gap:.5rem}\n.footer-tricolor{display:flex;gap:3px;height:3px;width:44px}\n.footer-tricolor div{flex:1}\n.footer-tricolor div:nth-child(1){background:var(--saffron)}\n.footer-tricolor div:nth-child(2){background:#fff}\n.footer-tricolor div:nth-child(3){background:var(--green)}\n\n/* MAP */\n.map-wrap{position:relative;width:100%;height:240px;background:var(--creamDD);border:1px solid var(--creamDD);overflow:hidden;cursor:pointer}\n.map-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;background:var(--creamDD)}\n.map-placeholder span{font-family:'Rajdhani',sans-serif;font-size:clamp(0.75rem,2vw,0.85rem);letter-spacing:.1em;text-transform:uppercase;color:var(--mist)}\n.map-load-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;background:var(--navy);color:var(--goldL);border:1px solid rgba(184,146,42,.3);cursor:pointer;transition:.2s}\n.map-frame{width:100%;height:100%;border:0}\n\n/* WA FLOAT */\n#waFloat{position:fixed;bottom:5.5rem;right:1.5rem;z-index:995;width:50px;height:50px;background:var(--wa);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(37,211,102,.4);cursor:pointer;animation:wab 2.5s ease-in-out infinite;text-decoration:none}\n#waFloat:hover{animation:none;transform:scale(1.1)}\n#waFloat svg{width:25px;height:25px;fill:#fff}\n#waFloat .wa-tooltip{position:absolute;right:60px;background:var(--navy);color:var(--cream);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,2vw,0.8rem);letter-spacing:.06em;padding:.4rem .8rem;white-space:nowrap;border:1px solid rgba(184,146,42,.3);pointer-events:none;opacity:0;transition:.2s;border-radius:2px}\n#waFloat:hover .wa-tooltip{opacity:1}\n@keyframes wab{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n\n/* PP OVERLAY */\n.pp-overlay{display:none;position:fixed;inset:0;z-index:2000;overflow-y:auto;background:rgba(11,31,58,.98)}.pp-overlay.open{display:block}\n.pp-login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;position:relative}\n.pp-close{position:absolute;top:1rem;right:1rem;background:none;border:1px solid rgba(184,146,42,.3);color:var(--goldL);width:36px;height:36px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:.2s}\n.pp-box{background:rgba(15,42,78,.9);border:1px solid rgba(184,146,42,.3);padding:2.4rem;width:100%;max-width:410px}\n.pp-logo{text-align:center;margin-bottom:1.8rem}\n.pp-logo h2{color:var(--cream);font-size:clamp(1.3rem,3.5vw,1.5rem);margin-bottom:.25rem}\n.pp-logo p{color:rgba(248,243,232,.85);font-size:clamp(0.75rem,2vw,0.85rem);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase}\n.pp-fl{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.14em;text-transform:uppercase;color:rgba(248,243,232,.85);margin-bottom:.38rem}\n.pp-fi{width:100%;padding:12px 15px;background:rgba(255,255,255,.06);border:1px solid rgba(184,146,42,.22);color:var(--cream);font-size:clamp(0.88rem,2.3vw,0.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1.1rem;transition:.2s}\n.pp-fi:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}\n.pp-lbtn{width:100%;padding:13px;background:var(--gold);color:var(--navy);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.85rem,2.4vw,0.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s;margin-top:.3rem}\n.pp-lbtn:hover{background:var(--goldL)}\n.pp-lbtn:disabled{opacity:.5;cursor:not-allowed}\n.pp-err{background:rgba(139,26,26,.3);border:1px solid rgba(139,26,26,.5);color:#f87171;font-size:clamp(0.78rem,2.2vw,0.88rem);padding:.75rem 1rem;margin-bottom:1rem;font-family:'Rajdhani',sans-serif;display:none}\n.pp-shell{min-height:100vh;display:flex;flex-direction:column;background:var(--navy);display:none}.pp-shell.show{display:flex}\n.pp-topbar{background:rgba(11,31,58,.95);border-bottom:1px solid rgba(184,146,42,.22);padding:.85rem 1.3rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}\n.pp-topbar-l{display:flex;align-items:center;gap:.9rem}\n.pp-topbar h3{font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--cream);font-size:clamp(0.88rem,2.4vw,0.97rem);letter-spacing:.1em;text-transform:uppercase}\n.pp-topbar p{color:rgba(248,243,232,.85);font-size:clamp(0.65rem,1.8vw,0.72rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase}\n.pp-lout{background:rgba(139,26,26,.3);border:1px solid rgba(139,26,26,.4);color:#f87171;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.1em;text-transform:uppercase;padding:.45rem .9rem;cursor:pointer}\n.pp-tabs{background:rgba(15,42,78,.5);border-bottom:1px solid rgba(184,146,42,.13);display:flex;overflow-x:auto;scrollbar-width:none}.pp-tabs::-webkit-scrollbar{display:none}\n.pp-tab{flex-shrink:0;padding:.8rem 1.3rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.85);cursor:pointer;border-bottom:2px solid transparent;transition:.2s;border:none;background:none}\n.pp-tab.active{color:var(--goldL);border-bottom-color:var(--gold)}\n.pp-content{flex:1;padding:1.4rem;max-width:880px;margin:0 auto;width:100%}\n.stu-hdr{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.22);padding:1.3rem 1.5rem;margin-bottom:1.3rem;display:flex;align-items:center;gap:1.3rem}\n.stu-av{width:54px;height:54px;background:rgba(184,146,42,.15);border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.4rem;color:var(--goldL);flex-shrink:0}\n.stu-info h3{color:var(--cream);font-size:clamp(1.05rem,2.8vw,1.15rem);margin-bottom:.2rem}\n.stu-info p{color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.08em;text-transform:uppercase}\n.stu-badges{display:flex;gap:.4rem;margin-top:.35rem;flex-wrap:wrap}\n.stu-badge{background:rgba(184,146,42,.13);border:1px solid rgba(184,146,42,.28);color:var(--goldLL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.6rem,1.6vw,0.68rem);letter-spacing:.1em;text-transform:uppercase;padding:.18rem .55rem}\n.pp-sec{display:none}.pp-sec.active{display:block}\n.pp-card{background:rgba(21,53,97,.4);border:1px solid rgba(184,146,42,.16);margin-bottom:1rem}\n.pp-card-hd{padding:.85rem 1.1rem;border-bottom:1px solid rgba(184,146,42,.1);display:flex;justify-content:space-between;align-items:center}\n.pp-card-title{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.15em;text-transform:uppercase;color:var(--goldL)}\n.pp-card-body{padding:.95rem 1.1rem}\n.att-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:4px;margin-bottom:1rem}\n.att-day{width:34px;height:34px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif;font-weight:700}\n.att-p{background:rgba(26,92,42,.4);border:1px solid rgba(26,92,42,.55);color:#4AE382}\n.att-a{background:rgba(139,26,26,.4);border:1px solid rgba(139,26,26,.55);color:#f87171}\n.att-h{background:rgba(61,79,107,.35);border:1px solid rgba(61,79,107,.4);color:var(--mist)}\n.att-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem}\n.att-si{background:rgba(11,31,58,.5);padding:.65rem;text-align:center}\n.att-si strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.2rem,3.5vw,1.5rem);line-height:1;margin-bottom:.15rem}\n.att-si span{font-size:clamp(0.6rem,1.6vw,0.68rem);font-family:'Rajdhani',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(248,243,232,.85)}\n.att-si.p strong{color:#4AE382}.att-si.a strong{color:#f87171}.att-si.pct strong{color:var(--goldLL)}\n.pp-table{width:100%;border-collapse:collapse;font-size:clamp(0.8rem,2.2vw,0.88rem)}\n.pp-table th{background:rgba(11,31,58,.6);padding:.65rem .9rem;text-align:left;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.12em;text-transform:uppercase;color:var(--goldL);border-bottom:1px solid rgba(184,146,42,.13)}\n.pp-table td{padding:.65rem .9rem;border-bottom:1px solid rgba(184,146,42,.07);color:rgba(248,243,232,.72)}\n.pp-table tr:last-child td{border:none}.pp-table tr:hover td{background:rgba(184,146,42,.04)}\n.sc-hi{background:rgba(26,92,42,.35);color:#4AE382;border:1px solid rgba(26,92,42,.4);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem)}\n.sc-mi{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem)}\n.sc-lo{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem)}\n.pp-ni{padding:.9rem 0;border-bottom:1px solid rgba(184,146,42,.09)}.pp-ni:last-child{border:none}\n.pp-npri{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.6rem,1.6vw,0.68rem);letter-spacing:.12em;text-transform:uppercase;padding:.14rem .5rem;margin-bottom:.45rem}\n.pri-h{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38)}\n.pri-m{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28)}\n.pri-l{background:rgba(61,79,107,.35);color:var(--mist);border:1px solid rgba(61,79,107,.45)}\n.pp-ntitle{color:var(--cream);font-size:clamp(0.92rem,2.5vw,1rem);margin-bottom:.35rem}\n.pp-nbody{color:rgba(248,243,232,.52);font-size:clamp(0.8rem,2.2vw,0.88rem);line-height:1.7}\n.pp-ndate{color:rgba(248,243,232,.85);font-size:clamp(0.62rem,1.7vw,0.7rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase;margin-top:.35rem}\n.leave-item{padding:.95rem;background:rgba(11,31,58,.4);border:1px solid rgba(184,146,42,.1);margin-bottom:.55rem}\n.leave-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.45rem}\n.ls{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.62rem,1.7vw,0.7rem);letter-spacing:.1em;text-transform:uppercase;padding:.18rem .55rem}\n.ls-ap{background:rgba(26,92,42,.38);color:#4AE382;border:1px solid rgba(26,92,42,.48)}\n.ls-pe{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28)}\n.ls-re{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38)}\n.leave-dates{color:rgba(248,243,232,.52);font-size:clamp(0.78rem,2.1vw,0.85rem);margin-bottom:.28rem}\n.leave-rsn{color:rgba(248,243,232,.85);font-size:clamp(0.72rem,2vw,0.8rem);font-family:'Rajdhani',sans-serif}\n.alert-item{padding:.75rem .95rem;background:rgba(11,31,58,.4);border-left:3px solid var(--goldL);margin-bottom:.45rem}\n.alert-item.att{border-left-color:#f87171}.alert-item.exam{border-left-color:var(--goldLL)}.alert-item.notice{border-left-color:#4AE382}.alert-item.leave{border-left-color:var(--mist)}\n.alert-msg{color:rgba(248,243,232,.72);font-size:clamp(0.8rem,2.2vw,0.88rem);margin-bottom:.25rem}\n.alert-meta{color:rgba(248,243,232,.85);font-size:clamp(0.62rem,1.7vw,0.7rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase}\n.pp-loading{display:flex;align-items:center;justify-content:center;padding:2.5rem;gap:.7rem;color:rgba(248,243,232,.85);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(0.72rem,2vw,0.82rem)}\n.spin{width:16px;height:16px;border:2px solid rgba(184,146,42,.28);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}\n@keyframes spin{to{transform:rotate(360deg)}}\n.pp-empty{text-align:center;padding:2.2rem;color:rgba(248,243,232,.85)}\n.pp-empty-icon{font-size:2.2rem;margin-bottom:.6rem}\n.pp-empty p{font-family:'Rajdhani',sans-serif;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.1em;text-transform:uppercase}\n\n/* ═══ PARENTS PORTAL - REPORT CARD TAB ═══ */\n.rc-row{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1rem}\n.rc-col{flex:1;min-width:140px}\n.rc-col label{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.85);margin-bottom:.35rem}\n.rc-select{width:100%;padding:.6rem .8rem;background:rgba(255,255,255,.06);border:1px solid rgba(184,146,42,.22);color:var(--cream);font-size:clamp(0.78rem,2.1vw,0.85rem);font-family:'Source Sans 3',sans-serif;outline:none}\n.rc-select:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}\n\n@media(max-width:900px){\n  html{font-size:clamp(14px,4vw,16px)}\n  .hero-wrap,.about-grid,.enquiry-grid,.head-institute-grid,.fee-grid,.video-grid,.scholar-grid,.portal-grid,.mocktest-grid,.app-grid,.helpdesk-grid{grid-template-columns:1fr}\n  .footer-grid{grid-template-columns:1fr 1fr}\n  .nav-links{display:none}\n  .hamburger{display:flex}\n  .dash-panel{margin-top:2rem}\n  .form-row{grid-template-columns:1fr}\n  .gallery-grid{grid-template-columns:1fr 1fr}\n  .result-card{flex-direction:column;gap:.7rem}\n  .stu-hdr{flex-direction:column;text-align:center}\n  #stickyBar p{display:none}\n  .ranker-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}\n  .top-bar-right{display:none}\n  .result-banner-slide{height:clamp(140px,40vw,220px)}\n  .timeline::before{left:80px}\n  .tl-date{min-width:70px}\n}\n@media(max-width:520px){\n  html{font-size:clamp(13px,4.5vw,15px)}\n  .footer-grid{grid-template-columns:1fr}\n  .hero-btns{flex-direction:column}\n  .courses-grid{grid-template-columns:1fr}\n  .ribbon-grid{grid-template-columns:repeat(2,1fr)}\n  .stats-bar{gap:.6rem}\n  .stat-item{padding-right:1rem}\n  .ranker-grid{grid-template-columns:repeat(2,1fr)}\n  .reviews-grid{grid-template-columns:1fr}\n  .countdown-units{gap:.3rem}\n  .cd-unit{min-width:44px;padding:.3rem .5rem}\n  .top-bar{display:none}\n  #langBar{justify-content:center}\n  .test-dates{grid-template-columns:1fr 1fr}\n  .syl-grid{grid-template-columns:1fr}\n  .papers-grid{grid-template-columns:1fr}\n  .timeline::before{display:none}\n  .tl-item{flex-direction:column;gap:.4rem}\n  .tl-date{text-align:left;min-width:auto;display:flex;gap:.5rem;align-items:baseline}\n  .tl-dot{display:none}\n  .app-features{grid-template-columns:1fr}\n  .app-btns{flex-direction:column}\n}\n/* ═══ PART DIVIDER — premium chapter break ═══ */\n.part-divider{position:relative;background:var(--navy);padding:3.6rem 5% 4rem;overflow:hidden;text-align:center}\n.part-divider::before{content:'';position:absolute;inset:0;opacity:.05;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 26px);z-index:0}\n.part-divider-fade{display:none!important;}\n.part-divider-fade-top{display:none!important;}\n.part-divider-fade-bottom{display:none!important;}\n.part-divider-inner{position:relative;z-index:2;max-width:640px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:.55rem}\n.part-num{font-family:'EB Garamond',serif;font-size:clamp(2.6rem,6vw,3.6rem);color:rgba(212,174,80,.48);line-height:1;letter-spacing:.04em;margin-bottom:-.6rem}\n.part-eyebrow{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.7rem,2vw,.8rem);letter-spacing:.34em;text-transform:uppercase;color:var(--goldL)}\n.part-title{font-family:'EB Garamond',serif;font-size:clamp(1.6rem,4vw,2.3rem);color:var(--cream);margin:.15rem 0}\n.part-sub{color:rgba(248,243,232,.58);font-size:clamp(.85rem,2.2vw,.95rem);max-width:460px;line-height:1.7}\n.part-ornament{width:64px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);position:relative;margin-top:.3rem}\n.part-ornament::before{content:'◆';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);color:var(--gold);font-size:.5rem;background:var(--navy);padding:0 6px}\n/* ═══ SUBSECTION TAG — quiet wayfinding hairline ═══ */\n.subsection-tag{display:flex;align-items:center;justify-content:center;gap:16px;padding:2.6rem 5% 0;max-width:1200px;margin:0 auto}\n.subsection-tag span{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.7rem;letter-spacing:.26em;text-transform:uppercase;color:var(--goldD);white-space:nowrap}\n.subsection-tag::before,.subsection-tag::after{content:'';flex:1;max-width:140px;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}\n.nav-menu-desktop{align-items:center}.nav-cat{position:relative}.nav-cat-btn{display:inline-flex;align-items:center;gap:.35rem;background:transparent;border:none;cursor:pointer;font-family:'Source Sans 3',sans-serif;font-size:.82rem;font-weight:600;letter-spacing:.02em;color:var(--cream);padding:.5rem .6rem;border-radius:.35rem;transition:background .2s ease,color .2s ease}.nav-cat-btn:hover,.nav-cat-btn.active{background:rgba(184,146,42,.12);color:var(--goldL)}.nav-cat-arrow{font-size:.6rem;transition:transform .2s ease}.nav-cat-btn.active .nav-cat-arrow{transform:rotate(180deg)}.nav-cat-dropdown{position:absolute;top:calc(100% + 6px);left:0;min-width:210px;background:var(--navy2);border:1px solid rgba(184,146,42,.25);border-radius:.5rem;box-shadow:0 10px 30px rgba(0,0,0,.35);padding:.4rem;z-index:200}.nav-cat-link{display:block;padding:.55rem .75rem;font-family:'Source Sans 3',sans-serif;font-size:.8rem;color:var(--cream);text-decoration:none;border-radius:.35rem;border-left:2px solid transparent;transition:background .15s ease,color .15s ease,border-color .15s ease}.nav-cat-link:hover{background:rgba(184,146,42,.15);color:var(--goldL);border-left-color:var(--gold)}.mob-cat{border-bottom:1px solid rgba(184,146,42,.12)}.mob-cat-btn{width:100%;display:flex;align-items:center;justify-content:space-between;background:transparent;border:none;cursor:pointer;padding:.85rem .25rem;font-family:'Source Sans 3',sans-serif;font-size:.92rem;font-weight:600;color:var(--cream)}.mob-cat-btn.expanded{color:var(--goldL)}.mob-cat-arrow{font-size:.7rem;transition:transform .2s ease}.mob-cat-btn.expanded .mob-cat-arrow{transform:rotate(180deg)}.mob-cat-links{display:flex;flex-direction:column;gap:.15rem;padding:.25rem 0 .75rem .75rem;border-left:2px solid rgba(184,146,42,.3);margin-left:.25rem}.mob-sub-link{padding:.55rem .6rem;font-family:'Source Sans 3',sans-serif;font-size:.82rem;color:rgba(248,243,232,.85);text-decoration:none;border-radius:.3rem}.mob-sub-link:active{background:rgba(184,146,42,.15);color:var(--goldL)}\n"
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
        color: "rgba(248,243,232,.85)",
        fontFamily: '"Rajdhani",sans-serif',
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
  {/* ② RESULT CELEBRATION BANNER SLIDER */}
  <div className="result-banner" id="resultBanner">
    <div className="result-banner-track" id="rbTrack">
      {/* Slide 1 — no external image dependency; ghost numeral + icon */}
      <div className="result-banner-slide no-photo">
        <div className="rb-ghost">66</div>
        <div className="result-banner-overlay">
          <div className="result-banner-content">
            <span className="rb-icon">🏆</span>
            <div className="result-banner-year">Result 2025–26</div>
            <div className="result-banner-title">
              GNSI's Best Year — <strong>66 Students Selected</strong>
            </div>
            <div className="result-banner-sub">
              NVS Jawahar Navodaya · Sainik School · RMS · Across Manipur
            </div>
          </div>
        </div>
      </div>
      {/* Slide 2 */}
      <div className="result-banner-slide no-photo">
        <div className="rb-ghost">#1</div>
        <div className="result-banner-overlay">
          <div className="result-banner-content">
            <span className="rb-icon">⭐</span>
            <div className="result-banner-year">Sainik School 2025</div>
            <div className="result-banner-title">
              Manipur's <strong>Highest Selection Rate</strong> in Sainik School
            </div>
            <div className="result-banner-sub">
              AISSEE Class 6 &amp; Class 9 · Tilaiya · Imphal · All India
            </div>
          </div>
        </div>
      </div>
      {/* Slide 3 */}
      <div className="result-banner-slide no-photo">
        <div className="rb-ghost">94%</div>
        <div className="result-banner-overlay">
          <div className="result-banner-content">
            <span className="rb-icon">📚</span>
            <div className="result-banner-year">NVS 2025</div>
            <div className="result-banner-title">
              <strong>94% Selection Rate</strong> in Jawahar Navodaya
            </div>
            <div className="result-banner-sub">
              JNVST Class 6 &amp; Class 9 · Thoubal District · Manipur
            </div>
          </div>
        </div>
      </div>
      {/* Slide 4 — achievement, no-photo card style */}
      <div className="result-banner-slide no-photo">
        <div className="rb-ghost">10+</div>
        <div className="result-banner-overlay">
          <div className="result-banner-content">
            <span className="rb-icon">🎖️</span>
            <div className="result-banner-year">Est. 2016</div>
            <div className="result-banner-title">
              A Decade Shaping <strong>200+ Commissioned Officers</strong>
            </div>
            <div className="result-banner-sub">
              Khangabok, Thoubal District · Manipur
            </div>
          </div>
        </div>
      </div>
    </div>
    <button className="rb-prev" onClick={() => window.rbSlide(-1)}>
      ‹
    </button>
    <button className="rb-next" onClick={() => window.rbSlide(1)}>
      ›
    </button>
    <div className="result-banner-nav" id="rbDots" />
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
      <ul className="nav-links nav-menu-desktop" onMouseLeave={closeCats}>
        {navCategories.map((cat, idx) => (
          <li key={cat.label} className="nav-cat">
            <button
              type="button"
              className={"nav-cat-btn" + (expandedCat === idx ? " active" : "")}
              onClick={() => toggleCat(idx)}
              onMouseEnter={() => setExpandedCat(idx)}
            >
              <span>{cat.icon}</span> {cat.label} <span className="nav-cat-arrow">▾</span>
            </button>
            {expandedCat === idx && (
              <div className="nav-cat-dropdown">
                {cat.links.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="nav-cat-link"
                    onClick={closeCats}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </li>
        ))}
        <li>
          <a href="#" onClick={(e) => { e.preventDefault(); window.openPP(); }} className="nav-par">
            Parents →
          </a>
        </li>
        <li>
          <a
            href="#fee-payment"
            className="nav-fee"
            style={{
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".72rem",
              letterSpacing: ".07em",
              textTransform: "uppercase",
              display: "inline-block",
              padding: ".4rem 1rem",
              color: "#fff"
            }}
          >
            Pay Fee →
          </a>
        </li>
        <li>
          <button
            onClick={onLogin}
            className="nav-btn"
            style={{
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".72rem",
              letterSpacing: ".07em",
              textTransform: "uppercase"
            }}
          >
            Staff Login →
          </button>
        </li>
      </ul>
      <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
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
      {navCategories.map((cat, idx) => (
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
                  onClick={closeMobile}
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
      <a
        href="#"
        onClick={(e) => { e.preventDefault(); window.openPP(); closeMobile(); }}
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
      <a href="#fee-payment" onClick={closeMobile} className="mmb-fee">
        💳 Pay Fee
      </a>
      <a href="#enquiry" onClick={closeMobile} className="mmb-apply">
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
        <div className="hero-eyebrow">Est. 2016 · 200+ Officers Produced</div>
        <h1>
          <em>
            <span data-en="">Forge Discipline.</span>
            <span data-hi="">अनुशासन गढ़ो।</span>
          </em>
          <span>
            <span data-en="">Command Excellence.</span>
            <span data-hi="">श्रेष्ठता का नेतृत्व करो।</span>
          </span>
        </h1>
        <p>
          <span data-en="">
            Guidance Navodaya &amp; Sainik Institute — Manipur's premier
            residential coaching centre for NVS, Sainik School, and RMS entrance
            examinations. Over <strong>200 commissioned officers</strong> shaped
            in a decade of service to the nation.
          </span>
          <span data-hi="">
            गाइडेंस नवोदय और सैनिक इंस्टीट्यूट — मणिपुर का प्रमुख आवासीय कोचिंग
            केंद्र NVS, सैनिक स्कूल और RMS प्रवेश परीक्षाओं के लिए। एक दशक में{" "}
            <strong>200+ कमीशंड अधिकारी</strong> तैयार किए।
          </span>
        </p>
        <div className="hero-btns">
          <a href="#enquiry" className="btn btn-gold">
            Enquire for Admission →
          </a>
          <button onClick={() => window.openPP()} className="btn btn-grn">
            Parents Portal →
          </button>
          <a
            href="https://wa.me/918974298074?text=Hello%2C+I+am+enquiring+about+GNSI+admissions"
            className="btn btn-wa"
            target="_blank"
          >
            WhatsApp Us
          </a>
        </div>
        {/* ② BROCHURE + FREE DEMO */}
        <div className="hero-quick">
          <a
            href="https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Brochure-2026.pdf"
            className="btn-brochure"
            target="_blank"
            download=""
          >
            📄 Download Brochure
          </a>
          <button
            className="btn-demo"
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
          >
            🎯 Book Free Demo Class
          </button>
          <a
            href="#fee-payment"
            className="btn-fee btn"
            style={{ padding: ".6rem 1.2rem" }}
          >
            💳 Pay Fee Online
          </a>
        </div>
        <div className="stats-bar">
          <div className="stat-item">
            <strong>
              <span className="count-up" data-target={95} data-suffix="%">
                95%
              </span>
            </strong>
            <span>Selection Rate</span>
          </div>
          <div className="stat-item">
            <strong>
              <span className="count-up" data-target={10} data-suffix="+">
                10+
              </span>
            </strong>
            <span>Years</span>
          </div>
          <div className="stat-item">
            <strong>
              <span className="count-up" data-target={200} data-suffix="+">
                200+
              </span>
            </strong>
            <span>Officers</span>
          </div>
          <div className="stat-item">
            <strong>
              <span className="count-up" data-target={500} data-suffix="+">
                500+
              </span>
            </strong>
            <span>Trained</span>
          </div>
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
            <strong>92%</strong>
          </div>
          <div className="dash-row">
            <span>Next Mock Test</span>
            <strong>This Sunday</strong>
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
      <div className="ribbon-stat reveal">
        <strong>
          <span className="count-up" data-target={10} data-suffix="+">
            10+
          </span>
        </strong>
        <span>Years of Excellence</span>
      </div>
      <div className="ribbon-stat reveal">
        <strong>
          <span className="count-up" data-target={500} data-suffix="+">
            500+
          </span>
        </strong>
        <span>Students Trained</span>
      </div>
      <div className="ribbon-stat reveal">
        <strong>
          <span className="count-up" data-target={95} data-suffix="%">
            95%
          </span>
        </strong>
        <span>Selection Rate</span>
      </div>
      <div className="ribbon-stat reveal">
        <strong>
          <span className="count-up" data-target={200} data-suffix="+">
            200+
          </span>
        </strong>
        <span>Officers Produced</span>
      </div>
      <div className="ribbon-stat reveal">
        <strong>
          <span className="count-up" data-target={66} data-suffix="">
            66
          </span>
        </strong>
        <span>Selected 2025–26</span>
      </div>
    </div>
  </div>
  {/* COURSES */}
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
          color: "var(--slate)",
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
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
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
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
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
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
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
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
          >
            Enquire for This Course →
          </button>
          <div className="fee-note">Fee details shared on enquiry</div>
        </div>
      </div>
    </div>
  </section>
  <div className="subsection-tag"><span>Track Record</span></div>
  {/* ③ RANKER WALL */}
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
        <a href="#enquiry" className="btn btn-gold">
          Join the Next Batch →
        </a>
      </div>
      <p className="ranker-note">
        66 students selected in 2025–26 · Names withheld for privacy · Contact
        institute for verified result letters
      </p>
    </div>
  </section>
  {/* RESULTS */}
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
              Consistent placement improvement year on year. Graduates serving
              in NDA and commissioned as officers.
            </p>
          </div>
        </div>
      </div>
    </div>
  </section>
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
          <span className="score-num">4.9</span>
          <div className="score-stars">★★★★★</div>
          <span className="score-count">Based on 80+ Reviews</span>
        </div>
        <p className="reviews-desc">
          Trusted by hundreds of families across Manipur. Our parents
          consistently rate GNSI as the best coaching institute in Thoubal
          District for Sainik School and NVS preparation.
        </p>
      </div>
      <div className="reviews-grid">
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
  <div className="subsection-tag"><span>Inside the Institute</span></div>
  {/* ABOUT */}
  <section className="pad" id="about">
    <div className="container about-grid">
      <div className="about-text">
        <div className="eyebrow reveal">About the Institute</div>
        <h2 className="st reveal">A Decade of Shaping Officers</h2>
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
              style={{ background: "#4E6329" }}
            />
          </div>
        </div>
      </div>
    </div>
  </section>
  {/* head-institute */}
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
          residential campus — producing over 200 officers and achievers.
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
  {/* FACULTY */}
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
  {/* ④ FACILITIES */}
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
  {/* ⑤ VIDEO SECTION */}
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
              color: "rgba(248,243,232,.85)",
              fontFamily: '"Rajdhani",sans-serif',
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
                color: "#f87171"
              }}
            >
              ▶ View All Videos on YouTube →
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
  <div className="subsection-tag"><span>Newsroom</span></div>
  {/* NOTICES */}
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
  {/* ⑦ BLOG / NEWS */}
  <section className="pad-alt" id="blog">
    <div className="container">
      <div className="eyebrow reveal">Updates &amp; Insights</div>
      <h2 className="st reveal">News &amp; Articles</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="blog-grid">
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
            <a href="#results" className="blog-read">
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
            <a href="#enquiry" className="blog-read">
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
            <a href="#enquiry" className="blog-read">
              Get Guidance →
            </a>
          </div>
        </div>
      </div>
    </div>
  </section>
  {/* GALLERY */}
  <section className="pad" id="gallery">
    <div className="container">
      <div className="eyebrow reveal">Campus Life</div>
      <h2 className="st reveal">Gallery</h2>
      <div className="rule reveal">
        <div className="rule-line" />
        <div className="rule-d" />
        <div className="rule-line" />
      </div>
      <div className="gallery-grid reveal" id="galleryGrid">
        <div
          className="gcell"
          style={{ gridRow: "span 2", aspectRatio: "auto", minHeight: 280 }}
        >
          <div className="gcell-lbl">Morning Assembly</div>
        </div>
        <div className="gcell">
          <div className="gcell-lbl">Classroom Session</div>
        </div>
        <div className="gcell">
          <div className="gcell-lbl">Hostel Block</div>
        </div>
        <div className="gcell">
          <div className="gcell-lbl">Mock Test Day</div>
        </div>
        <div className="gcell">
          <div className="gcell-lbl">Award Ceremony</div>
        </div>
      </div>
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
            fontFamily: '"Rajdhani",sans-serif',
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
  {/* EVENTS */}
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
            color: "rgba(248,243,232,.85)",
            fontSize: "clamp(.65rem,1.8vw,.72rem)",
            fontFamily: '"Rajdhani",sans-serif',
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
  {/* ③ MOCK TEST / PRACTICE PORTAL */}
  <section className="mocktest-section" id="mock-tests">
    <div className="container">
      <div className="eyebrow reveal" style={{ color: "var(--goldL)" }}>
        <span data-en="">Practice &amp; Prepare</span>
        <span data-hi="">अभ्यास और तैयारी</span>
      </div>
      <h2 className="st reveal" style={{ color: "var(--cream)" }}>
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
          <a className="mock-card" href="#enquiry">
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
          <a className="mock-card" href="#enquiry">
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
          <a className="mock-card" href="#enquiry">
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
          <a className="mock-card" href="#enquiry">
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
          <a className="mock-card" href="#enquiry">
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
            href="#enquiry"
            style={{ borderColor: "rgba(184,146,42,.35)" }}
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
          <a href="#scholarship" className="btn btn-gold">
            <span data-en="">Register for Sunday Mock Test →</span>
            <span data-hi="">रविवार मॉक टेस्ट के लिए पंजीकरण करें →</span>
          </a>
        </div>
      </div>
    </div>
  </section>
  {/* ④ PREVIOUS YEAR QUESTION PAPERS */}
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
          color: "var(--slate)",
          maxWidth: 560,
          lineHeight: "1.85",
          fontSize: "clamp(.9rem,2.4vw,.97rem)"
        }}
        className="reveal"
      >
        Download free previous year papers for NVS, Sainik School, and RMS
        entrance examinations. Practice is the key to selection.
      </p>
      <div className="papers-grid">
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
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
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
            onClick={() => document.getElementById('enquiry').scrollIntoView({ behavior: 'smooth' })}
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
  {/* ⑤ SYLLABUS SECTION */}
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
  <div className="subsection-tag"><span>Plan Your Year</span></div>
  {/* ④ EXAM CALENDAR */}
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
          <tbody>
            <tr>
              <td>
                <div className="cal-exam">JNVST Class 6</div>
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
                <small style={{ color: "var(--mist)", fontSize: ".72rem" }}>
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
  {/* ⑤ IMPORTANT DATES TIMELINE */}
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
      <div className="timeline reveal">
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
          fontFamily: '"Rajdhani",sans-serif',
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
  {/* FAQ */}
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
  {/* ENQUIRY */}
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
            color: "var(--slate)",
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
              color: "var(--mist)",
              fontSize: "clamp(0.68rem,1.8vw,0.75rem)",
              fontFamily: '"Rajdhani",sans-serif',
              marginTop: ".6rem",
              textAlign: "center"
            }}
          >
            Or call us directly:{" "}
            <a href="tel:+918974298074" style={{ color: "var(--gold)" }}>
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
            <a href="tel:+918974298074" style={{ color: "var(--gold)" }}>
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
        <p
          style={{
            color: "rgba(248,243,232,.85)",
            fontSize: "clamp(0.78rem,2.1vw,0.85rem)",
            fontFamily: '"Rajdhani",sans-serif',
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
        <div className="fee-step">
          <div className="fee-step-num">3</div>
          <div className="fee-step-txt">
            <strong>Send Screenshot</strong>WhatsApp your payment screenshot to
            +91 89742 98074 with your student name and ID for confirmation.
          </div>
        </div>
        <button
          className="pay-btn"
          onClick={() => window.open('https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20would%20like%20to%20pay%20fees%20online.%20Please%20share%20UPI%20and%20bank%20details.', '_blank')}
        >
          💳 Pay Fee via WhatsApp →
        </button>
        <p className="pay-note">
          Instant acknowledgement · Receipt issued within 24 hours
        </p>
      </div>
    </div>
  </section>
  <div className="subsection-tag"><span>Student &amp; Parent Tools</span></div>
  {/* ② ADMIT CARD + RESULT CHECKER PORTAL */}
  <section className="portal-section" id="portal">
    <div className="container">
      <div className="eyebrow reveal" style={{ color: "var(--goldL)" }}>
        <span data-en="">Student Portal</span>
        <span data-hi="">छात्र पोर्टल</span>
      </div>
      <h2 className="st reveal" style={{ color: "var(--cream)" }}>
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
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(248,243,232,.85)",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">Student Roll Number / ID</span>
            <span data-hi="">छात्र रोल नंबर / आईडी</span>
          </label>
          <input
            className="portal-input"
            id="acRoll"
            placeholder="e.g. GNSI-2024-001"
          />
          <label
            style={{
              display: "block",
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(248,243,232,.85)",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">Select Exam</span>
            <span data-hi="">परीक्षा चुनें</span>
          </label>
          <select className="portal-select" id="acExam">
            <option value="">-- Select Exam --</option>
            <option>Sunday Mock Test</option>
            <option>Scholarship Test</option>
            <option>NVS Practice Test</option>
            <option>Sainik School Practice Test</option>
          </select>
          <button className="portal-btn" onClick={() => window.fetchAdmitCard()}>
            🪪 <span data-en="">Download Admit Card</span>
            <span data-hi="">प्रवेश पत्र डाउनलोड करें</span>
          </button>
          <div className="portal-result" id="acResult">
            <h4>✓ Admit Card Found</h4>
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
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(248,243,232,.85)",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">Student Roll Number / ID</span>
            <span data-hi="">छात्र रोल नंबर / आईडी</span>
          </label>
          <input
            className="portal-input"
            id="rcRoll"
            placeholder="e.g. GNSI-2024-001"
          />
          <label
            style={{
              display: "block",
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "rgba(248,243,232,.85)",
              marginBottom: ".38rem"
            }}
          >
            <span data-en="">Date of Birth</span>
            <span data-hi="">जन्म तिथि</span>
          </label>
          <input type="date" className="portal-input" id="rcDob" />
          <button
            className="portal-btn"
            style={{ background: "var(--navy3)" }}
            onClick={() => window.fetchResult()}
          >
            📊 <span data-en="">Check My Result</span>
            <span data-hi="">मेरा परिणाम देखें</span>
          </button>
          <div className="portal-result" id="rcResult">
            <h4>📊 Result Found</h4>
            <div id="rcData" />
          </div>
        </div>
      </div>
      <p
        style={{
          color: "rgba(248,243,232,.85)",
          fontFamily: '"Rajdhani",sans-serif',
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
  {/* ⑥ APP DOWNLOAD */}
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
                "repeating-linear-gradient(0deg,rgba(184,146,42,.15) 0,rgba(184,146,42,.15) 4px,transparent 4px,transparent 8px),repeating-linear-gradient(90deg,rgba(184,146,42,.15) 0,rgba(184,146,42,.15) 4px,transparent 4px,transparent 8px)",
              margin: "0 auto"
            }}
          />
          <p>Scan QR to Download</p>
        </div>
      </div>
    </div>
  </section>
  {/* ⑦ GRIEVANCE / HELPDESK */}
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
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--slate)",
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
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--slate)",
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
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--slate)",
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
              fontFamily: '"Rajdhani",sans-serif',
              fontWeight: 700,
              fontSize: ".68rem",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--slate)",
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
  {/* CTA */}
  <div className="cta-block">
    <h2>Begin the Journey</h2>
    <p>
      Join a disciplined, technology-enabled academic environment built to
      prepare students for elite school entrance success. Over 200 officers
      produced — yours could be the next name on that roll.
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
      <a href="#enquiry" className="btn btn-gold">
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
      <button onClick={() => window.openPP()} className="btn btn-grn">
        Parents Portal →
      </button>
      <a href="#fee-payment" className="btn btn-fee">
        💳 Pay Fee →
      </a>
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
            color: "rgba(248,243,232,.85)",
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
        <a href="#notices">Notice Board</a>
        <a href="#courses">Courses</a>
        <a href="#results">Results</a>
        <a href="#rankers">Ranker Wall</a>
        <a href="#facilities">Facilities</a>
        <a href="#faculty">Faculty</a>
        <a href="#blog">News &amp; Blog</a>
        <a href="#gallery">Gallery</a>
      </div>
      <div>
        <h4>Admissions</h4>
        <a href="#courses">Sainik School Prep</a>
        <a href="#courses">Navodaya Prep</a>
        <a href="#courses">Foundation Programme</a>
        <a href="#courses">Combined Course</a>
        <a href="#enquiry">Apply Now</a>
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
        <a href="#fee-payment" style={{ color: "var(--goldL)" }}>
          💳 Pay Fee Online
        </a>
        <a href="#enquiry">Admission Enquiry</a>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); window.openPP(); }}
          style={{ color: "#4AE382" }}
        >
          Parents Portal
        </a>
        <button
          onClick={onLogin}
          style={{
            display: "block",
            marginBottom: ".55rem",
            color: "rgba(248,243,232,.85)",
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
  {/* PARENTS PORTAL */}
  <div className="pp-overlay" id="ppOverlay">
    <div className="pp-login-wrap" id="ppLoginWrap">
      <button className="pp-close" onClick={() => window.closePP()}>
        ✕
      </button>
      <div className="pp-box">
        <div className="pp-logo">
          <img
            src={EMBLEM_URL}
            alt="GNSI"
            style={{ height: 70, width: 70, objectFit: "contain", margin: "0 auto .8rem", display: "block" }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <h2>Parents Portal</h2>
          <p>GNSI · Khangabok, Manipur</p>
        </div>
        <div className="pp-err" id="ppErr" />
        <label className="pp-fl">GCC No.</label>
        <input
          type="text"
          className="pp-fi"
          id="ppPhone"
          placeholder="e.g. 1107"
        />
        <label className="pp-fl">Student Name</label>
        <input
          type="text"
          className="pp-fi"
          id="ppSid"
          placeholder="Full name as registered"
          onKeyDown={(e) => { if (e.key === 'Enter') window.ppLogin(); }}
        />
        <button className="pp-lbtn" id="ppLbtn" onClick={() => window.ppLogin()}>
          Login to Parents Portal →
        </button>
        <p
          style={{
            color: "rgba(248,243,232,.85)",
            fontSize: ".7rem",
            fontFamily: '"Rajdhani",sans-serif',
            letterSpacing: ".05em",
            textAlign: "center",
            marginTop: "1rem"
          }}
        >
          Contact institute if you need help:{" "}
          <a href="tel:+918974298074" style={{ color: "var(--goldL)" }}>
            +91 89742 98074
          </a>
        </p>
      </div>
    </div>
    <div className="pp-shell" id="ppShell">
      <div className="pp-topbar">
        <div className="pp-topbar-l">
          <img src={EMBLEM_URL} alt="GNSI" style={{ height: 36, width: 36, objectFit: "contain" }} onError={(e) => { e.target.style.display = "none"; }} />
          <div>
            <h3 id="ppDashName">—</h3>
            <p id="ppDashMeta">GNSI Parents Portal</p>
          </div>
        </div>
        <button className="pp-lout" onClick={() => window.ppLogout()}>
          Logout ✕
        </button>
      </div>
      <div className="pp-tabs">
        <button className="pp-tab active" onClick={(e) => window.ppTab('att', e.currentTarget)}>
          📊 Attendance
        </button>
        <button className="pp-tab" onClick={(e) => window.ppTab('exams', e.currentTarget)}>
          📝 Exam Scores
        </button>
        <button className="pp-tab" onClick={(e) => window.ppTab('reportcard', e.currentTarget)}>
          🧾 Report Card
        </button>
        <button className="pp-tab" onClick={(e) => window.ppTab('notices', e.currentTarget)}>
          📣 Notices
        </button>
        <button className="pp-tab" onClick={(e) => window.ppTab('leave', e.currentTarget)}>
          🏠 Hostel Leave
        </button>
        <button className="pp-tab" onClick={(e) => window.ppTab('alerts', e.currentTarget)}>
          🔔 Alerts
        </button>
      </div>
      <div className="pp-content">
        <div className="stu-hdr">
          <div className="stu-av" id="ppAv">
            ?
          </div>
          <div className="stu-info">
            <h3 id="ppStuName">Loading…</h3>
            <p id="ppStuClass">—</p>
            <div className="stu-badges">
              <span className="stu-badge" id="ppStuType">
                —
              </span>
              <span className="stu-badge" id="ppStuStat">
                —
              </span>
            </div>
          </div>
        </div>
        <div className="pp-sec active" id="sec-att">
          <div className="pp-card">
            <div className="pp-card-hd">
              <div className="pp-card-title">This Month's Attendance</div>
              <div
                style={{
                  color: "rgba(248,243,232,.28)",
                  fontSize: ".68rem",
                  fontFamily: '"Rajdhani",sans-serif',
                  letterSpacing: ".06em",
                  textTransform: "uppercase"
                }}
                id="attMonth"
              >
                —
              </div>
            </div>
            <div className="pp-card-body">
              <div className="att-grid" id="attGrid" />
              <div className="att-sum">
                <div className="att-si p">
                  <strong id="attP">—</strong>
                  <span>Present</span>
                </div>
                <div className="att-si a">
                  <strong id="attA">—</strong>
                  <span>Absent</span>
                </div>
                <div className="att-si pct">
                  <strong id="attPct">—</strong>
                  <span>Rate</span>
                </div>
              </div>
            </div>
          </div>
          <div className="pp-card">
            <div className="pp-card-hd">
              <div className="pp-card-title">Last 10 Days</div>
            </div>
            <div className="pp-card-body" id="attRecent">
              <div className="pp-loading">
                <div className="spin" />
                Loading…
              </div>
            </div>
          </div>
        </div>
        <div className="pp-sec" id="sec-exams">
          <div className="pp-card">
            <div className="pp-card-hd">
              <div className="pp-card-title">Exam Results</div>
            </div>
            <div className="pp-card-body" id="examList">
              <div className="pp-loading">
                <div className="spin" />
                Loading…
              </div>
            </div>
          </div>
        </div>
        <div className="pp-sec" id="sec-reportcard">
          <div className="pp-card">
            <div className="pp-card-hd">
              <div className="pp-card-title">Report Card</div>
            </div>
            <div className="pp-card-body">
              <div className="rc-row">
                <div className="rc-col">
                  <label>Exam</label>
                  <select className="rc-select" id="rcExamType" onChange={(e) => window.ppRCExamChange(e.target.value)}>
                    <option value="">Select exam…</option>
                  </select>
                </div>
                <div className="rc-col">
                  <label>Date</label>
                  <select className="rc-select" id="rcExamDate">
                    <option value="">—</option>
                  </select>
                </div>
              </div>
              <p style={{ color: "rgba(248,243,232,.6)", fontSize: ".78rem", fontFamily: "'Rajdhani',sans-serif", letterSpacing: ".03em", marginBottom: "1rem" }}>
                Pick an exam and date, then view or print an official report card showing subject-wise marks, grade and class rank.
              </p>
              <button className="pp-lbtn" id="rcPrintBtn" onClick={() => window.ppPrintReportCard()} disabled>
                🖨️ View / Print Report Card
              </button>
            </div>
          </div>
        </div>
        <div className="pp-sec" id="sec-notices">
          <div className="pp-card">
            <div className="pp-card-hd">
              <div className="pp-card-title">Official Notices</div>
            </div>
            <div className="pp-card-body" id="noticeList">
              <div className="pp-loading">
                <div className="spin" />
                Loading…
              </div>
            </div>
          </div>
        </div>
        <div className="pp-sec" id="sec-leave">
          <div className="pp-card">
            <div className="pp-card-hd">
              <div className="pp-card-title">Hostel Leave History</div>
            </div>
            <div className="pp-card-body" id="leaveList">
              <div className="pp-loading">
                <div className="spin" />
                Loading…
              </div>
            </div>
          </div>
        </div>
        <div className="pp-sec" id="sec-alerts">
          <div className="pp-card">
            <div className="pp-card-hd">
              <div className="pp-card-title">Recent Alerts</div>
            </div>
            <div className="pp-card-body" id="alertList">
              <div className="pp-loading">
                <div className="spin" />
                Loading…
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</>  );
}
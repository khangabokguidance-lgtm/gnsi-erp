import React, { useEffect, useLayoutEffect, useState, useRef } from 'react';
import {
  getActiveNotices, getRankers, getGallery, getVideos, getYouTubeThumb, getYouTubeEmbed,
  getPublishedPosts, getFeaturedReviews, getPapers, getActiveBanners, getFaculty,
  getLiveKPIs, getEvents, submitEnquiry, submitScholarRegistration, submitGrievance,
  getStats, getFeaturedTestimonials, getExamCalendar, getTimeline
} from './websiteApi';
import { supabase } from './supabase';
import ParentsPortal from './ParentsPortal';
import PublicFeeLookup from './PublicFeeLookup';
// Styles used to be injected on every render via <style dangerouslySetInnerHTML>
// (a single ~100KB minified string). Moved to a real .css file so Vite bundles
// and the browser caches it separately from the JS, and normal CSS tooling can
// read it. Place LandingPage.css next to this file.
import './LandingPage.css';

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
const TEN_YEARS_BANNER_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/gnsi-10-years-banner-2400.jpg";

// Latest result/achievement poster — shown as a popup 10s after page load,
// then collapses into a small sticky corner badge. Swap this URL (or the
// path inside it) whenever there's a new poster to feature; upload to the
// same gnsi-public bucket, "posters" folder, following the pattern of
// TEN_YEARS_BANNER_URL above.
const RESULT_POSTER_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/gnsi-result-poster.png";
// GNSI Parents Portal Android app (Capacitor-wrapped, opens straight to
// the portal login via ?portal=1). Hosted in its own "app" Supabase
// storage bucket (public), separate from gnsi-public which holds images.
// Hero image: AISSEE 2026 result poster, hosted in the gnsi-public bucket.
// To swap it later, upload a new image and paste its URL here.
const HERO_RESULT_POSTER_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/photo-2026-09-23-20-14-13-1790175011242.jpg";
// Hero right-column photo (above the Live Dashboard). Upload
// gnsi-freshers-meet-1200.jpg to gnsi-public/banners in Supabase.
const HERO_SIDE_PHOTO_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/gnsi-freshers-meet-1200.jpg";
// Staff group photo (replaces the stats ribbon). Upload
// gnsi-staff-felicitation-1600.jpg to gnsi-public/banners in Supabase.
const STAFF_GROUP_PHOTO_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/gnsi-public/banners/gnsi-staff-felicitation-1600.jpg";
const ANDROID_APP_URL = "https://hiqaqdfhopuakaydfkgb.supabase.co/storage/v1/object/public/app/gnsi-parents-app.apk";

// Small helpers used by the legacy DOM-injection blocks inside the effect
// below (these build raw HTML strings for document.getElementById(...).innerHTML,
// so every value from Supabase must be escaped before being interpolated).
// Hoisted to module scope so they're defined once, not re-created on every
// render/effect-run.
const escapeHtml = (str) =>
  (str ?? '').toString()
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// Shared card for a single ranker/successful-candidate, used by both the
// Results-tab preview strip and the full Toppers' Wall (#rankers) so the
// markup only lives in one place. `index` drives the 01/02/03… rank number
// shown behind the photo when the row has no explicit `rank` (e.g. "AIR 12").
function RankerCard({ ranker, index }) {
  const name = ranker.name || 'GNSI Student';
  return (
    <div className="ranker-card reveal-scale">
      {ranker.rank && <div className="ranker-badge">{ranker.rank}</div>}
      <div className="rc-rank">{String(index + 1).padStart(2, '0')}</div>
      <div className="ranker-photo">
        {ranker.photo_url ? (
          <img
            src={ranker.photo_url}
            alt={name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          name[0]
        )}
      </div>
      <div className="rc-shade" />
      <div className="rc-edge" />
      <div className="rc-cap">
        <h4>{name}</h4>
        <div className="ranker-school">{ranker.school || ''}</div>
        <div className="ranker-batch">{ranker.batch || ''}</div>
      </div>
    </div>
  );
}

// ═══ SESSION DATA CACHE ═══
// Tabs remount on every visit (key={activeTab}), so without a cache every
// tab click re-downloaded its data and first showed the old hardcoded
// fallback until the request finished. Each source is now fetched once per
// page visit and shared (e.g. getStats() was called twice on every tab
// click; getVideos() by both Home and the Videos tab). A failed request is
// dropped from the cache so the next visit to that tab retries it.
const _dataCache = new Map();
function cachedFetch(key, fn) {
  if (!_dataCache.has(key)) {
    const p = Promise.resolve().then(fn).catch((err) => {
      _dataCache.delete(key);
      throw err;
    });
    _dataCache.set(key, p);
  }
  return _dataCache.get(key);
}

// Warms the cache in the background shortly after the page loads, so by
// the time a visitor opens a tab its data is already here and the live
// content appears immediately instead of the stale fallback first.
function prefetchTabData() {
  const jobs = [
    ['notices', () => getActiveNotices(3)],
    ['reviews', () => getFeaturedReviews(6)],
    ['blog', () => getPublishedPosts(6)],
    ['videos', getVideos],
    ['events', getEvents],
    ['papers', getPapers],
    ['faculty', getFaculty],
    ['stats', getStats],
    ['examCalendar', getExamCalendar],
    ['timeline', getTimeline],
  ];
  jobs.forEach(([key, fn]) => { cachedFetch(key, fn).catch(() => {}); });
}

// ═══ URL HASH → TAB ═══
// Lets shared links like guidancekhangabok.in/#faq open the FAQ tab directly
// instead of always landing on Home. #portal is excluded: it opens the
// Parents Portal overlay (isPortalOpen) as before. #contact lives inside
// the Enquiry tab.
const TAB_IDS = new Set([
  'home', 'courses', 'rankers', 'results', 'reviews', 'about', 'head-institute',
  'faculty', 'facilities', 'videos', 'notices', 'blog', 'gallery', 'events',
  'scholarship', 'mock-tests', 'question-papers', 'syllabus', 'exam-calendar',
  'important-dates', 'faq', 'enquiry', 'fee-payment', 'app-download', 'helpdesk',
]);
function hashToTab(hash) {
  const id = decodeURIComponent((hash || '').replace(/^#/, '')).trim();
  if (id === 'contact') return { tab: 'enquiry', scrollTo: 'contact' };
  if (TAB_IDS.has(id)) return { tab: id };
  return { tab: 'home' };
}

// ═══ TAB SECTION HYDRATION ═══
// Every tab is conditionally rendered, so its container (#eventsListEl,
// #facultyGrid, …) only exists while that tab is open. These loaders used
// to run once on first page load — when only Home was mounted — so they
// found nothing and never ran again. Now they run on mount AND every time
// the active tab changes (see the useEffect on [activeTab]). Each loader
// still returns early when its container isn't on screen, so only the
// open tab's data is actually fetched.
function hydrateTabSections(setFeePaymentInfo) {
  // ---- 2. NOTICES (top 3 active, into #publicNoticeCards) ----
  (async () => {
    const grid = document.getElementById('publicNoticeCards');
    if (!grid) return;
    try {
      const notices = await cachedFetch('notices', () => getActiveNotices(3));
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

  // ---- 4. GOOGLE REVIEWS (into #reviewsGrid) ----
  (async () => {
    const grid = document.getElementById('reviewsGrid');
    if (!grid) return;
    try {
      const reviews = await cachedFetch('reviews', () => getFeaturedReviews(6));
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
      const posts = await cachedFetch('blog', () => getPublishedPosts(6));
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

  // ---- 7. VIDEOS (main embed into #mainVideoEmbed, list into #videoListEl) ----
  (async () => {
    const list = document.getElementById('videoListEl');
    if (!list) return;
    try {
      const videos = await cachedFetch('videos', getVideos);
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
      const events = await cachedFetch('events', getEvents);
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
          <div class="event-card reveal vis">
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
      const papers = await cachedFetch('papers', getPapers);
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

  // ---- 10. FACULTY (into #facultyGrid) ----
  (async () => {
    const grid = document.getElementById('facultyGrid');
    if (!grid) return;
    try {
      const faculty = await cachedFetch('faculty', getFaculty);
      if (!faculty.length) return;
      grid.innerHTML = faculty.map((f, idx) => {
        const initials = (f.name || 'F').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase();
        // Accept whichever photo column the row has (photo_url preferred).
        const photo = f.photo_url || f.image_url || f.photo || '';
        return `
          <div class="faculty-card">
            <div class="fc-rank">${String(idx + 1).padStart(2, '0')}</div>
            <div class="faculty-photo" style="position:relative;overflow:hidden">
              ${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(f.name)}" loading="lazy" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center top" onerror="this.remove()" />` : ''}
              ${escapeHtml(initials)}
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
      const stats = await cachedFetch('stats', getStats);

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


      setText('reviews-score-num', stats.google_review_score);
      setText('reviews-score-count', `Based on ${stats.google_review_count} Reviews`);
    } catch (e) { console.error('Stats load failed:', e); }
  })();

  // ---- 10d. EXAM CALENDAR (into #examCalBody) ----
  (async () => {
    const body = document.getElementById('examCalBody');
    if (!body) return;
    try {
      const rows = await cachedFetch('examCalendar', getExamCalendar);
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
      const items = await cachedFetch('timeline', getTimeline);
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
    try {
      const stats = await cachedFetch('stats', getStats);
      setFeePaymentInfo({ upi_id: stats.upi_id || '', upi_qr_url: stats.upi_qr_url || '' });
      const upiBox = document.getElementById('feeUpiBox');
      const bankBox = document.getElementById('feeBankBox');
      if (!upiBox && !bankBox) return;

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

}

export default function LandingPage({ onLogin }) {
  // ═══ DROPDOWN NAVIGATION — categories & subsections ═══
  const [expandedCat, setExpandedCat] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null); // { catIdx, itemIdx }
  // Opens straight to Parents Portal when the page is loaded with
  // ?portal=1 or #portal in the URL — used by the mobile app shell so it
  // can deep-link directly into the portal instead of landing on the
  // homepage and requiring an extra tap. Read once at mount; the button
  // clicks elsewhere on the page still work exactly as before.
  const [isPortalOpen, setIsPortalOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('portal') === '1' || window.location.hash === '#portal';
    } catch (_) {
      return false;
    }
  });
  const [isFeeOpen, setIsFeeOpen] = useState(false);
  const [feePaymentInfo, setFeePaymentInfo] = useState({ upi_id: '', upi_qr_url: '' });
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window === 'undefined') return 'home';
    return hashToTab(window.location.hash).tab;
  });
  const tabContentRef = useRef(null);
  const tabStripRef = useRef(null);
  const [tabStripScroll, setTabStripScroll] = useState({ atStart: true, atEnd: false });

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

  // ═══ RANKERS / SUCCESSFUL CANDIDATES ═══
  // Single source of truth for both the Results-tab preview strip and the
  // full Toppers' Wall (#rankers) — both render via <RankerCard>, so there
  // is only one place that owns this fetch and only one card markup to
  // maintain. Capped to a sane page size; raise RANKERS_LIMIT if the table
  // is known to be small, or add real pagination if it grows large.
  const RANKERS_LIMIT = 60;
  const [rankersData, setRankersData] = useState([]);
  const [rankersLoading, setRankersLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const rankers = await getRankers();
        setRankersData(rankers.slice(0, RANKERS_LIMIT));
      } catch (e) {
        console.error('Rankers load failed:', e);
      } finally {
        setRankersLoading(false);
      }
    })();
  }, []);

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
        const list = await cachedFetch('videos', getVideos);
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
        { label: 'Head of the Institute', href: '#head-institute' },
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
      const tab = e.state && e.state.tab ? e.state.tab : hashToTab(window.location.hash).tab;
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

  // Re-run scroll-reveal observation whenever the active tab changes.
  // Every tab's content is conditionally rendered ({activeTab === 'x' && …}),
  // so a tab like Facilities or Notices mounts its .reveal/.reveal-scale
  // elements fresh each time it's opened. The main reveal-animation
  // IntersectionObserver (elsewhere in this component) only queries the DOM
  // and calls .observe() once, on first mount — it never sees elements that
  // appear later from a tab switch, so they're stuck at opacity:0 (their
  // unrevealed default) until a 3s CSS fallback force-shows them. That
  // fallback makes it merely feel broken/slow rather than truly invisible,
  // but the real fix is observing new .reveal elements as they appear, not
  // waiting on the fallback. This intentionally creates its own short-lived
  // observer rather than reaching into the big effect above (which has
  // documented cross-closure state and isn't safe to restructure).
  useEffect(() => {
    const unrevealed = document.querySelectorAll(
      '.reveal:not(.vis), .reveal-left:not(.vis), .reveal-right:not(.vis), .reveal-scale:not(.vis)'
    );
    if (!unrevealed.length) return;
    const tabRevealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('vis');
      });
    }, { threshold: 0.1 });
    unrevealed.forEach(el => tabRevealObserver.observe(el));
    return () => tabRevealObserver.disconnect();
  }, [activeTab]);

  // Tab pill strip (25 items) is a horizontally-scrolling row. Track
  // scroll position so we can show/hide left/right fade+arrow affordances,
  // and keep the active pill scrolled into view whenever it changes (via
  // click or browser back/forward) so the user always sees which tab is on.
  useEffect(() => {
    const el = tabStripRef.current;
    if (!el) return;
    const updateScrollState = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      setTabStripScroll({
        atStart: el.scrollLeft <= 4,
        atEnd: el.scrollLeft >= maxScroll - 4,
      });
    };
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  useEffect(() => {
    const el = tabStripRef.current;
    if (!el) return;
    const activeBtn = el.querySelector('.tab-nav-btn.active');
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [activeTab]);

  const scrollTabStrip = (dir) => {
    const el = tabStripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.7), behavior: 'smooth' });
  };

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

// ---- 1. LIVE KPI DASHBOARD ----
(async () => {
  try {
    const kpi = await getLiveKPIs();
    // Real value → show it. Query failed (null) → hide that tile/row
    // rather than show a placeholder.
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove('lpulse');
      if (val === null || val === undefined) {
        const box = el.closest('.kpi, .dash-row');
        if (box) box.style.display = 'none';
        return;
      }
      el.textContent = typeof val === 'number' ? val.toLocaleString('en-IN') : val;
    };
    set('kpi-staff', kpi.staff);
    set('kpi-att', kpi.present);
    set('kpi-exams', kpi.exams);
    set('kpi-enq', kpi.enquiries);
    set('kpi-students', kpi.activeStudents);
    set('kpi-next-exam', kpi.nextExam);
    set('kpi-notice', kpi.latestNotice);
  } catch (e) { console.error('KPI load failed:', e); }
})();

// NOTE: Ranker Wall (#rankers / Results-tab preview) is now rendered by
// React directly (see rankersData state + <RankerCard>) instead of being
// injected here — this avoids fetching/rendering the same data twice and
// keeps one source of truth for the card markup.

// (Gallery data is now fetched via a React useEffect inside the component,
// grouped by category into `galleryData` state — see near the top of the
// component body. The old #galleryGrid DOM-injection block was removed.)

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

// ---- 11. LIVE FORM SUBMISSIONS (replaces the 3 mock window.submit* functions) ----
// Clears every field's error state (red border + inline message) — run at
// the top of each submit attempt so a fixed field's error doesn't linger
// after a previous failed attempt.
function clearEnquiryFieldErrors() {
  ['fStuName', 'fParName', 'fPhone', 'fClass', 'fCourse'].forEach(id => {
    const el = document.getElementById(id);
    const errEl = document.getElementById(id + 'Err');
    if (el) el.classList.remove('field-error');
    if (errEl) errEl.classList.remove('show');
  });
}
function markEnquiryFieldError(id) {
  const el = document.getElementById(id);
  const errEl = document.getElementById(id + 'Err');
  if (el) el.classList.add('field-error');
  if (errEl) errEl.classList.add('show');
}

window.submitEnquiry = async () => {
  const msg = document.getElementById('formMsg');
  const btn = document.getElementById('fBtn');
  const studentName = document.getElementById('fStuName')?.value.trim();
  const parentName = document.getElementById('fParName')?.value.trim();
  const phoneRaw = document.getElementById('fPhone')?.value.trim();
  const classGrade = document.getElementById('fClass')?.value.trim();
  const course = document.getElementById('fCourse')?.value;
  const message = document.getElementById('fMsg')?.value.trim();
  // Honeypot — invisible to real visitors; a filled value means a bot
  // submitted the form. Fail silently (looks like success) rather than
  // telling the bot what tripped it, and never call submitEnquiry at all.
  const honeypot = document.getElementById('fWebsite')?.value.trim();

  clearEnquiryFieldErrors();
  if (msg) { msg.style.display = 'none'; }

  if (honeypot) {
    if (msg) { msg.style.display = 'block'; msg.className = 'form-msg success'; msg.textContent = 'Thank you! We will contact you shortly.'; }
    return;
  }

  // Real validation per field, not just "name and phone present" — a
  // phone number is only "real data" if it's actually a phone number.
  // Strips spaces/dashes/+91 before checking so any common formatting the
  // person types still passes.
  const phoneDigits = (phoneRaw || '').replace(/[\s\-()]/g, '').replace(/^\+?91/, '');
  const isValidPhone = /^[6-9]\d{9}$/.test(phoneDigits);

  let firstInvalidId = null;
  if (!studentName) { markEnquiryFieldError('fStuName'); firstInvalidId ||= 'fStuName'; }
  if (!parentName) { markEnquiryFieldError('fParName'); firstInvalidId ||= 'fParName'; }
  if (!phoneRaw || !isValidPhone) { markEnquiryFieldError('fPhone'); firstInvalidId ||= 'fPhone'; }
  if (!classGrade) { markEnquiryFieldError('fClass'); firstInvalidId ||= 'fClass'; }
  if (!course) { markEnquiryFieldError('fCourse'); firstInvalidId ||= 'fCourse'; }

  if (firstInvalidId) {
    if (msg) { msg.style.display = 'block'; msg.className = 'form-msg error'; msg.textContent = 'Please fix the highlighted fields below.'; }
    document.getElementById(firstInvalidId)?.focus();
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  try {
    const { error } = await submitEnquiry({
      student_name: studentName, parent_name: parentName, phone: phoneRaw,
      class_grade: classGrade, course, message,
    });
    if (error) throw error;
    if (msg) { msg.style.display = 'block'; msg.className = 'form-msg success'; msg.textContent = 'Thank you! We will contact you shortly.'; }
    document.getElementById('enquiryForm')?.reset();
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

  // Ticket ID is generated here and passed to submitGrievance, which saves
  // it in the enquiry's course field ("GRIEVANCE: GNSI-GRV-xxxxxx"), so the
  // number the parent sees is the one in the admin panel.
  const ticketId = 'GNSI-GRV-' + Date.now().toString().slice(-6);
  try {
    const { error } = await submitGrievance({
      student_name: name, parent_name: name, phone,
      ticket_id: ticketId,
      message: `[${category}] ${description}`,
    });
    if (error) throw error;
    if (msg) { msg.style.display = 'block'; msg.className = 'grv-msg ok'; msg.textContent = 'Grievance submitted! Ticket ID: ' + ticketId; }
    ['grvName', 'grvPhone', 'grvMsg2'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  } catch (e) {
    console.error('Grievance submit failed:', e);
    if (msg) { msg.style.display = 'block'; msg.className = 'grv-msg err'; msg.textContent = 'Something went wrong. Please try again or call our helpdesk.'; }
  }
};

    // FAQ accordion — now handled by handleFaqClick (React onClick on the
    // .faq container), so it works every time the FAQ tab is opened.

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

      // This effect assigns a number of callbacks onto `window` for inline
      // onclick="..." handlers in injected HTML strings to reach (since
      // those strings can't close over React scope). They must be removed
      // on unmount/re-mount — otherwise a stale closure from a dead render
      // (still referencing this render's setIsFeeOpen/setFeePaymentInfo,
      // stale rbIndex/tIndex, etc.) stays reachable from `window` and can
      // fire again if the component mounts twice (e.g. React StrictMode).
      delete window.rbSlide;
      delete window.tSlide;
      delete window.submitEnquiry;
      delete window.submitScholar;
      delete window.submitGrievance;
      delete window.setLang;
      delete window.sylTab;
      delete window.loadMap;
      delete window.loadMainVideo;
      delete window.fetchAdmitCard;
      delete window.fetchResult;
      delete window.printAdmitCard;
      delete window.__openFeeLookup;
    };
  }, []);

  // Load live data for whichever tab is now on screen (notices, reviews,
  // blog, videos, events, papers, faculty, exam calendar, timeline, fee
  // details). Declared after the main effect above so window.loadMainVideo
  // already exists when the Videos loader calls it.
  // useLayoutEffect (not useEffect): when the data is already cached, the
  // loaders finish in microtasks before the browser paints, so the tab
  // never flashes its old hardcoded content.
  useLayoutEffect(() => {
    hydrateTabSections(setFeePaymentInfo);

    // Performance bars (About tab) mount fresh on every visit, so observe
    // them each time instead of only once at first page load.
    const bars = document.querySelectorAll('.bar-fill');
    if (!bars.length) return;
    const tabBarObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const w = entry.target.getAttribute('data-w');
          if (w) entry.target.style.width = w + '%';
          tabBarObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    bars.forEach(b => tabBarObserver.observe(b));
    return () => tabBarObserver.disconnect();
  }, [activeTab]);

  // Background prefetch of all tab data ~1.5s after load (after the
  // above-the-fold content has had the network to itself).
  useEffect(() => {
    const t = setTimeout(prefetchTabData, 1500);
    return () => clearTimeout(t);
  }, []);

  // Deep link: if the page was opened with a tab hash (e.g. a shared
  // guidancekhangabok.in/#syllabus link), scroll that section into view
  // once it has rendered. The tab itself is picked in useState below.
  useEffect(() => {
    const target = hashToTab(window.location.hash);
    if (target.tab === 'home') return;
    const t = setTimeout(() => {
      document.getElementById(target.scrollTo || target.tab)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => clearTimeout(t);
  }, []);

  // FAQ accordion via React event delegation — one question open at a time.
  const handleFaqClick = (e) => {
    const q = e.target.closest('.faq-q');
    if (!q) return;
    const a = q.nextElementSibling;
    const icon = q.querySelector('.faq-icon');
    const wasOpen = a && a.style.display === 'block';
    e.currentTarget.querySelectorAll('.faq-a').forEach(x => { x.style.display = 'none'; });
    e.currentTarget.querySelectorAll('.faq-icon').forEach(x => { x.textContent = '+'; });
    if (!wasOpen && a) {
      a.style.display = 'block';
      if (icon) icon.textContent = String.fromCharCode(8722);
    }
  };

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
    content="Manipur's premier coaching for NVS, Sainik School & RMS. 95% selection rate. 200+ students selected. New batches: Navodaya from 20 December 2026, Sainik School & Foundation from 10 January 2027."
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
          SCHOOL 2025–26 ◆ NEW NAVODAYA BATCH COMMENCING 20 DECEMBER 2026 ◆ SAINIK &amp; FOUNDATION BATCHES COMMENCING 10 JANUARY 2027 ◆ SUNDAY MOCK TESTS
          ONGOING ◆ EST. 2016 · 200+ STUDENTS SELECTED ◆ CALL +91 89742 98074 ◆
          KHANGABOK, THOUBAL, MANIPUR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;RESULT:
          66 SELECTED IN NVS &amp; SAINIK SCHOOL 2025–26
          ◆ NEW NAVODAYA BATCH COMMENCING 20 DECEMBER 2026 ◆ SAINIK &amp; FOUNDATION BATCHES COMMENCING 10 JANUARY 2027 ◆ SUNDAY MOCK TESTS ONGOING ◆ EST.
          2016 · 200+ STUDENTS SELECTED ◆ CALL +91 89742 98074 ◆ KHANGABOK,
          THOUBAL, MANIPUR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        </div>
      </div>
    </div>
  </div>
  {/* Countdown bar removed — no active admissions deadline (admissions closed Feb) */}
  {/* ② 10-YEARS CELEBRATION BANNER — replaces the old rotating result-banner
      slider; single static full-bleed photo, no text overlay (the banner
      image already carries its own text). */}
  {/* 10-YEARS BANNER — full image at its natural ratio (see
      .ten-years-banner in LandingPage.css: height:auto, no cropping). */}
  <div className="ten-years-banner">
    <div className="tyb-frame">
      <img src={TEN_YEARS_BANNER_URL} alt="Celebrating 10 Years of Success — GNSI" width={2400} height={912} fetchpriority="high" />
    </div>
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
        <a
          href={ANDROID_APP_URL}
          download=""
          className="nav-btn"
          style={{
            fontFamily: 'Inter,sans-serif',
            fontWeight: 700,
            fontSize: ".72rem",
            letterSpacing: ".07em",
            textTransform: "uppercase",
            borderRadius: 10,
            display: "inline-block"
          }}
        >
          📱 Get App →
        </a>
        {/* Reuses the existing (previously unused) .nav-par style — same
            green WhatsApp-family accent the mobile hamburger's "Parents
            Portal" link already uses, so this doesn't introduce a new
            color. Desktop-only (hidden below 900px via .nav-desktop-only)
            since the mobile hamburger menu already has this same action
            ("Parents Portal →" in .mob-menu) — showing both would just
            crowd an already-tight 4-icon mobile bar with a duplicate. */}
        <button
          onClick={() => setIsPortalOpen(true)}
          className="nav-par nav-desktop-only"
          style={{
            fontFamily: 'Inter,sans-serif',
            fontWeight: 700,
            fontSize: ".72rem",
            letterSpacing: ".07em",
            textTransform: "uppercase",
            borderRadius: 10,
            cursor: "pointer",
          }}
        >
          Parents Login →
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
      <a
        href={ANDROID_APP_URL}
        download=""
        className="mob-par"
        onClick={closeMobile}
      >
        📱 Get Android App →
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
        {/* AISSEE 2026 result poster replaces the text headline + stats. */}
        <h1 className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" }}>
          Guidance Navodaya &amp; Sainik Institute — AISSEE 2026 Results: 10 students in Top 10 State Rank
        </h1>
        <div className="hero-enter-1" style={{ width: "100%", maxWidth: 640, margin: "0 auto 1.5rem" }}>
          <img
            src={HERO_RESULT_POSTER_URL}
            alt="GNSI AISSEE 2026 results — 10 students as state toppers, 25+ in top 10,000 All India Rank, 80+ qualified for the written test"
            width={1182}
            height={1280}
            fetchpriority="high"
            style={{ display: "block", width: "100%", height: "auto", borderRadius: 8, boxShadow: "0 10px 30px rgba(0,0,0,.18)" }}
          />
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
            href={ANDROID_APP_URL}
            download=""
            className="btn-brochure"
          >
            📱 Get Android App
          </a>
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
      <div className="hero-side">
      {/* Event photo above the Live Dashboard */}
      <figure className="hero-side-photo">
        <img
          src={HERO_SIDE_PHOTO_URL}
          alt="GNSI students performing a traditional Manipuri dance at the Freshers' Meet cum Felicitation Programme"
          width={1200}
          height={800}
          loading="eager"
          onError={(e) => { e.currentTarget.closest('figure').style.display = 'none'; }}
        />
        <figcaption>Freshers' Meet cum Felicitation Programme</figcaption>
      </figure>
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
            <span>Students Present</span>
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
            <span>Active Students</span>
            <strong id="kpi-students" className="lpulse">
              —
            </strong>
          </div>
          <div className="dash-row">
            <span>Next Exam</span>
            <strong id="kpi-next-exam" className="lpulse">
              —
            </strong>
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
    </div>
  </section>
  {/* STAFF PHOTO — replaces the old stats ribbon. Shown whole at the
      photo's own 3:2 proportion (no cropping). */}
  <div className="ribbon ribbon-photo">
    <figure className="ribbon-photo-fig">
      <img
        src={STAFF_GROUP_PHOTO_URL}
        alt="GNSI faculty and staff at the Freshers' Meet cum Felicitation Programme"
        width={1600}
        height={1067}
        loading="lazy"
        onError={(e) => { e.currentTarget.closest('.ribbon').style.display = 'none'; }}
      />
    </figure>
  </div>
  {/* TAB STRIP — 25 pills, horizontally scrollable on all breakpoints.
      Left/right arrow buttons (desktop only, via CSS) + fade edges give a
      visible cue that there's more to scroll; they hide themselves at
      each end via tabStripScroll. Active pill auto-scrolls into view. */}
  <div className="tab-nav-wrap">
    <div className="tab-nav-strip-outer container">
      <button
        type="button"
        aria-label="Scroll tabs left"
        className={"tab-strip-arrow tab-strip-arrow-l" + (tabStripScroll.atStart ? " is-hidden" : "")}
        onClick={() => scrollTabStrip(-1)}
      >
        ‹
      </button>
      <div
        className={"tab-nav-fade tab-nav-fade-l" + (tabStripScroll.atStart ? " is-hidden" : "")}
      />
      <div className="tab-nav-strip" ref={tabStripRef}>
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
      <div
        className={"tab-nav-fade tab-nav-fade-r" + (tabStripScroll.atEnd ? " is-hidden" : "")}
      />
      <button
        type="button"
        aria-label="Scroll tabs right"
        className={"tab-strip-arrow tab-strip-arrow-r" + (tabStripScroll.atEnd ? " is-hidden" : "")}
        onClick={() => scrollTabStrip(1)}
      >
        ›
      </button>
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
      {rankersLoading ? (
        <div className="ranker-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="ranker-card" key={`ranker-skeleton-${i}`} style={{ opacity: 0.35 }}>
              <div className="ranker-photo" />
              <div className="rc-shade" />
              <div className="rc-edge" />
              <div className="rc-cap">
                <h4>&nbsp;</h4>
                <div className="ranker-school">&nbsp;</div>
                <div className="ranker-batch">&nbsp;</div>
              </div>
            </div>
          ))}
        </div>
      ) : rankersData.length > 0 ? (
        <div className="ranker-grid">
          {rankersData.map((r, i) => (
            <RankerCard ranker={r} index={i} key={r.id || i} />
          ))}
        </div>
      ) : (
        <p style={{ color: 'var(--mist)', fontFamily: 'var(--sans)', fontSize: '.9rem', textAlign: 'center' }}>
          Results will be published here shortly.
        </p>
      )}
      <div className="ranker-cta">
        <a href="#enquiry" onClick={(e) => { e.preventDefault(); goToTab('enquiry'); }} className="btn btn-gold">
          Join the Next Batch →
        </a>
      </div>
      <p className="ranker-note">
        66 students selected in 2025–26 · Contact institute for verified result letters
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

      {rankersData.length > 0 && (
        <>
          <div className="eyebrow reveal" style={{ marginTop: '3rem' }}>Faces of Success</div>
          <h2 className="st reveal">Our Successful Candidates</h2>
          <div className="rule reveal">
            <div className="rule-line" />
            <div className="rule-d" />
            <div className="rule-line" />
          </div>
          {/* Preview only — first 8, same data/markup as the full Toppers' Wall (#rankers) via <RankerCard> */}
          <div className="ranker-grid">
            {rankersData.slice(0, 8).map((r, i) => (
              <RankerCard ranker={r} index={i} key={r.id || i} />
            ))}
          </div>
          <div className="ranker-cta">
            <a
              href="#rankers"
              onClick={(e) => { e.preventDefault(); goToTab('rankers'); }}
              className="btn btn-gold"
            >
              View Full Toppers' Wall →
            </a>
          </div>
        </>
      )}
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
          <div className="faculty-photo" style={{ position: "relative", overflow: "hidden" }}>
            {FOUNDER_PHOTO_URL && (
              <img
                src={FOUNDER_PHOTO_URL}
                alt="Moirangthem Himan Singh"
                loading="lazy"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            )}
            H
          </div>
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
          <h3>New Batches — Admissions Open</h3>
          <p>
            Navodaya (JNVST) batch commences 20 December 2026. Sainik School and
            Foundation batches commence 10 January 2027. Limited seats for both
            day scholars and hostel boarders — call or WhatsApp to reserve.
          </p>
          <div className="notice-date">From 20 Dec 2026 · 10 Jan 2027</div>
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
            batch. Parents are urged to confirm at the earliest.
          </p>
          <div className="notice-date">Limited Seats</div>
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
            <div className="blog-date">Admissions</div>
            <h3>Joining GNSI: What Parents Need to Know</h3>
            <p>
              The Navodaya batch commences on 20 December 2026 and the Sainik
              and Foundation batches on 10 January 2027. Seats are limited.
              Here is everything you need to know about the admission process, courses,
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
        <div className="promo-badge">New Batches · From 20 Dec 2026</div>
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
                <div className="cal-exam">Navodaya Batch</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  GNSI New Session
                </small>
              </td>
              <td>
                <span className="cal-badge cb-gnsi">GNSI</span>
              </td>
              <td colSpan={3} style={{ color: "var(--gold)", fontWeight: 600 }}>
                Commencing 20 December 2026
              </td>
              <td>—</td>
              <td>
                <span className="cal-status cs-open">★ Admissions Open</span>
              </td>
            </tr>
            <tr>
              <td>
                <div className="cal-exam">Sainik &amp; Foundation Batch</div>
                <small style={{ color: "rgba(255,255,255,.75)", fontSize: ".72rem" }}>
                  GNSI New Session
                </small>
              </td>
              <td>
                <span className="cal-badge cb-gnsi">GNSI</span>
              </td>
              <td colSpan={3} style={{ color: "var(--gold)", fontWeight: 600 }}>
                Commencing 10 January 2027
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
            <span className="tl-month">Dec</span>
            <span className="tl-day">20</span>
          </div>
          <div className="tl-dot open" />
          <div className="tl-content open">
            <h4>🎓 GNSI Navodaya Batch Begins</h4>
            <p>
              New Navodaya (JNVST) batch commences at GNSI. Admissions open —
              limited day scholar and hostel seats.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-gnsi">GNSI</span>{" "}
              <span className="cal-badge cb-nvs">NVS</span>
            </span>
          </div>
        </div>
        <div className="tl-item">
          <div className="tl-date">
            <span className="tl-month">Jan</span>
            <span className="tl-day">10</span>
          </div>
          <div className="tl-dot open" />
          <div className="tl-content open">
            <h4>🎓 GNSI Sainik &amp; Foundation Batch Begins</h4>
            <p>
              New Sainik School (AISSEE) and Foundation batches commence at GNSI
              on 10 January 2027. Admissions open — limited seats.
            </p>
            <span className="tl-tag">
              <span className="cal-badge cb-gnsi">GNSI</span>{" "}
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
      <div className="faq reveal" style={{ maxWidth: 720 }} onClick={handleFaqClick}>
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
            The Navodaya (JNVST) batch commences on 20 December 2026. The Sainik
            School and Foundation batches commence on 10 January 2027. For RMS
            and current seat availability, call or WhatsApp the institute.
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
        <form
          className="form-panel reveal"
          id="enquiryForm"
          noValidate
          onSubmit={(e) => { e.preventDefault(); window.submitEnquiry(); }}
        >
          <div className="form-msg" id="formMsg" />
          <div className="form-row">
            <div>
              <label className="fl" htmlFor="fStuName">Student Name <span className="req">*</span></label>
              <input
                type="text"
                className="ff"
                id="fStuName"
                name="student_name"
                placeholder="Full name"
                required
                autoComplete="name"
              />
              <span className="field-err-msg" id="fStuNameErr">Please enter the student's name.</span>
            </div>
            <div>
              <label className="fl" htmlFor="fParName">Parent / Guardian <span className="req">*</span></label>
              <input
                type="text"
                className="ff"
                id="fParName"
                name="parent_name"
                placeholder="Full name"
                required
                autoComplete="name"
              />
              <span className="field-err-msg" id="fParNameErr">Please enter the parent/guardian's name.</span>
            </div>
          </div>
          <label className="fl" htmlFor="fPhone">Phone Number <span className="req">*</span></label>
          <input
            type="tel"
            className="ff"
            id="fPhone"
            name="phone"
            placeholder="+91 XXXXX XXXXX"
            required
            inputMode="tel"
            autoComplete="tel"
          />
          <span className="field-err-msg" id="fPhoneErr">Please enter a valid 10-digit phone number.</span>
          <label className="fl" htmlFor="fClass">Student Class / Age <span className="req">*</span></label>
          <input
            type="text"
            className="ff"
            id="fClass"
            name="class_grade"
            placeholder="e.g. Class 5, Age 10"
            required
          />
          <span className="field-err-msg" id="fClassErr">Please enter the student's class or age.</span>
          <label className="fl" htmlFor="fCourse">Course Interested In <span className="req">*</span></label>
          <select className="ff" id="fCourse" name="course" required defaultValue="">
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
          <span className="field-err-msg" id="fCourseErr">Please select a course.</span>
          <label className="fl" htmlFor="fMsg">Message</label>
          <textarea
            className="ff"
            id="fMsg"
            name="message"
            placeholder="Your question or message"
            defaultValue={""}
          />
          {/* Honeypot — real visitors never see this field (off-screen via
              .hp-field), so if it comes back filled the submission is
              treated as spam. Purely client-side, no schema change. */}
          <div className="hp-field" aria-hidden="true">
            <label htmlFor="fWebsite">Website</label>
            <input type="text" id="fWebsite" name="website" tabIndex={-1} autoComplete="off" />
          </div>
          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: "100%", justifyContent: "center" }}
            id="fBtn"
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
        </form>
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
            href={ANDROID_APP_URL}
            className="app-btn"
            target="_blank"
            rel="noopener noreferrer"
            download=""
          >
            <span className="app-btn-icon">▲</span>
            <div className="app-btn-txt">
              <small>Download for</small>
              <strong>Android APK</strong>
            </div>
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="app-btn"
            style={{ opacity: ".45", cursor: "not-allowed" }}
            title="Coming soon"
          >
            <span className="app-btn-icon">▲</span>
            <div className="app-btn-txt">
              <small>Coming soon</small>
              <strong>Google Play</strong>
            </div>
          </a>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
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
          <img
            src={"https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=4&data=" + encodeURIComponent(ANDROID_APP_URL)}
            alt="QR code to download the GNSI Android app"
            width={80}
            height={80}
            loading="lazy"
            style={{ display: "block", width: 80, height: 80, margin: "0 auto", background: "#fff", borderRadius: 4 }}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
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
        <a
          href={ANDROID_APP_URL}
          download=""
          style={{ color: "#4AE382" }}
        >
          📱 Download Android App
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
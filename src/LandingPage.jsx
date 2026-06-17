//  LandingPage.jsx — GNSI Premium v5
//  NEW FEATURES v5 (NTA-parity):
//  1. Bilingual Hindi/English toggle
//  2. Admit Card download portal
//  3. Result checker portal
//  4. Mock test / practice section
//  5. Exam calendar (full year schedule table)
//  6. Important dates timeline
//  7. App download section (Android APK + future iOS)
//  8. Grievance / helpdesk form
//  9. Enhanced social bar (WhatsApp Channel + all platforms)
//  NEW FEATURES ADDED v4:
//  1. Top contact bar (phone + email + hours above nav)
//  2. Scholarship / Free Mock Test registration section
//  3. Previous year question paper downloads
//  4. Hero result celebration banner (photo slider)
//  5. Syllabus section (NVS + Sainik per subject)
//  + All v3 features retained
// ============================================================
import { useEffect, useRef } from 'react'

const SUPA_URL = 'https://pwrldrngqxbvwfztxxrd.supabase.co'
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3cmxkcm5ncXhidndmenR4eHJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTA0MDYzNzQsImV4cCI6MjAyNTk4MjM3NH0.LPVvDkwRcFHGMXEcr_aDm_3J4Zwy0D4WxUwYAWCFUMs'

function getLandingHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>GNSI — Guidance Navodaya & Sainik Institute | Khangabok, Manipur</title>
<meta name="description" content="GNSI is Manipur's premier residential coaching institute for Navodaya Vidyalaya (NVS), Sainik School and RMS entrance exams. 95% selection rate, 200+ officers produced. Khangabok, Thoubal District."/>
<meta name="keywords" content="Navodaya coaching Manipur, Sainik School coaching Manipur, NVS coaching Thoubal, GNSI Khangabok, Guidance Navodaya Sainik Institute"/>
<meta name="robots" content="index, follow"/>
<meta name="author" content="GNSI Khangabok"/>
<meta property="og:title" content="GNSI — Guidance Navodaya & Sainik Institute | Khangabok, Manipur"/>
<meta property="og:description" content="Manipur's premier coaching for NVS, Sainik School & RMS. 95% selection rate. 200+ officers produced. Admissions open 2026–27."/>
<meta property="og:type" content="website"/>
<meta property="og:url" content="https://guidancekhangabok.in"/>
<meta property="og:image" content="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/og-image.jpg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:site_name" content="GNSI Khangabok"/>
<meta property="og:locale" content="en_IN"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="GNSI — Guidance Navodaya & Sainik Institute"/>
<meta name="twitter:description" content="Manipur's premier coaching for NVS, Sainik School & RMS. 95% selection rate."/>
<meta name="twitter:image" content="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/og-image.jpg"/>
<meta name="theme-color" content="#0B1F3A"/>
<link rel="canonical" href="https://guidancekhangabok.in"/>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%230B1F3A'/><text y='.9em' font-size='60' x='50%' text-anchor='middle' fill='%23B8922A' font-family='Georgia'>G</text></svg>"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Source+Sans+3:wght@300;400;600;700&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"><\/script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "Guidance Navodaya & Sainik Institute",
  "alternateName": "GNSI Khangabok",
  "url": "https://guidancekhangabok.in",
  "logo": "https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/og-image.jpg",
  "description": "Manipur's premier residential coaching institute for NVS, Sainik School and RMS entrance examinations.",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Khangabok",
    "addressLocality": "Thoubal",
    "addressRegion": "Manipur",
    "postalCode": "795138",
    "addressCountry": "IN"
  },
  "telephone": "+918974298074",
  "foundingDate": "2016",
  "areaServed": "Manipur, India"
}
<\/script>
<style>
:root{
  --navy:#0B1F3A;--navy2:#0F2A4E;--navy3:#153561;--navy4:#1B4080;
  --gold:#B8922A;--goldL:#D4AE50;--goldLL:#EDD180;--goldD:#7A5E12;
  --saffron:#CF5A0D;--cream:#F8F3E8;--creamD:#EDE5CE;--creamDD:#D4C9A8;
  --slate:#3D4F6B;--mist:#7A8FA8;--white:#FAFBFC;
  --red:#8B1A1A;--green:#1A5C2A;--wa:#25D366;
}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;font-size:clamp(15px,2.2vw,18px)}
body{font-family:'Source Sans 3',sans-serif;background:var(--white);color:var(--navy);overflow-x:hidden;font-size:clamp(0.95rem,2.5vw,1.05rem)}
h1,h2,h3,h4,h5{font-family:'EB Garamond',serif;line-height:1.1}
a{text-decoration:none;color:inherit}
img{max-width:100%;display:block}
.container{width:min(1200px,92%);margin:auto}

/* ═══ TOP CONTACT BAR ═══ */
.top-bar{background:var(--navy2);border-bottom:1px solid rgba(184,146,42,.15);padding:.45rem 5%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem}
.top-bar-left{display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap}
.top-bar-item{display:flex;align-items:center;gap:.4rem;color:rgba(248,243,232,.55);font-family:'Rajdhani',sans-serif;font-size:clamp(.65rem,1.8vw,.75rem);letter-spacing:.06em;text-decoration:none;transition:.2s}
.top-bar-item:hover{color:var(--goldL)}
.top-bar-item span{color:var(--goldL);font-size:.8rem}
.top-bar-right{display:flex;align-items:center;gap:.8rem}
.top-bar-hours{color:rgba(248,243,232,.35);font-family:'Rajdhani',sans-serif;font-size:clamp(.62rem,1.7vw,.72rem);letter-spacing:.06em;text-transform:uppercase}
.top-bar-social{display:flex;gap:.4rem}
.top-bar-soc{width:22px;height:22px;border:1px solid rgba(184,146,42,.2);display:flex;align-items:center;justify-content:center;color:rgba(248,243,232,.35);font-size:.6rem;font-weight:700;font-family:'Rajdhani',sans-serif;transition:.2s;text-decoration:none}
.top-bar-soc:hover{border-color:var(--goldL);color:var(--goldL)}

/* ═══ HERO RESULT BANNER SLIDER ═══ */
.result-banner{background:var(--navy);border-bottom:2px solid var(--gold);overflow:hidden;position:relative}
.result-banner-track{display:flex;transition:transform .7s cubic-bezier(.25,.46,.45,.94)}
.result-banner-slide{min-width:100%;position:relative;height:clamp(180px,35vw,320px);display:flex;align-items:center;overflow:hidden}
.result-banner-slide img{width:100%;height:100%;object-fit:cover;opacity:.55}
.result-banner-overlay{position:absolute;inset:0;background:linear-gradient(90deg,rgba(11,31,58,.92) 0%,rgba(11,31,58,.6) 50%,rgba(11,31,58,.2) 100%);display:flex;align-items:center;padding:0 8%}
.result-banner-content{max-width:600px}
.result-banner-year{font-family:'Rajdhani',sans-serif;font-size:clamp(.72rem,2vw,.82rem);letter-spacing:.25em;text-transform:uppercase;color:var(--goldL);margin-bottom:.5rem}
.result-banner-title{font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,2.8rem);color:var(--cream);line-height:1.1;margin-bottom:.6rem}
.result-banner-title strong{color:var(--goldLL)}
.result-banner-sub{color:rgba(248,243,232,.6);font-size:clamp(.82rem,2.2vw,.95rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em}
.result-banner-nav{position:absolute;bottom:.8rem;right:1.5rem;display:flex;gap:.4rem}
.rb-dot{width:6px;height:6px;border-radius:50%;background:rgba(248,243,232,.25);border:1px solid rgba(184,146,42,.3);cursor:pointer;transition:.2s}
.rb-dot.active{background:var(--gold);border-color:var(--gold)}
.rb-prev,.rb-next{position:absolute;top:50%;transform:translateY(-50%);width:32px;height:32px;background:rgba(11,31,58,.7);border:1px solid rgba(184,146,42,.3);color:var(--goldL);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1rem;transition:.2s;z-index:5}
.rb-prev{left:.8rem}.rb-next{right:.8rem}
.rb-prev:hover,.rb-next:hover{background:rgba(184,146,42,.2)}

/* ═══ SCHOLARSHIP / FREE TEST ═══ */
.scholar-section{background:linear-gradient(135deg,var(--navy3),var(--navy));padding:5rem 0;position:relative;overflow:hidden}
.scholar-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(60deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 30px)}
.scholar-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:start}
.scholar-info .eyebrow{color:var(--goldL)}
.scholar-info .eyebrow::before{background:var(--gold)}
.scholar-info h2.st{color:var(--cream)}
.scholar-info p{color:rgba(248,243,232,.6);line-height:1.85;font-size:clamp(.9rem,2.4vw,.97rem);margin-bottom:1.2rem}
.scholar-benefits{list-style:none;margin-bottom:1.5rem}
.scholar-benefits li{color:rgba(248,243,232,.7);font-size:clamp(.85rem,2.3vw,.92rem);padding:.45rem 0;border-bottom:1px solid rgba(184,146,42,.1);display:flex;align-items:center;gap:.6rem}
.scholar-benefits li::before{content:'✦';color:var(--gold);font-size:.7rem;flex-shrink:0}
.scholar-form-box{background:rgba(11,31,58,.7);border:1px solid rgba(184,146,42,.25);padding:1.8rem}
.scholar-form-box h3{color:var(--goldL);font-family:'EB Garamond',serif;font-size:clamp(1.1rem,3vw,1.4rem);margin-bottom:.4rem}
.scholar-form-box p{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.06em;text-transform:uppercase;margin-bottom:1.2rem}
.scholar-label{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.65rem,1.8vw,.72rem);letter-spacing:.14em;text-transform:uppercase;color:rgba(248,243,232,.4);margin-bottom:.35rem}
.scholar-input{width:100%;padding:10px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(184,146,42,.2);color:var(--cream);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1rem;transition:.2s}
.scholar-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}
.scholar-select{width:100%;padding:10px 14px;background:var(--navy2);border:1px solid rgba(184,146,42,.2);color:var(--cream);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1rem}
.scholar-btn{width:100%;padding:.9rem;background:var(--gold);color:var(--navy);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.85rem,2.4vw,.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s}
.scholar-btn:hover{background:var(--goldL)}
.scholar-msg{padding:.6rem 1rem;margin-bottom:.8rem;font-size:clamp(.8rem,2.2vw,.88rem);font-family:'Rajdhani',sans-serif;display:none}
.scholar-msg.ok{background:rgba(26,92,42,.3);color:#4AE382;border:1px solid rgba(26,92,42,.4)}
.scholar-msg.err{background:rgba(139,26,26,.25);color:#f87171;border:1px solid rgba(139,26,26,.4)}
.test-dates{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:1.2rem}
.test-date-card{background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.15);padding:.7rem .9rem;text-align:center}
.test-date-card .tdate{display:block;font-family:'EB Garamond',serif;font-size:clamp(1rem,2.8vw,1.2rem);color:var(--goldLL);line-height:1}
.test-date-card .tlabel{font-family:'Rajdhani',sans-serif;font-size:clamp(.62rem,1.7vw,.7rem);letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.35);margin-top:.2rem;display:block}

/* ═══ QUESTION PAPERS ═══ */
.papers-section{padding:5rem 0;background:var(--cream)}
.papers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem;margin-top:1.5rem}
.papers-card{background:var(--white);border:1px solid var(--creamDD);border-top:3px solid var(--navy3);padding:1.4rem;transition:.25s}
.papers-card.sainik{border-top-color:var(--red)}
.papers-card.nvs{border-top-color:var(--navy3)}
.papers-card.rms{border-top-color:var(--green)}
.papers-card:hover{box-shadow:0 8px 24px rgba(11,31,58,.1);transform:translateY(-3px)}
.papers-card h3{color:var(--navy);font-size:clamp(1rem,2.8vw,1.15rem);margin-bottom:.3rem}
.papers-card .papers-sub{color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:clamp(.7rem,1.9vw,.78rem);letter-spacing:.08em;text-transform:uppercase;margin-bottom:1rem}
.paper-link{display:flex;align-items:center;justify-content:space-between;padding:.5rem .7rem;border:1px solid var(--creamDD);margin-bottom:.4rem;background:var(--cream);transition:.2s;text-decoration:none;color:var(--navy)}
.paper-link:hover{background:var(--gold);border-color:var(--gold);color:var(--navy)}
.paper-link:hover .paper-dl{color:var(--navy)}
.paper-name{font-family:'Rajdhani',sans-serif;font-weight:600;font-size:clamp(.78rem,2.1vw,.85rem);letter-spacing:.04em}
.paper-dl{color:var(--goldD);font-size:.9rem;transition:.2s}
.papers-note{color:var(--mist);font-size:clamp(.72rem,2vw,.8rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em;margin-top:.8rem;line-height:1.6}
.papers-cta{margin-top:1rem;display:block;width:100%;padding:.6rem;background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.2s;text-align:center;border:none}
.papers-cta:hover{background:var(--navy3)}

/* ═══ SYLLABUS ═══ */
.syllabus-section{padding:5rem 0;background:var(--white)}
.syllabus-tabs{display:flex;gap:.4rem;margin-bottom:1.5rem;flex-wrap:wrap}
.syl-tab{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.82rem);letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1.1rem;border:1px solid var(--creamDD);background:transparent;color:var(--slate);cursor:pointer;transition:.2s}
.syl-tab.active{background:var(--navy);color:var(--goldL);border-color:var(--navy)}
.syl-tab:hover:not(.active){border-color:var(--gold);color:var(--goldD)}
.syl-panel{display:none}.syl-panel.active{display:block}
.syl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1rem}
.syl-card{background:var(--cream);border:1px solid var(--creamDD);border-left:3px solid var(--gold);padding:1.2rem}
.syl-card h4{color:var(--navy);font-size:clamp(.95rem,2.6vw,1.05rem);margin-bottom:.7rem;display:flex;align-items:center;gap:.5rem}
.syl-card h4 span{font-size:1.1rem}
.syl-topics{list-style:none}
.syl-topics li{color:var(--slate);font-size:clamp(.8rem,2.2vw,.87rem);padding:.25rem 0;border-bottom:1px solid var(--creamDD);display:flex;align-items:center;gap:.4rem}
.syl-topics li:last-child{border:none}
.syl-topics li::before{content:'▸';color:var(--gold);font-size:.7rem;flex-shrink:0}
.syl-marks{display:inline-block;background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.1em;padding:.15rem .4rem;margin-left:.4rem;vertical-align:middle}
.syl-download{display:flex;align-items:center;gap:.5rem;margin-top:1.2rem;padding:.55rem 1rem;background:var(--cream);border:1px solid var(--creamDD);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.2s;text-decoration:none;display:inline-flex}
.syl-download:hover{background:var(--gold);border-color:var(--gold)}

/* ═══ LANGUAGE TOGGLE ═══ */
#langBar{background:rgba(11,31,58,.98);border-bottom:1px solid rgba(184,146,42,.12);padding:.3rem 5%;display:flex;align-items:center;justify-content:flex-end;gap:.6rem}
.lang-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;padding:.28rem .75rem;border:1px solid rgba(184,146,42,.25);background:transparent;color:rgba(248,243,232,.45);cursor:pointer;transition:.2s}
.lang-btn.active{background:var(--gold);color:var(--navy);border-color:var(--gold)}
.lang-btn:hover:not(.active){border-color:var(--goldL);color:var(--goldL)}
[data-hi]{display:none}
body.hi [data-en]{display:none}
body.hi [data-hi]{display:block}
body.hi span[data-hi]{display:inline}
body.hi span[data-en]{display:none}

/* ═══ ADMIT CARD PORTAL ═══ */
.portal-section{background:var(--navy);padding:5rem 0;position:relative;overflow:hidden}
.portal-section::before{content:'';position:absolute;inset:0;opacity:.03;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 28px)}
.portal-grid{display:grid;grid-template-columns:1fr 1fr;gap:2rem;margin-top:2rem}
.portal-box{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.22);padding:1.8rem;transition:.2s}
.portal-box:hover{border-color:rgba(184,146,42,.4)}
.portal-box-hd{display:flex;align-items:center;gap:.8rem;margin-bottom:1.2rem}
.portal-icon{width:42px;height:42px;background:rgba(184,146,42,.15);border:1px solid rgba(184,146,42,.3);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0}
.portal-box-hd h3{color:var(--cream);font-size:clamp(1rem,2.8vw,1.15rem)}
.portal-box-hd p{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.06em;text-transform:uppercase}
.portal-input{width:100%;padding:11px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(184,146,42,.2);color:var(--cream);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.8rem;transition:.2s}
.portal-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}
.portal-input::placeholder{color:rgba(248,243,232,.22)}
.portal-select{width:100%;padding:11px 14px;background:var(--navy2);border:1px solid rgba(184,146,42,.2);color:var(--cream);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.8rem}
.portal-btn{width:100%;padding:.85rem;background:var(--gold);color:var(--navy);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.85rem,2.4vw,.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s}
.portal-btn:hover{background:var(--goldL)}
.portal-btn:disabled{opacity:.5;cursor:not-allowed}
.portal-result{margin-top:1rem;padding:1rem;border:1px solid rgba(184,146,42,.2);background:rgba(11,31,58,.5);display:none}
.portal-result.show{display:block}
.portal-result.ok{border-color:rgba(26,92,42,.4);background:rgba(26,92,42,.15)}
.portal-result.err{border-color:rgba(139,26,26,.4);background:rgba(139,26,26,.15)}
.portal-result h4{color:var(--goldLL);font-size:clamp(.92rem,2.5vw,1rem);margin-bottom:.6rem}
.portal-row{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid rgba(184,146,42,.08);font-size:clamp(.78rem,2.1vw,.85rem)}
.portal-row:last-child{border:none}
.portal-row span{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.06em;text-transform:uppercase}
.portal-row strong{color:var(--cream)}
.admit-download{display:flex;width:100%;margin-top:.9rem;padding:.7rem;background:var(--green);color:#fff;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.78rem,2.1vw,.85rem);letter-spacing:.1em;text-transform:uppercase;border:none;cursor:pointer;transition:.2s;align-items:center;justify-content:center;gap:.5rem}
.admit-download:hover{background:#1e7a34}

/* ═══ EXAM CALENDAR ═══ */
.calendar-section{padding:5rem 0;background:var(--cream)}
.cal-table-wrap{overflow-x:auto;margin-top:1.5rem}
.cal-table{width:100%;border-collapse:collapse;min-width:600px}
.cal-table th{background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.68rem,1.8vw,.78rem);letter-spacing:.12em;text-transform:uppercase;padding:.75rem 1rem;text-align:left;border-bottom:2px solid var(--gold)}
.cal-table td{padding:.7rem 1rem;border-bottom:1px solid var(--creamDD);font-size:clamp(.8rem,2.2vw,.88rem);color:var(--slate);vertical-align:middle}
.cal-table tr:hover td{background:rgba(184,146,42,.05)}
.cal-table tr:last-child td{border:none}
.cal-exam{font-weight:600;color:var(--navy);font-family:'Rajdhani',sans-serif;letter-spacing:.04em}
.cal-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.15rem .5rem;border-radius:2px}
.cb-nvs{background:rgba(21,53,97,.12);color:var(--navy3);border:1px solid rgba(21,53,97,.2)}
.cb-sainik{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.2)}
.cb-rms{background:rgba(26,92,42,.1);color:var(--green);border:1px solid rgba(26,92,42,.2)}
.cb-gnsi{background:rgba(184,146,42,.15);color:var(--goldD);border:1px solid rgba(184,146,42,.25)}
.cal-status{display:inline-flex;align-items:center;gap:.3rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase}
.cs-upcoming{color:var(--green)}
.cs-open{color:var(--gold)}
.cs-closed{color:var(--mist)}
.cs-done{color:#f87171}
.cal-download{display:inline-flex;align-items:center;gap:.4rem;margin-top:1.2rem;padding:.5rem 1.2rem;background:var(--navy);color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.1em;text-transform:uppercase;border:none;cursor:pointer;transition:.2s;text-decoration:none}
.cal-download:hover{background:var(--navy3)}

/* ═══ IMPORTANT DATES TIMELINE ═══ */
.timeline-section{padding:5rem 0;background:var(--white)}
.timeline{position:relative;max-width:860px;margin-top:2rem}
.timeline::before{content:'';position:absolute;left:110px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--gold),rgba(184,146,42,.1))}
.tl-item{display:flex;gap:1.5rem;margin-bottom:1.5rem;position:relative;align-items:flex-start}
.tl-date{min-width:100px;text-align:right;flex-shrink:0}
.tl-month{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.72rem,2vw,.82rem);letter-spacing:.12em;text-transform:uppercase;color:var(--mist)}
.tl-day{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.2rem,3vw,1.5rem);color:var(--navy);line-height:1}
.tl-dot{width:14px;height:14px;border-radius:50%;border:2px solid var(--gold);background:var(--white);flex-shrink:0;margin-top:.35rem;position:relative;z-index:2;transition:.2s}
.tl-item:hover .tl-dot{background:var(--gold)}
.tl-dot.done{background:var(--creamDD);border-color:var(--creamDD)}
.tl-dot.open{background:var(--gold);border-color:var(--gold);box-shadow:0 0 0 4px rgba(184,146,42,.2)}
.tl-dot.upcoming{background:var(--white);border-color:var(--navy3)}
.tl-content{flex:1;padding:.6rem .9rem;border:1px solid var(--creamDD);border-left:3px solid var(--creamDD);background:var(--white);transition:.25s}
.tl-item:hover .tl-content{border-left-color:var(--gold);box-shadow:4px 0 12px rgba(184,146,42,.08)}
.tl-content.open{border-left-color:var(--gold);background:rgba(184,146,42,.03)}
.tl-content.done{opacity:.6}
.tl-content h4{color:var(--navy);font-size:clamp(.9rem,2.4vw,1rem);margin-bottom:.2rem}
.tl-content p{color:var(--slate);font-size:clamp(.78rem,2.1vw,.85rem);line-height:1.6}
.tl-tag{display:inline-block;margin-top:.4rem}

/* ═══ MOCK TEST ═══ */
.mocktest-section{background:linear-gradient(135deg,var(--navy2),var(--navy3));padding:5rem 0;position:relative;overflow:hidden}
.mocktest-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(135deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 25px)}
.mocktest-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start}
.mock-cards{display:flex;flex-direction:column;gap:.75rem}
.mock-card{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.18);padding:1.1rem 1.3rem;display:flex;align-items:center;gap:1rem;transition:.25s;cursor:pointer;text-decoration:none}
.mock-card:hover{border-color:var(--gold);transform:translateX(4px);background:rgba(21,53,97,.8)}
.mock-icon{width:44px;height:44px;background:rgba(184,146,42,.15);border:1px solid rgba(184,146,42,.25);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0}
.mock-card-title{color:var(--cream);font-size:clamp(.88rem,2.4vw,.97rem);margin-bottom:.2rem}
.mock-card-sub{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:clamp(.65rem,1.8vw,.72rem);letter-spacing:.08em;text-transform:uppercase}
.mock-card-arrow{color:var(--goldL);font-size:1rem;margin-left:auto;flex-shrink:0}
.mock-info h3{color:var(--goldL);font-size:clamp(1.1rem,3vw,1.4rem);margin-bottom:.8rem}
.mock-info p{color:rgba(248,243,232,.6);line-height:1.85;font-size:clamp(.88rem,2.3vw,.95rem);margin-bottom:1.2rem}
.mock-features{list-style:none;margin-bottom:1.5rem}
.mock-features li{color:rgba(248,243,232,.7);font-size:clamp(.85rem,2.3vw,.92rem);padding:.4rem 0;border-bottom:1px solid rgba(184,146,42,.1);display:flex;align-items:center;gap:.6rem}
.mock-features li::before{content:'✦';color:var(--gold);font-size:.7rem;flex-shrink:0}

/* ═══ APP DOWNLOAD ═══ */
.app-section{background:var(--navy);padding:4rem 0;border-top:1px solid rgba(184,146,42,.15)}
.app-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center}
.app-info h2{color:var(--cream);font-size:clamp(1.4rem,3.5vw,2rem);margin-bottom:.7rem}
.app-info p{color:rgba(248,243,232,.55);line-height:1.85;font-size:clamp(.88rem,2.3vw,.95rem);margin-bottom:1.4rem}
.app-features{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:1.5rem}
.app-feat{background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.15);padding:.6rem .8rem;font-family:'Rajdhani',sans-serif;font-size:clamp(.72rem,2vw,.8rem);letter-spacing:.05em;color:rgba(248,243,232,.65);display:flex;align-items:center;gap:.4rem}
.app-btns{display:flex;gap:.8rem;flex-wrap:wrap}
.app-btn{display:inline-flex;align-items:center;gap:.7rem;padding:.75rem 1.3rem;border:1px solid rgba(184,146,42,.3);background:rgba(21,53,97,.5);color:var(--cream);text-decoration:none;transition:.25s}
.app-btn:hover{border-color:var(--gold);background:rgba(184,146,42,.1)}
.app-btn-icon{font-size:1.4rem;flex-shrink:0}
.app-btn-txt small{display:block;font-family:'Rajdhani',sans-serif;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.4);margin-bottom:.1rem}
.app-btn-txt strong{display:block;font-size:clamp(.85rem,2.3vw,.95rem);font-weight:600}
.app-mockup{background:rgba(21,53,97,.4);border:1px solid rgba(184,146,42,.2);padding:2rem;text-align:center;position:relative}
.app-screen{background:var(--navy2);border:2px solid rgba(184,146,42,.25);border-radius:12px;padding:1.5rem;max-width:220px;margin:0 auto}
.app-screen-hd{background:rgba(184,146,42,.15);border-bottom:1px solid rgba(184,146,42,.15);padding:.6rem .8rem;margin:-.5rem -.5rem .8rem;display:flex;align-items:center;gap:.5rem;border-radius:8px 8px 0 0}
.app-screen-hd span{font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--goldL)}
.app-screen-row{display:flex;justify-content:space-between;padding:.4rem 0;border-bottom:1px solid rgba(184,146,42,.08);font-size:.72rem}
.app-screen-row span{color:rgba(248,243,232,.38);font-family:'Rajdhani',sans-serif}
.app-screen-row strong{color:var(--goldLL);font-family:'Rajdhani',sans-serif}
.app-qr{margin-top:1.2rem;padding:.8rem;background:rgba(255,255,255,.08);border:1px solid rgba(184,146,42,.15);display:inline-block}
.app-qr p{font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(248,243,232,.35);margin-top:.4rem;text-align:center}

/* ═══ GRIEVANCE / HELPDESK ═══ */
.helpdesk-section{padding:5rem 0;background:var(--cream)}
.helpdesk-grid{display:grid;grid-template-columns:1fr 1fr;gap:2.5rem;align-items:start}
.helpdesk-info p{color:var(--slate);line-height:1.85;font-size:clamp(.9rem,2.4vw,.97rem);margin-bottom:1.2rem}
.helpdesk-contacts{display:flex;flex-direction:column;gap:.7rem}
.hc-item{background:var(--white);border:1px solid var(--creamDD);border-left:3px solid var(--gold);padding:.9rem 1rem;display:flex;align-items:center;gap:.9rem;transition:.2s}
.hc-item:hover{box-shadow:4px 0 12px rgba(184,146,42,.1)}
.hc-icon{font-size:1.3rem;flex-shrink:0}
.hc-label{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.1em;text-transform:uppercase;color:var(--mist);display:block}
.hc-val{color:var(--navy);font-size:clamp(.85rem,2.3vw,.92rem);font-weight:600}
.hc-val a{color:var(--goldD);text-decoration:none}
.hc-val a:hover{color:var(--gold)}
.helpdesk-form{background:var(--white);border:1px solid var(--creamDD);padding:1.8rem}
.helpdesk-form h3{color:var(--navy);font-size:clamp(1rem,2.8vw,1.15rem);margin-bottom:.3rem}
.helpdesk-form p{color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:clamp(.68rem,1.8vw,.75rem);letter-spacing:.06em;margin-bottom:1.2rem}
.grv-input{width:100%;padding:10px 14px;border:1px solid var(--creamDD);background:var(--cream);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.9rem;transition:.2s}
.grv-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}
.grv-select{width:100%;padding:10px 14px;border:1px solid var(--creamDD);background:var(--cream);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.9rem}
.grv-textarea{width:100%;padding:10px 14px;border:1px solid var(--creamDD);background:var(--cream);color:var(--navy);font-size:clamp(.88rem,2.3vw,.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:.9rem;min-height:90px;resize:vertical}
.grv-btn{width:100%;padding:.85rem;background:var(--navy);color:var(--goldL);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(.85rem,2.4vw,.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s}
.grv-btn:hover{background:var(--navy3)}
.grv-msg{padding:.6rem 1rem;margin-bottom:.8rem;font-size:clamp(.8rem,2.2vw,.88rem);font-family:'Rajdhani',sans-serif;display:none}
.grv-msg.ok{background:#E8F4ED;color:var(--green);border:1px solid rgba(26,92,42,.3)}
.grv-msg.err{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.3)}
.ticket-id{font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.1em;color:var(--gold)}

/* SCROLL REVEAL */
.reveal{opacity:0;transform:translateY(28px);transition:opacity .65s ease,transform .65s ease}
.reveal.vis{opacity:1;transform:none}
.reveal-left{opacity:0;transform:translateX(-32px);transition:opacity .65s ease,transform .65s ease}
.reveal-left.vis{opacity:1;transform:none}
.reveal-right{opacity:0;transform:translateX(32px);transition:opacity .65s ease,transform .65s ease}
.reveal-right.vis{opacity:1;transform:none}
.reveal-scale{opacity:0;transform:scale(.94);transition:opacity .65s ease,transform .65s ease}
.reveal-scale.vis{opacity:1;transform:scale(1)}

/* SCROLL PROGRESS */
#sp{position:fixed;top:0;left:0;z-index:9999;height:3px;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green));width:0%;transition:width .1s;pointer-events:none}

/* STICKY APPLY BAR */
#stickyBar{position:fixed;bottom:0;left:0;right:0;z-index:990;background:var(--navy);border-top:2px solid var(--gold);padding:.75rem 5%;display:flex;align-items:center;justify-content:space-between;transform:translateY(100%);transition:transform .4s cubic-bezier(.25,.46,.45,.94);gap:1rem;flex-wrap:wrap}
#stickyBar.show{transform:translateY(0)}
#stickyBar p{color:rgba(248,243,232,.7);font-size:clamp(0.78rem,2vw,0.88rem);font-family:'Rajdhani',sans-serif;letter-spacing:.04em}
#stickyBar p strong{color:var(--goldL)}
.sticky-btns{display:flex;gap:.6rem;align-items:center;flex-shrink:0}
.sb-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.1rem;cursor:pointer;border:none;transition:.2s}
.sb-btn-gold{background:var(--gold);color:var(--navy)}
.sb-btn-gold:hover{background:var(--goldL)}
.sb-btn-wa{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.3)!important;color:#4AE382}
.sb-close{background:none;border:none;color:rgba(248,243,232,.35);cursor:pointer;font-size:1.1rem;padding:.2rem .4rem;flex-shrink:0}

/* ALERT */
.alert-strip{background:var(--red);color:#fff;font-size:clamp(0.78rem,2.2vw,0.88rem);letter-spacing:.04em;padding:.55rem 5%;display:flex;justify-content:space-between;align-items:center;font-family:'Rajdhani',sans-serif;font-weight:600;text-transform:uppercase}
.alert-strip button{background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0}

/* TICKER */
.ticker-wrap{background:var(--navy);overflow:hidden;border-bottom:2px solid var(--gold)}
.ticker-inner{display:flex;align-items:center;height:36px}
.ticker-label{background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.15em;text-transform:uppercase;padding:0 1.2rem;height:100%;display:flex;align-items:center;white-space:nowrap;flex-shrink:0}
.ticker-scroll{overflow:hidden;flex:1}
.ticker-track{display:inline-block;min-width:200%;animation:tkscroll 38s linear infinite;color:var(--goldLL);font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.14em;font-family:'Rajdhani',sans-serif;font-weight:500;white-space:nowrap;padding-left:2rem}
@keyframes tkscroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

/* ═══ COUNTDOWN TIMER ═══ */
.countdown-bar{background:linear-gradient(135deg,var(--navy3),var(--navy));border-bottom:1px solid rgba(184,146,42,.3);padding:.9rem 5%;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.8rem}
.countdown-label{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.78rem,2.2vw,0.88rem);letter-spacing:.15em;text-transform:uppercase;display:flex;align-items:center;gap:.5rem}
.countdown-label::before{content:'⚑';color:var(--saffron)}
.countdown-units{display:flex;gap:.5rem;align-items:center}
.cd-unit{background:rgba(11,31,58,.8);border:1px solid rgba(184,146,42,.3);padding:.35rem .6rem;text-align:center;min-width:52px}
.cd-num{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.3rem,3.5vw,1.8rem);color:var(--goldLL);line-height:1;font-weight:700}
.cd-lbl{display:block;font-family:'Rajdhani',sans-serif;font-size:clamp(0.55rem,1.5vw,0.65rem);color:rgba(248,243,232,.4);letter-spacing:.1em;text-transform:uppercase}
.cd-sep{color:var(--gold);font-size:1.2rem;font-weight:700;align-self:flex-start;padding-top:.35rem}
.countdown-cta{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.45rem 1.1rem;background:var(--gold);color:var(--navy);border:none;cursor:pointer;transition:.2s;white-space:nowrap}
.countdown-cta:hover{background:var(--goldL)}

/* NAV */
nav{position:sticky;top:0;z-index:1000;background:rgba(11,31,58,.97);backdrop-filter:blur(16px);border-bottom:1px solid rgba(184,146,42,.3)}
.nav-inner{width:min(1200px,92%);margin:auto;height:70px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:14px;text-decoration:none}
.crest{width:46px;height:46px;border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.crest-i{width:32px;height:32px;border:1px solid rgba(184,146,42,.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-weight:700;font-size:1rem;color:var(--goldL)}
.brand-text h2{font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--cream);font-size:clamp(0.9rem,2.5vw,1rem);letter-spacing:.12em;text-transform:uppercase}
.brand-text small{display:block;color:var(--goldL);font-size:clamp(0.58rem,1.5vw,0.65rem);letter-spacing:.2em;text-transform:uppercase;opacity:.8}
.nav-links{display:flex;list-style:none;gap:.4rem;align-items:center}
.nav-links a{color:rgba(248,243,232,.65);font-size:clamp(0.68rem,1.8vw,0.78rem);text-transform:uppercase;letter-spacing:.07em;font-family:'Rajdhani',sans-serif;font-weight:600;padding:.3rem .55rem;transition:.2s;position:relative}
.nav-links a::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transition:.2s}
.nav-links a:hover{color:var(--goldLL)}
.nav-links a:hover::after{transform:scaleX(1)}
.nav-btn{background:var(--gold);color:var(--navy)!important;padding:.4rem 1rem!important;font-weight:700!important;opacity:1!important;cursor:pointer;border:none;transition:.2s!important}
.nav-btn:hover{background:var(--goldL)!important}
.nav-par{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.3);color:#4AE382!important;padding:.4rem 1rem!important;font-weight:700!important;opacity:1!important;transition:.2s!important}
.nav-fee{background:var(--saffron)!important;color:#fff!important;padding:.4rem 1rem!important;font-weight:700!important;opacity:1!important;border:none!important;cursor:pointer;transition:.2s!important}
.nav-fee:hover{background:#e06810!important}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}
.hamburger span{display:block;width:24px;height:2px;background:var(--cream);transition:.3s;transform-origin:center}
.hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.hamburger.open span:nth-child(2){opacity:0}
.hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.mob-menu{display:none;flex-direction:column;background:var(--navy);border-top:1px solid rgba(184,146,42,.2);padding:1rem 0}
.mob-menu.open{display:flex}
.mob-menu a{color:rgba(248,243,232,.75);font-family:'Rajdhani',sans-serif;font-weight:600;font-size:clamp(0.88rem,2.5vw,1rem);letter-spacing:.1em;text-transform:uppercase;padding:.85rem 5%;border-bottom:1px solid rgba(184,146,42,.08);transition:.2s}
.mob-menu .mob-cta{background:var(--gold);color:var(--navy)!important;margin:1rem 5%;text-align:center}
.mob-menu .mob-fee{background:var(--saffron);color:#fff!important;margin:.5rem 5%;text-align:center}
.mob-menu .mob-par{background:rgba(37,211,102,.15);color:#4AE382!important;margin:.5rem 5%;text-align:center;border:1px solid rgba(37,211,102,.3)}

/* HERO */
.hero{background:var(--navy);color:var(--cream);min-height:100vh;display:flex;align-items:center;position:relative;overflow:hidden}
.hero-pattern{position:absolute;inset:0;opacity:.03;background-image:repeating-linear-gradient(0deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 40px),repeating-linear-gradient(90deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 40px)}
.hero-orb{position:absolute;border-radius:50%;pointer-events:none}
.hero-orb1{right:-8%;top:-12%;width:560px;height:560px;border:1px solid rgba(184,146,42,.08);animation:orb 8s ease-in-out infinite alternate}
.hero-orb2{right:-3%;top:-5%;width:360px;height:360px;border:1px solid rgba(184,146,42,.13);animation:orb 6s ease-in-out infinite alternate-reverse}
@keyframes orb{0%{transform:scale(1) rotate(0deg)}100%{transform:scale(1.04) rotate(3deg)}}
.hero-wrap{width:min(1200px,92%);margin:auto;display:grid;grid-template-columns:1.3fr .7fr;gap:3.5rem;align-items:center;position:relative;z-index:2;padding:5.5rem 0 4.5rem}
.tricolor{display:flex;height:4px;width:80px;margin-bottom:2rem;gap:2px}
.tricolor div:nth-child(1){background:var(--saffron);flex:1}
.tricolor div:nth-child(2){background:#fff;flex:1}
.tricolor div:nth-child(3){background:var(--green);flex:1}
.hero-eyebrow{font-family:'Rajdhani',sans-serif;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.3em;text-transform:uppercase;color:var(--goldL);margin-bottom:1.2rem;display:flex;align-items:center;gap:12px}
.hero-eyebrow::before,.hero-eyebrow::after{content:'';display:block;height:1px;width:28px;background:var(--gold)}
.hero h1{font-size:clamp(2.2rem,6vw,4.8rem);line-height:1.03;letter-spacing:-.01em;margin-bottom:1.5rem;font-weight:600}
.hero h1 em{color:var(--goldL);font-style:italic}
.hero h1 span{display:block;font-size:clamp(1.3rem,3.5vw,2.8rem);color:rgba(248,243,232,.45);font-weight:400}
.hero p{max-width:520px;color:rgba(248,243,232,.65);line-height:1.9;font-size:clamp(0.95rem,2.5vw,1.05rem);margin-bottom:2rem}
.hero-btns{display:flex;gap:.85rem;flex-wrap:wrap;margin-bottom:1.5rem}

/* HERO QUICK ACTIONS — brochure + demo */
.hero-quick{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:2.5rem}
.btn-brochure{display:inline-flex;align-items:center;gap:.4rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.6rem 1.2rem;background:transparent;border:1px solid rgba(248,243,232,.25);color:rgba(248,243,232,.8);cursor:pointer;transition:.2s}
.btn-brochure:hover{border-color:var(--goldL);color:var(--goldL)}
.btn-demo{display:inline-flex;align-items:center;gap:.4rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.6rem 1.2rem;background:rgba(207,90,13,.15);border:1px solid rgba(207,90,13,.4);color:#E87A3A;cursor:pointer;transition:.2s}
.btn-demo:hover{background:rgba(207,90,13,.25)}

.btn{display:inline-flex;align-items:center;gap:.45rem;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(0.78rem,2.2vw,0.88rem);padding:clamp(.65rem,2vw,.82rem) clamp(1.2rem,3vw,1.7rem);cursor:pointer;transition:.2s;border:none}
.btn-gold{background:var(--gold);color:var(--navy)}
.btn-gold:hover{background:var(--goldL);transform:translateY(-1px);box-shadow:0 6px 20px rgba(184,146,42,.4)}
.btn-out{background:transparent;border:1px solid rgba(248,243,232,.3);color:var(--cream)}
.btn-out:hover{border-color:var(--goldL);color:var(--goldL)}
.btn-wa{background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.3);color:#4AE382}
.btn-wa:hover{background:rgba(37,211,102,.2)}
.btn-grn{background:var(--green);color:#fff}
.btn-grn:hover{background:#1e7a34;transform:translateY(-1px)}
.btn-fee{background:var(--saffron);color:#fff}
.btn-fee:hover{background:#e06810;transform:translateY(-1px)}

.stats-bar{display:flex;border-top:1px solid rgba(184,146,42,.2);padding-top:1.8rem;flex-wrap:wrap;gap:1rem}
.stat-item{padding-right:1.8rem;border-right:1px solid rgba(184,146,42,.18)}
.stat-item:last-child{border:none;padding:0}
.stat-item strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,2rem);color:var(--goldL);line-height:1}
.stat-item span{font-size:clamp(0.65rem,1.8vw,0.75rem);color:rgba(248,243,232,.38);letter-spacing:.12em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;font-weight:600}
.count-up{display:inline-block}

/* LIVE DASH */
.dash-panel{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.25);overflow:hidden;transition:.2s}
.dash-panel:hover{border-color:rgba(184,146,42,.4)}
.dash-hd{background:rgba(11,31,58,.8);border-bottom:1px solid rgba(184,146,42,.2);padding:.9rem 1.3rem;display:flex;align-items:center;justify-content:space-between}
.dash-hd-title{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.82rem,2.2vw,0.92rem);letter-spacing:.2em;text-transform:uppercase;color:var(--goldL)}
.live-dot{display:flex;align-items:center;gap:6px;font-size:clamp(0.75rem,2vw,0.85rem);color:rgba(248,243,232,.35);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase}
.dot{width:6px;height:6px;border-radius:50%;background:#4AE382;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(74,227,130,.4)}50%{opacity:.6;box-shadow:0 0 0 4px rgba(74,227,130,0)}}
.dash-kpi{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid rgba(184,146,42,.1)}
.kpi{padding:1.1rem .8rem;text-align:center;border-right:1px solid rgba(184,146,42,.08);transition:.2s}
.kpi:hover{background:rgba(184,146,42,.05)}
.kpi:last-child{border:none}
.kpi strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.3rem,4vw,1.8rem);color:var(--goldLL);line-height:1}
.kpi span{font-size:clamp(0.72rem,2vw,0.82rem);color:rgba(248,243,232,.35);text-transform:uppercase;letter-spacing:.1em;font-family:'Rajdhani',sans-serif;font-weight:600}
.dash-body{padding:.9rem 1.3rem}
.dash-row{display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid rgba(184,146,42,.07);font-size:clamp(0.85rem,2.5vw,1rem);transition:.15s}
.dash-row:hover{padding-left:.3rem}
.dash-row:last-child{border:none}
.dash-row span{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif}
.dash-row strong{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:600}
.lpulse{opacity:.4;animation:lpulse 1.5s ease-in-out infinite}
@keyframes lpulse{0%,100%{opacity:.4}50%{opacity:.8}}

/* SECTIONS */
section.pad{padding:5rem 0}
section.pad-alt{padding:5rem 0;background:var(--cream)}
.eyebrow{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.3em;text-transform:uppercase;color:var(--goldD);margin-bottom:.7rem;display:flex;align-items:center;gap:10px}
.eyebrow::before{content:'';width:22px;height:1px;background:var(--gold)}
h2.st{font-size:clamp(1.5rem,4vw,2.6rem);color:var(--navy);margin-bottom:.8rem}
.rule{display:flex;align-items:center;gap:12px;margin-bottom:1.5rem}
.rule-line{height:1px;flex:1;background:linear-gradient(90deg,var(--gold),transparent)}
.rule-d{width:7px;height:7px;border:2px solid var(--gold);transform:rotate(45deg);flex-shrink:0}

/* RIBBON */
.ribbon{background:var(--cream);border-top:3px solid var(--gold);border-bottom:1px solid var(--creamDD);padding:2.2rem 5%}
.ribbon-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1.2rem;text-align:center}
.ribbon-stat{transition:.2s;cursor:default}
.ribbon-stat:hover strong{color:var(--goldD)}
.ribbon-stat strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.8rem,5vw,2.8rem);color:var(--navy);line-height:1;transition:.3s}
.ribbon-stat span{font-size:clamp(0.78rem,2.2vw,0.88rem);color:var(--mist);letter-spacing:.1em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;font-weight:600}

/* ═══ RANKER WALL ═══ */
.ranker-section{background:var(--navy);padding:5rem 0;position:relative;overflow:hidden}
.ranker-section::before{content:'';position:absolute;inset:0;opacity:.03;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 28px)}
.ranker-section .eyebrow{color:var(--goldL)}
.ranker-section .eyebrow::before{background:var(--gold)}
.ranker-section h2.st{color:var(--cream)}
.ranker-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:1rem;margin-top:2rem}
.ranker-card{background:rgba(21,53,97,.7);border:1px solid rgba(184,146,42,.2);padding:1.2rem;text-align:center;transition:.3s;position:relative;overflow:hidden}
.ranker-card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--saffron),var(--gold),var(--green))}
.ranker-card:hover{border-color:var(--gold);transform:translateY(-4px);box-shadow:0 12px 28px rgba(0,0,0,.3)}
.ranker-photo{width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--navy3),var(--navy4));border:2px solid var(--gold);margin:0 auto .8rem;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.5rem;color:var(--goldL);overflow:hidden}
.ranker-photo img{width:100%;height:100%;object-fit:cover}
.ranker-card h4{color:var(--cream);font-size:clamp(0.88rem,2.5vw,1rem);margin-bottom:.25rem}
.ranker-school{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:.2rem}
.ranker-batch{color:rgba(248,243,232,.35);font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif}
.ranker-badge{position:absolute;top:.6rem;right:.6rem;background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.55rem;letter-spacing:.08em;text-transform:uppercase;padding:.15rem .4rem}
.ranker-cta{margin-top:2rem;text-align:center}
.ranker-note{color:rgba(248,243,232,.3);font-size:clamp(0.72rem,2vw,0.8rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;margin-top:1rem;text-align:center}

/* ABOUT */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:start}
.about-text p{color:var(--slate);line-height:1.9;margin-bottom:1.3rem;font-size:clamp(0.92rem,2.4vw,1rem)}
.feat-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:1.4rem}
.tile{padding:.9rem 1rem;border:1px solid var(--creamDD);border-left:3px solid var(--gold);background:var(--white);transition:.25s;cursor:default}
.tile:hover{border-left-color:var(--goldL);transform:translateX(4px);box-shadow:4px 0 12px rgba(184,146,42,.1)}
.tile strong{display:block;color:var(--navy);font-size:clamp(0.82rem,2.2vw,0.9rem);margin:.25rem 0 .12rem;font-family:'Rajdhani',sans-serif;font-weight:600;letter-spacing:.04em}
.tile span{color:var(--mist);font-size:clamp(0.7rem,1.9vw,0.78rem)}
.bar-block{margin-bottom:1.3rem}
.bar-label{display:flex;justify-content:space-between;margin-bottom:6px;font-size:clamp(0.82rem,2.2vw,0.9rem)}
.bar-label span{color:var(--slate)}
.bar-label strong{color:var(--navy);font-family:'EB Garamond',serif}
.bar-track{height:4px;background:var(--creamDD);overflow:hidden;border-radius:2px}
.bar-fill{height:100%;width:0;transition:width 1.4s cubic-bezier(.25,.46,.45,.94);border-radius:2px}

/* FOUNDER */
.founder-grid{display:grid;grid-template-columns:.45fr .55fr;gap:4rem;align-items:center}
.founder-img{width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,var(--creamDD),var(--creamD));border:3px solid var(--creamD);display:flex;align-items:center;justify-content:center;color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;position:relative;overflow:hidden}
.founder-img img{width:100%;height:100%;object-fit:cover}
.founder-img-badge{position:absolute;bottom:1.2rem;left:1.2rem;right:1.2rem;background:rgba(11,31,58,.92);border:1px solid rgba(184,146,42,.35);padding:.8rem 1rem;backdrop-filter:blur(8px)}
.founder-img-badge h4{color:var(--cream);font-size:clamp(1rem,2.8vw,1.1rem);margin-bottom:.15rem}
.founder-img-badge span{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.1em;text-transform:uppercase}
.founder-quote{font-family:'EB Garamond',serif;font-size:clamp(1.05rem,2.8vw,1.25rem);color:var(--navy);line-height:1.75;font-style:italic;border-left:4px solid var(--gold);padding-left:1.4rem;margin-bottom:1.5rem;position:relative}
.founder-quote::before{content:'"';position:absolute;left:-.5rem;top:-.8rem;font-size:4rem;color:var(--gold);opacity:.15;font-family:'EB Garamond',serif;line-height:1}
.founder-body p{color:var(--slate);line-height:1.9;margin-bottom:1rem;font-size:clamp(0.9rem,2.4vw,0.95rem)}
.founder-sig{font-family:'EB Garamond',serif;font-size:clamp(1.1rem,2.8vw,1.3rem);color:var(--navy);margin-top:1.5rem}
.founder-sig span{display:block;font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);color:var(--mist);letter-spacing:.1em;text-transform:uppercase;font-style:normal;margin-top:.2rem}

/* FACULTY */
.faculty-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.2rem}
.faculty-card{background:var(--white);border:1px solid var(--creamDD);padding:1.5rem;text-align:center;transition:.25s;position:relative;overflow:hidden}
.faculty-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(184,146,42,.03),transparent);opacity:0;transition:.25s}
.faculty-card:hover{border-color:var(--gold);transform:translateY(-4px);box-shadow:0 12px 32px rgba(184,146,42,.12)}
.faculty-card:hover::before{opacity:1}
.faculty-photo{width:80px;height:80px;border-radius:50%;background:var(--creamDD);border:3px solid var(--gold);margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.6rem;color:var(--goldL);overflow:hidden;transition:.25s}
.faculty-photo img{width:100%;height:100%;object-fit:cover}
.faculty-card h3{color:var(--navy);font-size:clamp(0.95rem,2.5vw,1.05rem);margin-bottom:.25rem}
.faculty-card .role{color:var(--goldD);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.1em;text-transform:uppercase;margin-bottom:.4rem}
.faculty-card .subj{color:var(--slate);font-size:clamp(0.8rem,2.2vw,0.88rem)}
.faculty-card .exp{font-family:'Rajdhani',sans-serif;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.08em;text-transform:uppercase;color:var(--mist);margin-top:.4rem}

/* COURSES */
.courses-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.2rem}
.course-card{background:var(--white);border:1px solid var(--creamDD);border-top:4px solid var(--navy3);padding:1.6rem;transition:.25s;position:relative;overflow:hidden}
.course-card.sainik{border-top-color:var(--red)}
.course-card.navodaya{border-top-color:var(--navy3)}
.course-card.foundation{border-top-color:var(--green)}
.course-card.combined{border-top-color:var(--gold)}
.course-card:hover{transform:translateY(-5px);box-shadow:0 16px 40px rgba(11,31,58,.14)}
.course-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.14em;text-transform:uppercase;padding:.2rem .65rem;margin-bottom:.9rem}
.cb-sainik{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.2)}
.cb-nv{background:rgba(21,53,97,.1);color:var(--navy3);border:1px solid rgba(21,53,97,.2)}
.cb-fn{background:rgba(26,92,42,.1);color:var(--green);border:1px solid rgba(26,92,42,.2)}
.cb-co{background:rgba(184,146,42,.1);color:var(--goldD);border:1px solid rgba(184,146,42,.2)}
.course-card h3{color:var(--navy);font-size:clamp(1rem,3vw,1.2rem);margin-bottom:.3rem}
.course-card .sub{color:var(--slate);font-size:clamp(0.8rem,2.2vw,0.88rem);margin-bottom:1rem}
.course-features{list-style:none;margin-bottom:1.2rem}
.course-features li{color:var(--slate);font-size:clamp(0.82rem,2.2vw,0.9rem);padding:.3rem 0;border-bottom:1px solid var(--creamDD);display:flex;align-items:center;gap:.5rem}
.course-features li::before{content:'✓';color:var(--green);font-weight:700;font-size:.8rem;flex-shrink:0}
.course-enquire{display:block;width:100%;padding:.6rem;background:var(--cream);border:1px solid var(--creamDD);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.2s;text-align:center}
.course-enquire:hover{background:var(--gold);border-color:var(--gold);color:var(--navy)}
.fee-note{color:var(--mist);font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif;text-align:center;margin-top:.4rem;letter-spacing:.04em}

/* ═══ FACILITIES ═══ */
.facilities-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1.2rem}
.facility-card{background:var(--white);border:1px solid var(--creamDD);padding:1.6rem;transition:.25s;position:relative;overflow:hidden}
.facility-card:hover{border-color:var(--gold);transform:translateY(-4px);box-shadow:0 12px 30px rgba(11,31,58,.1)}
.facility-icon{font-size:2.2rem;margin-bottom:.9rem;display:block}
.facility-card h3{color:var(--navy);font-size:clamp(1rem,2.8vw,1.15rem);margin-bottom:.5rem}
.facility-card p{color:var(--slate);font-size:clamp(0.84rem,2.2vw,0.9rem);line-height:1.75}
.facility-card ul{list-style:none;margin-top:.7rem}
.facility-card ul li{color:var(--slate);font-size:clamp(0.8rem,2.2vw,0.87rem);padding:.2rem 0;display:flex;align-items:center;gap:.4rem}
.facility-card ul li::before{content:'▸';color:var(--gold);font-size:.75rem;flex-shrink:0}

/* ═══ VIDEO SECTION ═══ */
.video-section{background:var(--navy);padding:5rem 0;position:relative;overflow:hidden}
.video-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(0deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 50px)}
.video-section .eyebrow{color:var(--goldL)}
.video-section .eyebrow::before{background:var(--gold)}
.video-section h2.st{color:var(--cream)}
.video-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:2.5rem;align-items:start;margin-top:2rem}
.video-main{position:relative}
.video-embed{position:relative;padding-bottom:56.25%;height:0;overflow:hidden;background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.2)}
.video-embed iframe{position:absolute;top:0;left:0;width:100%;height:100%;border:0}
.video-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;cursor:pointer;background:rgba(11,31,58,.85)}
.video-placeholder:hover .play-btn{transform:scale(1.1);background:var(--goldL)}
.play-btn{width:64px;height:64px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center;font-size:1.4rem;transition:.25s}
.video-placeholder p{color:rgba(248,243,232,.6);font-family:'Rajdhani',sans-serif;font-size:clamp(0.8rem,2.2vw,0.9rem);letter-spacing:.08em;text-transform:uppercase}
.video-list{display:flex;flex-direction:column;gap:.75rem}
.video-item{background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.15);padding:1rem 1.2rem;display:flex;gap:1rem;align-items:center;cursor:pointer;transition:.2s}
.video-item:hover{border-color:var(--goldL);background:rgba(21,53,97,.8)}
.video-thumb{width:48px;height:48px;background:rgba(184,146,42,.15);border:1px solid rgba(184,146,42,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1rem;color:var(--goldL)}
.video-item-title{color:var(--cream);font-size:clamp(0.85rem,2.3vw,0.95rem);margin-bottom:.2rem}
.video-item-sub{color:rgba(248,243,232,.35);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.06em;text-transform:uppercase}

/* NOTICES */
.cards-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1rem}
.notice-card{background:var(--white);border:1px solid var(--creamDD);border-top:3px solid var(--navy3);padding:1.3rem 1.4rem;transition:.25s}
.notice-card:hover{box-shadow:0 8px 24px rgba(11,31,58,.1);transform:translateY(-2px)}
.notice-card.urgent{border-top-color:var(--red)}
.notice-card.success{border-top-color:var(--green)}
.notice-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.14em;text-transform:uppercase;padding:.2rem .65rem;margin-bottom:.7rem}
.badge-open{background:#E8F4ED;color:var(--green)}
.badge-weekly{background:#EDF2F8;color:var(--navy3)}
.badge-limited{background:#FDF0E8;color:var(--saffron)}
.notice-card h3{font-size:clamp(1rem,2.8vw,1.1rem);color:var(--navy);margin-bottom:.5rem}
.notice-card p{color:var(--slate);font-size:clamp(0.85rem,2.3vw,0.92rem);line-height:1.7}
.notice-date{font-size:clamp(0.65rem,1.8vw,0.72rem);color:var(--mist);font-family:'Rajdhani',sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-top:.7rem}

/* ═══ BLOG / NEWS ═══ */
.blog-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.2rem}
.blog-card{background:var(--white);border:1px solid var(--creamDD);overflow:hidden;transition:.25s}
.blog-card:hover{transform:translateY(-4px);box-shadow:0 12px 30px rgba(11,31,58,.1);border-color:var(--goldL)}
.blog-thumb{height:160px;background:linear-gradient(135deg,var(--navy3),var(--navy));display:flex;align-items:center;justify-content:center;font-size:2.5rem;position:relative;overflow:hidden}
.blog-thumb img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.blog-cat{position:absolute;top:.7rem;left:.7rem;background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;padding:.18rem .55rem}
.blog-body{padding:1.2rem 1.3rem}
.blog-date{font-family:'Rajdhani',sans-serif;font-size:clamp(0.65rem,1.8vw,0.72rem);color:var(--mist);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.4rem}
.blog-card h3{color:var(--navy);font-size:clamp(0.97rem,2.6vw,1.08rem);margin-bottom:.5rem;line-height:1.4}
.blog-card p{color:var(--slate);font-size:clamp(0.82rem,2.2vw,0.88rem);line-height:1.7}
.blog-read{display:inline-flex;align-items:center;gap:.3rem;margin-top:.9rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.78rem);letter-spacing:.1em;text-transform:uppercase;color:var(--goldD);transition:.2s}
.blog-read:hover{color:var(--gold);gap:.5rem}

/* RESULTS */
.result-card{background:var(--white);border:1px solid var(--creamDD);padding:1.3rem 1.4rem;display:flex;gap:1.3rem;align-items:flex-start;transition:.25s}
.result-card:hover{box-shadow:0 6px 20px rgba(11,31,58,.1);transform:translateY(-2px)}
.year-badge{background:var(--navy);color:var(--goldLL);font-family:'EB Garamond',serif;font-size:clamp(1.2rem,3.5vw,1.5rem);padding:.65rem .9rem;text-align:center;white-space:nowrap;flex-shrink:0;line-height:1}
.year-badge small{display:block;font-family:'Rajdhani',sans-serif;font-size:clamp(0.58rem,1.5vw,0.65rem);letter-spacing:.12em;text-transform:uppercase;color:var(--goldL);margin-top:4px}
.result-body h3{font-size:clamp(0.95rem,2.5vw,1rem);color:var(--navy);margin-bottom:.4rem}
.result-body p{color:var(--slate);font-size:clamp(0.82rem,2.2vw,0.88rem);line-height:1.7}
.result-number{font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,2rem);color:var(--gold);float:right;line-height:1}

/* ALUMNI */
.alumni-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
.alumni-card{background:var(--white);border:1px solid var(--creamDD);padding:1.3rem;text-align:center;transition:.25s}
.alumni-card:hover{border-color:var(--gold);transform:translateY(-3px);box-shadow:0 8px 20px rgba(184,146,42,.1)}
.alumni-avatar{width:64px;height:64px;border-radius:50%;background:var(--navy);border:2px solid var(--gold);margin:0 auto .9rem;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.3rem;color:var(--goldL)}
.alumni-card h4{color:var(--navy);font-size:clamp(0.95rem,2.5vw,1rem);margin-bottom:.2rem}
.alumni-card .ach{color:var(--green);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:.2rem}
.alumni-card .yr{color:var(--mist);font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif}

/* TESTIMONIALS */
.testi-wrap{overflow:hidden;position:relative}
.testi-track{display:flex;transition:transform .6s cubic-bezier(.25,.46,.45,.94)}
.testi-card{min-width:100%;padding:2.2rem;background:var(--white);border:1px solid var(--creamDD);border-left:4px solid var(--gold);position:relative}
.testi-card blockquote{font-family:'EB Garamond',serif;font-size:clamp(1rem,2.8vw,1.15rem);color:var(--navy);line-height:1.8;font-style:italic;margin-bottom:1rem}
.testi-card cite{font-style:normal;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.78rem,2.2vw,0.88rem);letter-spacing:.1em;text-transform:uppercase;color:var(--goldD)}
.testi-card .stars{color:var(--gold);font-size:clamp(0.9rem,2.5vw,1rem);margin-bottom:.7rem;letter-spacing:.1em}
.slider-ctrl{display:flex;align-items:center;gap:1rem;margin-top:1.2rem}
.slider-btn{width:36px;height:36px;border:1px solid var(--gold);background:transparent;color:var(--gold);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.9rem;transition:.2s}
.slider-btn:hover{background:var(--gold);color:var(--navy)}
.slider-dots{display:flex;gap:6px}
.slider-dot{width:7px;height:7px;border-radius:50%;background:var(--creamDD);border:1px solid var(--mist);cursor:pointer;transition:.2s}
.slider-dot.active{background:var(--gold);border-color:var(--gold)}

/* ═══ GOOGLE REVIEWS ═══ */
.reviews-section{background:var(--navy);padding:5rem 0}
.reviews-section .eyebrow{color:var(--goldL)}
.reviews-section .eyebrow::before{background:var(--gold)}
.reviews-section h2.st{color:var(--cream)}
.reviews-header{display:flex;align-items:center;gap:2rem;margin-bottom:2rem;flex-wrap:wrap}
.reviews-score{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.25);padding:1.5rem 2rem;text-align:center;flex-shrink:0}
.reviews-score .score-num{font-family:'EB Garamond',serif;font-size:clamp(2.5rem,6vw,3.5rem);color:var(--goldLL);line-height:1;display:block}
.reviews-score .score-stars{color:var(--gold);font-size:1.2rem;letter-spacing:.1em;margin:.3rem 0}
.reviews-score .score-count{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.08em;text-transform:uppercase}
.reviews-desc{color:rgba(248,243,232,.55);line-height:1.85;font-size:clamp(0.9rem,2.4vw,0.97rem);max-width:420px}
.reviews-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem}
.review-card{background:rgba(21,53,97,.5);border:1px solid rgba(184,146,42,.15);padding:1.3rem;transition:.2s}
.review-card:hover{border-color:rgba(184,146,42,.35)}
.review-top{display:flex;align-items:center;gap:.8rem;margin-bottom:.8rem}
.review-av{width:40px;height:40px;border-radius:50%;background:rgba(184,146,42,.2);border:1px solid rgba(184,146,42,.35);display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1rem;color:var(--goldL);flex-shrink:0}
.review-name{color:var(--cream);font-size:clamp(0.88rem,2.3vw,0.95rem)}
.review-date{color:rgba(248,243,232,.3);font-family:'Rajdhani',sans-serif;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.06em;text-transform:uppercase}
.review-stars{color:var(--gold);font-size:.85rem;letter-spacing:.05em;margin-bottom:.5rem}
.review-text{color:rgba(248,243,232,.6);font-size:clamp(0.82rem,2.2vw,0.88rem);line-height:1.7;font-style:italic}
.google-badge{display:inline-flex;align-items:center;gap:.5rem;margin-top:1.5rem;padding:.5rem 1rem;border:1px solid rgba(184,146,42,.2);background:rgba(21,53,97,.4);color:rgba(248,243,232,.5);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:.2s}
.google-badge:hover{border-color:var(--goldL);color:var(--goldL)}

/* GALLERY */
.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gcell{background:var(--creamDD);aspect-ratio:4/3;position:relative;overflow:hidden;cursor:pointer}
.gcell:hover .gcell-lbl{background:rgba(184,146,42,.85);color:var(--navy)}
.gcell:hover img{transform:scale(1.05)}
.gcell-lbl{position:absolute;bottom:0;left:0;right:0;background:rgba(11,31,58,.75);color:var(--goldLL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.9vw,0.78rem);letter-spacing:.1em;text-transform:uppercase;padding:.38rem .65rem;transition:.25s}
.gcell img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease}

/* EVENTS */
.event-card{background:var(--white);border:1px solid var(--creamDD);padding:1.1rem 1.3rem;display:flex;gap:1.1rem;align-items:center;transition:.25s}
.event-card:hover{border-color:var(--gold);box-shadow:0 4px 16px rgba(11,31,58,.08);transform:translateX(4px)}
.event-date-block{text-align:center;min-width:48px;border-right:1px solid var(--creamDD);padding-right:1.1rem}
.event-date-block .day{font-family:'EB Garamond',serif;font-size:clamp(1.5rem,4vw,1.9rem);color:var(--navy);line-height:1}
.event-date-block .month{font-family:'Rajdhani',sans-serif;font-size:clamp(0.62rem,1.7vw,0.7rem);letter-spacing:.12em;text-transform:uppercase;color:var(--mist)}
.event-body h3{font-size:clamp(0.92rem,2.5vw,1rem);color:var(--navy);margin-bottom:.25rem}
.event-body span{font-size:clamp(0.8rem,2.2vw,0.88rem);color:var(--slate)}

/* FAQ */
.faq{border-top:1px solid var(--creamDD)}
.faq-item{border-bottom:1px solid var(--creamDD)}
.faq-q{font-family:'EB Garamond',serif;font-size:clamp(0.97rem,2.7vw,1.08rem);color:var(--navy);cursor:pointer;display:flex;justify-content:space-between;gap:1rem;padding:1rem 0;transition:.2s}
.faq-q:hover{color:var(--goldD)}
.faq-icon{width:22px;height:22px;border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:.78rem;flex-shrink:0;transition:.25s}
.faq-a{display:none;color:var(--slate);line-height:1.85;padding-bottom:1rem;font-size:clamp(0.88rem,2.3vw,0.95rem);animation:fadedown .25s ease}
@keyframes fadedown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}

/* ═══ ONLINE FEE PAYMENT ═══ */
.fee-section{background:linear-gradient(135deg,var(--navy2),var(--navy3));padding:4rem 0;position:relative;overflow:hidden}
.fee-section::before{content:'';position:absolute;inset:0;opacity:.04;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 30px)}
.fee-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;align-items:center}
.fee-info h2{color:var(--cream);font-size:clamp(1.5rem,4vw,2.2rem);margin-bottom:1rem}
.fee-info p{color:rgba(248,243,232,.6);line-height:1.85;font-size:clamp(0.9rem,2.4vw,0.97rem);margin-bottom:1.5rem}
.fee-methods{display:flex;gap:.6rem;flex-wrap:wrap;margin-bottom:1.5rem}
.fee-method{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);padding:.4rem .9rem;font-family:'Rajdhani',sans-serif;font-weight:600;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.08em;text-transform:uppercase;color:rgba(248,243,232,.65)}
.fee-box{background:rgba(11,31,58,.6);border:1px solid rgba(184,146,42,.25);padding:2rem}
.fee-box h3{color:var(--goldL);font-size:clamp(1.1rem,3vw,1.3rem);margin-bottom:1.2rem}
.fee-step{display:flex;gap:1rem;align-items:flex-start;margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid rgba(184,146,42,.1)}
.fee-step:last-of-type{border:none;margin-bottom:1.2rem}
.fee-step-num{width:28px;height:28px;border:1px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.75rem;color:var(--gold);flex-shrink:0}
.fee-step-txt{color:rgba(248,243,232,.65);font-size:clamp(0.85rem,2.3vw,0.92rem);line-height:1.6}
.fee-step-txt strong{color:var(--cream);display:block;margin-bottom:.15rem}
.pay-btn{display:flex;width:100%;padding:1rem;background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.88rem,2.5vw,1rem);letter-spacing:.12em;text-transform:uppercase;border:none;cursor:pointer;transition:.2s;align-items:center;justify-content:center;gap:.5rem}
.pay-btn:hover{background:var(--goldL)}
.pay-note{color:rgba(248,243,232,.25);font-size:clamp(0.65rem,1.8vw,0.72rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em;text-align:center;margin-top:.6rem}

/* ENQUIRY */
.enquiry-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:2.5rem}
.form-panel{background:var(--cream);border:1px solid var(--creamDD);padding:1.8rem}
label.fl{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.14em;text-transform:uppercase;color:var(--slate);margin-bottom:.38rem}
input.ff,select.ff,textarea.ff{width:100%;padding:11px 15px;border:1px solid var(--creamDD);background:var(--white);color:var(--navy);font-size:clamp(0.9rem,2.4vw,0.97rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1.1rem;transition:.2s}
input.ff:focus,select.ff:focus,textarea.ff:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}
textarea.ff{min-height:100px;resize:vertical}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.contact-card{background:var(--white);border:1px solid var(--creamDD);border-left:4px solid var(--gold);padding:1.2rem 1.3rem;margin-bottom:.9rem;transition:.2s}
.contact-card:hover{box-shadow:4px 0 12px rgba(184,146,42,.1)}
.contact-card h3{color:var(--navy);margin-bottom:.5rem;font-size:clamp(0.97rem,2.6vw,1.05rem)}
.contact-card p{color:var(--slate);font-size:clamp(0.84rem,2.2vw,0.9rem);line-height:1.8}
.form-msg{padding:.7rem 1rem;margin-bottom:1rem;font-size:clamp(0.82rem,2.2vw,0.9rem);font-family:'Rajdhani',sans-serif;display:none}
.form-msg.success{background:#E8F4ED;color:var(--green);border:1px solid rgba(26,92,42,.3)}
.form-msg.error{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.3)}

/* SOCIAL */
.social-strip{display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap}
.soc-btn{display:inline-flex;align-items:center;gap:.5rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.8rem);letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1rem;border:1px solid;transition:.2s}
.soc-fb{border-color:#1877F2;color:#1877F2}
.soc-fb:hover{background:#1877F2;color:#fff}
.soc-yt{border-color:#FF0000;color:#FF0000}
.soc-yt:hover{background:#FF0000;color:#fff}
.soc-ig{border-color:#E1306C;color:#E1306C}
.soc-ig:hover{background:#E1306C;color:#fff}

/* CTA */
.cta-block{background:var(--navy);color:var(--cream);text-align:center;padding:4.5rem 5%;position:relative;overflow:hidden}
.cta-block::before{content:'';position:absolute;inset:0;opacity:.03;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 32px)}
.cta-block h2{font-size:clamp(1.8rem,4.5vw,2.5rem);margin-bottom:1rem;position:relative}
.cta-block p{max-width:620px;margin:0 auto 2rem;color:rgba(248,243,232,.6);line-height:1.85;position:relative;font-size:clamp(0.92rem,2.4vw,1rem)}

/* FOOTER */
footer{background:var(--navy2);color:rgba(248,243,232,.8);border-top:1px solid rgba(184,146,42,.2);padding:3.5rem 5% 2rem}
.footer-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2rem;margin-bottom:2rem}
footer h4{color:var(--cream);font-family:'EB Garamond',serif;font-size:clamp(1rem,2.8vw,1.05rem);margin-bottom:.9rem}
footer a{display:block;margin-bottom:.55rem;color:rgba(248,243,232,.6);font-size:clamp(0.82rem,2.2vw,0.88rem);transition:.2s}
footer a:hover{color:var(--goldL);padding-left:4px}
.foot-social{display:flex;gap:.6rem;margin-top:.6rem}
.foot-soc-icon{width:32px;height:32px;border:1px solid rgba(184,146,42,.25);display:flex;align-items:center;justify-content:center;color:rgba(248,243,232,.4);font-size:.8rem;transition:.2s;font-weight:700;font-family:'Rajdhani',sans-serif}
.foot-soc-icon:hover{border-color:var(--goldL);color:var(--goldL);background:rgba(184,146,42,.1)}
.footer-bottom{border-top:1px solid rgba(184,146,42,.1);padding-top:1.4rem;display:flex;justify-content:space-between;align-items:center;font-size:clamp(0.68rem,1.8vw,0.75rem);color:rgba(248,243,232,.3);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;flex-wrap:wrap;gap:.5rem}
.footer-tricolor{display:flex;gap:3px;height:3px;width:44px}
.footer-tricolor div{flex:1}
.footer-tricolor div:nth-child(1){background:var(--saffron)}
.footer-tricolor div:nth-child(2){background:#fff}
.footer-tricolor div:nth-child(3){background:var(--green)}

/* MAP */
.map-wrap{position:relative;width:100%;height:240px;background:var(--creamDD);border:1px solid var(--creamDD);overflow:hidden;cursor:pointer}
.map-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;background:var(--creamDD)}
.map-placeholder span{font-family:'Rajdhani',sans-serif;font-size:clamp(0.75rem,2vw,0.85rem);letter-spacing:.1em;text-transform:uppercase;color:var(--mist)}
.map-load-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;background:var(--navy);color:var(--goldL);border:1px solid rgba(184,146,42,.3);cursor:pointer;transition:.2s}
.map-frame{width:100%;height:100%;border:0}

/* WA FLOAT */
#waFloat{position:fixed;bottom:5.5rem;right:1.5rem;z-index:995;width:50px;height:50px;background:var(--wa);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(37,211,102,.4);cursor:pointer;animation:wab 2.5s ease-in-out infinite;text-decoration:none}
#waFloat:hover{animation:none;transform:scale(1.1)}
#waFloat svg{width:25px;height:25px;fill:#fff}
#waFloat .wa-tooltip{position:absolute;right:60px;background:var(--navy);color:var(--cream);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,2vw,0.8rem);letter-spacing:.06em;padding:.4rem .8rem;white-space:nowrap;border:1px solid rgba(184,146,42,.3);pointer-events:none;opacity:0;transition:.2s;border-radius:2px}
#waFloat:hover .wa-tooltip{opacity:1}
@keyframes wab{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

/* PP OVERLAY */
.pp-overlay{display:none;position:fixed;inset:0;z-index:2000;overflow-y:auto;background:rgba(11,31,58,.98)}.pp-overlay.open{display:block}
.pp-login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;position:relative}
.pp-close{position:absolute;top:1rem;right:1rem;background:none;border:1px solid rgba(184,146,42,.3);color:var(--goldL);width:36px;height:36px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:.2s}
.pp-box{background:rgba(15,42,78,.9);border:1px solid rgba(184,146,42,.3);padding:2.4rem;width:100%;max-width:410px}
.pp-logo{text-align:center;margin-bottom:1.8rem}
.pp-logo h2{color:var(--cream);font-size:clamp(1.3rem,3.5vw,1.5rem);margin-bottom:.25rem}
.pp-logo p{color:rgba(248,243,232,.4);font-size:clamp(0.75rem,2vw,0.85rem);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase}
.pp-fl{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.14em;text-transform:uppercase;color:rgba(248,243,232,.45);margin-bottom:.38rem}
.pp-fi{width:100%;padding:12px 15px;background:rgba(255,255,255,.06);border:1px solid rgba(184,146,42,.22);color:var(--cream);font-size:clamp(0.88rem,2.3vw,0.95rem);font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1.1rem;transition:.2s}
.pp-fi:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}
.pp-lbtn{width:100%;padding:13px;background:var(--gold);color:var(--navy);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.85rem,2.4vw,0.95rem);letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s;margin-top:.3rem}
.pp-lbtn:hover{background:var(--goldL)}
.pp-lbtn:disabled{opacity:.5;cursor:not-allowed}
.pp-err{background:rgba(139,26,26,.3);border:1px solid rgba(139,26,26,.5);color:#f87171;font-size:clamp(0.78rem,2.2vw,0.88rem);padding:.75rem 1rem;margin-bottom:1rem;font-family:'Rajdhani',sans-serif;display:none}
.pp-shell{min-height:100vh;display:flex;flex-direction:column;background:var(--navy);display:none}.pp-shell.show{display:flex}
.pp-topbar{background:rgba(11,31,58,.95);border-bottom:1px solid rgba(184,146,42,.22);padding:.85rem 1.3rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.pp-topbar-l{display:flex;align-items:center;gap:.9rem}
.pp-topbar h3{font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--cream);font-size:clamp(0.88rem,2.4vw,0.97rem);letter-spacing:.1em;text-transform:uppercase}
.pp-topbar p{color:rgba(248,243,232,.38);font-size:clamp(0.65rem,1.8vw,0.72rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase}
.pp-lout{background:rgba(139,26,26,.3);border:1px solid rgba(139,26,26,.4);color:#f87171;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.1em;text-transform:uppercase;padding:.45rem .9rem;cursor:pointer}
.pp-tabs{background:rgba(15,42,78,.5);border-bottom:1px solid rgba(184,146,42,.13);display:flex;overflow-x:auto;scrollbar-width:none}.pp-tabs::-webkit-scrollbar{display:none}
.pp-tab{flex-shrink:0;padding:.8rem 1.3rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.38);cursor:pointer;border-bottom:2px solid transparent;transition:.2s;border:none;background:none}
.pp-tab.active{color:var(--goldL);border-bottom-color:var(--gold)}
.pp-content{flex:1;padding:1.4rem;max-width:880px;margin:0 auto;width:100%}
.stu-hdr{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.22);padding:1.3rem 1.5rem;margin-bottom:1.3rem;display:flex;align-items:center;gap:1.3rem}
.stu-av{width:54px;height:54px;background:rgba(184,146,42,.15);border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.4rem;color:var(--goldL);flex-shrink:0}
.stu-info h3{color:var(--cream);font-size:clamp(1.05rem,2.8vw,1.15rem);margin-bottom:.2rem}
.stu-info p{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:clamp(0.68rem,1.8vw,0.75rem);letter-spacing:.08em;text-transform:uppercase}
.stu-badges{display:flex;gap:.4rem;margin-top:.35rem;flex-wrap:wrap}
.stu-badge{background:rgba(184,146,42,.13);border:1px solid rgba(184,146,42,.28);color:var(--goldLL);font-family:'Rajdhani',sans-serif;font-size:clamp(0.6rem,1.6vw,0.68rem);letter-spacing:.1em;text-transform:uppercase;padding:.18rem .55rem}
.pp-sec{display:none}.pp-sec.active{display:block}
.pp-card{background:rgba(21,53,97,.4);border:1px solid rgba(184,146,42,.16);margin-bottom:1rem}
.pp-card-hd{padding:.85rem 1.1rem;border-bottom:1px solid rgba(184,146,42,.1);display:flex;justify-content:space-between;align-items:center}
.pp-card-title{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.15em;text-transform:uppercase;color:var(--goldL)}
.pp-card-body{padding:.95rem 1.1rem}
.att-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:4px;margin-bottom:1rem}
.att-day{width:34px;height:34px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif;font-weight:700}
.att-p{background:rgba(26,92,42,.4);border:1px solid rgba(26,92,42,.55);color:#4AE382}
.att-a{background:rgba(139,26,26,.4);border:1px solid rgba(139,26,26,.55);color:#f87171}
.att-h{background:rgba(61,79,107,.35);border:1px solid rgba(61,79,107,.4);color:var(--mist)}
.att-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem}
.att-si{background:rgba(11,31,58,.5);padding:.65rem;text-align:center}
.att-si strong{display:block;font-family:'EB Garamond',serif;font-size:clamp(1.2rem,3.5vw,1.5rem);line-height:1;margin-bottom:.15rem}
.att-si span{font-size:clamp(0.6rem,1.6vw,0.68rem);font-family:'Rajdhani',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(248,243,232,.35)}
.att-si.p strong{color:#4AE382}.att-si.a strong{color:#f87171}.att-si.pct strong{color:var(--goldLL)}
.pp-table{width:100%;border-collapse:collapse;font-size:clamp(0.8rem,2.2vw,0.88rem)}
.pp-table th{background:rgba(11,31,58,.6);padding:.65rem .9rem;text-align:left;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.65rem,1.8vw,0.72rem);letter-spacing:.12em;text-transform:uppercase;color:var(--goldL);border-bottom:1px solid rgba(184,146,42,.13)}
.pp-table td{padding:.65rem .9rem;border-bottom:1px solid rgba(184,146,42,.07);color:rgba(248,243,232,.72)}
.pp-table tr:last-child td{border:none}.pp-table tr:hover td{background:rgba(184,146,42,.04)}
.sc-hi{background:rgba(26,92,42,.35);color:#4AE382;border:1px solid rgba(26,92,42,.4);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem)}
.sc-mi{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem)}
.sc-lo{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.68rem,1.8vw,0.75rem)}
.pp-ni{padding:.9rem 0;border-bottom:1px solid rgba(184,146,42,.09)}.pp-ni:last-child{border:none}
.pp-npri{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.6rem,1.6vw,0.68rem);letter-spacing:.12em;text-transform:uppercase;padding:.14rem .5rem;margin-bottom:.45rem}
.pri-h{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38)}
.pri-m{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28)}
.pri-l{background:rgba(61,79,107,.35);color:var(--mist);border:1px solid rgba(61,79,107,.45)}
.pp-ntitle{color:var(--cream);font-size:clamp(0.92rem,2.5vw,1rem);margin-bottom:.35rem}
.pp-nbody{color:rgba(248,243,232,.52);font-size:clamp(0.8rem,2.2vw,0.88rem);line-height:1.7}
.pp-ndate{color:rgba(248,243,232,.28);font-size:clamp(0.62rem,1.7vw,0.7rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase;margin-top:.35rem}
.leave-item{padding:.95rem;background:rgba(11,31,58,.4);border:1px solid rgba(184,146,42,.1);margin-bottom:.55rem}
.leave-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.45rem}
.ls{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:clamp(0.62rem,1.7vw,0.7rem);letter-spacing:.1em;text-transform:uppercase;padding:.18rem .55rem}
.ls-ap{background:rgba(26,92,42,.38);color:#4AE382;border:1px solid rgba(26,92,42,.48)}
.ls-pe{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28)}
.ls-re{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38)}
.leave-dates{color:rgba(248,243,232,.52);font-size:clamp(0.78rem,2.1vw,0.85rem);margin-bottom:.28rem}
.leave-rsn{color:rgba(248,243,232,.38);font-size:clamp(0.72rem,2vw,0.8rem);font-family:'Rajdhani',sans-serif}
.alert-item{padding:.75rem .95rem;background:rgba(11,31,58,.4);border-left:3px solid var(--goldL);margin-bottom:.45rem}
.alert-item.att{border-left-color:#f87171}.alert-item.exam{border-left-color:var(--goldLL)}.alert-item.notice{border-left-color:#4AE382}.alert-item.leave{border-left-color:var(--mist)}
.alert-msg{color:rgba(248,243,232,.72);font-size:clamp(0.8rem,2.2vw,0.88rem);margin-bottom:.25rem}
.alert-meta{color:rgba(248,243,232,.28);font-size:clamp(0.62rem,1.7vw,0.7rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase}
.pp-loading{display:flex;align-items:center;justify-content:center;padding:2.5rem;gap:.7rem;color:rgba(248,243,232,.28);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase;font-size:clamp(0.72rem,2vw,0.82rem)}
.spin{width:16px;height:16px;border:2px solid rgba(184,146,42,.28);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.pp-empty{text-align:center;padding:2.2rem;color:rgba(248,243,232,.28)}
.pp-empty-icon{font-size:2.2rem;margin-bottom:.6rem}
.pp-empty p{font-family:'Rajdhani',sans-serif;font-size:clamp(0.72rem,2vw,0.82rem);letter-spacing:.1em;text-transform:uppercase}

@media(max-width:900px){
  html{font-size:clamp(14px,4vw,16px)}
  .hero-wrap,.about-grid,.enquiry-grid,.founder-grid,.fee-grid,.video-grid,.scholar-grid,.portal-grid,.mocktest-grid,.app-grid,.helpdesk-grid{grid-template-columns:1fr}
  .footer-grid{grid-template-columns:1fr 1fr}
  .nav-links{display:none}
  .hamburger{display:flex}
  .dash-panel{margin-top:2rem}
  .form-row{grid-template-columns:1fr}
  .gallery-grid{grid-template-columns:1fr 1fr}
  .result-card{flex-direction:column;gap:.7rem}
  .stu-hdr{flex-direction:column;text-align:center}
  #stickyBar p{display:none}
  .ranker-grid{grid-template-columns:repeat(auto-fill,minmax(140px,1fr))}
  .top-bar-right{display:none}
  .result-banner-slide{height:clamp(140px,40vw,220px)}
  .timeline::before{left:80px}
  .tl-date{min-width:70px}
}
@media(max-width:520px){
  html{font-size:clamp(13px,4.5vw,15px)}
  .footer-grid{grid-template-columns:1fr}
  .hero-btns{flex-direction:column}
  .courses-grid{grid-template-columns:1fr}
  .ribbon-grid{grid-template-columns:repeat(2,1fr)}
  .stats-bar{gap:.6rem}
  .stat-item{padding-right:1rem}
  .ranker-grid{grid-template-columns:repeat(2,1fr)}
  .reviews-grid{grid-template-columns:1fr}
  .countdown-units{gap:.3rem}
  .cd-unit{min-width:44px;padding:.3rem .5rem}
  .top-bar{display:none}
  #langBar{justify-content:center}
  .test-dates{grid-template-columns:1fr 1fr}
  .syl-grid{grid-template-columns:1fr}
  .papers-grid{grid-template-columns:1fr}
  .timeline::before{display:none}
  .tl-item{flex-direction:column;gap:.4rem}
  .tl-date{text-align:left;min-width:auto;display:flex;gap:.5rem;align-items:baseline}
  .tl-dot{display:none}
  .app-features{grid-template-columns:1fr}
  .app-btns{flex-direction:column}
}
</style>
</head>
<body>
<div id="sp"></div>

<!-- LANGUAGE BAR -->
<div id="langBar">
  <span style="color:rgba(248,243,232,.3);font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.1em;text-transform:uppercase">Language:</span>
  <button class="lang-btn active" onclick="setLang('en',this)">English</button>
  <button class="lang-btn" onclick="setLang('hi',this)">हिंदी</button>
</div>

<!-- ① TOP CONTACT BAR -->
<div class="top-bar">
  <div class="top-bar-left">
    <a href="tel:+918974298074" class="top-bar-item"><span>📞</span>
      <span data-en>+91 89742 98074</span>
      <span data-hi>+91 89742 98074</span>
    </a>
    <a href="mailto:gnsikhangabok@gmail.com" class="top-bar-item"><span>✉</span> gnsikhangabok@gmail.com</a>
    <span class="top-bar-item"><span>📍</span>
      <span data-en>Khangabok, Thoubal, Manipur</span>
      <span data-hi>खंगाबोक, थौबल, मणिपुर</span>
    </span>
  </div>
  <div class="top-bar-right">
    <span class="top-bar-hours">
      <span data-en>Mon–Sat: 08:30–17:00</span>
      <span data-hi>सोम–शनि: 08:30–17:00</span>
    </span>
    <div class="top-bar-social">
      <a class="top-bar-soc" href="https://facebook.com/gnsikhangabok" target="_blank" title="Facebook">f</a>
      <a class="top-bar-soc" href="https://youtube.com/@gnsikhangabok" target="_blank" title="YouTube">▶</a>
      <a class="top-bar-soc" href="https://instagram.com/gnsikhangabok" target="_blank" title="Instagram">◉</a>
      <a class="top-bar-soc" href="https://wa.me/918974298074" target="_blank" title="WhatsApp" style="color:#4AE382;border-color:rgba(37,211,102,.3)">W</a>
      <a class="top-bar-soc" href="https://play.google.com/store" target="_blank" title="Play Store">▲</a>
    </div>
  </div>
</div>

<!-- STICKY APPLY BAR -->
<div id="stickyBar">
  <p>⚑ Admissions 2026–27 are open — <strong>Limited seats remaining.</strong> Apply before 30 June 2026.</p>
  <div class="sticky-btns">
    <button class="sb-btn sb-btn-gold" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'});document.getElementById('stickyBar').classList.remove('show')">Apply Now →</button>
    <a href="https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20am%20interested%20in%20admissions%20for%202026%E2%80%9327." class="sb-btn sb-btn-wa" target="_blank">WhatsApp</a>
    <button class="sb-close" onclick="this.parentElement.parentElement.classList.remove('show');this.parentElement.parentElement.style.display='none'" title="Dismiss">✕</button>
  </div>
</div>

<!-- ALERT -->
<div class="alert-strip" id="alertbar">
  <span>⚑ Admissions open 2026–27 — Limited seats. Apply before <strong>30 June 2026.</strong></span>
  <button onclick="document.getElementById('alertbar').style.display='none'">✕</button>
</div>

<!-- TICKER -->
<div class="ticker-wrap"><div class="ticker-inner"><div class="ticker-label">Latest</div><div class="ticker-scroll"><div class="ticker-track">ADMISSIONS OPEN 2026–27 ◆ RESULT: 66 SELECTED IN NVS & SAINIK SCHOOL 2025–26 ◆ SUMMER BATCH COMMENCING JULY 2026 ◆ SUNDAY MOCK TESTS ONGOING ◆ EST. 2016 · 200+ OFFICERS PRODUCED ◆ CALL +91 89742 98074 ◆ KHANGABOK, THOUBAL, MANIPUR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;ADMISSIONS OPEN 2026–27 ◆ RESULT: 66 SELECTED IN NVS & SAINIK SCHOOL 2025–26 ◆ SUMMER BATCH COMMENCING JULY 2026 ◆ SUNDAY MOCK TESTS ONGOING ◆ EST. 2016 · 200+ OFFICERS PRODUCED ◆ CALL +91 89742 98074 ◆ KHANGABOK, THOUBAL, MANIPUR &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</div></div></div></div>

<!-- ① COUNTDOWN TIMER -->
<div class="countdown-bar">
  <div class="countdown-label">Admissions close in</div>
  <div class="countdown-units">
    <div class="cd-unit"><span class="cd-num" id="cd-d">00</span><span class="cd-lbl">Days</span></div>
    <div class="cd-sep">:</div>
    <div class="cd-unit"><span class="cd-num" id="cd-h">00</span><span class="cd-lbl">Hours</span></div>
    <div class="cd-sep">:</div>
    <div class="cd-unit"><span class="cd-num" id="cd-m">00</span><span class="cd-lbl">Mins</span></div>
    <div class="cd-sep">:</div>
    <div class="cd-unit"><span class="cd-num" id="cd-s">00</span><span class="cd-lbl">Secs</span></div>
  </div>
  <button class="countdown-cta" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Apply Before Deadline →</button>
</div>

<!-- ② RESULT CELEBRATION BANNER SLIDER -->
<div class="result-banner" id="resultBanner">
  <div class="result-banner-track" id="rbTrack">
    <!-- Slide 1 -->
    <div class="result-banner-slide">
      <img src="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/result-banner-2025.jpg" alt="GNSI Result 2025" onerror="this.style.display='none'">
      <div class="result-banner-overlay">
        <div class="result-banner-content">
          <div class="result-banner-year">🏆 Result 2025–26</div>
          <div class="result-banner-title">GNSI's Best Year — <strong>66 Students Selected</strong></div>
          <div class="result-banner-sub">NVS Jawahar Navodaya · Sainik School · RMS · Across Manipur</div>
        </div>
      </div>
    </div>
    <!-- Slide 2 -->
    <div class="result-banner-slide">
      <img src="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/result-banner-sainik.jpg" alt="Sainik School Result" onerror="this.style.display='none'">
      <div class="result-banner-overlay">
        <div class="result-banner-content">
          <div class="result-banner-year">⭐ Sainik School 2025</div>
          <div class="result-banner-title">Manipur's <strong>Highest Selection Rate</strong> in Sainik School</div>
          <div class="result-banner-sub">AISSEE Class 6 & Class 9 · Tilaiya · Imphal · All India</div>
        </div>
      </div>
    </div>
    <!-- Slide 3 -->
    <div class="result-banner-slide">
      <img src="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/result-banner-nvs.jpg" alt="NVS Result" onerror="this.style.display='none'">
      <div class="result-banner-overlay">
        <div class="result-banner-content">
          <div class="result-banner-year">📚 NVS 2025</div>
          <div class="result-banner-title"><strong>94% Selection Rate</strong> in Jawahar Navodaya</div>
          <div class="result-banner-sub">JNVST Class 6 & Class 9 · Thoubal District · Manipur</div>
        </div>
      </div>
    </div>
    <!-- Slide 4 — Admissions Open -->
    <div class="result-banner-slide" style="background:linear-gradient(135deg,var(--navy3),var(--navy))">
      <div class="result-banner-overlay" style="background:linear-gradient(90deg,rgba(11,31,58,.98),rgba(11,31,58,.7))">
        <div class="result-banner-content">
          <div class="result-banner-year">🎯 Admissions Open 2026–27</div>
          <div class="result-banner-title">Join GNSI — <strong>Limited Seats</strong> Remaining</div>
          <div class="result-banner-sub">Apply before 30 June 2026 · Hostel & Day Scholar options · Call +91 89742 98074</div>
        </div>
      </div>
    </div>
  </div>
  <button class="rb-prev" onclick="rbSlide(-1)">‹</button>
  <button class="rb-next" onclick="rbSlide(1)">›</button>
  <div class="result-banner-nav" id="rbDots"></div>
</div>

<!-- NAV -->
<nav>
  <div class="nav-inner">
    <a class="brand" href="#">
      <div class="crest"><div class="crest-i">G</div></div>
      <div class="brand-text"><h2>GNSI</h2><small>Est. 2016 · Khangabok, Manipur</small></div>
    </a>
    <ul class="nav-links">
      <li><a href="#notices">Notices</a></li>
      <li><a href="#courses">Courses</a></li>
      <li><a href="#portal">Portal</a></li>
      <li><a href="#mock-tests">Mock Tests</a></li>
      <li><a href="#exam-calendar">Calendar</a></li>
      <li><a href="#scholarship">Free Test</a></li>
      <li><a href="#question-papers">Papers</a></li>
      <li><a href="#app-download">App</a></li>
      <li><a href="#enquiry">Enquire</a></li>
      <li><a href="#" onclick="openPP();return false;" class="nav-par">Parents →</a></li>
      <li><a href="#fee-payment" class="nav-fee" style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;display:inline-block;padding:.4rem 1rem;color:#fff;">Pay Fee →</a></li>
      <li><button onclick="window.parent.postMessage('gnsi-staff-login','*')" class="nav-btn" style="font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.07em;text-transform:uppercase;">Staff Login →</button></li>
    </ul>
    <div style="display:flex;align-items:center;gap:.5rem">
      <button onclick="openPP()" style="background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.3);color:#4AE382;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.08em;text-transform:uppercase;padding:.38rem .75rem;cursor:pointer;transition:.2s;">Parents</button>
      <button class="hamburger" id="hbg"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="mob-menu" id="mobMenu">
  <a href="#notices" onclick="closeMob()">Notices</a>
  <a href="#courses" onclick="closeMob()">Courses</a>
  <a href="#results" onclick="closeMob()">Results</a>
  <a href="#scholarship" onclick="closeMob()">Free Test / Scholarship</a>
  <a href="#question-papers" onclick="closeMob()">Question Papers</a>
  <a href="#syllabus" onclick="closeMob()">Syllabus</a>
  <a href="#faculty" onclick="closeMob()">Faculty</a>
  <a href="#about" onclick="closeMob()">About</a>
  <a href="#enquiry" onclick="closeMob()">Enquire</a>
  <a href="#fee-payment" onclick="closeMob()" class="mob-fee">Pay Fee →</a>
  <a href="#" onclick="openPP();closeMob();return false;" class="mob-par">Parents Portal →</a>
  <button onclick="window.parent.postMessage('gnsi-staff-login','*');closeMob()" class="mob-cta" style="background:var(--gold);color:var(--navy);margin:1rem 5%;text-align:center;border:none;width:calc(100% - 10%);padding:.85rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.9rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;">Staff Login →</button>
</div>

<!-- HERO -->
<section class="hero">
  <div class="hero-pattern"></div>
  <div class="hero-orb hero-orb1"></div>
  <div class="hero-orb hero-orb2"></div>
  <div class="hero-wrap">
    <div>
      <div class="tricolor"><div></div><div></div><div></div></div>
      <div class="hero-eyebrow">Admissions Open · 2026–27</div>
      <h1>
        <em><span data-en>Forge Discipline.</span><span data-hi>अनुशासन गढ़ो।</span></em>
        <span>
          <span data-en>Command Excellence.</span>
          <span data-hi>श्रेष्ठता का नेतृत्व करो।</span>
        </span>
      </h1>
      <p>
        <span data-en>Guidance Navodaya &amp; Sainik Institute — Manipur's premier residential coaching centre for NVS, Sainik School, and RMS entrance examinations. Over <strong>200 commissioned officers</strong> shaped in a decade of service to the nation.</span>
        <span data-hi>गाइडेंस नवोदय और सैनिक इंस्टीट्यूट — मणिपुर का प्रमुख आवासीय कोचिंग केंद्र NVS, सैनिक स्कूल और RMS प्रवेश परीक्षाओं के लिए। एक दशक में <strong>200+ कमीशंड अधिकारी</strong> तैयार किए।</span>
      </p>
      <div class="hero-btns">
        <a href="#enquiry" class="btn btn-gold">Enquire for Admission →</a>
        <button onclick="openPP()" class="btn btn-grn">Parents Portal →</button>
        <a href="https://wa.me/918974298074?text=Hello%2C+I+am+enquiring+about+GNSI+admissions" class="btn btn-wa" target="_blank">WhatsApp Us</a>
      </div>
      <!-- ② BROCHURE + FREE DEMO -->
      <div class="hero-quick">
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Brochure-2026.pdf" class="btn-brochure" target="_blank" download>📄 Download Brochure</a>
        <button class="btn-demo" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">🎯 Book Free Demo Class</button>
        <a href="#fee-payment" class="btn-fee btn" style="padding:.6rem 1.2rem;">💳 Pay Fee Online</a>
      </div>
      <div class="stats-bar">
        <div class="stat-item"><strong><span class="count-up" data-target="95" data-suffix="%">95%</span></strong><span>Selection Rate</span></div>
        <div class="stat-item"><strong><span class="count-up" data-target="10" data-suffix="+">10+</span></strong><span>Years</span></div>
        <div class="stat-item"><strong><span class="count-up" data-target="200" data-suffix="+">200+</span></strong><span>Officers</span></div>
        <div class="stat-item"><strong><span class="count-up" data-target="500" data-suffix="+">500+</span></strong><span>Trained</span></div>
      </div>
    </div>
    <div class="dash-panel">
      <div class="dash-hd"><div class="dash-hd-title">Live Dashboard</div><div class="live-dot"><div class="dot"></div>Live</div></div>
      <div class="dash-kpi">
        <div class="kpi"><strong id="kpi-staff" class="lpulse">—</strong><span>Staff</span></div>
        <div class="kpi"><strong id="kpi-att" class="lpulse">—</strong><span>Present Today</span></div>
        <div class="kpi"><strong id="kpi-exams" class="lpulse">—</strong><span>Upcoming Exams</span></div>
      </div>
      <div class="dash-body">
        <div class="dash-row"><span>New Enquiries</span><strong id="kpi-enq" class="lpulse">—</strong></div>
        <div class="dash-row"><span>Hostel Occupancy</span><strong>92%</strong></div>
        <div class="dash-row"><span>Next Mock Test</span><strong>This Sunday</strong></div>
        <div class="dash-row"><span>Latest Notice</span><strong id="kpi-notice" class="lpulse">—</strong></div>
      </div>
    </div>
  </div>
</section>

<!-- RIBBON -->
<div class="ribbon">
  <div class="ribbon-grid">
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="10" data-suffix="+">10+</span></strong><span>Years of Excellence</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="500" data-suffix="+">500+</span></strong><span>Students Trained</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="95" data-suffix="%">95%</span></strong><span>Selection Rate</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="200" data-suffix="+">200+</span></strong><span>Officers Produced</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="66" data-suffix="">66</span></strong><span>Selected 2025–26</span></div>
  </div>
</div>

<!-- ③ RANKER WALL -->
<section class="ranker-section" id="rankers">
  <div class="container">
    <div class="eyebrow reveal">Our Pride</div>
    <h2 class="st reveal">2025–26 Selections</h2>
    <div class="rule reveal"><div class="rule-line" style="background:linear-gradient(90deg,var(--gold),transparent)"></div><div class="rule-d"></div><div class="rule-line" style="background:linear-gradient(90deg,transparent,var(--gold))"></div></div>
    <div class="ranker-grid" id="rankerGrid">
      <!-- Static placeholders — replace with real photos from Supabase -->
      <div class="ranker-card reveal-scale"><div class="ranker-badge">AIR Rank</div><div class="ranker-photo">L</div><h4>GNSI Student</h4><div class="ranker-school">Sainik School Tilaiya</div><div class="ranker-batch">Batch 2025–26</div></div>
      <div class="ranker-card reveal-scale"><div class="ranker-photo">K</div><h4>GNSI Student</h4><div class="ranker-school">NVS Jawahar Navodaya</div><div class="ranker-batch">Batch 2025–26</div></div>
      <div class="ranker-card reveal-scale"><div class="ranker-photo">R</div><h4>GNSI Student</h4><div class="ranker-school">Sainik School Imphal</div><div class="ranker-batch">Batch 2025–26</div></div>
      <div class="ranker-card reveal-scale"><div class="ranker-photo">M</div><h4>GNSI Student</h4><div class="ranker-school">NVS Class 6</div><div class="ranker-batch">Batch 2025–26</div></div>
      <div class="ranker-card reveal-scale"><div class="ranker-photo">T</div><h4>GNSI Student</h4><div class="ranker-school">RMS Selection</div><div class="ranker-batch">Batch 2025–26</div></div>
      <div class="ranker-card reveal-scale"><div class="ranker-photo">S</div><h4>GNSI Student</h4><div class="ranker-school">NVS Class 9</div><div class="ranker-batch">Batch 2025–26</div></div>
      <div class="ranker-card reveal-scale"><div class="ranker-photo">P</div><h4>GNSI Student</h4><div class="ranker-school">Sainik School Tilaiya</div><div class="ranker-batch">Batch 2025–26</div></div>
      <div class="ranker-card reveal-scale"><div class="ranker-photo">A</div><h4>GNSI Student</h4><div class="ranker-school">NVS Jawahar Navodaya</div><div class="ranker-batch">Batch 2025–26</div></div>
    </div>
    <div class="ranker-cta">
      <a href="#enquiry" class="btn btn-gold">Join the Next Batch →</a>
    </div>
    <p class="ranker-note">66 students selected in 2025–26 · Names withheld for privacy · Contact institute for verified result letters</p>
  </div>
</section>

<!-- NOTICES -->
<section class="pad" id="notices">
  <div class="container">
    <div class="eyebrow reveal">Notice Board</div>
    <h2 class="st reveal">Official Announcements</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="cards-row" id="publicNoticeCards">
      <div class="notice-card urgent reveal"><div class="notice-badge badge-open">Open</div><h3>Admissions 2026–27</h3><p>Applications are open for the 2026–27 session. Limited seats available for both day scholars and hostel boarders. Contact the institute at the earliest.</p><div class="notice-date">Issued: June 2026</div></div>
      <div class="notice-card reveal"><div class="notice-badge badge-weekly">Weekly</div><h3>Sunday Mock Tests</h3><p>Mock test series continues every Sunday for NVS and Sainik School aspirants. Detailed review sessions follow each examination.</p><div class="notice-date">Ongoing · Every Sunday</div></div>
      <div class="notice-card reveal"><div class="notice-badge badge-limited">Limited</div><h3>Hostel Seats</h3><p>Very few residential hostel seats remain available for the new academic session. Parents are urged to confirm at the earliest.</p><div class="notice-date">Issued: June 2026</div></div>
    </div>
  </div>
</section>

<!-- COURSES -->
<section class="pad-alt" id="courses">
  <div class="container">
    <div class="eyebrow reveal">Our Programmes</div>
    <h2 class="st reveal">Courses Offered</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <p style="color:var(--slate);margin-bottom:2rem;max-width:560px;line-height:1.85;font-size:clamp(0.92rem,2.4vw,1rem)" class="reveal">Structured pathways from foundation to championship level — designed to maximise selection probability at India's finest schools.</p>
    <div class="courses-grid">
      <div class="course-card sainik reveal-scale"><div class="course-badge cb-sainik">Sainik School</div><h3>Sainik Preparation</h3><p class="sub">AISSEE · Class 6 & Class 9 entry</p><ul class="course-features"><li>Achiever — Foundation level</li><li>Leader — Intermediate level</li><li>Champion — Advanced level</li><li>Physical fitness training</li><li>Interview preparation</li><li>Hostel & day scholar options</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
      <div class="course-card navodaya reveal-scale"><div class="course-badge cb-nv">Navodaya · NVS</div><h3>Navodaya Preparation</h3><p class="sub">JNVST · Class 6 & Class 9 entry</p><ul class="course-features"><li>Lakshya — Intensive programme</li><li>Umeed — Foundational track</li><li>Mental ability & language focus</li><li>Weekly mock tests</li><li>Previous year paper analysis</li><li>Hostel & day scholar options</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
      <div class="course-card foundation reveal-scale"><div class="course-badge cb-fn">Foundation</div><h3>Foundation Programme</h3><p class="sub">School readiness & competitive prep</p><ul class="course-features"><li>Elite — High-performance track</li><li>Prime — Standard track</li><li>Mathematics & English focus</li><li>Study habit building</li><li>Discipline-first environment</li><li>Day scholar option available</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
      <div class="course-card combined reveal-scale"><div class="course-badge cb-co">Combined</div><h3>Combined Course</h3><p class="sub">NVS + Sainik dual preparation</p><ul class="course-features"><li>Covers both JNVST & AISSEE</li><li>Maximises selection chances</li><li>Integrated timetable</li><li>Dedicated subject teachers</li><li>Weekend booster classes</li><li>Hostel & day scholar options</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
    </div>
  </div>
</section>

<!-- ④ FACILITIES -->
<section class="pad" id="facilities">
  <div class="container">
    <div class="eyebrow reveal">Campus Life</div>
    <h2 class="st reveal">World-Class Facilities</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="facilities-grid">
      <div class="facility-card reveal-scale">
        <span class="facility-icon">🏠</span>
        <h3>Residential Hostel</h3>
        <p>Supervised residential accommodation modelled on Sainik School environment.</p>
        <ul>
          <li>Separate boys hostel blocks</li>
          <li>24/7 warden supervision</li>
          <li>Structured study hours</li>
          <li>Daily inspection routine</li>
        </ul>
      </div>
      <div class="facility-card reveal-scale">
        <span class="facility-icon">🍽️</span>
        <h3>Mess & Nutrition</h3>
        <p>Balanced, hygienic meals prepared daily to support growing students.</p>
        <ul>
          <li>Three meals + evening snack</li>
          <li>Regional & balanced diet</li>
          <li>Clean kitchen standards</li>
          <li>Special occasion meals</li>
        </ul>
      </div>
      <div class="facility-card reveal-scale">
        <span class="facility-icon">📚</span>
        <h3>Smart Classrooms</h3>
        <p>Well-equipped classrooms with focus on interactive, concept-based learning.</p>
        <ul>
          <li>Small batch sizes</li>
          <li>Subject-specialist teachers</li>
          <li>Daily test & review sessions</li>
          <li>Study materials provided</li>
        </ul>
      </div>
      <div class="facility-card reveal-scale">
        <span class="facility-icon">⚽</span>
        <h3>Sports & PT</h3>
        <p>Daily physical training and sports — essential for Sainik School fitness standards.</p>
        <ul>
          <li>Morning PT schedule</li>
          <li>Football, volleyball, athletics</li>
          <li>Drill and parade practice</li>
          <li>Fitness assessment</li>
        </ul>
      </div>
      <div class="facility-card reveal-scale">
        <span class="facility-icon">🏥</span>
        <h3>Health & Welfare</h3>
        <p>Student health and wellbeing is monitored regularly throughout the academic year.</p>
        <ul>
          <li>First aid on campus</li>
          <li>Regular health check-ups</li>
          <li>Tie-up with local clinic</li>
          <li>Parent alert for illness</li>
        </ul>
      </div>
      <div class="facility-card reveal-scale">
        <span class="facility-icon">📱</span>
        <h3>Digital ERP Portal</h3>
        <p>Parents track attendance, results, leaves and notices from anywhere — live.</p>
        <ul>
          <li>Live attendance tracking</li>
          <li>Exam score reports</li>
          <li>Hostel leave management</li>
          <li>Real-time alerts & notices</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ⑤ VIDEO SECTION -->
<section class="video-section" id="videos">
  <div class="container">
    <div class="eyebrow reveal">See GNSI in Action</div>
    <h2 class="st reveal">Videos & Campus Tour</h2>
    <div class="rule reveal"><div class="rule-line" style="background:linear-gradient(90deg,var(--gold),transparent)"></div><div class="rule-d"></div><div class="rule-line" style="background:linear-gradient(90deg,transparent,var(--gold))"></div></div>
    <div class="video-grid reveal">
      <div class="video-main">
        <div class="video-embed" id="mainVideoEmbed">
          <div class="video-placeholder" id="videoPlaceholder" onclick="loadMainVideo('https://www.youtube.com/embed/?listType=user_uploads&list=gnsikhangabok')">
            <div class="play-btn">▶</div>
            <p>GNSI Campus & Classroom Tour</p>
          </div>
        </div>
        <p style="color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:clamp(0.7rem,1.9vw,0.78rem);letter-spacing:.06em;text-transform:uppercase;margin-top:.7rem">Click to load video · Opens YouTube</p>
      </div>
      <div class="video-list">
        <div class="video-item" onclick="loadMainVideo('https://www.youtube.com/@gnsikhangabok')">
          <div class="video-thumb">▶</div>
          <div><div class="video-item-title">Morning Assembly & PT Session</div><div class="video-item-sub">Campus Life · 3 min</div></div>
        </div>
        <div class="video-item" onclick="loadMainVideo('https://www.youtube.com/@gnsikhangabok')">
          <div class="video-thumb">▶</div>
          <div><div class="video-item-title">Result Celebration 2025–26</div><div class="video-item-sub">Achievements · 5 min</div></div>
        </div>
        <div class="video-item" onclick="loadMainVideo('https://www.youtube.com/@gnsikhangabok')">
          <div class="video-thumb">▶</div>
          <div><div class="video-item-title">Classroom & Teaching Methods</div><div class="video-item-sub">Academics · 4 min</div></div>
        </div>
        <div class="video-item" onclick="loadMainVideo('https://www.youtube.com/@gnsikhangabok')">
          <div class="video-thumb">▶</div>
          <div><div class="video-item-title">Hostel Life & Mess Tour</div><div class="video-item-sub">Facilities · 3 min</div></div>
        </div>
        <div style="margin-top:1rem">
          <a href="https://youtube.com/@gnsikhangabok" target="_blank" class="btn btn-out" style="display:inline-flex;border-color:rgba(255,0,0,.5);color:#f87171;">▶ View All Videos on YouTube →</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- FOUNDER -->
<section class="pad" id="founder">
  <div class="container founder-grid">
    <div class="reveal-left">
      <div class="founder-img">
        <span style="letter-spacing:.1em;font-size:.7rem">FOUNDER PHOTO</span>
        <div class="founder-img-badge">
          <h4>Moirangthem Himan Singh</h4>
          <span>Founder & Administrator · GNSI</span>
        </div>
      </div>
    </div>
    <div class="reveal-right">
      <div class="eyebrow">Founder's Message</div>
      <h2 class="st">Built on Discipline. Driven by Purpose.</h2>
      <div class="rule"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
      <blockquote class="founder-quote">"Every child who walks into GNSI carries the potential to serve the nation. Our responsibility is to ensure that potential is never wasted for lack of opportunity or preparation."</blockquote>
      <p style="color:var(--slate);line-height:1.9;margin-bottom:1rem;font-size:clamp(0.9rem,2.4vw,0.95rem)">GNSI was established in 2016 with a simple conviction: students from Manipur deserve the same calibre of preparation as those in metro cities. In a decade, we have grown from a single classroom to a full residential campus — producing over 200 officers and achievers.</p>
      <p style="color:var(--slate);line-height:1.9;margin-bottom:1rem;font-size:clamp(0.9rem,2.4vw,0.95rem)">Our approach is not just academic. We build character, discipline, and resilience — the qualities that Navodaya and Sainik School demand, and that life rewards.</p>
      <div class="founder-sig">Moirangthem Himan Singh <span>Founder & Administrator, GNSI</span></div>
    </div>
  </div>
</section>

<!-- FACULTY -->
<section class="pad-alt" id="faculty">
  <div class="container">
    <div class="eyebrow reveal">Our Team</div>
    <h2 class="st reveal">Faculty & Leadership</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="faculty-grid" id="facultyGrid">
      <div class="faculty-card reveal"><div class="faculty-photo">H</div><h3>Moirangthem Himan Singh</h3><div class="role">Founder & Administrator</div><div class="subj">Mathematics · Strategic Leadership</div><div class="exp">10+ Years · Est. GNSI 2016</div></div>
      <div class="faculty-card reveal"><div class="faculty-photo">A</div><h3>Moirangthem Arunkumar Singh</h3><div class="role">Vice Principal</div><div class="subj">Academic Oversight · Administration</div><div class="exp">Senior Faculty</div></div>
      <div class="faculty-card reveal"><div class="faculty-photo">D</div><h3>Ningthoujam Deepak Singh</h3><div class="role">Hostel Superintendent</div><div class="subj">Residential Life · Discipline</div><div class="exp">Hostel Management</div></div>
      <div class="faculty-card reveal"><div class="faculty-photo">✦</div><h3>Teaching Faculty</h3><div class="role">Subject Specialists</div><div class="subj">Mathematics · Science · English · GK</div><div class="exp">Sainik & NVS Exam Specialists</div></div>
    </div>
  </div>
</section>

<!-- ABOUT -->
<section class="pad" id="about">
  <div class="container about-grid">
    <div class="about-text">
      <div class="eyebrow reveal">About the Institute</div>
      <h2 class="st reveal">A Decade of Shaping Officers</h2>
      <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
      <p class="reveal">GNSI was founded in 2016 with a single purpose — to give students from Manipur the preparation and discipline required to earn entry into India's finest military and academic schools.</p>
      <p class="reveal">Located at Khangabok in Thoubal District, the institute has grown from a modest classroom to a full residential campus with a structured curriculum, expert faculty, and a proven record of results.</p>
      <p class="reveal">Our digital ERP portal allows parents to track attendance, examination results, hostel leave, and institutional notices from any device, from anywhere — live.</p>
      <div class="feat-tiles">
        <div class="tile reveal"><div>🏫</div><strong>Est. 2016</strong><span>A decade of discipline</span></div>
        <div class="tile reveal"><div>👨‍🎓</div><strong>500+ Alumni</strong><span>Across Manipur & beyond</span></div>
        <div class="tile reveal"><div>🏆</div><strong>Rank 1</strong><span>Thoubal District</span></div>
        <div class="tile reveal"><div>📱</div><strong>Parents Portal</strong><span>Live tracking, any device</span></div>
      </div>
    </div>
    <div>
      <div class="eyebrow reveal">Performance Metrics</div>
      <h2 class="st reveal" style="margin-bottom:1.4rem">Selection Record</h2>
      <div class="bar-block reveal"><div class="bar-label"><span>NVS Selection Rate</span><strong>94%</strong></div><div class="bar-track"><div class="bar-fill" data-w="94" style="background:var(--navy)"></div></div></div>
      <div class="bar-block reveal"><div class="bar-label"><span>Sainik School Rate</span><strong>88%</strong></div><div class="bar-track"><div class="bar-fill" data-w="88" style="background:var(--red)"></div></div></div>
      <div class="bar-block reveal"><div class="bar-label"><span>Student Satisfaction</span><strong>98%</strong></div><div class="bar-track"><div class="bar-fill" data-w="98" style="background:var(--gold)"></div></div></div>
      <div class="bar-block reveal"><div class="bar-label"><span>Hostel Occupancy</span><strong>92%</strong></div><div class="bar-track"><div class="bar-fill" data-w="92" style="background:var(--navy3)"></div></div></div>
      <div class="bar-block reveal"><div class="bar-label"><span>Faculty Rating</span><strong>96%</strong></div><div class="bar-track"><div class="bar-fill" data-w="96" style="background:#4E6329"></div></div></div>
    </div>
  </div>
</section>

<!-- RESULTS -->
<section class="pad-alt" id="results">
  <div class="container">
    <div class="eyebrow reveal">Results</div>
    <h2 class="st reveal">Selections & Achievements</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="cards-row">
      <div class="result-card reveal-left"><div class="year-badge">2025<small>–26</small></div><div class="result-body"><div class="result-number">66</div><h3>NVS & Sainik School</h3><p>66 students selected across NVS Jawahar Navodaya and Sainik School — our best result to date.</p></div></div>
      <div class="result-card reveal"><div class="year-badge">2024<small>–25</small></div><div class="result-body"><h3>Strong District Performance</h3><p>Continued high selection rates with district-level recognition across military and academic entrance tracks.</p></div></div>
      <div class="result-card reveal-right"><div class="year-badge">2023<small>–24</small></div><div class="result-body"><h3>Consistent Growth</h3><p>Consistent placement improvement year on year. Graduates serving in NDA and commissioned as officers.</p></div></div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="pad">
  <div class="container">
    <div class="eyebrow reveal">Testimonials</div>
    <h2 class="st reveal">What Parents Say</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div style="max-width:680px" class="reveal">
      <div class="testi-wrap">
        <div class="testi-track" id="testiTrack">
          <div class="testi-card"><div class="stars">★★★★★</div><blockquote>"My son was selected for Sainik School Tilaiya on his first attempt. The discipline and teaching at GNSI is unlike anything in Thoubal District. The teachers genuinely care about each child's progress."</blockquote><cite>Parent · Sainik School Selection · Batch 2024</cite></div>
          <div class="testi-card"><div class="stars">★★★★★</div><blockquote>"We live far from Khangabok but the hostel facility gave us complete peace of mind. The Parents Portal means we can check attendance and notices from our phone without even calling the school."</blockquote><cite>Parent · NVS Selection · Batch 2025</cite></div>
          <div class="testi-card"><div class="stars">★★★★★</div><blockquote>"Our daughter was an average student before joining GNSI. Within six months the improvement in her confidence and scores was visible to everyone. She cleared NVS Class 6 with merit."</blockquote><cite>Parent · NVS Jawahar Navodaya Selection · Batch 2025</cite></div>
          <div class="testi-card"><div class="stars">★★★★★</div><blockquote>"The mock test every Sunday is what made the difference. By exam day my son had sat through so many practice papers that the real exam felt easy to him. Excellent faculty and structured programme."</blockquote><cite>Parent · Sainik School Selection · Batch 2023</cite></div>
        </div>
      </div>
      <div class="slider-ctrl">
        <button class="slider-btn" onclick="tSlide(-1)">‹</button>
        <div class="slider-dots" id="testiDots"></div>
        <button class="slider-btn" onclick="tSlide(1)">›</button>
      </div>
    </div>
  </div>
</section>

<!-- ⑥ GOOGLE REVIEWS -->
<section class="reviews-section" id="reviews">
  <div class="container">
    <div class="eyebrow reveal">Verified Reviews</div>
    <h2 class="st reveal">Google Reviews</h2>
    <div class="rule reveal"><div class="rule-line" style="background:linear-gradient(90deg,var(--gold),transparent)"></div><div class="rule-d"></div><div class="rule-line" style="background:linear-gradient(90deg,transparent,var(--gold))"></div></div>
    <div class="reviews-header reveal">
      <div class="reviews-score">
        <span class="score-num">4.9</span>
        <div class="score-stars">★★★★★</div>
        <span class="score-count">Based on 80+ Reviews</span>
      </div>
      <p class="reviews-desc">Trusted by hundreds of families across Manipur. Our parents consistently rate GNSI as the best coaching institute in Thoubal District for Sainik School and NVS preparation.</p>
    </div>
    <div class="reviews-grid">
      <div class="review-card reveal">
        <div class="review-top"><div class="review-av">L</div><div><div class="review-name">Laishram Ibeton Singh</div><div class="review-date">May 2026</div></div></div>
        <div class="review-stars">★★★★★</div>
        <p class="review-text">"My son got selected in Sainik School Tilaiya. GNSI's structured coaching and discipline made all the difference. Highly recommend to every parent in Manipur."</p>
      </div>
      <div class="review-card reveal">
        <div class="review-top"><div class="review-av">N</div><div><div class="review-name">Ningombam Priya Devi</div><div class="review-date">April 2026</div></div></div>
        <div class="review-stars">★★★★★</div>
        <p class="review-text">"Best institute in Thoubal District. The teachers are very dedicated. My daughter cleared NVS Class 6 on the first attempt. The parents portal is very helpful."</p>
      </div>
      <div class="review-card reveal">
        <div class="review-top"><div class="review-av">K</div><div><div class="review-name">Konthoujam Ranjit Singh</div><div class="review-date">March 2026</div></div></div>
        <div class="review-stars">★★★★★</div>
        <p class="review-text">"The Sunday mock tests were the key. My son sat more than 30 full papers before the real exam. The practice and review sessions are excellent and very systematic."</p>
      </div>
      <div class="review-card reveal">
        <div class="review-top"><div class="review-av">T</div><div><div class="review-name">Thokchom Sushila Devi</div><div class="review-date">February 2026</div></div></div>
        <div class="review-stars">★★★★★</div>
        <p class="review-text">"The hostel is safe and well supervised. As a parent from a distant village I was worried, but the warden and staff take excellent care of the students. Very satisfied."</p>
      </div>
    </div>
    <div style="margin-top:1.5rem" class="reveal">
      <a href="https://g.page/gnsikhangabok/review" target="_blank" class="google-badge">⭐ Write a Review on Google · View All Reviews →</a>
    </div>
  </div>
</section>

<!-- ⑦ BLOG / NEWS -->
<section class="pad-alt" id="blog">
  <div class="container">
    <div class="eyebrow reveal">Updates & Insights</div>
    <h2 class="st reveal">News & Articles</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="blog-grid">
      <div class="blog-card reveal-scale">
        <div class="blog-thumb">📰<span class="blog-cat">Results</span></div>
        <div class="blog-body">
          <div class="blog-date">June 2026</div>
          <h3>GNSI Records Best-Ever Result: 66 Students Selected in 2025–26</h3>
          <p>Guidance Navodaya & Sainik Institute achieves its highest ever annual selection count, with 66 students clearing NVS and Sainik School entrance exams across Manipur.</p>
          <a href="#results" class="blog-read">Read More →</a>
        </div>
      </div>
      <div class="blog-card reveal-scale">
        <div class="blog-thumb">📋<span class="blog-cat">Admissions</span></div>
        <div class="blog-body">
          <div class="blog-date">June 2026</div>
          <h3>Admissions Open for 2026–27: What Parents Need to Know</h3>
          <p>Seats are limited for the new session beginning July 2026. Here is everything you need to know about the admission process, courses, hostel options, and fee structure at GNSI.</p>
          <a href="#enquiry" class="blog-read">Apply Now →</a>
        </div>
      </div>
      <div class="blog-card reveal-scale">
        <div class="blog-thumb">📝<span class="blog-cat">Exam Tips</span></div>
        <div class="blog-body">
          <div class="blog-date">May 2026</div>
          <h3>How to Prepare Your Child for JNVST Class 6: A Parent's Guide</h3>
          <p>The Jawahar Navodaya Vidyalaya Selection Test is one of India's most competitive entrance exams. Our faculty shares the preparation strategy that has produced 94% selection rates at GNSI.</p>
          <a href="#enquiry" class="blog-read">Get Guidance →</a>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- GALLERY -->
<section class="pad" id="gallery">
  <div class="container">
    <div class="eyebrow reveal">Campus Life</div>
    <h2 class="st reveal">Gallery</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="gallery-grid reveal" id="galleryGrid">
      <div class="gcell" style="grid-row:span 2;aspect-ratio:auto;min-height:280px"><div class="gcell-lbl">Morning Assembly</div></div>
      <div class="gcell"><div class="gcell-lbl">Classroom Session</div></div>
      <div class="gcell"><div class="gcell-lbl">Hostel Block</div></div>
      <div class="gcell"><div class="gcell-lbl">Mock Test Day</div></div>
      <div class="gcell"><div class="gcell-lbl">Award Ceremony</div></div>
    </div>
    <div style="margin-top:1.2rem;display:flex;align-items:center;gap:1rem;flex-wrap:wrap" class="reveal">
      <span style="color:var(--mist);font-size:clamp(0.75rem,2vw,0.85rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em">More photos on social media:</span>
      <a class="soc-btn soc-fb" href="https://facebook.com/gnsikhangabok" target="_blank">f Facebook</a>
      <a class="soc-btn soc-yt" href="https://youtube.com/@gnsikhangabok" target="_blank">▶ YouTube</a>
      <a class="soc-btn soc-ig" href="https://instagram.com/gnsikhangabok" target="_blank">◉ Instagram</a>
    </div>
  </div>
</section>

<!-- EVENTS -->
<section class="pad-alt" id="events">
  <div class="container">
    <div class="eyebrow reveal">Upcoming</div>
    <h2 class="st reveal">Events & Schedule</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div style="display:flex;flex-direction:column;gap:.75rem;max-width:680px">
      <div class="event-card reveal"><div class="event-date-block"><div class="day">01</div><div class="month">Jul</div></div><div class="event-body"><h3>Summer Batch Begins</h3><span>New session commencing — fresh admissions welcome. Hostel and day scholar options available.</span></div></div>
      <div class="event-card reveal"><div class="event-date-block"><div class="day">22</div><div class="month">Jun</div></div><div class="event-body"><h3>Sunday Mock Test</h3><span>Weekly NVS & Sainik School mock exam series. Open to all enrolled students.</span></div></div>
      <div class="event-card reveal"><div class="event-date-block"><div class="day">29</div><div class="month">Jun</div></div><div class="event-body"><h3>Parent–Teacher Briefing</h3><span>Monthly progress review and guidance interaction for parents and guardians.</span></div></div>
      <div class="event-card reveal"><div class="event-date-block"><div class="day">30</div><div class="month">Jun</div></div><div class="event-body"><h3>Admission Deadline</h3><span>Last date to submit applications for 2026–27. Contact the institute immediately for seat availability.</span></div></div>
    </div>
  </div>
</section>

<!-- ③ SCHOLARSHIP / FREE MOCK TEST REGISTRATION -->
<section class="scholar-section" id="scholarship">
  <div class="container scholar-grid">
    <div class="scholar-info">
      <div class="eyebrow reveal">Free Opportunity</div>
      <h2 class="st reveal">Scholarship Test & Free Demo</h2>
      <div class="rule reveal"><div class="rule-line" style="background:linear-gradient(90deg,var(--gold),transparent)"></div><div class="rule-d"></div><div class="rule-line" style="background:linear-gradient(90deg,transparent,var(--gold))"></div></div>
      <p class="reveal">GNSI conducts a monthly Scholarship Test open to all students aspiring for Sainik School, NVS, and RMS entrance. Top scorers receive fee concessions. Attend a free demo class before you enrol.</p>
      <ul class="scholar-benefits reveal">
        <li>100% scholarship for AIR Top 3 in district</li>
        <li>50% fee waiver for top 10 scorers</li>
        <li>25% concession for top 20 scorers</li>
        <li>Free demo class — no commitment required</li>
        <li>Mock test paper + answer key provided</li>
        <li>Result declared within 3 days</li>
      </ul>
      <div class="test-dates reveal">
        <div class="test-date-card"><span class="tdate">Every Sunday</span><span class="tlabel">Mock Test Day</span></div>
        <div class="test-date-card"><span class="tdate">1st Sunday</span><span class="tlabel">Scholarship Test</span></div>
        <div class="test-date-card"><span class="tdate">Free</span><span class="tlabel">Demo Class</span></div>
        <div class="test-date-card"><span class="tdate">3 Days</span><span class="tlabel">Result Time</span></div>
      </div>
      <a href="https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20would%20like%20to%20register%20for%20the%20free%20demo%20class%20and%20scholarship%20test." class="btn btn-gold" target="_blank" style="display:inline-flex">📲 Register via WhatsApp →</a>
    </div>
    <div class="scholar-form-box reveal">
      <h3>Register for Free Demo / Scholarship Test</h3>
      <p>Fill below — our team will confirm your slot within 24 hours</p>
      <div class="scholar-msg" id="scholarMsg"></div>
      <label class="scholar-label">Student Name *</label>
      <input type="text" class="scholar-input" id="scName" placeholder="Full name of student">
      <label class="scholar-label">Parent Phone *</label>
      <input type="tel" class="scholar-input" id="scPhone" placeholder="+91 XXXXX XXXXX">
      <label class="scholar-label">Class / Age</label>
      <input type="text" class="scholar-input" id="scClass" placeholder="e.g. Class 5, Age 10">
      <label class="scholar-label">Interested In</label>
      <select class="scholar-select" id="scType">
        <option value="Free Demo Class">Free Demo Class</option>
        <option value="Scholarship Test">Scholarship Test (Sunday)</option>
        <option value="Both">Both — Demo + Scholarship Test</option>
      </select>
      <button class="scholar-btn" onclick="submitScholar()">Register for Free →</button>
      <p style="color:rgba(248,243,232,.25);font-size:clamp(.65rem,1.8vw,.72rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em;text-align:center;margin-top:.6rem">Or call us: <a href="tel:+918974298074" style="color:var(--goldL)">+91 89742 98074</a></p>
    </div>
  </div>
</section>

<!-- ④ PREVIOUS YEAR QUESTION PAPERS -->
<section class="papers-section" id="question-papers">
  <div class="container">
    <div class="eyebrow reveal">Free Resources</div>
    <h2 class="st reveal">Previous Year Question Papers</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <p style="color:var(--slate);max-width:560px;line-height:1.85;font-size:clamp(.9rem,2.4vw,.97rem)" class="reveal">Download free previous year papers for NVS, Sainik School, and RMS entrance examinations. Practice is the key to selection.</p>
    <div class="papers-grid">
      <!-- NVS Papers -->
      <div class="papers-card nvs reveal-scale">
        <h3>Navodaya Vidyalaya (NVS)</h3>
        <div class="papers-sub">JNVST · Class 6 Entry</div>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class6-2025.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">JNVST Class 6 — 2025</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class6-2024.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">JNVST Class 6 — 2024</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class6-2023.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">JNVST Class 6 — 2023</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class9-2025.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">JNVST Class 9 — 2025</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/nvs-class9-2024.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">JNVST Class 9 — 2024</span><span class="paper-dl">⬇</span>
        </a>
        <button class="papers-cta" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Get More Papers — Enquire →</button>
        <p class="papers-note">Upload your PDFs to Supabase Storage at gnsi-public/papers/ to activate downloads.</p>
      </div>
      <!-- Sainik Papers -->
      <div class="papers-card sainik reveal-scale">
        <h3>Sainik School (AISSEE)</h3>
        <div class="papers-sub">All India Sainik Schools Entrance · Class 6 & 9</div>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class6-2025.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">AISSEE Class 6 — 2025</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class6-2024.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">AISSEE Class 6 — 2024</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class6-2023.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">AISSEE Class 6 — 2023</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class9-2025.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">AISSEE Class 9 — 2025</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/sainik-class9-2024.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">AISSEE Class 9 — 2024</span><span class="paper-dl">⬇</span>
        </a>
        <button class="papers-cta" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Get More Papers — Enquire →</button>
        <p class="papers-note">Files activate once uploaded to Supabase Storage gnsi-public/papers/</p>
      </div>
      <!-- RMS Papers -->
      <div class="papers-card rms reveal-scale">
        <h3>Rashtriya Military School (RMS)</h3>
        <div class="papers-sub">RMS CET · Class 6 & Class 9</div>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class6-2025.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">RMS CET Class 6 — 2025</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class6-2024.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">RMS CET Class 6 — 2024</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class9-2025.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">RMS CET Class 9 — 2025</span><span class="paper-dl">⬇</span>
        </a>
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/papers/rms-class9-2024.pdf" class="paper-link" target="_blank" download>
          <span class="paper-name">RMS CET Class 9 — 2024</span><span class="paper-dl">⬇</span>
        </a>
        <button class="papers-cta" onclick="window.open('https://wa.me/918974298074?text=Hello%20GNSI%2C%20please%20send%20me%20RMS%20previous%20year%20papers.','_blank')">Request More via WhatsApp →</button>
        <p class="papers-note">Files activate once uploaded to Supabase Storage gnsi-public/papers/</p>
      </div>
    </div>
  </div>
</section>

<!-- ⑤ SYLLABUS SECTION -->
<section class="syllabus-section" id="syllabus">
  <div class="container">
    <div class="eyebrow reveal">Exam Preparation</div>
    <h2 class="st reveal">Complete Syllabus Guide</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <p style="color:var(--slate);max-width:560px;line-height:1.85;margin-bottom:1.5rem;font-size:clamp(.9rem,2.4vw,.97rem)" class="reveal">Know exactly what to study. Official syllabus breakdown for each entrance examination — with subject weightage and marks distribution.</p>

    <!-- Tab buttons -->
    <div class="syllabus-tabs reveal">
      <button class="syl-tab active" onclick="sylTab('nvs6',this)">NVS Class 6</button>
      <button class="syl-tab" onclick="sylTab('nvs9',this)">NVS Class 9</button>
      <button class="syl-tab" onclick="sylTab('sainik6',this)">Sainik Class 6</button>
      <button class="syl-tab" onclick="sylTab('sainik9',this)">Sainik Class 9</button>
      <button class="syl-tab" onclick="sylTab('rms',this)">RMS</button>
    </div>

    <!-- NVS Class 6 -->
    <div class="syl-panel active" id="syl-nvs6">
      <div class="syl-grid">
        <div class="syl-card">
          <h4><span>🧠</span> Mental Ability <span class="syl-marks">50 Marks</span></h4>
          <ul class="syl-topics">
            <li>Odd one out & figures</li>
            <li>Pattern completion</li>
            <li>Mirror & water images</li>
            <li>Figure series & analogy</li>
            <li>Space visualization</li>
            <li>Embedded figures</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>🔢</span> Arithmetic <span class="syl-marks">25 Marks</span></h4>
          <ul class="syl-topics">
            <li>Number system & operations</li>
            <li>Fractions & decimals</li>
            <li>LCM & HCF</li>
            <li>Percentage & ratio</li>
            <li>Simple interest</li>
            <li>Mensuration (area, perimeter)</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>📖</span> Language <span class="syl-marks">25 Marks</span></h4>
          <ul class="syl-topics">
            <li>Reading comprehension</li>
            <li>Grammar — tenses, articles</li>
            <li>Fill in the blanks</li>
            <li>Vocabulary & synonyms</li>
            <li>Sentence correction</li>
            <li>Regional language section</li>
          </ul>
        </div>
      </div>
      <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/syllabus/nvs-class6-syllabus.pdf" class="syl-download" target="_blank" download>📥 Download NVS Class 6 Syllabus PDF</a>
    </div>

    <!-- NVS Class 9 -->
    <div class="syl-panel" id="syl-nvs9">
      <div class="syl-grid">
        <div class="syl-card">
          <h4><span>🔢</span> Mathematics <span class="syl-marks">35 Marks</span></h4>
          <ul class="syl-topics">
            <li>Algebra & linear equations</li>
            <li>Geometry & Pythagoras</li>
            <li>Mensuration (area, volume)</li>
            <li>Statistics & probability</li>
            <li>Number theory</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>🔬</span> Science <span class="syl-marks">35 Marks</span></h4>
          <ul class="syl-topics">
            <li>Physics — motion, force, light</li>
            <li>Chemistry — atoms, reactions</li>
            <li>Biology — cells, life processes</li>
            <li>Environmental science</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>📖</span> English & Hindi <span class="syl-marks">30 Marks</span></h4>
          <ul class="syl-topics">
            <li>Comprehension passage</li>
            <li>Grammar & usage</li>
            <li>Vocabulary</li>
            <li>Hindi grammar & composition</li>
          </ul>
        </div>
      </div>
      <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/syllabus/nvs-class9-syllabus.pdf" class="syl-download" target="_blank" download>📥 Download NVS Class 9 Syllabus PDF</a>
    </div>

    <!-- Sainik Class 6 -->
    <div class="syl-panel" id="syl-sainik6">
      <div class="syl-grid">
        <div class="syl-card">
          <h4><span>🔢</span> Mathematics <span class="syl-marks">200 Marks</span></h4>
          <ul class="syl-topics">
            <li>Number system & operations</li>
            <li>Fractions, decimals, percentages</li>
            <li>Ratio & proportion</li>
            <li>Basic geometry</li>
            <li>Mensuration</li>
            <li>Simple interest & profit/loss</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>📖</span> English <span class="syl-marks">125 Marks</span></h4>
          <ul class="syl-topics">
            <li>Reading comprehension</li>
            <li>Grammar — all tenses</li>
            <li>Active & passive voice</li>
            <li>Vocabulary & antonyms</li>
            <li>Sentence improvement</li>
            <li>Error detection</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>🌍</span> General Knowledge <span class="syl-marks">50 Marks</span></h4>
          <ul class="syl-topics">
            <li>Indian history & culture</li>
            <li>Geography — India & world</li>
            <li>Current affairs</li>
            <li>Science GK</li>
            <li>Sports & awards</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>🧠</span> Intelligence <span class="syl-marks">25 Marks</span></h4>
          <ul class="syl-topics">
            <li>Verbal reasoning</li>
            <li>Non-verbal reasoning</li>
            <li>Series completion</li>
            <li>Analogy & classification</li>
          </ul>
        </div>
      </div>
      <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/syllabus/sainik-class6-syllabus.pdf" class="syl-download" target="_blank" download>📥 Download Sainik Class 6 Syllabus PDF</a>
    </div>

    <!-- Sainik Class 9 -->
    <div class="syl-panel" id="syl-sainik9">
      <div class="syl-grid">
        <div class="syl-card">
          <h4><span>🔢</span> Mathematics <span class="syl-marks">200 Marks</span></h4>
          <ul class="syl-topics">
            <li>Algebra & quadratic equations</li>
            <li>Geometry — triangles, circles</li>
            <li>Trigonometry basics</li>
            <li>Statistics & data interpretation</li>
            <li>Number system</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>📖</span> English <span class="syl-marks">125 Marks</span></h4>
          <ul class="syl-topics">
            <li>Reading comprehension</li>
            <li>Advanced grammar</li>
            <li>Essay & letter writing</li>
            <li>Vocabulary in context</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>🔬</span> Science & Tech <span class="syl-marks">50 Marks</span></h4>
          <ul class="syl-topics">
            <li>Physics — electricity, optics</li>
            <li>Chemistry — acids, metals</li>
            <li>Biology — reproduction, heredity</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>🌍</span> Social Studies <span class="syl-marks">50 Marks</span></h4>
          <ul class="syl-topics">
            <li>Indian history — medieval, modern</li>
            <li>Indian geography</li>
            <li>Civics & Indian Constitution</li>
            <li>Economics basics</li>
          </ul>
        </div>
      </div>
      <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/syllabus/sainik-class9-syllabus.pdf" class="syl-download" target="_blank" download>📥 Download Sainik Class 9 Syllabus PDF</a>
    </div>

    <!-- RMS -->
    <div class="syl-panel" id="syl-rms">
      <div class="syl-grid">
        <div class="syl-card">
          <h4><span>🔢</span> Mathematics</h4>
          <ul class="syl-topics">
            <li>Arithmetic — all operations</li>
            <li>Algebra — equations</li>
            <li>Geometry & mensuration</li>
            <li>Data handling</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>📖</span> English Language</h4>
          <ul class="syl-topics">
            <li>Grammar & usage</li>
            <li>Reading comprehension</li>
            <li>Vocabulary</li>
            <li>Writing skills</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>🌍</span> General Knowledge</h4>
          <ul class="syl-topics">
            <li>Current events — national</li>
            <li>Indian armed forces history</li>
            <li>Geography & civics</li>
            <li>Science & technology GK</li>
          </ul>
        </div>
        <div class="syl-card">
          <h4><span>💪</span> Physical Fitness</h4>
          <ul class="syl-topics">
            <li>Medical examination</li>
            <li>Physical fitness test</li>
            <li>Vision & hearing standards</li>
            <li>Height & weight norms</li>
          </ul>
        </div>
      </div>
      <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/syllabus/rms-syllabus.pdf" class="syl-download" target="_blank" download>📥 Download RMS Syllabus PDF</a>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="pad">
  <div class="container">
    <div class="eyebrow reveal">FAQ</div>
    <h2 class="st reveal">Common Questions</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="faq reveal" style="max-width:720px">
      <div class="faq-item"><div class="faq-q">What examinations does GNSI prepare students for?<div class="faq-icon">+</div></div><div class="faq-a">GNSI prepares students for AISSEE (All India Sainik Schools Entrance Examination), JNVST for Class 6 and Class 9 (Jawahar Navodaya Vidyalaya), and the RMS (Rashtriya Military School) entrance examination.</div></div>
      <div class="faq-item"><div class="faq-q">Is boarding hostel facility available?<div class="faq-icon">+</div></div><div class="faq-a">Yes. GNSI provides supervised residential hostel accommodation with meals, structured study time, and a disciplined daily routine — closely modelled on the Sainik School environment. Day boarder and day scholar options are also available.</div></div>
      <div class="faq-item"><div class="faq-q">What is the fee structure?<div class="faq-icon">+</div></div><div class="faq-a">Fees vary by course, level, and hostel option (Boarder, Day Boarder, Day Scholar). We share detailed fee information directly with parents after an initial enquiry. Please use the enquiry form or call us directly.</div></div>
      <div class="faq-item"><div class="faq-q">How can parents monitor their child's progress?<div class="faq-icon">+</div></div><div class="faq-a">Parents can log in to the GNSI Parents Portal using their registered phone number and Student ID to view live attendance, exam scores, notices, hostel leave status, and alerts — directly from our database.</div></div>
      <div class="faq-item"><div class="faq-q">When does the next batch commence?<div class="faq-icon">+</div></div><div class="faq-a">The Summer 2026 batch commences in July 2026. Applications must be submitted before 30 June 2026. Contact the institute by phone or WhatsApp for current seat availability.</div></div>
      <div class="faq-item"><div class="faq-q">Can I pay fees online?<div class="faq-icon">+</div></div><div class="faq-a">Yes. GNSI accepts online fee payments via UPI (Google Pay, PhonePe, Paytm), NEFT/RTGS bank transfer, and direct bank deposit. Use the Pay Fee section on this page or contact the institute for bank details.</div></div>
    </div>
  </div>
</section>

<!-- ENQUIRY -->
<section class="pad-alt" id="enquiry">
  <div class="container enquiry-grid">
    <div>
      <div class="eyebrow reveal">Admissions</div>
      <h2 class="st reveal">Enquire Now</h2>
      <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
      <p style="color:var(--slate);margin-bottom:2rem;line-height:1.85;font-size:clamp(0.92rem,2.4vw,1rem)" class="reveal">Send your details and our team will respond regarding courses, hostel availability, and the admission process.</p>
      <div class="form-panel reveal">
        <div class="form-msg" id="formMsg"></div>
        <div class="form-row">
          <div><label class="fl">Student Name</label><input type="text" class="ff" id="fStuName" placeholder="Full name"></div>
          <div><label class="fl">Parent / Guardian</label><input type="text" class="ff" id="fParName" placeholder="Full name"></div>
        </div>
        <label class="fl">Phone Number</label>
        <input type="tel" class="ff" id="fPhone" placeholder="+91 XXXXX XXXXX">
        <label class="fl">Student Class / Age</label>
        <input type="text" class="ff" id="fClass" placeholder="e.g. Class 5, Age 10">
        <label class="fl">Course Interested In</label>
        <select class="ff" id="fCourse">
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
        <label class="fl">Message</label>
        <textarea class="ff" id="fMsg" placeholder="Your question or message"></textarea>
        <button type="button" class="btn btn-gold" style="width:100%;justify-content:center" id="fBtn" onclick="submitEnquiry()">Submit Enquiry →</button>
        <p style="color:var(--mist);font-size:clamp(0.68rem,1.8vw,0.75rem);font-family:'Rajdhani',sans-serif;margin-top:.6rem;text-align:center">Or call us directly: <a href="tel:+918974298074" style="color:var(--gold)">+91 89742 98074</a></p>
      </div>
    </div>
    <div id="contact">
      <div class="eyebrow reveal">Contact</div>
      <h2 class="st reveal">Visit the Campus</h2>
      <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
      <div class="contact-card reveal">
        <h3>Guidance Navodaya & Sainik Institute</h3>
        <p>Khangabok, Thoubal District, Manipur<br>Phone: <a href="tel:+918974298074" style="color:var(--gold)">+91 89742 98074</a><br>WhatsApp: <a href="https://wa.me/918974298074" style="color:var(--wa)" target="_blank">Chat with us →</a></p>
      </div>
      <div class="contact-card reveal"><h3>Office Hours</h3><p>Monday – Saturday: 08:30 to 17:00<br>Sunday: Test Day — open for enquiries after 14:00</p></div>
      <div class="contact-card reveal">
        <h3>Follow Us</h3>
        <div class="social-strip">
          <a class="soc-btn soc-fb" href="https://facebook.com/gnsikhangabok" target="_blank">f Facebook</a>
          <a class="soc-btn soc-yt" href="https://youtube.com/@gnsikhangabok" target="_blank">▶ YouTube</a>
          <a class="soc-btn soc-ig" href="https://instagram.com/gnsikhangabok" target="_blank">◉ Instagram</a>
        </div>
      </div>
      <div class="map-wrap reveal" id="mapWrap" onclick="loadMap()">
        <div class="map-placeholder" id="mapPlaceholder">
          <span>📍 Khangabok, Thoubal District, Manipur</span>
          <button class="map-load-btn">View on Map →</button>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ⑧ ONLINE FEE PAYMENT -->
<section class="fee-section" id="fee-payment">
  <div class="container fee-grid">
    <div class="fee-info">
      <div class="eyebrow reveal" style="color:var(--goldL)">Online Payment</div>
      <h2 class="reveal">Pay Fee Online — Fast & Secure</h2>
      <p class="reveal">GNSI now accepts fee payments online. Pay from anywhere using UPI, internet banking, or direct bank transfer. Safe, instant, and hassle-free.</p>
      <div class="fee-methods reveal">
        <span class="fee-method">📱 UPI</span>
        <span class="fee-method">🏦 NEFT / RTGS</span>
        <span class="fee-method">💳 Net Banking</span>
        <span class="fee-method">📲 PhonePe</span>
        <span class="fee-method">🟢 Google Pay</span>
      </div>
      <p style="color:rgba(248,243,232,.4);font-size:clamp(0.78rem,2.1vw,0.85rem);font-family:'Rajdhani',sans-serif;letter-spacing:.05em" class="reveal">For any payment issues contact: <a href="tel:+918974298074" style="color:var(--goldL)">+91 89742 98074</a></p>
    </div>
    <div class="fee-box reveal">
      <h3>How to Pay</h3>
      <div class="fee-step">
        <div class="fee-step-num">1</div>
        <div class="fee-step-txt"><strong>Get Student ID</strong>Contact the institute to receive your student admission number and fee amount confirmation.</div>
      </div>
      <div class="fee-step">
        <div class="fee-step-num">2</div>
        <div class="fee-step-txt"><strong>Choose Payment Method</strong>Pay via UPI to our registered number, or use NEFT/RTGS with the bank details provided by the institute.</div>
      </div>
      <div class="fee-step">
        <div class="fee-step-num">3</div>
        <div class="fee-step-txt"><strong>Send Screenshot</strong>WhatsApp your payment screenshot to +91 89742 98074 with your student name and ID for confirmation.</div>
      </div>
      <button class="pay-btn" onclick="window.open('https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20would%20like%20to%20pay%20fees%20online.%20Please%20share%20UPI%20and%20bank%20details.','_blank')">
        💳 Pay Fee via WhatsApp →
      </button>
      <p class="pay-note">Instant acknowledgement · Receipt issued within 24 hours</p>
    </div>
  </div>
</section>

<!-- ② ADMIT CARD + RESULT CHECKER PORTAL -->
<section class="portal-section" id="portal">
  <div class="container">
    <div class="eyebrow reveal" style="color:var(--goldL)">
      <span data-en>Student Portal</span><span data-hi>छात्र पोर्टल</span>
    </div>
    <h2 class="st reveal" style="color:var(--cream)">
      <span data-en>Admit Card & Result Portal</span>
      <span data-hi>प्रवेश पत्र और परिणाम पोर्टल</span>
    </h2>
    <div class="rule reveal"><div class="rule-line" style="background:linear-gradient(90deg,var(--gold),transparent)"></div><div class="rule-d"></div><div class="rule-line" style="background:linear-gradient(90deg,transparent,var(--gold))"></div></div>
    <div class="portal-grid">

      <!-- Admit Card -->
      <div class="portal-box reveal-left">
        <div class="portal-box-hd">
          <div class="portal-icon">🪪</div>
          <div>
            <h3><span data-en>Download Admit Card</span><span data-hi>प्रवेश पत्र डाउनलोड करें</span></h3>
            <p><span data-en>Mock test & exam hall ticket</span><span data-hi>मॉक टेस्ट और परीक्षा हॉल टिकट</span></p>
          </div>
        </div>
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(248,243,232,.4);margin-bottom:.38rem">
          <span data-en>Student Roll Number / ID</span><span data-hi>छात्र रोल नंबर / आईडी</span>
        </label>
        <input class="portal-input" id="acRoll" placeholder="e.g. GNSI-2024-001">
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(248,243,232,.4);margin-bottom:.38rem">
          <span data-en>Select Exam</span><span data-hi>परीक्षा चुनें</span>
        </label>
        <select class="portal-select" id="acExam">
          <option value="">-- Select Exam --</option>
          <option>Sunday Mock Test</option>
          <option>Scholarship Test</option>
          <option>NVS Practice Test</option>
          <option>Sainik School Practice Test</option>
        </select>
        <button class="portal-btn" onclick="fetchAdmitCard()">
          🪪 <span data-en>Download Admit Card</span><span data-hi>प्रवेश पत्र डाउनलोड करें</span>
        </button>
        <div class="portal-result" id="acResult">
          <h4>✓ Admit Card Found</h4>
          <div id="acData"></div>
          <button class="admit-download" onclick="printAdmitCard()">🖨 Print / Download Admit Card</button>
        </div>
      </div>

      <!-- Result Checker -->
      <div class="portal-box reveal-right">
        <div class="portal-box-hd">
          <div class="portal-icon">📊</div>
          <div>
            <h3><span data-en>Check Exam Result</span><span data-hi>परीक्षा परिणाम देखें</span></h3>
            <p><span data-en>View marks, rank & answer key</span><span data-hi>अंक, रैंक और उत्तर कुंजी देखें</span></p>
          </div>
        </div>
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(248,243,232,.4);margin-bottom:.38rem">
          <span data-en>Student Roll Number / ID</span><span data-hi>छात्र रोल नंबर / आईडी</span>
        </label>
        <input class="portal-input" id="rcRoll" placeholder="e.g. GNSI-2024-001">
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(248,243,232,.4);margin-bottom:.38rem">
          <span data-en>Date of Birth</span><span data-hi>जन्म तिथि</span>
        </label>
        <input type="date" class="portal-input" id="rcDob">
        <button class="portal-btn" style="background:var(--navy3)" onclick="fetchResult()">
          📊 <span data-en>Check My Result</span><span data-hi>मेरा परिणाम देखें</span>
        </button>
        <div class="portal-result" id="rcResult">
          <h4>📊 Result Found</h4>
          <div id="rcData"></div>
        </div>
      </div>
    </div>
    <p style="color:rgba(248,243,232,.25);font-family:'Rajdhani',sans-serif;font-size:clamp(.65rem,1.8vw,.72rem);letter-spacing:.06em;margin-top:1.2rem;text-align:center">
      <span data-en>Portal shows results for GNSI internal mock tests only · For official NVS/Sainik results visit nta.ac.in</span>
      <span data-hi>पोर्टल केवल GNSI आंतरिक मॉक टेस्ट के परिणाम दिखाता है · आधिकारिक परिणाम के लिए nta.ac.in पर जाएं</span>
    </p>
  </div>
</section>

<!-- ③ MOCK TEST / PRACTICE PORTAL -->
<section class="mocktest-section" id="mock-tests">
  <div class="container">
    <div class="eyebrow reveal" style="color:var(--goldL)">
      <span data-en>Practice & Prepare</span><span data-hi>अभ्यास और तैयारी</span>
    </div>
    <h2 class="st reveal" style="color:var(--cream)">
      <span data-en>Free Mock Tests & Practice</span>
      <span data-hi>मुफ्त मॉक टेस्ट और अभ्यास</span>
    </h2>
    <div class="rule reveal"><div class="rule-line" style="background:linear-gradient(90deg,var(--gold),transparent)"></div><div class="rule-d"></div><div class="rule-line" style="background:linear-gradient(90deg,transparent,var(--gold))"></div></div>
    <div class="mocktest-grid reveal">
      <div class="mock-cards">
        <a class="mock-card" href="#enquiry">
          <div class="mock-icon">📝</div>
          <div><div class="mock-card-title"><span data-en>NVS Class 6 Full Mock Test</span><span data-hi>NVS कक्षा 6 पूर्ण मॉक टेस्ट</span></div><div class="mock-card-sub">80 Questions · 90 Minutes · Free</div></div>
          <div class="mock-card-arrow">→</div>
        </a>
        <a class="mock-card" href="#enquiry">
          <div class="mock-icon">📝</div>
          <div><div class="mock-card-title"><span data-en>Sainik School Class 6 Mock</span><span data-hi>सैनिक स्कूल कक्षा 6 मॉक</span></div><div class="mock-card-sub">125 Questions · 150 Minutes · Free</div></div>
          <div class="mock-card-arrow">→</div>
        </a>
        <a class="mock-card" href="#enquiry">
          <div class="mock-icon">🧠</div>
          <div><div class="mock-card-title"><span data-en>Mental Ability Practice Set</span><span data-hi>मानसिक योग्यता अभ्यास सेट</span></div><div class="mock-card-sub">50 Questions · 45 Minutes · Free</div></div>
          <div class="mock-card-arrow">→</div>
        </a>
        <a class="mock-card" href="#enquiry">
          <div class="mock-icon">🔢</div>
          <div><div class="mock-card-title"><span data-en>Mathematics Booster Test</span><span data-hi>गणित बूस्टर टेस्ट</span></div><div class="mock-card-sub">40 Questions · 40 Minutes · Free</div></div>
          <div class="mock-card-arrow">→</div>
        </a>
        <a class="mock-card" href="#enquiry">
          <div class="mock-icon">📖</div>
          <div><div class="mock-card-title"><span data-en>English Language Practice</span><span data-hi>अंग्रेजी भाषा अभ्यास</span></div><div class="mock-card-sub">35 Questions · 35 Minutes · Free</div></div>
          <div class="mock-card-arrow">→</div>
        </a>
        <a class="mock-card" href="#enquiry" style="border-color:rgba(184,146,42,.35)">
          <div class="mock-icon">🏆</div>
          <div><div class="mock-card-title" style="color:var(--goldLL)"><span data-en>Full Scholarship Mock Test</span><span data-hi>पूर्ण छात्रवृत्ति मॉक टेस्ट</span></div><div class="mock-card-sub">Register for Sunday · Free Entry</div></div>
          <div class="mock-card-arrow">→</div>
        </a>
      </div>
      <div class="mock-info">
        <h3><span data-en>Sunday Mock Test Series</span><span data-hi>रविवार मॉक टेस्ट श्रृंखला</span></h3>
        <p>
          <span data-en>Every Sunday, GNSI conducts structured mock examinations for NVS and Sainik School aspirants. Detailed analysis and review sessions follow each test — helping students identify weak areas and improve systematically.</span>
          <span data-hi>प्रत्येक रविवार, GNSI NVS और सैनिक स्कूल के उम्मीदवारों के लिए संरचित मॉक परीक्षाएं आयोजित करता है। प्रत्येक टेस्ट के बाद विस्तृत विश्लेषण और समीक्षा सत्र होते हैं।</span>
        </p>
        <ul class="mock-features">
          <li><span data-en>NTA-style exam pattern followed</span><span data-hi>NTA-शैली परीक्षा पैटर्न का पालन</span></li>
          <li><span data-en>OMR sheet practice included</span><span data-hi>OMR शीट अभ्यास शामिल</span></li>
          <li><span data-en>Detailed answer key discussion</span><span data-hi>विस्तृत उत्तर कुंजी चर्चा</span></li>
          <li><span data-en>Rank card issued after each test</span><span data-hi>प्रत्येक टेस्ट के बाद रैंक कार्ड</span></li>
          <li><span data-en>Previous year paper analysis</span><span data-hi>पिछले वर्ष के पेपर का विश्लेषण</span></li>
          <li><span data-en>Free for enrolled students</span><span data-hi>नामांकित छात्रों के लिए निःशुल्क</span></li>
        </ul>
        <a href="#scholarship" class="btn btn-gold">
          <span data-en>Register for Sunday Mock Test →</span>
          <span data-hi>रविवार मॉक टेस्ट के लिए पंजीकरण करें →</span>
        </a>
      </div>
    </div>
  </div>
</section>

<!-- ④ EXAM CALENDAR -->
<section class="calendar-section" id="exam-calendar">
  <div class="container">
    <div class="eyebrow reveal">
      <span data-en>Academic Year 2026–27</span><span data-hi>शैक्षणिक वर्ष 2026–27</span>
    </div>
    <h2 class="st reveal">
      <span data-en>Exam Calendar & Schedule</span><span data-hi>परीक्षा कैलेंडर और अनुसूची</span>
    </h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="cal-table-wrap reveal">
      <table class="cal-table">
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
            <td><div class="cal-exam">JNVST Class 6</div><small style="color:var(--mist);font-size:.72rem">Jawahar Navodaya Vidyalaya</small></td>
            <td><span class="cal-badge cb-nvs">NVS</span></td>
            <td>Jul 2026</td>
            <td>Oct 2026</td>
            <td><strong>Jan 2027</strong></td>
            <td>Mar 2027</td>
            <td><span class="cal-status cs-upcoming">● Upcoming</span></td>
          </tr>
          <tr>
            <td><div class="cal-exam">JNVST Class 9</div><small style="color:var(--mist);font-size:.72rem">Lateral Entry</small></td>
            <td><span class="cal-badge cb-nvs">NVS</span></td>
            <td>Aug 2026</td>
            <td>Nov 2026</td>
            <td><strong>Feb 2027</strong></td>
            <td>Apr 2027</td>
            <td><span class="cal-status cs-upcoming">● Upcoming</span></td>
          </tr>
          <tr>
            <td><div class="cal-exam">AISSEE Class 6</div><small style="color:var(--mist);font-size:.72rem">All India Sainik Schools</small></td>
            <td><span class="cal-badge cb-sainik">Sainik</span></td>
            <td>Oct 2026</td>
            <td>Nov 2026</td>
            <td><strong>Jan 2027</strong></td>
            <td>Mar 2027</td>
            <td><span class="cal-status cs-upcoming">● Upcoming</span></td>
          </tr>
          <tr>
            <td><div class="cal-exam">AISSEE Class 9</div><small style="color:var(--mist);font-size:.72rem">All India Sainik Schools</small></td>
            <td><span class="cal-badge cb-sainik">Sainik</span></td>
            <td>Oct 2026</td>
            <td>Nov 2026</td>
            <td><strong>Jan 2027</strong></td>
            <td>Mar 2027</td>
            <td><span class="cal-status cs-upcoming">● Upcoming</span></td>
          </tr>
          <tr>
            <td><div class="cal-exam">RMS CET Class 6</div><small style="color:var(--mist);font-size:.72rem">Rashtriya Military School</small></td>
            <td><span class="cal-badge cb-rms">RMS</span></td>
            <td>Nov 2026</td>
            <td>Dec 2026</td>
            <td><strong>Feb 2027</strong></td>
            <td>Apr 2027</td>
            <td><span class="cal-status cs-upcoming">● Upcoming</span></td>
          </tr>
          <tr>
            <td><div class="cal-exam">GNSI Scholarship Test</div><small style="color:var(--mist);font-size:.72rem">Internal · Fee Concession</small></td>
            <td><span class="cal-badge cb-gnsi">GNSI</span></td>
            <td>Open Always</td>
            <td>Saturday before</td>
            <td><strong>Every 1st Sunday</strong></td>
            <td>3 Days</td>
            <td><span class="cal-status cs-open">★ Open</span></td>
          </tr>
          <tr>
            <td><div class="cal-exam">GNSI Sunday Mock Tests</div><small style="color:var(--mist);font-size:.72rem">Internal · Free</small></td>
            <td><span class="cal-badge cb-gnsi">GNSI</span></td>
            <td>—</td>
            <td>—</td>
            <td><strong>Every Sunday</strong></td>
            <td>Same Day</td>
            <td><span class="cal-status cs-open">★ Ongoing</span></td>
          </tr>
          <tr>
            <td><div class="cal-exam">Summer Batch 2026</div><small style="color:var(--mist);font-size:.72rem">GNSI New Session</small></td>
            <td><span class="cal-badge cb-gnsi">GNSI</span></td>
            <td colspan="3" style="color:var(--gold);font-weight:600">Commencing 1 July 2026</td>
            <td>—</td>
            <td><span class="cal-status cs-open">★ Admissions Open</span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Exam-Calendar-2026-27.pdf" class="cal-download" target="_blank" download>
      📥 <span data-en>Download Full Exam Calendar PDF</span><span data-hi>पूर्ण परीक्षा कैलेंडर PDF डाउनलोड करें</span>
    </a>
  </div>
</section>

<!-- ⑤ IMPORTANT DATES TIMELINE -->
<section class="timeline-section" id="important-dates">
  <div class="container">
    <div class="eyebrow reveal">
      <span data-en>Don't Miss These</span><span data-hi>इन्हें मिस न करें</span>
    </div>
    <h2 class="st reveal">
      <span data-en>Important Dates 2026–27</span><span data-hi>महत्वपूर्ण तिथियां 2026–27</span>
    </h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="timeline reveal">
      <div class="tl-item">
        <div class="tl-date"><span class="tl-month">Jun</span><span class="tl-day">30</span></div>
        <div class="tl-dot open"></div>
        <div class="tl-content open">
          <h4>🔴 GNSI Admission Deadline 2026–27</h4>
          <p>Last date to apply for GNSI Summer Batch. Hostel seats extremely limited. Contact immediately.</p>
          <span class="tl-tag"><span class="cal-badge cb-gnsi">GNSI</span></span>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-date"><span class="tl-month">Jul</span><span class="tl-day">01</span></div>
        <div class="tl-dot upcoming"></div>
        <div class="tl-content">
          <h4>🎓 GNSI Summer Batch Begins</h4>
          <p>New academic session commences. Fresh batch of NVS, Sainik School, and RMS aspirants.</p>
          <span class="tl-tag"><span class="cal-badge cb-gnsi">GNSI</span></span>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-date"><span class="tl-month">Jul</span><span class="tl-day">—</span></div>
        <div class="tl-dot upcoming"></div>
        <div class="tl-content">
          <h4>📋 JNVST Class 6 Application Opens</h4>
          <p>NVS releases the official application form for Jawahar Navodaya Class 6 entry 2026–27. Apply through navodaya.gov.in.</p>
          <span class="tl-tag"><span class="cal-badge cb-nvs">NVS</span></span>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-date"><span class="tl-month">Oct</span><span class="tl-day">—</span></div>
        <div class="tl-dot upcoming"></div>
        <div class="tl-content">
          <h4>📋 AISSEE Application Opens</h4>
          <p>NTA releases AISSEE application for Sainik School Class 6 and Class 9 admission 2027. Register at nta.ac.in.</p>
          <span class="tl-tag"><span class="cal-badge cb-sainik">Sainik</span></span>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-date"><span class="tl-month">Jan</span><span class="tl-day">—</span></div>
        <div class="tl-dot upcoming"></div>
        <div class="tl-content">
          <h4>📝 JNVST + AISSEE Exam Day</h4>
          <p>Both NVS Class 6 and Sainik School AISSEE examinations typically held in January. Mock test series peaks at GNSI.</p>
          <span class="tl-tag"><span class="cal-badge cb-nvs">NVS</span> <span class="cal-badge cb-sainik">Sainik</span></span>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-date"><span class="tl-month">Feb</span><span class="tl-day">—</span></div>
        <div class="tl-dot upcoming"></div>
        <div class="tl-content">
          <h4>📝 RMS CET Examination</h4>
          <p>Rashtriya Military School Common Entrance Test for Class 6 and Class 9 admission. Conducted by NTA.</p>
          <span class="tl-tag"><span class="cal-badge cb-rms">RMS</span></span>
        </div>
      </div>
      <div class="tl-item">
        <div class="tl-date"><span class="tl-month">Mar</span><span class="tl-day">—</span></div>
        <div class="tl-dot upcoming"></div>
        <div class="tl-content">
          <h4>🏆 NVS & Sainik School Results</h4>
          <p>Results declared. GNSI students receive individual counselling and guidance for the next steps — document verification, medical, and admission.</p>
          <span class="tl-tag"><span class="cal-badge cb-nvs">NVS</span> <span class="cal-badge cb-sainik">Sainik</span></span>
        </div>
      </div>
    </div>
    <p style="color:var(--mist);font-size:clamp(.72rem,2vw,.8rem);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;margin-top:1.5rem">
      * Dates are indicative based on previous year schedules. Always verify at official websites: navodaya.gov.in · nta.ac.in · sainikschooladmission.in
    </p>
  </div>
</section>

<!-- ⑥ APP DOWNLOAD -->
<section class="app-section" id="app-download">
  <div class="container app-grid">
    <div class="app-info">
      <div class="eyebrow" style="color:var(--goldL)">
        <span data-en>Mobile App</span><span data-hi>मोबाइल ऐप</span>
      </div>
      <h2>
        <span data-en>Download the GNSI App</span><span data-hi>GNSI ऐप डाउनलोड करें</span>
      </h2>
      <p>
        <span data-en>Access attendance, exam results, notices, hostel leave status, and fee receipts from your phone — anywhere, anytime. Built for parents and students.</span>
        <span data-hi>अपने फोन से उपस्थिति, परीक्षा परिणाम, नोटिस, छात्रावास अवकाश की स्थिति और शुल्क रसीदें एक्सेस करें।</span>
      </p>
      <div class="app-features">
        <div class="app-feat">📊 <span data-en>Live Attendance</span><span data-hi>लाइव उपस्थिति</span></div>
        <div class="app-feat">📝 <span data-en>Exam Scores</span><span data-hi>परीक्षा अंक</span></div>
        <div class="app-feat">📣 <span data-en>Push Notifications</span><span data-hi>पुश सूचनाएं</span></div>
        <div class="app-feat">🏠 <span data-en>Hostel Leave</span><span data-hi>छात्रावास अवकाश</span></div>
        <div class="app-feat">💳 <span data-en>Fee Payment</span><span data-hi>शुल्क भुगतान</span></div>
        <div class="app-feat">📰 <span data-en>Notice Board</span><span data-hi>सूचना पट्ट</span></div>
      </div>
      <div class="app-btns">
        <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/gnsi-app.apk" class="app-btn" target="_blank" download>
          <span class="app-btn-icon">▲</span>
          <div class="app-btn-txt">
            <small>Download for</small>
            <strong>Android APK</strong>
          </div>
        </a>
        <a href="https://play.google.com/store" class="app-btn" target="_blank">
          <span class="app-btn-icon">▲</span>
          <div class="app-btn-txt">
            <small>Get it on</small>
            <strong>Google Play</strong>
          </div>
        </a>
        <a href="#" class="app-btn" style="opacity:.45;cursor:not-allowed" title="Coming soon">
          <span class="app-btn-icon">🍎</span>
          <div class="app-btn-txt">
            <small>Coming soon</small>
            <strong>App Store</strong>
          </div>
        </a>
      </div>
    </div>
    <div class="app-mockup">
      <div class="app-screen">
        <div class="app-screen-hd">
          <span>🏫 GNSI Student App</span>
        </div>
        <div class="app-screen-row"><span>Attendance</span><strong style="color:#4AE382">94%</strong></div>
        <div class="app-screen-row"><span>Last Exam</span><strong>87/100</strong></div>
        <div class="app-screen-row"><span>Hostel Leave</span><strong style="color:var(--goldLL)">Approved</strong></div>
        <div class="app-screen-row"><span>Fee Status</span><strong style="color:#4AE382">Paid</strong></div>
        <div class="app-screen-row"><span>Next Test</span><strong>Sunday</strong></div>
        <div class="app-screen-row"><span>Notices</span><strong>2 New</strong></div>
      </div>
      <div class="app-qr">
        <div style="width:80px;height:80px;background:repeating-linear-gradient(0deg,rgba(184,146,42,.15) 0,rgba(184,146,42,.15) 4px,transparent 4px,transparent 8px),repeating-linear-gradient(90deg,rgba(184,146,42,.15) 0,rgba(184,146,42,.15) 4px,transparent 4px,transparent 8px);margin:0 auto"></div>
        <p>Scan QR to Download</p>
      </div>
    </div>
  </div>
</section>

<!-- ⑦ GRIEVANCE / HELPDESK -->
<section class="helpdesk-section" id="helpdesk">
  <div class="container">
    <div class="eyebrow reveal">
      <span data-en>Support</span><span data-hi>सहायता</span>
    </div>
    <h2 class="st reveal">
      <span data-en>Grievance & Helpdesk</span><span data-hi>शिकायत और हेल्पडेस्क</span>
    </h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="helpdesk-grid">
      <div>
        <p class="reveal">
          <span data-en>Have a concern, query, or complaint? GNSI is committed to resolving all grievances within 48 hours. Use the form or contact us directly — we take every concern seriously.</span>
          <span data-hi>कोई चिंता, प्रश्न या शिकायत है? GNSI 48 घंटों के भीतर सभी शिकायतों को हल करने के लिए प्रतिबद्ध है।</span>
        </p>
        <div class="helpdesk-contacts reveal">
          <div class="hc-item">
            <span class="hc-icon">📞</span>
            <div>
              <span class="hc-label">Primary Helpline</span>
              <span class="hc-val"><a href="tel:+918974298074">+91 89742 98074</a></span>
            </div>
          </div>
          <div class="hc-item">
            <span class="hc-icon">💬</span>
            <div>
              <span class="hc-label">WhatsApp Support</span>
              <span class="hc-val"><a href="https://wa.me/918974298074" target="_blank">Chat on WhatsApp →</a></span>
            </div>
          </div>
          <div class="hc-item">
            <span class="hc-icon">✉</span>
            <div>
              <span class="hc-label">Email</span>
              <span class="hc-val"><a href="mailto:gnsikhangabok@gmail.com">gnsikhangabok@gmail.com</a></span>
            </div>
          </div>
          <div class="hc-item">
            <span class="hc-icon">📍</span>
            <div>
              <span class="hc-label">Visit Campus</span>
              <span class="hc-val">
                <span data-en>Khangabok, Thoubal District, Manipur</span>
                <span data-hi>खंगाबोक, थौबल जिला, मणिपुर</span>
              </span>
            </div>
          </div>
          <div class="hc-item">
            <span class="hc-icon">🕐</span>
            <div>
              <span class="hc-label">Response Time</span>
              <span class="hc-val">Within 48 hours · WhatsApp: Same day</span>
            </div>
          </div>
        </div>
      </div>
      <div class="helpdesk-form reveal">
        <h3>
          <span data-en>Submit a Grievance / Query</span>
          <span data-hi>शिकायत / प्रश्न सबमिट करें</span>
        </h3>
        <p>Your concern is assigned a ticket ID for tracking</p>
        <div class="grv-msg" id="grvMsg"></div>
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--slate);margin-bottom:.35rem">
          <span data-en>Your Name *</span><span data-hi>आपका नाम *</span>
        </label>
        <input class="grv-input" id="grvName" placeholder="Full name">
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--slate);margin-bottom:.35rem">
          <span data-en>Phone Number *</span><span data-hi>फोन नंबर *</span>
        </label>
        <input class="grv-input" id="grvPhone" placeholder="+91 XXXXX XXXXX" type="tel">
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--slate);margin-bottom:.35rem">
          <span data-en>Category</span><span data-hi>श्रेणी</span>
        </label>
        <select class="grv-select" id="grvCat">
          <option>Fee / Payment Issue</option>
          <option>Attendance Discrepancy</option>
          <option>Hostel Complaint</option>
          <option>Academic / Teaching Query</option>
          <option>Admission Query</option>
          <option>Portal / App Issue</option>
          <option>Other</option>
        </select>
        <label style="display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:var(--slate);margin-bottom:.35rem">
          <span data-en>Describe Your Concern *</span><span data-hi>अपनी चिंता बताएं *</span>
        </label>
        <textarea class="grv-textarea" id="grvMsg2" placeholder="Please describe your concern or query in detail…"></textarea>
        <button class="grv-btn" onclick="submitGrievance()">
          📨 <span data-en>Submit Grievance →</span><span data-hi>शिकायत सबमिट करें →</span>
        </button>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<div class="cta-block">
  <h2>Begin the Journey</h2>
  <p>Join a disciplined, technology-enabled academic environment built to prepare students for elite school entrance success. Over 200 officers produced — yours could be the next name on that roll.</p>
  <div style="display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;position:relative">
    <a href="#enquiry" class="btn btn-gold">Apply / Enquire →</a>
    <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Brochure-2026.pdf" class="btn btn-out" download target="_blank">📄 Download Brochure</a>
    <button onclick="openPP()" class="btn btn-grn">Parents Portal →</button>
    <a href="#fee-payment" class="btn btn-fee">💳 Pay Fee →</a>
    <a href="https://wa.me/918974298074" class="btn btn-wa" target="_blank">WhatsApp →</a>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <div class="footer-grid">
    <div>
      <h4>GNSI — Guidance Navodaya & Sainik Institute</h4>
      <p style="color:rgba(248,243,232,.55);line-height:1.85;font-size:clamp(0.82rem,2.2vw,0.88rem);max-width:320px;margin-bottom:1rem">Residential coaching institution in Khangabok, Thoubal, Manipur — focused on NVS, Sainik School, and RMS entrance preparation. Established 2016.</p>
      <div class="footer-tricolor"><div></div><div></div><div></div></div>
      <div class="foot-social" style="margin-top:.9rem">
        <a class="foot-soc-icon" href="https://facebook.com/gnsikhangabok" target="_blank">f</a>
        <a class="foot-soc-icon" href="https://youtube.com/@gnsikhangabok" target="_blank">▶</a>
        <a class="foot-soc-icon" href="https://instagram.com/gnsikhangabok" target="_blank">◉</a>
        <a class="foot-soc-icon" href="https://wa.me/918974298074" target="_blank" style="color:#4AE382;border-color:rgba(37,211,102,.3)">W</a>
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
      <a href="#blog">News & Blog</a>
      <a href="#gallery">Gallery</a>
    </div>
    <div>
      <h4>Admissions</h4>
      <a href="#courses">Sainik School Prep</a>
      <a href="#courses">Navodaya Prep</a>
      <a href="#courses">Foundation Programme</a>
      <a href="#courses">Combined Course</a>
      <a href="#enquiry">Apply Now</a>
      <a href="https://pwrldrngqxbvwfztxxrd.supabase.co/storage/v1/object/public/gnsi-public/GNSI-Brochure-2026.pdf" target="_blank" download>📄 Download Brochure</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="tel:+918974298074">+91 89742 98074</a>
      <a href="https://wa.me/918974298074" target="_blank" style="color:#4AE382">WhatsApp</a>
      <a href="#fee-payment" style="color:var(--goldL)">💳 Pay Fee Online</a>
      <a href="#enquiry">Admission Enquiry</a>
      <a href="#" onclick="openPP();return false;" style="color:#4AE382">Parents Portal</a>
      <button onclick="window.parent.postMessage('gnsi-staff-login','*')" style="display:block;margin-bottom:.55rem;color:rgba(248,243,232,.6);font-size:clamp(0.82rem,2.2vw,0.88rem);background:none;border:none;cursor:pointer;text-align:left;padding:0;font-family:inherit;transition:.2s">Staff Login</button>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Guidance Navodaya & Sainik Institute, Khangabok, Thoubal, Manipur</span>
    <span>Established 2016 · guidancekhangabok.in</span>
  </div>
</footer>

<!-- WA FLOAT -->
<a id="waFloat" href="https://wa.me/918974298074?text=Hello%20GNSI%2C%20I%20am%20interested%20in%20admissions." target="_blank">
  <div class="wa-tooltip">Chat with us on WhatsApp</div>
  <svg viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
</a>

<!-- PARENTS PORTAL -->
<div class="pp-overlay" id="ppOverlay">
  <div class="pp-login-wrap" id="ppLoginWrap">
    <button class="pp-close" onclick="closePP()">✕</button>
    <div class="pp-box">
      <div class="pp-logo">
        <div class="crest" style="width:56px;height:56px;margin:0 auto .8rem"><div class="crest-i" style="width:40px;height:40px;font-size:1.2rem">G</div></div>
        <h2>Parents Portal</h2>
        <p>GNSI · Khangabok, Manipur</p>
      </div>
      <div class="pp-err" id="ppErr"></div>
      <label class="pp-fl">Registered Phone Number</label>
      <input type="tel" class="pp-fi" id="ppPhone" placeholder="+91 XXXXXXXXXX">
      <label class="pp-fl">Student ID / Roll Number</label>
      <input type="text" class="pp-fi" id="ppSid" placeholder="e.g. GNSI-2024-001" onkeydown="if(event.key==='Enter')ppLogin()">
      <button class="pp-lbtn" id="ppLbtn" onclick="ppLogin()">Login to Parents Portal →</button>
      <p style="color:rgba(248,243,232,.25);font-size:.7rem;font-family:'Rajdhani',sans-serif;letter-spacing:.05em;text-align:center;margin-top:1rem">Contact institute if you need help: <a href="tel:+918974298074" style="color:var(--goldL)">+91 89742 98074</a></p>
    </div>
  </div>
  <div class="pp-shell" id="ppShell">
    <div class="pp-topbar"><div class="pp-topbar-l"><div class="crest" style="width:34px;height:34px"><div class="crest-i" style="width:24px;height:24px;font-size:.8rem">G</div></div><div><h3 id="ppDashName">—</h3><p id="ppDashMeta">GNSI Parents Portal</p></div></div><button class="pp-lout" onclick="ppLogout()">Logout ✕</button></div>
    <div class="pp-tabs"><button class="pp-tab active" onclick="ppTab('att',this)">📊 Attendance</button><button class="pp-tab" onclick="ppTab('exams',this)">📝 Exam Scores</button><button class="pp-tab" onclick="ppTab('notices',this)">📣 Notices</button><button class="pp-tab" onclick="ppTab('leave',this)">🏠 Hostel Leave</button><button class="pp-tab" onclick="ppTab('alerts',this)">🔔 Alerts</button></div>
    <div class="pp-content">
      <div class="stu-hdr"><div class="stu-av" id="ppAv">?</div><div class="stu-info"><h3 id="ppStuName">Loading…</h3><p id="ppStuClass">—</p><div class="stu-badges"><span class="stu-badge" id="ppStuType">—</span><span class="stu-badge" id="ppStuStat">—</span></div></div></div>
      <div class="pp-sec active" id="sec-att"><div class="pp-card"><div class="pp-card-hd"><div class="pp-card-title">This Month's Attendance</div><div style="color:rgba(248,243,232,.28);font-size:.68rem;font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase" id="attMonth">—</div></div><div class="pp-card-body"><div class="att-grid" id="attGrid"></div><div class="att-sum"><div class="att-si p"><strong id="attP">—</strong><span>Present</span></div><div class="att-si a"><strong id="attA">—</strong><span>Absent</span></div><div class="att-si pct"><strong id="attPct">—</strong><span>Rate</span></div></div></div></div><div class="pp-card"><div class="pp-card-hd"><div class="pp-card-title">Last 10 Days</div></div><div class="pp-card-body" id="attRecent"><div class="pp-loading"><div class="spin"></div>Loading…</div></div></div></div>
      <div class="pp-sec" id="sec-exams"><div class="pp-card"><div class="pp-card-hd"><div class="pp-card-title">Exam Results</div></div><div class="pp-card-body" id="examList"><div class="pp-loading"><div class="spin"></div>Loading…</div></div></div></div>
      <div class="pp-sec" id="sec-notices"><div class="pp-card"><div class="pp-card-hd"><div class="pp-card-title">Official Notices</div></div><div class="pp-card-body" id="noticeList"><div class="pp-loading"><div class="spin"></div>Loading…</div></div></div></div>
      <div class="pp-sec" id="sec-leave"><div class="pp-card"><div class="pp-card-hd"><div class="pp-card-title">Hostel Leave History</div></div><div class="pp-card-body" id="leaveList"><div class="pp-loading"><div class="spin"></div>Loading…</div></div></div></div>
      <div class="pp-sec" id="sec-alerts"><div class="pp-card"><div class="pp-card-hd"><div class="pp-card-title">Recent Alerts</div></div><div class="pp-card-body" id="alertList"><div class="pp-loading"><div class="spin"></div>Loading…</div></div></div></div>
    </div>
  </div>
</div>

<script>
const SURL='${SUPA_URL}';
const SKEY='${SUPA_KEY}';
const sb=supabase.createClient(SURL,SKEY);
let ppStu=null;

// ═══ COUNTDOWN TIMER ═══
(function(){
  const deadline=new Date('2026-06-30T23:59:59');
  function tick(){
    const now=new Date(),diff=deadline-now;
    if(diff<=0){document.querySelector('.countdown-bar').innerHTML='<div style="color:var(--goldL);font-family:Rajdhani,sans-serif;font-weight:700;letter-spacing:.2em;text-transform:uppercase;font-size:clamp(.82rem,2.2vw,.92rem)">⚑ Admissions for 2026–27 are now closed. Contact us for next session.</div>';return}
    const d=Math.floor(diff/86400000),h=Math.floor(diff%86400000/3600000),m=Math.floor(diff%3600000/60000),s=Math.floor(diff%60000/1000);
    document.getElementById('cd-d').textContent=String(d).padStart(2,'0');
    document.getElementById('cd-h').textContent=String(h).padStart(2,'0');
    document.getElementById('cd-m').textContent=String(m).padStart(2,'0');
    document.getElementById('cd-s').textContent=String(s).padStart(2,'0');
  }
  tick();setInterval(tick,1000);
})();

// ═══ VIDEO ═══
function loadMainVideo(url){
  const ph=document.getElementById('videoPlaceholder');
  const embed=document.getElementById('mainVideoEmbed');
  if(ph)ph.remove();
  const iframe=document.createElement('iframe');
  iframe.src=url+'&autoplay=1';
  iframe.allow='accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture';
  iframe.allowFullscreen=true;
  iframe.style.cssText='position:absolute;top:0;left:0;width:100%;height:100%;border:0';
  embed.appendChild(iframe);
}

// ═══ KPIs ═══
async function loadKPIs(){
  try{
    const{count:sc}=await sb.from('staff').select('*',{count:'exact',head:true}).eq('status','Active');
    set('kpi-staff',sc??'—');
    const td=new Date().toISOString().slice(0,10);
    const{data:att}=await sb.from('student_attendance').select('status').eq('att_date',td);
    if(att&&att.length){const p=att.filter(r=>r.status==='Present').length;set('kpi-att',Math.round(p/att.length*100)+'%');}else set('kpi-att','—');
    const{count:ec}=await sb.from('exams').select('*',{count:'exact',head:true}).gte('exam_date',td);
    set('kpi-exams',ec??'0');
    const weekAgo=new Date(Date.now()-7*86400000).toISOString();
    const{count:enqC}=await sb.from('enquiries').select('*',{count:'exact',head:true}).gte('created_at',weekAgo);
    set('kpi-enq',(enqC??0)+' this week');
    const{data:nn}=await sb.from('notices').select('title').order('created_at',{ascending:false}).limit(1);
    if(nn&&nn[0]){const t=nn[0].title;set('kpi-notice',t.length>22?t.slice(0,22)+'…':t);}else set('kpi-notice','No notices');
    document.querySelectorAll('.lpulse').forEach(el=>el.classList.remove('lpulse'));
  }catch(e){console.warn('KPI:',e.message)}
}
loadKPIs();

async function loadPublicNotices(){
  try{
    const{data}=await sb.from('notices').select('title,body,priority,notice_date,created_at').eq('is_archived',false).order('created_at',{ascending:false}).limit(3);
    if(!data||!data.length)return;
    const cont=document.getElementById('publicNoticeCards');if(!cont)return;
    cont.innerHTML=data.map(n=>{
      const p=n.priority||'Medium',cls=p==='High'?'urgent':p==='Low'?'success':'';
      const badgeCls=p==='High'?'badge-open':p==='Low'?'badge-limited':'badge-weekly';
      const badgeTxt=p==='High'?'Urgent':p==='Low'?'Low Priority':'Notice';
      const dt=n.notice_date||n.created_at?.slice(0,10)||'';
      const fdt=dt?new Date(dt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'';
      return \`<div class="notice-card \${cls} reveal"><div class="notice-badge \${badgeCls}">\${badgeTxt}</div><h3>\${n.title}</h3><p>\${(n.body||'').slice(0,120)+(n.body?.length>120?'…':'')}</p><div class="notice-date">\${fdt}</div></div>\`;
    }).join('');
    cont.querySelectorAll('.reveal').forEach(el=>ro.observe(el));
  }catch(e){}
}
loadPublicNotices();

async function loadGallery(){
  try{
    const{data}=await sb.from('website_gallery').select('image_url,caption,category').order('sort_order').limit(5);
    if(!data||!data.length)return;
    const grid=document.getElementById('galleryGrid');if(!grid)return;
    grid.innerHTML=data.map((img,i)=>\`<div class="gcell\${i===0?' style="grid-row:span 2;aspect-ratio:auto;min-height:280px"':''}">\${img.image_url?'<img src="'+img.image_url+'" alt="'+img.caption+'" loading="lazy">':''}<div class="gcell-lbl">\${img.caption||img.category||'Campus'}</div></div>\`).join('');
  }catch(e){}
}
loadGallery();

async function loadFaculty(){
  try{
    const{data}=await sb.from('website_faculty').select('*').order('sort_order').order('name').limit(8);
    if(!data||!data.length)return;
    const grid=document.getElementById('facultyGrid');if(!grid)return;
    grid.innerHTML=data.map(f=>\`<div class="faculty-card reveal"><div class="faculty-photo">\${f.photo_url?'<img src="'+f.photo_url+'" alt="'+f.name+'">':f.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div><h3>\${f.name}</h3><div class="role">\${f.role||''}</div>\${f.subject?'<div class="subj">'+f.subject+'</div>':''}\${f.experience?'<div class="exp">'+f.experience+'</div>':''}</div>\`).join('');
    grid.querySelectorAll('.reveal').forEach(el=>ro.observe(el));
  }catch(e){}
}
loadFaculty();

// Load rankers from DB if available
async function loadRankers(){
  try{
    const{data}=await sb.from('website_rankers').select('*').order('sort_order').limit(12);
    if(!data||!data.length)return;
    const grid=document.getElementById('rankerGrid');if(!grid)return;
    grid.innerHTML=data.map(r=>\`
      <div class="ranker-card reveal-scale">
        \${r.rank?'<div class="ranker-badge">'+r.rank+'</div>':''}
        <div class="ranker-photo">\${r.photo_url?'<img src="'+r.photo_url+'" alt="'+r.name+'">':r.name.charAt(0)}</div>
        <h4>\${r.name}</h4>
        <div class="ranker-school">\${r.school||''}</div>
        <div class="ranker-batch">\${r.batch||''}</div>
      </div>
    \`).join('');
    grid.querySelectorAll('.reveal-scale').forEach(el=>ro.observe(el));
  }catch(e){}
}
loadRankers();

function set(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}

function loadMap(){
  const wrap=document.getElementById('mapWrap'),ph=document.getElementById('mapPlaceholder');
  if(ph)ph.remove();
  const iframe=document.createElement('iframe');
  iframe.src='https://maps.google.com/maps?q=Khangabok+Thoubal+Manipur&output=embed';
  iframe.className='map-frame';iframe.title='GNSI Campus Location';
  wrap.appendChild(iframe);wrap.style.cursor='default';wrap.onclick=null;
}

document.getElementById('hbg').addEventListener('click',function(){this.classList.toggle('open');document.getElementById('mobMenu').classList.toggle('open')});
function closeMob(){document.getElementById('hbg').classList.remove('open');document.getElementById('mobMenu').classList.remove('open')}

let heroHeight=0;
window.addEventListener('scroll',()=>{
  const h=document.documentElement.scrollHeight-window.innerHeight;
  document.getElementById('sp').style.width=(window.scrollY/h*100)+'%';
  if(!heroHeight){const hero=document.querySelector('.hero');if(hero)heroHeight=hero.offsetHeight}
  const bar=document.getElementById('stickyBar');
  if(bar&&bar.style.display!=='none'){
    if(window.scrollY>heroHeight*.6)bar.classList.add('show');
    else bar.classList.remove('show');
  }
});

function animateCounter(el){
  const target=parseInt(el.dataset.target)||0,suffix=el.dataset.suffix||'',duration=1800,start=performance.now();
  function step(now){const p=Math.min((now-start)/duration,1),ease=1-Math.pow(1-p,3);el.textContent=Math.floor(ease*target)+suffix;if(p<1)requestAnimationFrame(step);else el.textContent=target+suffix}
  requestAnimationFrame(step);
}

const ro=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('vis');
      if(e.target.classList.contains('bar-fill'))e.target.style.width=e.target.dataset.w+'%';
      e.target.querySelectorAll&&e.target.querySelectorAll('.count-up').forEach(c=>{if(!c.dataset.done){c.dataset.done='1';animateCounter(c)}});
      ro.unobserve(e.target);
    }
  });
},{threshold:.15});
document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.bar-fill').forEach(el=>ro.observe(el));

window.addEventListener('load',()=>{
  document.querySelectorAll('.stats-bar .count-up').forEach(c=>{if(!c.dataset.done){c.dataset.done='1';animateCounter(c)}});
});

document.querySelectorAll('.faq-q').forEach(q=>{
  q.addEventListener('click',()=>{
    const a=q.nextElementSibling,icon=q.querySelector('.faq-icon'),open=a.style.display==='block';
    document.querySelectorAll('.faq-a').forEach(x=>x.style.display='none');
    document.querySelectorAll('.faq-icon').forEach(x=>x.textContent='+');
    a.style.display=open?'none':'block';icon.textContent=open?'+':'−';
  });
});

let tIdx=0;const tCards=document.querySelectorAll('.testi-card');
function tDots(){const c=document.getElementById('testiDots');c.innerHTML='';tCards.forEach((_,i)=>{const d=document.createElement('div');d.className='slider-dot'+(i===tIdx?' active':'');d.onclick=()=>tGoTo(i);c.appendChild(d)})}
function tGoTo(i){tIdx=i;document.getElementById('testiTrack').style.transform=\`translateX(-\${i*100}%)\`;tDots()}
function tSlide(d){tGoTo((tIdx+d+tCards.length)%tCards.length)}
tDots();setInterval(()=>tSlide(1),5500);
let tsX=0;
document.querySelector('.testi-wrap').addEventListener('touchstart',e=>tsX=e.touches[0].clientX,{passive:true});
document.querySelector('.testi-wrap').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tsX;if(Math.abs(dx)>40)tSlide(dx<0?1:-1)},{passive:true});

async function submitEnquiry(){
  const sn=document.getElementById('fStuName').value.trim(),pn=document.getElementById('fParName').value.trim(),ph=document.getElementById('fPhone').value.trim(),cl=document.getElementById('fClass').value.trim(),co=document.getElementById('fCourse').value,ms=document.getElementById('fMsg').value.trim();
  const msg=document.getElementById('formMsg'),btn=document.getElementById('fBtn');
  if(!sn||!ph){msg.className='form-msg error';msg.textContent='Please enter student name and phone number.';msg.style.display='block';return}
  btn.disabled=true;btn.textContent='Submitting…';
  try{
    const{error}=await sb.from('enquiries').insert({student_name:sn,parent_name:pn,phone:ph,class_grade:cl,course:co,message:ms,created_at:new Date().toISOString()});
    if(error)throw error;
    msg.className='form-msg success';msg.textContent='✓ Enquiry submitted! We will contact you within 24 hours.';msg.style.display='block';
    ['fStuName','fParName','fPhone','fClass','fMsg'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('fCourse').selectedIndex=0;
    btn.textContent='Submit Enquiry →';btn.disabled=false;
  }catch(e){
    const waMsg=\`Hello GNSI, I am enquiring about admission.\\nStudent: \${sn}\\nParent: \${pn}\\nPhone: \${ph}\\nCourse: \${co||'Not selected'}\\nMessage: \${ms}\`;
    window.open('https://wa.me/918974298074?text='+encodeURIComponent(waMsg),'_blank');
    msg.className='form-msg success';msg.textContent='✓ Redirecting to WhatsApp — your enquiry details are pre-filled.';msg.style.display='block';
    btn.textContent='Submit Enquiry →';btn.disabled=false;
  }
}

function openPP(){document.getElementById('ppOverlay').classList.add('open');document.body.style.overflow='hidden';if(ppStu){document.getElementById('ppLoginWrap').style.display='none';document.getElementById('ppShell').classList.add('show')}}
function closePP(){document.getElementById('ppOverlay').classList.remove('open');document.body.style.overflow=''}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePP()});

async function ppLogin(){
  const phone=document.getElementById('ppPhone').value.trim().replace(/\\s/g,''),sid=document.getElementById('ppSid').value.trim();
  const err=document.getElementById('ppErr'),btn=document.getElementById('ppLbtn');
  err.style.display='none';
  if(!phone||!sid){err.textContent='Please enter both phone number and Student ID.';err.style.display='block';return}
  btn.disabled=true;btn.textContent='Verifying…';
  try{
    const pn=phone.replace(/^\\+91/,'').replace(/^0/,'');
    const{data:rows,error}=await sb.from('students').select('*').or(\`student_code.eq.\${sid.toUpperCase()},roll.eq.\${sid}\`);
    if(error)throw error;
    const matched=(rows||[]).find(s=>{const sp=(s.parent_phone||'').replace(/\\s/g,'').replace(/^\\+91/,'').replace(/^0/,'');return sp===pn});
    if(!matched){err.textContent='No student found. Please check and try again.';err.style.display='block';btn.disabled=false;btn.textContent='Login to Parents Portal →';return}
    ppStu=matched;ppShowDash();
  }catch(e){err.textContent='Connection error: '+e.message;err.style.display='block';btn.disabled=false;btn.textContent='Login to Parents Portal →'}
}

function ppShowDash(){
  document.getElementById('ppLoginWrap').style.display='none';
  document.getElementById('ppShell').classList.add('show');
  const s=ppStu,ini=(s.name||'S').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  set('ppAv',ini);set('ppDashName',s.name||'—');
  set('ppDashMeta',(s.class_name||s.course||'')+'· GNSI Parents Portal');
  set('ppStuName',s.name||'—');
  set('ppStuClass',[s.class_name,s.course].filter(Boolean).join(' · ')||'—');
  set('ppStuType',s.fee_status||'Active');set('ppStuStat',s.status||'Enrolled');
  ppLoadAtt();ppLoadExams();ppLoadNotices();ppLoadLeave();ppLoadAlerts();
}

function ppLogout(){ppStu=null;document.getElementById('ppShell').classList.remove('show');document.getElementById('ppLoginWrap').style.display='flex';['ppPhone','ppSid'].forEach(id=>document.getElementById(id).value='');document.getElementById('ppLbtn').disabled=false;document.getElementById('ppLbtn').textContent='Login to Parents Portal →';document.getElementById('ppErr').style.display='none'}
function ppTab(name,btn){document.querySelectorAll('.pp-sec').forEach(s=>s.classList.remove('active'));document.querySelectorAll('.pp-tab').forEach(b=>b.classList.remove('active'));document.getElementById('sec-'+name).classList.add('active');btn.classList.add('active')}

async function ppLoadAtt(){
  const now=new Date(),y=now.getFullYear(),m=now.getMonth();
  set('attMonth',now.toLocaleString('en-IN',{month:'long',year:'numeric'}));
  const f=\`\${y}-\${String(m+1).padStart(2,'0')}-01\`,l=new Date(y,m+1,0).toISOString().slice(0,10);
  try{
    const{data:rows}=await sb.from('student_attendance').select('att_date,status').eq('student_id',ppStu.id).gte('att_date',f).lte('att_date',l).order('att_date');
    const map={};(rows||[]).forEach(r=>map[r.att_date]=r.status);
    const days=new Date(y,m+1,0).getDate(),td=now.toISOString().slice(0,10);
    const grid=document.getElementById('attGrid');grid.innerHTML='';let p=0,a=0;
    for(let d=1;d<=days;d++){
      const ds=\`\${y}-\${String(m+1).padStart(2,'0')}-\${String(d).padStart(2,'0')}\`,st=map[ds];
      const el=document.createElement('div');el.className='att-day';el.title=ds+(st?': '+st:'');el.textContent=d;
      if(ds>td){el.style.cssText='opacity:.18;background:rgba(61,79,107,.2);border:1px solid rgba(61,79,107,.15);color:rgba(248,243,232,.18)'}
      else if(st==='Present'||st==='Late'){el.classList.add('att-p');p++}
      else if(st==='Absent'){el.classList.add('att-a');a++}
      else el.classList.add('att-h');
      if(ds===td)el.style.outline='2px solid var(--gold)';
      grid.appendChild(el);
    }
    const tot=p+a;set('attP',p);set('attA',a);set('attPct',tot>0?Math.round(p/tot*100)+'%':'—');
    const rec=(rows||[]).slice(-10).reverse(),re=document.getElementById('attRecent');
    if(!rec.length){re.innerHTML='<div class="pp-empty"><div class="pp-empty-icon">📋</div><p>No records this month</p></div>';return}
    re.innerHTML=rec.map(r=>{const c=r.status==='Present'?'#4AE382':r.status==='Absent'?'#f87171':'var(--mist)';return\`<div style="display:flex;justify-content:space-between;padding:.45rem 0;border-bottom:1px solid rgba(184,146,42,.07);font-size:.82rem"><span style="color:rgba(248,243,232,.55);font-family:'Rajdhani',sans-serif">\${fmtDate(r.att_date)}</span><strong style="color:\${c};font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.08em;text-transform:uppercase">\${r.status}</strong></div>\`}).join('');
  }catch(e){document.getElementById('attRecent').innerHTML='<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Could not load attendance</p></div>'}
}

async function ppLoadExams(){
  try{
    let{data:marks}=await sb.from('exam_marks').select('*,exams(name,exam_date,max_marks)').eq('student_id',ppStu.id).order('created_at',{ascending:false}).limit(20);
    if(!marks||!marks.length){const r=await sb.from('exam_results').select('*').eq('student_id',ppStu.id).order('created_at',{ascending:false}).limit(20);marks=r.data}
    const el=document.getElementById('examList');
    if(!marks||!marks.length){el.innerHTML='<div class="pp-empty"><div class="pp-empty-icon">📝</div><p>No exam results yet</p></div>';return}
    el.innerHTML=\`<table class="pp-table"><thead><tr><th>Exam</th><th>Date</th><th>Marks</th><th>Grade</th></tr></thead><tbody>\${marks.map(m=>{const en=m.exams?.name||m.exam_name||'—',ed=m.exams?.exam_date||m.exam_date||'—',ob=m.marks_obtained??m.marks??'—',mx=m.exams?.max_marks??m.max_marks??100,pct=ob!=='—'?Math.round(ob/mx*100):null;let bc='sc-mi',gr='—';if(pct!==null){if(pct>=75){bc='sc-hi';gr='A'}else if(pct>=50){bc='sc-mi';gr='B'}else{bc='sc-lo';gr='C'}}return\`<tr><td>\${en}</td><td style="color:rgba(248,243,232,.38);font-size:.78rem">\${ed!=='—'?fmtDate(ed):'—'}</td><td><span class="\${bc}">\${ob}\${mx?'/'+mx:''}</span></td><td style="color:rgba(248,243,232,.45);font-family:'Rajdhani',sans-serif;font-weight:700">\${gr}\${pct!==null?' ('+pct+'%)':''}</td></tr>\`}).join('')}</tbody></table>\`;
  }catch(e){document.getElementById('examList').innerHTML='<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Could not load results</p></div>'}
}

async function ppLoadNotices(){
  try{
    const{data:notices}=await sb.from('notices').select('title,body,priority,notice_date,created_at').eq('is_archived',false).order('created_at',{ascending:false}).limit(15);
    const el=document.getElementById('noticeList');
    if(!notices||!notices.length){el.innerHTML='<div class="pp-empty"><div class="pp-empty-icon">📣</div><p>No notices at this time</p></div>';return}
    el.innerHTML=notices.map(n=>{const p=n.priority||'Medium',cls=p==='High'?'pri-h':p==='Low'?'pri-l':'pri-m',ds=n.notice_date||n.created_at?.slice(0,10);return\`<div class="pp-ni"><div class="pp-npri \${cls}">\${p} Priority</div><h3 class="pp-ntitle">\${n.title}</h3><p class="pp-nbody">\${(n.body||'').slice(0,200)+(n.body?.length>200?'…':'')}</p><div class="pp-ndate">\${ds?fmtDate(ds):''}</div></div>\`}).join('');
  }catch(e){document.getElementById('noticeList').innerHTML='<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Could not load notices</p></div>'}
}

async function ppLoadLeave(){
  try{
    const{data:leaves}=await sb.from('hostel_leaves').select('*').eq('student_id',ppStu.id).order('created_at',{ascending:false}).limit(20);
    const el=document.getElementById('leaveList');
    if(!leaves||!leaves.length){el.innerHTML='<div class="pp-empty"><div class="pp-empty-icon">🏠</div><p>No hostel leave records found</p></div>';return}
    el.innerHTML=leaves.map(l=>{const st=l.status||l.approval_status||'Pending',sc=st==='Approved'?'ls-ap':st==='Rejected'?'ls-re':'ls-pe',fd=l.from_date||l.leave_from||l.start_date,td=l.to_date||l.leave_to||l.end_date,rs=l.reason||l.leave_reason||'—';return\`<div class="leave-item"><div class="leave-hd"><div><div style="color:var(--cream);font-size:.92rem;font-family:'EB Garamond',serif">\${l.leave_type||'Hostel Leave'}</div><div class="leave-dates">\${fd?fmtDate(fd):'—'} → \${td?fmtDate(td):'—'}</div></div><span class="ls \${sc}">\${st}</span></div><div class="leave-rsn">Reason: \${rs}</div></div>\`}).join('');
  }catch(e){document.getElementById('leaveList').innerHTML='<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Could not load leave records</p></div>'}
}

async function ppLoadAlerts(){
  const el=document.getElementById('alertList');const alerts=[];
  try{
    const[ab,ex,no,lv]=await Promise.all([
      sb.from('student_attendance').select('att_date,status').eq('student_id',ppStu.id).eq('status','Absent').order('att_date',{ascending:false}).limit(5),
      sb.from('exam_marks').select('marks_obtained,max_marks,created_at,exams(name)').eq('student_id',ppStu.id).order('created_at',{ascending:false}).limit(5),
      sb.from('notices').select('title,created_at,priority').eq('is_archived',false).order('created_at',{ascending:false}).limit(3),
      sb.from('hostel_leaves').select('leave_type,status,updated_at').eq('student_id',ppStu.id).order('updated_at',{ascending:false}).limit(3)
    ]);
    (ab.data||[]).forEach(a=>alerts.push({type:'att',msg:\`\${ppStu.name} was marked Absent on \${fmtDate(a.att_date)}\`,date:a.att_date}));
    (ex.data||[]).forEach(s=>{const pct=s.marks_obtained&&s.max_marks?Math.round(s.marks_obtained/s.max_marks*100):null,en=s.exams?.name||'Exam';if(pct!==null)alerts.push({type:'exam',msg:\`\${en}: \${s.marks_obtained}/\${s.max_marks} (\${pct}%)\`,date:s.created_at?.slice(0,10)})});
    (no.data||[]).forEach(n=>alerts.push({type:'notice',msg:\`Notice: \${n.title}\`,date:n.created_at?.slice(0,10)}));
    (lv.data||[]).forEach(l=>alerts.push({type:'leave',msg:\`Leave \${l.status||'updated'}: \${l.leave_type||'Hostel Leave'}\`,date:l.updated_at?.slice(0,10)}));
    alerts.sort((a,b)=>(b.date||'')>(a.date||'')?1:-1);
    if(!alerts.length){el.innerHTML='<div class="pp-empty"><div class="pp-empty-icon">🔔</div><p>No recent alerts</p></div>';return}
    el.innerHTML=alerts.map(a=>\`<div class="alert-item \${a.type}"><div class="alert-msg">\${a.msg}</div><div class="alert-meta">\${a.date?fmtDate(a.date):''} · \${a.type.toUpperCase()}</div></div>\`).join('');
  }catch(e){el.innerHTML='<div class="pp-empty"><div class="pp-empty-icon">⚠️</div><p>Could not load alerts</p></div>'}
}

// ═══ LANGUAGE TOGGLE ═══
function setLang(lang, btn) {
  document.body.classList.toggle('hi', lang === 'hi');
  document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  localStorage.setItem('gnsi_lang', lang);
}
// Restore saved language
(function() {
  const saved = localStorage.getItem('gnsi_lang');
  if (saved === 'hi') {
    document.body.classList.add('hi');
    const btns = document.querySelectorAll('.lang-btn');
    if (btns[0]) btns[0].classList.remove('active');
    if (btns[1]) btns[1].classList.add('active');
  }
})();

// ═══ ADMIT CARD PORTAL ═══
async function fetchAdmitCard() {
  const roll = document.getElementById('acRoll').value.trim();
  const exam = document.getElementById('acExam').value;
  const res = document.getElementById('acResult');
  const data = document.getElementById('acData');
  if (!roll) { res.className = 'portal-result show err'; data.innerHTML = '<p style="color:#f87171;font-family:Rajdhani,sans-serif;font-size:.85rem">Please enter your roll number.</p>'; return; }
  try {
    const { data: stu, error } = await sb.from('students').select('*').or(\`student_code.eq.\${roll.toUpperCase()},roll.eq.\${roll}\`).single();
    if (error || !stu) { res.className = 'portal-result show err'; data.innerHTML = '<p style="color:#f87171;font-family:Rajdhani,sans-serif;font-size:.85rem">Student not found. Please check your roll number.</p>'; return; }
    res.className = 'portal-result show ok';
    data.innerHTML = [
      ['Student Name', stu.name || '—'],
      ['Roll Number', roll.toUpperCase()],
      ['Class / Course', stu.class_name || stu.course || '—'],
      ['Exam', exam || 'Sunday Mock Test'],
      ['Venue', 'GNSI Campus, Khangabok, Thoubal'],
      ['Reporting Time', '08:00 AM'],
      ['Exam Time', '09:00 AM – 11:30 AM'],
    ].map(([l, v]) => \`<div class="portal-row"><span>\${l}</span><strong>\${v}</strong></div>\`).join('');
    window._admitData = { name: stu.name, roll, exam, course: stu.class_name || stu.course };
  } catch (e) {
    res.className = 'portal-result show err';
    data.innerHTML = '<p style="color:#f87171;font-family:Rajdhani,sans-serif;font-size:.85rem">Connection error. Please try again.</p>';
  }
}

function printAdmitCard() {
  const d = window._admitData || {};
  const w = window.open('', '_blank');
  w.document.write(\`<!DOCTYPE html><html><head><title>GNSI Admit Card</title><style>
    body{font-family:Arial,sans-serif;max-width:600px;margin:2rem auto;padding:1rem;border:2px solid #0B1F3A}
    h2{color:#0B1F3A;text-align:center;font-size:1.4rem;margin-bottom:.3rem}
    .sub{text-align:center;color:#7A8FA8;font-size:.8rem;margin-bottom:1.5rem}
    table{width:100%;border-collapse:collapse}
    td{padding:.6rem .8rem;border:1px solid #ddd;font-size:.88rem}
    td:first-child{font-weight:700;background:#f8f3e8;width:40%}
    .footer{margin-top:1.5rem;font-size:.72rem;color:#7A8FA8;text-align:center;border-top:1px solid #ddd;padding-top:.8rem}
    @media print{button{display:none}}
  </style></head><body>
    <h2>🏫 GNSI — Guidance Navodaya & Sainik Institute</h2>
    <div class="sub">Khangabok, Thoubal District, Manipur · +91 89742 98074</div>
    <h3 style="text-align:center;background:#0B1F3A;color:#EDD180;padding:.5rem;margin-bottom:1rem">ADMIT CARD — \${d.exam || 'Mock Test'}</h3>
    <table>
      <tr><td>Student Name</td><td><strong>\${d.name || '—'}</strong></td></tr>
      <tr><td>Roll Number</td><td><strong>\${d.roll || '—'}</strong></td></tr>
      <tr><td>Course</td><td>\${d.course || '—'}</td></tr>
      <tr><td>Exam</td><td>\${d.exam || 'Sunday Mock Test'}</td></tr>
      <tr><td>Venue</td><td>GNSI Campus, Khangabok, Thoubal</td></tr>
      <tr><td>Reporting Time</td><td>08:00 AM</td></tr>
      <tr><td>Exam Time</td><td>09:00 AM – 11:30 AM</td></tr>
      <tr><td>Instructions</td><td>Carry this admit card + school ID · No mobile phones · Arrive 30 min early</td></tr>
    </table>
    <div class="footer">This is a computer-generated admit card. For queries call +91 89742 98074.<br>GNSI — guidancekhangabok.in</div>
    <br><button onclick="window.print()">🖨 Print</button>
  </body></html>\`);
  w.document.close();
}

// ═══ RESULT CHECKER ═══
async function fetchResult() {
  const roll = document.getElementById('rcRoll').value.trim();
  const dob = document.getElementById('rcDob').value;
  const res = document.getElementById('rcResult');
  const data = document.getElementById('rcData');
  if (!roll) { res.className = 'portal-result show err'; data.innerHTML = '<p style="color:#f87171;font-family:Rajdhani,sans-serif;font-size:.85rem">Please enter your roll number.</p>'; return; }
  try {
    const { data: stu } = await sb.from('students').select('*,exam_marks(marks_obtained,max_marks,exams(name,exam_date))').or(\`student_code.eq.\${roll.toUpperCase()},roll.eq.\${roll}\`).single();
    if (!stu) { res.className = 'portal-result show err'; data.innerHTML = '<p style="color:#f87171;font-family:Rajdhani,sans-serif;font-size:.85rem">Student not found. Please verify your roll number.</p>'; return; }
    const marks = stu.exam_marks || [];
    res.className = 'portal-result show ok';
    let html = [
      ['Student Name', stu.name || '—'],
      ['Roll Number', roll.toUpperCase()],
      ['Class / Course', stu.class_name || stu.course || '—'],
    ].map(([l, v]) => \`<div class="portal-row"><span>\${l}</span><strong>\${v}</strong></div>\`).join('');
    if (marks.length) {
      html += '<div style="margin-top:.8rem;font-family:Rajdhani,sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:rgba(184,146,42,.6);margin-bottom:.3rem">Recent Exam Results</div>';
      marks.slice(0, 5).forEach(m => {
        const pct = m.marks_obtained && m.max_marks ? Math.round(m.marks_obtained / m.max_marks * 100) : null;
        const col = pct >= 75 ? '#4AE382' : pct >= 50 ? '#EDD180' : '#f87171';
        html += \`<div class="portal-row"><span>\${m.exams?.name || 'Exam'}</span><strong style="color:\${col}">\${m.marks_obtained}/\${m.max_marks}\${pct ? ' ('+pct+'%)' : ''}</strong></div>\`;
      });
    } else {
      html += '<div style="color:rgba(248,243,232,.35);font-size:.8rem;font-family:Rajdhani,sans-serif;margin-top:.6rem">No exam results recorded yet.</div>';
    }
    data.innerHTML = html;
  } catch(e) {
    res.className = 'portal-result show err';
    data.innerHTML = '<p style="color:#f87171;font-family:Rajdhani,sans-serif;font-size:.85rem">Connection error. Please try again.</p>';
  }
}

// ═══ GRIEVANCE FORM ═══
async function submitGrievance() {
  const name = document.getElementById('grvName').value.trim();
  const phone = document.getElementById('grvPhone').value.trim();
  const cat = document.getElementById('grvCat').value;
  const msg2 = document.getElementById('grvMsg2').value.trim();
  const msgEl = document.getElementById('grvMsg');
  if (!name || !phone || !msg2) { msgEl.className = 'grv-msg err'; msgEl.textContent = 'Please fill all required fields.'; msgEl.style.display = 'block'; return; }
  const ticketId = 'GNSI-GRV-' + Date.now().toString().slice(-6);
  try {
    const { error } = await sb.from('enquiries').insert({
      student_name: name, phone, course: 'GRIEVANCE: ' + cat,
      message: \`[Ticket: \${ticketId}] \${msg2}\`, created_at: new Date().toISOString()
    });
    if (error) throw error;
    msgEl.className = 'grv-msg ok';
    msgEl.innerHTML = \`✓ Grievance submitted. Your ticket ID: <span class="ticket-id">\${ticketId}</span>. We will respond within 48 hours.\`;
    msgEl.style.display = 'block';
    document.getElementById('grvName').value = '';
    document.getElementById('grvPhone').value = '';
    document.getElementById('grvMsg2').value = '';
  } catch(e) {
    const waMsg = \`Hello GNSI, I have a \${cat}.\\nName: \${name}\\nPhone: \${phone}\\nRef: \${ticketId}\\nDetails: \${msg2}\`;
    window.open('https://wa.me/918974298074?text=' + encodeURIComponent(waMsg), '_blank');
    msgEl.className = 'grv-msg ok';
    msgEl.innerHTML = \`✓ Redirecting to WhatsApp. Your ticket ref: <span class="ticket-id">\${ticketId}</span>\`;
    msgEl.style.display = 'block';
  }
}

// ═══ RESULT BANNER SLIDER ═══
let rbIdx=0;
const rbSlides=document.querySelectorAll('.result-banner-slide');
function rbDots_(){
  const c=document.getElementById('rbDots');if(!c)return;
  c.innerHTML='';
  rbSlides.forEach((_,i)=>{const d=document.createElement('div');d.className='rb-dot'+(i===rbIdx?' active':'');d.onclick=()=>rbGoTo(i);c.appendChild(d)});
}
function rbGoTo(i){rbIdx=i;const t=document.getElementById('rbTrack');if(t)t.style.transform=\`translateX(-\${i*100}%)\`;rbDots_();}
function rbSlide(d){rbGoTo((rbIdx+d+rbSlides.length)%rbSlides.length)}
rbDots_();setInterval(()=>rbSlide(1),5000);

// ═══ SYLLABUS TABS ═══
function sylTab(name,btn){
  document.querySelectorAll('.syl-panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.syl-tab').forEach(b=>b.classList.remove('active'));
  const panel=document.getElementById('syl-'+name);
  if(panel)panel.classList.add('active');
  if(btn)btn.classList.add('active');
}

// ═══ SCHOLARSHIP FORM ═══
async function submitScholar(){
  const name=document.getElementById('scName').value.trim(),phone=document.getElementById('scPhone').value.trim(),cls=document.getElementById('scClass').value.trim(),type=document.getElementById('scType').value;
  const msg=document.getElementById('scholarMsg');
  if(!name||!phone){msg.className='scholar-msg err';msg.textContent='Please enter student name and phone.';msg.style.display='block';return}
  try{
    const{error}=await sb.from('enquiries').insert({student_name:name,phone:phone,class_grade:cls,course:type+' — Scholarship/Demo',message:'Scholarship test / free demo registration',created_at:new Date().toISOString()});
    if(error)throw error;
    msg.className='scholar-msg ok';msg.textContent='✓ Registered! We will contact you within 24 hours to confirm your slot.';msg.style.display='block';
    document.getElementById('scName').value='';document.getElementById('scPhone').value='';document.getElementById('scClass').value='';
  }catch(e){
    const waMsg=\`Hello GNSI, I want to register for \${type}.\\nStudent: \${name}\\nPhone: \${phone}\\nClass: \${cls}\`;
    window.open('https://wa.me/918974298074?text='+encodeURIComponent(waMsg),'_blank');
    msg.className='scholar-msg ok';msg.textContent='✓ Redirecting to WhatsApp to complete registration.';msg.style.display='block';
  }
}
<\/script>
</body>
</html>`
}

export default function LandingPage({ onLogin }) {
  const iframeRef = useRef(null)
  useEffect(() => {
    const handler = (e) => { if (e.data === 'gnsi-staff-login') onLogin?.() }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [onLogin])
  return (
    <iframe
      ref={iframeRef}
      srcDoc={getLandingHTML()}
      style={{ width: '100%', height: '100vh', border: 'none', display: 'block' }}
      title="GNSI Public Website"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
    />
  )
}
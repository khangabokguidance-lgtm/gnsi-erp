//  LandingPage.jsx — GNSI Premium v2
//  Production-grade public website rendered in iframe
//  Upgrades: animated counters, sticky apply bar, WA tooltip,
//  schema.org structured data, lazy map, OG image meta,
//  scroll-triggered animations, premium micro-interactions
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

<!-- Schema.org structured data -->
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
  "areaServed": "Manipur, India",
  "sameAs": [
    "https://facebook.com/gnsikhangabok",
    "https://youtube.com/@gnsikhangabok",
    "https://instagram.com/gnsikhangabok"
  ]
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
html{scroll-behavior:smooth;font-size:16px}
body{font-family:'Source Sans 3',sans-serif;background:var(--white);color:var(--navy);overflow-x:hidden}
h1,h2,h3,h4,h5{font-family:'EB Garamond',serif;line-height:1.1}
a{text-decoration:none;color:inherit}
img{max-width:100%;display:block}
.container{width:min(1200px,92%);margin:auto}

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
#stickyBar{
  position:fixed;bottom:0;left:0;right:0;z-index:990;
  background:var(--navy);border-top:2px solid var(--gold);
  padding:.75rem 5%;
  display:flex;align-items:center;justify-content:space-between;
  transform:translateY(100%);transition:transform .4s cubic-bezier(.25,.46,.45,.94);
  gap:1rem;flex-wrap:wrap;
}
#stickyBar.show{transform:translateY(0)}
#stickyBar p{color:rgba(248,243,232,.7);font-size:.82rem;font-family:'Rajdhani',sans-serif;letter-spacing:.04em}
#stickyBar p strong{color:var(--goldL)}
.sticky-btns{display:flex;gap:.6rem;align-items:center;flex-shrink:0}
.sb-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.1rem;cursor:pointer;border:none;transition:.2s}
.sb-btn-gold{background:var(--gold);color:var(--navy)}
.sb-btn-gold:hover{background:var(--goldL)}
.sb-btn-wa{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.3) !important;color:#4AE382;border:none}
.sb-close{background:none;border:none;color:rgba(248,243,232,.35);cursor:pointer;font-size:1.1rem;padding:.2rem .4rem;flex-shrink:0}
.sb-close:hover{color:rgba(248,243,232,.7)}

/* ALERT */
.alert-strip{background:var(--red);color:#fff;font-size:.78rem;letter-spacing:.04em;padding:.55rem 5%;display:flex;justify-content:space-between;align-items:center;font-family:'Rajdhani',sans-serif;font-weight:600;text-transform:uppercase}
.alert-strip button{background:none;border:none;color:#fff;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0}

/* TICKER */
.ticker-wrap{background:var(--navy);overflow:hidden;border-bottom:2px solid var(--gold)}
.ticker-inner{display:flex;align-items:center;height:34px}
.ticker-label{background:var(--gold);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;padding:0 1.2rem;height:100%;display:flex;align-items:center;white-space:nowrap;flex-shrink:0}
.ticker-scroll{overflow:hidden;flex:1}
.ticker-track{display:inline-block;min-width:200%;animation:tkscroll 38s linear infinite;color:var(--goldLL);font-size:.72rem;letter-spacing:.14em;font-family:'Rajdhani',sans-serif;font-weight:500;white-space:nowrap;padding-left:2rem}
@keyframes tkscroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}

/* NAV */
nav{position:sticky;top:0;z-index:1000;background:rgba(11,31,58,.97);backdrop-filter:blur(16px);border-bottom:1px solid rgba(184,146,42,.3)}
.nav-inner{width:min(1200px,92%);margin:auto;height:70px;display:flex;align-items:center;justify-content:space-between}
.brand{display:flex;align-items:center;gap:14px;text-decoration:none}
.crest{width:46px;height:46px;border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.crest-i{width:32px;height:32px;border:1px solid rgba(184,146,42,.5);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-weight:700;font-size:1rem;color:var(--goldL)}
.brand-text h2{font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--cream);font-size:1rem;letter-spacing:.12em;text-transform:uppercase}
.brand-text small{display:block;color:var(--goldL);font-size:.58rem;letter-spacing:.2em;text-transform:uppercase;opacity:.8}
.nav-links{display:flex;list-style:none;gap:.4rem;align-items:center}
.nav-links a{color:rgba(248,243,232,.65);font-size:.72rem;text-transform:uppercase;letter-spacing:.07em;font-family:'Rajdhani',sans-serif;font-weight:600;padding:.3rem .55rem;transition:.2s;position:relative}
.nav-links a::after{content:'';position:absolute;bottom:-2px;left:0;right:0;height:2px;background:var(--gold);transform:scaleX(0);transition:.2s}
.nav-links a:hover{color:var(--goldLL)}
.nav-links a:hover::after{transform:scaleX(1)}
.nav-btn{background:var(--gold);color:var(--navy)!important;padding:.4rem 1rem!important;font-weight:700!important;opacity:1!important;cursor:pointer;border:none;transition:.2s!important}
.nav-btn:hover{background:var(--goldL)!important}
.nav-par{background:rgba(37,211,102,.15);border:1px solid rgba(37,211,102,.3);color:#4AE382!important;padding:.4rem 1rem!important;font-weight:700!important;opacity:1!important;transition:.2s!important}
.nav-par:hover{background:rgba(37,211,102,.25)!important}
.hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;padding:8px}
.hamburger span{display:block;width:24px;height:2px;background:var(--cream);transition:.3s;transform-origin:center}
.hamburger.open span:nth-child(1){transform:translateY(7px) rotate(45deg)}
.hamburger.open span:nth-child(2){opacity:0}
.hamburger.open span:nth-child(3){transform:translateY(-7px) rotate(-45deg)}
.mob-menu{display:none;flex-direction:column;background:var(--navy);border-top:1px solid rgba(184,146,42,.2);padding:1rem 0}
.mob-menu.open{display:flex}
.mob-menu a{color:rgba(248,243,232,.75);font-family:'Rajdhani',sans-serif;font-weight:600;font-size:.9rem;letter-spacing:.1em;text-transform:uppercase;padding:.85rem 5%;border-bottom:1px solid rgba(184,146,42,.08);transition:.2s}
.mob-menu .mob-cta{background:var(--gold);color:var(--navy)!important;margin:1rem 5%;text-align:center}
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
.hero-eyebrow{font-family:'Rajdhani',sans-serif;font-size:.72rem;letter-spacing:.3em;text-transform:uppercase;color:var(--goldL);margin-bottom:1.2rem;display:flex;align-items:center;gap:12px}
.hero-eyebrow::before,.hero-eyebrow::after{content:'';display:block;height:1px;width:28px;background:var(--gold)}
.hero h1{font-size:clamp(3rem,5.5vw,4.8rem);line-height:1.03;letter-spacing:-.01em;margin-bottom:1.5rem;font-weight:600}
.hero h1 em{color:var(--goldL);font-style:italic}
.hero h1 span{display:block;font-size:clamp(1.8rem,3.2vw,2.8rem);color:rgba(248,243,232,.45);font-weight:400}
.hero p{max-width:520px;color:rgba(248,243,232,.65);line-height:1.9;font-size:1rem;margin-bottom:2rem}
.hero-btns{display:flex;gap:.85rem;flex-wrap:wrap;margin-bottom:2.5rem}
.btn{display:inline-flex;align-items:center;gap:.45rem;font-family:'Rajdhani',sans-serif;font-weight:700;letter-spacing:.1em;text-transform:uppercase;font-size:.8rem;padding:.82rem 1.7rem;cursor:pointer;transition:.2s;border:none}
.btn-gold{background:var(--gold);color:var(--navy)}
.btn-gold:hover{background:var(--goldL);transform:translateY(-1px);box-shadow:0 6px 20px rgba(184,146,42,.4)}
.btn-out{background:transparent;border:1px solid rgba(248,243,232,.3);color:var(--cream)}
.btn-out:hover{border-color:var(--goldL);color:var(--goldL)}
.btn-wa{background:rgba(37,211,102,.1);border:1px solid rgba(37,211,102,.3);color:#4AE382}
.btn-wa:hover{background:rgba(37,211,102,.2)}
.btn-grn{background:var(--green);color:#fff}
.btn-grn:hover{background:#1e7a34;transform:translateY(-1px)}
.stats-bar{display:flex;border-top:1px solid rgba(184,146,42,.2);padding-top:1.8rem;flex-wrap:wrap;gap:1rem}
.stat-item{padding-right:1.8rem;border-right:1px solid rgba(184,146,42,.18)}
.stat-item:last-child{border:none;padding:0}
.stat-item strong{display:block;font-family:'EB Garamond',serif;font-size:2rem;color:var(--goldL);line-height:1}
.stat-item span{font-size:.62rem;color:rgba(248,243,232,.38);letter-spacing:.12em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;font-weight:600}

/* COUNTER animation */
.count-up{display:inline-block}

/* LIVE DASH */
.dash-panel{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.25);overflow:hidden;transition:.2s}
.dash-panel:hover{border-color:rgba(184,146,42,.4)}
.dash-hd{background:rgba(11,31,58,.8);border-bottom:1px solid rgba(184,146,42,.2);padding:.9rem 1.3rem;display:flex;align-items:center;justify-content:space-between}
.dash-hd-title{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.7rem;letter-spacing:.2em;text-transform:uppercase;color:var(--goldL)}
.live-dot{display:flex;align-items:center;gap:6px;font-size:.62rem;color:rgba(248,243,232,.35);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase}
.dot{width:6px;height:6px;border-radius:50%;background:#4AE382;animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(74,227,130,.4)}50%{opacity:.6;box-shadow:0 0 0 4px rgba(74,227,130,0)}}
.dash-kpi{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:1px solid rgba(184,146,42,.1)}
.kpi{padding:1.1rem .8rem;text-align:center;border-right:1px solid rgba(184,146,42,.08);transition:.2s}
.kpi:hover{background:rgba(184,146,42,.05)}
.kpi:last-child{border:none}
.kpi strong{display:block;font-family:'EB Garamond',serif;font-size:1.5rem;color:var(--goldLL);line-height:1}
.kpi span{font-size:.58rem;color:rgba(248,243,232,.35);text-transform:uppercase;letter-spacing:.1em;font-family:'Rajdhani',sans-serif;font-weight:600}
.dash-body{padding:.9rem 1.3rem}
.dash-row{display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid rgba(184,146,42,.07);font-size:.78rem;transition:.15s}
.dash-row:hover{padding-left:.3rem}
.dash-row:last-child{border:none}
.dash-row span{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif}
.dash-row strong{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-weight:600}
.lpulse{opacity:.4;animation:lpulse 1.5s ease-in-out infinite}
@keyframes lpulse{0%,100%{opacity:.4}50%{opacity:.8}}

/* SECTIONS */
section.pad{padding:5rem 0}
section.pad-alt{padding:5rem 0;background:var(--cream)}
.eyebrow{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.68rem;letter-spacing:.3em;text-transform:uppercase;color:var(--goldD);margin-bottom:.7rem;display:flex;align-items:center;gap:10px}
.eyebrow::before{content:'';width:22px;height:1px;background:var(--gold)}
h2.st{font-size:clamp(1.9rem,3vw,2.6rem);color:var(--navy);margin-bottom:.8rem}
.rule{display:flex;align-items:center;gap:12px;margin-bottom:1.5rem}
.rule-line{height:1px;flex:1;background:linear-gradient(90deg,var(--gold),transparent)}
.rule-d{width:7px;height:7px;border:2px solid var(--gold);transform:rotate(45deg);flex-shrink:0}

/* RIBBON — animated counters */
.ribbon{background:var(--cream);border-top:3px solid var(--gold);border-bottom:1px solid var(--creamDD);padding:2.2rem 5%}
.ribbon-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1.2rem;text-align:center}
.ribbon-stat{transition:.2s;cursor:default}
.ribbon-stat:hover strong{color:var(--goldD)}
.ribbon-stat strong{display:block;font-family:'EB Garamond',serif;font-size:2.4rem;color:var(--navy);line-height:1;transition:.3s}
.ribbon-stat span{font-size:.62rem;color:var(--mist);letter-spacing:.1em;text-transform:uppercase;font-family:'Rajdhani',sans-serif;font-weight:600}

/* ABOUT */
.about-grid{display:grid;grid-template-columns:1fr 1fr;gap:5rem;align-items:start}
.about-text p{color:var(--slate);line-height:1.9;margin-bottom:1.3rem;font-size:.97rem}
.feat-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:1.4rem}
.tile{padding:.9rem 1rem;border:1px solid var(--creamDD);border-left:3px solid var(--gold);background:var(--white);transition:.25s;cursor:default}
.tile:hover{border-left-color:var(--goldL);transform:translateX(4px);box-shadow:4px 0 12px rgba(184,146,42,.1)}
.tile strong{display:block;color:var(--navy);font-size:.85rem;margin:.25rem 0 .12rem;font-family:'Rajdhani',sans-serif;font-weight:600;letter-spacing:.04em}
.tile span{color:var(--mist);font-size:.7rem}
.bar-block{margin-bottom:1.3rem}
.bar-label{display:flex;justify-content:space-between;margin-bottom:6px;font-size:.8rem}
.bar-label span{color:var(--slate)}
.bar-label strong{color:var(--navy);font-family:'EB Garamond',serif;font-size:.98rem}
.bar-track{height:4px;background:var(--creamDD);overflow:hidden;border-radius:2px}
.bar-fill{height:100%;width:0;transition:width 1.4s cubic-bezier(.25,.46,.45,.94);border-radius:2px}

/* FOUNDER */
.founder-grid{display:grid;grid-template-columns:.45fr .55fr;gap:4rem;align-items:center}
.founder-img{width:100%;aspect-ratio:3/4;background:linear-gradient(135deg,var(--creamDD),var(--creamD));border:3px solid var(--creamD);display:flex;align-items:center;justify-content:center;color:var(--mist);font-family:'Rajdhani',sans-serif;font-size:.75rem;letter-spacing:.12em;text-transform:uppercase;position:relative;overflow:hidden}
.founder-img img{width:100%;height:100%;object-fit:cover}
.founder-img-badge{position:absolute;bottom:1.2rem;left:1.2rem;right:1.2rem;background:rgba(11,31,58,.92);border:1px solid rgba(184,146,42,.35);padding:.8rem 1rem;backdrop-filter:blur(8px)}
.founder-img-badge h4{color:var(--cream);font-size:1.1rem;margin-bottom:.15rem}
.founder-img-badge span{color:var(--goldL);font-family:'Rajdhani',sans-serif;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase}
.founder-quote{font-family:'EB Garamond',serif;font-size:1.25rem;color:var(--navy);line-height:1.75;font-style:italic;border-left:4px solid var(--gold);padding-left:1.4rem;margin-bottom:1.5rem;position:relative}
.founder-quote::before{content:'"';position:absolute;left:-.5rem;top:-.8rem;font-size:4rem;color:var(--gold);opacity:.15;font-family:'EB Garamond',serif;line-height:1}
.founder-body p{color:var(--slate);line-height:1.9;margin-bottom:1rem;font-size:.95rem}
.founder-sig{font-family:'EB Garamond',serif;font-size:1.3rem;color:var(--navy);margin-top:1.5rem}
.founder-sig span{display:block;font-family:'Rajdhani',sans-serif;font-size:.7rem;color:var(--mist);letter-spacing:.1em;text-transform:uppercase;font-style:normal;margin-top:.2rem}

/* FACULTY */
.faculty-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1.2rem}
.faculty-card{background:var(--white);border:1px solid var(--creamDD);padding:1.5rem;text-align:center;transition:.25s;position:relative;overflow:hidden}
.faculty-card::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(184,146,42,.03),transparent);opacity:0;transition:.25s}
.faculty-card:hover{border-color:var(--gold);transform:translateY(-4px);box-shadow:0 12px 32px rgba(184,146,42,.12)}
.faculty-card:hover::before{opacity:1}
.faculty-photo{width:80px;height:80px;border-radius:50%;background:var(--creamDD);border:3px solid var(--gold);margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.6rem;color:var(--goldL);overflow:hidden;transition:.25s}
.faculty-card:hover .faculty-photo{border-color:var(--goldL);box-shadow:0 0 0 4px rgba(184,146,42,.15)}
.faculty-photo img{width:100%;height:100%;object-fit:cover}
.faculty-card h3{color:var(--navy);font-size:1.05rem;margin-bottom:.25rem}
.faculty-card .role{color:var(--goldD);font-family:'Rajdhani',sans-serif;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;margin-bottom:.4rem}
.faculty-card .subj{color:var(--slate);font-size:.82rem}
.faculty-card .exp{font-family:'Rajdhani',sans-serif;font-size:.65rem;letter-spacing:.08em;text-transform:uppercase;color:var(--mist);margin-top:.4rem}

/* COURSES */
.courses-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:1.2rem}
.course-card{background:var(--white);border:1px solid var(--creamDD);border-top:4px solid var(--navy3);padding:1.6rem;transition:.25s;position:relative;overflow:hidden}
.course-card.sainik{border-top-color:var(--red)}
.course-card.navodaya{border-top-color:var(--navy3)}
.course-card.foundation{border-top-color:var(--green)}
.course-card.combined{border-top-color:var(--gold)}
.course-card:hover{transform:translateY(-5px);box-shadow:0 16px 40px rgba(11,31,58,.14)}
.course-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;padding:.2rem .65rem;margin-bottom:.9rem}
.cb-sainik{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.2)}
.cb-nv{background:rgba(21,53,97,.1);color:var(--navy3);border:1px solid rgba(21,53,97,.2)}
.cb-fn{background:rgba(26,92,42,.1);color:var(--green);border:1px solid rgba(26,92,42,.2)}
.cb-co{background:rgba(184,146,42,.1);color:var(--goldD);border:1px solid rgba(184,146,42,.2)}
.course-card h3{color:var(--navy);font-size:1.2rem;margin-bottom:.3rem}
.course-card .sub{color:var(--slate);font-size:.82rem;margin-bottom:1rem}
.course-features{list-style:none;margin-bottom:1.2rem}
.course-features li{color:var(--slate);font-size:.84rem;padding:.3rem 0;border-bottom:1px solid var(--creamDD);display:flex;align-items:center;gap:.5rem}
.course-features li::before{content:'✓';color:var(--green);font-weight:700;font-size:.8rem;flex-shrink:0}
.course-enquire{display:block;width:100%;padding:.6rem;background:var(--cream);border:1px solid var(--creamDD);color:var(--navy);font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:.2s;text-align:center}
.course-enquire:hover{background:var(--gold);border-color:var(--gold);color:var(--navy)}
.fee-note{color:var(--mist);font-size:.72rem;font-family:'Rajdhani',sans-serif;text-align:center;margin-top:.4rem;letter-spacing:.04em}

/* NOTICES */
.cards-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:1rem}
.notice-card{background:var(--white);border:1px solid var(--creamDD);border-top:3px solid var(--navy3);padding:1.3rem 1.4rem;transition:.25s}
.notice-card:hover{box-shadow:0 8px 24px rgba(11,31,58,.1);transform:translateY(-2px)}
.notice-card.urgent{border-top-color:var(--red)}
.notice-card.success{border-top-color:var(--green)}
.notice-badge{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.14em;text-transform:uppercase;padding:.2rem .65rem;margin-bottom:.7rem}
.badge-open{background:#E8F4ED;color:var(--green)}
.badge-weekly{background:#EDF2F8;color:var(--navy3)}
.badge-limited{background:#FDF0E8;color:var(--saffron)}
.notice-card h3{font-size:1.1rem;color:var(--navy);margin-bottom:.5rem}
.notice-card p{color:var(--slate);font-size:.85rem;line-height:1.7}
.notice-date{font-size:.65rem;color:var(--mist);font-family:'Rajdhani',sans-serif;letter-spacing:.08em;text-transform:uppercase;margin-top:.7rem}

/* RESULTS */
.result-card{background:var(--white);border:1px solid var(--creamDD);padding:1.3rem 1.4rem;display:flex;gap:1.3rem;align-items:flex-start;transition:.25s}
.result-card:hover{box-shadow:0 6px 20px rgba(11,31,58,.1);transform:translateY(-2px)}
.year-badge{background:var(--navy);color:var(--goldLL);font-family:'EB Garamond',serif;font-size:1.5rem;padding:.65rem .9rem;text-align:center;white-space:nowrap;flex-shrink:0;line-height:1}
.year-badge small{display:block;font-family:'Rajdhani',sans-serif;font-size:.58rem;letter-spacing:.12em;text-transform:uppercase;color:var(--goldL);margin-top:4px}
.result-body h3{font-size:1rem;color:var(--navy);margin-bottom:.4rem}
.result-body p{color:var(--slate);font-size:.85rem;line-height:1.7}
.result-number{font-family:'EB Garamond',serif;font-size:2rem;color:var(--gold);float:right;line-height:1}

/* ALUMNI */
.alumni-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem}
.alumni-card{background:var(--white);border:1px solid var(--creamDD);padding:1.3rem;text-align:center;transition:.25s}
.alumni-card:hover{border-color:var(--gold);transform:translateY(-3px);box-shadow:0 8px 20px rgba(184,146,42,.1)}
.alumni-avatar{width:64px;height:64px;border-radius:50%;background:var(--navy);border:2px solid var(--gold);margin:0 auto .9rem;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.3rem;color:var(--goldL)}
.alumni-card h4{color:var(--navy);font-size:1rem;margin-bottom:.2rem}
.alumni-card .ach{color:var(--green);font-family:'Rajdhani',sans-serif;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;font-weight:700;margin-bottom:.2rem}
.alumni-card .yr{color:var(--mist);font-size:.72rem;font-family:'Rajdhani',sans-serif}

/* TESTIMONIALS */
.testi-wrap{overflow:hidden;position:relative}
.testi-track{display:flex;transition:transform .6s cubic-bezier(.25,.46,.45,.94)}
.testi-card{min-width:100%;padding:2.2rem;background:var(--white);border:1px solid var(--creamDD);border-left:4px solid var(--gold);position:relative}
.testi-card blockquote{font-family:'EB Garamond',serif;font-size:1.15rem;color:var(--navy);line-height:1.8;font-style:italic;margin-bottom:1rem}
.testi-card cite{font-style:normal;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--goldD)}
.testi-card .stars{color:var(--gold);font-size:.95rem;margin-bottom:.7rem;letter-spacing:.1em}
.slider-ctrl{display:flex;align-items:center;gap:1rem;margin-top:1.2rem}
.slider-btn{width:36px;height:36px;border:1px solid var(--gold);background:transparent;color:var(--gold);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:.9rem;transition:.2s}
.slider-btn:hover{background:var(--gold);color:var(--navy)}
.slider-dots{display:flex;gap:6px}
.slider-dot{width:7px;height:7px;border-radius:50%;background:var(--creamDD);border:1px solid var(--mist);cursor:pointer;transition:.2s}
.slider-dot.active{background:var(--gold);border-color:var(--gold)}

/* GALLERY */
.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.gcell{background:var(--creamDD);aspect-ratio:4/3;position:relative;overflow:hidden;cursor:pointer}
.gcell:hover .gcell-lbl{background:rgba(184,146,42,.85);color:var(--navy)}
.gcell:hover img{transform:scale(1.05)}
.gcell-lbl{position:absolute;bottom:0;left:0;right:0;background:rgba(11,31,58,.75);color:var(--goldLL);font-family:'Rajdhani',sans-serif;font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;padding:.38rem .65rem;transition:.25s}
.gcell img{width:100%;height:100%;object-fit:cover;transition:transform .4s ease}

/* EVENTS */
.event-card{background:var(--white);border:1px solid var(--creamDD);padding:1.1rem 1.3rem;display:flex;gap:1.1rem;align-items:center;transition:.25s}
.event-card:hover{border-color:var(--gold);box-shadow:0 4px 16px rgba(11,31,58,.08);transform:translateX(4px)}
.event-date-block{text-align:center;min-width:48px;border-right:1px solid var(--creamDD);padding-right:1.1rem}
.event-date-block .day{font-family:'EB Garamond',serif;font-size:1.9rem;color:var(--navy);line-height:1}
.event-date-block .month{font-family:'Rajdhani',sans-serif;font-size:.62rem;letter-spacing:.12em;text-transform:uppercase;color:var(--mist)}
.event-body h3{font-size:.97rem;color:var(--navy);margin-bottom:.25rem}
.event-body span{font-size:.8rem;color:var(--slate)}

/* FAQ */
.faq{border-top:1px solid var(--creamDD)}
.faq-item{border-bottom:1px solid var(--creamDD)}
.faq-q{font-family:'EB Garamond',serif;font-size:1.05rem;color:var(--navy);cursor:pointer;display:flex;justify-content:space-between;gap:1rem;padding:1rem 0;transition:.2s}
.faq-q:hover{color:var(--goldD)}
.faq-icon{width:22px;height:22px;border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;color:var(--gold);font-size:.78rem;flex-shrink:0;transition:.25s}
.faq-a{display:none;color:var(--slate);line-height:1.85;padding-bottom:1rem;font-size:.92rem;animation:fadedown .25s ease}
@keyframes fadedown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}

/* ENQUIRY */
.enquiry-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:2.5rem}
.form-panel{background:var(--cream);border:1px solid var(--creamDD);padding:1.8rem}
label.fl{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:var(--slate);margin-bottom:.38rem}
input.ff,select.ff,textarea.ff{width:100%;padding:11px 15px;border:1px solid var(--creamDD);background:var(--white);color:var(--navy);font-size:.9rem;font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1.1rem;transition:.2s}
input.ff:focus,select.ff:focus,textarea.ff:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}
textarea.ff{min-height:100px;resize:vertical}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.contact-card{background:var(--white);border:1px solid var(--creamDD);border-left:4px solid var(--gold);padding:1.2rem 1.3rem;margin-bottom:.9rem;transition:.2s}
.contact-card:hover{box-shadow:4px 0 12px rgba(184,146,42,.1)}
.contact-card h3{color:var(--navy);margin-bottom:.5rem;font-size:1.05rem}
.contact-card p{color:var(--slate);font-size:.87rem;line-height:1.8}
.form-msg{padding:.7rem 1rem;margin-bottom:1rem;font-size:.82rem;font-family:'Rajdhani',sans-serif;display:none}
.form-msg.success{background:#E8F4ED;color:var(--green);border:1px solid rgba(26,92,42,.3)}
.form-msg.error{background:rgba(139,26,26,.1);color:var(--red);border:1px solid rgba(139,26,26,.3)}

/* SOCIAL */
.social-strip{display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap}
.soc-btn{display:inline-flex;align-items:center;gap:.5rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1rem;border:1px solid;transition:.2s}
.soc-fb{border-color:#1877F2;color:#1877F2}
.soc-fb:hover{background:#1877F2;color:#fff}
.soc-yt{border-color:#FF0000;color:#FF0000}
.soc-yt:hover{background:#FF0000;color:#fff}
.soc-ig{border-color:#E1306C;color:#E1306C}
.soc-ig:hover{background:#E1306C;color:#fff}

/* CTA */
.cta-block{background:var(--navy);color:var(--cream);text-align:center;padding:4.5rem 5%;position:relative;overflow:hidden}
.cta-block::before{content:'';position:absolute;inset:0;opacity:.03;background-image:repeating-linear-gradient(45deg,var(--gold) 0,var(--gold) 1px,transparent 0,transparent 32px)}
.cta-block h2{font-size:2.5rem;margin-bottom:1rem;position:relative}
.cta-block p{max-width:620px;margin:0 auto 2rem;color:rgba(248,243,232,.6);line-height:1.85;position:relative}

/* FOOTER */
footer{background:var(--navy2);color:rgba(248,243,232,.8);border-top:1px solid rgba(184,146,42,.2);padding:3.5rem 5% 2rem}
.footer-grid{width:min(1200px,100%);margin:auto;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:2rem;margin-bottom:2rem}
footer h4{color:var(--cream);font-family:'EB Garamond',serif;font-size:1.05rem;margin-bottom:.9rem}
footer a{display:block;margin-bottom:.55rem;color:rgba(248,243,232,.6);font-size:.85rem;transition:.2s}
footer a:hover{color:var(--goldL);padding-left:4px}
.foot-social{display:flex;gap:.6rem;margin-top:.6rem}
.foot-soc-icon{width:32px;height:32px;border:1px solid rgba(184,146,42,.25);display:flex;align-items:center;justify-content:center;color:rgba(248,243,232,.4);font-size:.8rem;transition:.2s;font-weight:700;font-family:'Rajdhani',sans-serif}
.foot-soc-icon:hover{border-color:var(--goldL);color:var(--goldL);background:rgba(184,146,42,.1)}
.footer-bottom{border-top:1px solid rgba(184,146,42,.1);padding-top:1.4rem;display:flex;justify-content:space-between;align-items:center;font-size:.72rem;color:rgba(248,243,232,.3);font-family:'Rajdhani',sans-serif;letter-spacing:.06em;flex-wrap:wrap;gap:.5rem}
.footer-tricolor{display:flex;gap:3px;height:3px;width:44px}
.footer-tricolor div{flex:1}
.footer-tricolor div:nth-child(1){background:var(--saffron)}
.footer-tricolor div:nth-child(2){background:#fff}
.footer-tricolor div:nth-child(3){background:var(--green)}

/* LAZY MAP */
.map-wrap{position:relative;width:100%;height:240px;background:var(--creamDD);border:1px solid var(--creamDD);overflow:hidden;cursor:pointer}
.map-placeholder{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.6rem;background:var(--creamDD)}
.map-placeholder span{font-family:'Rajdhani',sans-serif;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase;color:var(--mist)}
.map-load-btn{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;padding:.5rem 1.2rem;background:var(--navy);color:var(--goldL);border:1px solid rgba(184,146,42,.3);cursor:pointer;transition:.2s}
.map-load-btn:hover{background:var(--navy2)}
.map-frame{width:100%;height:100%;border:0}

/* WA FLOAT with tooltip */
#waFloat{position:fixed;bottom:5.5rem;right:1.5rem;z-index:995;width:50px;height:50px;background:var(--wa);border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 18px rgba(37,211,102,.4);cursor:pointer;animation:wab 2.5s ease-in-out infinite;text-decoration:none}
#waFloat:hover{animation:none;transform:scale(1.1)}
#waFloat svg{width:25px;height:25px;fill:#fff}
#waFloat .wa-tooltip{position:absolute;right:60px;background:var(--navy);color:var(--cream);font-family:'Rajdhani',sans-serif;font-size:.72rem;letter-spacing:.06em;padding:.4rem .8rem;white-space:nowrap;border:1px solid rgba(184,146,42,.3);pointer-events:none;opacity:0;transition:.2s;border-radius:2px}
#waFloat:hover .wa-tooltip{opacity:1}
@keyframes wab{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}

/* PP OVERLAY */
.pp-overlay{display:none;position:fixed;inset:0;z-index:2000;overflow-y:auto;background:rgba(11,31,58,.98)}.pp-overlay.open{display:block}
.pp-login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem;position:relative}
.pp-close{position:absolute;top:1rem;right:1rem;background:none;border:1px solid rgba(184,146,42,.3);color:var(--goldL);width:36px;height:36px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;transition:.2s}
.pp-close:hover{background:rgba(184,146,42,.1)}
.pp-box{background:rgba(15,42,78,.9);border:1px solid rgba(184,146,42,.3);padding:2.4rem;width:100%;max-width:410px}
.pp-logo{text-align:center;margin-bottom:1.8rem}
.pp-logo h2{color:var(--cream);font-size:1.5rem;margin-bottom:.25rem}
.pp-logo p{color:rgba(248,243,232,.4);font-size:.78rem;font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase}
.pp-fl{display:block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.66rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(248,243,232,.45);margin-bottom:.38rem}
.pp-fi{width:100%;padding:12px 15px;background:rgba(255,255,255,.06);border:1px solid rgba(184,146,42,.22);color:var(--cream);font-size:.92rem;font-family:'Source Sans 3',sans-serif;outline:none;margin-bottom:1.1rem;transition:.2s}
.pp-fi:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(184,146,42,.1)}
.pp-fi::placeholder{color:rgba(248,243,232,.22)}
.pp-lbtn{width:100%;padding:13px;background:var(--gold);color:var(--navy);border:none;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.88rem;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:.2s;margin-top:.3rem}
.pp-lbtn:hover{background:var(--goldL)}
.pp-lbtn:disabled{opacity:.5;cursor:not-allowed}
.pp-err{background:rgba(139,26,26,.3);border:1px solid rgba(139,26,26,.5);color:#f87171;font-size:.8rem;padding:.75rem 1rem;margin-bottom:1rem;font-family:'Rajdhani',sans-serif;display:none}
.pp-shell{min-height:100vh;display:flex;flex-direction:column;background:var(--navy);display:none}.pp-shell.show{display:flex}
.pp-topbar{background:rgba(11,31,58,.95);border-bottom:1px solid rgba(184,146,42,.22);padding:.85rem 1.3rem;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10}
.pp-topbar-l{display:flex;align-items:center;gap:.9rem}
.pp-topbar h3{font-family:'Rajdhani',sans-serif;font-weight:700;color:var(--cream);font-size:.97rem;letter-spacing:.1em;text-transform:uppercase}
.pp-topbar p{color:rgba(248,243,232,.38);font-size:.68rem;font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase}
.pp-lout{background:rgba(139,26,26,.3);border:1px solid rgba(139,26,26,.4);color:#f87171;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;padding:.45rem .9rem;cursor:pointer}
.pp-tabs{background:rgba(15,42,78,.5);border-bottom:1px solid rgba(184,146,42,.13);display:flex;overflow-x:auto;scrollbar-width:none}.pp-tabs::-webkit-scrollbar{display:none}
.pp-tab{flex-shrink:0;padding:.8rem 1.3rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:rgba(248,243,232,.38);cursor:pointer;border-bottom:2px solid transparent;transition:.2s;border:none;background:none}
.pp-tab.active{color:var(--goldL);border-bottom-color:var(--gold)}
.pp-content{flex:1;padding:1.4rem;max-width:880px;margin:0 auto;width:100%}
.stu-hdr{background:rgba(21,53,97,.6);border:1px solid rgba(184,146,42,.22);padding:1.3rem 1.5rem;margin-bottom:1.3rem;display:flex;align-items:center;gap:1.3rem}
.stu-av{width:54px;height:54px;background:rgba(184,146,42,.15);border:2px solid var(--gold);border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'EB Garamond',serif;font-size:1.4rem;color:var(--goldL);flex-shrink:0}
.stu-info h3{color:var(--cream);font-size:1.15rem;margin-bottom:.2rem}
.stu-info p{color:rgba(248,243,232,.4);font-family:'Rajdhani',sans-serif;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase}
.stu-badges{display:flex;gap:.4rem;margin-top:.35rem;flex-wrap:wrap}
.stu-badge{background:rgba(184,146,42,.13);border:1px solid rgba(184,146,42,.28);color:var(--goldLL);font-family:'Rajdhani',sans-serif;font-size:.6rem;letter-spacing:.1em;text-transform:uppercase;padding:.18rem .55rem}
.pp-sec{display:none}.pp-sec.active{display:block}
.pp-card{background:rgba(21,53,97,.4);border:1px solid rgba(184,146,42,.16);margin-bottom:1rem}
.pp-card-hd{padding:.85rem 1.1rem;border-bottom:1px solid rgba(184,146,42,.1);display:flex;justify-content:space-between;align-items:center}
.pp-card-title{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.72rem;letter-spacing:.15em;text-transform:uppercase;color:var(--goldL)}
.pp-card-body{padding:.95rem 1.1rem}
.att-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(34px,1fr));gap:4px;margin-bottom:1rem}
.att-day{width:34px;height:34px;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:.68rem;font-family:'Rajdhani',sans-serif;font-weight:700}
.att-p{background:rgba(26,92,42,.4);border:1px solid rgba(26,92,42,.55);color:#4AE382}
.att-a{background:rgba(139,26,26,.4);border:1px solid rgba(139,26,26,.55);color:#f87171}
.att-h{background:rgba(61,79,107,.35);border:1px solid rgba(61,79,107,.4);color:var(--mist)}
.att-sum{display:grid;grid-template-columns:repeat(3,1fr);gap:.6rem}
.att-si{background:rgba(11,31,58,.5);padding:.65rem;text-align:center}
.att-si strong{display:block;font-family:'EB Garamond',serif;font-size:1.5rem;line-height:1;margin-bottom:.15rem}
.att-si span{font-size:.6rem;font-family:'Rajdhani',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:rgba(248,243,232,.35)}
.att-si.p strong{color:#4AE382}.att-si.a strong{color:#f87171}.att-si.pct strong{color:var(--goldLL)}
.pp-table{width:100%;border-collapse:collapse;font-size:.82rem}
.pp-table th{background:rgba(11,31,58,.6);padding:.65rem .9rem;text-align:left;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:var(--goldL);border-bottom:1px solid rgba(184,146,42,.13)}
.pp-table td{padding:.65rem .9rem;border-bottom:1px solid rgba(184,146,42,.07);color:rgba(248,243,232,.72)}
.pp-table tr:last-child td{border:none}.pp-table tr:hover td{background:rgba(184,146,42,.04)}
.sc-hi{background:rgba(26,92,42,.35);color:#4AE382;border:1px solid rgba(26,92,42,.4);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.7rem}
.sc-mi{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.7rem}
.sc-lo{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38);display:inline-block;padding:.12rem .45rem;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.7rem}
.pp-ni{padding:.9rem 0;border-bottom:1px solid rgba(184,146,42,.09)}.pp-ni:last-child{border:none}
.pp-npri{display:inline-block;font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.6rem;letter-spacing:.12em;text-transform:uppercase;padding:.14rem .5rem;margin-bottom:.45rem}
.pri-h{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38)}
.pri-m{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28)}
.pri-l{background:rgba(61,79,107,.35);color:var(--mist);border:1px solid rgba(61,79,107,.45)}
.pp-ntitle{color:var(--cream);font-size:.97rem;margin-bottom:.35rem}
.pp-nbody{color:rgba(248,243,232,.52);font-size:.82rem;line-height:1.7}
.pp-ndate{color:rgba(248,243,232,.28);font-size:.65rem;font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase;margin-top:.35rem}
.leave-item{padding:.95rem;background:rgba(11,31,58,.4);border:1px solid rgba(184,146,42,.1);margin-bottom:.55rem}
.leave-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:.45rem}
.ls{font-family:'Rajdhani',sans-serif;font-weight:700;font-size:.62rem;letter-spacing:.1em;text-transform:uppercase;padding:.18rem .55rem}
.ls-ap{background:rgba(26,92,42,.38);color:#4AE382;border:1px solid rgba(26,92,42,.48)}
.ls-pe{background:rgba(184,146,42,.18);color:var(--goldLL);border:1px solid rgba(184,146,42,.28)}
.ls-re{background:rgba(139,26,26,.28);color:#f87171;border:1px solid rgba(139,26,26,.38)}
.leave-dates{color:rgba(248,243,232,.52);font-size:.8rem;margin-bottom:.28rem}
.leave-rsn{color:rgba(248,243,232,.38);font-size:.75rem;font-family:'Rajdhani',sans-serif}
.alert-item{padding:.75rem .95rem;background:rgba(11,31,58,.4);border-left:3px solid var(--goldL);margin-bottom:.45rem}
.alert-item.att{border-left-color:#f87171}.alert-item.exam{border-left-color:var(--goldLL)}.alert-item.notice{border-left-color:#4AE382}.alert-item.leave{border-left-color:var(--mist)}
.alert-msg{color:rgba(248,243,232,.72);font-size:.83rem;margin-bottom:.25rem}
.alert-meta{color:rgba(248,243,232,.28);font-size:.65rem;font-family:'Rajdhani',sans-serif;letter-spacing:.06em;text-transform:uppercase}
.pp-loading{display:flex;align-items:center;justify-content:center;padding:2.5rem;gap:.7rem;color:rgba(248,243,232,.28);font-family:'Rajdhani',sans-serif;letter-spacing:.1em;text-transform:uppercase;font-size:.75rem}
.spin{width:16px;height:16px;border:2px solid rgba(184,146,42,.28);border-top-color:var(--gold);border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0}
@keyframes spin{to{transform:rotate(360deg)}}
.pp-empty{text-align:center;padding:2.2rem;color:rgba(248,243,232,.28)}
.pp-empty-icon{font-size:2.2rem;margin-bottom:.6rem}
.pp-empty p{font-family:'Rajdhani',sans-serif;font-size:.75rem;letter-spacing:.1em;text-transform:uppercase}

@media(max-width:900px){
  .hero-wrap,.about-grid,.enquiry-grid,.founder-grid{grid-template-columns:1fr}
  .footer-grid{grid-template-columns:1fr 1fr}
  .nav-links{display:none}
  .hamburger{display:flex}
  .dash-panel{margin-top:2rem}
  .form-row{grid-template-columns:1fr}
  .gallery-grid{grid-template-columns:1fr 1fr}
  .result-card{flex-direction:column;gap:.7rem}
  .stu-hdr{flex-direction:column;text-align:center}
  #stickyBar p{display:none}
}
@media(max-width:520px){
  .footer-grid{grid-template-columns:1fr}
  .hero-btns{flex-direction:column}
  .courses-grid{grid-template-columns:1fr}
}
</style>
</head>
<body>
<div id="sp"></div>

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
      <li><a href="#results">Results</a></li>
      <li><a href="#faculty">Faculty</a></li>
      <li><a href="#about">About</a></li>
      <li><a href="#enquiry">Enquire</a></li>
      <li><a href="#" onclick="openPP();return false;" class="nav-par">Parents →</a></li>
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
  <a href="#faculty" onclick="closeMob()">Faculty</a>
  <a href="#about" onclick="closeMob()">About</a>
  <a href="#enquiry" onclick="closeMob()">Enquire</a>
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
      <h1><em>Forge Discipline.</em><span>Command Excellence.</span></h1>
      <p>Guidance Navodaya &amp; Sainik Institute — Manipur's premier residential coaching centre for NVS, Sainik School, and RMS entrance examinations. Over <strong>200 commissioned officers</strong> shaped in a decade of service to the nation.</p>
      <div class="hero-btns">
        <a href="#enquiry" class="btn btn-gold">Enquire for Admission →</a>
        <button onclick="openPP()" class="btn btn-grn">Parents Portal →</button>
        <a href="https://wa.me/918974298074?text=Hello%2C+I+am+enquiring+about+GNSI+admissions" class="btn btn-wa" target="_blank">WhatsApp Us</a>
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

<!-- RIBBON with animated counters -->
<div class="ribbon">
  <div class="ribbon-grid">
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="10" data-suffix="+">10+</span></strong><span>Years of Excellence</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="500" data-suffix="+">500+</span></strong><span>Students Trained</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="95" data-suffix="%">95%</span></strong><span>Selection Rate</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="200" data-suffix="+">200+</span></strong><span>Officers Produced</span></div>
    <div class="ribbon-stat reveal"><strong><span class="count-up" data-target="15" data-suffix="+">15+</span></strong><span>ERP Modules</span></div>
  </div>
</div>

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
    <p style="color:var(--slate);margin-bottom:2rem;max-width:560px;line-height:1.85" class="reveal">Structured pathways from foundation to championship level — designed to maximise selection probability at India's finest schools.</p>
    <div class="courses-grid">
      <div class="course-card sainik reveal-scale"><div class="course-badge cb-sainik">Sainik School</div><h3>Sainik Preparation</h3><p class="sub">AISSEE · Class 6 & Class 9 entry</p><ul class="course-features"><li>Achiever — Foundation level</li><li>Leader — Intermediate level</li><li>Champion — Advanced level</li><li>Physical fitness training</li><li>Interview preparation</li><li>Hostel & day scholar options</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
      <div class="course-card navodaya reveal-scale"><div class="course-badge cb-nv">Navodaya · NVS</div><h3>Navodaya Preparation</h3><p class="sub">JNVST · Class 6 & Class 9 entry</p><ul class="course-features"><li>Lakshya — Intensive programme</li><li>Umeed — Foundational track</li><li>Mental ability & language focus</li><li>Weekly mock tests</li><li>Previous year paper analysis</li><li>Hostel & day scholar options</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
      <div class="course-card foundation reveal-scale"><div class="course-badge cb-fn">Foundation</div><h3>Foundation Programme</h3><p class="sub">School readiness & competitive prep</p><ul class="course-features"><li>Elite — High-performance track</li><li>Prime — Standard track</li><li>Mathematics & English focus</li><li>Study habit building</li><li>Discipline-first environment</li><li>Day scholar option available</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
      <div class="course-card combined reveal-scale"><div class="course-badge cb-co">Combined</div><h3>Combined Course</h3><p class="sub">NVS + Sainik dual preparation</p><ul class="course-features"><li>Covers both JNVST & AISSEE</li><li>Maximises selection chances</li><li>Integrated timetable</li><li>Dedicated subject teachers</li><li>Weekend booster classes</li><li>Hostel & day scholar options</li></ul><button class="course-enquire" onclick="document.getElementById('enquiry').scrollIntoView({behavior:'smooth'})">Enquire for This Course →</button><div class="fee-note">Fee details shared on enquiry</div></div>
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
      <p style="color:var(--slate);line-height:1.9;margin-bottom:1rem;font-size:.95rem">GNSI was established in 2016 with a simple conviction: students from Manipur deserve the same calibre of preparation as those in metro cities. In a decade, we have grown from a single classroom to a full residential campus — producing over 200 officers and achievers.</p>
      <p style="color:var(--slate);line-height:1.9;margin-bottom:1rem;font-size:.95rem">Our approach is not just academic. We build character, discipline, and resilience — the qualities that Navodaya and Sainik School demand, and that life rewards.</p>
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

<!-- ALUMNI -->
<section class="pad" id="alumni">
  <div class="container">
    <div class="eyebrow reveal">Success Stories</div>
    <h2 class="st reveal">Where Our Alumni Are Today</h2>
    <div class="rule reveal"><div class="rule-line"></div><div class="rule-d"></div><div class="rule-line"></div></div>
    <div class="alumni-grid">
      <div class="alumni-card reveal"><div class="alumni-avatar">L</div><h4>GNSI Alumni</h4><div class="ach">Sainik School Tilaiya</div><div class="yr">Batch 2022</div></div>
      <div class="alumni-card reveal"><div class="alumni-avatar">K</div><h4>GNSI Alumni</h4><div class="ach">NVS Jawahar Navodaya</div><div class="yr">Batch 2023</div></div>
      <div class="alumni-card reveal"><div class="alumni-avatar">R</div><h4>GNSI Alumni</h4><div class="ach">Sainik School Imphal</div><div class="yr">Batch 2023</div></div>
      <div class="alumni-card reveal"><div class="alumni-avatar">M</div><h4>GNSI Alumni</h4><div class="ach">RMS Selection</div><div class="yr">Batch 2024</div></div>
      <div class="alumni-card reveal"><div class="alumni-avatar">T</div><h4>GNSI Alumni</h4><div class="ach">NVS Class 9 Entry</div><div class="yr">Batch 2024</div></div>
      <div class="alumni-card reveal"><div class="alumni-avatar">S</div><h4>GNSI Alumni</h4><div class="ach">NDA Cadet</div><div class="yr">Alumni 2020</div></div>
    </div>
    <p style="color:var(--mist);font-size:.8rem;font-family:'Rajdhani',sans-serif;letter-spacing:.06em;margin-top:1.2rem;text-align:center" class="reveal">Names withheld for privacy · Contact institute for verified result letters</p>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="pad-alt">
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
      <span style="color:var(--mist);font-size:.78rem;font-family:'Rajdhani',sans-serif;letter-spacing:.06em">More photos on social media:</span>
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
      <div class="faq-item"><div class="faq-q">Does GNSI have any government recognition?<div class="faq-icon">+</div></div><div class="faq-a">GNSI is a registered coaching institute operating in Thoubal District, Manipur. Our results across NVS and Sainik School examinations speak to our standing in the region. Contact the institute for registration and documentation details.</div></div>
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
      <p style="color:var(--slate);margin-bottom:2rem;line-height:1.85" class="reveal">Send your details and our team will respond regarding courses, hostel availability, and the admission process.</p>
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
        </select>
        <label class="fl">Message</label>
        <textarea class="ff" id="fMsg" placeholder="Your question or message"></textarea>
        <button type="button" class="btn btn-gold" style="width:100%;justify-content:center" id="fBtn" onclick="submitEnquiry()">Submit Enquiry →</button>
        <p style="color:var(--mist);font-size:.72rem;font-family:'Rajdhani',sans-serif;margin-top:.6rem;text-align:center">Or call us directly: <a href="tel:+918974298074" style="color:var(--gold)">+91 89742 98074</a></p>
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
      <!-- LAZY MAP -->
      <div class="map-wrap reveal" id="mapWrap" onclick="loadMap()">
        <div class="map-placeholder" id="mapPlaceholder">
          <span>📍 Khangabok, Thoubal District, Manipur</span>
          <button class="map-load-btn">View on Map →</button>
        </div>
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
    <button onclick="openPP()" class="btn btn-grn">Parents Portal →</button>
    <a href="https://wa.me/918974298074" class="btn btn-wa" target="_blank">WhatsApp →</a>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <div class="footer-grid">
    <div>
      <h4>GNSI — Guidance Navodaya & Sainik Institute</h4>
      <p style="color:rgba(248,243,232,.55);line-height:1.85;font-size:.87rem;max-width:320px;margin-bottom:1rem">Residential coaching institution in Khangabok, Thoubal, Manipur — focused on NVS, Sainik School, and RMS entrance preparation. Established 2016.</p>
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
      <a href="#notices">Notice Board</a><a href="#courses">Courses</a><a href="#results">Results</a><a href="#faculty">Faculty</a><a href="#alumni">Alumni</a><a href="#gallery">Gallery</a><a href="#events">Events</a>
    </div>
    <div>
      <h4>Admissions</h4>
      <a href="#courses">Sainik School Prep</a><a href="#courses">Navodaya Prep</a><a href="#courses">Foundation Programme</a><a href="#courses">Combined Course</a><a href="#enquiry">Apply Now</a>
    </div>
    <div>
      <h4>Contact</h4>
      <a href="tel:+918974298074">+91 89742 98074</a>
      <a href="https://wa.me/918974298074" target="_blank" style="color:#4AE382">WhatsApp</a>
      <a href="#enquiry">Admission Enquiry</a>
      <a href="#" onclick="openPP();return false;" style="color:#4AE382">Parents Portal</a>
      <button onclick="window.parent.postMessage('gnsi-staff-login','*')" style="display:block;margin-bottom:.55rem;color:rgba(248,243,232,.6);font-size:.85rem;background:none;border:none;cursor:pointer;text-align:left;padding:0;font-family:inherit;transition:.2s">Staff Login</button>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Guidance Navodaya & Sainik Institute, Khangabok, Thoubal, Manipur</span>
    <span>Established 2016 · guidancekhangabok.in</span>
  </div>
</footer>

<!-- WA FLOAT with tooltip -->
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
// ═══ SUPABASE ═══
const SURL='${SUPA_URL}';
const SKEY='${SUPA_KEY}';
const sb=supabase.createClient(SURL,SKEY);
let ppStu=null;

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
    // live enquiry count this week
    const weekAgo=new Date(Date.now()-7*86400000).toISOString();
    const{count:enqC}=await sb.from('enquiries').select('*',{count:'exact',head:true}).gte('created_at',weekAgo);
    set('kpi-enq',(enqC??0)+' this week');
    const{data:nn}=await sb.from('notices').select('title').order('created_at',{ascending:false}).limit(1);
    if(nn&&nn[0]){const t=nn[0].title;set('kpi-notice',t.length>22?t.slice(0,22)+'…':t);}else set('kpi-notice','No notices');
    document.querySelectorAll('.lpulse').forEach(el=>el.classList.remove('lpulse'));
  }catch(e){console.warn('KPI:',e.message)}
}
loadKPIs();

// Load live notices
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

// Load gallery
async function loadGallery(){
  try{
    const{data}=await sb.from('website_gallery').select('image_url,caption,category').order('sort_order').limit(5);
    if(!data||!data.length)return;
    const grid=document.getElementById('galleryGrid');if(!grid)return;
    grid.innerHTML=data.map((img,i)=>\`
      <div class="gcell\${i===0?' style="grid-row:span 2;aspect-ratio:auto;min-height:280px"':''}">\${img.image_url?'<img src="'+img.image_url+'" alt="'+img.caption+'" loading="lazy">':''}<div class="gcell-lbl">\${img.caption||img.category||'Campus'}</div></div>
    \`).join('');
  }catch(e){}
}
loadGallery();

// Load faculty from DB
async function loadFaculty(){
  try{
    const{data}=await sb.from('website_faculty').select('*').order('sort_order').order('name').limit(8);
    if(!data||!data.length)return;
    const grid=document.getElementById('facultyGrid');if(!grid)return;
    grid.innerHTML=data.map(f=>\`
      <div class="faculty-card reveal">
        <div class="faculty-photo">\${f.photo_url?'<img src="'+f.photo_url+'" alt="'+f.name+'">':f.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
        <h3>\${f.name}</h3>
        <div class="role">\${f.role||''}</div>
        \${f.subject?'<div class="subj">'+f.subject+'</div>':''}
        \${f.experience?'<div class="exp">'+f.experience+'</div>':''}
      </div>
    \`).join('');
    grid.querySelectorAll('.reveal').forEach(el=>ro.observe(el));
  }catch(e){}
}
loadFaculty();

// ═══ HELPERS ═══
function set(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}
function fmtDate(d){if(!d)return'—';return new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});}

// ═══ LAZY MAP ═══
function loadMap(){
  const wrap=document.getElementById('mapWrap');
  const ph=document.getElementById('mapPlaceholder');
  if(ph)ph.remove();
  const iframe=document.createElement('iframe');
  iframe.src='https://maps.google.com/maps?q=Khangabok+Thoubal+Manipur&output=embed';
  iframe.className='map-frame';iframe.title='GNSI Campus Location';
  wrap.appendChild(iframe);
  wrap.style.cursor='default';
  wrap.onclick=null;
}

// ═══ NAV ═══
document.getElementById('hbg').addEventListener('click',function(){this.classList.toggle('open');document.getElementById('mobMenu').classList.toggle('open')});
function closeMob(){document.getElementById('hbg').classList.remove('open');document.getElementById('mobMenu').classList.remove('open')}

// ═══ SCROLL PROGRESS + STICKY BAR ═══
let heroHeight=0;
window.addEventListener('scroll',()=>{
  const h=document.documentElement.scrollHeight-window.innerHeight;
  document.getElementById('sp').style.width=(window.scrollY/h*100)+'%';
  // sticky bar appears after hero
  if(!heroHeight){const hero=document.querySelector('.hero');if(hero)heroHeight=hero.offsetHeight}
  const bar=document.getElementById('stickyBar');
  if(bar&&bar.style.display!=='none'){
    if(window.scrollY>heroHeight*.6)bar.classList.add('show');
    else bar.classList.remove('show');
  }
});

// ═══ ANIMATED COUNTERS ═══
function animateCounter(el){
  const target=parseInt(el.dataset.target)||0;
  const suffix=el.dataset.suffix||'';
  const duration=1800;
  const start=performance.now();
  function step(now){
    const p=Math.min((now-start)/duration,1);
    const ease=1-Math.pow(1-p,3); // ease-out-cubic
    el.textContent=Math.floor(ease*target)+suffix;
    if(p<1)requestAnimationFrame(step);
    else el.textContent=target+suffix;
  }
  requestAnimationFrame(step);
}

// ═══ SCROLL REVEAL + BAR FILLS + COUNTERS ═══
const ro=new IntersectionObserver(entries=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.classList.add('vis');
      // bar fills
      if(e.target.classList.contains('bar-fill'))e.target.style.width=e.target.dataset.w+'%';
      // counters inside revealed elements
      e.target.querySelectorAll&&e.target.querySelectorAll('.count-up').forEach(c=>{
        if(!c.dataset.done){c.dataset.done='1';animateCounter(c)}
      });
      ro.unobserve(e.target);
    }
  });
},{threshold:.15});

document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale,.bar-fill').forEach(el=>ro.observe(el));

// animate counters directly in hero (always visible)
window.addEventListener('load',()=>{
  document.querySelectorAll('.stats-bar .count-up').forEach(c=>{
    if(!c.dataset.done){c.dataset.done='1';animateCounter(c)}
  });
});

// ═══ FAQ ═══
document.querySelectorAll('.faq-q').forEach(q=>{
  q.addEventListener('click',()=>{
    const a=q.nextElementSibling,icon=q.querySelector('.faq-icon'),open=a.style.display==='block';
    document.querySelectorAll('.faq-a').forEach(x=>x.style.display='none');
    document.querySelectorAll('.faq-icon').forEach(x=>x.textContent='+');
    a.style.display=open?'none':'block';icon.textContent=open?'+':'−';
  });
});

// ═══ TESTIMONIALS ═══
let tIdx=0;const tCards=document.querySelectorAll('.testi-card');
function tDots(){const c=document.getElementById('testiDots');c.innerHTML='';tCards.forEach((_,i)=>{const d=document.createElement('div');d.className='slider-dot'+(i===tIdx?' active':'');d.onclick=()=>tGoTo(i);c.appendChild(d)})}
function tGoTo(i){tIdx=i;document.getElementById('testiTrack').style.transform=\`translateX(-\${i*100}%)\`;tDots()}
function tSlide(d){tGoTo((tIdx+d+tCards.length)%tCards.length)}
tDots();setInterval(()=>tSlide(1),5500);

// Swipe support for testimonials
let tsX=0;
document.querySelector('.testi-wrap').addEventListener('touchstart',e=>tsX=e.touches[0].clientX,{passive:true});
document.querySelector('.testi-wrap').addEventListener('touchend',e=>{const dx=e.changedTouches[0].clientX-tsX;if(Math.abs(dx)>40)tSlide(dx<0?1:-1)},{passive:true});

// ═══ ENQUIRY FORM ═══
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

// ═══ PARENTS PORTAL ═══
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
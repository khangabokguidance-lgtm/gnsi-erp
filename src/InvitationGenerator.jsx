import { useState, useEffect, useRef, useCallback } from 'react'

/* ─────────────────────────────────────────────
   InvitationGenerator.jsx
   Admin-only module — GNSI Portal
   Drop into src/ and add to App.jsx nav/routing
───────────────────────────────────────────── */

// ── Default data ──────────────────────────────
const DEFAULT_P1 = {
  inst:    'Guidance Navodaya & Sainik Institute',
  acc:     'Navodaya',
  addr:    'Khangabok Sorok Wangma · Thoubal District · Manipur – 795138',
  script:  'ꯒꯤꯗꯦꯟꯁ ꯅꯕꯣꯗꯌ & ꯁꯥꯏꯅꯤꯛ ꯏꯟꯁ꯭ꯇꯤꯇꯨꯠ',
  callig:  'Invitation',
  cord:    'You are cordially invited for the pleasure of your kind presence at',
  evt:     "Fresher's Meet cum Felicitation Programme",
  yr:      '– 2026',
  mon:     'June',
  day:     '14',
  ord:     'th',
  year:    '2026',
  venue:   'Khangabok Sorok Wangma\nCommunity Hall',
  vnote:   'Thoubal District, Manipur',
  anni:    '10',
  quote:   '"Your esteemed presence will highly grace and inspire our Institute."',
  fsub:    'Programme Overleaf',
}

const DEFAULT_P2 = {
  inst:    'Guidance Navodaya & Sainik Institute',
  acc:     'Navodaya',
  addr:    'Khangabok Sorok Wangma · Thoubal District · Manipur – 795138',
  progTtl: 'Programme',
  date:    'Friday, 15th May 2026',
  time:    '09:00 AM',
  venue:   'Premises of the Institute',
  ftrl:    'Organising Committee · Guidance, Khangabok',
  ftrr:    'R.S.V.P.',
}

const DEFAULT_MEMBERS = [
  { name: 'Moirangthem Manglemjao Singh', role: 'Chairman, Guidance Khangabok' },
  { name: 'Dr. Leimapokpam Romesh Singh', role: 'Principal, GNSI' },
  { name: 'Kh. Inaocha Singh',            role: 'Secretary, GNSI Alumni Association' },
  { name: 'N. Priyobarta Singh',           role: 'Head, Academic Affairs' },
]

const DEFAULT_PROGS = [
  { time: '09:00 AM', name: 'Inaugural Ceremony & Welcome Address', sub: 'By Principal, GNSI' },
  { time: '09:30 AM', name: 'Lamp Lighting & Saraswati Puja',       sub: '' },
  { time: '10:00 AM', name: 'Introduction of Fresh Students',        sub: 'Batch 2025–26' },
  { time: '10:30 AM', name: 'Felicitation of Top Performers',        sub: 'JNVST & AISSEE Qualifiers' },
  { time: '11:15 AM', name: 'Cultural Performances',                 sub: "Students' Choir & Dance" },
  { time: '12:00 PM', name: 'Presidential Address',                  sub: 'By Chairman, GNSI' },
  { time: '12:30 PM', name: 'Vote of Thanks',                        sub: 'Secretary, Organising Committee' },
  { time: '01:00 PM', name: 'Lunch & Fellowship',                    sub: '' },
]

// ── Save slots ────────────────────────────────
const SLOT_KEYS = ['slot_A', 'slot_B', 'slot_C']
const SLOT_LABELS = ['Slot A', 'Slot B', 'Slot C']

// ── Fonts (injected once) ────────────────────
const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Cinzel:wght@400;600;700;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Raleway:wght@300;400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap'

function injectFonts() {
  if (document.getElementById('gnsi-inv-fonts')) return
  const l = document.createElement('link')
  l.id = 'gnsi-inv-fonts'; l.rel = 'stylesheet'; l.href = FONT_URL
  document.head.appendChild(l)
}

// ── Helpers ───────────────────────────────────
function buildName(inst, acc) {
  if (!acc || !inst.includes(acc)) return inst
  const idx = inst.indexOf(acc)
  return (
    inst.slice(0, idx) +
    `<span style="color:#C4962A">${acc}</span>` +
    inst.slice(idx + acc.length)
  )
}

// ── CSS for the card (injected into print iframe) ─────────────────────────────
const CARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600;1,700&family=Cinzel:wght@400;600;700;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Raleway:wght@300;400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0B1730;--gold:#C4962A;--gold2:#E0BC6A;--gold3:#F5DFA0;
  --cream:#FEFCF5;
  --fs-inst:17px;--fs-addr:8px;--fs-scr:9px;--fs-callig:44px;
  --fs-cord:10px;--fs-evt:13px;--fs-mon:11px;--fs-day:50px;
  --fs-yr:12px;--fs-vname:13px;--fs-vnote:9px;--fs-dname:12px;
  --fs-drole:7px;--fs-quote:9px;
  --fs-p2inst:13px;--fs-p2addr:7px;--fs-p2ttl:9px;--fs-p2date:10px;
  --fs-p2itime:7px;--fs-p2iname:12px;--fs-p2isub:6px;
}
body{background:#fff;display:flex;gap:0}

/* ─ Shell ─ */
.page-shell,.page2-shell{width:148mm;height:210mm;position:relative;flex-shrink:0;overflow:hidden}
.inv-card,.p2-card{position:absolute;inset:0;background:var(--cream);display:flex;flex-direction:column;overflow:hidden}

/* ─ Borders ─ */
.bdr-o{position:absolute;inset:0;border:2.5px solid var(--gold);z-index:30;pointer-events:none}
.bdr-m{position:absolute;inset:7px;border:0.8px solid rgba(196,150,42,0.28);z-index:30;pointer-events:none}
.bdr-i{position:absolute;inset:12px;border:0.4px solid rgba(196,150,42,0.12);z-index:30;pointer-events:none}

/* ─ Corner ornaments ─ */
.cor{position:absolute;width:70px;height:70px;z-index:32;pointer-events:none}
.cor svg{width:100%;height:100%}
.cor-tl{top:0;left:0}.cor-tr{top:0;right:0;transform:scaleX(-1)}
.cor-bl{bottom:0;left:0;transform:scaleY(-1)}.cor-br{bottom:0;right:0;transform:scale(-1)}

/* ─ Header ─ */
.hdr{
  background:linear-gradient(160deg,#07102a 0%,#0d1e45 40%,#0a1835 70%,#060e22 100%);
  padding:14px 80px 12px 50px;text-align:center;position:relative;overflow:hidden;flex-shrink:0;
}
.hdr::before{content:'';position:absolute;inset:0;z-index:0;
  background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,0.045) 18px,rgba(196,150,42,0.045) 19px),
  radial-gradient(ellipse 70% 120% at 50% 50%,rgba(196,150,42,0.08) 0%,transparent 70%);}
.hdr-gl{position:absolute;left:0;right:0;height:3px;z-index:2;
  background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%);}
.hdr-gl.t{top:0}.hdr-gl.b{bottom:0}
.h-script{font-family:'EB Garamond',serif;font-style:italic;font-size:var(--fs-scr);color:#ffffff;letter-spacing:3px;margin-bottom:4px;position:relative;z-index:1}
.h-name{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-inst);color:#ffffff;letter-spacing:1.2px;line-height:1.22;position:relative;z-index:1;text-shadow:0 1px 12px rgba(196,150,42,0.2)}
.h-addr{font-family:'Raleway',sans-serif;font-weight:500;font-size:var(--fs-addr);color:#ffffff;letter-spacing:3px;text-transform:uppercase;margin-top:5px;position:relative;z-index:1}
.anni{position:absolute;right:8px;top:50%;transform:translateY(-50%);z-index:10}

/* ─ Gold rule ─ */
.gold-rule{flex-shrink:0;height:1.5px;background:linear-gradient(90deg,transparent,var(--gold),var(--gold2),var(--gold),transparent);margin:0 18px}

/* ─ Invitation block ─ */
.inv-blk{text-align:center;padding:7px 50px 4px;flex-shrink:0}
.orn-row{display:flex;align-items:center;gap:10px;margin-bottom:5px}
.orn-line{flex:1;height:0.8px;background:linear-gradient(90deg,transparent,#C4962A,transparent)}
.orn-gems{display:flex;gap:4px;align-items:center}
.orn-gems span{width:5px;height:5px;background:#C4962A;transform:rotate(45deg);display:block}
.orn-gems span.s{width:3px;height:3px;opacity:.45}
.inv-callig{font-family:'Great Vibes',cursive;font-size:var(--fs-callig);color:var(--gold);line-height:.9;text-shadow:0 1px 18px rgba(196,150,42,.4)}
.inv-cord{font-family:'EB Garamond',serif;font-style:italic;font-size:var(--fs-cord);color:#1a1208;margin-top:4px;line-height:1.5}

/* ─ Event band ─ */
.evt-band{margin:4px 16px;position:relative;flex-shrink:0}
.evt-band::before,.evt-band::after{content:'';position:absolute;left:0;right:0;height:.8px;background:linear-gradient(90deg,transparent,#C4962A,transparent)}
.evt-band::before{top:0}.evt-band::after{bottom:0}
.evt-inner{background:#fff;margin:.8px 0;padding:8px 18px;text-align:center;position:relative}
.evt-inner::before{content:'';position:absolute;inset:4px;border:.8px solid rgba(196,150,42,.35);pointer-events:none}
.evt-ttl{font-family:'Playfair Display',serif;font-weight:700;font-style:italic;font-size:var(--fs-evt);color:var(--navy);letter-spacing:.3px;line-height:1.35}
.evt-ttl .yr{font-style:normal;color:var(--gold);font-weight:400;font-size:11px}

/* ─ Date + Venue ─ */
.dv-panel{display:flex;align-items:center;margin:4px 28px 2px;flex-shrink:0;gap:0}
.dv-divider{width:1px;align-self:stretch;background:linear-gradient(180deg,transparent,var(--gold) 20%,var(--gold) 80%,transparent);flex-shrink:0;margin:0 16px}
.date-col{flex:0 0 auto;padding:4px 0;text-align:center;display:flex;flex-direction:row;align-items:center;gap:8px}
.dt-meta{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.dt-lbl{font-family:'Cinzel',serif;font-weight:700;font-size:6px;letter-spacing:3.5px;text-transform:uppercase;color:var(--gold)}
.dt-mon{font-family:'Cinzel',serif;font-weight:600;font-size:8px;letter-spacing:3px;color:#0B1730;text-transform:uppercase}
.dt-yr{font-family:'Playfair Display',serif;font-weight:500;font-size:9px;letter-spacing:3px;color:#2a3a5a}
.dt-row{display:flex;align-items:flex-start}
.dt-day{font-family:'Playfair Display',serif;font-weight:900;font-size:var(--fs-day);color:var(--navy);line-height:1}
.dt-sup{font-family:'Cinzel',serif;font-weight:600;font-size:9px;color:var(--gold);margin-top:7px;margin-left:1px}
.venue-col{flex:1;padding:4px 0;display:flex;flex-direction:column;justify-content:center}
.vn-lbl{font-family:'Cinzel',serif;font-weight:700;font-size:6px;letter-spacing:3.5px;text-transform:uppercase;color:var(--gold);margin-bottom:4px}
.vn-name{font-family:'Playfair Display',serif;font-weight:700;font-size:var(--fs-vname);color:var(--navy);line-height:1.3}
.vn-note{font-family:'EB Garamond',serif;font-style:italic;font-size:var(--fs-vnote);color:#1a1208;margin-top:3px}

/* ─ Presidium Members ─ */
.dig-sec{padding:0 14px;flex:1;display:flex;flex-direction:column;justify-content:center}
.dig-hd-wrap{text-align:center;margin-bottom:8px;flex-shrink:0;width:100%}
.dig-hd-row{display:inline-flex;align-items:center;gap:10px}
.dig-hd-line{width:38px;height:.8px}
.dig-hd-line.l{background:linear-gradient(90deg,transparent,#C4962A)}
.dig-hd-line.r{background:linear-gradient(90deg,#C4962A,transparent)}
.dig-hd-lbl{font-family:'Cinzel',serif;font-weight:700;font-size:7px;letter-spacing:4px;text-transform:uppercase;color:var(--navy);border:1px solid var(--gold);padding:3px 14px;background:var(--cream)}
.dig-list{display:table;flex-shrink:0;margin:0 auto;min-width:260px;max-width:100%}
.dig-item{display:flex;align-items:center;padding:5px 4px;gap:10px;border-bottom:.8px solid rgba(196,150,42,.2);white-space:nowrap}
.dig-item:last-child{border-bottom:none}
.dig-txt{display:flex;flex-direction:column;justify-content:center;gap:1px}
.d-name{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:700;font-size:var(--fs-dname);color:#07102a;line-height:1.25}
.d-role{font-family:'Cinzel',serif;font-weight:600;font-size:var(--fs-drole);color:#7a4e08;letter-spacing:1px;text-transform:uppercase;line-height:1.3}

/* ─ Footer ─ */
.ftr{background:linear-gradient(160deg,#060e22 0%,#0a1835 40%,#0d1e45 70%,#07102a 100%);padding:9px 36px;text-align:center;position:relative;flex-shrink:0;overflow:hidden}
.ftr::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%)}
.ftr::after{content:'';position:absolute;inset:0;z-index:0;background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,.04) 18px,rgba(196,150,42,.04) 19px),radial-gradient(ellipse 70% 150% at 50% 50%,rgba(196,150,42,.07) 0%,transparent 70%)}
.ftr-q{font-family:'EB Garamond',serif;font-style:italic;font-size:var(--fs-quote);color:#ffffff;line-height:1.65;position:relative;z-index:1}
.ftr-s{font-family:'Cinzel',serif;font-weight:600;font-size:6.5px;letter-spacing:4.5px;text-transform:uppercase;color:#ffffff;margin-top:4px;position:relative;z-index:1}

/* ─ Page 2 Header ─ */
.p2-hdr{background:linear-gradient(160deg,#07102a 0%,#0d1e45 40%,#0a1835 70%,#060e22 100%);padding:13px 20px 11px;text-align:center;position:relative;overflow:hidden;flex-shrink:0}
.p2-hdr::before{content:'';position:absolute;inset:0;z-index:0;background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,.045) 18px,rgba(196,150,42,.045) 19px),radial-gradient(ellipse 70% 120% at 50% 50%,rgba(196,150,42,.08) 0%,transparent 70%)}
.p2-hdr-gl{position:absolute;left:0;right:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%)}
.p2-hdr-gl.t{top:0}.p2-hdr-gl.b{bottom:0}
.p2-inst{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-p2inst);color:#ffffff;letter-spacing:1px;line-height:1.2;position:relative;z-index:1;text-shadow:0 1px 10px rgba(196,150,42,.2)}
.p2-addr{font-family:'Raleway',sans-serif;font-weight:500;font-size:var(--fs-p2addr);color:#ffffff;letter-spacing:3px;text-transform:uppercase;margin-top:4px;position:relative;z-index:1}

/* ─ P2 Programme heading ─ */
.p2-prog-hd{text-align:center;padding:8px 20px 5px;flex-shrink:0}
.p2-prog-hd-row{display:inline-flex;align-items:center;gap:12px}
.p2-prog-hl{width:50px;height:.8px}
.p2-prog-hl.l{background:linear-gradient(90deg,transparent,var(--gold))}
.p2-prog-hl.r{background:linear-gradient(90deg,var(--gold),transparent)}
.p2-prog-ttl{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-p2ttl);letter-spacing:4.5px;text-transform:uppercase;color:var(--navy);border:1px solid var(--gold);padding:3px 16px;background:var(--cream)}

/* ─ Date bar ─ */
.p2-date-bar{background:#fff;margin:0 16px;padding:7px 16px;text-align:center;position:relative;flex-shrink:0;border:1px solid rgba(196,150,42,.3)}
.p2-date-bar::before{content:'';position:absolute;inset:4px;border:.8px solid rgba(196,150,42,.18);pointer-events:none}
.p2-date-txt{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:var(--fs-p2date);color:var(--navy);letter-spacing:.3px}
.p2-date-txt strong{font-weight:700;color:var(--gold);font-style:normal}

/* ─ Programme list ─ */
.p2-body{flex:1;padding:5px 16px 4px;display:flex;flex-direction:column}
.p2-items{flex:1;display:flex;flex-direction:column}
.p2-item{flex:0 0 auto;display:flex;align-items:center;padding:5px 6px;border-bottom:.8px solid rgba(196,150,42,.2)}
.p2-item:last-child{border-bottom:none}
.p2-time{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-p2itime);color:#6b4608;letter-spacing:.5px;min-width:55px;flex-shrink:0;text-align:right;padding-right:10px}
.p2-divider{width:1px;height:60%;background:rgba(196,150,42,.5);flex-shrink:0}
.p2-dot{width:5px;height:5px;border-radius:50%;background:var(--gold);flex-shrink:0;margin:0 8px}
.p2-prog-name{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:var(--fs-p2iname);color:#07102a;line-height:1.2;flex:1}
.p2-prog-sub{font-family:'Cinzel',serif;font-weight:600;font-size:var(--fs-p2isub);color:#1a1208;letter-spacing:.3px;margin-top:1px}

/* ─ P2 Footer ─ */
.p2-ftr{background:linear-gradient(160deg,#060e22 0%,#0a1835 40%,#0d1e45 70%,#07102a 100%);padding:9px 28px;display:flex;align-items:center;justify-content:space-between;position:relative;flex-shrink:0;overflow:hidden}
.p2-ftr::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%)}
.p2-ftr::after{content:'';position:absolute;inset:0;z-index:0;background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,.04) 18px,rgba(196,150,42,.04) 19px)}
.p2-ftr-l{font-family:'Cinzel',serif;font-weight:600;font-size:7px;letter-spacing:3px;text-transform:uppercase;color:#ffffff;position:relative;z-index:1}
.p2-ftr-r{font-family:'EB Garamond',serif;font-style:italic;font-size:10px;color:#ffffff;position:relative;z-index:1}

@media print{
  @page{size:A4 landscape;margin:0}
  body{width:297mm;height:210mm;overflow:hidden}
  .page-shell,.page2-shell{width:148.5mm;height:210mm}
}
`

// ── Corner SVG (reused) ────────────────────────
const CornerSVG = () => (
  <svg viewBox="0 0 70 70" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L70,0 L70,3.5 L3.5,3.5 L3.5,70 L0,70 Z" fill="#C4962A"/>
    <path d="M3.5,3.5 L52,3.5 L52,6 L6,6 L6,52 L3.5,52 Z" fill="rgba(196,150,42,0.25)"/>
    <path d="M6,6 L36,6 L36,8 L8,8 L8,36 L6,36 Z" fill="rgba(196,150,42,0.1)"/>
    <circle cx="14" cy="14" r="6.5" stroke="#C4962A" strokeWidth="1" fill="rgba(196,150,42,0.08)"/>
    <circle cx="14" cy="14" r="4" stroke="#E0BC6A" strokeWidth="0.7" fill="none"/>
    <circle cx="14" cy="14" r="1.8" fill="#C4962A"/>
    <line x1="14" y1="7.5" x2="14" y2="6" stroke="#C4962A" strokeWidth="0.8"/>
    <line x1="14" y1="20.5" x2="14" y2="22" stroke="#C4962A" strokeWidth="0.8"/>
    <line x1="7.5" y1="14" x2="6" y2="14" stroke="#C4962A" strokeWidth="0.8"/>
    <line x1="20.5" y1="14" x2="22" y2="14" stroke="#C4962A" strokeWidth="0.8"/>
    <path d="M25,3.5 Q30,3.5 32,8 Q34,13 32,19" stroke="#C4962A" strokeWidth="0.7" fill="none"/>
    <path d="M3.5,25 Q3.5,30 8,32 Q13,34 19,32" stroke="#C4962A" strokeWidth="0.7" fill="none"/>
  </svg>
)

// ── AnniSVG ───────────────────────────────────
function AnniSVG({ num }) {
  return (
    <svg width="50" height="50" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill="rgba(196,150,42,0.12)"/>
      <circle cx="28" cy="28" r="26" stroke="#C4962A" strokeWidth="1.2" fill="none"/>
      <circle cx="28" cy="28" r="21" stroke="#E0BC6A" strokeWidth="0.6" fill="none"/>
      <text x="28" y="24" textAnchor="middle"
        fontFamily="Playfair Display,serif" fontWeight="900" fontSize="18" fill="#E0BC6A">{num}</text>
      <text x="28" y="34" textAnchor="middle"
        fontFamily="Cinzel,serif" fontWeight="600" fontSize="5.5" fill="rgba(255,255,255,0.7)" letterSpacing="2">YEARS</text>
      <text x="28" y="42" textAnchor="middle"
        fontFamily="EB Garamond,serif" fontStyle="italic" fontSize="5" fill="rgba(255,255,255,0.5)">of Excellence</text>
      <polygon points="28,3 29.2,6.8 33.2,6.8 30,9.2 31.2,13 28,10.7 24.8,13 26,9.2 22.8,6.8 26.8,6.8"
        fill="#C4962A" opacity="0.7"/>
    </svg>
  )
}

// ── InvCard (Page 1) ─────────────────────────
function InvCard({ p1, members }) {
  const instHtml = buildName(p1.inst, p1.acc)
  return (
    <div className="page-shell">
      <div className="inv-card">
        <div className="bdr-o"/><div className="bdr-m"/><div className="bdr-i"/>
        <div className="cor cor-tl"><CornerSVG/></div>
        <div className="cor cor-tr"><CornerSVG/></div>
        <div className="cor cor-bl"><CornerSVG/></div>
        <div className="cor cor-br"><CornerSVG/></div>

        {/* HEADER */}
        <div className="hdr">
          <div className="hdr-gl t"/><div className="hdr-gl b"/>
          <div className="h-script">{p1.script}</div>
          <div className="h-name" dangerouslySetInnerHTML={{__html: instHtml}}/>
          <div className="h-addr">{p1.addr}</div>
          <div className="anni"><AnniSVG num={p1.anni}/></div>
        </div>

        <div className="gold-rule"/>

        {/* INVITATION */}
        <div className="inv-blk">
          <div className="orn-row">
            <div className="orn-line"/>
            <div className="orn-gems"><span className="s"/><span/><span className="s"/></div>
            <div className="orn-line"/>
          </div>
          <div className="inv-callig">{p1.callig}</div>
          <div className="inv-cord">{p1.cord}</div>
        </div>

        {/* EVENT BAND */}
        <div className="evt-band">
          <div className="evt-inner">
            <div className="evt-ttl">
              {p1.evt} <span className="yr">{p1.yr}</span>
            </div>
          </div>
        </div>

        {/* DATE + VENUE */}
        <div className="dv-panel">
          <div className="date-col">
            <div className="dt-meta">
              <div className="dt-lbl">Date</div>
              <div className="dt-mon">{p1.mon}</div>
              <div className="dt-yr">{p1.year}</div>
            </div>
            <div className="dt-row">
              <span className="dt-day">{p1.day}</span>
              <span className="dt-sup">{p1.ord}</span>
            </div>
          </div>
          <div className="dv-divider"/>
          <div className="venue-col">
            <div className="vn-lbl">Venue</div>
            <div className="vn-name" dangerouslySetInnerHTML={{__html: p1.venue.replace(/\n/g,'<br/>')}}/>
            <div className="vn-note">{p1.vnote}</div>
          </div>
        </div>

        {/* PRESIDIUM */}
        <div className="dig-sec">
          <div className="dig-hd-wrap">
            <div className="dig-hd-row">
              <div className="dig-hd-line l"/>
              <div className="dig-hd-lbl">Presidium Members</div>
              <div className="dig-hd-line r"/>
            </div>
          </div>
          <div className="dig-list">
            {members.map((m, i) => (
              <div className="dig-item" key={i}>
                <div className="dig-txt">
                  <div className="d-name">{m.name}</div>
                  <div className="d-role">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="ftr">
          <div className="ftr-q">{p1.quote}</div>
          <div className="ftr-s">{p1.fsub}</div>
        </div>
      </div>
    </div>
  )
}

// ── ProgCard (Page 2) ─────────────────────────
function ProgCard({ p2, progs }) {
  const instHtml = buildName(p2.inst, p2.acc)
  return (
    <div className="page2-shell">
      <div className="p2-card">
        <div className="bdr-o"/><div className="bdr-m"/><div className="bdr-i"/>
        <div className="cor cor-tl"><CornerSVG/></div>
        <div className="cor cor-tr"><CornerSVG/></div>
        <div className="cor cor-bl"><CornerSVG/></div>
        <div className="cor cor-br"><CornerSVG/></div>

        {/* HEADER */}
        <div className="p2-hdr">
          <div className="p2-hdr-gl t"/><div className="p2-hdr-gl b"/>
          <div className="p2-inst" dangerouslySetInnerHTML={{__html: instHtml}}/>
          <div className="p2-addr">{p2.addr}</div>
        </div>

        <div className="gold-rule"/>

        {/* PROGRAMME HEADING */}
        <div className="p2-prog-hd">
          <div className="p2-prog-hd-row">
            <div className="p2-prog-hl l"/>
            <div className="p2-prog-ttl">{p2.progTtl}</div>
            <div className="p2-prog-hl r"/>
          </div>
        </div>

        {/* DATE BAR */}
        <div className="p2-date-bar">
          <div className="p2-date-txt">
            <strong>{p2.date}</strong> &nbsp;·&nbsp; Commencing at <strong>{p2.time}</strong> &nbsp;·&nbsp; {p2.venue}
          </div>
        </div>

        {/* PROGRAMME */}
        <div className="p2-body">
          <div className="p2-items">
            {progs.map((pg, i) => (
              <div className="p2-item" key={i}>
                <div className="p2-time">{pg.time}</div>
                <div className="p2-divider"/>
                <div className="p2-dot"/>
                <div>
                  <div className="p2-prog-name">{pg.name}</div>
                  {pg.sub && <div className="p2-prog-sub">{pg.sub}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="p2-ftr">
          <div className="p2-ftr-l">{p2.ftrl}</div>
          <div className="p2-ftr-r">{p2.ftrr}</div>
        </div>
      </div>
    </div>
  )
}

// ── Sidebar field components ──────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display:'block', fontFamily:'sans-serif', fontSize:10, fontWeight:600,
        letterSpacing:'0.5px', textTransform:'uppercase', color:'#9ca3af', marginBottom:3 }}>
        {label}
      </label>
      {children}
    </div>
  )
}
const iStyle = {
  width:'100%', background:'#1e293b', border:'1px solid #334155',
  borderRadius:4, padding:'5px 8px', fontFamily:'inherit', fontSize:12,
  color:'#f1f5f9', outline:'none', resize:'vertical',
}
function Inp({ value, onChange, textarea, rows=2 }) {
  return textarea
    ? <textarea value={value} onChange={e=>onChange(e.target.value)}
        rows={rows} style={iStyle}/>
    : <input type="text" value={value} onChange={e=>onChange(e.target.value)}
        style={iStyle}/>
}

// ── Main Component ────────────────────────────
export default function InvitationGenerator({ currentUser }) {
  // ── Role guard — Admin + Manager ──────────
  const role = (currentUser?.role || '').toLowerCase()
  const canAccess = role === 'admin' || role === 'manager'

  // ── State ──────────────────────────────────
  const [tab, setTab]       = useState('p1')     // p1 | p2 | members | progs | print
  const [p1, setP1]         = useState(DEFAULT_P1)
  const [p2, setP2]         = useState(DEFAULT_P2)
  const [members, setMembers] = useState(DEFAULT_MEMBERS)
  const [progs, setProgs]   = useState(DEFAULT_PROGS)
  const [slot, setSlot]     = useState(0)
  const [toast, setToast]   = useState('')
  const previewRef          = useRef(null)

  useEffect(() => { injectFonts() }, [])

  // ── Toast helper ───────────────────────────
  const showToast = useCallback(msg => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }, [])

  // ── Save / Load ────────────────────────────
  const saveSlot = () => {
    const data = { p1, p2, members, progs }
    localStorage.setItem('gnsi_inv_' + SLOT_KEYS[slot], JSON.stringify(data))
    showToast(`✅ Saved to ${SLOT_LABELS[slot]}`)
  }
  const loadSlot = () => {
    const raw = localStorage.getItem('gnsi_inv_' + SLOT_KEYS[slot])
    if (!raw) { showToast('⚠️ No data in this slot'); return }
    const d = JSON.parse(raw)
    if (d.p1) setP1(d.p1); if (d.p2) setP2(d.p2)
    if (d.members) setMembers(d.members); if (d.progs) setProgs(d.progs)
    showToast(`📂 Loaded from ${SLOT_LABELS[slot]}`)
  }

  // ── Print ──────────────────────────────────
  const handlePrint = () => {
    const html = previewRef.current?.innerHTML || ''
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8">
      <title>GNSI Invitation</title>
      <style>${CARD_CSS}</style>
      </head><body style="display:flex;gap:0">${html}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 800)
  }

  // ── p1 / p2 field setters ─────────────────
  const sp1 = (k, v) => setP1(prev => ({ ...prev, [k]: v }))
  const sp2 = (k, v) => setP2(prev => ({ ...prev, [k]: v }))

  // ── Member helpers ─────────────────────────
  const updMember = (i, k, v) => setMembers(prev => prev.map((m, idx) => idx===i ? {...m,[k]:v} : m))
  const addMember = () => setMembers(prev => [...prev, { name:'', role:'' }])
  const delMember = i => setMembers(prev => prev.filter((_,idx) => idx!==i))

  // ── Prog helpers ───────────────────────────
  const updProg  = (i, k, v) => setProgs(prev => prev.map((p, idx) => idx===i ? {...p,[k]:v} : p))
  const addProg  = () => setProgs(prev => [...prev, { time:'', name:'', sub:'' }])
  const delProg  = i => setProgs(prev => prev.filter((_,idx) => idx!==i))

  // ── Admin block ────────────────────────────
  if (!canAccess) {
    return (
      <div style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        height:'60vh', gap:16, color:'#94a3b8', fontFamily:'sans-serif',
      }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p style={{ fontSize:18, fontWeight:600, color:'#64748b' }}>Admin / Manager Access Only</p>
        <p style={{ fontSize:13, color:'#475569' }}>The Invitation Generator is restricted to Admins and Managers.</p>
      </div>
    )
  }

  // ── Styles ────────────────────────────────
  const S = {
    wrap: {
      display:'flex', height:'calc(100vh - 60px)', overflow:'hidden',
      background:'#0f172a', fontFamily:'system-ui,sans-serif',
    },
    sidebar: {
      width:270, minWidth:270, background:'#0f172a',
      borderRight:'1px solid rgba(196,150,42,0.15)',
      display:'flex', flexDirection:'column', overflow:'hidden',
    },
    sTop: {
      padding:'14px 16px 10px',
      background:'linear-gradient(160deg,#0a1020,#12233d)',
      borderBottom:'1px solid rgba(196,150,42,0.12)',
      flexShrink:0,
    },
    sTitle: {
      fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:10,
      letterSpacing:'2.5px', textTransform:'uppercase', color:'#E0BC6A',
    },
    sSub: { fontSize:9, color:'rgba(196,150,42,0.45)', marginTop:2, letterSpacing:'1px', fontFamily:'sans-serif' },
    tabs: {
      display:'flex', borderBottom:'1px solid rgba(196,150,42,0.12)',
      flexShrink:0, background:'#0a0806',
    },
    tabBtn: (active) => ({
      flex:1, padding:'8px 2px', fontFamily:"'Cinzel',serif", fontWeight:600,
      fontSize:'6.5px', letterSpacing:'1px', textTransform:'uppercase', border:'none',
      background:'none', cursor:'pointer', transition:'color 0.2s',
      color: active ? '#E0BC6A' : 'rgba(196,150,42,0.35)',
      borderBottom: active ? '1.5px solid #C4962A' : '1.5px solid transparent',
    }),
    body: { padding:'12px 14px 24px', overflowY:'auto', flex:1 },
    slbl: {
      fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'6.5px',
      letterSpacing:'3.5px', textTransform:'uppercase', color:'#C4962A',
      margin:'14px 0 8px', paddingBottom:5,
      borderBottom:'1px solid rgba(196,150,42,0.15)',
    },
    dcard: {
      background:'rgba(196,150,42,0.05)', border:'1px solid rgba(196,150,42,0.12)',
      borderRadius:5, padding:'8px 9px', marginBottom:7, position:'relative',
    },
    dcLbl: {
      fontFamily:"'Cinzel',serif", fontSize:'6.5px', color:'#C4962A',
      fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:5,
    },
    remBtn: {
      position:'absolute', top:6, right:6, background:'none', border:'none',
      color:'rgba(196,150,42,0.3)', fontSize:11, cursor:'pointer',
    },
    addBtn: {
      width:'100%', background:'transparent',
      border:'1px dashed rgba(196,150,42,0.22)', borderRadius:4,
      padding:'6px', fontFamily:"'Cinzel',serif", fontSize:'7px', fontWeight:600,
      letterSpacing:'1.5px', textTransform:'uppercase', color:'rgba(196,150,42,0.4)',
      cursor:'pointer', marginTop:4,
    },
    printBtn: {
      width:'100%',
      background:'linear-gradient(135deg,#C4962A,#8a6518)',
      color:'#fff', border:'none', borderRadius:4,
      fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'7px',
      letterSpacing:'2.5px', textTransform:'uppercase', padding:11,
      cursor:'pointer', marginTop:12,
    },
    preview: {
      flex:1, overflowY:'auto', padding:24,
      display:'flex', flexDirection:'column', alignItems:'center',
      background:'radial-gradient(ellipse at 50% 0%,#1a1208 0%,#0d0a07 60%)',
    },
    chip: {
      fontFamily:'sans-serif', fontSize:'7.5px', fontWeight:700,
      letterSpacing:'3px', textTransform:'uppercase', color:'rgba(196,150,42,0.4)',
      background:'rgba(196,150,42,0.06)', border:'1px solid rgba(196,150,42,0.12)',
      borderRadius:20, padding:'5px 16px', marginBottom:16,
    },
    cardsRow: {
      display:'flex', flexDirection:'row', alignItems:'flex-start',
      flexShrink:0, transform:'scale(0.72)', transformOrigin:'top center',
      marginBottom:-240,
      filter:'drop-shadow(0 30px 80px rgba(0,0,0,0.8))',
    },
    // slot row
    slotRow: {
      display:'flex', gap:6, alignItems:'center', marginBottom:10,
    },
    slotSel: {
      flex:1, background:'#1e293b', border:'1px solid #334155',
      borderRadius:4, padding:'5px 8px', color:'#f1f5f9', fontSize:12,
    },
    slotBtn: (c) => ({
      padding:'5px 10px', borderRadius:4, border:'none', cursor:'pointer',
      fontFamily:"'Cinzel',serif", fontWeight:600, fontSize:'7px',
      letterSpacing:'1.5px', textTransform:'uppercase',
      background: c==='save' ? 'rgba(196,150,42,0.15)' : 'rgba(30,80,140,0.25)',
      color: c==='save' ? '#E0BC6A' : '#93c5fd',
    }),
  }

  const TABS = [
    { id:'p1',      label:'Page 1'  },
    { id:'p2',      label:'Page 2'  },
    { id:'members', label:'Members' },
    { id:'progs',   label:'Progs'   },
  ]

  return (
    <div style={S.wrap}>
      {/* ── SIDEBAR ── */}
      <div style={S.sidebar}>
        {/* Top brand */}
        <div style={S.sTop}>
          <div style={S.sTitle}>✉ Invitation Studio</div>
          <div style={S.sSub}>GNSI · Admin & Manager · A5 Live Editor</div>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {TABS.map(t => (
            <button key={t.id} style={S.tabBtn(tab===t.id)} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* Save slots */}
          <div style={S.slotRow}>
            <select style={S.slotSel} value={slot} onChange={e => setSlot(Number(e.target.value))}>
              {SLOT_LABELS.map((l,i) => <option key={i} value={i}>{l}</option>)}
            </select>
            <button style={S.slotBtn('save')} onClick={saveSlot}>Save</button>
            <button style={S.slotBtn('load')} onClick={loadSlot}>Load</button>
          </div>

          {/* ── PAGE 1 ── */}
          {tab === 'p1' && <>
            <div style={S.slbl}>Institute</div>
            <Field label="Name"><Inp value={p1.inst} onChange={v => sp1('inst',v)}/></Field>
            <Field label="Accent Word"><Inp value={p1.acc} onChange={v => sp1('acc',v)}/></Field>
            <Field label="Address"><Inp value={p1.addr} onChange={v => sp1('addr',v)}/></Field>
            <Field label="Script Line (Meitei Mayek)"><Inp value={p1.script} onChange={v => sp1('script',v)}/></Field>

            <div style={S.slbl}>Invitation</div>
            <Field label="Calligraphy Word"><Inp value={p1.callig} onChange={v => sp1('callig',v)}/></Field>
            <Field label="Opening Line"><Inp textarea value={p1.cord} onChange={v => sp1('cord',v)}/></Field>

            <div style={S.slbl}>Event</div>
            <Field label="Event Title"><Inp textarea value={p1.evt} onChange={v => sp1('evt',v)}/></Field>
            <Field label="Year Suffix"><Inp value={p1.yr} onChange={v => sp1('yr',v)}/></Field>

            <div style={S.slbl}>Date</div>
            <Field label="Month"><Inp value={p1.mon} onChange={v => sp1('mon',v)}/></Field>
            <Field label="Day"><Inp value={p1.day} onChange={v => sp1('day',v)}/></Field>
            <Field label="Ordinal"><Inp value={p1.ord} onChange={v => sp1('ord',v)}/></Field>
            <Field label="Year"><Inp value={p1.year} onChange={v => sp1('year',v)}/></Field>

            <div style={S.slbl}>Venue</div>
            <Field label="Venue Name"><Inp textarea value={p1.venue} onChange={v => sp1('venue',v)}/></Field>
            <Field label="Venue Note"><Inp value={p1.vnote} onChange={v => sp1('vnote',v)}/></Field>

            <div style={S.slbl}>Anniversary & Footer</div>
            <Field label="Years"><Inp value={p1.anni} onChange={v => sp1('anni',v)}/></Field>
            <Field label="Footer Quote"><Inp textarea value={p1.quote} onChange={v => sp1('quote',v)}/></Field>
            <Field label="Footer Sub"><Inp value={p1.fsub} onChange={v => sp1('fsub',v)}/></Field>
          </>}

          {/* ── PAGE 2 ── */}
          {tab === 'p2' && <>
            <div style={S.slbl}>Header</div>
            <Field label="Institute Name"><Inp value={p2.inst} onChange={v => sp2('inst',v)}/></Field>
            <Field label="Accent Word"><Inp value={p2.acc} onChange={v => sp2('acc',v)}/></Field>
            <Field label="Address"><Inp value={p2.addr} onChange={v => sp2('addr',v)}/></Field>

            <div style={S.slbl}>Programme Section</div>
            <Field label="Section Title"><Inp value={p2.progTtl} onChange={v => sp2('progTtl',v)}/></Field>

            <div style={S.slbl}>Date / Time Bar</div>
            <Field label="Date"><Inp value={p2.date} onChange={v => sp2('date',v)}/></Field>
            <Field label="Start Time"><Inp value={p2.time} onChange={v => sp2('time',v)}/></Field>
            <Field label="Venue Note"><Inp value={p2.venue} onChange={v => sp2('venue',v)}/></Field>

            <div style={S.slbl}>Footer</div>
            <Field label="Footer Left"><Inp value={p2.ftrl} onChange={v => sp2('ftrl',v)}/></Field>
            <Field label="Footer Right"><Inp value={p2.ftrr} onChange={v => sp2('ftrr',v)}/></Field>
          </>}

          {/* ── MEMBERS ── */}
          {tab === 'members' && <>
            <div style={S.slbl}>Presidium Members</div>
            {members.map((m, i) => (
              <div key={i} style={S.dcard}>
                <div style={S.dcLbl}>Member {i+1}</div>
                <button style={S.remBtn} onClick={() => delMember(i)}>✕</button>
                <Inp value={m.name} onChange={v => updMember(i,'name',v)}/>
                <div style={{marginTop:4}}/>
                <Inp value={m.role} onChange={v => updMember(i,'role',v)}/>
              </div>
            ))}
            <button style={S.addBtn} onClick={addMember}>+ Add Member</button>
          </>}

          {/* ── PROGS ── */}
          {tab === 'progs' && <>
            <div style={S.slbl}>Programme Items</div>
            {progs.map((pg, i) => (
              <div key={i} style={S.dcard}>
                <div style={S.dcLbl}>Item {i+1}</div>
                <button style={S.remBtn} onClick={() => delProg(i)}>✕</button>
                <Inp value={pg.time} onChange={v => updProg(i,'time',v)}/>
                <div style={{marginTop:4}}/>
                <Inp value={pg.name} onChange={v => updProg(i,'name',v)}/>
                <div style={{marginTop:4}}/>
                <Inp value={pg.sub} onChange={v => updProg(i,'sub',v)}/>
              </div>
            ))}
            <button style={S.addBtn} onClick={addProg}>+ Add Item</button>
          </>}

          {/* Print button always visible */}
          <button style={S.printBtn} onClick={handlePrint}>⎙ Print / Save PDF</button>
        </div>
      </div>

      {/* ── PREVIEW ── */}
      <div style={S.preview}>
        <div style={S.chip}>A4 Landscape · 297 × 210 mm · Two A5 Cards</div>

        {/* Scoped card styles */}
        <style>{`
          .inv-card *, .p2-card * { font-family: inherit; box-sizing: border-box; }
          ${CARD_CSS}
        `}</style>

        <div style={S.cardsRow} ref={previewRef}>
          <InvCard p1={p1} members={members}/>
          <ProgCard p2={p2} progs={progs}/>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9999,
          background:'#1e293b', border:'1px solid rgba(196,150,42,0.3)',
          color:'#f1f5f9', padding:'10px 18px', borderRadius:8,
          fontFamily:'sans-serif', fontSize:13, fontWeight:500,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          animation:'fadeIn 0.2s ease',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
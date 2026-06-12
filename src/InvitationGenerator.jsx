import { useState, useEffect, useRef, useCallback } from 'react'

const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,600;1,700&family=Cinzel:wght@400;600;700;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=Raleway:wght@300;400;500;600;700;800&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap'

function injectFonts() {
  if (document.getElementById('gnsi-inv-fonts')) return
  const l = document.createElement('link')
  l.id = 'gnsi-inv-fonts'; l.rel = 'stylesheet'; l.href = FONT_URL
  document.head.appendChild(l)
}

const DEFAULT_FS = {
  inst: 17, addr: 8, scr: 9, callig: 44, cord: 10, evt: 13,
  mon: 11, day: 50, yr: 12, vname: 13, vnote: 9, aname: 15,
  dname: 12, drole: 7, quote: 9,
  p2inst: 13, p2addr: 7, p2ttl: 9, p2date: 10,
  p2itime: 7, p2iname: 12, p2isub: 6, p2ftr: 7,
}

const FS_CONFIG = [
  { section: 'Header', items: [
    { key:'inst',   label:'Institute Name', min:10, max:28 },
    { key:'addr',   label:'Address',        min:6,  max:14 },
    { key:'scr',    label:'Script Line',    min:6,  max:16 },
  ]},
  { section: 'Invitation', items: [
    { key:'callig', label:'Calligraphy',    min:24, max:70 },
    { key:'cord',   label:'Opening Line',   min:7,  max:16 },
  ]},
  { section: 'Event', items: [
    { key:'evt',    label:'Event Title',    min:8,  max:22 },
  ]},
  { section: 'Date', items: [
    { key:'mon',    label:'Month',          min:7,  max:18 },
    { key:'day',    label:'Day Number',     min:28, max:72 },
    { key:'yr',     label:'Year',           min:7,  max:20 },
  ]},
  { section: 'Venue', items: [
    { key:'vname',  label:'Venue Name',     min:8,  max:20 },
    { key:'vnote',  label:'Venue Note',     min:6,  max:14 },
  ]},
  { section: 'Dignitaries', items: [
    { key:'aname',  label:'Anchor Name',    min:10, max:22 },
    { key:'dname',  label:'Guest Names',    min:8,  max:18 },
    { key:'drole',  label:'Guest Roles',    min:5,  max:12 },
  ]},
  { section: 'Footer', items: [
    { key:'quote',  label:'Quote',          min:6,  max:14 },
  ]},
  { section: 'Page 2 – Header', items: [
    { key:'p2inst', label:'Inst Name',      min:8,  max:22 },
    { key:'p2addr', label:'Address',        min:5,  max:12 },
  ]},
  { section: 'Page 2 – Programme', items: [
    { key:'p2ttl',  label:'Section Title',  min:6,  max:16 },
    { key:'p2date', label:'Date Bar',       min:7,  max:16 },
    { key:'p2itime',label:'Item Time',      min:5,  max:12 },
    { key:'p2iname',label:'Item Name',      min:8,  max:18 },
    { key:'p2isub', label:'Item Sub',       min:5,  max:11 },
  ]},
  { section: 'Page 2 – Footer', items: [
    { key:'p2ftr',  label:'Footer Text',    min:5,  max:12 },
  ]},
]

const DEFAULT_COLORS = { navy: '#0B1730', gold: '#C4962A', gold2: '#E0BC6A' }

const DEFAULT_P1 = {
  inst:   'Guidance Navodaya & Sainik Institute',
  acc:    'Navodaya',
  addr:   'Khangabok Sorok Wangma · Thoubal District · Manipur – 795138',
  script: 'ꯒꯤꯗꯦꯟꯁ ꯅꯕꯣꯗꯌ & ꯁꯥꯏꯅꯤꯛ ꯏꯟꯁ꯭ꯇꯤꯇꯨꯠ',
  callig: 'Invitation',
  cord:   'You are cordially invited for the pleasure of your kind presence at',
  evt:    "Fresher's Meet cum Felicitation Programme",
  yr:     '– 2026',
  mon:    'June',
  day:    '14',
  ord:    'th',
  year:   '2026',
  venue:  'Khangabok Sorok Wangma\nCommunity Hall',
  vnote:  'Thoubal District, Manipur',
  anni:   '10',
  quote:  '"Your esteemed presence will highly grace and inspire our Institute."',
  fsub:   'Programme Overleaf',
  aname:  'Moirangthem Manglemjao Singh',
  arole:  'Chairman, Guidance Khangabok',
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

const SLOT_KEYS   = ['slot_A', 'slot_B', 'slot_C']
const SLOT_LABELS = ['Slot A', 'Slot B', 'Slot C']

function buildName(inst, acc, goldColor = '#C4962A') {
  if (!acc || !inst.includes(acc)) return inst
  const idx = inst.indexOf(acc)
  return (
    inst.slice(0, idx) +
    `<span style="color:${goldColor}">${acc}</span>` +
    inst.slice(idx + acc.length)
  )
}

function buildCssVars(fs, colors) {
  const fvars = Object.entries(fs).map(([k, v]) => `--fs-${k}:${v}px`).join(';')
  return `${fvars};--navy:${colors.navy};--gold:${colors.gold};--gold2:${colors.gold2};--gold3:#F5DFA0;--cream:#FEFCF5`
}

const PRINT_CARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Cinzel:wght@400;600;700;900&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400;1,700&family=Raleway:wght@300;400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --navy:#0B1730;--gold:#C4962A;--gold2:#E0BC6A;--gold3:#F5DFA0;--cream:#FEFCF5;
  --fs-inst:17px;--fs-addr:8px;--fs-scr:9px;--fs-callig:44px;--fs-cord:10px;--fs-evt:13px;
  --fs-mon:11px;--fs-day:50px;--fs-yr:12px;--fs-vname:13px;--fs-vnote:9px;--fs-aname:15px;
  --fs-dname:12px;--fs-drole:7px;--fs-quote:9px;
  --fs-p2inst:13px;--fs-p2addr:7px;--fs-p2ttl:9px;--fs-p2date:10px;
  --fs-p2itime:7px;--fs-p2iname:12px;--fs-p2isub:6px;--fs-p2ftr:7px;
}
body{background:#fff;display:flex;gap:0}
.page-shell,.page2-shell{width:148mm;height:210mm;position:relative;flex-shrink:0;overflow:hidden}
.inv-card,.p2-card{position:absolute;inset:0;background:var(--cream);display:flex;flex-direction:column;overflow:hidden}
.bdr-o{position:absolute;inset:0;border:2.5px solid var(--gold);z-index:30;pointer-events:none}
.bdr-m{position:absolute;inset:7px;border:0.8px solid rgba(196,150,42,0.28);z-index:30;pointer-events:none}
.bdr-i{position:absolute;inset:12px;border:0.4px solid rgba(196,150,42,0.12);z-index:30;pointer-events:none}
.cor{position:absolute;width:80px;height:80px;z-index:32;pointer-events:none}
.cor svg{width:100%;height:100%}
.cor-tl{top:0;left:0}.cor-tr{top:0;right:0;transform:scaleX(-1)}
.cor-bl{bottom:0;left:0;transform:scaleY(-1)}.cor-br{bottom:0;right:0;transform:scale(-1)}
.hdr{background:linear-gradient(160deg,#07102a 0%,#0d1e45 40%,#0a1835 70%,#060e22 100%);padding:18px 90px 16px 58px;text-align:center;position:relative;overflow:hidden;flex-shrink:0}
.hdr::before{content:'';position:absolute;inset:0;z-index:0;background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,0.045) 18px,rgba(196,150,42,0.045) 19px),radial-gradient(ellipse 70% 120% at 50% 50%,rgba(196,150,42,0.08) 0%,transparent 70%)}
.hdr-gl{position:absolute;left:0;right:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%)}
.hdr-gl.t{top:0}.hdr-gl.b{bottom:0}
.h-script{font-family:'EB Garamond',serif;font-style:italic;font-size:var(--fs-scr);color:var(--gold3);letter-spacing:3px;margin-bottom:5px;position:relative;z-index:1}
.h-name{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-inst);color:#ffffff;letter-spacing:1.2px;line-height:1.22;position:relative;z-index:1;text-shadow:0 1px 12px rgba(196,150,42,0.2)}
.h-addr{font-family:'Raleway',sans-serif;font-weight:500;font-size:var(--fs-addr);color:rgba(224,188,106,0.75);letter-spacing:3px;text-transform:uppercase;margin-top:6px;position:relative;z-index:1}
.anni{position:absolute;right:9px;top:50%;transform:translateY(-50%);z-index:10}
.gold-rule{flex-shrink:0;height:1.5px;background:linear-gradient(90deg,transparent,var(--gold),var(--gold2),var(--gold),transparent);margin:0 18px}
.inv-blk{text-align:center;padding:7px 50px 4px;flex-shrink:0}
.orn-row{display:flex;align-items:center;gap:10px;margin-bottom:5px}
.orn-line{flex:1;height:0.8px;background:linear-gradient(90deg,transparent,#C4962A,transparent)}
.orn-gems{display:flex;gap:4px;align-items:center}
.orn-gems span{width:5px;height:5px;background:#C4962A;transform:rotate(45deg);display:block}
.orn-gems span.s{width:3px;height:3px;opacity:.45}
.inv-callig{font-family:'Great Vibes',cursive;font-size:var(--fs-callig);color:var(--gold);line-height:.9;text-shadow:0 1px 18px rgba(196,150,42,.4)}
.inv-cord{font-family:'EB Garamond',serif;font-style:italic;font-size:var(--fs-cord);color:#1a1208;margin-top:4px;line-height:1.5}
.evt-band{margin:4px 16px;position:relative;flex-shrink:0}
.evt-band::before,.evt-band::after{content:'';position:absolute;left:0;right:0;height:.8px;background:linear-gradient(90deg,transparent,#C4962A,transparent)}
.evt-band::before{top:0}.evt-band::after{bottom:0}
.evt-inner{background:#fff;margin:.8px 0;padding:8px 18px;text-align:center;position:relative}
.evt-inner::before{content:'';position:absolute;inset:4px;border:.8px solid rgba(196,150,42,.35);pointer-events:none}
.evt-ttl{font-family:'Playfair Display',serif;font-weight:700;font-style:italic;font-size:var(--fs-evt);color:var(--navy);letter-spacing:.3px;line-height:1.35}
.evt-ttl .yr{font-style:normal;color:var(--gold);font-weight:400;font-size:11px}
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
.dig-sec{padding:0 14px;flex:1;display:flex;flex-direction:column;justify-content:center}
.dig-hd-wrap{text-align:center;margin-bottom:8px;flex-shrink:0;width:100%}
.dig-hd-row{display:inline-flex;align-items:center;gap:10px}
.dig-hd-line{width:38px;height:.8px}
.dig-hd-line.l{background:linear-gradient(90deg,transparent,#C4962A)}
.dig-hd-line.r{background:linear-gradient(90deg,#C4962A,transparent)}
.dig-hd-lbl{font-family:'Cinzel',serif;font-weight:700;font-size:7px;letter-spacing:4px;text-transform:uppercase;color:var(--navy);border:1px solid var(--gold);padding:3px 14px;background:var(--cream)}
.dig-list{display:table;flex-shrink:0;margin:0 auto;min-width:260px;max-width:100%}
.dig-item{display:flex;align-items:center;padding:5px 4px;gap:8px;border-bottom:.8px solid rgba(196,150,42,.2)}
.dig-item:last-child{border-bottom:none}
.dig-num{width:16px;height:16px;border-radius:50%;border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;font-family:'Cinzel',serif;font-weight:700;font-size:6px;color:var(--gold);flex-shrink:0}
.dig-txt{display:flex;flex-direction:column;justify-content:center;gap:1px}
.d-name{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:700;font-size:var(--fs-dname);color:#07102a;line-height:1.25}
.d-name.anchor{font-size:var(--fs-aname)}
.d-role{font-family:'Cinzel',serif;font-weight:600;font-size:var(--fs-drole);color:#7a4e08;letter-spacing:1px;text-transform:uppercase;line-height:1.3}
.ftr{background:linear-gradient(160deg,#060e22 0%,#0a1835 40%,#0d1e45 70%,#07102a 100%);padding:9px 36px;text-align:center;position:relative;flex-shrink:0;overflow:hidden}
.ftr::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%)}
.ftr::after{content:'';position:absolute;inset:0;z-index:0;background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,.04) 18px,rgba(196,150,42,.04) 19px),radial-gradient(ellipse 70% 150% at 50% 50%,rgba(196,150,42,.07) 0%,transparent 70%)}
.ftr-q{font-family:'EB Garamond',serif;font-style:italic;font-size:var(--fs-quote);color:#ffffff;line-height:1.65;position:relative;z-index:1}
.ftr-s{font-family:'Cinzel',serif;font-weight:600;font-size:6.5px;letter-spacing:4.5px;text-transform:uppercase;color:#ffffff;margin-top:4px;position:relative;z-index:1}
.p2-hdr{background:linear-gradient(160deg,#07102a 0%,#0d1e45 40%,#0a1835 70%,#060e22 100%);padding:15px 22px 13px;text-align:center;position:relative;overflow:hidden;flex-shrink:0}
.p2-hdr::before{content:'';position:absolute;inset:0;z-index:0;background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,.045) 18px,rgba(196,150,42,.045) 19px),radial-gradient(ellipse 70% 120% at 50% 50%,rgba(196,150,42,.08) 0%,transparent 70%)}
.p2-hdr-gl{position:absolute;left:0;right:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%)}
.p2-hdr-gl.t{top:0}.p2-hdr-gl.b{bottom:0}
.p2-inst{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-p2inst);color:#ffffff;letter-spacing:1px;line-height:1.2;position:relative;z-index:1;text-shadow:0 1px 10px rgba(196,150,42,.2)}
.p2-addr{font-family:'Raleway',sans-serif;font-weight:500;font-size:var(--fs-p2addr);color:rgba(224,188,106,0.75);letter-spacing:3px;text-transform:uppercase;margin-top:4px;position:relative;z-index:1}
.p2-prog-hd{text-align:center;padding:9px 22px 6px;flex-shrink:0}
.p2-prog-hd-row{display:inline-flex;align-items:center;gap:14px}
.p2-prog-hl{width:55px;height:.8px}
.p2-prog-hl.l{background:linear-gradient(90deg,transparent,var(--gold))}
.p2-prog-hl.r{background:linear-gradient(90deg,var(--gold),transparent)}
.p2-prog-ttl{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-p2ttl);letter-spacing:4.5px;text-transform:uppercase;color:var(--navy);border:1px solid var(--gold);padding:3px 16px;background:var(--cream)}
.p2-date-bar{background:#fff;margin:0 18px;padding:7px 18px;text-align:center;position:relative;flex-shrink:0;border:1px solid rgba(196,150,42,.3)}
.p2-date-bar::before{content:'';position:absolute;inset:4px;border:.8px solid rgba(196,150,42,.18);pointer-events:none}
.p2-date-txt{font-family:'Playfair Display',serif;font-style:italic;font-weight:400;font-size:var(--fs-p2date);color:var(--navy);letter-spacing:.3px}
.p2-date-txt strong{font-weight:700;color:var(--gold);font-style:normal}
.p2-body{flex:1;padding:6px 18px 5px;display:flex;flex-direction:column}
.p2-items{flex:1;display:flex;flex-direction:column}
.p2-item{flex:0 0 auto;display:flex;align-items:center;padding:5.5px 7px;border-bottom:.8px solid rgba(196,150,42,.25)}
.p2-item:last-child{border-bottom:none}
.p2-time{font-family:'Cinzel',serif;font-weight:700;font-size:var(--fs-p2itime);color:#6b4608;letter-spacing:.5px;min-width:58px;flex-shrink:0;text-align:right;padding-right:11px}
.p2-divider{width:1px;height:60%;background:rgba(196,150,42,.6);flex-shrink:0}
.p2-dot{width:5px;height:5px;border-radius:50%;background:var(--gold);flex-shrink:0;margin:0 9px}
.p2-prog-name{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:var(--fs-p2iname);color:#07102a;line-height:1.2;flex:1}
.p2-prog-sub{font-family:'Cinzel',serif;font-weight:600;font-size:var(--fs-p2isub);color:#1a1208;letter-spacing:.3px;margin-top:1px}
.p2-ftr{background:linear-gradient(160deg,#060e22 0%,#0a1835 40%,#0d1e45 70%,#07102a 100%);padding:9px 32px;display:flex;align-items:center;justify-content:space-between;position:relative;flex-shrink:0;overflow:hidden}
.p2-ftr::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;z-index:2;background:linear-gradient(90deg,transparent 0%,var(--gold) 20%,var(--gold3) 50%,var(--gold) 80%,transparent 100%)}
.p2-ftr::after{content:'';position:absolute;inset:0;z-index:0;background:repeating-linear-gradient(-55deg,transparent 0px,transparent 18px,rgba(196,150,42,.04) 18px,rgba(196,150,42,.04) 19px)}
.p2-ftr-l{font-family:'Cinzel',serif;font-weight:600;font-size:var(--fs-p2ftr);letter-spacing:3px;text-transform:uppercase;color:var(--gold2);position:relative;z-index:1}
.p2-ftr-r{font-family:'EB Garamond',serif;font-style:italic;font-size:10px;color:rgba(255,255,255,0.9);position:relative;z-index:1}
@media print{
  @page{size:A4 landscape;margin:0}
  body{width:297mm;height:210mm;overflow:hidden}
  .page-shell,.page2-shell{width:148.5mm;height:210mm}
}
`

const LESS_INK_CSS = `
.less-ink .hdr,.less-ink .ftr{background:#fff !important;border:1.5px solid var(--navy)}
.less-ink .hdr::before{display:none}
.less-ink .h-script{color:var(--gold) !important}
.less-ink .h-name{color:var(--navy) !important}
.less-ink .h-addr{color:rgba(11,23,48,0.5) !important}
.less-ink .evt-inner{background:#fff !important;border:1px solid var(--navy)}
.less-ink .evt-ttl{color:var(--navy) !important}
.less-ink .ftr-q{color:rgba(11,23,48,0.8) !important}
.less-ink .p2-hdr,.less-ink .p2-ftr{background:#fff !important}
.less-ink .p2-hdr{border-bottom:1.5px solid var(--navy)}
.less-ink .p2-ftr{border-top:1.5px solid var(--navy)}
.less-ink .p2-hdr::before{display:none}
.less-ink .p2-inst{color:var(--navy) !important}
.less-ink .p2-date-bar{background:#fff !important;border:1px solid var(--navy)}
.less-ink .p2-date-txt{color:var(--navy) !important}
.less-ink .p2-ftr-l,.less-ink .p2-ftr-r{color:var(--navy) !important}
`

const CornerSVG = () => (
  <svg viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0,0 L80,0 L80,4 L4,4 L4,80 L0,80 Z" fill="#C4962A"/>
    <path d="M4,4 L60,4 L60,7 L7,7 L7,60 L4,60 Z" fill="rgba(196,150,42,0.25)"/>
    <path d="M7,7 L42,7 L42,9 L9,9 L9,42 L7,42 Z" fill="rgba(196,150,42,0.1)"/>
    <circle cx="16" cy="16" r="7" stroke="#C4962A" strokeWidth="1" fill="rgba(196,150,42,0.08)"/>
    <circle cx="16" cy="16" r="4.5" stroke="#E0BC6A" strokeWidth="0.7" fill="none"/>
    <circle cx="16" cy="16" r="2" fill="#C4962A"/>
    <line x1="16" y1="9"  x2="16" y2="7"  stroke="#C4962A" strokeWidth="0.8"/>
    <line x1="16" y1="23" x2="16" y2="25" stroke="#C4962A" strokeWidth="0.8"/>
    <line x1="9"  y1="16" x2="7"  y2="16" stroke="#C4962A" strokeWidth="0.8"/>
    <line x1="23" y1="16" x2="25" y2="16" stroke="#C4962A" strokeWidth="0.8"/>
    <path d="M28,4 Q34,4 36,10 Q38,16 36,22" stroke="#C4962A" strokeWidth="0.7" fill="none"/>
    <path d="M4,28 Q4,34 10,36 Q16,38 22,36" stroke="#C4962A" strokeWidth="0.7" fill="none"/>
  </svg>
)

function AnniSVG({ num }) {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
      <circle cx="28" cy="28" r="26" fill="rgba(196,150,42,0.08)"/>
      <circle cx="28" cy="28" r="26" stroke="#C4962A" strokeWidth="1.2" fill="none"/>
      <circle cx="28" cy="28" r="21" stroke="#E0BC6A" strokeWidth="0.6" fill="none"/>
      <path d="M28,4 C36,10 46,18 46,28 C46,38 36,46 28,52 C20,46 10,38 10,28 C10,18 20,10 28,4Z"
        stroke="rgba(196,150,42,0.3)" strokeWidth="0.5" fill="none"/>
      <text x="28" y="24" textAnchor="middle"
        fontFamily="Playfair Display,serif" fontWeight="900" fontSize="18" fill="#E0BC6A">{num}</text>
      <text x="28" y="34" textAnchor="middle"
        fontFamily="Cinzel,serif" fontWeight="600" fontSize="5.5" fill="rgba(255,255,255,0.85)" letterSpacing="2">YEARS</text>
      <text x="28" y="42" textAnchor="middle"
        fontFamily="EB Garamond,serif" fontStyle="italic" fontSize="5" fill="rgba(255,255,255,0.65)">of Excellence</text>
      <polygon points="28,3 29.2,6.8 33.2,6.8 30,9.2 31.2,13 28,10.7 24.8,13 26,9.2 22.8,6.8 26.8,6.8"
        fill="#C4962A" opacity="0.7"/>
    </svg>
  )
}

function InvCard({ p1, members, colors, lessInk }) {
  const instHtml = buildName(p1.inst, p1.acc, colors.gold2)
  const allMembers = [
    { name: p1.aname, role: p1.arole, anchor: true },
    ...members,
  ].filter(m => m.name)

  return (
    <div className="page-shell">
      <div className={`inv-card${lessInk ? ' less-ink' : ''}`}>
        <div className="bdr-o"/><div className="bdr-m"/><div className="bdr-i"/>
        <div className="cor cor-tl"><CornerSVG/></div>
        <div className="cor cor-tr"><CornerSVG/></div>
        <div className="cor cor-bl"><CornerSVG/></div>
        <div className="cor cor-br"><CornerSVG/></div>
        <div className="hdr">
          <div className="hdr-gl t"/><div className="hdr-gl b"/>
          <div className="h-script">{p1.script}</div>
          <div className="h-name" dangerouslySetInnerHTML={{__html: instHtml}}/>
          <div className="h-addr">{p1.addr}</div>
          <div className="anni"><AnniSVG num={p1.anni}/></div>
        </div>
        <div className="gold-rule"/>
        <div className="inv-blk">
          <div className="orn-row">
            <div className="orn-line"/>
            <div className="orn-gems"><span className="s"/><span/><span className="s"/></div>
            <div className="orn-line"/>
          </div>
          <div className="inv-callig">{p1.callig}</div>
          <div className="inv-cord">{p1.cord}</div>
        </div>
        <div className="evt-band">
          <div className="evt-inner">
            <div className="evt-ttl">{p1.evt} <span className="yr">{p1.yr}</span></div>
          </div>
        </div>
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
        <div className="dig-sec">
          <div className="dig-hd-wrap">
            <div className="dig-hd-row">
              <div className="dig-hd-line l"/>
              <div className="dig-hd-lbl">Presidium Members</div>
              <div className="dig-hd-line r"/>
            </div>
          </div>
          <div className="dig-list">
            {allMembers.map((m, i) => (
              <div className="dig-item" key={i}>
                <div className="dig-txt">
                  <div className={`d-name${m.anchor ? ' anchor' : ''}`}>{m.name}</div>
                  <div className="d-role">{m.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="ftr">
          <div className="ftr-q">{p1.quote}</div>
          <div className="ftr-s">{p1.fsub}</div>
        </div>
      </div>
    </div>
  )
}

function ProgCard({ p2, progs, colors, lessInk }) {
  const instHtml = buildName(p2.inst, p2.acc, colors.gold2)
  return (
    <div className="page2-shell">
      <div className={`p2-card${lessInk ? ' less-ink' : ''}`}>
        <div className="bdr-o"/><div className="bdr-m"/><div className="bdr-i"/>
        <div className="cor cor-tl"><CornerSVG/></div>
        <div className="cor cor-tr"><CornerSVG/></div>
        <div className="cor cor-bl"><CornerSVG/></div>
        <div className="cor cor-br"><CornerSVG/></div>
        <div className="p2-hdr">
          <div className="p2-hdr-gl t"/><div className="p2-hdr-gl b"/>
          <div className="p2-inst" dangerouslySetInnerHTML={{__html: instHtml}}/>
          <div className="p2-addr">{p2.addr}</div>
        </div>
        <div className="gold-rule"/>
        <div className="p2-prog-hd">
          <div className="p2-prog-hd-row">
            <div className="p2-prog-hl l"/>
            <div className="p2-prog-ttl">{p2.progTtl}</div>
            <div className="p2-prog-hl r"/>
          </div>
        </div>
        <div className="p2-date-bar">
          <div className="p2-date-txt">
            <strong>{p2.date}</strong> &nbsp;·&nbsp; Commencing at <strong>{p2.time}</strong> &nbsp;·&nbsp; {p2.venue}
          </div>
        </div>
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
        <div className="p2-ftr">
          <div className="p2-ftr-l">{p2.ftrl}</div>
          <div className="p2-ftr-r">{p2.ftrr}</div>
        </div>
      </div>
    </div>
  )
}

// ── Shared input primitives ───────────────────
const iBase = {
  width:'100%', background:'rgba(196,150,42,0.06)', border:'1px solid rgba(196,150,42,0.18)',
  borderRadius:4, padding:'5px 8px', fontFamily:"'Cormorant Garamond',serif", fontSize:12,
  color:'rgba(245,237,200,0.9)', outline:'none', resize:'vertical',
}
function Inp({ value, onChange, textarea, rows = 2 }) {
  return textarea
    ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={rows} style={iBase}/>
    : <input type="text" value={value} onChange={e => onChange(e.target.value)} style={iBase}/>
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom:8 }}>
      <label style={{ display:'block', fontFamily:"'Raleway',sans-serif", fontWeight:600,
        fontSize:8, letterSpacing:'1px', textTransform:'uppercase',
        color:'rgba(196,150,42,0.5)', marginBottom:3 }}>{label}</label>
      {children}
    </div>
  )
}
function FsRow({ label, fsKey, value, min, max, onChange }) {
  return (
    <Field label={`${label} — ${value}px`}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <input type="range" min={min} max={max} value={value}
          onChange={e => onChange(fsKey, Number(e.target.value))}
          style={{ flex:1, height:2, accentColor:'#C4962A', cursor:'pointer' }}/>
        <span style={{ fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'8px',
          color:'#E0BC6A', minWidth:28, textAlign:'right' }}>{value}px</span>
      </div>
    </Field>
  )
}

// ── Main Component ────────────────────────────
export default function InvitationGenerator({ currentUser }) {
  const role = (currentUser?.role || '').toLowerCase()
  const canAccess = role === 'admin' || role === 'manager'

  const [fullscreen, setFullscreen] = useState(false)
  const [toolbarMinimized, setToolbarMinimized] = useState(false)
  const [tab, setTab]         = useState('p1')
  const [p1, setP1]           = useState(DEFAULT_P1)
  const [p2, setP2]           = useState(DEFAULT_P2)
  const [members, setMembers] = useState(DEFAULT_MEMBERS)
  const [progs, setProgs]     = useState(DEFAULT_PROGS)
  const [fs, setFs]           = useState(DEFAULT_FS)
  const [colors, setColors]   = useState(DEFAULT_COLORS)
  const [lessInk, setLessInk] = useState(false)
  const [slot, setSlot]       = useState(0)
  const [toast, setToast]     = useState('')
  const [previewZoom, setPreviewZoom] = useState(0.72)
  const [panelOpen, setPanelOpen] = useState(true)
  const previewRef = useRef(null)

  useEffect(() => { injectFonts() }, [])

  // ESC key exits fullscreen
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape' && fullscreen) setFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [fullscreen])

  const showToast = useCallback(msg => {
    setToast(msg); setTimeout(() => setToast(''), 2500)
  }, [])

  const saveSlot = () => {
    localStorage.setItem('gnsi_inv_' + SLOT_KEYS[slot],
      JSON.stringify({ p1, p2, members, progs, fs, colors, lessInk }))
    showToast(`✅ Saved to ${SLOT_LABELS[slot]}`)
  }
  const loadSlot = () => {
    const raw = localStorage.getItem('gnsi_inv_' + SLOT_KEYS[slot])
    if (!raw) { showToast('⚠️ No data in this slot'); return }
    const d = JSON.parse(raw)
    if (d.p1)      setP1(d.p1)
    if (d.p2)      setP2(d.p2)
    if (d.members) setMembers(d.members)
    if (d.progs)   setProgs(d.progs)
    if (d.fs)      setFs(d.fs)
    if (d.colors)  setColors(d.colors)
    if (d.lessInk !== undefined) setLessInk(d.lessInk)
    showToast(`📂 Loaded from ${SLOT_LABELS[slot]}`)
  }
  const exportHTML = () => {
    const html = previewRef.current?.innerHTML || ''
    const vars = buildCssVars(fs, colors)
    const lessInkStyle = lessInk ? LESS_INK_CSS : ''
    const blob = new Blob([`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>GNSI Invitation</title>
<style>:root{${vars}}${PRINT_CARD_CSS}${lessInkStyle}</style>
</head><body style="display:flex;gap:0">${html}</body></html>`], {type:'text/html'})
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'gnsi_invitation_export.html'
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('⬇ HTML exported')
  }
  const handlePrint = () => {
    const html = previewRef.current?.innerHTML || ''
    const vars = buildCssVars(fs, colors)
    const lessInkStyle = lessInk ? LESS_INK_CSS : ''
    const win = window.open('', '_blank')
    win.document.write(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>GNSI Invitation</title>
<style>:root{${vars}}${PRINT_CARD_CSS}${lessInkStyle}</style>
</head><body style="display:flex;gap:0">${html}</body></html>`)
    win.document.close()
    setTimeout(() => { win.focus(); win.print() }, 800)
  }

  const sp1 = (k, v) => setP1(prev => ({ ...prev, [k]: v }))
  const sp2 = (k, v) => setP2(prev => ({ ...prev, [k]: v }))
  const setFsKey = (k, v) => setFs(prev => ({ ...prev, [k]: v }))
  const setColor = (k, v) => setColors(prev => ({ ...prev, [k]: v }))

  const updMember = (i, k, v) => setMembers(prev => prev.map((m, idx) => idx===i ? {...m,[k]:v} : m))
  const addMember = () => setMembers(prev => [...prev, { name:'', role:'' }])
  const delMember = i => setMembers(prev => prev.filter((_,idx) => idx!==i))

  const updProg = (i, k, v) => setProgs(prev => prev.map((p, idx) => idx===i ? {...p,[k]:v} : p))
  const addProg = () => setProgs(prev => [...prev, { time:'', name:'', sub:'' }])
  const delProg = i => setProgs(prev => prev.filter((_,idx) => idx!==i))

  if (!canAccess) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', height:'60vh', gap:16, color:'#94a3b8' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="11" width="18" height="11" rx="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <p style={{ fontSize:18, fontWeight:600, color:'#64748b' }}>Admin / Manager Access Only</p>
    </div>
  )

  const cssVarsStyle = buildCssVars(fs, colors)

  const TABS = [
    { id:'p1',     label:'Page 1'  },
    { id:'p2',     label:'Page 2'  },
    { id:'fonts',  label:'Fonts'   },
    { id:'colors', label:'Colors'  },
  ]

  const TOP_BAR_H = 44
  const TAB_BAR_H = 36
  const PANEL_H   = 220

  // ── Fullscreen expand icon (two-arrows SVG) ──
  const ExpandIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {fullscreen
        ? <><path d="M8 3v5H3"/><path d="M21 8h-5V3"/><path d="M3 16h5v5"/><path d="M16 21v-5h5"/></>
        : <><path d="M3 8V3h5"/><path d="M16 3h5v5"/><path d="M21 16v5h-5"/><path d="M8 21H3v-5"/></>
      }
    </svg>
  )

  const T = {
    wrap: {
      display:'flex', flexDirection:'column',
      height: fullscreen ? '100vh' : 'calc(100vh - 60px)',
      background:'#0a0d14', overflow:'hidden',
      position: fullscreen ? 'fixed' : 'relative',
      inset: fullscreen ? 0 : 'auto',
      zIndex: fullscreen ? 9999 : 'auto',
      top: fullscreen ? 0 : 'auto',
      left: fullscreen ? 0 : 'auto',
    },
    actionBar: {
      height: TOP_BAR_H,
      background:'linear-gradient(90deg,#07102a 0%,#0d1e45 60%,#07102a 100%)',
      borderBottom:'1px solid rgba(196,150,42,0.2)',
      display:'flex', alignItems:'center',
      padding:'0 16px', gap:12, flexShrink:0,
      position:'relative', zIndex:10,
    },
    brandLabel: {
      fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'8px',
      letterSpacing:'3px', textTransform:'uppercase', color:'#E0BC6A',
      whiteSpace:'nowrap', marginRight:4,
    },
    divBar: {
      width:1, height:22, background:'rgba(196,150,42,0.2)', flexShrink:0,
    },
    slotSel: {
      background:'rgba(196,150,42,0.07)', border:'1px solid rgba(196,150,42,0.18)',
      borderRadius:4, padding:'4px 8px', color:'rgba(245,237,200,0.85)',
      fontFamily:"'Cinzel',serif", fontSize:'8px', letterSpacing:'1.5px',
      cursor:'pointer', outline:'none',
    },
    actionBtn: (variant) => ({
      padding:'5px 12px', fontFamily:"'Cinzel',serif", fontWeight:600,
      fontSize:'7px', letterSpacing:'1.5px', textTransform:'uppercase',
      borderRadius:3, cursor:'pointer', transition:'all .15s', border:'1px solid',
      ...(variant==='save'    ? { background:'rgba(196,150,42,0.15)', color:'#E0BC6A',     borderColor:'rgba(196,150,42,0.3)'  } :
          variant==='load'    ? { background:'rgba(30,60,140,0.2)',   color:'#90b4f0',     borderColor:'rgba(50,100,220,0.25)' } :
          variant==='export'  ? { background:'rgba(20,90,50,0.2)',    color:'#7ddeaa',     borderColor:'rgba(40,180,90,0.25)'  } :
          variant==='print'   ? { background:'linear-gradient(135deg,#C4962A,#8a6518)', color:'#FEFCF5', borderColor:'#C4962A', fontWeight:700 } :
                                { background:'rgba(196,150,42,0.08)', color:'rgba(196,150,42,0.5)', borderColor:'rgba(196,150,42,0.15)' }),
    }),
    spacer: { flex:1 },
    zoomWrap: {
      display:'flex', alignItems:'center', gap:8,
      background:'rgba(196,150,42,0.06)', border:'1px solid rgba(196,150,42,0.14)',
      borderRadius:5, padding:'4px 10px',
    },
    zoomLbl: {
      fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'6.5px',
      letterSpacing:'2px', textTransform:'uppercase', color:'#C4962A', whiteSpace:'nowrap',
    },
    zoomVal: {
      fontFamily:'monospace', fontSize:10, color:'#E0BC6A', minWidth:30, textAlign:'right',
    },
    tabBar: {
      height: TAB_BAR_H,
      background:'#0a0806',
      borderBottom: panelOpen ? '1px solid rgba(196,150,42,0.18)' : '2px solid rgba(196,150,42,0.12)',
      display:'flex', alignItems:'stretch', flexShrink:0,
      position:'relative', zIndex:9,
    },
    tabBtn: (active) => ({
      padding:'0 20px', fontFamily:"'Cinzel',serif", fontWeight:600,
      fontSize:'7.5px', letterSpacing:'1.5px', textTransform:'uppercase',
      border:'none', background:'none', cursor:'pointer',
      color: active ? '#E0BC6A' : 'rgba(196,150,42,0.35)',
      borderBottom: active ? '2px solid #C4962A' : '2px solid transparent',
      transition:'color .15s',
    }),
    collapseBtn: {
      marginLeft:'auto', padding:'0 16px', border:'none', background:'none',
      color:'rgba(196,150,42,0.35)', cursor:'pointer',
      fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'8px',
      letterSpacing:'1px', display:'flex', alignItems:'center', gap:5,
      transition:'color .15s',
    },
    editorPanel: {
      height: panelOpen ? PANEL_H : 0,
      overflow: 'hidden',
      transition:'height .25s ease',
      background:'#0e0c09',
      borderBottom: panelOpen ? '2px solid rgba(196,150,42,0.18)' : 'none',
      flexShrink:0,
    },
    editorScroll: {
      height: PANEL_H,
      overflowY:'auto', overflowX:'auto',
      padding:'12px 20px 16px',
      display:'flex', gap:24, flexWrap:'nowrap',
      alignItems:'flex-start',
    },
    preview: {
      flex:1, overflow:'auto',
      padding:24, display:'flex', flexDirection:'column', alignItems:'center',
      background:'radial-gradient(ellipse at 50% 0%,#1a1208 0%,#0d0a07 60%)',
    },
    chip: {
      fontFamily:"'Raleway',sans-serif", fontSize:'7.5px', fontWeight:700,
      letterSpacing:'3px', textTransform:'uppercase',
      color:'rgba(196,150,42,0.4)', background:'rgba(196,150,42,0.06)',
      border:'1px solid rgba(196,150,42,0.12)', borderRadius:20,
      padding:'5px 16px', marginBottom:12,
    },
    col:     { minWidth:200, maxWidth:240, flex:'0 0 auto' },
    colWide: { minWidth:240, maxWidth:280, flex:'0 0 auto' },
    dcard: {
      background:'rgba(196,150,42,0.05)', border:'1px solid rgba(196,150,42,0.12)',
      borderRadius:5, padding:'8px', marginBottom:7, position:'relative',
    },
    dcLbl: {
      fontFamily:"'Cinzel',serif", fontSize:'7px', color:'#C4962A',
      fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', marginBottom:4,
    },
    remBtn: {
      position:'absolute', top:6, right:6, background:'none', border:'none',
      color:'rgba(196,150,42,0.3)', fontSize:11, cursor:'pointer', padding:'2px 4px',
    },
    addBtn: {
      width:'100%', background:'transparent', border:'1px dashed rgba(196,150,42,0.2)',
      borderRadius:4, padding:'6px', fontFamily:"'Cinzel',serif", fontSize:'7px',
      fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase',
      color:'rgba(196,150,42,0.4)', cursor:'pointer', marginTop:4,
    },
    colorRow:  { display:'flex', alignItems:'center', gap:8 },
    colorDesc: { fontFamily:"'Raleway',sans-serif", fontSize:9, color:'rgba(196,150,42,0.45)' },
    sectionHdr: {
      fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'7.5px',
      letterSpacing:'3px', textTransform:'uppercase', color:'#C4962A',
      marginBottom:8, paddingBottom:4, borderBottom:'1px solid rgba(196,150,42,0.15)',
    },
  }

  const cardsWrapStyle = {
    display:'flex', flexDirection:'row', alignItems:'flex-start', flexShrink:0,
    transform:`scale(${previewZoom})`, transformOrigin:'top center',
    marginBottom: `${-(210 * (1 - previewZoom) * 2 + 20)}px`,
    filter:'drop-shadow(0 30px 80px rgba(0,0,0,0.8))',
  }

  const renderPanelContent = () => {
    if (tab === 'p1') return (
      <>
        <div style={T.col}>
          <div style={T.sectionHdr}>Institute</div>
          <Field label="Name"><Inp value={p1.inst}   onChange={v => sp1('inst',v)}/></Field>
          <Field label="Accent"><Inp value={p1.acc}   onChange={v => sp1('acc',v)}/></Field>
          <Field label="Address"><Inp value={p1.addr}  onChange={v => sp1('addr',v)}/></Field>
          <Field label="Script (Meitei Mayek)"><Inp value={p1.script} onChange={v => sp1('script',v)}/></Field>
          <div style={{...T.sectionHdr, marginTop:14}}>Invitation</div>
          <Field label="Calligraphy"><Inp value={p1.callig} onChange={v => sp1('callig',v)}/></Field>
          <Field label="Opening Line"><Inp textarea value={p1.cord} onChange={v => sp1('cord',v)}/></Field>
        </div>
        <div style={T.col}>
          <div style={T.sectionHdr}>Event</div>
          <Field label="Event Title"><Inp textarea value={p1.evt} onChange={v => sp1('evt',v)}/></Field>
          <Field label="Year / Suffix"><Inp value={p1.yr} onChange={v => sp1('yr',v)}/></Field>
          <div style={{...T.sectionHdr, marginTop:14}}>Date &amp; Venue</div>
          <Field label="Month"><Inp value={p1.mon}   onChange={v => sp1('mon',v)}/></Field>
          <Field label="Day">  <Inp value={p1.day}   onChange={v => sp1('day',v)}/></Field>
          <Field label="Ord">  <Inp value={p1.ord}   onChange={v => sp1('ord',v)}/></Field>
          <Field label="Year"> <Inp value={p1.year}  onChange={v => sp1('year',v)}/></Field>
          <Field label="Venue"><Inp textarea value={p1.venue} onChange={v => sp1('venue',v)}/></Field>
          <Field label="Note"> <Inp value={p1.vnote} onChange={v => sp1('vnote',v)}/></Field>
        </div>
        <div style={T.colWide}>
          <div style={T.sectionHdr}>President / Chair</div>
          <Field label="Name"><Inp value={p1.aname} onChange={v => sp1('aname',v)}/></Field>
          <Field label="Role"><Inp value={p1.arole} onChange={v => sp1('arole',v)}/></Field>
          <div style={{...T.sectionHdr, marginTop:14}}>Other Presidium Members</div>
          {members.map((m, i) => (
            <div key={i} style={T.dcard}>
              <div style={T.dcLbl}>Member {i+2}</div>
              <button style={T.remBtn} onClick={() => delMember(i)}>✕</button>
              <Inp value={m.name} onChange={v => updMember(i,'name',v)}/>
              <div style={{marginTop:4}}/>
              <Inp value={m.role} onChange={v => updMember(i,'role',v)}/>
            </div>
          ))}
          <button style={T.addBtn} onClick={addMember}>+ Add Member</button>
        </div>
        <div style={T.col}>
          <div style={T.sectionHdr}>Footer</div>
          <Field label="Quote"><Inp textarea value={p1.quote} onChange={v => sp1('quote',v)}/></Field>
          <Field label="Sub Label"><Inp value={p1.fsub} onChange={v => sp1('fsub',v)}/></Field>
          <div style={{...T.sectionHdr, marginTop:14}}>Anniversary</div>
          <Field label="Years Number"><Inp value={p1.anni} onChange={v => sp1('anni',v)}/></Field>
        </div>
      </>
    )

    if (tab === 'p2') return (
      <>
        <div style={T.col}>
          <div style={T.sectionHdr}>Header (Page 2)</div>
          <Field label="Name">   <Inp value={p2.inst}    onChange={v => sp2('inst',v)}/></Field>
          <Field label="Accent"> <Inp value={p2.acc}     onChange={v => sp2('acc',v)}/></Field>
          <Field label="Address"><Inp value={p2.addr}    onChange={v => sp2('addr',v)}/></Field>
          <div style={{...T.sectionHdr, marginTop:14}}>Programme</div>
          <Field label="Section Title"><Inp value={p2.progTtl} onChange={v => sp2('progTtl',v)}/></Field>
          <div style={{...T.sectionHdr, marginTop:14}}>Date / Time Bar</div>
          <Field label="Date">      <Inp value={p2.date}  onChange={v => sp2('date',v)}/></Field>
          <Field label="Start Time"><Inp value={p2.time}  onChange={v => sp2('time',v)}/></Field>
          <Field label="Venue Note"><Inp value={p2.venue} onChange={v => sp2('venue',v)}/></Field>
        </div>
        <div style={{...T.colWide, maxWidth:360}}>
          <div style={T.sectionHdr}>Programme Items</div>
          {progs.map((pg, i) => (
            <div key={i} style={T.dcard}>
              <div style={T.dcLbl}>Item {i+1}</div>
              <button style={T.remBtn} onClick={() => delProg(i)}>✕</button>
              <div style={{display:'flex', gap:6, marginBottom:4}}>
                <div style={{flex:'0 0 80px'}}><Inp value={pg.time} onChange={v => updProg(i,'time',v)}/></div>
                <div style={{flex:1}}><Inp value={pg.name} onChange={v => updProg(i,'name',v)}/></div>
              </div>
              <Inp value={pg.sub} onChange={v => updProg(i,'sub',v)}/>
            </div>
          ))}
          <button style={T.addBtn} onClick={addProg}>+ Add Item</button>
        </div>
        <div style={T.col}>
          <div style={T.sectionHdr}>Footer (Page 2)</div>
          <Field label="Footer Left"> <Inp value={p2.ftrl} onChange={v => sp2('ftrl',v)}/></Field>
          <Field label="Footer Right"><Inp value={p2.ftrr} onChange={v => sp2('ftrr',v)}/></Field>
        </div>
      </>
    )

    if (tab === 'fonts') return (
      <>
        {FS_CONFIG.map(group => (
          <div key={group.section} style={{...T.col, minWidth:180, maxWidth:210}}>
            <div style={T.sectionHdr}>{group.section}</div>
            {group.items.map(item => (
              <FsRow key={item.key} label={item.label} fsKey={item.key}
                value={fs[item.key]} min={item.min} max={item.max} onChange={setFsKey}/>
            ))}
          </div>
        ))}
      </>
    )

    if (tab === 'colors') return (
      <>
        <div style={T.col}>
          <div style={T.sectionHdr}>Theme Colors</div>
          <Field label="Background / Navy">
            <div style={T.colorRow}>
              <input type="color" value={colors.navy} onChange={e => setColor('navy', e.target.value)}
                style={{ width:30, height:30, padding:2, borderRadius:4, border:'1px solid rgba(196,150,42,0.2)', background:'#0e0c09', cursor:'pointer' }}/>
              <span style={T.colorDesc}>Headers &amp; bands</span>
            </div>
          </Field>
          <Field label="Primary Gold">
            <div style={T.colorRow}>
              <input type="color" value={colors.gold} onChange={e => setColor('gold', e.target.value)}
                style={{ width:30, height:30, padding:2, borderRadius:4, border:'1px solid rgba(196,150,42,0.2)', background:'#0e0c09', cursor:'pointer' }}/>
              <span style={T.colorDesc}>Borders &amp; accents</span>
            </div>
          </Field>
          <Field label="Light Gold">
            <div style={T.colorRow}>
              <input type="color" value={colors.gold2} onChange={e => setColor('gold2', e.target.value)}
                style={{ width:30, height:30, padding:2, borderRadius:4, border:'1px solid rgba(196,150,42,0.2)', background:'#0e0c09', cursor:'pointer' }}/>
              <span style={T.colorDesc}>Highlights &amp; labels</span>
            </div>
          </Field>
          <button onClick={() => setColors(DEFAULT_COLORS)}
            style={{ marginTop:8, padding:'5px 12px', fontFamily:"'Cinzel',serif", fontWeight:600,
              fontSize:'7px', letterSpacing:'1.5px', textTransform:'uppercase',
              borderRadius:3, cursor:'pointer', border:'1px solid rgba(196,150,42,0.25)',
              background:'rgba(196,150,42,0.1)', color:'#E0BC6A' }}>
            Reset Colors
          </button>
          <div style={{...T.sectionHdr, marginTop:14}}>Print Mode</div>
          <label style={{ display:'flex', alignItems:'center', gap:10,
            background:'rgba(196,150,42,0.05)', border:'1px solid rgba(196,150,42,0.12)',
            borderRadius:5, padding:'9px 10px', cursor:'pointer' }}>
            <div style={{ position:'relative', width:36, height:18, flexShrink:0 }}>
              <input type="checkbox" checked={lessInk} onChange={e => setLessInk(e.target.checked)}
                style={{ opacity:0, width:0, height:0, position:'absolute' }}/>
              <div style={{ position:'absolute', inset:0, borderRadius:9,
                background: lessInk ? '#C4962A' : 'rgba(196,150,42,0.15)', transition:'background .2s' }}/>
              <div style={{ position:'absolute', top:3, left: lessInk ? 21 : 3, width:12, height:12,
                background:'#fff', borderRadius:'50%', transition:'left .2s' }}/>
            </div>
            <div>
              <div style={{ fontFamily:"'Raleway',sans-serif", fontWeight:700, fontSize:'9px',
                color:'rgba(245,237,200,0.8)' }}>Less Ink Mode</div>
              <div style={{ fontFamily:"'Raleway',sans-serif", fontSize:'8px',
                color:'rgba(196,150,42,0.45)' }}>White backgrounds for toner saving</div>
            </div>
          </label>
        </div>
      </>
    )
  }

  // ── Minimized strip shown when toolbar is hidden ──
  if (toolbarMinimized) {
    return (
      <div style={{
        display:'flex', flexDirection:'column',
        height: fullscreen ? '100vh' : 'calc(100vh - 60px)',
        background:'#0a0d14', overflow:'hidden',
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : 'auto',
        zIndex: fullscreen ? 9999 : 'auto',
      }}>
        {/* Thin restore strip */}
        <div
          onClick={() => setToolbarMinimized(false)}
          title="Restore editor toolbar"
          style={{
            height: 6, flexShrink:0, cursor:'pointer',
            background:'linear-gradient(90deg,transparent,#C4962A55,#C4962A,#C4962A55,transparent)',
            transition:'height .15s',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.height = '28px'
            e.currentTarget.querySelector('span').style.opacity = '1'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.height = '6px'
            e.currentTarget.querySelector('span').style.opacity = '0'
          }}
        >
          <span style={{
            fontFamily:"'Cinzel',serif", fontWeight:700, fontSize:'7px',
            letterSpacing:'3px', textTransform:'uppercase', color:'#E0BC6A',
            opacity:0, transition:'opacity .15s', whiteSpace:'nowrap',
          }}>▼ ✉ INVITATION STUDIO — CLICK TO RESTORE EDITOR ▼</span>
        </div>

        {/* Full preview */}
        <div style={{...T.preview, paddingTop:16}}>
          <style>{`:root{${cssVarsStyle}} ${PRINT_CARD_CSS} ${lessInk ? LESS_INK_CSS : ''}`}</style>
          <div style={cardsWrapStyle} ref={previewRef}>
            <InvCard p1={p1} members={members} colors={colors} lessInk={lessInk}/>
            <ProgCard p2={p2} progs={progs} colors={colors} lessInk={lessInk}/>
          </div>
        </div>

        {toast && (
          <div style={{
            position:'fixed', bottom:24, right:24, zIndex:99999,
            background:'#1e293b', border:'1px solid rgba(196,150,42,0.3)',
            color:'#f1f5f9', padding:'10px 18px', borderRadius:8,
            fontFamily:'sans-serif', fontSize:13, fontWeight:500,
            boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
          }}>{toast}</div>
        )}
      </div>
    )
  }

  return (
    <div style={T.wrap}>

      {/* ══ ACTION BAR ══ */}
      <div style={T.actionBar}>
        <span style={T.brandLabel}>✉ Invitation Studio</span>
        <div style={T.divBar}/>

        <select style={T.slotSel} value={slot} onChange={e => setSlot(Number(e.target.value))}>
          {SLOT_LABELS.map((l,i) => <option key={i} value={i}>{l}</option>)}
        </select>
        <button style={T.actionBtn('save')}   onClick={saveSlot}>💾 Save</button>
        <button style={T.actionBtn('load')}   onClick={loadSlot}>📂 Load</button>
        <button style={T.actionBtn('export')} onClick={exportHTML}>⬇ Export</button>

        <div style={T.divBar}/>

        <div style={T.zoomWrap}>
          <span style={T.zoomLbl}>Zoom</span>
          <input type="range" min={0.3} max={1.2} step={0.02} value={previewZoom}
            onChange={e => setPreviewZoom(Number(e.target.value))}
            style={{ width:90, height:2, accentColor:'#C4962A', cursor:'pointer' }}/>
          <span style={T.zoomVal}>{Math.round(previewZoom * 100)}%</span>
          <button onClick={() => setPreviewZoom(0.72)}
            style={{ background:'none', border:'none', color:'rgba(196,150,42,0.4)',
              cursor:'pointer', fontFamily:"'Cinzel',serif", fontSize:'6.5px',
              letterSpacing:'1px', textTransform:'uppercase', padding:'2px 4px' }}>Reset</button>
        </div>

        {lessInk && (
          <span style={{ fontFamily:"'Raleway',sans-serif", fontSize:'7px', fontWeight:700,
            letterSpacing:'2px', textTransform:'uppercase', padding:'3px 9px',
            borderRadius:10, background:'rgba(46,125,50,0.25)', color:'#81c784',
            border:'1px solid rgba(46,125,50,0.3)' }}>◆ Less Ink</span>
        )}

        <div style={T.spacer}/>

        {/* ── Minimize toolbar ── */}
        <button
          onClick={() => setToolbarMinimized(true)}
          title="Minimize editor — maximum preview space"
          style={{
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(196,150,42,0.08)',
            border:'1px solid rgba(196,150,42,0.2)',
            borderRadius:5, cursor:'pointer', color:'#E0BC6A',
            transition:'all .15s', flexShrink:0,
          }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="4" y1="12" x2="20" y2="12"/>
          </svg>
        </button>

        {/* ── Fullscreen toggle ── */}
        <button
          onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? 'Exit Fullscreen (Esc)' : 'Expand to Fullscreen'}
          style={{
            width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center',
            background: fullscreen ? 'rgba(196,150,42,0.25)' : 'rgba(196,150,42,0.08)',
            border:`1px solid ${fullscreen ? 'rgba(196,150,42,0.55)' : 'rgba(196,150,42,0.2)'}`,
            borderRadius:5, cursor:'pointer',
            color: fullscreen ? '#fbbf24' : '#E0BC6A',
            transition:'all .15s', marginRight:8, flexShrink:0,
          }}>
          <ExpandIcon/>
        </button>

        <button style={T.actionBtn('print')} onClick={handlePrint}>⎙ Print / PDF</button>
      </div>
      {/* ── END ACTION BAR ── */}

      {/* ══ TAB BAR ══ */}
      <div style={T.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={T.tabBtn(tab===t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <button style={T.collapseBtn} onClick={() => setPanelOpen(o => !o)}>
          {panelOpen ? '▲ Collapse' : '▼ Edit'}
        </button>
      </div>

      {/* ══ EDITOR PANEL ══ */}
      <div style={T.editorPanel}>
        <div style={T.editorScroll}>
          {renderPanelContent()}
        </div>
      </div>

      {/* ══ PREVIEW ══ */}
      <div style={T.preview}>
        <div style={T.chip}>
          A4 Landscape · 297 × 210 mm · Two A5 Cards
        </div>

        <style>{`:root{${cssVarsStyle}} ${PRINT_CARD_CSS} ${lessInk ? LESS_INK_CSS : ''}`}</style>

        <div style={cardsWrapStyle} ref={previewRef}>
          <InvCard p1={p1} members={members} colors={colors} lessInk={lessInk}/>
          <ProgCard p2={p2} progs={progs} colors={colors} lessInk={lessInk}/>
        </div>
      </div>

      {/* ══ TOAST ══ */}
      {toast && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:99999,
          background:'#1e293b', border:'1px solid rgba(196,150,42,0.3)',
          color:'#f1f5f9', padding:'10px 18px', borderRadius:8,
          fontFamily:'sans-serif', fontSize:13, fontWeight:500,
          boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}
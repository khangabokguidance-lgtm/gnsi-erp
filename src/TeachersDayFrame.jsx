import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import emblemUrl from './assets/gnsi-emblem.png'

const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=Playfair+Display:ital,wght@0,700;0,900;1,500&family=Kaushan+Script&family=Caveat:wght@500;700&display=swap'

// Real GNSI emblem (transparent cut-out of the official logo).
const Emblem = ({ className }) => <img className={className} src={emblemUrl} alt="" />

const CSS = `
.tdf-page{width:210mm;height:297mm;position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 38%,var(--bg1) 0%,var(--bg2) 38%,var(--bg3) 80%);font-family:'Cormorant Garamond',Georgia,serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;break-after:page}
.tdf-page:before{content:"";position:absolute;inset:0;opacity:.07;background:repeating-linear-gradient(45deg,#d9b25a 0 1px,transparent 1px 14px),repeating-linear-gradient(-45deg,#d9b25a 0 1px,transparent 1px 14px)}
.tdf-b1,.tdf-b2,.tdf-b3{position:absolute;pointer-events:none}
.tdf-b1{inset:7mm;border:1.6mm solid transparent;border-image:linear-gradient(135deg,#f6e3a1,#a77d2a,#f6e3a1,#a77d2a) 1}
.tdf-b2{inset:11.5mm;border:.5mm solid #d9b25a}.tdf-b3{inset:14mm;border:.25mm dashed #d9b25a99}
.tdf-corner{position:absolute;width:30mm;height:30mm;pointer-events:none}
.tdf-corner svg{width:100%;height:100%}
.tdf-content{position:absolute;inset:18mm 20mm;display:flex;flex-direction:column;align-items:center;text-align:center;color:var(--tx)}
.tdf-logo{width:22mm;height:22mm;border-radius:50%;border:.8mm solid #d9b25a;object-fit:contain;padding:1.6mm;box-sizing:border-box;background:radial-gradient(circle at 50% 40%,#1d4590,#08183a);box-shadow:0 0 0 1.2mm var(--bg3),0 0 0 1.8mm #d9b25a}
.tdf-inst{font:700 4.6mm 'Cinzel',serif;letter-spacing:.9mm;margin-top:4mm;color:var(--ac)}
.tdf-inst small{display:block;font-size:2.8mm;letter-spacing:.7mm;color:var(--tx);font-weight:500;margin-top:1mm}
.tdf-rule{display:flex;align-items:center;gap:3mm;margin-top:3.5mm}
.tdf-rule i{height:.3mm;width:38mm;background:linear-gradient(90deg,transparent,#d9b25a)}.tdf-rule i:last-child{transform:scaleX(-1)}
.tdf-rule b{width:2.2mm;height:2.2mm;background:#d9b25a;transform:rotate(45deg)}
.tdf-happy{font:400 22mm/1 'Great Vibes',cursive;margin-top:5mm;background:linear-gradient(180deg,var(--g1),var(--g2) 55%,var(--g3));-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-td{font:900 10.5mm 'Cinzel',serif;letter-spacing:2.2mm;margin-top:1mm;color:var(--tx);text-shadow:var(--ts)}
.tdf-photo-wrap{flex-shrink:0;position:relative;margin-top:var(--mt);width:var(--pw);height:var(--ph)}
.tdf-ring{position:absolute;inset:0;border-radius:var(--r1);background:linear-gradient(135deg,#f6e3a1,#a77d2a 40%,#f6e3a1 60%,#a77d2a);padding:2.4mm;box-shadow:0 3mm 9mm #000c,0 0 14mm #d9b25a55}
.tdf-ring2{width:100%;height:100%;border-radius:var(--r2);background:var(--bg3);padding:1.4mm}
.tdf-photo{width:100%;height:100%;border-radius:var(--r3);overflow:hidden;background:#eef0f4;position:relative}
.tdf-photo img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.tdf-ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#a9afbd}
.tdf-ph svg{width:34mm}
.tdf-star{position:absolute;color:#d9b25a;font-size:7mm}
.tdf-name{font:700 9mm 'Cinzel',serif;margin-top:calc(var(--nmt) + 6mm);letter-spacing:.8mm;color:var(--nm);text-shadow:var(--ts);max-width:165mm}
.tdf-desig{font:italic 600 6.2mm 'Cormorant Garamond',serif;color:var(--ac);margin-top:1.5mm}
.tdf-quote{font:italic 500 5.2mm/1.3 'Cormorant Garamond',serif;margin-top:5mm;max-width:150mm;color:var(--tx)}
.tdf-foot{margin-top:auto;width:100%;padding-top:4mm}
.tdf-dates{display:inline-block;border:.4mm solid #d9b25a;padding:2.6mm 9mm;background:linear-gradient(90deg,#d9b25a22,#d9b25a44,#d9b25a22);font:700 5mm 'Cinzel',serif;letter-spacing:.6mm;color:var(--nm)}
.tdf-dates sup,.tdf-batch sup{font-size:.55em;line-height:0;vertical-align:super;letter-spacing:0}
.tdf-pres{font:500 3.6mm 'Cinzel',serif;letter-spacing:1.2mm;margin-top:4mm;color:var(--ac)}
.tdf-batch{font:400 11mm/1.1 'Great Vibes',cursive;color:var(--tx);margin-top:1mm}
.tdf-batch b{font:900 9mm 'Cinzel',serif;color:var(--ac)}
.tdf-orn{position:absolute;inset:-5mm;border:.4mm solid #d9b25a;border-radius:var(--r1);pointer-events:none;display:var(--orn)}
.tdf-rb{padding:1.6mm 16mm;border-top:.35mm solid var(--ac);border-bottom:.35mm solid var(--ac);background:linear-gradient(90deg,transparent,color-mix(in srgb,var(--ac) 22%,transparent),transparent)}
.tdf-laurel{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;overflow:visible}
.tdf-bokeh{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.tdf-bokeh i{position:absolute;border-radius:50%;background:radial-gradient(circle,var(--ac),transparent 70%);opacity:.28}
.tdf-crest{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(100% - 2mm);pointer-events:none}
.tdf-scroll{position:absolute;width:11mm;pointer-events:none}
.tdf-halo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none}
.tdf-flour{position:absolute;left:50%;transform:translateX(-50%);top:calc(100% + 1mm);pointer-events:none}
.tdf-wm{position:absolute;left:50%;top:50%;width:150mm;height:150mm;object-fit:contain;transform:translate(-50%,-50%);opacity:.12;mix-blend-mode:var(--wmb);pointer-events:none;}
.tdf-aw{background:#fbf6e9!important}
.tdf-aw:before{opacity:.05}
.tdf-aw .tdf-awc{position:absolute;inset:20mm 24mm 18mm;display:flex;flex-direction:column;align-items:center;text-align:center;color:#2b2a33}
.tdf-aw-rib{position:absolute;left:26mm;top:14mm;width:15mm;height:60mm;background:linear-gradient(90deg,#0a1a40,#16336e 50%,#0a1a40);clip-path:polygon(0 0,100% 0,100% 100%,50% 88%,0 100%);box-shadow:0 2mm 3mm #0004}
.tdf-aw-seal{position:absolute;left:21mm;top:50mm;width:26mm;height:26mm;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff3c4,#d9b25a 55%,#8a6414);padding:2.2mm;box-shadow:0 1.5mm 3mm #0006;z-index:3}
.tdf-aw-seal div{width:100%;height:100%;border-radius:50%;background:radial-gradient(circle at 50% 40%,#1d4590,#08183a);border:.5mm solid #f6e3a1;padding:1.6mm;box-sizing:border-box}
.tdf-aw-seal img{width:100%;height:100%;object-fit:contain}
.tdf-aw-inst{font:700 3.4mm 'Cinzel',serif;letter-spacing:1mm;color:#9a6f1c;margin-top:2mm}
.tdf-aw-the{font:600 4mm 'Cinzel',serif;letter-spacing:1.5mm;color:#0d2350;margin-top:11mm;display:flex;align-items:center;gap:3mm}
.tdf-aw-the i{width:16mm;height:.3mm;background:#b8892b}
.tdf-aw-best{font:900 34mm/.95 'Playfair Display',serif;color:#0d2350;letter-spacing:-.5mm}
.tdf-aw-teacher{font:400 25mm/1 'Great Vibes',cursive;margin-top:-11mm;background:linear-gradient(180deg,#d8a93f,#9a6f1c);-webkit-background-clip:text;background-clip:text;color:transparent;position:relative}
.tdf-aw-award{font:700 6mm 'Cinzel',serif;letter-spacing:2mm;color:#0d2350;margin-top:1mm}
.tdf-aw-pres{font:italic 500 5mm 'Cormorant Garamond',serif;color:#5a3f10;margin-top:8mm}
.tdf-aw-name{font:italic 700 12mm/1.1 'Playfair Display',serif;color:#0d2350;margin-top:2mm;max-width:160mm}
.tdf-aw-line{width:60mm;height:.4mm;background:linear-gradient(90deg,transparent,#b8892b,transparent);margin-top:3mm}
.tdf-aw-msg{font:500 4.6mm/1.45 'Cormorant Garamond',serif;color:#3b3a44;margin-top:5mm;max-width:132mm}
.tdf-aw-bot{margin-top:auto;width:100%;display:flex;justify-content:space-between;align-items:flex-end}
.tdf-aw-left{flex:1;min-width:0;text-align:left;padding-bottom:6mm;padding-right:4mm}
.tdf-aw-left .u{font:italic 500 4.4mm/1.4 'Cormorant Garamond',serif;color:#3b3a44}
.tdf-aw-left .sg{font:400 7mm/1.1 'Great Vibes',cursive;color:#9a6f1c;margin-top:7mm}
.tdf-aw-left .dt{display:inline-block;margin-top:5mm;border:.35mm solid #b8892b;padding:1.8mm 5mm;font:700 3.6mm 'Cinzel',serif;letter-spacing:.5mm;color:#0d2350}
.tdf-aw-left .pb{font:500 3mm 'Cinzel',serif;letter-spacing:1mm;color:#9a6f1c;margin-top:3mm}
.tdf-aw-left .bt{font:400 9mm/1.1 'Great Vibes',cursive;color:#0d2350}
.tdf-aw-left .bt b{font:900 7mm 'Cinzel',serif;color:#9a6f1c}
.tdf-aw-left .bt sup,.tdf-aw-left .dt sup{font-size:.55em;line-height:0;vertical-align:super}
.tdf-aw-ph{position:relative;width:66mm;height:84mm;margin-right:6mm;flex-shrink:0}
.tdf-aw-wash{position:absolute;inset:-6mm;background:radial-gradient(ellipse at 30% 25%,#e7c777aa,transparent 55%),radial-gradient(ellipse at 75% 70%,#d9b25a88,transparent 55%),radial-gradient(ellipse at 50% 50%,#f1dfae,transparent 70%);filter:blur(2.5mm);border-radius:50%}
.tdf-aw-oval{position:absolute;inset:0;border-radius:50%;padding:1.6mm;background:linear-gradient(135deg,#f6e3a1,#a77d2a 40%,#f6e3a1 60%,#a77d2a);box-shadow:0 2mm 6mm #0004}
.tdf-aw-oval div{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#eef0f4;border:1mm solid #fbf6e9}
.tdf-aw-oval img:not(.m){width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.tdf-aw-sprig{position:absolute;right:-9mm;bottom:2mm;width:22mm;height:70mm;pointer-events:none}
.tdf-aw-sprig2{position:absolute;left:-9mm;top:4mm;width:20mm;height:50mm;pointer-events:none;transform:scaleX(-1) rotate(180deg)}
.tdf-sp{background:#fffdf8!important}
.tdf-sp:before{opacity:.0}
.tdf-sp .tdf-spc{position:absolute;inset:20mm 22mm 18mm;display:flex;flex-direction:column;align-items:center;text-align:center;color:#2a2230}
.tdf-sp-inst{display:flex;align-items:center;gap:3mm;font:700 3.3mm 'Cinzel',serif;letter-spacing:.9mm;color:#7a5a14}
.tdf-sp-inst img{width:11mm;height:11mm;object-fit:contain;padding:1mm;box-sizing:border-box;border-radius:50%;background:radial-gradient(circle at 50% 40%,#1d4590,#08183a);border:.4mm solid #d9b25a}
.tdf-sp-happy{font:400 15mm/1 'Great Vibes',cursive;color:#c0392b;margin-top:9mm}
.tdf-sp-td{font:400 27mm/.9 'Kaushan Script',cursive;color:#241b2d;margin-top:-1mm;text-shadow:.5mm .5mm 0 #d9b25a66}
.tdf-sp-td i{color:#c0392b;font-style:normal}
.tdf-sp-ph{position:relative;width:104mm;height:118mm;margin-top:6mm;flex-shrink:0}
.tdf-sp-ph svg.bl{position:absolute;inset:-7mm;width:calc(100% + 14mm);height:calc(100% + 14mm)}
.tdf-sp-img{position:absolute;inset:0;clip-path:url(#tdfBlob);background:#e9ecf1}
.tdf-sp-img img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.tdf-sp-img .tdf-ph{color:#a9afbd}
.tdf-sp-name{font:700 10mm 'Playfair Display',serif;color:#241b2d;margin-top:9mm;letter-spacing:.3mm}
.tdf-sp-des{font:italic 600 5.4mm 'Cormorant Garamond',serif;color:#9a6f1c;margin-top:1mm}
.tdf-sp-q{font:500 8.6mm/1.12 'Caveat',cursive;color:#2d2433;margin-top:6mm;max-width:150mm;transform:rotate(-1.5deg)}
.tdf-sp-ft{margin-top:auto;width:100%;border-top:.35mm solid #d9b25a;padding-top:3.5mm;display:flex;justify-content:space-between;align-items:center;font:700 3.6mm 'Cinzel',serif;letter-spacing:.5mm;color:#241b2d}
.tdf-sp-ft span{color:#9a6f1c;font:400 8mm 'Great Vibes',cursive;letter-spacing:0}
.tdf-sp-ft b{font:900 5mm 'Cinzel',serif;color:#9a6f1c}
.tdf-sp-ft sup{font-size:.55em;line-height:0;vertical-align:super}
.tdf-sp-deco{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.tdf-sp-wash{position:absolute;border-radius:50%;filter:blur(7mm)}
.tdf-sp-icons{display:flex;gap:5mm;align-items:center;margin-top:5mm}
.tdf-sp-icons svg{width:9mm;height:9mm}
.tdf-sp-swoosh{width:120mm;height:7mm;margin-top:1mm}
.tdf-lx{background:radial-gradient(ellipse at 50% 35%,#24242e 0%,#101015 55%,#050507 100%)!important}
.tdf-lx:before{opacity:.05}
.tdf-lx .tdf-spc{color:#f6e3a1}
.tdf-lx .tdf-sp-inst{color:#e2bf68}
.tdf-lx .tdf-sp-happy{color:#e2bf68;background:linear-gradient(180deg,#fff3c4,#d9b25a 55%,#a77d2a);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-lx .tdf-sp-td{color:#f6e3a1;background:linear-gradient(180deg,#fff7d6 5%,#e8c66a 45%,#a77d2a 55%,#f6e3a1 90%);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 .6mm .8mm #000a)}
.tdf-lx .tdf-sp-td i{color:transparent}
.tdf-lx .tdf-sp-name{color:#fff;text-shadow:0 .5mm 1mm #000}
.tdf-lx .tdf-sp-des{color:#e2bf68}
.tdf-lx .tdf-sp-q{color:#f6e3a1}
.tdf-lx .tdf-sp-ft{color:#f6e3a1;border-color:#d9b25a}
.tdf-lx .tdf-sp-ft span,.tdf-lx .tdf-sp-ft b{color:#e2bf68}
.tdf-lx .tdf-sp-icons svg{filter:grayscale(1) sepia(1) saturate(3.5) brightness(1.25) hue-rotate(-8deg)}
.tdf-lx .tdf-sp-img{background:#1a1a22}
.tdf-lx .tdf-sp-deco svg{filter:grayscale(1) sepia(1) saturate(3) brightness(1.25)}
.tdf-fm{background:radial-gradient(ellipse at 50% 30%,#14346e,#0a1d46 60%,#061330)!important}
.tdf-fm:before{opacity:0}
.tdf-fm-gold{position:absolute;inset:6mm;clip-path:polygon(10mm 0,calc(100% - 10mm) 0,100% 10mm,100% calc(100% - 10mm),calc(100% - 10mm) 100%,10mm 100%,0 calc(100% - 10mm),0 10mm);background:linear-gradient(135deg,#f6e3a1,#a77d2a 30%,#f6e3a1 55%,#b8892b 80%,#f6e3a1)}
.tdf-fm-in{position:absolute;inset:8.4mm;clip-path:polygon(8.5mm 0,calc(100% - 8.5mm) 0,100% 8.5mm,100% calc(100% - 8.5mm),calc(100% - 8.5mm) 100%,8.5mm 100%,0 calc(100% - 8.5mm),0 8.5mm);background:#0a1d46}
.tdf-fm-pn{position:absolute;inset:10.6mm;clip-path:polygon(7mm 0,calc(100% - 7mm) 0,100% 7mm,100% calc(100% - 7mm),calc(100% - 7mm) 100%,7mm 100%,0 calc(100% - 7mm),0 7mm);background:radial-gradient(ellipse at 50% 35%,#fffefa,#fbf7ec 70%,#f3ead3)}
.tdf-fm-ln{position:absolute;inset:14.5mm;border:.35mm solid #c79a3b;clip-path:polygon(6mm 0,calc(100% - 6mm) 0,100% 6mm,100% calc(100% - 6mm),calc(100% - 6mm) 100%,6mm 100%,0 calc(100% - 6mm),0 6mm)}
.tdf-fmc{position:absolute;inset:18mm 22mm 17mm;display:flex;flex-direction:column;align-items:center;text-align:center;color:#142a5c}
.tdf-fm-top{width:100%;padding:0 4mm;box-sizing:border-box;display:flex;justify-content:space-between;align-items:flex-start}
.tdf-fm-top .l{width:46mm;text-align:left;font:italic 500 4.2mm/1.25 'Cormorant Garamond',serif;color:#7a4e12;padding-top:5mm}
.tdf-fm-top .r{width:46mm;text-align:right;font:600 4mm/1.3 'Cormorant Garamond',serif;color:#7a4e12;letter-spacing:.3mm;padding-top:3mm}
.tdf-fm-em{width:30mm;height:30mm;border-radius:50%;padding:3mm;box-sizing:border-box;object-fit:contain;background:radial-gradient(circle at 50% 40%,#1d4590,#08183a);border:1mm solid #d9b25a;box-shadow:0 0 0 1.2mm #fbf7ec,0 0 0 1.8mm #c79a3b}
.tdf-fm-inst{font:900 8.2mm 'Playfair Display',serif;letter-spacing:-.1mm;color:#142a5c;margin-top:3mm;white-space:nowrap}
.tdf-fm-tag{font:600 3.3mm 'Cinzel',serif;letter-spacing:1.1mm;color:#142a5c;margin-top:1.5mm}
.tdf-fm-tag b{color:#c79a3b;margin:0 2mm}
.tdf-fm-happy{font:400 17mm/1 'Great Vibes',cursive;background:linear-gradient(180deg,#d8a93f,#8a5d12);-webkit-background-clip:text;background-clip:text;color:transparent;margin-top:2mm}
.tdf-fm-title{font:900 13mm/1 'Playfair Display',serif;color:#0d2350;letter-spacing:-.3mm;margin-top:-2mm;white-space:nowrap}
.tdf-fm-grat{font:600 3.6mm 'Cinzel',serif;letter-spacing:1.5mm;color:#1d3f87;margin-top:2.5mm}
.tdf-fm-ph{width:42mm;height:42mm;margin-top:4mm;border-radius:50%;padding:1.4mm;background:linear-gradient(135deg,#f6e3a1,#a77d2a 40%,#f6e3a1 60%,#a77d2a);box-shadow:0 1.5mm 4mm #0004;flex-shrink:0}
.tdf-fm-ph>div{position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;border:.9mm solid #fbf7ec;background:#eef0f4}
.tdf-fm-ph img{width:100%;height:100%;object-fit:cover;object-position:center top;display:block}
.tdf-fm-pre{font:500 5mm 'Cormorant Garamond',serif;color:#1d3f87;margin-top:7mm}
.tdf-fm-name{font:400 11mm/1.1 'Kaushan Script',cursive;color:#111;margin-top:1mm;max-width:165mm}
.tdf-fm-nl{width:140mm;height:.4mm;background:linear-gradient(90deg,transparent,#1d3f87,transparent);margin-top:1.5mm}
.tdf-fm-des{font:italic 600 4.8mm 'Cormorant Garamond',serif;color:#7a4e12;margin-top:1.5mm}
.tdf-fm-msg{font:500 4.1mm/1.38 'Cormorant Garamond',serif;color:#1d3f87;margin-top:3.5mm;max-width:140mm}
.tdf-fm-sg{margin-top:auto;width:100%;display:flex;flex-direction:column;align-items:center;gap:1mm;padding-bottom:1.5mm}
.tdf-fm-sg .p1{font:600 3.4mm 'Cinzel',serif;letter-spacing:1.4mm;color:#7a4e12}
.tdf-fm-sg .p2{font:400 11mm/1.1 'Great Vibes',cursive;color:#0d2350}
.tdf-fm-sg .p2 b{font:900 8.5mm 'Cinzel',serif;color:#c79a3b}
.tdf-fm-sg .p3{font:700 3.6mm 'Cinzel',serif;letter-spacing:.8mm;color:#142a5c;border-top:.35mm solid #c79a3b;padding-top:1.5mm;margin-top:.5mm}
.tdf-fm-stamp{width:25mm;height:25mm;flex-shrink:0}
.tdf-fm-guil{position:absolute;inset:10.6mm;opacity:.5;pointer-events:none;clip-path:polygon(7mm 0,calc(100% - 7mm) 0,100% 7mm,100% calc(100% - 7mm),calc(100% - 7mm) 100%,7mm 100%,0 calc(100% - 7mm),0 7mm)}
.tdf-fm-wm{position:absolute;left:50%;top:52%;width:138mm;height:138mm;transform:translate(-50%,-50%);object-fit:contain;opacity:.07;mix-blend-mode:multiply;filter:grayscale(1) brightness(.35);pointer-events:none}
.tdf-fm-orn{position:absolute;width:17mm;height:17mm;pointer-events:none}
.tdf-fm-div{display:flex;justify-content:center;margin-top:2mm}
.tdf-fm-phw{position:relative;margin-top:7mm;flex-shrink:0}
.tdf-fm-phw .tdf-laurel{z-index:0}
.tdf-fm-phw .tdf-fm-ph{position:relative;z-index:1;margin-top:0}
.tdf-fm-ttl{display:flex;align-items:center;gap:4mm;width:100%;justify-content:center}
.tdf-fm-ttl i{height:.5mm;flex:1;max-width:30mm;background:linear-gradient(90deg,transparent,#c79a3b)}
.tdf-fm-ttl i:last-child{transform:scaleX(-1)}
.tdf-fm-ttl b{width:2.2mm;height:2.2mm;background:#c79a3b;transform:rotate(45deg)}
.tdf-fm{background:radial-gradient(ellipse at 20% 0%,#2a5cc0aa,transparent 55%),radial-gradient(ellipse at 90% 100%,#1b4aa088,transparent 55%),linear-gradient(135deg,#0a2559,#123a80 45%,#061636)!important}
.tdf-fm-pn{background:radial-gradient(ellipse at 50% 0%,#dbe8ff99,transparent 45%),radial-gradient(ellipse at 50% 100%,#f1d9a066,transparent 50%),linear-gradient(180deg,#fffefa,#fbf6e8 55%,#f4e9cd)!important}
.tdf-fm-inst,.tdf-fm-title{background:linear-gradient(180deg,#2b5dc4 0%,#0d2350 55%,#06143a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-fm-name{padding:0 5mm 1.5mm;background:linear-gradient(180deg,#2b2b3a,#000 70%);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-fm-grat{background:linear-gradient(90deg,#1d3f87,#9a6f1c 50%,#1d3f87);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-fm-sg .p1{background:linear-gradient(90deg,#7a4e12,#d8a93f 50%,#7a4e12);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-fm-sg .p2{background:linear-gradient(180deg,#2b5dc4,#0d2350);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-fm-sg .p2 b{background:linear-gradient(180deg,#f0cf74,#a77d2a);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-fm-sg .p3{background:linear-gradient(90deg,#142a5c,#2b5dc4,#142a5c);-webkit-background-clip:text;background-clip:text;color:transparent}
.tdf-fm-ttl i{background:linear-gradient(90deg,transparent,#a77d2a,#f0cf74)}
.tdf-fm-ttl b{background:linear-gradient(135deg,#f0cf74,#a77d2a)}
.tdf-fm-nl{background:linear-gradient(90deg,transparent,#2b5dc4,#c79a3b,#2b5dc4,transparent)!important;height:.6mm!important}
.tdf-fm-em{background:radial-gradient(circle at 35% 25%,#3a73d8,#1d4590 45%,#06142f)!important}
.tdf-print{display:none}
@media print{
  @page{size:A4 portrait;margin:0}
  body>*:not(.tdf-print){display:none!important}
  .tdf-print{display:block!important}
}
`

const STYLES = {
  arch:   { label: 'Royal Arch (navy)',      bg: ['#17356f', '#0d2350', '#07142e'], pw: '104mm', ph: '128mm', r: ['52mm 52mm 4mm 4mm', '50mm 50mm 2.5mm 2.5mm', '48.6mm 48.6mm 1.4mm 1.4mm'], orn: 'none' },
  round:  { label: 'Round Medallion (navy)', bg: ['#17356f', '#0d2350', '#07142e'], pw: '112mm', ph: '112mm', r: ['50%', '50%', '50%'], orn: 'block' },
  rect:   { label: 'Classic Rectangle (navy)', bg: ['#17356f', '#0d2350', '#07142e'], pw: '104mm', ph: '128mm', r: ['3mm', '2mm', '1mm'], orn: 'block' },
  maroon: { label: 'Maroon Heritage (arch)', bg: ['#7a1d2e', '#55101e', '#2f0710'], pw: '104mm', ph: '128mm', r: ['52mm 52mm 4mm 4mm', '50mm 50mm 2.5mm 2.5mm', '48.6mm 48.6mm 1.4mm 1.4mm'], orn: 'none' },
  maroonround: { label: 'Maroon Heritage (round)', bg: ['#7a1d2e', '#55101e', '#2f0710'], pw: '112mm', ph: '112mm', r: ['50%', '50%', '50%'], orn: 'block' },
}
const BASE = { mt: '7mm', nmt: '8mm', tx: '#f6e3a1', nm: '#fff', ac: '#d9b25a', g: ['#fff3c4', '#d9b25a', '#a77d2a'], ts: '0 .5mm 1mm #000a' }
Object.assign(STYLES, {
  formal: { label: '📜 Formal Certificate (navy & gold border)', bg: ['#14346e', '#0a1d46', '#061330'], pw: '46mm', ph: '46mm', r: ['50%', '50%', '50%'], orn: 'none' },
  luxe: { label: '👑 Luxe Gold Foil (black & gold, brush photo)', bg: ['#24242e', '#101015', '#050507'], pw: '104mm', ph: '118mm', r: ['50%', '50%', '50%'], orn: 'none' },
  splash: { label: '🎨 Painted Portrait (white, brush edge)', bg: ['#fffdf8', '#fffdf8', '#f2ead6'], pw: '112mm', ph: '128mm', r: ['50%', '50%', '50%'], orn: 'none', tx: '#241b2d', nm: '#241b2d', ac: '#9a6f1c', ts: 'none', wmb: 'multiply' },
  award: { label: '🏆 Best Teacher Award (certificate)', bg: ['#fffdf6', '#f6edd6', '#e6d7ab'], pw: '78mm', ph: '94mm', r: ['50%', '50%', '50%'], orn: 'none', tx: '#5a3f10', nm: '#0d2350', ac: '#9a6f1c', g: ['#d8a93f', '#9a6f1c', '#6b4a0f'], ts: 'none', wmb: 'multiply' },
  corelnavy: { label: '🎨 Vector Masterpiece (navy & gold)', bg: ['#1a3a78', '#0d2350', '#050f26'], pw: '74mm', ph: '84mm', r: ['37mm 37mm 4mm 4mm', '35mm 35mm 2.5mm 2.5mm', '33.6mm 33.6mm 1.4mm 1.4mm'], orn: 'none', mt: '14mm', nmt: '10mm', vec: true, ribbon: true, bokeh: true },
  corelivory: { label: '🎨 Vector Masterpiece (ivory & gold)', bg: ['#fffdf6', '#f6edd6', '#e6d7ab'], pw: '74mm', ph: '84mm', r: ['37mm 37mm 4mm 4mm', '35mm 35mm 2.5mm 2.5mm', '33.6mm 33.6mm 1.4mm 1.4mm'], orn: 'none', mt: '14mm', nmt: '10mm', tx: '#5a3f10', nm: '#0d2350', ac: '#9a6f1c', g: ['#d8a93f', '#9a6f1c', '#6b4a0f'], ts: 'none', wmb: 'multiply', vec: true, ribbon: true, bokeh: true },
  corelmaroon: { label: '🎨 Vector Masterpiece (maroon & gold)', bg: ['#8a2236', '#55101e', '#2a050d'], pw: '74mm', ph: '84mm', r: ['37mm 37mm 4mm 4mm', '35mm 35mm 2.5mm 2.5mm', '33.6mm 33.6mm 1.4mm 1.4mm'], orn: 'none', mt: '14mm', nmt: '10mm', vec: true, ribbon: true, bokeh: true },
  ivory: { label: '✨ Ivory Royale (light, laurel)', bg: ['#fffdf6', '#f6edd6', '#e6d7ab'], pw: '96mm', ph: '116mm', mt: '15mm', nmt: '15mm', r: ['52mm 52mm 4mm 4mm', '50mm 50mm 2.5mm 2.5mm', '48.6mm 48.6mm 1.4mm 1.4mm'], orn: 'none', tx: '#5a3f10', nm: '#0d2350', ac: '#9a6f1c', g: ['#d8a93f', '#9a6f1c', '#6b4a0f'], ts: 'none', wmb: 'multiply', laurel: true, ribbon: true, bokeh: true },
  aurora: { label: '✨ Midnight Aurora (round, laurel)', bg: ['#14505c', '#08262f', '#030d14'], pw: '98mm', ph: '98mm', mt: '15mm', nmt: '15mm', r: ['50%', '50%', '50%'], orn: 'block', tx: '#d8f3ee', nm: '#fff', ac: '#e6c46a', laurel: true, ribbon: true, bokeh: true },
  emerald: { label: '✨ Emerald Luxe (arch, laurel)', bg: ['#118060', '#0a4a38', '#042a20'], pw: '96mm', ph: '116mm', mt: '15mm', nmt: '15mm', r: ['52mm 52mm 4mm 4mm', '50mm 50mm 2.5mm 2.5mm', '48.6mm 48.6mm 1.4mm 1.4mm'], orn: 'none', ac: '#e2bf68', laurel: true, ribbon: true, bokeh: true },
})
// Passport-photo shape: 7:9 (35 x 45 mm) portrait rectangle, scaled up to fill the frame.
const PASSPORT = { pw: '61mm', ph: '78mm', r: ['3mm', '2mm', '1mm'], orn: 'block' }
const resolveStyle = (k, shape) => {
  const t = { ...BASE, ...(STYLES[k] || STYLES.arch) }
  return shape === 'passport' ? { ...t, ...PASSPORT, mt: t.laurel || t.vec ? '14mm' : t.mt, nmt: t.laurel || t.vec ? '10mm' : t.nmt } : t
}
const styleVars = (k, shape) => {
  const t = resolveStyle(k, shape)
  const g = t.g
  return { '--mt': t.mt, '--nmt': t.nmt, '--wmb': t.wmb || 'screen', '--tx': t.tx, '--nm': t.nm, '--ac': t.ac, '--ts': t.ts, '--g1': g[0], '--g2': g[1], '--g3': g[2], '--bg1': t.bg[0], '--bg2': t.bg[1], '--bg3': t.bg[2], '--pw': t.pw, '--ph': t.ph, '--r1': t.r[0], '--r2': t.r[1], '--r3': t.r[2], '--orn': t.orn }
}

const Corner = ({ flip }) => (
  <div className="tdf-corner" style={{ ...flip.pos, transform: flip.t }}>
    <svg viewBox="0 0 100 100"><g fill="none" stroke="#d9b25a" strokeWidth="1.6">
      <path d="M4 96V4h92" /><path d="M12 80V12h68" />
      <path d="M12 12c20 0 30 10 30 30M12 12c0 20 10 30 30 30" />
      <circle cx="12" cy="12" r="5" fill="#d9b25a" />
      <path d="M20 40c8-2 14 2 16 10M40 20c-2 8 2 14 10 16" />
    </g></svg>
  </div>
)
const CORNERS = [
  { pos: { top: '9mm', left: '9mm' }, t: 'none' },
  { pos: { top: '9mm', right: '9mm' }, t: 'scaleX(-1)' },
  { pos: { bottom: '9mm', left: '9mm' }, t: 'scaleY(-1)' },
  { pos: { bottom: '9mm', right: '9mm' }, t: 'scale(-1)' },
]

function Laurel({ w, h }) {
  const W = w + 34, H = h + 34, cx = W / 2, cy = H / 2, rx = w / 2 + 7, ry = h / 2 + 7, N = 15
  const leaves = []
  for (let side = 0; side < 2; side++) {
    for (let i = 0; i < N; i++) {
      const f = 0.2 + (i / (N - 1)) * 0.6, a = f * Math.PI
      const sg = side ? 1 : -1
      const x = cx + sg * rx * Math.sin(a), y = cy + ry * Math.cos(a)
      const tan = Math.atan2(-ry * Math.sin(a), sg * rx * Math.cos(a)) * 180 / Math.PI
      const sz = 5.2 - (i / N) * 1.6
      for (const o of [-1, 1]) {
        leaves.push(<ellipse key={`${side}-${i}-${o}`} cx={0} cy={0} rx={sz} ry={sz / 2.6} fill="url(#tdfLeaf)" transform={`translate(${x} ${y}) rotate(${tan + o * 38 + 180 * (side ? 0 : 1)}) translate(${sz} 0)`} />)
      }
    }
  }
  return (
    <svg className="tdf-laurel" width={`${W}mm`} height={`${H}mm`} viewBox={`0 0 ${W} ${H}`}>
      <defs><linearGradient id="tdfLeaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e3a1" /><stop offset=".55" stopColor="#d9b25a" /><stop offset="1" stopColor="#a77d2a" /></linearGradient></defs>
      {leaves}
    </svg>
  )
}
// ── CorelDRAW-style vector ornaments (filigree crest, side scrolls, mandala halo, flourish) ──
const HALF = 'M50 31C57 31 60 24 68 23C77 22 82 29 77 34C73 37 68 33 71 29M50 31C53 21 59 13 71 11C82 10 90 16 87 22C85 26 80 25 81 21M50 31C47 22 42 14 36 9M50 31C46 27 40 27 35 31C30 35 24 33 23 28M50 31C56 35 62 36 66 33';
const Crest = ({ w }) => (
  <svg className="tdf-crest" width={`${w}mm`} height={`${w * 0.42}mm`} viewBox="0 0 100 42" fill="none" stroke="url(#tdfG)" strokeWidth="1.3" strokeLinecap="round">
    <defs><linearGradient id="tdfG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e3a1" /><stop offset=".5" stopColor="#d9b25a" /><stop offset="1" stopColor="#a77d2a" /></linearGradient></defs>
    <path d={HALF} /><path d={HALF} transform="translate(100 0) scale(-1 1)" />
    <path d="M50 4C46 11 46 20 50 28C54 20 54 11 50 4Z" fill="url(#tdfG)" />
    <path d="M50 31l4 5-4 5-4-5z" fill="url(#tdfG)" /><circle cx="50" cy="1.6" r="1.6" fill="#f6e3a1" />
    {[[68, 23], [71, 11], [36, 9], [64, 33]].map(([x, y], i) => <g key={i}><circle cx={x} cy={y} r="1.3" fill="#f6e3a1" /><circle cx={100 - x} cy={y} r="1.3" fill="#f6e3a1" /></g>)}
  </svg>
)
const SCROLL = 'M7 2C2 8 12 12 7 20C3 26 11 30 7 38C4 44 12 48 9 56M9 56C13 62 6 64 4 59C3 56 6 54 8 56';
const Scrolls = ({ h }) => (
  <>
    {[0, 1].map(i => (
      <svg key={i} className="tdf-scroll" style={{ [i ? 'right' : 'left']: '-12mm', transform: i ? 'scaleX(-1)' : 'none', height: `${h * 0.55}mm`, top: `${h * 0.22}mm` }}
        viewBox="0 0 14 64" preserveAspectRatio="none" fill="none" stroke="url(#tdfG)" strokeWidth="1.3" strokeLinecap="round">
        <path d={SCROLL} /><circle cx="7" cy="2" r="1.2" fill="#f6e3a1" /><circle cx="7" cy="20" r="1" fill="#d9b25a" /><circle cx="7" cy="38" r="1" fill="#d9b25a" />
      </svg>
    ))}
  </>
)
const Halo = ({ w, h }) => {
  const R = Math.max(w, h) / 2 + 16, W = R * 2 + 4, rays = []
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * Math.PI * 2, r0 = R - (i % 2 ? 9 : 14)
    rays.push(<line key={i} x1={R + 2 + Math.cos(a) * r0} y1={R + 2 + Math.sin(a) * r0} x2={R + 2 + Math.cos(a) * R} y2={R + 2 + Math.sin(a) * R} strokeWidth={i % 2 ? '.35' : '.6'} />)
  }
  const petals = []
  for (let i = 0; i < 24; i++) petals.push(<ellipse key={i} cx={0} cy={-(R - 22)} rx="2.2" ry="7" transform={`translate(${R + 2} ${R + 2}) rotate(${i * 15})`} />)
  return (
    <svg className="tdf-halo" width={`${W}mm`} height={`${W}mm`} viewBox={`0 0 ${W} ${W}`} fill="none" stroke="#d9b25a" style={{ opacity: .45 }}>
      <circle cx={R + 2} cy={R + 2} r={R} strokeWidth=".4" /><circle cx={R + 2} cy={R + 2} r={R - 15} strokeWidth=".3" strokeDasharray="1 1.4" />
      {rays}<g strokeWidth=".35" fill="#d9b25a22">{petals}</g>
    </svg>
  )
}
const Flourish = () => (
  <svg className="tdf-flour" width="70mm" height="9mm" viewBox="0 0 70 9" fill="none" stroke="url(#tdfG)" strokeWidth=".7" strokeLinecap="round">
    <path d="M35 4.5H22C16 4.5 14 1 9 1C4 1 3 5 6 6C9 7 10 4 8 3M35 4.5H48C54 4.5 56 1 61 1C66 1 67 5 64 6C61 7 60 4 62 3" />
    <path d="M35 1l3.5 3.5L35 8l-3.5-3.5z" fill="url(#tdfG)" />
  </svg>
)

const BOKEH = [[8, 12, 26], [78, 9, 20], [88, 40, 30], [4, 55, 22], [90, 78, 24], [10, 86, 28], [50, 94, 18], [30, 5, 14]]

const Sprig = ({ className }) => (
  <svg className={className} viewBox="0 0 22 70" fill="none">
    <path d="M12 69C9 52 14 34 8 2" stroke="#b8892b" strokeWidth=".7" />
    {[8, 16, 24, 32, 40, 48, 56].map((y, i) => (
      <g key={y}>
        <ellipse cx={i % 2 ? 6 : 15} cy={64 - y} rx="5" ry="1.9" fill="#d9b25a" opacity=".85" transform={`rotate(${i % 2 ? -35 : 35} ${i % 2 ? 6 : 15} ${64 - y})`} />
        <ellipse cx={i % 2 ? 15 : 6} cy={60 - y} rx="4" ry="1.6" fill="#b8892b" opacity=".7" transform={`rotate(${i % 2 ? 40 : -40} ${i % 2 ? 15 : 6} ${60 - y})`} />
      </g>
    ))}
  </svg>
)

// Hand-painted irregular edge (deterministic noise) for the Painted Portrait style.
const blobPath = (seed, n = 140, amp = 0.022) => {
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), sn = Math.sin(t)
    const k = 5.5, r = 1 / Math.pow(Math.pow(Math.abs(c), k) + Math.pow(Math.abs(sn), k), 1 / k)
    const noise = Math.sin(t * 9 + seed) * .5 + Math.sin(t * 23 + seed * 2.3) * .3 + Math.sin(t * 57 + seed * 1.7) * .2
    const rr = r * (0.47 + amp * noise)
    pts.push([0.5 + c * rr, 0.5 + sn * rr].map(v => v.toFixed(4)).join(' '))
  }
  return 'M' + pts.join('L') + 'Z'
}
const BLOB_A = blobPath(1), BLOB_B = blobPath(4.2, 140, .03), BLOB_C = blobPath(7.7, 140, .03)

const SPL = [[18, 150, 3.2, '#f7a928'], [26, 168, 1.8, '#c0392b'], [12, 190, 2.4, '#d9b25a'], [188, 140, 3, '#c0392b'], [196, 170, 2, '#f7a928'], [184, 196, 3.4, '#d9b25a'], [30, 120, 1.5, '#d9b25a'], [180, 118, 1.6, '#f7a928'], [22, 215, 2, '#f7a928'], [190, 222, 2.2, '#c0392b']]
const Stroke = ({ d, c, w = 1 }) => <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" />
const SchoolIcons = () => (
  <div className="tdf-sp-icons">
    <svg viewBox="0 0 24 24" fill="none"><path d="M4 20l1-5L17 3l4 4L9 19z" fill="#f7a928" stroke="#7a5a14" strokeWidth="1" /><path d="M4 20l1-5 4 4z" fill="#f6e3a1" stroke="#7a5a14" strokeWidth="1" /><path d="M15 5l4 4" stroke="#c0392b" strokeWidth="1.6" /></svg>
    <svg viewBox="0 0 24 24" fill="none"><path d="M3 5c4-1.5 7-.5 9 1 2-1.5 5-2.5 9-1v13c-4-1.5-7-.5-9 1-2-1.5-5-2.5-9-1z" fill="#fff" stroke="#241b2d" strokeWidth="1.2" /><path d="M12 6v13" stroke="#241b2d" strokeWidth="1.2" /><path d="M5 9c2-.5 4 0 5 .8M5 12c2-.5 4 0 5 .8M14 9.8c1-.8 3-1.3 5-.8M14 12.8c1-.8 3-1.3 5-.8" stroke="#c0392b" strokeWidth=".8" /></svg>
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 7c-3-3-9-1-8 6 .7 5 4 8 6 7 1-.4 1.5-.6 2-.6s1 .2 2 .6c2 1 5.3-2 6-7 1-7-5-9-8-6z" fill="#c0392b" /><path d="M12 7c0-2 1-4 3-5" stroke="#5a7d2a" strokeWidth="1.6" strokeLinecap="round" /><path d="M13 4c2-1 4 0 4 0s-1 2-4 2z" fill="#5a7d2a" /></svg>
    <svg viewBox="0 0 24 24" fill="none"><path d="M12 2a6.5 6.5 0 00-3.5 12c.8.6 1 1.4 1 2.5h5c0-1.100.2-1.900 1-2.500A6.500 6.500 0 0012 2z" fill="#f6e3a1" stroke="#9a6f1c" strokeWidth="1.2" /><path d="M9.500 19h5M10.500 21.500h3" stroke="#241b2d" strokeWidth="1.4" strokeLinecap="round" /><path d="M12 6v6M9.500 8.500L12 6l2.500 2.500" stroke="#c0392b" strokeWidth="1" /></svg>
    <svg viewBox="0 0 24 24" fill="none"><rect x="2" y="8" width="20" height="8" rx="1" fill="#f7a928" stroke="#7a5a14" strokeWidth="1.1" transform="rotate(-20 12 12)" /><path d="M6 9l1 2M10 8l1 2M14 7l1 2M18 6l1 2" stroke="#7a5a14" strokeWidth="1" transform="rotate(-20 12 12) translate(0 .6)" /></svg>
  </div>
)
const SplashDeco = () => (
  <div className="tdf-sp-deco">
    <div className="tdf-sp-wash" style={{ left: '-30mm', top: '-25mm', width: '90mm', height: '70mm', background: 'radial-gradient(circle,#f7a92866,transparent 70%)' }} />
    <div className="tdf-sp-wash" style={{ right: '-35mm', bottom: '-20mm', width: '100mm', height: '90mm', background: 'radial-gradient(circle,#d9b25a77,transparent 70%)' }} />
    <div className="tdf-sp-wash" style={{ right: '-25mm', top: '45mm', width: '60mm', height: '60mm', background: 'radial-gradient(circle,#c0392b2e,transparent 70%)' }} />
    <svg width="210mm" height="297mm" viewBox="0 0 210 297" style={{ position: 'absolute', inset: 0 }}>
      {SPL.map(([x, y, r, c], i) => <circle key={i} cx={x} cy={y} r={r} fill={c} opacity=".75" />)}
      {/* streamers */}
      <Stroke d="M10 40C26 52 8 66 22 80C32 90 18 100 24 112" c="#f7a928" w="1.4" />
      <Stroke d="M16 36C30 48 14 64 26 76" c="#c0392b" w="1" />
      <Stroke d="M200 36C184 48 202 62 188 76C178 86 192 96 186 108" c="#d9b25a" w="1.4" />
      <Stroke d="M194 34C180 46 196 60 184 72" c="#c0392b" w="1" />
      {/* sparkles */}
      {[[40, 62, 3], [170, 66, 2.4], [33, 238, 2.6], [176, 244, 3.2], [100, 22, 2]].map(([x, y, r], i) => (
        <path key={i} d={`M${x} ${y - r * 2}L${x + r * .5} ${y - r * .5}L${x + r * 2} ${y}L${x + r * .5} ${y + r * .5}L${x} ${y + r * 2}L${x - r * .5} ${y + r * .5}L${x - r * 2} ${y}L${x - r * .5} ${y - r * .5}Z`} fill="#d9b25a" opacity=".85" />
      ))}
    </svg>
  </div>
)

const DecoCorner = ({ style }) => (
  <svg viewBox="0 0 60 60" width="34mm" height="34mm" style={{ position: 'absolute', pointerEvents: 'none', ...style }} fill="none" stroke="url(#tdfG)" strokeWidth=".7">
    {[56, 46, 36, 26, 16].map(r => <path key={r} d={`M2 ${r + 2}A${r} ${r} 0 0 0 ${r + 2} 2`} />)}
    {[0, 15, 30, 45, 60, 75, 90].map(a => <line key={a} x1="2" y1="2" x2={2 + 58 * Math.cos(a * Math.PI / 180)} y2={2 + 58 * Math.sin(a * Math.PI / 180)} strokeWidth=".35" />)}
    <circle cx="2" cy="2" r="3" fill="url(#tdfG)" />
  </svg>
)

function SplashFrame({ s, cfg }) {
  const lux = cfg.style === 'luxe'
  const W = lux ? ['#fff3c4', '#d9b25a', '#a77d2a', '#f6e3a1', '#d9b25a'] : ['#f7a928', '#e8801a', '#f4c968', '#d9b25a', '#f6e3a1']
  return (
    <div className={`tdf-page tdf-sp${lux ? ' tdf-lx' : ''}`} style={styleVars(cfg.style, cfg.shape)}>
      <svg width="0" height="0" style={{ position: 'absolute' }}><defs>
        <clipPath id="tdfBlob" clipPathUnits="objectBoundingBox"><path d={BLOB_A} /></clipPath>
      </defs></svg>
      <SplashDeco />
      {lux && <>
        <svg width="0" height="0" style={{ position: 'absolute' }}><defs><linearGradient id="tdfG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e3a1" /><stop offset=".5" stopColor="#d9b25a" /><stop offset="1" stopColor="#a77d2a" /></linearGradient></defs></svg>
        <div className="tdf-b1" style={{ inset: '7mm' }} />
        <div className="tdf-b3" style={{ inset: '14mm', borderStyle: 'solid', borderWidth: '.25mm' }} />
        <DecoCorner style={{ top: '9mm', left: '9mm' }} />
        <DecoCorner style={{ top: '9mm', right: '9mm', transform: 'scaleX(-1)' }} />
        <DecoCorner style={{ bottom: '9mm', left: '9mm', transform: 'scaleY(-1)' }} />
        <DecoCorner style={{ bottom: '9mm', right: '9mm', transform: 'scale(-1)' }} />
      </>}
      <div className="tdf-b2" style={{ inset: '11.5mm', border: '.4mm solid #d9b25a' }} />
      <div className="tdf-spc">
        <div className="tdf-sp-inst"><Emblem />GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE</div>
        <SchoolIcons />
        <div className="tdf-sp-happy" style={{ marginTop: '2mm' }}>Happy</div>
        <div className="tdf-sp-td">Teachers <i>Day</i></div>
        <svg className="tdf-sp-swoosh" viewBox="0 0 120 7" preserveAspectRatio="none" fill="none"><path d="M2 4C30 1 60 6 118 2" stroke="url(#tdfSw)" strokeWidth="1.6" strokeLinecap="round" /><path d="M20 6C50 4 80 7 105 4" stroke="#c0392b" strokeWidth=".7" strokeLinecap="round" /><defs><linearGradient id="tdfSw"><stop offset="0" stopColor="#f7a928" /><stop offset="1" stopColor="#d9b25a" /></linearGradient></defs></svg>
        <div className="tdf-sp-ph">
          <svg className="bl" viewBox="0 0 1 1" preserveAspectRatio="none" style={{ filter: 'blur(.6mm)' }}>
            <defs>
              <radialGradient id="tdfW1" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor={W[0]} /><stop offset=".6" stopColor={W[1]} /><stop offset="1" stopColor={W[2]} /></radialGradient>
              <radialGradient id="tdfW2" cx=".7" cy=".75" r=".7"><stop offset="0" stopColor={W[3]} /><stop offset="1" stopColor={W[4]} /></radialGradient>
            </defs>
            <g transform="translate(.05 .05) scale(.9)">
              <path d={BLOB_C} fill="url(#tdfW2)" opacity=".75" transform="translate(.03 .035) scale(1.02)" transformOrigin="50% 50%" />
              <path d={BLOB_B} fill="url(#tdfW1)" opacity=".92" transform="translate(-.02 -.012) scale(1.02)" />
            </g>
          </svg>
          <div className="tdf-sp-img">
            {s.photo ? <img src={s.photo} alt="" /> : <div className="tdf-ph"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3 22c0-5 4-8 9-8s9 3 9 8z" /></svg></div>}
          </div>
        </div>
        <div className="tdf-sp-name">{s.name}</div>
        {s.desig && <div className="tdf-sp-des">{s.desig}</div>}
        {cfg.quote && <div className="tdf-sp-q">{cfg.quote}</div>}
        <div className="tdf-sp-ft">
          <div>{cfg.dates}</div>
          <div><span>presented by</span> <b>{cfg.batch}</b> Batch Students</div>
        </div>
      </div>
    </div>
  )
}

function Stamp({ date }) {
  return (
    <svg className="tdf-fm-stamp" viewBox="0 0 100 100" fill="none">
      <defs><path id="tdfArc" d="M50 50m-37 0a37 37 0 1 1 74 0" /><path id="tdfArcB" d="M8 50a42 42 0 0 0 84 0" /></defs>
      <circle cx="50" cy="50" r="47" stroke="#1d3f87" strokeWidth="1.6" /><circle cx="50" cy="50" r="43.500" stroke="#1d3f87" strokeWidth=".6" /><circle cx="50" cy="50" r="27" stroke="#1d3f87" strokeWidth=".6" />
      <text fontSize="5.600" fontWeight="700" fill="#1d3f87" fontFamily="Cinzel,serif"><textPath href="#tdfArc" startOffset="50%" textAnchor="middle">GUIDANCE NAVODAYA &amp; SAINIK</textPath></text>
      <text fontSize="6" fontWeight="700" fill="#1d3f87" letterSpacing="1.200" fontFamily="Cinzel,serif"><textPath href="#tdfArcB" startOffset="50%" textAnchor="middle">INSTITUTE</textPath></text>
      <image href={emblemUrl} x="30" y="26" width="40" height="34" preserveAspectRatio="xMidYMid meet" style={{ filter: 'brightness(.55) sepia(1) hue-rotate(185deg) saturate(5)' }} />
      <text x="50" y="76" textAnchor="middle" fontSize="8" fontWeight="700" fill="#1d3f87" fontFamily="Playfair Display,serif">{date}</text>
      <text x="14" y="58" fontSize="6" fill="#1d3f87">★</text><text x="80" y="58" fontSize="6" fill="#1d3f87">★</text>
    </svg>
  )
}
const Rule = () => (
  <svg width="40mm" height="3mm" viewBox="0 0 70 4" fill="none" stroke="#c79a3b" strokeWidth=".4"><path d="M2 2H28M42 2H68" /><path d="M35 .3l2.200 1.700L35 3.700 32.800 2z" fill="#c79a3b" /><circle cx="30" cy="2" r=".7" fill="#c79a3b" /><circle cx="40" cy="2" r=".7" fill="#c79a3b" /></svg>
)

function FormalFrame({ s, cfg }) {
  const yr = (cfg.dates.match(/\d{4}/) || ['2026'])[0]
  return (
    <div className="tdf-page tdf-fm" style={styleVars(cfg.style, cfg.shape)}>
      <div className="tdf-fm-gold" /><div className="tdf-fm-in" /><div className="tdf-fm-pn" />
      <svg className="tdf-fm-guil" width="100%" height="100%"><defs>
        <pattern id="tdfGu" width="14" height="14" patternUnits="userSpaceOnUse"><g fill="none" stroke="#c79a3b" strokeWidth=".18">{[1.5, 3, 4.5, 6].map(r => <circle key={r} cx="7" cy="7" r={r} />)}<circle cx="0" cy="0" r="4" /><circle cx="14" cy="14" r="4" /><circle cx="14" cy="0" r="4" /><circle cx="0" cy="14" r="4" /></g></pattern>
        <radialGradient id="tdfGf" cx=".5" cy=".5" r=".6"><stop offset=".55" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#fff" stopOpacity="1" /></radialGradient>
        <mask id="tdfGm"><rect width="100%" height="100%" fill="url(#tdfGf)" /></mask></defs>
        <rect width="100%" height="100%" fill="url(#tdfGu)" mask="url(#tdfGm)" /></svg>
      <Emblem className="tdf-fm-wm" />
      <div className="tdf-fm-ln" />
      {CORNERS.map((c, i) => <div key={i} className="tdf-fm-orn" style={{ ...Object.fromEntries(Object.entries(c.pos).map(([k, v]) => [k, `calc(${v} + 5mm)`])), transform: c.t }}><svg viewBox="0 0 100 100" width="100%" height="100%"><g fill="none" stroke="#b8892b" strokeWidth="1.8"><path d="M6 94V6h88" /><path d="M16 78V16h62" /><path d="M16 16c18 0 28 9 28 27M16 16c0 18 9 28 27 28" /><circle cx="16" cy="16" r="5" fill="#b8892b" /><path d="M24 44c8-2 13 2 15 9M44 24c-2 8 2 13 9 15" /></g></svg></div>)}
      <div className="tdf-fmc">
        <div className="tdf-fm-top">
          <div className="l">A Brighter<br />Tomorrow Begins<br />with a Great Teacher.<div style={{ marginTop: '3mm' }}><Rule /></div></div>
          <Emblem className="tdf-fm-em" />
          <div className="r">TEACH<br />INSPIRE<br />EMPOWER<br />TRANSFORM<div style={{ marginTop: '2mm' }}><Rule /></div></div>
        </div>
        <div className="tdf-fm-inst">GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE</div>
        <div className="tdf-fm-tag">EDUCATION<b>◆</b>EXCELLENCE<b>◆</b>EMPOWERMENT</div>
        <div className="tdf-fm-happy">Happy</div>
        <div className="tdf-fm-ttl"><i /><b /><div className="tdf-fm-title" style={{ marginTop: 0 }}>TEACHERS&apos; DAY {yr}</div><b /><i /></div>
        <div className="tdf-fm-grat">WITH GRATITUDE AND APPRECIATION</div>
        <div className="tdf-fm-phw"><Laurel w={36} h={34} />
        <div className="tdf-fm-ph"><div>{s.photo ? <img src={s.photo} alt="" /> : <div className="tdf-ph"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3 22c0-5 4-8 9-8s9 3 9 8z" /></svg></div>}</div></div></div>
        <div className="tdf-fm-pre">This certificate is proudly presented to</div>
        <div className="tdf-fm-name">{s.name}</div>
        <div className="tdf-fm-nl" /><div className="tdf-fm-div"><Rule /></div>
        {s.desig && <div className="tdf-fm-des">{s.desig}</div>}
        <div className="tdf-fm-msg">{cfg.certMsg}</div>
        <div className="tdf-fm-sg">
          <Stamp date={cfg.stampDate} />
          <div className="pb">
            <div className="p1">WITH GRATITUDE, PRESENTED BY</div>
            <div className="p2"><b>{cfg.batch}</b> Batch Students</div>
            <div className="p3">{cfg.dates}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AwardFrame({ s, cfg }) {
  return (
    <div className="tdf-page tdf-aw" style={styleVars(cfg.style, cfg.shape)}>
      <div className="tdf-b1" /><div className="tdf-b2" /><div className="tdf-b3" />
      {CORNERS.map((c, i) => <Corner key={i} flip={c} />)}
      <div className="tdf-aw-rib" />
      <div className="tdf-aw-seal"><div><Emblem /></div></div>
      <div className="tdf-awc">
        <div className="tdf-aw-inst">GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE</div>
        <div className="tdf-aw-the"><i />THE<i /></div>
        <div className="tdf-aw-best">BEST</div>
        <div className="tdf-aw-teacher">Teacher</div>
        <div className="tdf-aw-award">• AWARD •</div>
        <div className="tdf-aw-pres">is presented to</div>
        <div className="tdf-aw-name">{s.name}</div>
        <div className="tdf-aw-line" />
        {s.desig && <div style={{ font: "italic 600 5mm 'Cormorant Garamond',serif", color: '#9a6f1c', marginTop: '2mm' }}>{s.desig}</div>}
        <div className="tdf-aw-msg">{cfg.msg}</div>
        <div className="tdf-aw-bot">
          <div className="tdf-aw-left">
            <div className="u">Awarded unanimously.<br />No other nominations were required.</div>
            <div className="sg">— Signed, every student you ever taught.</div>
            <div className="dt">TEACHERS&apos; DAY · {cfg.dates}</div>
            <div className="pb">WITH GRATITUDE, PRESENTED BY</div>
            <div className="bt"><b>{cfg.batch}</b> Batch Students</div>
          </div>
          <div className="tdf-aw-ph">
            <div className="tdf-aw-wash" />
            <Sprig className="tdf-aw-sprig" /><Sprig className="tdf-aw-sprig2" />
            <div className="tdf-aw-oval"><div>
              {s.photo ? <img src={s.photo} alt="" /> : <div className="tdf-ph"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3 22c0-5 4-8 9-8s9 3 9 8z" /></svg></div>}
            </div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Frame({ s, cfg }) {
  if (cfg.style === 'formal') return <FormalFrame s={s} cfg={cfg} />
  if (cfg.style === 'award') return <AwardFrame s={s} cfg={cfg} />
  if (cfg.style === 'splash' || cfg.style === 'luxe') return <SplashFrame s={s} cfg={cfg} />
  const st = resolveStyle(cfg.style, cfg.shape)
  const pw = parseFloat(st.pw), ph = parseFloat(st.ph)
  return (
    <div className="tdf-page" style={styleVars(cfg.style, cfg.shape)}>
      {st.bokeh && <div className="tdf-bokeh">{BOKEH.map(([l, t, z], i) => <i key={i} style={{ left: l + '%', top: t + '%', width: z + 'mm', height: z + 'mm' }} />)}</div>}
      <div className="tdf-b1" /><div className="tdf-b2" /><div className="tdf-b3" />
      {CORNERS.map((c, i) => <Corner key={i} flip={c} />)}
      <Emblem className="tdf-wm" />
      <div className="tdf-content">
        <Emblem className="tdf-logo" />
        <div className="tdf-inst">GUIDANCE NAVODAYA &amp; SAINIK INSTITUTE<small>— GNSI —</small></div>
        <div className="tdf-rule"><i /><b /><i /></div>
        <div className="tdf-happy">Happy</div>
        <div className="tdf-td">TEACHERS&apos; DAY</div>
        <div className="tdf-photo-wrap">
          {st.vec && <Halo w={pw} h={ph} />}{st.vec && <Scrolls h={ph} />}{st.vec && <Crest w={pw * 0.62} />}{st.laurel && <Laurel w={cfg.shape === 'passport' ? pw * 1.2 : pw} h={cfg.shape === 'passport' ? ph * 1.1 : ph} />}<div className="tdf-orn" /><div className="tdf-ring"><div className="tdf-ring2"><div className="tdf-photo">
            
            {s.photo
              ? <img src={s.photo} alt="" />
              : <div className="tdf-ph"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4.5" /><path d="M3 22c0-5 4-8 9-8s9 3 9 8z" /></svg></div>}
          </div></div></div>
          <span className="tdf-star" style={{ left: '-9mm', top: '40mm' }}>✦</span>
          <span className="tdf-star" style={{ right: '-9mm', top: '60mm' }}>✦</span>
        </div>
        <div className={`tdf-name${st.ribbon ? ' tdf-rb' : ''}`}>{(s.name || '').toUpperCase()}</div>
        <div className="tdf-desig">{s.desig}</div>
        {cfg.quote && <div className="tdf-quote">{cfg.quote}</div>}
        <div className="tdf-foot">
          <div className="tdf-dates">✦ {cfg.dates} ✦</div>
          <div className="tdf-pres">WITH GRATITUDE, PRESENTED BY</div>
          <div className="tdf-batch"><b>{cfg.batch}</b> Batch Students</div>
        </div>
      </div>
    </div>
  )
}

const inp = { padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 14, width: '100%', boxSizing: 'border-box' }

export default function TeachersDayFrame() {
  const [staff, setStaff] = useState([])
  const [picked, setPicked] = useState({})
  const [manual, setManual] = useState([])
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState({
    dates: '16th & 17th OCTOBER 2026', batch: '10th', style: 'arch', certMsg: 'In sincere appreciation of your dedication, passion and invaluable contributions to the education and growth of our students. Teachers are the heart of the institute. Your guidance, compassion and tireless efforts shape brighter minds and a better tomorrow. Thank you for inspiring, supporting and empowering every learner to dream, grow and achieve.', stampDate: '16.10.2026', msg: 'For explaining it a second time, and a third, without ever making anyone feel small. For knowing which student needed asking twice. For turning a subject on a timetable into something worth staying awake for. And for the lessons that were never once on the syllabus.', shape: 'passport',
    quote: '“A good teacher is like a candle — it consumes itself to light the way for others.”',
  })
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!document.getElementById('tdf-fonts')) {
      const l = document.createElement('link'); l.id = 'tdf-fonts'; l.rel = 'stylesheet'; l.href = FONT_URL
      document.head.appendChild(l)
    }
    supabase.from('website_faculty').select('*').order('sort_order').order('name').then(({ data }) => {
      setStaff((data || []).map(f => ({
        id: 'f' + f.id, name: f.name || '',
        desig: [f.role, f.subject].filter(Boolean).join(' · '),
        photo: f.photo_url || f.image_url || f.photo || '',
      })))
      setLoading(false)
    })
  }, [])

  const all = useMemo(() => [...staff, ...manual], [staff, manual])
  const selected = all.filter(s => picked[s.id])
  const shown = all.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const toggle = id => setPicked(p => ({ ...p, [id]: !p[id] }))
  const patch = (id, k, v) => {
    const f = list => list.map(s => (s.id === id ? { ...s, [k]: v } : s))
    setStaff(f); setManual(f)
  }
  const addManual = () => {
    const id = 'm' + Date.now()
    setManual(m => [...m, { id, name: 'New Staff', desig: '', photo: '' }])
    setPicked(p => ({ ...p, [id]: true }))
  }
  const upload = (id, file) => {
    if (!file) return
    const r = new FileReader(); r.onload = e => patch(id, 'photo', e.target.result); r.readAsDataURL(file)
  }
  const setAll = v => setPicked(Object.fromEntries(shown.map(s => [s.id, v])))
  const preview = selected[0]

  return (
    <div style={{ padding: 16 }}>
      <style>{CSS}</style>
      <h2 style={{ margin: '0 0 4px' }}>🎓 Teachers&apos; Day Frames</h2>
      <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 14 }}>
        A4 premium photo frame for each staff member — pulled from the website faculty list. Select staff, then print (one page each).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10, marginBottom: 14 }}>
        <label>Dates<input style={inp} value={cfg.dates} onChange={e => setCfg({ ...cfg, dates: e.target.value })} /></label>
        <label>Frame style<select style={inp} value={cfg.style} onChange={e => setCfg({ ...cfg, style: e.target.value })}>
          {Object.entries(STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></label>
        <label>Photo shape<select style={inp} value={cfg.shape} onChange={e => setCfg({ ...cfg, shape: e.target.value })}>
          <option value="passport">Passport photo (35 × 45 mm ratio)</option>
          <option value="style">Style default (arch / round)</option>
        </select></label>
        <label>Batch<input style={inp} value={cfg.batch} onChange={e => setCfg({ ...cfg, batch: e.target.value })} /></label>
        <label style={{ gridColumn: '1/-1' }}>Award message (Best Teacher Award style)<textarea style={{ ...inp, minHeight: 60 }} value={cfg.msg} onChange={e => setCfg({ ...cfg, msg: e.target.value })} /></label>
        <label style={{ gridColumn: '1/-1' }}>Certificate message (Formal Certificate style)<textarea style={{ ...inp, minHeight: 60 }} value={cfg.certMsg} onChange={e => setCfg({ ...cfg, certMsg: e.target.value })} /></label>
        <label>Stamp date<input style={inp} value={cfg.stampDate} onChange={e => setCfg({ ...cfg, stampDate: e.target.value })} /></label>
        <label style={{ gridColumn: '1/-1' }}>Quote (optional)<input style={inp} value={cfg.quote} onChange={e => setCfg({ ...cfg, quote: e.target.value })} /></label>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <input style={{ ...inp, maxWidth: 240 }} placeholder="Search staff…" value={search} onChange={e => setSearch(e.target.value)} />
        <button onClick={() => setAll(true)}>Select all</button>
        <button onClick={() => setAll(false)}>Clear</button>
        <button onClick={addManual}>＋ Add staff manually</button>
        <button disabled={!selected.length} onClick={() => window.print()}
          style={{ background: '#b8892b', color: '#fff', border: 0, borderRadius: 6, padding: '6px 14px', fontWeight: 700 }}>
          🖨 Print {selected.length || ''} frame{selected.length === 1 ? '' : 's'} (A4)
        </button>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>In the print dialog choose Paper A4, Margins None, and tick Background graphics.</p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 340px', maxHeight: 620, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 10 }}>
          {loading && <div style={{ padding: 14 }}>Loading website staff…</div>}
          {!loading && !shown.length && <div style={{ padding: 14 }}>No staff found.</div>}
          {shown.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderBottom: '1px solid #f1f5f9' }}>
              <input type="checkbox" checked={!!picked[s.id]} onChange={() => toggle(s.id)} />
              {s.photo
                ? <img src={s.photo} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                : <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#e2e8f0' }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <input style={{ ...inp, padding: '4px 6px', fontWeight: 600 }} value={s.name} onChange={e => patch(s.id, 'name', e.target.value)} />
                <input style={{ ...inp, padding: '4px 6px', marginTop: 3, fontSize: 12 }} placeholder="Designation" value={s.desig} onChange={e => patch(s.id, 'desig', e.target.value)} />
              </div>
              <label style={{ fontSize: 12, cursor: 'pointer', color: '#2563eb' }}>
                {s.photo ? 'Change' : 'Add'} photo
                <input type="file" accept="image/*" hidden onChange={e => upload(s.id, e.target.files[0])} />
              </label>
            </div>
          ))}
        </div>
        <div style={{ flex: '0 0 auto' }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Preview{preview ? ` — ${preview.name}` : ' (select staff)'}</div>
          <div style={{ width: 210 * 1.5, height: 297 * 1.5, overflow: 'hidden', borderRadius: 6, boxShadow: '0 4px 18px #0004' }}>
            <div style={{ transform: 'scale(.3969)', transformOrigin: 'top left', width: '210mm' }}>
              <Frame s={preview || { name: 'Staff Name', desig: 'Designation', photo: '' }} cfg={cfg} />
            </div>
          </div>
        </div>
      </div>

      {createPortal(
        <div className="tdf-print">{selected.map(s => <Frame key={s.id} s={s} cfg={cfg} />)}</div>,
        document.body,
      )}
    </div>
  )
}

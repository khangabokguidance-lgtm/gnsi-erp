import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './supabase'
import emblemUrl from './assets/gnsi-emblem.png'

const FONT_URL =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,500;0,700;1,500&family=Playfair+Display:ital,wght@0,700;0,900;1,500&display=swap'

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
  if (cfg.style === 'award') return <AwardFrame s={s} cfg={cfg} />
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
    dates: '16th & 17th OCTOBER 2026', batch: '10th', style: 'arch', msg: 'For explaining it a second time, and a third, without ever making anyone feel small. For knowing which student needed asking twice. For turning a subject on a timetable into something worth staying awake for. And for the lessons that were never once on the syllabus.', shape: 'passport',
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

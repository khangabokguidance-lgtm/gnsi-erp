// Mission Foundation poster / banner with the photos of every question setter. Pure HTML builder (unit-tested);
// the dialog supplies the names, subjects and photo URLs.
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('')

// panel: { subjectLabel: [teacher, …] } in subject order → one entry per person with all their subjects.
export function setterList(panel, subjectOrder = Object.keys(panel || {})) {
  const by = new Map()
  subjectOrder.forEach(sub => (panel?.[sub] || []).forEach(t => {
    const key = String(t || '').trim().toLowerCase(); if (!key) return
    if (!by.has(key)) by.set(key, { name: String(t).trim(), subjects: [] })
    if (!by.get(key).subjects.includes(sub)) by.get(key).subjects.push(sub)
  }))
  return [...by.values()]
}

// people: [{ name, label, subjects:[…], photo:url|null }]; layout: 'poster' (A3 portrait) | 'banner' (A3 landscape, logo panel on the left)
// logo: school logo URL. lockup=true when the logo already carries the institute name (the default GNSI lockup), so the name is not repeated.
export function bannerHtml({ people = [], layout = 'poster', title = 'Mission Foundation', session = '2026-27', tagline = 'Udaan · Pragati', institute = '', logo = '', lockup = false, heading = 'Our Question Setters', auto = false }) {
  const poster = layout !== 'banner'
  const n = Math.max(people.length, 1)
  // Largest photos that still fit: try every column count and keep the one that gives the biggest circle.
  // Space (mm) left for the photo grid after the header and footer; plate = the name box under each photo.
  const W = poster ? 249 : 252, H = poster ? 205 : 172, GAP = poster ? 7 : 5
  const longest = Math.max(...people.map(p => String(p.label || p.name || '').length), 6)
  const longSub = Math.max(...people.map(p => (p.subjects || []).join(' · ').length), 0) > 24
  const plan = c => {
    const rows = Math.ceil(n / c), cell = W / c
    let ph = Math.min(poster ? 78 : 70, cell * 0.9)
    for (; ph > 12; ph -= 0.5) {
      let f0 = Math.max(3.4, Math.min(8.2, ph * 0.15))
      while (f0 > 3.2 && f0 * 0.68 * longest + 8 > cell * 0.98) f0 -= 0.2
      const f1 = Math.max(2.8, f0 * 0.7), plate = f0 * 1.2 + f1 * (longSub && f1 * 0.52 * 26 > cell * 0.9 ? 2.4 : 1.25) + 3.6
      if (rows * (ph + plate - 4) + (rows - 1) * GAP <= H) return { cols: c, photo: ph, fs: [f0.toFixed(1) + 'mm', f1.toFixed(1) + 'mm'] }
    }
    return { cols: c, photo: 12, fs: ['3.4mm', '2.8mm'] }
  }
  const best = [2, 3, 4, 5, 6, 7, 8].filter(c => c <= Math.max(n, 2)).map(plan).sort((x, y) => y.photo - x.photo || x.cols - y.cols)[0]
  const { cols, photo, fs } = best
  const words = String(title || '').trim().split(/\s+/)
  const first = esc(words.slice(0, -1).join(' ')), last = esc(words.slice(-1).join(' '))
  const card = p => `<div class="p"><div class="ring"><div class="ph">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}">` : `<span>${esc(initials(p.name))}</span>`}</div></div><div class="plate"><b>${esc(p.label || p.name)}</b><i>${esc((p.subjects || []).join(' · '))}</i></div></div>`
  const logoBlock = logo ? `<div class="logo"><img src="${esc(logo)}" alt="${esc(institute)}"></div>` : ''
  const head = `<div class="head">${poster ? logoBlock : ''}${lockup ? '' : `<div class="inst">${esc(institute)}</div>`}<div class="t1">${first}</div><div class="t2">${last}</div><div class="yr"><span>${esc(session)}</span></div></div>`
  const main = `${head}<div class="hd"><span>${esc(heading)}</span></div><div class="grid">${people.map(card).join('')}</div>`
  const GOLD = 'linear-gradient(180deg,#fff1c2 0%,#e8c46a 38%,#b98a2e 62%,#f0d58a 100%)'
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — ${esc(heading)}</title>
<style>@page{size:${poster ? 'A3 portrait' : 'A3 landscape'};margin:0}*{box-sizing:border-box}html,body{margin:0}
body{font-family:'Inter','Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:${poster ? '297mm' : '420mm'};height:${poster ? '420mm' : '297mm'};position:relative;overflow:hidden;color:#fff;display:flex;flex-direction:${poster ? 'column' : 'row'};
background:radial-gradient(ellipse at 50% ${poster ? '14%' : '40%'},#2c5599 0,#16305c 38%,#0b1a33 78%,#070f1f 100%)}
.rays{position:absolute;inset:-30%;background:repeating-conic-gradient(from 0deg at ${poster ? '50% 20%' : '22% 50%'},rgba(226,197,126,.10) 0 4deg,rgba(226,197,126,0) 4deg 12deg);-webkit-mask-image:radial-gradient(circle at ${poster ? '50% 20%' : '22% 50%'},#000 0,transparent 62%);mask-image:radial-gradient(circle at ${poster ? '50% 20%' : '22% 50%'},#000 0,transparent 62%)}
.frame{position:absolute;inset:7mm;border:1.4mm solid #d9b45f;border-radius:4mm;pointer-events:none;box-shadow:inset 0 0 0 .5mm rgba(255,241,194,.55)}
.frame2{position:absolute;inset:11.5mm;border:.35mm solid rgba(226,197,126,.65);border-radius:2.4mm;pointer-events:none}
.side{position:relative;width:122mm;flex:none;display:flex;align-items:center;justify-content:center;padding:18mm 10mm 18mm 20mm}
.side:after{content:"";position:absolute;right:0;top:22mm;bottom:22mm;width:.5mm;background:linear-gradient(180deg,transparent,#e2c57e 20%,#e2c57e 80%,transparent)}
.logo{display:flex;justify-content:center;width:${poster ? 'auto' : '100%'}}.logo img{${poster ? 'height:80mm;width:auto' : 'width:100%;height:auto;max-height:200mm;object-fit:contain'};filter:drop-shadow(0 0 7mm rgba(226,197,126,.45)) drop-shadow(0 2mm 3mm rgba(0,0,0,.55))}
.body{position:relative;flex:1;display:flex;flex-direction:column;padding:${poster ? '15mm 20mm 14mm' : '14mm 20mm 14mm 14mm'};min-width:0}
.head{text-align:center}.inst{font-size:${poster ? '5mm' : '4.2mm'};letter-spacing:.3em;text-transform:uppercase;color:#e8c46a;font-weight:700;margin-top:3mm}
.t1{margin-top:${poster ? '2mm' : '0'};font-size:${poster ? '11mm' : '9mm'};letter-spacing:.62em;text-indent:.62em;text-transform:uppercase;font-weight:800;color:#fff}
.t2{font-family:'Fraunces',Georgia,serif;font-size:${poster ? '29mm' : '22mm'};line-height:1.02;letter-spacing:.02em;text-transform:uppercase;font-weight:700;background:${GOLD};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#e8c46a;filter:drop-shadow(0 1.2mm 0 rgba(0,0,0,.4))}
.yr{margin-top:${poster ? '4mm' : '2.5mm'};display:flex;justify-content:center;align-items:center;gap:5mm}.yr:before,.yr:after{content:"";height:.5mm;width:${poster ? '34mm' : '22mm'};background:linear-gradient(90deg,transparent,#e2c57e)}.yr:after{transform:scaleX(-1)}
.yr span{font-size:${poster ? '8mm' : '6mm'};font-weight:800;letter-spacing:.28em;color:#0b1a33;background:${GOLD};padding:1.2mm 9mm 1.2mm 10mm;border-radius:20mm;box-shadow:0 1mm 3mm rgba(0,0,0,.45)}
.hd{margin:${poster ? '8mm auto 5mm' : '6mm auto 3mm'};text-align:center}.hd span{display:inline-block;font-size:${poster ? '8.4mm' : '6.2mm'};font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:#fff;padding:1.6mm 13mm;border-top:.5mm solid #e2c57e;border-bottom:.5mm solid #e2c57e;background:linear-gradient(90deg,rgba(226,197,126,0),rgba(226,197,126,.18),rgba(226,197,126,0))}
.grid{flex:1;display:flex;flex-wrap:wrap;justify-content:center;align-content:center;gap:${poster ? '8mm 0' : '5mm 0'}}.grid>.p{width:${(100 / cols).toFixed(3)}%}
.p{display:flex;flex-direction:column;align-items:center;min-width:0}
.ring{width:${photo}mm;height:${photo}mm;border-radius:50%;padding:1.5mm;background:${GOLD};box-shadow:0 2.4mm 6mm rgba(0,0,0,.5),0 0 0 .7mm rgba(255,241,194,.35)}
.ph{width:100%;height:100%;border-radius:50%;background:#f4f1ea;overflow:hidden;display:flex;align-items:center;justify-content:center;border:.9mm solid #0b1a33}
.ph img{width:100%;height:100%;object-fit:cover;object-position:center top}.ph span{font-size:${(photo / 2.5).toFixed(1)}mm;font-weight:800;color:#132a4f}
.plate{margin-top:-4mm;position:relative;text-align:center;background:linear-gradient(180deg,#183564,#0f2347);border:.45mm solid #e2c57e;border-radius:2.5mm;padding:1.6mm 4mm 1.8mm;max-width:96%;box-shadow:0 1.4mm 3mm rgba(0,0,0,.45)}
.plate b{display:block;white-space:nowrap;font-size:${fs[0]};color:#fff;line-height:1.15}.plate i{display:block;font-style:normal;font-size:${fs[1]};color:#e8c46a;font-weight:600;letter-spacing:.04em;margin-top:.6mm;text-wrap:balance}
.ft{position:relative;margin-top:${poster ? '8mm' : '4mm'};text-align:center;font-size:${poster ? '6.2mm' : '4.8mm'};font-weight:800;letter-spacing:.34em;text-transform:uppercase;color:#0b1a33;background:${GOLD};padding:2.2mm 6mm;border-radius:2mm;box-shadow:0 1mm 3mm rgba(0,0,0,.4)}
@media screen{body{background:#cfd4dc;padding:10px}.sheet{margin:0 auto;zoom:.34}}@media print{body{padding:0}.sheet{zoom:1}}</style></head><body>
<div class="sheet"><div class="rays"></div><div class="frame"></div><div class="frame2"></div>
${poster ? `<div class="body">${main}<div class="ft">${esc(tagline)}</div></div>` : `<div class="side">${logoBlock}</div><div class="body">${main}<div class="ft">${esc(tagline)}</div></div>`}</div>
${auto ? "<script>window.onload=function(){(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},500)})}</script>" : ''}</body></html>`
}

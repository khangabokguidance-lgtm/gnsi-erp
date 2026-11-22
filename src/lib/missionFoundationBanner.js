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

// people: [{ name, label, subjects:[…], photo:url|null }]; layout: 'poster' (A3 portrait) | 'banner' (A3 landscape strip)
export function bannerHtml({ people = [], layout = 'poster', title = 'Mission Foundation', session = '2026-27', tagline = 'Udaan · Pragati', institute = '', logo = '', heading = 'Our Question Setters', auto = false }) {
  const poster = layout !== 'banner'
  const n = Math.max(people.length, 1)
  const cols = poster ? (n <= 4 ? 2 : n <= 9 ? 3 : 4) : (n <= 5 ? n : Math.ceil(n / (n > 12 ? 3 : 2)))
  const photo = poster ? (cols === 2 ? 56 : cols === 3 ? 44 : 34) : Math.max(14, Math.min(62, Math.floor(330 / cols * 0.62)))   // mm
  const bs = poster ? null : photo >= 44 ? ['6.4mm', '4.6mm'] : photo >= 30 ? ['5.2mm', '3.8mm'] : ['4.2mm', '3.2mm']
  const card = p => `<div class="p"><div class="ph">${p.photo ? `<img src="${esc(p.photo)}" alt="${esc(p.name)}">` : `<span>${esc(initials(p.name))}</span>`}</div><b>${esc(p.label || p.name)}</b><i>${esc((p.subjects || []).join(' · '))}</i></div>`
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)} — ${esc(heading)}</title>
<style>@page{size:${poster ? 'A3 portrait' : 'A3 landscape'};margin:0}*{box-sizing:border-box}html,body{margin:0}
body{font-family:'Inter','Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:${poster ? '297mm' : '420mm'};height:${poster ? '420mm' : '297mm'};padding:${poster ? '16mm' : '12mm 16mm'};color:#fff;position:relative;overflow:hidden;display:flex;flex-direction:column;
background:radial-gradient(circle at 18% 12%,#2a4f8f 0,#132a4f 48%,#0b1a33 100%)}
.sheet:before{content:"";position:absolute;inset:7mm;border:1.2mm solid #e2c57e;border-radius:4mm;pointer-events:none}
.top{display:flex;align-items:center;gap:${poster ? '8mm' : '6mm'};justify-content:center;text-align:center;margin-top:${poster ? '4mm' : '0'}}
.top img{height:${poster ? '30mm' : '20mm'};background:#fff;border-radius:4mm;padding:2mm}.inst{font-size:${poster ? '5.4mm' : '4.4mm'};letter-spacing:.28em;text-transform:uppercase;color:#e2c57e;font-weight:700}
h1{margin:${poster ? '3mm 0 1mm' : '1mm 0'};font-family:'Fraunces',Georgia,serif;font-size:${poster ? '27mm' : '19mm'};line-height:1;letter-spacing:.01em;text-transform:uppercase;color:#fff;text-shadow:0 1mm 0 rgba(0,0,0,.35)}
.yr{font-size:${poster ? '9mm' : '7mm'};font-weight:800;color:#e2c57e;letter-spacing:.2em}
.hd{margin:${poster ? '10mm auto 8mm' : '5mm auto 4mm'};text-align:center;font-size:${poster ? '9mm' : '6.5mm'};font-weight:800;letter-spacing:.14em;text-transform:uppercase;padding:2mm 12mm;border-top:.6mm solid #e2c57e;border-bottom:.6mm solid #e2c57e;color:#fff;width:max-content;max-width:100%}
.grid{flex:1;display:flex;flex-wrap:wrap;justify-content:center;align-content:center;gap:${poster ? '9mm 0' : '5mm 0'};padding:0 ${poster ? '6mm' : '4mm'}}.grid>.p{width:${(100 / cols).toFixed(3)}%}
.p{text-align:center;display:flex;flex-direction:column;align-items:center;gap:1.6mm;min-width:0}
.ph{width:${photo}mm;height:${photo}mm;border-radius:50%;border:1.4mm solid #e2c57e;background:#f4f1ea;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 2mm 5mm rgba(0,0,0,.4)}
.ph img{width:100%;height:100%;object-fit:cover;object-position:center top}.ph span{font-size:${photo / 2.4}mm;font-weight:800;color:#132a4f}
.p b{font-size:${poster ? (cols === 2 ? '8mm' : cols === 3 ? '6.4mm' : '5.2mm') : bs[0]};color:#fff}.p i{font-style:normal;font-size:${poster ? (cols === 2 ? '5.4mm' : '4.4mm') : bs[1]};color:#e2c57e;font-weight:600}
.ft{text-align:center;font-size:${poster ? '6mm' : '4.6mm'};font-weight:800;letter-spacing:.3em;text-transform:uppercase;color:#e2c57e;margin-top:${poster ? '6mm' : '2mm'}}
@media screen{body{background:#cfd4dc;padding:10px}.sheet{margin:0 auto;zoom:.34}}@media print{body{padding:0}.sheet{zoom:1}}</style></head><body>
<div class="sheet"><div class="top">${logo ? `<img src="${esc(logo)}" alt="">` : ''}<div><div class="inst">${esc(institute)}</div><h1>${esc(title)}</h1><div class="yr">${esc(session)}</div></div></div>
<div class="hd">${esc(heading)}</div><div class="grid">${people.map(card).join('')}</div><div class="ft">${esc(tagline)}</div></div>
${auto ? "<script>window.onload=function(){(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){setTimeout(function(){window.print()},400)})}</script>" : ''}</body></html>`
}

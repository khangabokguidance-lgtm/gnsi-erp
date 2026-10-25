// ════════════════════════════════════════════════════════════════════════
//  reportKit.js — the ONE design for every printed report in the portal
//  (registers, lists, summaries, analyses). Same identity as the fee
//  receipt (premiumReceipt.js): institute logo, name, tagline and contact
//  from System Settings → Basic Info / Appearance, a navy title band with a
//  gold accent, then the report. Tables repeat their header on every page,
//  and every page carries the printed date and "Page n".
//
//  reportHTML({ title, subtitle, meta, cards, body, … })  → full HTML document
//  openReport(title, html | Promise<html>, { autoPrint }) → print window
//  printReport(opts)                                      → both in one call
//  reportTable(columns, rows), reportCards(items), reportSection(title, html)
//  pdfLetterhead(doc, { title, subtitle }) → the same header on a jsPDF page
//
//  Designed documents keep their own layouts: receipts (premiumReceipt.js),
//  ID / admit cards, certificates, invitations, notices and question papers.
// ════════════════════════════════════════════════════════════════════════
import { getInstitute } from './systemSettings'
import { LOGO_BASE64 } from './logo'
import { esc, cssStr, reportTable, reportCards, reportSection } from './reportParts'

export { esc, reportTable, reportCards, reportSection }

const nowText = () => new Date().toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

// The institute's logo: the one set in System Settings (https URL), else the bundled crest.
export const instituteLogoSrc = () => {
  const url = getInstitute().logoUrl
  return /^https:\/\//.test(url) ? url : `data:image/jpeg;base64,${LOGO_BASE64}`
}

export const REPORT_FONTS = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&display=swap"

export const REPORT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Plus Jakarta Sans','Inter',Arial,sans-serif;background:#EEF1F5;color:#0F1B2E;font-size:12px;line-height:1.45}
  .rk-page{width:min(100%, var(--rk-w));margin:18px auto;background:#fff;border:1px solid #D6DCE5;box-shadow:0 24px 60px rgba(15,23,42,.14)}
  .rk-top{display:flex;align-items:center;gap:14px;padding:16px 24px 12px}
  .rk-logo{width:58px;height:58px;border-radius:12px;object-fit:contain;flex-shrink:0;background:#fff;border:1px solid #E8E3D8;padding:3px}
  .rk-name{font-family:'Fraunces','Playfair Display',Georgia,serif;font-size:21px;font-weight:700;color:#0B1E3D;line-height:1.15}
  .rk-tag{font-size:9.5px;color:#475569;letter-spacing:.08em;margin-top:3px;text-transform:uppercase;font-weight:700}
  .rk-contact{margin-left:auto;text-align:right;font-size:10px;color:#475569;line-height:1.6}
  .rk-contact b{color:#0B1E3D}
  .rk-band{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#0B1E3D;color:#fff;padding:9px 24px}
  .rk-title{font-size:13px;font-weight:800;letter-spacing:.18em;text-transform:uppercase}
  .rk-date{font-size:9.5px;font-weight:700;letter-spacing:.12em;color:#E2C57E;border:1px solid rgba(226,197,126,.6);padding:2px 10px;border-radius:999px;white-space:nowrap}
  .rk-accent{height:3px;background:linear-gradient(90deg,#0EA5A4,#1F4E8C 55%,#C9A24B)}
  .rk-body{padding:14px 24px 18px}
  .rk-sub{font-family:'Fraunces','Playfair Display',Georgia,serif;font-size:15px;font-weight:600;color:#0B1E3D;margin-bottom:6px}
  .rk-meta{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
  .rk-meta span{border:1px solid #E6DCC3;background:#FFFCF4;border-radius:999px;padding:3px 10px;font-size:10.5px;color:#334155}
  .rk-meta b{color:#0B1E3D}
  .rk-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:0 0 14px}
  .rk-card{border:1px solid #DCE3EC;border-radius:10px;padding:8px 11px;border-top:3px solid var(--tone,#0B1E3D)}
  .rk-card .l{font-size:8.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#64748B}
  .rk-card .v{font-family:'Fraunces','Playfair Display',Georgia,serif;font-size:19px;font-weight:700;color:var(--tone,#0B1E3D);margin-top:2px;font-variant-numeric:tabular-nums}
  .rk-card .s{font-size:9.5px;color:#64748B}
  .rk-h{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#0B1E3D;margin:16px 0 7px}
  .rk-h::before{content:'';width:4px;height:14px;border-radius:2px;background:linear-gradient(180deg,#C9A24B,#E2C57E)}
  .rk-body table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  .rk-body thead{display:table-header-group}
  .rk-body th{background:#0B1E3D;color:#fff;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:7px 9px;text-align:left;border:1px solid #0B1E3D}
  .rk-body td{padding:6px 9px;border:1px solid #DCE3EC;font-size:11px;color:#1F2937;vertical-align:top}
  .rk-body tbody tr:nth-child(even) td{background:#F8FAFC}
  .rk-body tfoot td{background:#F6EFDC;font-weight:800;color:#0B1E3D;border-color:#E6DCC3}
  .rk-body tr{break-inside:avoid}
  .rk-r{text-align:right}.rk-c{text-align:center}
  .rk-note{margin-top:12px;font-size:10px;color:#64748B;line-height:1.6}
  .rk-sign{display:flex;justify-content:space-between;gap:24px;margin-top:40px;break-inside:avoid}
  .rk-sign div{flex:1;text-align:center;font-size:10.5px;font-weight:700;color:#0B1E3D;border-top:1px solid #0F172A;padding-top:5px;max-width:200px}
  .rk-foot{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #DCE3EC;padding:8px 24px;font-size:9px;color:#64748B;background:#F8FAFC}
  .rk-btns{display:flex;gap:10px;justify-content:center;margin:0 0 24px}
  .rk-btn{padding:10px 24px;border-radius:8px;font:700 13px 'Plus Jakarta Sans',Arial,sans-serif;cursor:pointer;border:1px solid #0B1E3D}
  @media print{
    body{background:#fff}
    .rk-page{width:auto;margin:0;border:0;box-shadow:none}
    .rk-btns,.rk-foot{display:none}
  }
`

// Letterhead + title band (HTML). title: what the report is; date: the band's right-hand tag.
// institute / logo: optional overrides (Reports lets staff edit the letterhead for one report).
export function reportLetterhead(title, { date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), tagline, institute, logo } = {}) {
  const inst = { ...getInstitute(), ...(institute || {}) }
  const tag = tagline ?? `Residential Coaching · JNVST · AISSEE · RMS${inst.established ? ` · Est. ${inst.established}` : ''}`
  return `
    <div class="rk-top">
      <img class="rk-logo" src="${esc(logo || instituteLogoSrc())}" alt="" />
      <div>
        <div class="rk-name">${esc(inst.name)}</div>
        <div class="rk-tag">${esc(tag)}</div>
      </div>
      <div class="rk-contact"><b>${esc(inst.address)}</b>${inst.phone ? `<br/>${esc(inst.phone)}` : ''}${inst.email ? `<br/>${esc(inst.email)}` : ''}${inst.website ? `<br/>${esc(inst.website)}` : ''}</div>
    </div>
    <div class="rk-band"><span class="rk-title">${esc(title)}</span>${date ? `<span class="rk-date">${esc(date)}</span>` : ''}</div>
    <div class="rk-accent"></div>`
}


// The full document. body: HTML for the report itself. meta: [[label, value]] chips under the title.
// cards: reportCards items. signatures: labels for signature lines (default Prepared by / Principal).
export function reportHTML({ title, subtitle = '', meta = [], cards = null, body = '', note = '', signatures = ['Prepared by', 'Principal'],
  orientation = 'portrait', date, tagline, institute, logo, extraCss = '', autoPrint = false } = {}) {
  const inst = { ...getInstitute(), ...(institute || {}) }
  const printed = nowText()
  const w = orientation === 'landscape' ? '281mm' : '194mm'
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
  <link rel="stylesheet" href="${REPORT_FONTS}">
  <style>@page{size:A4 ${orientation};margin:10mm 10mm 13mm;
    @bottom-left{content:"${cssStr(`${inst.name} · ${title} · Printed ${printed}`)}";font:500 8px 'Plus Jakarta Sans',Arial,sans-serif;color:#64748B}
    @bottom-right{content:"Page " counter(page) " of " counter(pages);font:600 8px 'Plus Jakarta Sans',Arial,sans-serif;color:#64748B}}
  :root{--rk-w:${w}}${REPORT_CSS}${extraCss}</style></head><body>
  <div class="rk-page">
    ${reportLetterhead(title, { date, tagline, institute, logo })}
    <div class="rk-body">
      ${subtitle ? `<div class="rk-sub">${esc(subtitle)}</div>` : ''}
      ${meta.length ? `<div class="rk-meta">${meta.map(([l, v]) => `<span>${esc(l)}: <b>${esc(v)}</b></span>`).join('')}</div>` : ''}
      ${cards ? reportCards(cards) : ''}
      ${body}
      ${note ? `<div class="rk-note">${note}</div>` : ''}
      ${signatures?.length ? `<div class="rk-sign">${signatures.map(s => `<div>${esc(s)}</div>`).join('')}</div>` : ''}
    </div>
    <div class="rk-foot"><span>Printed ${esc(printed)}</span><span>${esc(inst.name)}</span></div>
  </div>
  <div class="rk-btns"><button class="rk-btn" style="background:#0B1E3D;color:#fff" onclick="window.print()">🖨 Print / Save PDF</button><button class="rk-btn" style="background:#fff;color:#0B1E3D" onclick="window.close()">Close</button></div>
  ${autoPrint ? `<script>window.addEventListener('load',function(){var go=function(){setTimeout(function(){window.print()},250)};document.fonts&&document.fonts.ready?document.fonts.ready.then(go):go()})</script>` : ''}
  </body></html>`
}

// Open a print window synchronously (inside the click, so pop-up blockers allow it) and fill it
// with html — or a promise of html. Returns the window (null if blocked: falls back to a tab).
export function openReport(title, html, { autoPrint = true } = {}) {
  const pw = window.open('', '_blank', 'width=1000,height=900,scrollbars=yes')
  if (pw) pw.document.write(`<p style="font:600 14px system-ui;color:#475569;padding:40px;text-align:center">Preparing ${esc(title)}…</p>`)
  Promise.resolve(html).then(h => {
    if (!pw) { window.open(URL.createObjectURL(new Blob([h], { type: 'text/html' })), '_blank'); return }
    pw.document.open(); pw.document.write(h); pw.document.close(); pw.document.title = title
    if (autoPrint) {
      const go = () => setTimeout(() => { try { pw.focus(); pw.print() } catch { /* window closed */ } }, 300)
      if (pw.document.fonts?.ready) pw.document.fonts.ready.then(go); else go()
    }
  })
  return pw
}

export const printReport = (opts) => openReport(opts.title, reportHTML(opts), { autoPrint: opts.autoPrint !== false })

// Re-dress a report a module already builds as a full HTML document: its own letterhead
// (drop: CSS selectors of the blocks to remove) and scripts go, its content and its
// special styles (group rows, subtotals…) stay, and it gets the shared letterhead, title
// band, footer and table design. The module's plain th/td/body rules lose to the shared
// ones (they are less specific), so every table reads the same.
// subtitleFrom: a selector whose text becomes the subtitle under the band (and is removed).
export function rebrandReport(html, { title, drop = [], subtitleFrom, orientation, signatures = [], ...opts } = {}) {
  const doc = new DOMParser().parseFromString(String(html), 'text/html')
  const subEl = subtitleFrom ? doc.querySelector(subtitleFrom) : null
  const subtitle = opts.subtitle ?? subEl?.textContent.trim() ?? ''
  subEl?.remove()
  const css = [...doc.querySelectorAll('style')].map(st => st.textContent)
    .join('\n').replace(/@import[^;]+;/g, '').replace(/@page\s*\{[^}]*\}/g, '')
  const land = orientation || (/size\s*:\s*A4\s+landscape/i.test(String(html)) ? 'landscape' : 'portrait')
  // a report that printed itself from a script keeps doing so
  const autoPrint = opts.autoPrint ?? /<script[\s\S]*?print\(\)[\s\S]*?<\/script>/i.test(String(html))
  doc.querySelectorAll(['script', 'style', ...drop].join(',')).forEach(n => n.remove())
  return reportHTML({
    title: title || doc.title || 'Report', orientation: land, signatures, ...opts, subtitle, autoPrint,
    body: doc.body.innerHTML,
    extraCss: `${css}\n/* shared design wins over plain element rules */\n${REPORT_CSS}${opts.extraCss || ''}`,
  })
}

// ── jsPDF: the same letterhead on a PDF page ─────────────────────────────
// Draws logo, institute name / tagline / contact, the navy title band and the
// gold accent. Returns the y (mm) where the report body should start.
// Works in any jsPDF unit: sizes are given in mm and scaled to the document's unit.
export function pdfLetterhead(doc, { title, date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), y, margin, institute, logo } = {}) {
  const inst = { ...getInstitute(), ...(institute || {}) }
  const k = 1 / (doc.internal.scaleFactor / (72 / 25.4)) // mm → document units
  const u = v => v * k
  const W = doc.internal.pageSize.getWidth()
  margin = margin ?? u(10); y = y ?? u(10)
  const src = logo || instituteLogoSrc()
  const fmt = (/^data:image\/(\w+)/.exec(src)?.[1] || 'jpeg').toUpperCase().replace('JPG', 'JPEG')
  try { doc.addImage(src, fmt === 'SVG+XML' ? 'PNG' : fmt, margin, y, u(16), u(16)) } catch { /* remote logo not embeddable — skip */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(11, 30, 61)
  doc.text(inst.name, margin + u(20), y + u(6))
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105)
  doc.text(`RESIDENTIAL COACHING · JNVST · AISSEE · RMS${inst.established ? ` · EST. ${inst.established}` : ''}`, margin + u(20), y + u(10.5))
  const contact = [inst.address, inst.phone, inst.email || inst.website].filter(Boolean)
  contact.forEach((c, i) => doc.text(String(c), W - margin, y + u(4 + i * 3.6), { align: 'right' }))
  const by = y + u(19)
  doc.setFillColor(11, 30, 61); doc.rect(margin, by, W - margin * 2, u(8), 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255)
  doc.text(String(title || '').toUpperCase(), margin + u(4), by + u(5.4))
  if (date) { doc.setTextColor(226, 197, 126); doc.setFontSize(8); doc.text(String(date), W - margin - u(4), by + u(5.4), { align: 'right' }) }
  doc.setFillColor(201, 162, 75); doc.rect(margin, by + u(8), W - margin * 2, u(0.9), 'F')
  doc.setTextColor(15, 27, 46); doc.setFont('helvetica', 'normal')
  return by + u(14)
}

// Footer on every page of a jsPDF document: institute · printed date, and "Page n of N".
export function pdfFooters(doc, { margin, institute } = {}) {
  const inst = { ...getInstitute(), ...(institute || {}) }
  const u = v => v / (doc.internal.scaleFactor / (72 / 25.4))
  margin = margin ?? u(10)
  const n = doc.getNumberOfPages()
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(220, 227, 236); doc.line(margin, H - u(9), W - margin, H - u(9))
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139)
    doc.text(`${inst.name} · Printed ${nowText()}`, margin, H - u(5.5))
    doc.text(`Page ${i} of ${n}`, W - margin, H - u(5.5), { align: 'right' })
  }
}

// Shared jspdf-autotable styles so every PDF table looks like the printed ones.
export const PDF_TABLE_STYLES = {
  headStyles: { fillColor: [11, 30, 61], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
  bodyStyles: { fontSize: 8, textColor: [31, 41, 55], lineColor: [220, 227, 236], lineWidth: 0.1 },
  alternateRowStyles: { fillColor: [248, 250, 252] },
  footStyles: { fillColor: [246, 239, 220], textColor: [11, 30, 61], fontStyle: 'bold', fontSize: 8 },
}

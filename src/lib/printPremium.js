// printPremium.js — the premium A4 print frame for the self-study sheets and reports.
//
// What it fixes compared with a plain print window:
//   • FONTS   the print window is a blank page, so the app's web fonts were not loaded and the browser fell back to
//             Georgia / Segoe UI / Arial (and the system emoji font). The frame loads Inter, Fraunces and
//             Noto Sans Meetei Mayek, and waits for them before printing.
//   • LOGO    a large logo on a navy tile in the letterhead, a faint watermark on every page, and a small logo
//             in every page's footer.
//   • CREDIT  "Design by Moirangthem Himan Singh" in the footer of every page.
//   • PAGES   tables flow across pages (no half-empty pages); every page has the same top / bottom margin and a
//             footer, and the browser's own header / footer (date, "about:blank", page count) is not printed.
//   • LAYOUT  fixed column widths so every table looks the same; crisp inline icons instead of emoji.
import { denyPrint } from './printGuard.js';
export const DESIGN_CREDIT = 'Design by Moirangthem Himan Singh';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Noto+Sans+Meetei+Mayek:wght@400..700&display=swap">`;
export const FONT_STACK = "'Inter','Noto Sans Meetei Mayek','Segoe UI',Arial,sans-serif";
export const SERIF_STACK = "'Fraunces','Georgia','Times New Roman',serif";

// Print only after the fonts have loaded (otherwise the first print can still use the fallback fonts).
export const PRINT_NOW = "(document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(function(){window.print()})";

// The logo to print: the one set in System Settings when it is an https image (or an embedded data: image), else the emblem shipped with the app.
// (A print window is a blank page, so the fallback needs an absolute address.)
export const logoSrc = (inst) => (/^(https:\/\/|data:image\/)/.test(inst?.logoUrl || '') ? inst.logoUrl : `${typeof location !== 'undefined' ? location.origin : ''}/gnsi-mark.webp`);

// Inline icons (no emoji font needed). Colour and size are set by the caller's CSS (currentColor).
const SVG = (d) => `<svg class="ic" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const ICON = {
  pin: SVG('<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/>'),
  clock: SVG('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>'),
  target: SVG('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'),
  note: SVG('<path d="M8 3h8l3 3v15H5V3z"/><path d="M9 11h6M9 15h6M9 7h3"/>'),
  alert: SVG('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18.2v.1"/>'),
};

const CSS = `
:root{--navy:#0f2d5e;--navy2:#1e3a6e;--gold:#b8923a;--ink:#0f172a;--mut:#5b6678;--line:#d6dde8;--soft:#f5f7fb}
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:${FONT_STACK};font-size:10.5px;line-height:1.45;color:var(--ink);background:#e9edf3;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-variant-numeric:tabular-nums}
.bar{position:sticky;top:0;z-index:20;background:linear-gradient(90deg,#0b2147,#16386b);color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;font-size:12.5px}
.bar button{padding:8px 20px;border:0;border-radius:8px;background:#fff;color:var(--navy);font-weight:800;cursor:pointer;font-size:13px;font-family:inherit}
.bar small{opacity:.8}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.wm img{width:96mm;height:auto;opacity:.07;filter:saturate(1.1)}
.sheet{position:relative;z-index:1;width:210mm;margin:14px auto;background:rgba(255,255,255,.93);box-shadow:0 2px 14px rgba(0,0,0,.18)}
.frame{width:100%;border-collapse:collapse}
.frame>thead>tr>td{height:13mm;padding:0}
.frame>tfoot>tr>td{padding:0}
.fsp{height:17mm}
.frame>tbody>tr>td{padding:0 12mm;vertical-align:top}

.pgfoot{position:fixed;left:0;right:0;bottom:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:10px;height:15mm;padding:0 12mm;border-top:1px solid var(--line);font-size:8.3px;color:var(--mut);background:rgba(255,255,255,.97)}
.pgfoot .l{display:flex;align-items:center;gap:8px;min-width:0}
.pgfoot .mini{flex:0 0 auto;width:15px;height:21px;border-radius:3px;background:linear-gradient(160deg,#0b1f45,#163768);display:flex;align-items:center;justify-content:center}
.pgfoot .mini img{width:12px;height:auto;max-height:18px;object-fit:contain}
.pgfoot b{color:var(--navy)}
.pgfoot .credit{font-family:${SERIF_STACK};font-style:italic;font-weight:600;color:var(--gold);white-space:nowrap;font-size:9.2px;letter-spacing:.2px}

/* letterhead */
.lh2{display:flex;align-items:center;gap:15px;padding-bottom:10px;border-bottom:3px double var(--navy);margin-bottom:12px}
.lg{flex:0 0 auto;width:66px;height:92px;border-radius:11px;background:linear-gradient(160deg,#0a1d42,#173a6d);display:flex;align-items:center;justify-content:center;box-shadow:0 5px 12px -4px rgba(15,45,94,.55);border:1px solid #c7a24a}
.lg img{width:54px;height:auto;max-height:82px;object-fit:contain}
.lt{flex:1;text-align:center;min-width:0}
.lt .n{font-family:${SERIF_STACK};font-size:23px;font-weight:700;color:var(--navy);letter-spacing:.2px;line-height:1.15}
.lt .g{font-size:10px;color:var(--gold);font-style:italic;font-weight:600;margin-top:2px}
.lt .a{font-size:9.5px;color:var(--mut);margin-top:2px}
.ld{flex:0 0 auto;text-align:right;font-size:8.8px;color:var(--mut);line-height:1.5}
.ld b{display:block;font-size:10.5px;color:var(--navy);letter-spacing:1.4px;text-transform:uppercase}

/* title + body elements */
.body .title{background:linear-gradient(90deg,#0f2d5e,#1e3a6e);color:#fff;text-align:center;padding:8px;border-radius:7px;font-weight:800;letter-spacing:2.6px;font-size:12px;text-transform:uppercase;border-bottom:2.5px solid var(--gold)}
.body .sub{text-align:center;color:var(--mut);margin:6px 0 11px;font-size:10.5px}
.body h1{font-family:${SERIF_STACK};font-size:19px;color:var(--navy);margin:0 0 4px}
.body h2{font-size:13px;color:var(--navy);margin:14px 0 6px;break-after:avoid}
.body h3{font-size:11px;text-transform:uppercase;letter-spacing:1.3px;color:var(--navy);border-bottom:1.5px solid var(--navy);padding-bottom:3px;margin:14px 0 7px;break-after:avoid;page-break-after:avoid}
.body h3 small,.body h2 small{font-weight:600;color:var(--mut);text-transform:none;letter-spacing:0;font-size:10px}
.body p{margin:4px 0 8px}
.body table{width:100%;border-collapse:collapse;font-size:9.5px;margin:0 0 8px;table-layout:auto}
.body table.t{table-layout:fixed}
.body thead{display:table-header-group}
.body tr{break-inside:avoid;page-break-inside:avoid}
.body th{background:var(--navy);color:#fff;padding:6px 3px;font-size:8px;text-transform:uppercase;letter-spacing:.4px;text-align:center;font-weight:700}
.body td{padding:4px 5px;border-bottom:1px solid var(--line);text-align:center;vertical-align:middle;overflow-wrap:anywhere}
.body td.l,.body th.l{text-align:left}
.body table.t td{height:6.4mm}
.body table.t td.box{border-left:1px solid var(--line);padding:0}
.body table.t td.box:last-of-type{border-right:1px solid var(--line)}
.body tbody tr:nth-child(even){background:rgba(245,247,251,.85)}
.body td b{font-weight:700}
.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 12px}
.kpi{border:1px solid var(--line);border-top:3px solid var(--navy);border-radius:7px;padding:7px 8px;text-align:center;background:#fff}
.kpi small{display:block;font-size:8.3px;text-transform:uppercase;letter-spacing:1px;color:var(--mut);font-weight:700}
.kpi b{display:block;font-size:17px;margin-top:2px;line-height:1.15;color:var(--navy)}
.pill{display:inline-block;padding:1px 8px;border-radius:999px;font-size:9px;font-weight:700;color:#fff}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.box,.cardbox{border:1px solid var(--line);border-radius:8px;padding:8px 10px;background:#fff;break-inside:avoid}
.ins li{margin:0 0 4px 16px}
.avoid{break-inside:avoid;page-break-inside:avoid}
.sig{display:flex;justify-content:space-between;gap:20px;margin:30px 0 6px;break-inside:avoid}
.sig span{flex:1;text-align:center;border-top:1.3px solid var(--ink);padding-top:4px;font-size:9px;color:var(--mut);text-transform:uppercase;letter-spacing:1px;font-weight:600}
.note{font-size:9px;color:var(--mut);text-align:center;margin:6px 0}
.ic{display:inline-block;vertical-align:-2px;margin-right:3px}

/* the person card, the "your duty" notice and each group */
.pcard{display:flex;gap:14px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:0 0 11px;background:linear-gradient(180deg,#f8fafc,#fff)}
.pav{flex:0 0 auto;width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#0f2d5e,#1e3a6e);color:#f3d58a;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:16px;box-shadow:inset 0 -6px 10px rgba(0,0,0,.2)}
.pname{font-family:${SERIF_STACK};font-size:17px;font-weight:700;color:var(--navy)}
.prole{color:var(--mut);font-size:10px}
.pnum{text-align:center;min-width:50px}
.pnum b{display:block;font-size:19px;color:var(--navy);line-height:1.1}
.pnum span{font-size:8.3px;text-transform:uppercase;letter-spacing:1px;color:var(--mut)}
.duty{border:2px solid var(--navy);border-radius:10px;padding:10px 12px;margin:0 0 13px;background:#f8fafc;break-inside:avoid}
.duty .dh{font-weight:800;color:var(--navy);letter-spacing:1.6px;text-transform:uppercase;font-size:11px}
.duty .warn{color:#b42318;font-weight:700;margin-top:4px}
.grp{break-after:avoid;margin:14px 0 6px;padding-bottom:4px;border-bottom:1.5px solid var(--navy);display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.grp .gt{font-weight:800;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--navy)}
.grp .gs{color:var(--mut);font-size:10px}
.inst{break-inside:avoid;break-after:avoid;border:1px solid #ead9a8;border-left:4px solid var(--gold);border-radius:6px;padding:6px 10px;margin:0 0 7px;background:#fffbeb;font-size:10px}
.inst.none{border-color:#f5c2c0;border-left-color:#dc2626;background:#fef2f2}
.inst div{margin:1px 0}
.inst .ic{color:var(--navy)}

@media screen{.sheet{min-height:297mm}.pgfoot{position:static;margin-top:0;width:210mm;margin:0 auto;background:#fff}}
.body .foot{margin-top:10px;font-size:9px;color:var(--mut);text-align:center;border-top:1px dashed var(--line);padding-top:5px}
@media print{
  @page{size:A4;margin:0}
  body{background:#fff}
  .bar{display:none}
  .sheet{margin:0;box-shadow:none;width:auto;background:transparent}
  .person+.person{break-before:page;page-break-before:always}
}
`;

// bodyHTML  : the content (it may use the classes above)
// institute : { name, address, tagline, logoUrl }
// docLabel  : short label for the footer, e.g. "Duty sheet · Meera Singh · Pre Mock Test 2026"
export function printPremium(bodyHTML, { title = 'Report', institute = {}, docLabel = '' } = {}) {
  if (denyPrint()) return;
  const w = window.open('', '_blank');
  if (!w) { alert('Pop-up blocked — allow pop-ups for this site to print the report.'); return; }
  const logo = esc(logoSrc(institute));
  const name = esc(institute.name || 'Guidance Navodaya & Sainik Institute');
  const stamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${FONT_LINKS}<style>${CSS}</style></head><body>
  <div class="bar"><button onclick="${PRINT_NOW}">Print / Save as PDF</button><span>${esc(title)}</span><small>Tip: in the print window choose “Save as PDF”, margins “Default”, and leave “Headers and footers” off.</small></div>
  <div class="wm"><img src="${logo}" alt=""></div>
  <div class="sheet"><table class="frame">
    <thead><tr><td></td></tr></thead>
    <tfoot><tr><td><div class="fsp"></div></td></tr></tfoot>
    <tbody><tr><td class="body">
      <div class="lh2">
        <div class="lg"><img src="${logo}" alt="Logo"></div>
        <div class="lt"><div class="n">${name}</div>${institute.tagline ? `<div class="g">${esc(institute.tagline)}</div>` : ''}${institute.address ? `<div class="a">${esc(institute.address)}</div>` : ''}</div>
        <div class="ld"><b>Issued</b>${stamp}</div>
      </div>
      ${bodyHTML}
    </td></tr></tbody></table></div>
  <div class="pgfoot">
    <span class="l"><span class="mini"><img src="${logo}" alt=""></span><span><b>${name}</b>${docLabel ? ` · ${esc(docLabel)}` : ''}</span></span>
    <span class="credit">${esc(DESIGN_CREDIT)}</span>
  </div>
  </body></html>`);
  w.document.close();
}

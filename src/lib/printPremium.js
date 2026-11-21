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
import { SOFTWARE_CREDIT } from './credit.js';
export const DESIGN_CREDIT = SOFTWARE_CREDIT;
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
.tools{position:sticky;top:0;z-index:20}
.bar{position:relative;z-index:20;flex-wrap:wrap;background:linear-gradient(90deg,#0b2147,#16386b);color:#fff;padding:10px 16px;display:flex;gap:12px;align-items:center;justify-content:center;font-size:12.5px}
.bar button{padding:8px 20px;border:0;border-radius:8px;background:#fff;color:var(--navy);font-weight:800;cursor:pointer;font-size:13px;font-family:inherit}
.bar small{opacity:.8}
.bar label{display:flex;align-items:center;gap:6px;font-weight:600}
.bar select{padding:6px 8px;border-radius:7px;border:0;font:inherit;font-weight:700;color:var(--navy);background:#fff}
.wm{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:0}
.wm img{width:96mm;height:auto;opacity:.07;filter:saturate(1.1)}
.sheet{position:relative;z-index:1;width:var(--pw,210mm);margin:14px auto;background:rgba(255,255,255,.93);box-shadow:0 2px 14px rgba(0,0,0,.18)}
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

/* official (office / government style) letterhead: opt-in with { official: true } — kept compact */
.off .frame>thead>tr>td{height:8mm}
.off .oh{margin-bottom:6px}
.off .oh-row{display:flex;align-items:center;gap:10px}
.off .oh-logo{flex:0 0 auto;width:38px;height:46px;border-radius:5px;background:linear-gradient(160deg,#0a1d42,#173a6d);display:flex;align-items:center;justify-content:center;border:1px solid #9a7a2e}
.off .oh-logo img{width:30px;height:auto;max-height:40px;object-fit:contain}
.off .oh-logo.sp{visibility:hidden}
.off .oh-mid{flex:1;text-align:center;min-width:0}
.off .oh-n{font-family:${SERIF_STACK};font-size:16px;font-weight:700;color:#0b1f45;letter-spacing:.7px;text-transform:uppercase;line-height:1.15}
.off .oh-a{font-size:8.6px;color:#333;margin-top:2px;font-weight:500;line-height:1.3}
.off .oh-rule{height:0;border-top:2.5px solid #0b1f45;border-bottom:.8px solid #0b1f45;padding-top:1.5px;margin:5px 0 3px}
.off .oh-meta{display:flex;justify-content:space-between;gap:12px;font-size:9px;color:#111;font-weight:600}
.off .oh-meta u{display:inline-block;min-width:30mm;border-bottom:1px solid #111;text-decoration:none;font-weight:400}
.off .body .title{background:none;color:#0b1f45;border-radius:0;border-top:1.2px solid #0b1f45;border-bottom:1.2px solid #0b1f45;padding:4px 4px;letter-spacing:2px;font-size:10.5px;margin-top:4px}
.off .body .sub{margin:4px 0 6px;color:#333;font-size:9.5px}

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

/* Edit mode: a toolbar above the report; the content becomes editable on screen only */
.etb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center;padding:8px 12px;background:#fff7e0;border-bottom:1px solid #e3d49c;font-size:12.5px;color:#1b2437}
.etb[hidden]{display:none}
.etb button{min-width:32px;height:32px;padding:0 9px;border:1px solid #d8c88d;border-radius:8px;background:#fff;color:#0f2d5e;font-weight:800;cursor:pointer;font-family:inherit;font-size:13px}
.etb button:hover{background:#fdf2cf}
.etb select,.etb input[type=color]{height:32px;border:1px solid #d8c88d;border-radius:8px;background:#fff;font-family:inherit;font-size:12.5px;padding:0 6px}
.etb input[type=color]{width:34px;padding:2px;cursor:pointer}
.etb .sep{width:1px;height:22px;background:#e3d49c;margin:0 4px}
.etb .ehint{flex-basis:100%;font:600 12px Inter,Arial,sans-serif;color:#6b5a2a;padding:0 2px 2px}
.etb .danger{color:#b42318;border-color:#f0b8b2}
#emore{display:contents}#emore[hidden]{display:none}
.etb label{display:flex;align-items:center;gap:4px;font-weight:700}
.editing .fsz{outline:2px dashed #b8923a;outline-offset:8px;cursor:text}
.pbk{break-after:page;page-break-after:always;border-top:2px dashed #b8923a;margin:10px 0;height:0}
@media print{.pbk{border:0}}
.editing .fsz td,.editing .fsz th{outline:1px dotted rgba(184,146,58,.5)}
/* Text size picker: scales only the report content, not the letterhead */
.fsz{zoom:var(--fs,1)}
@media screen{.sheet{min-height:var(--ph,297mm)}.pgfoot{position:static;margin-top:0;width:var(--pw,210mm);margin:0 auto;background:#fff}}
.body .foot{margin-top:10px;font-size:9px;color:var(--mut);text-align:center;border-top:1px dashed var(--line);padding-top:5px}
@media print{
  @page{size:A4;margin:0}
  body{background:#fff}
  .bar,.tools,.etb{display:none!important}
  .fsz{outline:0!important}
  .sheet{margin:0;box-shadow:none;width:auto;background:transparent}
  .person+.person{break-before:page;page-break-before:always}
}
`;


// Paper size + orientation picker in the preview bar. Sets --pw/--ph (the preview sheet) and the print @page size, then tells the
// content to re-fit itself (a "pagechange" event; detail = page height in mm).
const PAPERS = { A4: [210, 297], A3: [297, 420], A5: [148, 210], Letter: [216, 279], Legal: [216, 356] };
// Text size of the report content (1 = normal). Remembered per report on this browser.
const FONT_SIZES = [[0.7, 'Very small 70%'], [0.8, 'Small 80%'], [0.9, '90%'], [1, 'Normal 100%'], [1.1, '110%'], [1.2, 'Large 120%'], [1.35, 'Larger 135%'], [1.5, 'Very large 150%']]
const EDIT_FONTS = [['', 'Font'], ["'Inter',Arial,sans-serif", 'Inter'], ['Arial,Helvetica,sans-serif', 'Arial'], ["Georgia,'Times New Roman',serif", 'Georgia'], ["'Times New Roman',Times,serif", 'Times New Roman'], ["'Courier New',monospace", 'Courier'], ["'Noto Sans Meetei Mayek',sans-serif", 'Meetei Mayek']]
const EDIT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32]
const EDIT_BAR = `<div class="etb" id="etb" hidden role="toolbar" aria-label="Edit the report">
  <div class="ehint">Click on any text to change it. Use the buttons to move or delete a whole question. “Undo change” takes back a delete or move.</div>
  <button type="button" data-c="undo" title="Undo typing (Ctrl+Z)">↶ Undo</button><button type="button" data-c="redo" title="Redo (Ctrl+Y)">↷ Redo</button><span class="sep"></span>
  <select id="efont" aria-label="Font">${EDIT_FONTS.map(([v, l]) => `<option value="${v.replace(/"/g, '&quot;')}">${l}</option>`).join('')}</select>
  <select id="esize" aria-label="Font size of the selected text"><option value="">Size</option>${EDIT_SIZES.map(n => `<option value="${n}">${n}</option>`).join('')}</select><span class="sep"></span>
  <button type="button" data-c="bold" title="Bold (Ctrl+B)"><b>B</b></button><button type="button" data-c="italic" title="Italic (Ctrl+I)"><i>I</i></button><button type="button" data-c="underline" title="Underline (Ctrl+U)"><u>U</u></button>
  <label title="Text colour">A<input type="color" id="ecolor" value="#0f2d5e" aria-label="Text colour"></label><label title="Highlight">🖍<input type="color" id="ehi" value="#fff2a8" aria-label="Highlight colour"></label><span class="sep"></span>
  <button type="button" data-c="justifyLeft" title="Align left">⇤</button><button type="button" data-c="justifyCenter" title="Centre">↔</button><button type="button" data-c="justifyRight" title="Align right">⇥</button><button type="button" data-c="insertUnorderedList" title="Bullets">• ≡</button><button type="button" data-c="insertOrderedList" title="Numbers">1.≡</button><span class="sep"></span>
  <button type="button" data-b="up" title="Move this question or paragraph up">⬆ Move up</button><button type="button" data-b="down" title="Move this question or paragraph down">⬇ Move down</button><button type="button" data-b="del" class="danger" title="Delete this whole question (with its options) or paragraph">🗑 Delete</button><button type="button" id="eundo" title="Take back the last delete, move or insert">↩ Undo change</button><span class="sep"></span>
  <button type="button" id="emoreb" aria-expanded="false" title="Show more tools">More tools ▾</button><button type="button" id="ereset" title="Undo ALL edits and go back to the original">↺ Reset</button>
  <span id="emore" hidden>
    <span class="sep"></span>
    <select id="ehead" aria-label="Paragraph style"><option value="">Style</option><option value="P">Normal</option><option value="H1">Heading 1</option><option value="H2">Heading 2</option><option value="H3">Heading 3</option></select>
    <select id="eline" aria-label="Line spacing of this block"><option value="">Spacing</option><option value="1.1">Tight</option><option value="1.4">Normal</option><option value="1.8">Roomy</option><option value="2.2">Double</option></select>
    <button type="button" data-c="strikeThrough" title="Strikethrough"><s>S</s></button><button type="button" data-c="superscript" title="Superscript (x²)">x<sup>2</sup></button><button type="button" data-c="subscript" title="Subscript (H₂O)">x<sub>2</sub></button>
    <button type="button" data-c="justifyFull" title="Justify">☰</button><button type="button" data-c="outdent" title="Decrease indent">⇤¶</button><button type="button" data-c="indent" title="Increase indent">¶⇥</button><button type="button" data-c="removeFormat" title="Clear formatting of the selection">Tx</button><span class="sep"></span>
    <button type="button" data-b="dup" title="Copy this question or paragraph below itself">⧉ Copy</button><button type="button" id="efind" title="Find and replace">🔎 Replace</button><span class="sep"></span>
    <button type="button" data-i="table" title="Insert a table">▦ Table</button><button type="button" data-i="image" title="Insert a picture from your computer">🖼 Picture</button><button type="button" data-i="link" title="Link the selected text">🔗 Link</button><button type="button" data-i="hr" title="Horizontal line">― Line</button><button type="button" data-i="pagebreak" title="Start a new page here">⤓ Page break</button><span class="sep"></span>
    <button type="button" data-t="rowAfter" title="Add a row below the cell you clicked">＋ Row</button><button type="button" data-t="rowDel" title="Delete the row of the cell you clicked">− Row</button><button type="button" data-t="colAfter" title="Add a column to the right">＋ Col</button><button type="button" data-t="colDel" title="Delete the column">− Col</button><button type="button" data-t="tblDel" title="Delete the whole table you clicked in">🗑 Table</button>
  </span>
</div>`
const EDIT_SCRIPT = `<script>(function(){
var root=document.querySelector('.fsz'),etb=document.getElementById('etb'),btn=document.getElementById('editbtn'),orig=root.innerHTML,on=false,saved=null,cell=null;
function setEdit(v){on=v;root.contentEditable=v?'true':'false';document.body.classList.toggle('editing',v);etb.hidden=!v;btn.textContent=v?'✓ Done editing':'✏️ Edit text';if(v)root.focus()}
btn.onclick=function(){setEdit(!on)};
var snaps=[];function snap(){snaps.push(root.innerHTML);if(snaps.length>30)snaps.shift()}
function unsnap(){if(!snaps.length){alert('Nothing to take back.');return}root.innerHTML=snaps.pop();saved=null;cell=null}
function keep(){var s=getSelection();if(on&&s.rangeCount&&root.contains(s.anchorNode))saved=s.getRangeAt(0).cloneRange()}
document.addEventListener('selectionchange',keep);root.addEventListener('mouseup',keep);root.addEventListener('keyup',keep);
root.addEventListener('click',function(e){cell=e.target.closest&&e.target.closest('td,th')});
root.addEventListener('keyup',function(){var s=getSelection();if(s.anchorNode&&s.anchorNode.parentElement)cell=s.anchorNode.parentElement.closest('td,th')});
function restore(){var s=getSelection();if(s.rangeCount&&root.contains(s.anchorNode)&&!s.isCollapsed)keep();if(!saved||!saved.commonAncestorContainer.isConnected||!root.contains(saved.commonAncestorContainer))return;root.focus();s.removeAllRanges();s.addRange(saved)}
function ex(c,v){restore();document.execCommand('styleWithCSS',false,true);document.execCommand(c,false,v==null?null:v)}
etb.addEventListener('mousedown',function(e){var t=e.target.tagName;if(t!=='SELECT'&&t!=='INPUT'&&t!=='OPTION')e.preventDefault()});
etb.addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;if(b.dataset.c)ex(b.dataset.c);else if(b.dataset.t)tbl(b.dataset.t);else if(b.dataset.i)ins(b.dataset.i);else if(b.dataset.b)blk(b.dataset.b);else if(b.id==='efind')finder();else if(b.id==='eundo')unsnap();else if(b.id==='emoreb'){var mo=document.getElementById('emore');mo.hidden=!mo.hidden;b.textContent=mo.hidden?'More tools ▾':'Fewer tools ▴';b.setAttribute('aria-expanded',String(!mo.hidden))}else if(b.id==='ereset'&&confirm('Undo all edits and go back to the original?')){root.innerHTML=orig;saved=null;cell=null}});
document.getElementById('efont').onchange=function(){if(this.value)ex('fontName',this.value);this.selectedIndex=0};
document.getElementById('esize').onchange=function(){var px=this.value;this.selectedIndex=0;if(!px)return;restore();document.execCommand('styleWithCSS',false,false);document.execCommand('fontSize',false,'7');root.querySelectorAll('font[size="7"]').forEach(function(f){var sp=document.createElement('span');sp.style.fontSize=px+'px';sp.innerHTML=f.innerHTML;f.replaceWith(sp)})};
document.getElementById('ecolor').oninput=function(){ex('foreColor',this.value)};
document.getElementById('ehi').oninput=function(){ex('hiliteColor',this.value)};

document.getElementById('ehead').onchange=function(){var v=this.value;this.selectedIndex=0;if(v)ex('formatBlock',v)};
document.getElementById('eline').onchange=function(){var v=this.value;this.selectedIndex=0;var it=items();if(!it){alert('Click inside the text first.');return}it.forEach(function(x){x.style.lineHeight=v})};
function grp(c){if(!c)return null;if(c.matches('.opts,.ans')){var p=c.previousElementSibling;while(p&&p.matches('.opts,.ans'))p=p.previousElementSibling;if(p&&p.matches('p.q'))c=p}var a=[c];if(c.matches('p.q')){var x=c.nextElementSibling;while(x&&x.matches('.opts,.ans')){a.push(x);x=x.nextElementSibling}}return a}
function items(){var n=null,s=getSelection();if(s.anchorNode&&root.contains(s.anchorNode))n=s.anchorNode;else if(saved&&root.contains(saved.commonAncestorContainer))n=saved.commonAncestorContainer;if(n&&n.nodeType!==1)n=n.parentElement;if(!n||n===root||!root.contains(n))return null;var c=n.closest('.q,p,.opts,.ans,li,h1,h2,h3,h4,table,figure,.box,.ps,.sh');if(!c||c===root||!root.contains(c))return null;return grp(c)}
function blk(a){var it=items();if(!it){alert('Click inside a question or paragraph first.');return}if(a!=='del')snap();var first=it[0],last=it[it.length-1],ref,i;
 if(a==='del'){if(confirm(it[0].tagName==='TABLE'?'Delete this whole table?':'Delete this question or paragraph? You can take it back with Undo change.')){snap();it.forEach(function(x){x.remove()})}}
 else if(a==='dup'){ref=last;for(i=0;i<it.length;i++){var cl=it[i].cloneNode(true);ref.after(cl);ref=cl}}
 else if(a==='up'){var pv=first.previousElementSibling;if(!pv)return;var pg=grp(pv);pg[0].before.apply(pg[0],it)}
 else if(a==='down'){var nx=last.nextElementSibling;if(!nx)return;var ng=grp(nx);ref=ng[ng.length-1];for(i=it.length-1;i>=0;i--)ref.after(it[i])}}
function ins(k){restore();snap();
 if(k==='table'){var v=prompt('Rows x columns (for example 3x4)','3x3');if(!v)return;var m=v.toLowerCase().split('x'),r=parseInt(m[0],10),c=parseInt(m[1],10);if(!(r>0&&c>0&&r<=40&&c<=12)){alert('Use numbers like 3x4.');return}var h='<table style="border-collapse:collapse;width:100%;margin:6px 0">',i,j;for(i=0;i<r;i++){h+='<tr>';for(j=0;j<c;j++)h+='<'+(i?'td':'th')+' style="border:1px solid #888;padding:5px 8px">&nbsp;</'+(i?'td':'th')+'>';h+='</tr>'}h+='</table><p></p>';document.execCommand('insertHTML',false,h)}
 else if(k==='image'){var f=document.createElement('input');f.type='file';f.accept='image/*';f.onchange=function(){var fl=f.files&&f.files[0];if(!fl)return;if(fl.size>4*1024*1024){alert('Choose a picture under 4 MB.');return}var rd=new FileReader();rd.onload=function(){restore();document.execCommand('insertHTML',false,'<img src="'+rd.result+'" style="max-width:100%;height:auto;margin:4px 0" alt="">')};rd.readAsDataURL(fl)};f.click()}
 else if(k==='link'){var u=prompt('Link address (https://…)','https://');if(u&&/^https?:/i.test(u))ex('createLink',u);else if(u)alert('The link must start with http:// or https://')}
 else if(k==='hr')ex('insertHorizontalRule')
 else if(k==='pagebreak')document.execCommand('insertHTML',false,'<div class="pbk" contenteditable="false"></div><p></p>')}
function finder(){var a=prompt('Find this text:');if(!a)return;var b=prompt('Replace with (leave empty to delete it):','');if(b===null)return;snap();var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),n,cnt=0,list=[];while((n=w.nextNode()))list.push(n);list.forEach(function(t){if(t.nodeValue.indexOf(a)>=0){cnt+=t.nodeValue.split(a).length-1;t.nodeValue=t.nodeValue.split(a).join(b)}});alert(cnt?cnt+' replaced.':'Not found.')}
function tbl(a){if(!cell||!root.contains(cell)){alert('Click inside a table cell first.');return}var tr=cell.parentElement,idx=cell.cellIndex,t=cell.closest('table');
 if(a==='tblDel'){if(confirm('Delete this whole table?')){snap();t.remove();cell=null}return}
 if(a!=='tblDel')snap();
 if(a==='rowAfter'){var nr=tr.cloneNode(true);nr.querySelectorAll('td,th').forEach(function(c){c.innerHTML='&nbsp;'});tr.after(nr)}
 else if(a==='rowDel'){if(t.rows.length>1){var nx=tr.nextElementSibling||tr.previousElementSibling;tr.remove();cell=nx?nx.cells[Math.min(idx,nx.cells.length-1)]:null}}
 else if(a==='colAfter'){Array.prototype.forEach.call(t.rows,function(r){var src=r.cells[Math.min(idx,r.cells.length-1)],n=src.cloneNode(false);n.innerHTML='&nbsp;';src.after(n)});fit(t)}
 else if(a==='colDel'){if(tr.cells.length>1)Array.prototype.forEach.call(t.rows,function(r){if(r.cells[idx])r.cells[idx].remove()});cell=null;fit(t)}}
function fit(t){var cg=t.querySelector('colgroup');if(!cg)return;var n=t.rows[0].cells.length;while(cg.children.length<n)cg.appendChild(document.createElement('col'));while(cg.children.length>n)cg.lastChild.remove();var first=parseFloat(cg.children[0].style.width)||12,rest=(100-first)/(n-1||1);Array.prototype.forEach.call(cg.children,function(c,i){c.style.width=(i?rest:first)+'%'})}
})()</script>`
const pagePicker = (layout = 'p') => `<label>Paper <select id="pgsz">${Object.keys(PAPERS).map(k => `<option>${k}</option>`).join('')}</select></label><label>Layout <select id="pgor"><option value="p"${layout === 'p' ? ' selected' : ''}>Portrait</option><option value="l"${layout === 'l' ? ' selected' : ''}>Landscape</option></select></label><label>Text size <select id="fsz">${FONT_SIZES.map(([v, l]) => `<option value="${v}"${v === 1 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
const PAGE_SCRIPT = `<style id="pgcss"></style><script>(function(){var P=${JSON.stringify(PAPERS)};var sz=document.getElementById('pgsz'),or=document.getElementById('pgor');function set(){var d=P[sz.value],l=or.value==='l',w=l?d[1]:d[0],h=l?d[0]:d[1],r=document.documentElement.style;r.setProperty('--pw',w+'mm');r.setProperty('--ph',h+'mm');document.getElementById('pgcss').textContent='@page{size:'+w+'mm '+h+'mm;margin:0}';window.dispatchEvent(new CustomEvent('pagechange',{detail:h}))}sz.onchange=or.onchange=set;set();var fs=document.getElementById('fsz'),key='pp-fs:'+document.title;try{var sv=parseFloat(localStorage.getItem(key));if(sv&&Array.prototype.some.call(fs.options,function(o){return parseFloat(o.value)===sv}))fs.value=String(sv)}catch(e){}function fz(){var v=parseFloat(fs.value)||1;document.documentElement.style.setProperty('--fs',v);try{localStorage.setItem(key,String(v))}catch(e){}window.dispatchEvent(new CustomEvent('fontchange',{detail:v}))}fs.onchange=fz;fz()})()</script>`;

// bodyHTML  : the content (it may use the classes above)
// institute : { name, address, tagline, logoUrl }
// docLabel  : short label for the footer, e.g. "Duty sheet · Meera Singh · Pre Mock Test 2026"
export function printPremium(bodyHTML, { title = 'Report', institute = {}, docLabel = '', official = false, refNo = '', landscape = false } = {}) {
  if (denyPrint()) return;
  const w = window.open('', '_blank');
  if (!w) { alert('Pop-up blocked — allow pop-ups for this site to print the report.'); return; }
  const logo = esc(logoSrc(institute));
  const name = esc(institute.name || 'Guidance Navodaya & Sainik Institute');
  const stamp = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title>${FONT_LINKS}<style>${CSS}</style></head><body>
  <div class="tools"><div class="bar"><button onclick="${PRINT_NOW}">Print / Save as PDF</button><button id="editbtn" type="button" style="background:#e9d9b0">✏️ Edit text</button><span>${esc(title)}</span>${pagePicker(landscape ? 'l' : 'p')}<small>Tip: in the print window choose “Save as PDF”, margins “Default”, and leave “Headers and footers” off.</small></div>
${EDIT_BAR}</div>
  <div class="wm"><img src="${logo}" alt=""></div>
  <div class="sheet${official ? ' off' : ''}"><table class="frame">
    <thead><tr><td></td></tr></thead>
    <tfoot><tr><td><div class="fsp"></div></td></tr></tfoot>
    <tbody><tr><td class="body">
      ${official ? `<div class="oh">
        <div class="oh-row">
          <div class="oh-logo"><img src="${logo}" alt="Logo"></div>
          <div class="oh-mid"><div class="oh-n">${name}</div>${(() => { const l = [institute.tagline, institute.address, institute.phone && 'Phone: ' + institute.phone, institute.email && 'Email: ' + institute.email].filter(Boolean); return l.length ? `<div class="oh-a">${esc(l.join('  ·  '))}</div>` : '' })()}</div>
          <div class="oh-logo sp"></div>
        </div>
        <div class="oh-rule"></div>
        <div class="oh-meta"><span>Ref. No.: <u>${esc(refNo)}</u></span><span>Date: ${stamp}</span></div>
      </div>` : `<div class="lh2">
        <div class="lg"><img src="${logo}" alt="Logo"></div>
        <div class="lt"><div class="n">${name}</div>${institute.tagline ? `<div class="g">${esc(institute.tagline)}</div>` : ''}${institute.address ? `<div class="a">${esc(institute.address)}</div>` : ''}</div>
        <div class="ld"><b>Issued</b>${stamp}</div>
      </div>`}
      <div class="fsz">${bodyHTML}</div>
    </td></tr></tbody></table></div>
  <div class="pgfoot">
    <span class="l"><span class="mini"><img src="${logo}" alt=""></span><span><b>${name}</b>${docLabel ? ` · ${esc(docLabel)}` : ''}</span></span>
    <span class="credit">${esc(DESIGN_CREDIT)}</span>
  </div>
  ${PAGE_SCRIPT}${EDIT_SCRIPT}</body></html>`);
  w.document.close();
}

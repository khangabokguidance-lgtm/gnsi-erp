import { NotoSansMeeteiMayek } from './NotoSansMeeteiMayek-normal.js'

// The Meetei Mayek font travels with the app (22 KB), so an exam computer with no internet — a lab PC —
// still shows the Meitei Mayek letters. unicode-range keeps Latin text on the normal font.
const MAYEK_FACE = `@font-face{font-family:'GNSI Mayek';src:url(data:font/ttf;base64,${NotoSansMeeteiMayek}) format('truetype');unicode-range:U+AAE0-AAFF,U+ABC0-ABFF;font-display:swap}`
const MAYEK_STACK = "'GNSI Mayek','Noto Sans Meetei Mayek','Meetei Mayek',sans-serif"

// Styles for the CBT Exam: the admin screens (tests, builder, results) and the candidate's exam screen.
// Desktop: two panes (question | palette). Phone (≤ 860px): one pane, the palette becomes a bottom sheet,
// the action buttons sit in a bar at the bottom, tables scroll sideways.
export const CBT_CSS = `${MAYEK_FACE}
.cbt{--navy:#14264a;--navy2:#0b1e3d;--gold:#c9a24b;--gold2:#e2c57e;--ink:#1f2a44;--line:#dde3ef;--soft:#f5f7fc;--ok:#2e8b3d;--bad:#d9532c;--vio:#6a3fa0;
  font-family:'Plus Jakarta Sans','Inter',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:var(--ink);-webkit-text-size-adjust:100%}
.cbt *{box-sizing:border-box}
.cbt button{font-family:inherit;-webkit-tap-highlight-color:transparent}

/* ── admin ── */
.cbt-page{padding:18px 20px 48px;max-width:1280px;margin:0 auto}
.cbt-hero{position:relative;overflow:hidden;color:#fff;border-radius:18px;padding:20px 22px;margin-bottom:16px;
  background:radial-gradient(120% 140% at 100% 0%,#1F4E8C 0%,#132B52 48%,#0B1E3D 90%);box-shadow:0 22px 44px -26px rgba(11,30,61,.6),inset 0 0 0 1px rgba(226,197,126,.22)}
.cbt-hero .eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.18em;color:var(--gold2)}
.cbt-hero h2{margin:4px 0 4px;font-family:'Fraunces',Georgia,serif;font-size:26px;line-height:1.15}
.cbt-hero p{margin:0;opacity:.8;font-size:13px;max-width:640px;line-height:1.5}
.cbt-hero .row{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap}
.cbt-tabs{display:flex;gap:4px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px}
.cbt-tabs button{border:none;background:transparent;color:#fff;font-weight:800;font-size:12.5px;padding:8px 16px;border-radius:999px;cursor:pointer}
.cbt-tabs button[aria-selected=true]{background:var(--gold2);color:var(--navy2)}
.cbt .card{background:#fff;border:1px solid #e8e1cd;border-radius:16px;padding:18px;margin-bottom:14px;box-shadow:0 12px 30px -26px rgba(19,42,79,.5)}
.cbt h3{font-family:'Fraunces',Georgia,serif;color:#0f1f3d;margin:0 0 6px;font-size:17px}
.cbt .step{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;background:var(--navy);color:#fff;font:800 12px 'Plus Jakarta Sans',sans-serif;margin-right:8px;vertical-align:middle}
.cbt .lbl{display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:5px}
.cbt .in{width:100%;padding:10px 12px;border:1px solid #cfd6e4;border-radius:10px;font:inherit;font-size:14px;background:#fff;color:var(--ink);min-height:40px}
.cbt .in:focus{outline:2px solid rgba(30,58,110,.25);border-color:#1e3a6e}
.cbt .btn{border:none;border-radius:10px;font-weight:800;font-size:13px;padding:10px 16px;min-height:40px;cursor:pointer;background:#eef1f7;color:#334155;transition:filter .12s}
.cbt .btn:hover{filter:brightness(.96)}
.cbt .btn:disabled{opacity:.5;cursor:not-allowed}
.cbt .btn.gold{background:linear-gradient(180deg,#D9B566,#C9A24B);color:var(--navy2)}
.cbt .btn.navy{background:var(--navy);color:#fff}
.cbt .btn.red{background:#fee2e2;color:#b42318}
.cbt .grid{display:grid;gap:12px}
.cbt .muted{color:#64748b;font-size:12.5px;line-height:1.5}
.cbt .tag{display:inline-block;font-size:10.5px;font-weight:800;border-radius:999px;padding:3px 10px}
.cbt .tbl{overflow-x:auto;-webkit-overflow-scrolling:touch}
.cbt table{width:100%;border-collapse:collapse;font-size:13px}
.cbt th{text-align:left;background:#f3f6fd;color:#1d3a78;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:9px 10px;white-space:nowrap}
.cbt td{padding:9px 10px;border-bottom:1px solid #e8edf6;vertical-align:top}
.cbt .num{text-align:right}
.cbt-tests{grid-template-columns:repeat(auto-fill,minmax(330px,1fr))}
.cbt-actions{display:flex;gap:8px;flex-wrap:wrap}
.cbt-keygrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(176px,1fr));gap:7px;margin-top:8px}
.cbt-keyrow{display:flex;align-items:center;gap:5px;border:1px solid var(--line);border-radius:10px;padding:5px 8px;background:#fff}
.cbt-keyrow.set{background:#f1faf3;border-color:#bfe3c7}
.cbt-keyrow b{width:28px;font-size:12.5px}
.cbt-keyrow button{width:30px;height:30px;border-radius:8px;border:1px solid #c5cde0;background:#fff;color:#334155;font-weight:800;font-size:12px;cursor:pointer}
.cbt-keyrow button[aria-pressed=true]{background:var(--navy);color:#fff;border-color:var(--navy)}
.cbt-thumbs{display:flex;gap:8px;overflow-x:auto;padding:4px 0 2px}
.cbt-thumbs img{height:60px;flex:none;border:1px solid var(--line);border-radius:6px;background:#fff}
.cbt-savebar{display:flex;gap:8px;flex-wrap:wrap}
.cbt-flag{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-left-width:5px;border-radius:12px;padding:10px 12px;margin-top:8px;background:#fff}
.cbt-flag.warn{border-left-color:#e0a21b;background:#fffaf0}.cbt-flag.error{border-left-color:#d9342b;background:#fff5f4}
.cbt-flag ul{margin:4px 0 0;padding-left:18px;font-size:12.5px;line-height:1.5}
.cbt-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(40px,1fr));gap:6px}
.cbt-chip{height:36px;border-radius:9px;border:2px solid transparent;font-weight:800;font-size:12.5px;cursor:pointer;color:#fff}
.cbt-chip.ok{background:var(--ok)}.cbt-chip.warn{background:#e0a21b}.cbt-chip.error{background:#d9342b}
.cbt-chip.sel{outline:3px solid var(--navy);outline-offset:2px}
.cbt-edit{margin-top:14px;border:1.5px solid var(--navy);border-radius:14px;padding:14px;background:#fbfcff}
.cbt-figbox{border:1px dashed #b6c4e2;border-radius:10px;padding:10px;margin:8px 0;background:#fff}
.cbt-figbox img{max-width:100%;max-height:220px;display:block;margin:0 auto 6px;border:1px solid var(--line);border-radius:6px}
.cbt-twin{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cbt-twin .mm,.cbt .in.mm{font-family:${MAYEK_STACK}}

/* ── exam screen ── */
.cbt-exam{position:fixed;inset:0;z-index:3000;background:#eef1f7;display:flex;flex-direction:column;color:#1f2933;user-select:none;-webkit-user-select:none;overflow:hidden}
.cbt-exam .mm{font-family:${MAYEK_STACK};line-height:1.75}
.cbt-top{display:flex;align-items:center;gap:12px;padding:10px 18px;color:#fff;flex-wrap:wrap;
  background:linear-gradient(90deg,#0b1e3d,#14264a 55%,#1b3566);border-bottom:3px solid var(--gold)}
.cbt-top .title{font-weight:800;font-size:15px;flex:1 1 240px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.01em}
.cbt-tools{display:flex;align-items:center;gap:10px;order:2}
.cbt-top .cand{display:flex;align-items:center;gap:9px;font-size:12.5px;line-height:1.25}
.cbt-top .avatar{width:34px;height:34px;border-radius:50%;background:var(--gold2);color:var(--navy2);font-weight:800;display:flex;align-items:center;justify-content:center;flex:none}
.cbt-top select,.cbt-top button.sm{background:rgba(255,255,255,.95);color:var(--navy2);border:none;border-radius:8px;padding:7px 10px;font-weight:700;font-size:12px;cursor:pointer;min-height:32px}
.cbt-timer{order:3;background:#fff;color:var(--navy2);border-radius:10px;padding:6px 14px;font-weight:800;font-size:17px;font-variant-numeric:tabular-nums;letter-spacing:.02em;box-shadow:inset 0 -3px 0 rgba(0,0,0,.08)}
.cbt-timer.low{background:#b42318;color:#fff;animation:cbtblink 1s steps(2) infinite}
@keyframes cbtblink{50%{opacity:.7}}
.cbt-secbar{background:#fff;border-bottom:1px solid var(--line);display:flex;gap:4px;padding:0 14px;overflow-x:auto;scrollbar-width:none}
.cbt-secbar::-webkit-scrollbar{display:none}
.cbt-sec{border:none;border-bottom:3px solid transparent;background:transparent;color:#475569;padding:11px 14px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap}
.cbt-sec.on{color:var(--navy2);border-bottom-color:var(--gold)}
.cbt-sec small{font-weight:700;margin-left:6px;background:#eef1f7;border-radius:999px;padding:2px 7px;font-size:10.5px}
.cbt-sec.on small{background:var(--navy);color:#fff}
.cbt-body{flex:1;min-height:0;display:flex}
.cbt-main{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;background:#fff}
.cbt-qhead{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;border-bottom:1px solid var(--line);background:var(--soft);gap:10px}
.cbt-qno{font-weight:800;font-size:15px;display:flex;align-items:center;gap:10px}
.cbt-qno i{font-style:normal;background:var(--navy);color:#fff;border-radius:8px;padding:3px 10px;font-size:14px}
.cbt-qno small{color:#64748b;font-weight:700;font-size:12px}
.cbt-marks{font-size:12px;font-weight:700;white-space:nowrap}.cbt-marks .p{color:#146c3a}.cbt-marks .n{color:#b42318}
.cbt-palbtn{display:none;border:1px solid var(--navy);background:#fff;color:var(--navy);border-radius:999px;padding:6px 12px;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap}
.cbt-qarea{flex:1;min-height:0;display:flex;overflow:hidden}
.cbt-pass{flex:1 1 46%;overflow:auto;padding:16px 20px;border-right:1px solid var(--line);background:#fbfcff;font-size:var(--fs,15px);line-height:1.7}
.cbt-pass h5{margin:0 0 8px;color:var(--navy);font-size:11.5px;letter-spacing:.14em}
.cbt-passbar{display:none}
.cbt-q{flex:1 1 54%;overflow:auto;padding:16px 22px;font-size:var(--fs,15px)}
.cbt-dir{background:var(--soft);border:1px solid var(--line);border-left:4px solid var(--gold);padding:10px 14px;border-radius:8px;margin-bottom:14px;line-height:1.6;font-size:.93em}
.cbt-qtext{white-space:pre-wrap;line-height:1.65;margin-bottom:16px;font-weight:600}
.cbt-fig{max-width:100%;max-height:50vh;display:block;margin:0 auto 16px;border:1px solid var(--line);border-radius:8px;background:#fff;padding:4px}
.cbt-opt{display:flex;align-items:flex-start;gap:12px;padding:11px 14px;border:1.5px solid var(--line);border-radius:12px;margin-bottom:9px;cursor:pointer;background:#fff;transition:background .12s,border-color .12s}
.cbt-opt:hover{background:#f5f8ff;border-color:#b6c4e2}
.cbt-opt.on{border-color:var(--navy);background:#e9effb;box-shadow:0 0 0 1px var(--navy) inset}
.cbt-opt input{position:absolute;opacity:0;pointer-events:none}
.cbt-opt:focus-within{outline:3px solid #f2b705;outline-offset:1px}
.cbt-opt b{flex:none;width:28px;height:28px;border-radius:50%;border:1.5px solid #9aa8c6;color:var(--navy);display:flex;align-items:center;justify-content:center;font-size:13px;background:#fff}
.cbt-opt.on b{background:var(--navy);color:#fff;border-color:var(--navy)}
.cbt-opt span{padding-top:3px;line-height:1.55}
.cbt-act{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:8px;padding:10px 18px;border-top:1px solid var(--line);background:var(--soft);align-items:center;padding-bottom:calc(10px + env(safe-area-inset-bottom))}
.cbt-act .sp{grid-column:3}
.cbt-b{border:1.5px solid #b6c0d6;background:#fff;color:var(--navy);border-radius:10px;padding:10px 16px;min-height:42px;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap}
.cbt-b:disabled{opacity:.45;cursor:not-allowed}
.cbt-b.save{background:var(--ok);color:#fff;border-color:var(--ok)}
.cbt-b.mark{background:var(--vio);color:#fff;border-color:var(--vio)}
.cbt-b.sub{background:#1b6ca8;color:#fff;border-color:#1b6ca8;width:100%}
.cbt-side{width:320px;flex:none;display:flex;flex-direction:column;background:#eaf0fa;min-height:0;border-left:1px solid var(--line)}
.cbt-sheet-h{display:none}
.cbt-legend{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px 14px;font-size:11.5px;border-bottom:1px solid #cdd8ea;background:#f3f7fd}
.cbt-legend div{display:flex;align-items:center;gap:7px;line-height:1.2}
.cbt-pal{flex:1;min-height:0;overflow:auto;padding:12px 14px}
.cbt-pal h5{margin:0 0 10px;background:var(--navy);color:#fff;padding:7px 11px;font-size:12px;border-radius:8px;line-height:1.35}
.cbt-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.cbt-n{position:relative;height:40px;border:none;font-weight:800;font-size:13.5px;cursor:pointer;color:#fff;border-radius:10px}
.cbt-n.notVisited,.cbt-s.notVisited{background:#e1e6f0;color:#334155}
.cbt-n.notAnswered,.cbt-s.notAnswered{background:var(--bad)}
.cbt-n.answered,.cbt-s.answered{background:var(--ok)}
.cbt-n.marked,.cbt-s.marked{background:var(--vio);border-radius:50%}
.cbt-n.answeredMarked,.cbt-s.answeredMarked{background:var(--vio);border-radius:50%}
.cbt-n.answeredMarked::after,.cbt-s.answeredMarked::after{content:'✔';position:absolute;right:-3px;bottom:-3px;background:var(--ok);border-radius:50%;width:16px;height:16px;font-size:10px;line-height:16px;text-align:center;color:#fff}
.cbt-n.cur{outline:3px solid #f2b705;outline-offset:2px}
.cbt-s{position:relative;display:inline-flex;width:28px;height:28px;color:#fff;font-weight:800;font-size:11px;align-items:center;justify-content:center;flex:none;border-radius:8px}
.cbt-s.marked,.cbt-s.answeredMarked{border-radius:50%}
.cbt-side .foot{padding:12px 14px;border-top:1px solid #cdd8ea;background:#f3f7fd;padding-bottom:calc(12px + env(safe-area-inset-bottom))}
.cbt-backdrop{display:none}
.only-sm{display:none}
.cbt-modal{position:fixed;inset:0;z-index:3100;background:rgba(10,20,40,.62);display:flex;align-items:center;justify-content:center;padding:16px}
.cbt-modal .box{background:#fff;border-radius:16px;max-width:780px;width:100%;max-height:92vh;overflow:auto;padding:22px;box-shadow:0 30px 70px -20px rgba(0,0,0,.5)}
.cbt-modal .tbl{overflow-x:auto}
.cbt-modal table{width:100%;border-collapse:collapse;font-size:13px}
.cbt-modal th{background:var(--navy);color:#fff;padding:8px;text-align:center;font-size:12px}
.cbt-modal td{padding:8px;border:1px solid var(--line);text-align:center}
.cbt-modal td:first-child,.cbt-modal th:first-child{text-align:left}
.cbt-row{display:flex;justify-content:space-between;gap:10px;margin-top:16px}
.cbt-center{max-width:780px;margin:0 auto;padding:22px 16px 30px;overflow:auto;flex:1;width:100%}
.cbt-center .panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:24px;box-shadow:0 18px 40px -30px rgba(19,42,79,.5)}
.cbt-center h3{font-size:20px}
.cbt-toast{position:fixed;left:50%;top:84px;transform:translateX(-50%);background:#b42318;color:#fff;padding:10px 18px;border-radius:10px;font-weight:700;z-index:3200;font-size:13px;box-shadow:0 12px 30px rgba(0,0,0,.3);max-width:92vw;text-align:center}
.cbt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0}
.cbt-stat{background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.cbt-stat b{display:block;font-size:24px;line-height:1.2}
.cbt-review{border:1px solid var(--line);border-left-width:5px;border-radius:12px;padding:14px;margin-bottom:12px;background:#fff}

/* ── phone and small tablet ── */
@media(max-width:860px){
 .cbt-page{padding:12px 12px 40px}
 .cbt-hero{padding:16px;border-radius:16px}.cbt-hero h2{font-size:22px}
 .cbt-hero .row{align-items:stretch}.cbt-tabs{width:100%}.cbt-tabs button{flex:1}
 .cbt .card{padding:14px;border-radius:14px}
 .cbt-tests{grid-template-columns:1fr}
 .cbt-actions .btn,.cbt-savebar .btn{flex:1 1 calc(50% - 8px)}
 .cbt-actions .btn.red{flex:0 0 auto;padding:10px 18px}
 .cbt-twin{grid-template-columns:1fr}
 .cbt-flag{flex-direction:column}.cbt-flag .btn{width:100%}
 .cbt-keygrid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cbt-keyrow{gap:3px;padding:4px 5px;min-width:0}.cbt-keyrow b{width:22px;font-size:12px}.cbt-keyrow button{flex:1;min-width:0;width:auto;height:32px}
 .cbt-savebar{position:sticky;bottom:0;z-index:5;background:linear-gradient(180deg,rgba(238,241,247,0),#eef1f7 28%);padding:14px 0 calc(10px + env(safe-area-inset-bottom))}
 .cbt-savebar .btn{min-height:46px}

 .cbt-top{display:grid;grid-template-columns:1fr auto;gap:8px 10px;padding:8px 12px;border-bottom-width:2px}
 .cbt-top .title{grid-column:1;flex:none;font-size:13.5px}
 .cbt-timer{grid-column:2;grid-row:1;font-size:15px;padding:5px 11px}
 .cbt-tools{grid-column:1/-1;grid-row:2;overflow-x:auto;scrollbar-width:none;gap:8px}
 .cbt-tools::-webkit-scrollbar{display:none}
 .cbt-top .cand span:last-child{display:none}.cbt-top .cand{flex:none}
 .cbt-top .avatar{width:30px;height:30px;font-size:13px}
 .cbt-top select{max-width:170px}
 .not-sm{display:none}.only-sm{display:inline}
 .cbt-top select,.cbt-top button.sm{flex:none;min-height:34px}
 .cbt-secbar{padding:0 6px}.cbt-sec{padding:10px 11px;font-size:12.5px}
 .cbt-qhead{padding:8px 12px}
 .cbt-palbtn{display:inline-flex;align-items:center;gap:6px}
 .cbt-marks{display:none}
 .cbt-qarea{flex-direction:column;overflow:auto;-webkit-overflow-scrolling:touch}
 .cbt-pass{flex:none;max-height:none;overflow:visible;border-right:none;border-bottom:1px solid var(--line);padding:0}
 .cbt-pass>div,.cbt-pass>h5{display:none}
 .cbt-pass.open>div{display:block;max-height:40vh;overflow:auto;padding:4px 14px 14px}
 .cbt-pass.open>h5{display:none}
 .cbt-passbar{display:flex;width:100%;justify-content:space-between;align-items:center;border:none;background:#eef3fc;color:var(--navy);font-weight:800;font-size:12.5px;letter-spacing:.06em;padding:11px 14px;cursor:pointer}
 .cbt-q{flex:none;overflow:visible;padding:14px 14px 20px}
 .cbt-fig{max-height:44vh}
 .cbt-opt{padding:13px 14px;min-height:52px}
 .cbt-act{grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));box-shadow:0 -6px 18px -12px rgba(0,0,0,.35)}
 .cbt-act .sp{display:none}
 .cbt-b{min-height:48px;padding:10px 8px;font-size:13.5px;white-space:normal;line-height:1.2}
 .cbt-b.b-save{order:2}.cbt-b.b-prev{order:1}.cbt-b.b-mark{order:3}.cbt-b.b-clear{order:4}
 .cbt-side{position:fixed;left:0;right:0;bottom:0;width:auto;max-height:82vh;z-index:3050;border-radius:20px 20px 0 0;border-left:none;box-shadow:0 -14px 50px rgba(0,0,0,.4);transform:translateY(106%);transition:transform .26s ease;visibility:hidden}
 .cbt-side.open{transform:none;visibility:visible}
 .cbt-backdrop.open{display:block;position:fixed;inset:0;z-index:3040;background:rgba(10,20,40,.55)}
 .cbt-sheet-h{display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px;font-weight:800}
 .cbt-sheet-h::before{content:'';position:absolute;left:50%;top:7px;width:42px;height:4px;border-radius:2px;background:#b7c3d9;transform:translateX(-50%)}
 .cbt-sheet-h button{border:none;background:#fff;border-radius:50%;width:32px;height:32px;font-weight:800;cursor:pointer}
 .cbt-grid{grid-template-columns:repeat(6,1fr)}
 .cbt-n{height:42px}
 .cbt-modal{align-items:flex-end;padding:0}
 .cbt-modal .box{border-radius:20px 20px 0 0;max-height:90vh;padding:18px 16px calc(18px + env(safe-area-inset-bottom))}
 .cbt-row{flex-direction:column-reverse}.cbt-row .cbt-b,.cbt-row .btn{width:100%}
 .cbt-center{padding:12px 10px 24px}.cbt-center .panel{padding:16px;border-radius:14px}
 .cbt-stats{grid-template-columns:repeat(2,1fr)}
 .cbt-center th{white-space:normal;font-size:10px;padding:7px 5px;letter-spacing:.02em}.cbt-center td{padding:7px 5px;font-size:12px}
 .cbt-toast{top:96px}
}
@media(max-width:380px){.cbt-grid{grid-template-columns:repeat(5,1fr)}.cbt-top .title{font-size:12.5px}}
`

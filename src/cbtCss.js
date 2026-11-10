import { NotoSansMeeteiMayek } from './NotoSansMeeteiMayek-normal.js'
import { BMEI04_BASE64 } from './bmei04_font_base64'

// The Meetei Mayek font travels with the app (22 KB), so an exam computer with no internet — a lab PC —
// still shows the Meitei Mayek letters. unicode-range keeps Latin text on the normal font.
const MAYEK_FACE = `@font-face{font-family:'GNSI Mayek';src:url(data:font/ttf;base64,${NotoSansMeeteiMayek}) format('truetype');unicode-range:U+AAE0-AAFF,U+ABC0-ABFF;font-display:swap}`
// The old BMEI04 font too (22 KB): the builder's font check shows the paper's own keystrokes in it next to the
// converted Unicode text, so the converter's reading can be compared by eye.
const BMEI_FACE = `@font-face{font-family:'BMEI04';src:url(data:font/ttf;base64,${BMEI04_BASE64}) format('truetype');font-display:swap}`
const MAYEK_STACK = "'GNSI Mayek','Noto Sans Meetei Mayek','Meetei Mayek',sans-serif"

// Styles for the CBT Exam: the admin screens (tests, builder, results) and the candidate's exam screen.
// Desktop: two panes (question | palette). Phone (≤ 860px): one pane, the palette becomes a bottom sheet,
// the action buttons sit in a bar at the bottom, tables scroll sideways.
export const CBT_CSS = `${MAYEK_FACE}${BMEI_FACE}
.cbt-bmei{font-family:'BMEI04',sans-serif;font-size:1.15em;line-height:1.7}
.cbt{--navy:#14264a;--navy2:#0b1e3d;--gold:#c9a24b;--gold2:#e2c57e;--ink:#1f2a44;--line:#dde3ef;--soft:#f5f7fc;--ok:#2e8b3d;--bad:#d9532c;--vio:#6a3fa0;
  font-family:'Plus Jakarta Sans','Inter',system-ui,-apple-system,'Segoe UI',Arial,sans-serif;color:var(--ink);-webkit-text-size-adjust:100%}
.cbt *{box-sizing:border-box}
.cbt button{font-family:inherit;-webkit-tap-highlight-color:transparent}

/* ── admin ── */
.cbt-page{padding:18px 20px 48px;max-width:1280px;margin:0 auto}
.cbt-hero{position:relative;overflow:hidden;color:#fff;border-radius:18px;padding:20px 22px;margin-bottom:16px;
  background:radial-gradient(120% 140% at 100% 0%,#1F4E8C 0%,#132B52 48%,#0B1E3D 90%);box-shadow:0 22px 44px -26px rgba(11,30,61,.6),inset 0 0 0 1px rgba(226,197,126,.22)}
.cbt-welcome{position:relative;overflow:hidden;text-align:center;color:#fff;border-radius:26px;padding:22px 20px 24px;background:linear-gradient(160deg,#0f2a5c 0%,#0a1b42 55%,#081735 100%);border:1px solid rgba(226,197,126,.55);box-shadow:0 0 0 5px rgba(8,23,53,.35),0 30px 70px -26px rgba(8,23,53,.8)}
.cbt-welcome>*:not(.cbt-welcome-ring){position:relative}
.cbt-welcome-ring{position:absolute;border-radius:50%;border:1px solid rgba(226,197,126,.18);pointer-events:none}
.cbt-welcome-ring.r1{width:520px;height:520px;left:50%;top:-320px;transform:translateX(-50%);box-shadow:0 0 0 26px rgba(226,197,126,.05),0 0 0 52px rgba(226,197,126,.035)}
.cbt-welcome-ring.r2{width:300px;height:300px;right:-140px;bottom:-150px}
.cbt-welcome .cbt-home{float:left;margin:0}
.cbt-welcome-crest{clear:both;width:112px;height:112px;margin:6px auto 12px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 50% 38%,#1f4585 0%,#0c2150 62%,#081735 100%);box-shadow:0 0 0 3px #c9a24b,0 0 0 7px rgba(226,197,126,.25),0 16px 34px -8px rgba(0,0,0,.7),inset 0 0 18px rgba(0,0,0,.45)}
.cbt-welcome-crest img{width:86px;height:auto;max-height:86px;object-fit:contain;display:block;filter:drop-shadow(0 3px 6px rgba(0,0,0,.5))}
.cbt-welcome-inst{font:800 10.5px/1.4 'Inter',system-ui,sans-serif;letter-spacing:.2em;color:#e2c57e}
.cbt-welcome h1{margin:.5rem 0 .1rem;font:700 32px/1.15 'Fraunces',Georgia,serif;color:#fff}
.cbt-welcome h1 span{display:block;background:linear-gradient(180deg,#fff3c9,#e2c57e 55%,#b8913f);-webkit-background-clip:text;background-clip:text;color:transparent}
.cbt-welcome-rule{display:flex;align-items:center;justify-content:center;gap:.6rem;margin:.6rem auto .8rem;width:60%}
.cbt-welcome-rule span{flex:1;height:1px;background:linear-gradient(90deg,transparent,#c9a24b)}.cbt-welcome-rule span:last-child{transform:scaleX(-1)}
.cbt-welcome-rule b{width:8px;height:8px;transform:rotate(45deg);background:#e2c57e}
.cbt-welcome-lead{margin:0 auto 14px;max-width:46ch;color:rgba(255,255,255,.86);font-size:15px;line-height:1.55}
.cbt-welcome-next{margin:0 auto 14px;max-width:420px;padding:14px 12px 12px;border-radius:18px;background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.05));border:1px solid rgba(226,197,126,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.18)}
.cbt-welcome-next small{display:block;margin-bottom:8px;font:800 10.5px 'Inter',system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#e2c57e}
.cbt-welcome-next b{display:block;margin-top:10px;font:700 17px 'Fraunces',Georgia,serif;color:#fff}
.cbt-welcome-next>span{display:block;margin-top:2px;font-size:12.5px;color:rgba(255,255,255,.72)}
.cbt-cd-lg{gap:7px;flex-wrap:nowrap}.cbt-cd-lg .cbt-cd-c{min-width:60px;padding:8px 6px;border-radius:12px;background:linear-gradient(180deg,#14336d,#0a1b42);border-color:rgba(226,197,126,.7)}.cbt-cd-lg .cbt-cd-c b{font-size:24px;margin:0;color:#fff;font-family:'Inter',system-ui,sans-serif}
@media (max-width:380px){.cbt-cd-lg{gap:5px}.cbt-cd-lg .cbt-cd-c{min-width:50px}.cbt-cd-lg .cbt-cd-c b{font-size:20px}}
.cbt-welcome-live{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.cbt-welcome-live span{display:inline-flex;align-items:center;gap:7px;padding:5px 12px;border-radius:999px;font-size:12.5px;font-weight:800;color:#fff;background:linear-gradient(135deg,#d9461f,#b42318)}
.cbt-welcome-live span i{width:8px;height:8px;border-radius:50%;background:#fff;animation:cbtblink 1.1s steps(2,start) infinite}
.cbt-welcome-live span.up{background:rgba(255,255,255,.12);border:1px solid rgba(226,197,126,.55);color:#e2c57e}
@keyframes cbtblink{50%{opacity:.2}}
.cbt-welcome-cta{display:flex;flex-direction:column;gap:8px;max-width:360px;margin:0 auto 18px}
.cbt-welcome-go{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:9px;padding:15px 16px;border:none;border-radius:14px;cursor:pointer;color:#1a1204;font:800 16px 'Inter',system-ui,sans-serif;background:linear-gradient(135deg,#f1d789,#e2c57e 40%,#b8913f);box-shadow:0 12px 26px -10px rgba(226,197,126,.75),inset 0 1px 0 rgba(255,255,255,.6)}
.cbt-welcome-go::after{content:'';position:absolute;top:0;bottom:0;width:60px;left:-80px;background:linear-gradient(100deg,transparent,rgba(255,255,255,.65),transparent);transform:skewX(-20deg);animation:cbtshine 3.2s ease-in-out infinite}
@keyframes cbtshine{0%,60%{left:-80px}100%{left:120%}}
.cbt-welcome-alt{padding:12px 16px;border-radius:14px;cursor:pointer;color:#fff;background:rgba(255,255,255,.08);border:1px solid rgba(226,197,126,.5);font:700 14px 'Inter',system-ui,sans-serif}
.cbt-welcome-feats{display:grid;grid-template-columns:1fr 1fr;gap:10px;text-align:left;margin:0 0 16px}
.cbt-welcome-feats>div{padding:12px;border-radius:14px;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.04));border:1px solid rgba(226,197,126,.28)}
.cbt-welcome-feats span{font-size:20px}.cbt-welcome-feats b{display:block;margin:4px 0 2px;font-size:13.5px;color:#fff}.cbt-welcome-feats small{display:block;font-size:12px;line-height:1.4;color:rgba(255,255,255,.7)}
.cbt-welcome-steps{text-align:left;padding:14px;border-radius:16px;background:rgba(255,255,255,.06);border:1px solid rgba(226,197,126,.22)}
.cbt-welcome-steps h2{margin:0 0 8px;font:800 11px 'Inter',system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#e2c57e}
.cbt-welcome-steps ol{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.cbt-welcome-steps li{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.45;color:rgba(255,255,255,.88)}
.cbt-welcome-steps li i{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-style:normal;font-weight:800;font-size:12px;color:#1a1204;background:linear-gradient(135deg,#f1d789,#b8913f)}
.cbt-welcome-foot{margin:14px 0 0;font-size:12px;color:rgba(255,255,255,.6)}
@media (max-width:380px){.cbt-welcome h1{font-size:27px}.cbt-welcome-feats{grid-template-columns:1fr}}
@media (min-width:640px){.cbt-welcome{padding:28px 34px 30px}.cbt-welcome h1{font-size:38px}.cbt-welcome-cta{flex-direction:row;max-width:none;justify-content:center}.cbt-welcome-go{padding:15px 28px}.cbt-welcome-feats{grid-template-columns:repeat(4,1fr)}}
@media (prefers-reduced-motion:reduce){.cbt-welcome-go::after,.cbt-welcome-live span i{animation:none}}
.cbt-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin:0 0 12px}
.cbt-kpis>div{background:#fff;border:1px solid #e3e8f2;border-radius:12px;padding:10px 12px}
.cbt-kpis small{display:block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#64748b}
.cbt-kpis b{display:block;margin-top:2px;font-size:19px;color:#0f2a5c;font-variant-numeric:tabular-nums}
.cbt-tops{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.cbt-tops>div{border:1px solid #e3e8f2;border-radius:12px;padding:10px 12px;background:#fbfcff}
.cbt-tops>div>b{display:block;margin-bottom:6px;color:#0f2a5c}
.cbt-tops .row{display:flex;gap:8px;align-items:center;padding:3px 0;font-size:13.5px}.cbt-tops .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cbt-tops .mk{font-variant-numeric:tabular-nums;font-weight:800}
.cbt-filters{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.cbt-cd-sm{gap:5px;flex-wrap:nowrap}.cbt-cd-sm .cbt-cd-c{min-width:42px;padding:5px 6px;border-radius:9px}.cbt-cd-sm .cbt-cd-c b{font-size:15px}.cbt-cd-sm .cbt-cd-c small{font-size:8.5px;margin-top:2px}
.cbt-fchip{display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border-radius:999px;border:1px solid #cdd6e6;background:#fff;color:#0f2a5c;font-weight:700;font-size:12.5px;cursor:pointer;min-height:38px}
.cbt-fchip i{font-style:normal;font-size:11px;font-weight:800;min-width:20px;text-align:center;border-radius:999px;padding:2px 6px;background:#eef1f7;color:#0f2a5c}
.cbt-fchip.on{background:#0f2a5c;color:#fff;border-color:#0f2a5c}.cbt-fchip.on i{background:#e2c57e;color:#0b1e3d}
.cbt-link{background:none;border:none;padding:0;color:#1f4e8c;font-weight:700;text-decoration:underline;cursor:pointer;font:inherit}
.cbt-home{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(226,197,126,.55);color:#fff!important;font-size:12.5px;font-weight:700;text-decoration:none;letter-spacing:.02em}
.cbt-home:hover{background:rgba(255,255,255,.22)}
.cbt-hero .eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.18em;color:var(--gold2)}
.cbt-hero h2{color:#fff;margin:4px 0 4px;font-family:'Fraunces',Georgia,serif;font-size:26px;line-height:1.15}
.cbt-hero-logo{position:absolute;right:16px;top:14px;width:66px;height:auto;filter:drop-shadow(0 4px 10px rgba(0,0,0,.35))}
.cbt-hero:has(.cbt-hero-logo) h2,.cbt-hero:has(.cbt-hero-logo) .eyebrow{padding-right:80px}
@media(max-width:480px){.cbt-hero-logo{width:52px;right:12px;top:12px}.cbt-hero:has(.cbt-hero-logo) h2,.cbt-hero:has(.cbt-hero-logo) .eyebrow{padding-right:62px}}
.cbt-hero p{color:#fff;margin:0;opacity:.8;font-size:13px;max-width:640px;line-height:1.5}
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
.cbt-cmp{margin-top:6px}
.cbt-cmp-sum{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.cbt-cmp-head,.cbt-cmp-row{display:grid;grid-template-columns:34px minmax(0,1fr) minmax(0,1fr);gap:10px;align-items:start}
.cbt-cmp-head{font-size:12.5px;color:#5d6b82;padding:0 8px 4px}
.cbt-cmp-row{padding:8px;margin-bottom:6px;border:1px solid var(--line);border-radius:12px;background:#fff}
.cbt-cmp-row.diff{border-color:#e0a21b;background:#fffaf0}
.cbt-cmp-l{display:flex;flex-direction:column;align-items:center;gap:4px;padding-top:6px;font-weight:800;color:var(--navy)}
.cbt-cmp-c .in{width:100%}
.cbt-nums{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin-top:5px;font-size:11.5px}
.cbt-nums i{font-style:normal;color:#64748b;margin-right:2px}
.cbt-num{background:#eef2f9;color:#1e3a6e;border-radius:999px;padding:1px 8px;font-weight:700}
.cbt-num.miss{background:#fde8e6;color:#b42318;outline:1px solid #f5c2bd}
.cbt .in.mm{font-family:${MAYEK_STACK}}

/* ── exam screen ── */
.cbt-exam{position:fixed;left:0;right:0;top:var(--cbt-top,0px);height:var(--cbt-h,100dvh);z-index:3000;background:#eef1f7;display:flex;flex-direction:column;color:#1f2933;user-select:none;-webkit-user-select:none;overflow:hidden}
.cbt-exam .mm{font-family:${MAYEK_STACK};line-height:1.75}
/* Smooth slide: the test slides in from the right when it opens, and each step after it
   (instructions → declaration → camera check → the paper) slides in the same way. */
@keyframes cbtopen{from{transform:translate3d(100%,0,0)}to{transform:translate3d(0,0,0)}}
@keyframes cbtstep{from{transform:translate3d(36px,0,0);opacity:0}to{transform:translate3d(0,0,0);opacity:1}}
.cbt-exam{animation:cbtopen .45s cubic-bezier(.22,1,.36,1) backwards}
.cbt-exam .cbt-center,.cbt-exam .cbt-body{animation:cbtstep .4s cubic-bezier(.22,1,.36,1) .08s backwards}
@media (prefers-reduced-motion:reduce){.cbt-exam,.cbt-exam .cbt-center,.cbt-exam .cbt-body{animation:none}}

/* ── premium introduction ── */
.cbt-intro{flex:1;min-height:0;display:grid;place-items:center;padding:24px 16px;overflow:auto;color:#fff;
  background:radial-gradient(1100px 560px at 15% -10%,#1f4e8c 0%,transparent 60%),radial-gradient(900px 520px at 110% 115%,#8a6516 0%,transparent 55%),linear-gradient(160deg,#0b1e3d,#14264a 60%,#0b1e3d)}
.cbt-intro-card{max-width:700px;width:100%;text-align:center;padding:36px 28px 28px;border-radius:28px;border:1px solid rgba(226,197,126,.38);
  background:linear-gradient(180deg,rgba(255,255,255,.10),rgba(255,255,255,.04));box-shadow:0 34px 90px -34px rgba(0,0,0,.75),inset 0 1px 0 rgba(255,255,255,.14)}
.cbt-intro-mark{width:88px;height:88px;object-fit:contain;filter:drop-shadow(0 8px 16px rgba(0,0,0,.5))}
.cbt-intro-kicker{margin-top:10px;font-size:11.5px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--gold2)}
.cbt-intro h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:clamp(24px,4.6vw,40px);line-height:1.15;margin:10px 0 0}
.cbt-intro-rule{width:78px;height:3px;border-radius:3px;margin:16px auto;background:linear-gradient(90deg,transparent,var(--gold2),transparent)}
.cbt-intro-hi{margin:0 0 20px;font-size:15px;opacity:.92}
.cbt-intro-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px;margin:0 0 20px}
.cbt-intro-stats div{padding:13px 8px;border-radius:16px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.13)}
.cbt-intro-stats b{display:block;font-family:'Fraunces',Georgia,serif;font-size:26px;font-weight:600;color:var(--gold2);line-height:1.1}
.cbt-intro-stats span{display:block;margin-top:4px;font-size:10.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.cbt-intro-note{font-size:13px;line-height:1.65;opacity:.82;margin:0 auto 22px;max-width:500px}
.cbt-intro-actions{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.cbt-intro-actions .cbt-b{background:transparent;color:#fff;border-color:rgba(255,255,255,.38)}
.cbt-intro-actions .cbt-b.gold{background:linear-gradient(180deg,#e9c979,#c9a24b);border-color:#c9a24b;color:#0b1e3d;padding:12px 24px;font-size:14px;box-shadow:0 12px 26px -12px rgba(201,162,75,.9)}
@keyframes cbtup{from{opacity:0;transform:translate3d(0,16px,0)}to{opacity:1;transform:translate3d(0,0,0)}}
.cbt-intro-card>*{animation:cbtup .6s cubic-bezier(.22,1,.36,1) backwards}
.cbt-intro-card>:nth-child(2){animation-delay:.07s}.cbt-intro-card>:nth-child(3){animation-delay:.14s}.cbt-intro-card>:nth-child(4){animation-delay:.2s}
.cbt-intro-card>:nth-child(5){animation-delay:.26s}.cbt-intro-card>:nth-child(6){animation-delay:.34s}.cbt-intro-card>:nth-child(7){animation-delay:.42s}.cbt-intro-card>:nth-child(8){animation-delay:.5s}

/* ── instructions, one slide at a time ── */
.cbt-prog{height:5px;border-radius:5px;background:#e4e9f3;overflow:hidden;margin:0 0 16px}
.cbt-prog i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,#1f4e8c,var(--gold));transition:width .4s cubic-bezier(.22,1,.36,1)}
.cbt-ihead{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.cbt-ihead .ic{width:48px;height:48px;border-radius:15px;display:grid;place-items:center;font-size:23px;flex:none;background:linear-gradient(160deg,#1f4e8c,#0b1e3d);box-shadow:0 0 0 2px #fff,0 0 0 3.5px var(--gold)}
.cbt-ihead small{display:block;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#64748b}
.cbt-ihead h3{margin:2px 0 0;font-size:21px}
@keyframes cbtslf{from{opacity:0;transform:translate3d(46px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
@keyframes cbtslb{from{opacity:0;transform:translate3d(-46px,0,0)}to{opacity:1;transform:translate3d(0,0,0)}}
.cbt-islide{min-height:250px;animation:cbtslf .4s cubic-bezier(.22,1,.36,1) backwards}
.cbt-islide[data-dir=back]{animation-name:cbtslb}
.cbt-dots{display:flex;gap:7px;justify-content:center;margin-top:16px}
.cbt-dots button{width:9px;height:9px;border-radius:99px;border:none;padding:0;background:#c5cde0;cursor:pointer;transition:width .25s,background .25s}
.cbt-dots button.on{width:28px;background:var(--gold)}
.cbt-mcards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:12px}
.cbt-mcards div{border-radius:14px;padding:14px 8px;text-align:center;border:1px solid var(--line);background:var(--soft);font-size:12.5px;color:#475569}
.cbt-mcards b{display:block;font-size:26px;line-height:1.2}
.cbt-leg{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.cbt-leg div{display:flex;gap:11px;align-items:center;font-size:13.5px;line-height:1.4}
.cbt-bul{margin:0;padding:0;list-style:none}
.cbt-bul li{display:flex;gap:11px;align-items:flex-start;padding:10px 0;border-bottom:1px solid #eef1f7;font-size:14px;line-height:1.55}
.cbt-bul li:last-child{border-bottom:0}.cbt-bul li>span:first-child{flex:none;width:26px;text-align:center;font-size:17px}
.cbt-founder{display:grid;grid-template-columns:132px 1fr;gap:18px;align-items:center}
.cbt-founder-pic{position:relative;width:132px;height:160px;border-radius:20px;overflow:hidden;background:linear-gradient(160deg,#1f4e8c,#0b1e3d);box-shadow:0 0 0 3px #fff,0 0 0 5px var(--gold),0 18px 30px -18px rgba(11,30,61,.7)}
.cbt-founder-pic img{width:100%;height:100%;object-fit:cover;display:block}
.cbt-founder-pic span{position:absolute;inset:0;display:none;place-items:center;font:600 48px 'Fraunces',Georgia,serif;color:var(--gold2)}
.cbt-founder-pic.nophoto img{display:none}.cbt-founder-pic.nophoto span{display:grid}
.cbt-founder-txt blockquote{margin:0 0 12px;padding-left:14px;border-left:3px solid var(--gold);font-family:'Fraunces',Georgia,serif;font-size:17px;line-height:1.55;font-style:italic;color:#1f2a44}
.cbt-founder-by b{display:block;font-size:16px;color:var(--navy)}.cbt-founder-by span{display:block;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#8a6a1f;margin-top:2px}
.cbt-founder-built{display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:10px 12px;border-radius:12px;background:#fdf6e3;border:1px solid #ecd9a4;font-size:13px;line-height:1.55;color:#5b4410}
.cbt-founder-built>span:first-child{font-size:18px;line-height:1.2}
.cbt-founder-txt p{margin:12px 0 0;font-size:13px;color:#64748b}
@media (max-width:560px){.cbt-founder{grid-template-columns:1fr;justify-items:center;text-align:left}.cbt-founder-pic{width:120px;height:146px}}
.cbt-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.cbt-facts div{border-radius:14px;padding:12px;background:var(--soft);border:1px solid var(--line)}
.cbt-facts b{display:block;font-size:22px;color:var(--navy)}.cbt-facts span{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748b}
@media (prefers-reduced-motion:reduce){.cbt-intro-card>*,.cbt-islide{animation:none}}
@media (max-width:560px){.cbt-mcards{grid-template-columns:1fr}.cbt-intro-card{padding:28px 18px 22px}}
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
.cbt-q{flex:1 1 54%;overflow:auto;overscroll-behavior:contain;padding:16px 22px;font-size:var(--fs,15px)}
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
.cbt-opt:has(input:disabled){opacity:.55;cursor:not-allowed}.cbt-lockmsg{margin:10px 0 0;font-size:12.5px;font-weight:700;color:#9a5b00}
.cbt-b:disabled{opacity:.5;cursor:not-allowed}
.cbt-cam{position:fixed;right:12px;bottom:68px;z-index:3150;width:132px;border-radius:12px;overflow:hidden;background:#0b1e3d;border:3px solid #2e8b3d;box-shadow:0 10px 26px rgba(0,0,0,.3)}
.cbt-cam video{display:block;width:100%;height:99px;object-fit:cover;transform:scaleX(-1)}
.cbt-cam span{display:block;font-size:10.5px;font-weight:700;color:#fff;background:#2e8b3d;padding:3px 6px;text-align:center}
.cbt-cam:not(.s-ok){border-color:#d9532c}.cbt-cam:not(.s-ok) span{background:#d9532c}
.cbt-cam.big{position:static;width:min(100%,340px);margin:10px auto;right:auto;bottom:auto}.cbt-cam.big video{height:255px}
.cbt-cover{position:fixed;inset:0;z-index:4000;background:#0b1e3d;color:#fff;display:flex;align-items:center;justify-content:center;text-align:center;padding:24px;font-size:17px;line-height:1.6;cursor:pointer}
.cbt-shield .cbt-main,.cbt-shield .cbt-center,.cbt-shield .cbt-side{-webkit-user-select:none;user-select:none}
@media print{.cbt-exam,.cbt-cover{display:none!important}}
.cbt-net{position:fixed;left:0;right:0;top:0;z-index:3250;background:#b45309;color:#fff;font-weight:700;font-size:13px;text-align:center;padding:8px 12px}
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
 /* the comparison stays two columns on a phone; the row label moves above them */
 .cbt-cmp-head,.cbt-cmp-row{grid-template-columns:1fr 1fr;gap:6px}.cbt-cmp-head span{display:none}
 .cbt-cmp-l{grid-column:1/-1;flex-direction:row;justify-content:flex-start;padding-top:0}
 .cbt-flag{flex-direction:column}.cbt-flag .btn{width:100%}
 .cbt-keygrid{grid-template-columns:repeat(2,minmax(0,1fr))}
 .cbt-keyrow{gap:3px;padding:4px 5px;min-width:0}.cbt-keyrow b{width:22px;font-size:12px}.cbt-keyrow button{flex:1;min-width:0;width:auto;height:32px}
 .cbt-savebar{position:sticky;bottom:0;z-index:5;background:linear-gradient(180deg,rgba(238,241,247,0),#eef1f7 28%);padding:14px 0 calc(10px + env(safe-area-inset-bottom))}
 .cbt-savebar .btn{min-height:46px}

 .cbt-top{display:grid;grid-template-columns:1fr auto;gap:8px 10px;padding:8px 12px;border-bottom-width:2px}
 .cbt-top .title{grid-column:1;flex:none;font-size:13.5px}
 .cbt-timer{grid-column:2;grid-row:1;font-size:15px;padding:5px 11px}
 .cbt-sectimer{grid-column:2;grid-row:3;margin:0;justify-self:end;align-self:center;font-size:12px;padding:3px 10px}
 .cbt-saved{grid-column:1;grid-row:3;margin:0;font-size:11px}
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
 .cbt-cam{bottom:132px;right:8px;width:76px;opacity:.92;pointer-events:none}.cbt-cam video{height:57px}.cbt-cam span{font-size:9.5px;padding:2px 4px}.cbt-cam.big{width:min(100%,300px)}
}
@media(max-width:380px){.cbt-grid{grid-template-columns:repeat(5,1fr)}.cbt-top .title{font-size:12.5px}}

.cbt-sectimer{order:3;margin-left:6px;font-size:14px}
.cbt-saved{order:3;font-size:12px;font-weight:700;color:#cfe3ff;margin-left:8px;white-space:nowrap}
.cbt-saved.s-offline{color:#ffd9a8}
.cbt-sec:disabled{opacity:.45;cursor:not-allowed}
.cbt-tool{position:fixed;right:12px;bottom:72px;z-index:3000;background:#fff;color:#0b1b3a;border:2px solid #1e3a6e;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,.35);padding:10px}
.cbt-tool-h{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.cbt-tool-h button{border:0;background:none;font-size:16px;cursor:pointer}
.cbt-tool textarea{width:100%;height:200px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;font:inherit;resize:vertical}
.cbt-calc-d{background:#0b1b3a;color:#fff;font-size:22px;text-align:right;padding:8px 10px;border-radius:8px;margin-bottom:8px;font-variant-numeric:tabular-nums;overflow:hidden}
.cbt-calc-g{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cbt-calc-g button{padding:10px 0;font-size:16px;font-weight:700;border:1px solid #cbd5e1;border-radius:8px;background:#f1f5f9;cursor:pointer}
.cbt-calc-g .clr{grid-column:span 4;background:#fee2e2}
.cbt-hc{--navy:#000;--navy2:#000;filter:none}
.cbt-hc, .cbt-hc .cbt-main, .cbt-hc .cbt-side{background:#000!important;color:#fff!important}
.cbt-hc .cbt-opt{border:2px solid #fff!important;background:#000!important;color:#fff!important}
.cbt-hc .cbt-opt.on{background:#ffd400!important;color:#000!important}
.cbt-hc .cbt-n{border:2px solid #fff!important}
.cbt-hc .cbt-top{background:#000!important;border-bottom:2px solid #fff}
.cbt-hc a{color:#ffd400}
.cbt-hc .cbt-qhead,.cbt-hc .cbt-legend,.cbt-hc .cbt-act,.cbt-hc .cbt-secbar,.cbt-hc .foot,.cbt-hc .cbt-pal{background:#000!important;color:#fff!important;border-color:#fff!important}
.cbt-hc .cbt-qhead *,.cbt-hc .cbt-legend *,.cbt-hc .cbt-pal h5{color:#fff!important}
.cbt-hc .cbt-sec{background:#000!important;color:#fff!important;border:1px solid #fff}.cbt-hc .cbt-sec.on{background:#ffd400!important;color:#000!important}
.cbt-hc .cbt-n.notVisited{color:#000!important}
.cbt-hc .cbt-qno i{background:#fff!important;color:#000!important}

/* ══ polished exam interface (scoped to .cbt-exam so nothing else changes) ══ */
.cbt-exam{background:#f1f4fa}
.cbt-exam .cbt-top{gap:14px;padding:10px 20px;background:linear-gradient(95deg,#081735,#0f2552 55%,#173a74);border-bottom:0;box-shadow:0 8px 20px -12px rgba(8,23,53,.8);position:relative;z-index:5}
.cbt-exam .cbt-top::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,#e2c57e 22%,#c9a24b 78%,transparent)}
.cbt-exam .cbt-top .title{display:flex;align-items:center;gap:11px;font-size:16px;line-height:1.2;flex:1 1 220px;min-width:0}
.cbt-top .title .brand{width:40px;height:40px;object-fit:contain;flex:none;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))}
.cbt-top .title .tt{display:flex;flex-direction:column;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cbt-top .title small{font-size:9.5px;font-weight:800;letter-spacing:.17em;text-transform:uppercase;color:#e2c57e;margin-bottom:2px;overflow:hidden;text-overflow:ellipsis}
.cbt-exam .cbt-timer{position:relative;display:flex;flex-direction:column;align-items:center;min-width:106px;padding:5px 14px 9px;border-radius:12px;background:rgba(255,255,255,.1);color:#fff;border:1px solid rgba(255,255,255,.24);box-shadow:none;overflow:hidden;animation:none;letter-spacing:0}
.cbt-timer small{font-size:9px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;opacity:.8}
.cbt-timer b{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.15;letter-spacing:.03em}
.cbt-timer i{position:absolute;left:0;bottom:0;height:3px;background:#7bd88f;transition:width 1s linear}
.cbt-exam .cbt-timer.warn{background:rgba(245,158,11,.22);border-color:#f59e0b}.cbt-timer.warn i{background:#f59e0b}
.cbt-exam .cbt-timer.low{background:#b42318;border-color:#ff9c93;animation:cbtblink 1s steps(2) infinite}.cbt-timer.low i{background:#fff}
.cbt-exam .cbt-timer.cbt-sectimer{flex-direction:row;min-width:0;padding:6px 12px;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums}
.cbt-exam .cbt-top select,.cbt-exam .cbt-top button.sm{background:rgba(255,255,255,.12);color:#fff;border:1px solid rgba(255,255,255,.26);border-radius:9px;transition:background .15s}
.cbt-exam .cbt-top button.sm:hover,.cbt-exam .cbt-top select:hover{background:rgba(255,255,255,.24)}
.cbt-exam .cbt-top button.sm[aria-pressed=true]{background:#e2c57e;color:#0b1e3d;border-color:#e2c57e}
.cbt-exam .cbt-top select option{color:#0b1e3d;background:#fff}
.cbt-exam .cbt-secbar{background:#fff;border-bottom:1px solid #dde3ef;padding:0 18px}
.cbt-exam .cbt-sec{padding:12px 16px;color:#51607a;transition:color .15s}
.cbt-exam .cbt-sec:hover:not(:disabled){color:#0b1e3d}
.cbt-exam .cbt-qhead{padding:12px 22px;background:#fff;border-bottom:1px solid #e6ebf5}
.cbt-exam .cbt-qno{color:#0b1e3d}
.cbt-exam .cbt-qno i{border-radius:9px;padding:4px 12px;font-size:15px;background:linear-gradient(160deg,#173a74,#0b1e3d)}
.cbt-qsec{background:#fdf6e3;color:#8a6a1f;border:1px solid #ecd9a4;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:800;margin-left:4px;white-space:nowrap}
.cbt-exam .cbt-marks{display:flex;gap:6px;align-items:center}
.cbt-exam .cbt-marks .p{background:#e7f6ec;border-radius:999px;padding:2px 9px}.cbt-exam .cbt-marks .n{background:#fde8e6;border-radius:999px;padding:2px 9px}
.cbt-exam .cbt-q{padding:22px 28px 26px;background:#fff}
.cbt-exam .cbt-qtext{font-size:1.06em;line-height:1.7;color:#16223d}
.cbt-exam .cbt-fig{border-radius:12px;box-shadow:0 8px 22px -16px rgba(15,37,82,.6)}
.cbt-exam .cbt-opt{position:relative;padding:13px 16px;border-radius:14px;border:1.5px solid #dbe2f0;margin-bottom:11px;transition:background .15s,border-color .15s,box-shadow .15s,transform .15s}
.cbt-exam .cbt-opt:hover{background:#f6f9ff;border-color:#9fb2d8;box-shadow:0 8px 16px -12px rgba(15,37,82,.5)}
.cbt-exam .cbt-opt.on{background:#eaf0fc;border-color:#14264a;box-shadow:0 0 0 1px #14264a inset,0 10px 20px -14px rgba(15,37,82,.7)}
.cbt-exam .cbt-opt.on::after{content:'✓';position:absolute;right:14px;top:50%;transform:translateY(-50%);width:22px;height:22px;border-radius:50%;background:#14264a;color:#fff;font-size:13px;line-height:22px;text-align:center}
.cbt-exam .cbt-opt.on span{padding-right:34px}
.cbt-exam .cbt-act{background:#fff;border-top:1px solid #e6ebf5;box-shadow:0 -12px 24px -20px rgba(15,37,82,.55);padding:12px 22px calc(12px + env(safe-area-inset-bottom));position:relative;z-index:2}
.cbt-exam .cbt-b{border-radius:11px;min-height:44px;font-size:13.5px;transition:transform .12s,box-shadow .12s,filter .12s}
.cbt-exam .cbt-b:not(:disabled):hover{transform:translateY(-1px);filter:brightness(1.05)}
.cbt-exam .cbt-b:not(:disabled):active{transform:none}
.cbt-exam .cbt-b.save{background:linear-gradient(180deg,#36a349,#2e8b3d);box-shadow:0 10px 18px -12px rgba(46,139,61,.95);padding:10px 24px}
.cbt-exam .cbt-b.mark{background:linear-gradient(180deg,#7b4cb6,#6a3fa0);box-shadow:0 10px 18px -12px rgba(106,63,160,.95)}
.cbt-exam .cbt-b.sub{background:linear-gradient(180deg,#2079be,#1b6ca8);box-shadow:0 10px 18px -12px rgba(27,108,168,.95);min-height:46px;font-size:14px}
.cbt-exam .cbt-side{background:#eef2fa;border-left:1px solid #dbe2f0}
.cbt-pprog{padding:14px 14px 2px;font-size:12.5px;color:#475569}.cbt-pprog b{color:#0b1e3d;font-size:16px}
.cbt-pprog .bar{display:block;height:6px;border-radius:6px;background:#d6deee;overflow:hidden;margin-top:7px}
.cbt-pprog .bar i{display:block;height:100%;background:linear-gradient(90deg,#2e8b3d,#7bd88f);border-radius:6px;transition:width .35s}
.cbt-exam .cbt-legend{background:transparent;border-bottom:0;padding:10px 14px 12px}
.cbt-exam .cbt-pal h5{background:linear-gradient(95deg,#0f2552,#173a74);border-radius:10px;padding:8px 12px}
.cbt-exam .cbt-n{height:42px;border-radius:11px;transition:transform .12s,box-shadow .12s}
.cbt-exam .cbt-n:hover{transform:translateY(-1px);box-shadow:0 8px 14px -10px rgba(15,37,82,.7)}
.cbt-exam .cbt-side .foot{background:transparent;border-top:1px solid #d6deee}
.cbt-exam :focus-visible{outline:3px solid #f2b705;outline-offset:2px}
.cbt-hc .cbt-timer{background:#000!important;border:2px solid #fff!important}.cbt-hc .cbt-opt.on::after{background:#fff;color:#000}.cbt-hc .cbt-pprog,.cbt-hc .cbt-pprog b{color:#fff!important}
@media (max-width:860px){
 .cbt-top .title small{display:none}
 .cbt-top .title .brand{width:30px;height:30px}
 .cbt-exam .cbt-top{padding:8px 12px;grid-template-columns:minmax(0,1fr) auto}
 .cbt-exam .cbt-top .title{min-width:0;max-width:100%}
 .cbt-top .title .tt{min-width:0}
 .cbt-exam .cbt-timer{min-width:88px;padding:4px 10px 8px}.cbt-timer b{font-size:17px}
 .cbt-exam .cbt-qhead{padding:10px 14px;flex-wrap:wrap;row-gap:6px}
 .cbt-qsec{display:none}   /* the section name is in the palette and the section tabs; keep the phone header on one line */
 .cbt-exam .cbt-marks .p,.cbt-exam .cbt-marks .n{padding:1px 7px}
 .cbt-exam .cbt-palbtn{flex:none}
 .cbt-modal .tbl{overflow-x:visible}.cbt-modal .tbl table{width:100%;table-layout:fixed}
 .cbt-modal .tbl th,.cbt-modal .tbl td{padding:7px 4px;font-size:11.5px;white-space:normal;word-break:break-word;text-align:center}
 .cbt-modal .tbl th{font-size:9.5px;letter-spacing:0;line-height:1.2;word-break:normal;overflow-wrap:normal}.cbt-modal .tbl th:first-child,.cbt-modal .tbl td:first-child{text-align:left;width:28%}
 .cbt-exam .cbt-q{padding:16px 16px 20px}
 .cbt-exam .cbt-opt{padding:12px 14px}
 .cbt-exam .cbt-act{padding:10px 12px calc(10px + env(safe-area-inset-bottom))}
 .cbt-exam .cbt-b{min-height:46px}
}

/* ── sections on one row, compact phone header, premium passage reader ── */
.cbt-secbar{flex-wrap:nowrap;flex-direction:row}
.cbt-sec .sl{display:none}
.cbt-pass{background:linear-gradient(180deg,#fffdf7,#fbf7ec);border-right:1px solid #eadfc4;font-size:inherit;line-height:inherit;padding:0;display:flex;flex-direction:column}
.cbt-pass-h{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:12px 22px;border-bottom:1px solid #eadfc4;position:sticky;top:0;background:#fffbef;z-index:1}
.cbt-pass-tag{font-weight:800;font-size:11px;letter-spacing:.18em;color:#8c6a22;display:inline-flex;align-items:center;gap:8px}
.cbt-pass-tag::before{content:'';width:4px;height:16px;border-radius:2px;background:linear-gradient(#e2c57e,#b8913f)}
.cbt-pass-tools{display:inline-flex;gap:6px}
.cbt-pass-tools button{border:1px solid #e2d6b4;background:#fff;color:#0b1e3d;border-radius:8px;min-width:34px;height:30px;font-weight:800;cursor:pointer;font-size:12px}
.cbt-prose{font-family:Georgia,'Playfair Display','Times New Roman',serif;font-size:var(--rfs,17px);line-height:1.85;color:#1b2433;padding:18px 24px 26px;white-space:pre-wrap;overflow:auto;flex:1;min-height:0;text-align:left;hyphens:auto;max-width:72ch}
.cbt-prose.mm{line-height:2}
.cbt-pass .cbt-prose::first-letter{font-size:1.9em;font-weight:700;color:#8c6a22;float:left;line-height:1;margin:.04em .1em 0 0}
.cbt-pass .cbt-prose.mm::first-letter{all:unset}
.cbt-reader{position:absolute;inset:0;z-index:3500;background:#fffdf7;display:flex;flex-direction:column;animation:cbtstep .28s cubic-bezier(.22,1,.36,1) backwards}
.cbt-reader-h{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:10px;padding:10px 12px;background:linear-gradient(95deg,#081735,#0f2552 55%,#173a74);color:#fff;position:relative}
.cbt-reader-h::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,#e2c57e 22%,#c9a24b 78%,transparent)}
.cbt-reader-h>button{border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.12);color:#fff;border-radius:9px;height:36px;padding:0 12px;font-weight:800;cursor:pointer}
.cbt-reader-h>span:nth-child(2){display:flex;flex-direction:column;font-weight:800;font-size:15px;line-height:1.2;min-width:0}
.cbt-reader-h small{font-size:11px;font-weight:700;color:#e2c57e;letter-spacing:.04em}
.cbt-reader-h .cbt-pass-tools button{background:rgba(255,255,255,.12);color:#fff;border-color:rgba(255,255,255,.3)}
.cbt-reader-body{flex:1;min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;display:flex;justify-content:center;background:linear-gradient(180deg,#fffdf7,#f8f2e2)}
.cbt-reader-body .cbt-prose{padding:22px 20px 40px;max-width:68ch;overflow:visible;flex:none;width:100%}
.cbt-reader-body .cbt-prose::first-letter{font-size:2.1em;font-weight:700;color:#8c6a22;float:left;line-height:1;margin:.04em .1em 0 0}
.cbt-reader-body .cbt-prose.mm::first-letter{all:unset}
.cbt-reader-f{padding:10px 14px calc(10px + env(safe-area-inset-bottom));background:#fff;border-top:1px solid #eadfc4;box-shadow:0 -6px 18px -12px rgba(0,0,0,.3)}
.cbt-reader-f .cbt-b{width:100%}
.cbt-passbar{display:none}
@media (max-width:860px){
 /* sections: ONE slim row. Inactive tabs show only their label; the open one shows its (shortened) title */
 .cbt-exam .cbt-secbar{padding:0 8px;gap:2px;min-height:0}
 .cbt-exam .cbt-sec{padding:8px 10px;font-size:12px;display:inline-flex;align-items:center;gap:6px;flex:none;border-bottom-width:3px}
 .cbt-exam .cbt-sec .sl{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:7px;background:#eef1f7;color:#0f2a5c;font-weight:800;font-size:11.5px;padding:0 5px}
 .cbt-exam .cbt-sec.on .sl{background:#0f2a5c;color:#fff}
 .cbt-exam .cbt-sec .st{display:none}
 .cbt-exam .cbt-sec.on .st{display:inline;max-width:46vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 .cbt-exam .cbt-sec small{margin-left:0}
 /* header: title+timer, one tools row; the "saved" line only shows when something is wrong */
 .cbt-exam .cbt-top{gap:6px 10px;padding:6px 10px}
 .cbt-exam .cbt-saved.s-saved,.cbt-exam .cbt-saved.s-saving{display:none}
 .cbt-exam .cbt-saved{grid-row:3}
 .cbt-exam .cbt-tools{grid-row:2}
 .cbt-exam .cbt-qhead{padding:7px 12px;flex-wrap:nowrap}
 .cbt-exam .cbt-qno{display:inline-flex;align-items:center;gap:6px;font-size:14px;white-space:nowrap}
 .cbt-exam .cbt-qno small{font-size:11px}
 .cbt-exam .cbt-palbtn{margin-left:auto;padding:6px 12px;font-size:12.5px}
 /* passage: a preview card; tapping opens the full-screen reader */
 .cbt-exam .cbt-pass{border-right:none;border-bottom:1px solid #eadfc4;border-radius:0}
 .cbt-exam .cbt-pass-h{display:none}
 .cbt-exam .cbt-pass .cbt-prose{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;max-height:none;padding:12px 16px 4px;font-size:15px;line-height:1.7;flex:none;min-height:0}
 .cbt-exam .cbt-pass .cbt-prose::first-letter{float:none;font-size:inherit;margin:0;color:inherit}
 .cbt-exam .cbt-pass .cbt-prose.mm{padding-top:14px;line-height:2.1}
 .cbt-exam .cbt-passbar{display:flex;margin:6px 12px 12px;width:auto;border-radius:10px;background:linear-gradient(95deg,#0f2552,#173a74);color:#fff;border:1px solid #c9a24b;padding:11px 14px;font-size:13px;letter-spacing:.02em;box-shadow:0 6px 14px -8px rgba(15,37,82,.7)}
 .cbt-exam .cbt-passbar span:last-child{color:#e2c57e}
}
@media (min-width:861px){.cbt-exam .cbt-pass{flex:1 1 48%;max-width:760px}.cbt-exam .cbt-pass .cbt-prose{padding:20px 28px 32px}}
.cbt-hc .cbt-pass,.cbt-hc .cbt-prose,.cbt-hc .cbt-reader,.cbt-hc .cbt-reader-body,.cbt-hc .cbt-pass-h{background:#000!important;color:#fff!important}

/* comfortable tap targets + a landscape-phone layout (the short screen must still leave room for the question) */
@media (max-width:860px){.cbt-exam .cbt-palbtn{min-height:38px;padding:7px 14px}}
@media (max-height:500px) and (orientation:landscape) and (max-width:1000px){
 .cbt-exam .cbt-top{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;padding:4px 10px}
 .cbt-exam .cbt-top .title{flex:1 1 auto;min-width:0;font-size:13px}
 .cbt-exam .cbt-top .title .brand{width:26px;height:26px}
 .cbt-exam .cbt-tools{order:2;grid-row:auto;flex:0 1 auto;max-width:46vw;overflow-x:auto}
 .cbt-exam .cbt-top .cand{display:none}
 .cbt-exam .cbt-timer{order:3;padding:2px 10px 6px;min-width:0}.cbt-exam .cbt-timer small{display:none}.cbt-exam .cbt-timer b{font-size:15px}
 .cbt-exam .cbt-sectimer,.cbt-exam .cbt-saved{display:none}
 .cbt-exam .cbt-sec{padding:4px 8px}.cbt-exam .cbt-sec .sl{height:20px}
 .cbt-exam .cbt-qhead{padding:3px 12px}
 .cbt-exam .cbt-palbtn{min-height:32px;padding:3px 12px}
 .cbt-exam .cbt-q{padding:8px 14px 12px}
 .cbt-exam .cbt-opt{min-height:40px;padding:8px 12px}
 .cbt-exam .cbt-pass .cbt-prose{-webkit-line-clamp:2;padding:6px 14px 0;font-size:14px}
 .cbt-exam .cbt-passbar{margin:4px 12px 6px;padding:7px 12px}
 .cbt-exam .cbt-act{display:flex;gap:6px;padding:4px 10px}
 .cbt-exam .cbt-act .sp{display:block;flex:1}
 .cbt-exam .cbt-b,.cbt-exam .cbt-b.b-save,.cbt-exam .cbt-b.b-prev,.cbt-exam .cbt-b.b-mark,.cbt-exam .cbt-b.b-clear{order:0;min-height:36px;padding:4px 12px;font-size:12.5px;white-space:nowrap}
 .cbt-reader-h{padding:5px 10px}.cbt-reader-body .cbt-prose{padding:12px 20px 24px}.cbt-reader-f{padding:6px 12px}
}
.cbt-cd{display:inline-flex;gap:8px;flex-wrap:wrap;justify-content:center}
.cbt-cd-c{display:inline-flex;flex-direction:column;align-items:center;min-width:58px;padding:8px 10px;border-radius:12px;background:#0f2a5c;color:#fff;border:1px solid #c9a24b}
.cbt-cd-c b{font:800 22px/1 'Inter',system-ui,sans-serif;font-variant-numeric:tabular-nums}
.cbt-cd-c small{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#e2c57e;margin-top:3px}
@media (prefers-reduced-motion:reduce){.cbt-exam *,.cbt-exam *::after{transition:none!important}.cbt-exam .cbt-timer.low{animation:none}}
`

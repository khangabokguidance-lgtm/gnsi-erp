// Styles for the CBT Exam (admin screens and the exam screen).
export const CBT_CSS = `
.cbt{font-family:'Plus Jakarta Sans',system-ui,Arial,sans-serif;color:#1f2a44}
.cbt *{box-sizing:border-box}
.cbt .card{background:#fff;border:1px solid #e6dcc3;border-radius:14px;padding:16px;margin-bottom:14px;box-shadow:0 10px 28px -24px rgba(19,42,79,.4)}
.cbt h3{font-family:'Fraunces',Georgia,serif;color:#0f1f3d;margin:0 0 6px;font-size:17px}
.cbt .lbl{display:block;font-size:12px;font-weight:700;color:#374151;margin-bottom:4px}
.cbt .in{width:100%;padding:8px 10px;border:1px solid #d1d5db;border-radius:8px;font:inherit;font-size:13px;background:#fff}
.cbt .btn{border:none;border-radius:8px;font:inherit;font-weight:800;font-size:12.5px;padding:8px 14px;cursor:pointer;background:#f1f5f9;color:#334155}
.cbt .btn:disabled{opacity:.5;cursor:not-allowed}
.cbt .btn.gold{background:linear-gradient(180deg,#D9B566,#C9A24B);color:#0B1E3D}
.cbt .btn.navy{background:#1e3a6e;color:#fff}
.cbt .btn.red{background:#fee2e2;color:#b42318}
.cbt .grid{display:grid;gap:10px}
.cbt .muted{color:#64748b;font-size:12px}
.cbt .tag{display:inline-block;font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 9px}
.cbt table{width:100%;border-collapse:collapse;font-size:13px}.cbt th{text-align:left;background:#f3f6fd;color:#1d3a78;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:7px 9px}.cbt td{padding:7px 9px;border-bottom:1px solid #e8edf6;vertical-align:top}
.cbt .num{text-align:right}

/* exam screen */
.cbt-exam{position:fixed;inset:0;z-index:3000;background:#eef1f6;display:flex;flex-direction:column;font-family:Arial,'Segoe UI',sans-serif;color:#1f2933;user-select:none;-webkit-user-select:none}
.cbt-exam .mm{font-family:'Noto Sans Meetei Mayek','Meetei Mayek',sans-serif;line-height:1.7}
.cbt-top{background:#1b2a4a;color:#fff;display:flex;align-items:center;gap:14px;padding:8px 16px;flex-wrap:wrap}
.cbt-top .title{font-weight:700;font-size:15px;flex:1 1 220px}
.cbt-top .cand{display:flex;align-items:center;gap:10px;font-size:12.5px}
.cbt-top .avatar{width:36px;height:36px;border-radius:6px;background:#e2c57e;color:#1b2a4a;font-weight:800;display:flex;align-items:center;justify-content:center}
.cbt-timer{background:#fff;color:#1b2a4a;border-radius:6px;padding:5px 12px;font-weight:800;font-size:15px;font-variant-numeric:tabular-nums}
.cbt-timer.low{background:#b42318;color:#fff;animation:cbtblink 1s steps(2) infinite}
@keyframes cbtblink{50%{opacity:.65}}
.cbt-top select,.cbt-top button.sm{background:#fff;color:#1b2a4a;border:none;border-radius:5px;padding:5px 8px;font-weight:700;font-size:12px;cursor:pointer}
.cbt-secbar{background:#fff;border-bottom:2px solid #d5dbe8;display:flex;gap:6px;padding:6px 12px;overflow-x:auto;align-items:center}
.cbt-sec{border:1px solid #c5cde0;background:#f4f6fb;color:#1b2a4a;border-radius:4px;padding:6px 12px;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap}
.cbt-sec.on{background:#1b2a4a;color:#fff;border-color:#1b2a4a}
.cbt-sec small{font-weight:600;opacity:.75;margin-left:6px}
.cbt-body{flex:1;min-height:0;display:flex}
.cbt-main{flex:1;min-width:0;display:flex;flex-direction:column;background:#fff;border-right:1px solid #d5dbe8}
.cbt-qhead{display:flex;justify-content:space-between;align-items:center;padding:8px 16px;border-bottom:1px solid #e1e6f0;font-weight:700;background:#f7f9fd;flex-wrap:wrap;gap:6px}
.cbt-marks{font-size:12px;font-weight:700}.cbt-marks .p{color:#146c3a}.cbt-marks .n{color:#b42318}
.cbt-qarea{flex:1;min-height:0;display:flex;overflow:hidden}
.cbt-pass{flex:1 1 45%;overflow:auto;padding:14px 18px;border-right:1px solid #e1e6f0;background:#fbfcff;font-size:var(--fs,15px);line-height:1.65}
.cbt-pass h5{margin:0 0 8px;color:#1b2a4a;font-size:12px;letter-spacing:.1em}
.cbt-q{flex:1 1 55%;overflow:auto;padding:14px 18px;font-size:var(--fs,15px)}
.cbt-qtext{white-space:pre-wrap;line-height:1.6;margin-bottom:14px;font-weight:600}
.cbt-fig{max-width:100%;max-height:52vh;display:block;margin:0 auto 14px;border:1px solid #e1e6f0;border-radius:4px;background:#fff}
.cbt-opt{display:flex;align-items:flex-start;gap:10px;padding:9px 12px;border:1px solid #d5dbe8;border-radius:6px;margin-bottom:8px;cursor:pointer;background:#fff}
.cbt-opt:hover{background:#f3f6fd}.cbt-opt.on{border-color:#1b2a4a;background:#e8eefb}
.cbt-opt input{margin-top:4px;accent-color:#1b2a4a;width:17px;height:17px;flex:none}
.cbt-opt b{min-width:22px;color:#1b2a4a}
.cbt-act{display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid #d5dbe8;background:#f7f9fd;align-items:center}
.cbt-act .sp{flex:1}
.cbt-b{border:1px solid #b6c0d6;background:#fff;color:#1b2a4a;border-radius:4px;padding:9px 14px;font-weight:700;font-size:13px;cursor:pointer}
.cbt-b.save{background:#2e7d32;color:#fff;border-color:#2e7d32}
.cbt-b.mark{background:#6a3fa0;color:#fff;border-color:#6a3fa0}
.cbt-b.sub{background:#1b6ca8;color:#fff;border-color:#1b6ca8;width:100%;margin-top:10px}
.cbt-side{width:310px;flex:none;display:flex;flex-direction:column;background:#eaf1fb;min-height:0}
.cbt-legend{display:grid;grid-template-columns:1fr 1fr;gap:6px 8px;padding:10px 12px;font-size:11.5px;border-bottom:1px solid #cdd8ea}
.cbt-legend div{display:flex;align-items:center;gap:6px}
.cbt-pal{flex:1;min-height:0;overflow:auto;padding:10px 12px}
.cbt-pal h5{margin:0 0 8px;background:#1b2a4a;color:#fff;padding:6px 10px;font-size:12px;border-radius:3px}
.cbt-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
.cbt-n{position:relative;height:36px;border:none;font-weight:800;font-size:13px;cursor:pointer;color:#fff;clip-path:polygon(0 12%,12% 0,88% 0,100% 12%,100% 88%,88% 100%,12% 100%,0 88%)}
.cbt-n.notVisited,.cbt-s.notVisited{background:#e4e7ee;color:#333}
.cbt-n.notAnswered,.cbt-s.notAnswered{background:#d9532c}
.cbt-n.answered,.cbt-s.answered{background:#3a9d3a}
.cbt-n.marked,.cbt-s.marked{background:#6a3fa0;border-radius:50%;clip-path:none}
.cbt-n.answeredMarked,.cbt-s.answeredMarked{background:#6a3fa0;border-radius:50%;clip-path:none}
.cbt-n.answeredMarked::after,.cbt-s.answeredMarked::after{content:'✔';position:absolute;right:-2px;bottom:-2px;background:#3a9d3a;border-radius:50%;width:15px;height:15px;font-size:10px;line-height:15px;text-align:center}
.cbt-n.cur{outline:3px solid #f2b705;outline-offset:1px}
.cbt-s{position:relative;display:inline-flex;width:26px;height:26px;color:#fff;font-weight:800;font-size:11px;align-items:center;justify-content:center;flex:none;clip-path:polygon(0 12%,12% 0,88% 0,100% 12%,100% 88%,88% 100%,12% 100%,0 88%)}
.cbt-s.marked,.cbt-s.answeredMarked{border-radius:50%;clip-path:none}
.cbt-side .foot{padding:10px 12px;border-top:1px solid #cdd8ea}
.cbt-modal{position:fixed;inset:0;z-index:3100;background:rgba(10,20,40,.6);display:flex;align-items:center;justify-content:center;padding:16px}
.cbt-modal .box{background:#fff;border-radius:8px;max-width:760px;width:100%;max-height:92vh;overflow:auto;padding:20px}
.cbt-modal table{width:100%;border-collapse:collapse;font-size:13px}.cbt-modal th{background:#1b2a4a;color:#fff;padding:7px 8px;text-align:center;font-size:12px}.cbt-modal td{padding:7px 8px;border:1px solid #d5dbe8;text-align:center}.cbt-modal td:first-child,.cbt-modal th:first-child{text-align:left}
.cbt-center{max-width:760px;margin:0 auto;padding:24px 16px;overflow:auto;flex:1;width:100%}
.cbt-center .panel{background:#fff;border:1px solid #d5dbe8;border-radius:8px;padding:22px}
.cbt-toast{position:fixed;left:50%;top:70px;transform:translateX(-50%);background:#b42318;color:#fff;padding:9px 18px;border-radius:6px;font-weight:700;z-index:3200;font-size:13px}
@media(max-width:860px){
 .cbt-body{flex-direction:column;overflow:auto}
 .cbt-main{border-right:none}
 .cbt-qarea{flex-direction:column;overflow:visible}
 .cbt-pass{border-right:none;border-bottom:1px solid #e1e6f0;max-height:34vh}
 .cbt-side{width:100%}
 .cbt-grid{grid-template-columns:repeat(8,1fr)}
}
`

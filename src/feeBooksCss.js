// Shared styles for the Day Book and Monthly Fee Ledger tabs.
export const BOOKS_CSS = `
.fbk{--ink:#1d3a78;--gold:#b8923a;--sub:#6b7690;--line:#e7ebf3;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#1f2a44}
.fbk-card{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 10px 30px -22px rgba(20,40,90,.35);padding:16px;margin-bottom:14px}
.fbk-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.fbk-chip{border:1px solid #d8dfec;background:#fff;color:var(--ink);border-radius:999px;padding:7px 14px;font-weight:700;font-size:12.5px;cursor:pointer;white-space:nowrap}
.fbk-chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.fbk-chip.gold{background:#fbf3e0;border-color:#e9d9b0;color:#7a5a14}
.fbk-chip:disabled{opacity:.5;cursor:default}
.fbk-in{border:1px solid #d8dfec;border-radius:10px;padding:7px 10px;font:inherit;font-size:13px;color:#1f2a44;background:#fff;min-width:0}
.fbk-lbl{display:flex;flex-direction:column;gap:3px;font-size:10.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--sub)}
.fbk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
.fbk-kpi{background:linear-gradient(160deg,#fff,#f7f9fd);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.fbk-kpi b{display:block;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub)}
.fbk-kpi span{display:block;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:700;color:var(--ink);margin-top:3px}
.fbk-kpi small{color:var(--sub);font-size:11.5px}
.fbk-split{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px;margin-bottom:14px}
.fbk-split h4{margin:0 0 8px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--sub)}
.fbk-bars p{margin:0 0 7px;font-size:12.5px}
.fbk-bars p>span{display:flex;justify-content:space-between;gap:8px}
.fbk-bars i{display:block;height:6px;border-radius:9px;background:#eef1f6;margin-top:3px;overflow:hidden}
.fbk-bars i>em{display:block;height:100%;background:linear-gradient(90deg,var(--ink),#3d63b8);border-radius:9px}
.fbk-scroll{overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:12px}
.fbk table{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px}
.fbk th{position:sticky;top:0;z-index:2;background:#f3f6fd;color:var(--ink);font-size:10px;letter-spacing:.1em;text-transform:uppercase;text-align:left;padding:8px 9px;border-bottom:1.5px solid var(--ink);white-space:nowrap}
.fbk td{padding:7px 9px;border-bottom:1px solid #eef1f6;vertical-align:top}
.fbk .num{text-align:right;font-family:'JetBrains Mono',ui-monospace,monospace;font-variant-numeric:tabular-nums;white-space:nowrap}
.fbk .muted{color:var(--sub)}
.fbk-day td{background:#fbf8ef;font-weight:800;color:#5c4a1c;border-top:1px solid #efe4c6}
.fbk-rcpt{background:none;border:none;padding:0;font:inherit;color:#1a56db;font-weight:700;text-decoration:underline dotted;text-underline-offset:3px;cursor:pointer}
.fbk tfoot td{position:sticky;bottom:0;background:#eef3fc;font-weight:800;border-top:1.5px solid var(--ink)}
.fbk-empty{text-align:center;color:var(--sub);padding:28px 10px}
/* Monthly grid */
.fbk-grid{max-height:68vh}
.fbk-grid th,.fbk-grid td{text-align:center}
.fbk-grid .stk{position:sticky;left:0;z-index:1;background:#fff;text-align:left;min-width:170px;max-width:220px;box-shadow:1px 0 0 var(--line)}
.fbk-grid th.stk{z-index:3;background:#f3f6fd}
.fbk-grid tfoot .stk{background:#eef3fc;z-index:3}
.fbk-cell{display:inline-block;min-width:62px;padding:4px 6px;border-radius:8px;font-size:11.5px;font-weight:800;font-family:'JetBrains Mono',ui-monospace,monospace}
.fbk-cell.paid{background:#e7f6ec;color:#146c3a}
.fbk-cell.advance{background:#e6f1fb;color:#0b5c8a}
.fbk-cell.short{background:#fff4dc;color:#9a5b00}
.fbk-cell.due{background:#fde8e6;color:#b42318}
.fbk-cell.upcoming{color:#a0a8b8;font-weight:600}
.fbk-cell.before{color:#c3c8d2;font-weight:600}
.fbk-legend{display:flex;flex-wrap:wrap;gap:8px;font-size:11.5px;color:var(--sub);margin:10px 0 0}
@media(max-width:640px){.fbk-card{padding:12px;border-radius:14px}.fbk-kpi span{font-size:18px}.fbk-grid .stk{min-width:130px}.fbk th,.fbk td{padding:6px 7px}}
`

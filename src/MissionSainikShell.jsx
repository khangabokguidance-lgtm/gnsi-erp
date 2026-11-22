// MissionSainikShell.jsx — formal portal shell for the Mission Sainik module (government-portal design language):
// utility bar (accessibility controls), official-style header with emblem, breadcrumb bar, grouped side navigation,
// page heading, footer, plus a phone layout with bottom navigation, an "All sections" sheet, toast, FAB and confetti.
import { useState, useEffect, useRef, useMemo } from 'react'
import { useNoPullToRefresh } from './lib/useNoPullToRefresh'
import { NAV_GROUPS } from './lib/missionSainikNav'
import { Icon, hasIcon, Emblem } from './MissionSainikIcons'

const BOTTOM = [['overview', 'Home'], ['mine', 'Tasks'], ['prebuilder', 'Build'], ['insights', 'Insights']]
const ACTION_ICON = { 'Print notice': 'print', Refresh: 'refresh' }

// What each section is for — shown in search results, page headings and used as search keywords.
const HINTS = {
  overview: 'Dashboard, countdown, what needs attention', schedule: 'Test dates and deadlines calendar', mock: 'Mock series list and results', allotment: 'Who sets which paper',
  syllabus: 'Chapter plan for each test', panel: 'Teachers, setters, verifiers', students: 'All Sainik and Combined course students, photos, print', mine: 'My assigned tasks, submit and verify', practice: 'Practice sets and questions',
  material: 'Notes, PDFs, links for students', prebuilder: 'Build Pre Mock test papers, upload questions', megabuilder: 'Build Mega Mock papers', dailybuilder: 'Build Daily class tests',
  practicebuilder: 'Build practice sets (25 per subject)', marks: 'Enter and import daily class test marks', mockmarks: 'Marks of every student in a Pre or Mega Mock test, with Absent', admit: 'Print admit cards for a mock test', certs: 'Rank students, result list, merit certificates', premock: 'Analyse Pre Mock results', megamock: 'Analyse Mega Mock results',
  activity: 'Teacher upload and task activity', insights: 'Weak chapters, trends, tips', guide: 'Step-by-step help for every screen', admin: 'Locks, approvals, backup, audit log',
}
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } },
}

// A section's icon: the line icon when one exists, otherwise whatever glyph the nav map supplied.
const Ico = ({ id, fallback, size = 20 }) => (hasIcon(id) ? <Icon name={id} size={size} /> : <span style={{ fontSize: size - 2, lineHeight: 1 }}>{fallback}</span>)

const CSS = `
.msx{--navy:#132a4f;--navy2:#1e3a6e;--blue:#1d4f91;--gold:#b8923a;--goldlt:#e9d9b0;--bg:#eef1f6;--card:#fff;--ink:#0f1b2e;--sub:#4d5b73;--ok:#0f7a4c;--bad:#b42318;--line:#d5dbe6;--tint:#e8eef8;
  font-family:'Noto Sans','Inter','Plus Jakarta Sans',system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--ink);min-height:100vh;position:relative;-webkit-tap-highlight-color:transparent;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased}
.msx *{box-sizing:border-box}
.msx button{font-family:inherit}
.msx ::selection{background:rgba(29,79,145,.22)}
.msx-tap{cursor:pointer;border:0;background:none;position:relative;transition:background .15s,color .15s,border-color .15s,box-shadow .15s}
.msx button:focus-visible,.msx input:focus-visible,.msx a:focus-visible{outline:3px solid #f2c94c;outline-offset:2px}
.msx-skip{position:absolute;left:8px;top:-60px;z-index:100;background:#fff;color:var(--navy);font-weight:700;padding:10px 16px;border-radius:6px;border:2px solid var(--navy);text-decoration:none}.msx-skip:focus{top:8px}

/* ── Utility bar: accessibility controls, as on official portals ── */
.msx-util{display:flex;align-items:center;gap:14px;min-height:36px;padding:4px 18px;background:#0b1c36;color:#cdd8ec;font-size:12.5px}
.msx-util .org{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.02em}.msx-util .org b{color:#fff;font-weight:600}
.msx-util .grp{display:flex;align-items:center;gap:4px}.msx-util .sep{width:1px;height:16px;background:rgba(255,255,255,.22)}
.msx-util button{background:transparent;box-shadow:none;min-width:30px;height:28px;padding:0 8px;border-radius:4px;color:#e6edf9;font-size:12.5px;font-weight:700;border:1px solid transparent;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.msx-util button:hover{background:rgba(255,255,255,.12)}.msx-util button:not(.sw)[aria-pressed=true]{background:#fff;color:var(--navy)}
.msx-util button.sw{width:20px;min-width:20px;height:20px;padding:0;border-radius:50%;border:2px solid #8fa3c4}.msx-util .sw[aria-pressed=true]{border-color:#f2c94c;box-shadow:0 0 0 2px rgba(242,201,76,.35)}
.msx-util a.lnk{color:#e6edf9;text-decoration:none;font-weight:600}.msx-util a.lnk:hover{text-decoration:underline}

/* ── Header: emblem + programme name ── */
.msx-top{position:relative;display:flex;align-items:center;gap:14px;min-height:72px;padding:8px 20px;background:#fff;color:var(--navy);border-bottom:3px solid var(--gold);box-shadow:0 2px 10px rgba(11,28,54,.08)}
.msx-brand{display:flex;align-items:center;gap:13px;min-width:0;flex:1;text-align:left}
.msx-brand .t{min-width:0}.msx-brand h1{margin:0;font-size:22px;font-weight:800;letter-spacing:.01em;line-height:1.15;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx-brand small{display:block;margin-top:3px;font-size:12px;font-weight:600;color:var(--sub);letter-spacing:.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.msx-acts{display:flex;align-items:center;gap:8px}
.msx-act{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 14px;border:1px solid #b9c4d8;border-radius:6px;background:#fff;color:var(--navy);font-size:13.5px;font-weight:600}
.msx-act:hover{background:var(--tint);border-color:var(--blue)}
.msx-act.ic{width:40px;padding:0;justify-content:center}
.msx-find-mobile{display:none}

/* ── Breadcrumb ── */
.msx-crumbs{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;overflow:hidden;padding:0 24px;min-height:40px;background:#e1e8f3;border-bottom:1px solid var(--line);font-size:13px;color:var(--sub);white-space:nowrap}
.msx-crumbs button{color:var(--blue);font-weight:600;padding:6px 2px;text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}.msx-crumbs button:hover{color:var(--navy);text-decoration-thickness:2px}
.msx-crumbs .cur{color:var(--ink);font-weight:700;overflow:hidden;text-overflow:ellipsis}.msx-crumbs .sp{opacity:.55;flex:none}

/* ── Layout ── */
.msx-body{display:flex;max-width:1440px;margin:0 auto;align-items:flex-start}
.msx-slot{display:none;flex:none;position:sticky;top:var(--msx-top,121px);align-self:flex-start;height:calc(100vh - var(--msx-top,121px));z-index:20}
.msx-rail{display:block;width:268px;height:100%;padding:14px 12px 40px;overflow:auto;background:#fff;border-right:1px solid var(--line);transition:width .2s ease}
.msx-rail h4{margin:16px 8px 6px;padding-bottom:6px;font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--navy);border-bottom:2px solid var(--tint)}
.msx-ri{display:flex;align-items:center;gap:12px;width:100%;min-height:42px;padding:9px 12px;border-radius:6px;font-size:14px;font-weight:600;color:#26354f;text-align:left}
.msx-ri svg{color:#5a6b87}
.msx-ri:hover{background:#f0f4fa;color:var(--navy)}
.msx-ri.on{background:var(--tint);color:var(--navy);font-weight:700;box-shadow:inset 4px 0 0 var(--navy)}.msx-ri.on svg{color:var(--navy)}
.msx-rail-tg{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:34px;margin:0 0 8px;border:1px solid var(--line);border-radius:6px;color:var(--sub);font-size:12.5px;font-weight:700}.msx-rail-tg:hover{background:#f0f4fa;color:var(--navy)}
.msx-rail.slim{width:68px;padding-inline:8px}.msx-rail.slim .msx-find,.msx-rail.slim .msx-lbl,.msx-rail.slim .msx-pin,.msx-rail.slim .tgl{display:none}
.msx-rail.slim h4{height:1px;margin:10px 10px;padding:0;font-size:0;border:0;background:var(--line)}
.msx-rail.slim .msx-ri{position:relative;justify-content:center;padding:10px 0}
.msx-rail.slim .msx-ri .msx-badge{position:absolute!important;top:2px;right:6px;margin:0!important}
.msx-main{flex:1;min-width:0;padding:22px 24px 48px;font-size:15px;line-height:1.55;animation:msx-in .25s ease backwards}
.msx-main.has-fab{padding-bottom:150px}
.msx.wide .msx-body{max-width:none}
.msx:fullscreen{overflow:auto;height:100%;background:var(--bg)}

/* ── Page heading ── */
.msx-ph{margin:0 0 20px;padding-bottom:14px;border-bottom:1px solid var(--line);position:relative}
.msx-ph::after{content:'';position:absolute;left:0;bottom:-1px;width:72px;height:3px;background:var(--gold)}
.msx-ph .kick{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}
.msx-ph h2{margin:2px 0 4px;font-size:27px;line-height:1.2;font-weight:800;color:var(--navy);letter-spacing:-.005em}
.msx-ph p{margin:0;font-size:14.5px;color:var(--sub);max-width:70ch}

/* ── Footer ── */
.msx-foot{margin-top:8px;background:#0b1c36;color:#b9c6df;font-size:12.5px}
.msx-foot .in{max-width:1440px;margin:0 auto;padding:18px 24px;display:flex;justify-content:space-between;gap:12px 28px;flex-wrap:wrap;align-items:center}
.msx-foot b{color:#fff;font-weight:700}.msx-foot .gold{height:3px;background:linear-gradient(90deg,var(--gold),#e6c35e 50%,var(--gold))}

/* ── Content surfaces: flat, bordered, small radius ── */
.msx-main .px-card{margin-bottom:18px;border-radius:8px;border:1px solid var(--line);background:#fff;box-shadow:0 1px 2px rgba(16,24,40,.06);overflow:hidden}
.msx-main .px-card-h{padding:14px 20px;background:#f6f8fc;border-bottom:1px solid var(--line)}
.msx-main .px-card-h .bar{width:4px;border-radius:0;background:var(--navy)}
.msx-main .px-card-t{font-family:inherit;font-size:16.5px;font-weight:700;color:var(--navy);letter-spacing:0}
.msx-main .px-card-s{font-size:13px;line-height:1.45;color:var(--sub)}
.msx-main .px-input,.msx-main select,.msx-main textarea{font-size:15px;padding:10px 13px;border-radius:6px;border:1.5px solid #b4bfd2;background:#fff;color:var(--ink);transition:border-color .15s,box-shadow .15s}
.msx-main .px-input:hover,.msx-main select:hover,.msx-main textarea:hover{border-color:#8091ad}
.msx-main .px-input:focus,.msx-main select:focus,.msx-main textarea:focus{outline:none;border-color:var(--blue)!important;box-shadow:0 0 0 3px rgba(29,79,145,.22)!important}
.msx-main ::placeholder{color:#76839a;opacity:1}
.msx-main input[type=checkbox],.msx-main input[type=radio]{width:19px;height:19px;accent-color:var(--navy);cursor:pointer}
.msx-main .px-btn,.msx-main .px-hbtn{min-height:42px;font-size:14px;border-radius:6px;transition:background .15s,box-shadow .15s,filter .15s}
.msx-main .px-btn{background:var(--navy);box-shadow:none;border:1px solid var(--navy)}
.msx-main .px-btn:hover:not(:disabled){background:var(--blue);filter:none;box-shadow:0 2px 6px rgba(19,42,79,.3)}
.msx-main .px-btn.ghost{background:#fff;color:var(--navy);border:1px solid #9fb0cb}.msx-main .px-btn.ghost:hover:not(:disabled){background:var(--tint)}
.msx-main .px-btn.gold{background:var(--gold);border-color:#9c7a2b;color:#fff}.msx-main .px-btn.gold:hover:not(:disabled){background:#a07f2f}
.msx-main .px-btn:disabled{opacity:.5;cursor:not-allowed}
.msx-main .px-hbtn{background:#fff;color:var(--navy);border:1px solid #9fb0cb;height:38px;box-shadow:none}
.msx-main .px-hbtn:hover{background:var(--tint);transform:none}
.msx-main .px-tabs{gap:2px;padding:0;background:transparent;border:0;border-bottom:2px solid var(--line);border-radius:0;box-shadow:none}
.msx-main .px-tab{font-size:14px;padding:11px 16px;border-radius:6px 6px 0 0;color:var(--sub);margin-bottom:-2px;border-bottom:3px solid transparent}
.msx-main .px-tab:hover{background:#f0f4fa;color:var(--navy)}
.msx-main .px-tab.on{background:#fff;color:var(--navy);font-weight:700;box-shadow:none;border-bottom-color:var(--navy)}.msx-main .px-tab.on svg{color:var(--navy)}
.msx-main button:disabled{cursor:not-allowed}
.msx-main *{scrollbar-width:thin;scrollbar-color:#b7c2d6 transparent}
.msx-main details>summary{cursor:pointer;padding:6px 0}
.msx-main select,.msx-main input[type=file]{background:#fff;color:var(--ink)}.msx-main input[type=file]{padding:8px!important}

/* Data tables: tinted header, strong rule, zebra rows */
.msx-main .px-table{border-collapse:separate;border-spacing:0}
.msx-main .px-table th{background:#e4ebf6;color:#10305f;border-bottom:2px solid var(--blue);padding:12px 16px;font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
.msx-main .px-table td{padding:12px 16px;border-bottom:1px solid #e3e8f0;font-size:14.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.msx-main .px-table tbody tr:nth-child(even) td{background:#f8fafd}
.msx-main .px-table tbody tr:hover td{background:#eaf1fb}
.msx-main .px-table tbody tr:last-child td{border-bottom:0}
.msx-main .px-table td:first-child{font-weight:700;color:var(--navy)}
.msx-main .px-table td:first-child,.msx-main .px-table th:first-child{white-space:nowrap}
.msx-main .px-table td.msx-click{cursor:pointer}
.msx-main .px-table td.msx-click:hover{background:#dce8f8!important;box-shadow:inset 0 0 0 2px var(--blue);border-radius:4px}
.msx-main .px-table.msx-compact th,.msx-main .px-table.msx-compact td{padding:11px 9px;font-size:13.5px}
.msx-main .px-table.msx-sched{width:100%}.msx-main .px-table.msx-sched th{padding:11px 7px;letter-spacing:.03em;font-size:10.5px;white-space:normal;line-height:1.25}.msx-main .px-table.msx-sched td{padding:10px 7px;font-size:13px;white-space:normal}.msx-main .px-table.msx-sched td.nw{white-space:nowrap}.msx-sched .sc-sec{display:flex;align-items:center;gap:7px;flex-wrap:wrap}.msx-sched .sc-sec small{flex-basis:100%;color:var(--sub);font-size:11px}
.msx-main .px-table.msx-allot td{padding:8px 6px;vertical-align:middle}
.msx-allot .msx-acell{display:flex;flex-direction:column;gap:6px;background:#fff;border:1px solid #d9e0ec;border-radius:6px;padding:7px 9px;transition:border-color .15s,box-shadow .15s}
.msx-main .msx-allot td.msx-click:hover{background:transparent!important;box-shadow:none}
.msx-allot td.msx-click:hover .msx-acell{border-color:var(--blue);box-shadow:0 3px 10px rgba(29,79,145,.22)}
.msx-allot .msx-adate{display:inline-block;margin-top:3px;padding:1px 8px;border-radius:4px;background:var(--tint);color:#10305f;font-size:11px;font-weight:700}
.msx-main .msx-allot tbody tr:nth-child(even) td,.msx-main .msx-allot tbody tr:hover td{background:transparent}
.msx-main .px-table input.px-input{height:36px;padding:0 11px;border-radius:6px;font-size:13px;background:#fff;border:1px solid #b4bfd2}
.msx-main .px-table input.px-input:focus{outline:0}
.msx-main .px-table input.px-input::placeholder{color:#9aa5b8}

/* ── Search ── */
.msx-find{position:relative;margin:0 0 8px}.msx-find input{width:100%;height:42px;border-radius:6px;border:1.5px solid #b4bfd2;background:#fff;padding:0 42px 0 38px;font:600 14px inherit;font-family:inherit;color:var(--ink);outline:none;transition:border-color .15s,box-shadow .15s}
.msx-find input:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(29,79,145,.2)}.msx-find .ic{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#5a6b87;display:flex}
.msx-find kbd{position:absolute;right:10px;top:50%;transform:translateY(-50%);font:700 11px inherit;font-family:inherit;color:var(--sub);border:1px solid #b4bfd2;border-radius:4px;padding:1px 6px;background:#f4f6fa}
.msx-find .x{position:absolute;right:6px;top:50%;transform:translateY(-50%);width:30px;height:30px;border-radius:4px;font-size:18px;color:var(--sub)}
.msx-res{display:flex;align-items:center;gap:12px;width:100%;padding:9px 10px;border-radius:6px;text-align:left;animation:msx-fade .15s both}.msx-res:hover,.msx-res.hi{background:var(--tint)}
.msx-res b{display:block;font-size:14px;color:var(--ink)}.msx-res small{display:block;font-size:12px;color:var(--sub);margin-top:1px}.msx-res .ic{width:38px;height:38px;border-radius:6px;background:var(--tint);color:var(--navy);display:flex;align-items:center;justify-content:center;flex:none}
.msx-pin{width:28px;height:28px;border-radius:4px;font-size:15px;color:#a9b3c6;flex:none;margin-left:auto;display:inline-flex;align-items:center;justify-content:center}.msx-pin.on{color:var(--gold)}.msx-pin:hover{background:rgba(184,146,58,.16)}
.msx-ri .msx-pin{opacity:0;transition:opacity .15s}.msx-ri:hover .msx-pin,.msx-ri .msx-pin.on,.msx-ri:focus-within .msx-pin{opacity:1}
.msx-tile{position:relative}.msx-tile .msx-pin{position:absolute;top:2px;right:6px;width:24px;height:24px;font-size:13px;margin:0;opacity:.85}
.msx-sheet .msx-sticky{position:sticky;top:-10px;z-index:2;background:#fff;padding:2px 0 8px}

/* ── Phone chrome ── */
.msx-badge{position:absolute;top:-3px;right:6px;min-width:17px;height:17px;border-radius:9px;background:var(--bad);color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 4px}
.msx-bottom{position:fixed;left:0;right:0;bottom:0;z-index:40;display:flex;background:#fff;border-top:2px solid var(--navy);padding:2px 2px calc(4px + env(safe-area-inset-bottom));box-shadow:0 -4px 16px rgba(14,32,63,.12)}
.msx-bi{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:11px;font-weight:600;color:var(--sub);padding:5px 0 2px;border-top:3px solid transparent;margin-top:-2px}
.msx-pill{position:relative;display:flex;align-items:center;justify-content:center;height:26px}
.msx-bi.on{color:var(--navy);font-weight:800;border-top-color:var(--gold)}
.msx-fab{position:fixed;right:18px;bottom:calc(92px + env(safe-area-inset-bottom));z-index:35;display:flex;align-items:center;gap:8px;height:48px;padding:0 20px;border-radius:6px;background:var(--navy);color:#fff;font-weight:700;font-size:14px;border:2px solid var(--gold);box-shadow:0 8px 20px rgba(11,28,54,.4)}
.msx-fab:hover{background:var(--blue)}
.msx-scrim{position:fixed;inset:0;z-index:50;background:rgba(8,18,38,.55);animation:msx-fade .2s both}
.msx-sheet{position:fixed;left:0;right:0;bottom:0;z-index:51;max-height:86vh;overflow:auto;background:#fff;border-radius:14px 14px 0 0;border-top:4px solid var(--gold);padding:10px 16px calc(24px + env(safe-area-inset-bottom));animation:msx-up .28s cubic-bezier(.2,.9,.3,1) both;box-shadow:0 -12px 40px rgba(0,0,0,.25)}
.msx-sheet .grab{width:42px;height:4px;border-radius:2px;background:#c3cde0;margin:2px auto 12px}
.msx-sheet h4{margin:16px 2px 8px;padding-bottom:5px;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--navy);border-bottom:2px solid var(--tint)}
.msx-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.msx-tile{display:flex;flex-direction:column;align-items:center;gap:7px;padding:10px 2px;border-radius:8px;font-size:11.5px;font-weight:700;color:var(--ink);text-align:center}
.msx-tile span.i{width:50px;height:50px;border-radius:8px;background:var(--tint);color:var(--navy);display:flex;align-items:center;justify-content:center}
.msx-tile.on span.i{background:var(--navy);color:#fff}
.msx-snack{position:fixed;left:12px;right:12px;bottom:calc(88px + env(safe-area-inset-bottom));z-index:60;margin:0 auto;max-width:520px;padding:13px 16px;border-radius:6px;border-left:6px solid #7ea6e6;font-size:14.5px;line-height:1.4;font-weight:600;color:#fff;background:#1c2b46;box-shadow:0 8px 24px rgba(0,0,0,.3);animation:msx-up .25s both}
.msx-snack.bad{background:#7f1d1d;border-left-color:#f08c82}.msx-snack.ok{background:#14532d;border-left-color:#6dd49d}
.msx-confetti{position:fixed;inset:0;z-index:70;pointer-events:none;overflow:hidden}
.msx-confetti i{position:absolute;top:-12px;width:9px;height:14px;border-radius:2px;animation:msx-fall 1.7s ease-in forwards}
.msx-overlay{align-items:flex-end!important}
.msx-dialog{border-radius:14px 14px 0 0!important;width:100%!important;max-width:560px!important;animation:msx-up .28s cubic-bezier(.2,.9,.3,1) both}

/* ── Display settings popover ── */
.msx-disp{position:fixed;top:44px;right:12px;z-index:80;width:min(330px,calc(100vw - 24px));background:#fff;border-radius:8px;border:1px solid var(--line);border-top:4px solid var(--gold);padding:16px;box-shadow:0 16px 48px rgba(10,20,40,.35);animation:msx-up .2s both;color:var(--ink)}
.msx-disp h3{margin:0 0 2px;font-size:16px;color:var(--navy)}.msx-disp p{margin:0 0 10px;font-size:12.5px;color:var(--sub)}.msx-disp h5{margin:12px 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--sub)}
.msx-seg{display:flex;gap:3px;background:#e9eef6;border-radius:6px;padding:3px}.msx-seg button{flex:1;padding:9px 4px;border-radius:4px;font-size:13px;font-weight:700;color:var(--sub);background:transparent}
.msx-seg button.on{background:#fff;color:var(--navy);box-shadow:0 1px 3px rgba(15,27,46,.22)}
.msx[data-size=lg] .msx-main,.msx[data-size=lg] .msx-rail{zoom:1.12}.msx[data-size=xl] .msx-main,.msx[data-size=xl] .msx-rail{zoom:1.26}
.msx[data-comfort=roomy] .msx-main .px-card,.msx[data-comfort=roomy] .msx-main .px-table td{line-height:1.65}.msx[data-comfort=roomy] .msx-main button,.msx[data-comfort=roomy] .msx-main input,.msx[data-comfort=roomy] .msx-main select{min-height:44px}
html.msx-warm{filter:sepia(.2) brightness(.97) saturate(.95)}
html.msx-dark{filter:invert(.9) hue-rotate(180deg);background:#fff}html.msx-dark img,html.msx-dark video,html.msx-dark iframe,html.msx-dark canvas{filter:invert(1) hue-rotate(180deg)}
@media print{html.msx-warm,html.msx-dark{filter:none!important}.msx-util,.msx-top,.msx-crumbs,.msx-slot,.msx-bottom,.msx-foot,.msx-fab,.msx-ph{display:none!important}}

@keyframes msx-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes msx-up{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
@keyframes msx-fade{from{opacity:0}to{opacity:1}}
@keyframes msx-fall{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(105vh) rotate(720deg);opacity:.9}}
@keyframes msx-pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
html{scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}.msx *{animation-duration:.01ms!important;transition-duration:.01ms!important}}

@media (min-width:900px){.msx-slot{display:block}.msx-bottom{display:none}.msx-fab{bottom:24px}.msx-snack{bottom:24px;left:auto;right:24px;margin:0}.msx-overlay{align-items:center!important}.msx-dialog{border-radius:10px!important}}
@media (max-width:899px){.msx-find-mobile{display:inline-flex}.msx-act .lbl{display:none}.msx-act{width:40px;padding:0;justify-content:center}.msx-util .org{display:none}.msx-util{justify-content:flex-end}}
@media (max-width:700px){
  .msx-top{min-height:60px;padding:6px 10px;gap:8px;border-bottom-width:3px}.msx-brand{gap:9px}.msx-brand h1{font-size:18px}.msx-brand small{font-size:11px}.msx-brand svg{width:36px;height:36px}
  .msx-crumbs{padding:0 12px;min-height:36px;font-size:12.5px}
  .msx-util{padding:3px 8px;gap:8px}.msx-util .hide-sm{display:none}
  .msx-main{padding:14px 12px 96px;font-size:15px}.msx-main .px-card-h{padding:13px 15px}
  .msx-ph{margin-bottom:14px}.msx-ph h2{font-size:22px}.msx-ph p{font-size:13.5px}
  .msx-bi{font-size:10.5px}
  /* Wide data tables become stacked cards on phones (labels come from each column's heading, set in the Shell effect). */
  .msx-main table.px-table,.msx-main table.px-table tbody{display:block;width:100%;min-width:0!important}
  .msx-main .px-table thead{display:none}
  .msx-main .px-table tr{display:block;margin:10px;padding:6px 14px;border:1px solid var(--line);border-left:4px solid var(--navy);border-radius:6px;background:#fff;box-shadow:0 1px 3px rgba(19,42,79,.08)}
  .msx-main .px-table td{display:flex;justify-content:space-between;align-items:center;gap:14px;border:0!important;padding:7px 0!important;text-align:right;position:static!important;background:transparent!important;white-space:normal!important}
  .msx-main .px-table td::before{content:attr(data-label);flex:none;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--sub);text-align:left}
  .msx-main .px-table td:first-child{justify-content:flex-start;font-size:15.5px;font-weight:800;padding-bottom:9px!important;margin-bottom:3px;border-bottom:1px solid #e3e8f0!important}
  .msx-main .px-table td:first-child::before,.msx-main .px-table td[data-label=""]::before{display:none}
  .msx-main .px-table td:empty{display:none}
  .msx-main .px-card-h{flex-wrap:wrap}
  .msx-main .px-card-h>div:first-of-type{flex:1 1 calc(100% - 28px)!important}
  .msx-main .px-card-h>*:not(.bar):not(div:first-of-type){margin-left:14px}
  /* comfortable thumb targets; 16px inputs stop iOS zooming the page on focus */
  .msx-main .px-hbtn,.msx-main .px-btn{min-height:42px}
  .msx-main button:not(.msm-fav):not([role=checkbox]){min-height:40px}
  .msx-main input:not([type=checkbox]):not([type=radio]):not([type=file]),.msx-main select,.msx-main textarea{font-size:16px!important;min-height:42px!important}
  .msx-fab{bottom:calc(66px + env(safe-area-inset-bottom))}.msx-snack{bottom:calc(62px + env(safe-area-inset-bottom))}
  .msx-allot .msx-acell{flex-direction:row;align-items:center;gap:8px;padding:6px 10px}
  .msx-main.has-fab{padding-bottom:150px}
}

/* ═══ Premium layer ═══ */
.msx{--serif:'Fraunces','Playfair Display',Georgia,serif;--sh1:0 1px 2px rgba(16,24,40,.05),0 1px 1px rgba(16,24,40,.03);--sh2:0 1px 2px rgba(19,42,79,.06),0 14px 34px -20px rgba(19,42,79,.38);--goldgrad:linear-gradient(90deg,#8a6a1f,#e6c35e 50%,#8a6a1f);
  background:radial-gradient(900px 380px at 85% -6%,rgba(184,146,58,.10),transparent 70%),radial-gradient(700px 400px at -5% 30%,rgba(29,79,145,.07),transparent 70%),linear-gradient(180deg,#f4f6fa,#eaeef5)}
.msx-util{background:linear-gradient(180deg,#07142a,#0d2247);border-bottom:1px solid rgba(230,195,94,.35);letter-spacing:.015em}
.msx-util .org b{color:#f1dca0}
.msx-top{position:relative;border-bottom:0;background:linear-gradient(180deg,#fff,#fbfcfe);box-shadow:0 8px 24px -14px rgba(11,28,54,.35)}
.msx-top::after{content:'';position:absolute;left:0;right:0;bottom:0;height:3px;background:var(--goldgrad)}
.msx-brand svg{filter:drop-shadow(0 3px 5px rgba(11,28,54,.35))}
.msx-brand h1{font-family:var(--serif);font-size:26px;font-weight:700;letter-spacing:.005em;background:linear-gradient(180deg,#0e2a55,#1c4a8f);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.msx-brand small{font-size:11.5px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#7a6422}
.msx-act{border-radius:10px;border:1px solid #cfd8e8;background:linear-gradient(180deg,#fff,#f5f8fc);box-shadow:var(--sh1);font-weight:700}
.msx-act:hover{border-color:var(--gold);background:#fffdf7;box-shadow:0 6px 16px -8px rgba(184,146,58,.55);transform:translateY(-1px)}
.msx-crumbs{background:rgba(255,255,255,.72);backdrop-filter:blur(8px);border-bottom:1px solid #e1e6ef;min-height:42px}
.msx-crumbs .cur{color:var(--navy)}
.msx-rail{background:linear-gradient(180deg,#fff,#fafbfd);border-right:1px solid #e1e6ef;box-shadow:12px 0 30px -26px rgba(19,42,79,.45)}
.msx-rail h4{display:flex;align-items:center;gap:10px;border:0;padding:0;margin:20px 8px 8px;color:#8a6a1f;font-size:11px;letter-spacing:.18em}
.msx-rail h4::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,#e6d6a6,transparent)}
.msx-ri{border-radius:10px;transition:background .18s,transform .18s,box-shadow .18s}
.msx-ri:hover{background:#f3f6fb;transform:translateX(2px)}
.msx-ri.on{background:linear-gradient(90deg,#e6edf9,#f4f7fc);box-shadow:inset 3px 0 0 var(--gold),0 4px 12px -8px rgba(19,42,79,.4)}
.msx-ri.on svg{color:var(--gold)}
.msx-find input{border-radius:10px;border-color:#d3dbe9;background:#f7f9fc}.msx-find input:focus{background:#fff;border-color:var(--gold);box-shadow:0 0 0 4px rgba(184,146,58,.18)}
.msx-rail-tg{border-radius:10px;background:#f7f9fc}
.msx-main{padding-top:28px}
.msx-ph{border-bottom:1px solid #dfe5ef;padding-bottom:18px;margin-bottom:24px}
.msx-ph::after{width:96px;height:3px;background:var(--goldgrad);border-radius:2px}
.msx-ph .kick{color:#8a6a1f;letter-spacing:.2em;font-size:11.5px}
.msx-ph h2{font-family:var(--serif);font-size:34px;font-weight:700;letter-spacing:-.01em;margin:4px 0 6px}
.msx-ph p{font-size:15px}
.msx-main .px-card{border-radius:16px;border:1px solid #e3e8f1;box-shadow:var(--sh2);transition:box-shadow .25s,transform .25s}
.msx-main .px-card-h{background:linear-gradient(180deg,#fff,#f7f9fd);padding:16px 22px;border-bottom:1px solid #e8ecf4;position:relative}
.msx-main .px-card-h .bar{width:4px;border-radius:4px;background:linear-gradient(180deg,#e6c35e,#b8923a)}
.msx-main .px-card-t{font-family:var(--serif);font-size:19px;font-weight:600;letter-spacing:0;color:#0e2a55}
.msx-main .px-table th{background:linear-gradient(180deg,#eef2f9,#e1e8f4);border-bottom:2px solid var(--gold);color:#0e2a55;font-size:11.5px;letter-spacing:.1em}
.msx-main .px-table tbody tr:hover td{background:#fbf6e6}
.msx-main .px-table td{padding:14px 16px}
.msx-main .px-btn{border-radius:10px;background:linear-gradient(180deg,#1f4783,#132a4f);border:1px solid #0e2144;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 6px 14px -8px rgba(19,42,79,.7);letter-spacing:.01em}
.msx-main .px-btn:hover:not(:disabled){background:linear-gradient(180deg,#2a5ba6,#18356a);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 10px 20px -10px rgba(19,42,79,.8);transform:translateY(-1px)}
.msx-main .px-btn.ghost{background:#fff;border:1px solid #c5d0e3;box-shadow:var(--sh1);color:#0e2a55}
.msx-main .px-btn.gold{background:linear-gradient(180deg,#d9b657,#b8923a);border-color:#9c7a2b;color:#2b1f03;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 8px 16px -8px rgba(184,146,58,.8)}
.msx-main .px-hbtn{border-radius:10px;border-color:#c5d0e3;box-shadow:var(--sh1)}
.msx-main .px-input,.msx-main select,.msx-main textarea{border-radius:10px;border-color:#cdd6e6;background:#fcfdff}
.msx-main .px-input:focus,.msx-main select:focus,.msx-main textarea:focus{border-color:var(--gold)!important;box-shadow:0 0 0 4px rgba(184,146,58,.18)!important}
.msx-main .px-tab{border-radius:10px 10px 0 0}.msx-main .px-tab.on{border-bottom-color:var(--gold);color:#0e2a55}
.msx-fab{border-radius:14px;background:linear-gradient(180deg,#1f4783,#132a4f);box-shadow:0 14px 28px -10px rgba(11,28,54,.6),inset 0 1px 0 rgba(255,255,255,.2)}
.msx-snack{border-radius:12px}
.msx-foot{background:linear-gradient(180deg,#0d2247,#07142a)}.msx-foot .gold{background:var(--goldgrad)}
.msx-sheet{border-radius:22px 22px 0 0}.msx-bottom{border-top:0;box-shadow:0 -10px 30px -12px rgba(14,32,63,.25)}
.msx-disp{border-radius:14px}
@media (max-width:700px){.msx-brand h1{font-size:21px}.msx-brand small{font-size:10px;letter-spacing:.08em}.msx-ph h2{font-size:26px}.msx-main .px-card{border-radius:14px}.msx-main .px-card-t{font-size:17px}}

/* ── Top menu bar with dropdown groups (desktop) ── */
.msx-stickytop{position:sticky;top:0;z-index:30}
.msx-menubar{display:none;position:relative;align-items:stretch;gap:2px;padding:0 20px;min-height:46px;background:linear-gradient(180deg,#14336a,#0d2247);border-bottom:1px solid rgba(230,195,94,.4);box-shadow:0 10px 24px -16px rgba(11,28,54,.7)}
.msx-mb{position:relative;display:flex}
.msx-mb>button{display:flex;align-items:center;gap:8px;height:46px;padding:0 16px;color:#e4ecfa;font-size:14px;font-weight:600;letter-spacing:.01em;border-bottom:3px solid transparent;background:transparent}
.msx-mb>button:hover,.msx-mb.open>button{background:rgba(255,255,255,.1);color:#fff}
.msx-mb.cur>button{color:#fff;border-bottom-color:var(--gold);font-weight:700}
.msx-mb .car{transition:transform .2s;opacity:.8}.msx-mb.open .car{transform:rotate(180deg)}
.msx-mb .dot{min-width:17px;height:17px;border-radius:9px;background:var(--bad);color:#fff;font-size:10px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;padding:0 4px}
.msx-dd{position:absolute;left:0;top:100%;z-index:60;min-width:340px;padding:8px;background:#fff;border:1px solid var(--line);border-top:3px solid var(--gold);border-radius:0 0 14px 14px;box-shadow:0 24px 48px -16px rgba(11,28,54,.5);animation:msx-fade .15s both}
.msx-dd button{display:flex;align-items:center;gap:13px;width:100%;padding:10px 12px;border-radius:10px;text-align:left;color:var(--ink)}
.msx-dd button:hover{background:#f3f6fb}.msx-dd button.on{background:var(--tint);box-shadow:inset 3px 0 0 var(--gold)}
.msx-dd .i{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#eaf0fa,#dde7f6);color:var(--navy);display:flex;align-items:center;justify-content:center;flex:none}
.msx-dd b{display:block;font-size:14px}.msx-dd small{display:block;font-size:12px;color:var(--sub);margin-top:1px;line-height:1.35}
.msx-dd .msx-badge{position:static;margin-left:auto}
@media (min-width:900px){.msx-menubar{display:flex}}
@media print{.msx-menubar{display:none!important}}
`

export function Confetti({ show }) {
  if (!show) return null
  const colors = ['#b8923a', '#132a4f', '#0f7a4c', '#e9d9b0', '#1d4ed8', '#c2410c']
  return (
    <div className="msx-confetti" aria-hidden="true">
      {Array.from({ length: 34 }, (_, i) => (
        <i key={i} style={{ left: ((i * 37) % 100) + '%', background: colors[i % colors.length], animationDelay: (i % 9) * 0.07 + 's', transform: `rotate(${i * 25}deg)` }} />
      ))}
    </div>
  )
}

export default function MissionSainikShell({ navGroups, active, onChange, title, onBack, actions = [], badges = {}, isAdmin, fab, msg, confetti, children }) {
  const [sheet, setSheet] = useState(false)
  const [slim, setSlim] = useState(() => store.get('msx-rail-slim', typeof window !== 'undefined' && window.innerWidth < 1180))
  const slimRef = useRef(slim); slimRef.current = slim
  const rootRef = useRef(null)
  const [wide, setWide] = useState(() => store.get('msx-wide', false))
  const [full, setFull] = useState(false)
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f) }, [])
  const toggleFull = () => { try { if (document.fullscreenElement) document.exitFullscreen(); else if (rootRef.current?.requestFullscreen) { rootRef.current.requestFullscreen(); setWide(true) } else setWide(w => { store.set('msx-wide', !w); return !w }) } catch { /* not allowed */ } }
  const toggleSlim = () => setSlim(v => { store.set('msx-rail-slim', !v); return !v })
  const [q, setQ] = useState('')
  const [disp, setDisp] = useState(false)
  const [menu, setMenu] = useState(null)   // title of the open top-menu group
  const topRef = useRef(null), mbRef = useRef(null)
  // Keep the side menu's sticky offset equal to the real height of the header + menu bar.
  useEffect(() => {
    const el = topRef.current, root = rootRef.current; if (!el || !root || typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(() => root.style.setProperty('--msx-top', el.offsetHeight + 'px')); ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => {
    if (!menu) return undefined
    const away = e => { if (!mbRef.current?.contains(e.target)) setMenu(null) }
    const esc = e => e.key === 'Escape' && setMenu(null)
    document.addEventListener('mousedown', away); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc) }
  }, [menu])
  const [prefs, setPrefs] = useState(() => ({ size: 'md', theme: 'light', comfort: 'normal', ...store.get('msx-prefs', {}) }))
  const setPref = patch => setPrefs(p => { const n = { ...p, ...patch }; store.set('msx-prefs', n); return n })
  useNoPullToRefresh()   // dragging down on a phone no longer reloads the page and loses unsaved work
  // Eye-comfort themes tint the whole page (so dialogs and previews follow); removed again when leaving the module.
  useEffect(() => {
    const el = document.documentElement
    el.classList.toggle('msx-warm', prefs.theme === 'warm'); el.classList.toggle('msx-dark', prefs.theme === 'dark')
    return () => el.classList.remove('msx-warm', 'msx-dark')
  }, [prefs.theme])
  useEffect(() => { if (disp) { const k = e => e.key === 'Escape' && setDisp(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) } }, [disp])
  const [hi, setHi] = useState(0)
  const [pins, setPins] = useState(() => store.get('msx-pins', []))
  const [recent, setRecent] = useState(() => store.get('msx-recent', []))
  const railFind = useRef(null), sheetFind = useRef(null)
  const togglePin = id => setPins(p => { const n = p.includes(id) ? p.filter(x => x !== id) : [...p, id]; store.set('msx-pins', n); return n })
  const openFinder = () => { if (window.matchMedia('(min-width:900px)').matches && !slimRef.current) railFind.current?.focus(); else if (window.matchMedia('(min-width:900px)').matches) { setSlim(false); store.set('msx-rail-slim', false); setTimeout(() => railFind.current?.focus(), 220) } else { setSheet(true); setTimeout(() => sheetFind.current?.focus(), 60) } }
  // "/" or Ctrl+K jumps to search: the side menu on desktop, the All-sections sheet on phones.
  useEffect(() => {
    const k = e => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable
      if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); openFinder() }
    }
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [])
  useEffect(() => { if (sheet) { const k = e => e.key === 'Escape' && setSheet(false); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) } }, [sheet])
  // Label every table cell with its column heading so the phone card layout can show it.
  useEffect(() => {
    document.querySelectorAll('.msx-main table.px-table').forEach(t => {
      const heads = [...t.querySelectorAll('thead th')].map(h => h.textContent.trim())
      t.querySelectorAll('tbody tr').forEach(tr => [...tr.children].forEach((td, i) => { td.dataset.label = heads[i] || '' }))
    })
  })
  const go = id => {
    try { navigator.vibrate?.(8) } catch { /* not supported */ }
    setSheet(false); setQ(''); setMenu(null); onChange(id); window.scrollTo?.({ top: 0 })
    setRecent(r => { const n = [id, ...r.filter(x => x !== id)].slice(0, 5); store.set('msx-recent', n); return n })
  }
  const groups = (navGroups || NAV_GROUPS).map(g => ({ ...g, items: g.items.filter(i => i[0] !== 'admin' || isAdmin) }))
  const inBottom = BOTTOM.some(b => b[0] === active)
  const flat = useMemo(() => groups.flatMap(g => g.items.map(([id, ic, label]) => ({ id, ic, label, group: g.title, hint: HINTS[id] || '' }))), [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps
  const byId = Object.fromEntries(flat.map(x => [x.id, x]))
  const cur = byId[active]
  const needle = q.trim().toLowerCase()
  const results = needle ? flat.filter(x => (x.label + ' ' + x.hint + ' ' + x.group).toLowerCase().includes(needle)) : []
  const pinned = pins.map(id => byId[id]).filter(Boolean)
  const recents = recent.filter(id => id !== active && !pins.includes(id)).map(id => byId[id]).filter(Boolean).slice(0, 4)
  const onFindKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(h => Math.min(results.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' && results[hi]) go(results[hi].id)
    else if (e.key === 'Escape') { setQ(''); e.currentTarget.blur() }
  }
  const finder = (ref, placeholder) => (
    <div className="msx-find" role="search">
      <span className="ic" aria-hidden="true"><Icon name="search" size={17} /></span>
      <input ref={ref} type="search" value={q} onChange={e => { setQ(e.target.value); setHi(0) }} onKeyDown={onFindKey} placeholder={placeholder} aria-label="Find a section" enterKeyHint="go" />
      {q ? <button type="button" className="msx-tap x" aria-label="Clear search" onClick={() => setQ('')}>×</button> : <kbd aria-hidden="true">/</kbd>}
    </div>
  )
  const resultList = (
    <div role="listbox" aria-label="Search results">
      {results.length === 0 && <div style={{ padding: '14px 12px', fontSize: 13.5, color: 'var(--sub)' }}>No section matches “{q}”. Try “marks”, “paper”, “syllabus” or “teacher”.</div>}
      {results.map((x, i) => (
        <button key={x.id} type="button" role="option" aria-selected={i === hi} className={'msx-tap msx-res' + (i === hi ? ' hi' : '')} onClick={() => go(x.id)} onMouseEnter={() => setHi(i)}>
          <span className="ic"><Ico id={x.id} fallback={x.ic} /></span><span style={{ minWidth: 0 }}><b>{x.label}</b><small>{x.group} · {x.hint}</small></span>
        </button>))}
    </div>
  )
  const bad = msg && msg.startsWith('❌')
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const pinBtn = (id, label, extra) => (
    <span role="button" tabIndex={0} aria-label={(pins.includes(id) ? 'Unpin ' : 'Pin ') + label} title={pins.includes(id) ? 'Unpin' : 'Pin to top'} className={'msx-pin' + (pins.includes(id) ? ' on' : '')} style={extra}
      onClick={e => { e.stopPropagation(); togglePin(id) }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); togglePin(id) } }}>{pins.includes(id) ? '★' : '☆'}</span>
  )
  return (
    <div className={'msx' + (wide || full ? ' wide' : '')} ref={rootRef} data-size={prefs.size} data-comfort={prefs.comfort}>
      <style>{CSS}</style>
      <a className="msx-skip" href="#msx-main" onClick={e => { e.preventDefault(); document.getElementById('msx-main')?.focus() }}>Skip to main content</a>

      <div className="msx-util" role="region" aria-label="Accessibility and display options">
        <span className="org"><b>Guidance Khangabok</b> · GNSI Academic Portal</span>
        <div className="grp" role="group" aria-label="Text size">
          {[['md', 'A', 'Normal text size'], ['lg', 'A+', 'Large text size'], ['xl', 'A++', 'Extra large text size']].map(([k, t, l]) => <button key={k} type="button" aria-pressed={prefs.size === k} aria-label={l} title={l} onClick={() => setPref({ size: k })}>{t}</button>)}
        </div>
        <span className="sep" aria-hidden="true" />
        <div className="grp" role="group" aria-label="Colour theme">
          {[['light', '#ffffff', 'Light theme'], ['warm', '#f1c97a', 'Warm theme, easier on the eyes'], ['dark', '#10151f', 'Dark theme']].map(([k, c, l]) => <button key={k} type="button" className="sw" style={{ background: c, backgroundColor: c }} aria-pressed={prefs.theme === k} aria-label={l} title={l} onClick={() => setPref({ theme: k })} />)}
        </div>
        <span className="sep hide-sm" aria-hidden="true" />
        <button type="button" className="hide-sm" aria-expanded={disp} onClick={() => setDisp(v => !v)} title="More display options">Display ▾</button>
        <button type="button" aria-label={full ? 'Exit full screen' : 'Full screen'} title={full ? 'Exit full screen' : 'Full screen — hide the browser and ERP header'} onClick={toggleFull}><Icon name={full ? 'shrink' : 'expand'} size={16} /></button>
      </div>

      <div className="msx-stickytop" ref={topRef}>
      <header className="msx-top">
        <div className="msx-brand">
          {onBack && <button className="msx-tap msx-act ic" style={{ border: 0 }} aria-label="Back to Home" title="Back to Home" onClick={onBack}><Icon name="back" size={22} /></button>}
          <Emblem size={46} />
          <div className="t"><h1>Mission Sainik</h1><small>Sainik School Entrance Preparation Programme · AISSEE 2027</small></div>
        </div>
        <div className="msx-acts">
          <button className="msx-tap msx-act ic msx-find-mobile" aria-label="Find a section" title="Find a section" onClick={openFinder}><Icon name="search" size={19} /></button>
          {actions.map(a => (
            <button key={a.label} className="msx-tap msx-act" aria-label={a.label} title={a.label} onClick={a.onClick}>
              {ACTION_ICON[a.label] ? <Icon name={ACTION_ICON[a.label]} size={18} /> : <span aria-hidden="true">{a.icon}</span>}<span className="lbl">{a.label}</span>
            </button>))}
        </div>
      </header>
      <nav className="msx-menubar" aria-label="Main menu" ref={mbRef}>
        <div className={'msx-mb' + (active === 'overview' ? ' cur' : '')}><button type="button" className="msx-tap" onClick={() => go('overview')}><Icon name="overview" size={17} />Home</button></div>
        {groups.filter(g => !(g.items.length === 1 && g.items[0][0] === 'overview')).map(g => {
          const items = g.items.filter(i => i[0] !== 'overview'); if (!items.length) return null
          const open = menu === g.title, here = items.some(i => i[0] === active), n = items.reduce((a, i) => a + (Number(badges[i[0]]) || 0), 0)
          return (
            <div key={g.title} className={'msx-mb' + (open ? ' open' : '') + (here ? ' cur' : '')} onMouseEnter={() => { if (menu && !open) setMenu(g.title) }}>
              <button type="button" className="msx-tap" aria-haspopup="true" aria-expanded={open} onClick={() => setMenu(open ? null : g.title)}>
                {g.title}{n > 0 && <span className="dot">{n}</span>}<span className="car"><Icon name="chev" size={14} style={{ transform: 'rotate(90deg)' }} /></span>
              </button>
              {open && (
                <div className="msx-dd" role="menu">
                  {items.map(([id, ic, label]) => (
                    <button key={id} type="button" role="menuitem" className={'msx-tap' + (active === id ? ' on' : '')} onClick={() => go(id)}>
                      <span className="i"><Ico id={id} fallback={ic} /></span><span style={{ minWidth: 0 }}><b>{label}</b>{HINTS[id] && <small>{HINTS[id]}</small>}</span>
                      {badges[id] ? <span className="msx-badge">{badges[id]}</span> : null}
                    </button>))}
                </div>)}
            </div>)
        })}
      </nav>
      </div>

      <nav className="msx-crumbs" aria-label="Breadcrumb">
        <button type="button" className="msx-tap" onClick={() => go('overview')}>Home</button>
        <span className="sp" aria-hidden="true">›</span>
        {active === 'overview' ? <span className="cur" aria-current="page">Mission Sainik</span> : (
          <>
            <button type="button" className="msx-tap" onClick={() => go('overview')}>Mission Sainik</button>
            {cur && <><span className="sp" aria-hidden="true">›</span><span>{cur.group}</span></>}
            <span className="sp" aria-hidden="true">›</span><span className="cur" aria-current="page">{cur?.label || title}</span>
          </>)}
      </nav>

      <div className="msx-body">
        <div className="msx-slot">
          <nav className={'msx-rail' + (slim ? ' slim' : '')} aria-label="Mission Sainik sections">
            <button type="button" className="msx-tap msx-rail-tg" onClick={toggleSlim} aria-label={slim ? 'Expand menu' : 'Collapse menu'} title={slim ? 'Expand menu' : 'Collapse menu'}>
              <Icon name={slim ? 'menu' : 'back'} size={16} /><span className="tgl">{slim ? '' : 'Collapse menu'}</span>
            </button>
            {finder(railFind, 'Find a section…')}
            {needle && !slim ? resultList : (
              <>
                {pinned.length > 0 && <div><h4>Pinned</h4>
                  {pinned.map(x => (
                    <button key={x.id} className={'msx-tap msx-ri' + (active === x.id ? ' on' : '')} aria-current={active === x.id ? 'page' : undefined} onClick={() => go(x.id)} title={x.label}>
                      <Ico id={x.id} fallback={x.ic} /><span className="msx-lbl">{x.label}</span>{pinBtn(x.id, x.label)}
                    </button>))}
                </div>}
                {groups.map(g => (
                  <div key={g.title}><h4>{g.title}</h4>
                    {g.items.map(([id, ic, label]) => (
                      <button key={id} className={'msx-tap msx-ri' + (active === id ? ' on' : '')} aria-current={active === id ? 'page' : undefined} onClick={() => go(id)} title={label}>
                        <Ico id={id} fallback={ic} /><span className="msx-lbl">{label}</span>{badges[id] ? <span className="msx-badge" style={{ position: 'static', marginLeft: 'auto' }}>{badges[id]}</span> : null}
                        {pinBtn(id, label, badges[id] ? { marginLeft: 6 } : undefined)}
                      </button>))}
                  </div>))}
              </>
            )}
          </nav>
        </div>
        <main id="msx-main" tabIndex={-1} className={'msx-main' + (fab ? ' has-fab' : '')} key={active} style={{ outline: 'none' }}>
          {active !== 'overview' && (
            <div className="msx-ph">
              <div className="kick">{cur?.group || 'Mission Sainik'}</div>
              <h2>{cur?.label || title}</h2>
              {HINTS[active] && <p>{HINTS[active]}</p>}
            </div>)}
          {children}
        </main>
      </div>

      <footer className="msx-foot">
        <div className="gold" />
        <div className="in">
          <span><b>Mission Sainik</b> · Guidance Khangabok (GNSI)</span>
          <span>For authorised staff use only · Last viewed {today}</span>
        </div>
      </footer>

      <nav className="msx-bottom" aria-label="Primary">
        {BOTTOM.map(([id, label]) => (
          <button key={id} className={'msx-tap msx-bi' + (active === id ? ' on' : '')} aria-current={active === id ? 'page' : undefined} onClick={() => go(id)}>
            <span className="msx-pill"><Icon name={id} size={22} />{badges[id] ? <span className="msx-badge">{badges[id]}</span> : null}</span>{label}
          </button>))}
        <button className={'msx-tap msx-bi' + (!inBottom ? ' on' : '')} aria-haspopup="dialog" onClick={() => setSheet(true)}>
          <span className="msx-pill"><Icon name="menu" size={22} /></span>Menu
        </button>
      </nav>
      {fab && <button className="msx-tap msx-fab" onClick={fab.onClick}><Icon name="upload" size={19} />{fab.label}</button>}
      {sheet && (
        <>
          <div className="msx-scrim" onClick={() => setSheet(false)} />
          <div className="msx-sheet" role="dialog" aria-modal="true" aria-label="All sections">
            <div className="grab" />
            <div className="msx-sticky">{finder(sheetFind, 'Find a section… e.g. marks, paper')}</div>
            {needle ? resultList : (
              <>
                {[['Pinned', pinned], ['Recent', recents]].filter(([, l]) => l.length).map(([t, list]) => (
                  <div key={t}><h4>{t}</h4>
                    <div className="msx-grid">{list.map(x => <button key={x.id} className={'msx-tap msx-tile' + (active === x.id ? ' on' : '')} onClick={() => go(x.id)}><span className="i"><Ico id={x.id} fallback={x.ic} size={24} /></span>{x.label}</button>)}</div>
                  </div>))}
                {groups.map(g => (
                  <div key={g.title}><h4>{g.title}</h4>
                    <div className="msx-grid">
                      {g.items.map(([id, ic, label]) => (
                        <button key={id} className={'msx-tap msx-tile' + (active === id ? ' on' : '')} onClick={() => go(id)}><span className="i"><Ico id={id} fallback={ic} size={24} /></span>{label}
                          {pinBtn(id, label)}
                        </button>))}
                    </div>
                  </div>))}
                <div style={{ fontSize: 12, color: 'var(--sub)', textAlign: 'center', marginTop: 14 }}>Tap ☆ on any section to pin it here and in the side menu.</div>
              </>
            )}
          </div>
        </>
      )}
      {disp && (
        <>
          <div onClick={() => setDisp(false)} style={{ position: 'fixed', inset: 0, zIndex: 79 }} />
          <div className="msx-disp" role="dialog" aria-label="Display settings">
            <h3>Display settings</h3><p>Choose what is easiest to read. Saved on this device.</p>
            <h5>Text size</h5>
            <div className="msx-seg" role="group" aria-label="Text size">{[['md', 'A', 'Normal'], ['lg', 'A+', 'Large'], ['xl', 'A++', 'Extra large']].map(([k, t, l]) => <button key={k} type="button" className={'msx-tap' + (prefs.size === k ? ' on' : '')} aria-pressed={prefs.size === k} title={l} onClick={() => setPref({ size: k })}>{t}</button>)}</div>
            <h5>Colours</h5>
            <div className="msx-seg" role="group" aria-label="Colour theme">{[['light', 'Light'], ['warm', 'Warm'], ['dark', 'Dark']].map(([k, l]) => <button key={k} type="button" className={'msx-tap' + (prefs.theme === k ? ' on' : '')} aria-pressed={prefs.theme === k} onClick={() => setPref({ theme: k })}>{l}</button>)}</div>
            <h5>Spacing</h5>
            <div className="msx-seg" role="group" aria-label="Spacing">{[['normal', 'Normal'], ['roomy', 'Roomy (bigger buttons)']].map(([k, l]) => <button key={k} type="button" className={'msx-tap' + (prefs.comfort === k ? ' on' : '')} aria-pressed={prefs.comfort === k} onClick={() => setPref({ comfort: k })}>{l}</button>)}</div>
            <button type="button" className="msx-tap" style={{ marginTop: 14, width: '100%', padding: 10, borderRadius: 6, background: '#e9eef6', fontWeight: 700, fontSize: 13, color: 'var(--navy)' }} onClick={() => setPref({ size: 'md', theme: 'light', comfort: 'normal' })}>Reset to default</button>
          </div>
        </>
      )}
      {msg && <div role="status" className={'msx-snack ' + (bad ? 'bad' : 'ok')}>{msg}</div>}
      <Confetti show={confetti} />
    </div>
  )
}

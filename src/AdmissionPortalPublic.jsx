// AdmissionPortalPublic.jsx — the public (no login) admission portal:
//   /apply          apply online → upload documents → pay the admission fee (Razorpay)
//   /apply-status   reference number + date of birth → status, documents, payment, receipt, timeline
// Rules come from lib/portalApply.js (the same file the server uses); money, numbering and status are decided by
// the api/entrance adm-* actions, never by this file.
import { Fragment, useEffect, useMemo, useState } from 'react'
import { api, payPortalFee } from './entrancePay'
import gnsiCrest from './gnsi-crest.png' // blue emblem for the white logo disc
import { compressImage, sizeNote } from './lib/imageCompress'
import { getInstitute, loadSystemSettings } from './systemSettings'
import { openPrint } from './entrancePrint'
import {
  GENDERS, CATEGORIES, STATES, DOC_TYPES, MAX_PHOTO_KB, MAX_DOC_KB, validateApplication, findOption, portalFee,
  documentStatus, applicantStage, OPEN_STATUSES, docLabel,
} from './lib/portalApply'

const NAVY = '#0F2A4A', BLUE = '#1D4F91', SUB = '#51627C', BAD = '#B42318', GOOD = '#15803D'
const NAV = [['/apply', 'Apply online'], ['/apply-status', 'Track application']]
const inr = n => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN')
const fmt = d => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—')
const fmtTime = d => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const toDataUrl = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file) })

// ── Look & feel: one stylesheet for the whole public portal (classes prefixed ap-) ──────────
const PORTAL_CSS = `
.ap{--navy:#0F2A4A;--navy2:#17375E;--blue:#1D4F91;--gold:#C9A24B;--gold2:#E6C77A;--orange:#E8731A;--ink:#14243B;--sub:#51627C;--line:#D5DCE8;--soft:#F3F6FB;--bad:#B42318;--good:#15803D;
  min-height:100vh;background:#EEF2F8;color:var(--ink);font-family:'Noto Sans','Open Sans',Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.ap *{box-sizing:border-box}
.ap a{color:inherit}
.ap-flag{height:5px;background:linear-gradient(90deg,#FF9933 0 33.3%,#fff 33.3% 66.6%,#138808 66.6% 100%)}
.ap-head{position:relative;overflow:hidden;color:#fff;background:radial-gradient(120% 160% at 100% 0%,#24508F 0%,#143560 38%,#0B1F3A 80%)}
.ap-head::before{content:"";position:absolute;right:-120px;top:-140px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(230,199,122,.28),transparent 68%)}
.ap-head::after{content:"";position:absolute;left:0;right:0;bottom:0;height:1px;background:linear-gradient(90deg,transparent,rgba(230,199,122,.6),transparent)}
.ap-wrap{max-width:1120px;margin:0 auto;padding:0 20px;position:relative;z-index:1}
.ap-bar{display:flex;align-items:center;gap:14px;padding:18px 0;flex-wrap:wrap}
.ap-logo{width:54px;height:54px;border-radius:50%;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 3px rgba(230,199,122,.9),0 10px 24px rgba(0,0,0,.28)}
.ap-logo img{width:100%;height:100%;object-fit:contain}
.ap-brand{flex:1;min-width:200px}
.ap-brand b{display:block;font:700 19px/1.2 Georgia,'Iowan Old Style',serif;letter-spacing:.01em}
.ap-brand span{font-size:12px;opacity:.78;letter-spacing:.04em}
.ap-nav{display:flex;gap:6px;background:rgba(255,255,255,.1);padding:4px;border-radius:999px;border:1px solid rgba(255,255,255,.16)}
.ap-nav a{padding:8px 16px;border-radius:999px;font-size:13px;font-weight:600;text-decoration:none;color:rgba(255,255,255,.86);transition:.2s}
.ap-nav a:hover{background:rgba(255,255,255,.14)}
.ap-nav a.on{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--navy);font-weight:800}
.ap-hero{position:relative;padding:26px 0 74px;min-height:290px}
.ap-hero>*:not(.ap-art){position:relative;z-index:1}
.ap-hero p{max-width:min(640px,60%)}
.ap-art{position:absolute;right:0;bottom:78px;height:240px;width:auto;filter:drop-shadow(0 18px 30px rgba(0,0,0,.35));pointer-events:none}
.ap-eyebrow{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--gold2)}
.ap-hero h1{margin:8px 0 6px;color:#fff;font:700 clamp(28px,5vw,42px)/1.1 Georgia,'Iowan Old Style',serif;letter-spacing:-.01em;text-shadow:0 2px 18px rgba(0,0,0,.25)}
.ap-hero p{margin:0;max-width:640px;font-size:14.5px;line-height:1.6;color:rgba(255,255,255,.8)}
.ap-hero p a{color:var(--gold2);font-weight:700}
.ap-main{max-width:1120px;margin:-48px auto 0;padding:0 20px 36px;position:relative;z-index:2}
.ap-foot{background:transparent;border:0;text-align:center;font-size:12px;color:#6B7A92;padding:0 20px 30px}
.ap-card{background:#fff;border-radius:22px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 24px 50px -28px rgba(15,42,74,.35),0 2px 6px rgba(15,42,74,.05);padding:clamp(18px,3.4vw,34px);position:relative}
.ap-card+.ap-card{margin-top:18px}
.ap-h2{margin:0;letter-spacing:normal;font:700 clamp(21px,3vw,27px)/1.2 Georgia,'Iowan Old Style',serif;color:var(--navy)}
.ap-h3{margin:0 0 4px;font:700 17px/1.3 Georgia,serif;color:var(--navy)}
.ap-lead{margin:6px 0 0;font-size:14px;line-height:1.6;color:var(--sub)}
.ap-layout{display:grid;grid-template-columns:292px minmax(0,1fr);gap:22px;align-items:start}
.ap-rail{position:sticky;top:16px;display:flex;flex-direction:column;gap:14px}
.ap-steps{background:#fff;border-radius:22px;padding:22px 18px;box-shadow:0 24px 50px -28px rgba(15,42,74,.35),0 2px 6px rgba(15,42,74,.05)}
.ap-steps h4{margin:0 0 14px 6px;font-family:inherit;font-weight:800;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#7A8AA3}
.ap-step{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;border:0;background:none;padding:0 6px;font-family:inherit;position:relative}
.ap-step:not(:last-child){padding-bottom:18px}
.ap-step:not(:last-child)::before{content:"";position:absolute;left:21px;top:34px;bottom:0;width:2px;background:var(--line)}
.ap-step.done:not(:last-child)::before{background:linear-gradient(var(--good),var(--good))}
.ap-dot{flex:0 0 32px;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;background:#E8EDF5;color:#7A8AA3;transition:.25s}
.ap-step.on .ap-dot{background:linear-gradient(160deg,var(--orange),#F59B4B);color:#fff;box-shadow:0 0 0 5px rgba(232,115,26,.16)}
.ap-step.done .ap-dot{background:var(--good);color:#fff}
.ap-step b{display:block;font-size:14px;color:var(--ink);line-height:1.2;padding-top:2px}
.ap-step small{display:block;font-size:11.5px;color:#7A8AA3;margin-top:2px}
.ap-step.todo b{color:#7A8AA3;font-weight:600}
.ap-step[disabled]{cursor:default}
.ap-help{background:linear-gradient(160deg,var(--navy2),var(--navy));color:#fff;border-radius:22px;padding:18px 20px;font-size:13px;line-height:1.6;box-shadow:0 24px 50px -28px rgba(15,42,74,.6)}
.ap-help b{display:block;font:700 15px Georgia,serif;color:var(--gold2);margin-bottom:4px}
.ap-mprog{display:none;margin:0 0 18px}
.ap-mprog-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px}
.ap-mprog-row b{font:700 16px Georgia,serif;color:var(--navy)}
.ap-mprog-row span{font-size:12px;font-weight:800;color:var(--orange);letter-spacing:.08em;text-transform:uppercase}
.ap-track{height:8px;border-radius:99px;background:#E4EAF3;overflow:hidden}
.ap-track i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--orange),var(--gold2));transition:width .4s ease}
.ap-sechead{display:flex;gap:14px;align-items:center;margin-bottom:22px;padding-bottom:18px;border-bottom:1px solid #E6EBF3}
.ap-secico{flex:0 0 48px;height:48px;border-radius:15px;display:flex;align-items:center;justify-content:center;color:#fff;background:linear-gradient(160deg,#24508F,var(--navy));box-shadow:0 10px 18px -10px rgba(15,42,74,.7),inset 0 1px 0 rgba(255,255,255,.25)}
.ap-secico svg{width:24px;height:24px}
.ap-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 18px}
.ap-grid .full{grid-column:1/-1}
.ap-f{display:block}
.ap-f>span.l{display:block;margin-bottom:7px;font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#42536D}
.ap-f>span.l em{font-style:normal;color:var(--bad);margin-left:3px}
.ap-f>span.h{display:block;margin-top:6px;font-size:12px;color:#7A8AA3}
.ap-f>span.e{display:block;margin-top:6px;font-size:12.5px;font-weight:600;color:var(--bad)}
.ap-input{width:100%;height:50px;padding:0 15px;font:500 15px/1 inherit;font-family:inherit;color:var(--ink);background:#F8FAFD;border:1.5px solid var(--line);border-radius:13px;outline:none;transition:border-color .18s,box-shadow .18s,background .18s;-webkit-appearance:none;appearance:none}
.ap-input:hover{border-color:#B6C3D8}
.ap-input:focus{border-color:var(--blue);background:#fff;box-shadow:0 0 0 4px rgba(29,79,145,.14)}
.ap-input.bad{border-color:var(--bad);background:#FFF8F7}
.ap-input.bad:focus{box-shadow:0 0 0 4px rgba(180,35,24,.14)}
textarea.ap-input{height:auto;min-height:104px;padding:13px 15px;line-height:1.5;resize:vertical}
select.ap-input{padding-right:42px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2351627C' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 15px center}
.ap-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-top:28px;padding-top:20px;border-top:1px solid #E6EBF3}
.ap-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:50px;padding:0 28px;border:0;border-radius:999px;font:800 14.5px inherit;font-family:inherit;letter-spacing:.01em;cursor:pointer;color:#fff;background:linear-gradient(180deg,#24508F,var(--navy));box-shadow:0 14px 26px -14px rgba(15,42,74,.8);transition:transform .15s,box-shadow .15s,opacity .15s}
.ap-btn:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 18px 30px -14px rgba(15,42,74,.85)}
.ap-btn:disabled{opacity:.55;cursor:default}
.ap-btn.orange{color:#2A1503;background:linear-gradient(180deg,#F6B25E,var(--orange));box-shadow:0 14px 26px -12px rgba(232,115,26,.75)}
.ap-btn.ghost{color:var(--navy);background:#fff;border:1.5px solid var(--line);box-shadow:none}
.ap-btn.ghost:hover:not(:disabled){border-color:var(--navy);box-shadow:none}
.ap-btn.sm{height:38px;padding:0 16px;font-size:13px}
.ap-pill{display:inline-flex;align-items:center;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:800;letter-spacing:.01em}
.ap-fee{display:flex;gap:14px;align-items:center;flex-wrap:wrap;padding:16px 20px;border-radius:18px;background:linear-gradient(135deg,#FFF6DD,#FBE7AE);border:1px solid #EBD18A;color:#4A3500}
.ap-fee strong{font:700 26px Georgia,serif;color:var(--navy)}
.ap-fee small{display:block;font-size:12px;opacity:.8}
.ap-note{padding:13px 16px;border-radius:14px;font-size:13px;line-height:1.55;border:1px solid}
.ap-note.err{background:#FEF3F2;border-color:#FECDCA;color:var(--bad);font-weight:600}
.ap-note.warn{background:#FFF8EC;border-color:#F2D9A8;color:#8A5A0B}
.ap-photo{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-start;margin-bottom:24px}
.ap-photo-box{width:132px;height:164px;border-radius:18px;border:2px dashed var(--line);background:linear-gradient(160deg,#F8FAFD,#EEF3FA);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#8A98AF;font-size:11.5px;overflow:hidden;flex:0 0 auto}
.ap-photo-box.bad{border-color:var(--bad)}
.ap-photo-box.has{border-style:solid;border-color:var(--gold)}
.ap-photo-box img{width:100%;height:100%;object-fit:cover}
.ap-photo-box svg{width:34px;height:34px;opacity:.6}
.ap-docs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.ap-doc{display:flex;align-items:center;gap:12px;padding:13px 14px;border:1.5px solid var(--line);border-radius:16px;background:#fff;transition:.18s}
.ap-doc.has{border-color:#9AD3B1;background:#F2FBF6}
.ap-doc .ic{flex:0 0 40px;height:40px;border-radius:12px;background:#EAF0F9;color:var(--blue);display:flex;align-items:center;justify-content:center}
.ap-doc.has .ic{background:#DDF3E6;color:var(--good)}
.ap-doc .ic svg{width:20px;height:20px}
.ap-doc .tx{flex:1;min-width:0}
.ap-doc .tx b{display:block;font-size:13.5px;line-height:1.3;color:var(--ink)}
.ap-doc .tx small{display:block;font-size:11.5px;color:#7A8AA3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ap-doc.has .tx small{color:var(--good);font-weight:600}
.ap-up{flex:0 0 auto;padding:8px 14px;border-radius:999px;font-size:12.5px;font-weight:800;cursor:pointer;color:#fff;background:var(--blue);white-space:nowrap}
.ap-doc.has .ap-up{color:var(--blue);background:#fff;border:1.5px solid var(--blue)}
.ap-up.off{opacity:.55;cursor:default}
.ap-rev{display:grid;gap:14px}
.ap-revsec{border:1.5px solid #E3E9F2;border-radius:18px;overflow:hidden}
.ap-revsec header{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;background:#F3F6FB;font-size:11.5px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#42536D}
.ap-revsec header button{border:0;background:none;color:var(--blue);font:700 12.5px inherit;font-family:inherit;cursor:pointer;letter-spacing:0;text-transform:none}
.ap-revsec dl{margin:0;display:grid;grid-template-columns:150px 1fr}
.ap-revsec dt,.ap-revsec dd{margin:0;padding:10px 16px;font-size:13.5px;border-top:1px solid #EDF1F7}
.ap-revsec dt{color:#6B7A92;font-weight:600}
.ap-revsec dd{font-weight:600;color:var(--ink);overflow-wrap:anywhere}
.ap-decl{display:flex;gap:12px;align-items:flex-start;padding:16px 18px;border-radius:16px;background:#FFF8EC;border:1.5px solid #F2D9A8;font-size:13.5px;line-height:1.6;cursor:pointer}
.ap-decl input{width:20px;height:20px;margin-top:2px;accent-color:var(--navy);flex:0 0 auto}
.ap-ref{margin:18px 0;padding:22px 24px;border-radius:20px;text-align:center;color:#fff;background:radial-gradient(120% 160% at 100% 0%,#24508F,#0B1F3A);box-shadow:inset 0 0 0 1px rgba(230,199,122,.35)}
.ap-ref small{display:block;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold2);font-weight:800}
.ap-ref strong{display:block;margin-top:8px;font:700 clamp(30px,7vw,44px)/1 Georgia,serif;letter-spacing:.08em;color:#fff}
.ap-tick{width:64px;height:64px;border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(160deg,#22A35A,var(--good));color:#fff;box-shadow:0 0 0 8px rgba(21,128,61,.12)}
.ap-tick svg{width:32px;height:32px}
.ap-tl{position:relative;margin:6px 0 0;padding-left:26px}
.ap-tl::before{content:"";position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:var(--line)}
.ap-tl li{list-style:none;position:relative;padding:0 0 16px}
.ap-tl li::before{content:"";position:absolute;left:-26px;top:3px;width:16px;height:16px;border-radius:50%;background:#fff;border:3px solid var(--blue)}
.ap-tl b{text-transform:capitalize;font-size:14px}
.ap-tl small{display:block;color:#7A8AA3;font-size:12px;margin-bottom:2px}
.ap-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;padding:13px 0;border-bottom:1px solid #E9EEF5}
.ap-row:last-child{border-bottom:0}
.ap-sum{display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start}
.ap-sum img{width:96px;height:120px;object-fit:cover;border-radius:16px;box-shadow:0 0 0 3px #fff,0 0 0 5px var(--gold),0 12px 22px -10px rgba(15,42,74,.5)}
.ap-lookup{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;align-items:end;margin-top:18px}
@media (max-width:960px){
  .ap-art{height:190px;bottom:84px}
  .ap-hero{min-height:0}
  .ap-hero p{max-width:min(640px,64%)}
  .ap-layout{grid-template-columns:minmax(0,1fr)}
  .ap-rail{display:none}
  .ap-mprog{display:block}
}
@media (max-width:640px){
  .ap-art{display:none}
  .ap-hero p{max-width:none}
  .ap-wrap,.ap-main{padding-left:14px;padding-right:14px}
  .ap-bar{padding:14px 0 6px}
  .ap-nav{width:100%}
  .ap-nav a{flex:1;text-align:center;padding:9px 6px}
  .ap-hero{padding:14px 0 64px}
  .ap-card{border-radius:20px;padding:18px 16px}
  .ap-grid,.ap-docs{grid-template-columns:minmax(0,1fr)}
  .ap-input{font-size:16px}
  .ap-sechead{margin-bottom:18px;padding-bottom:14px}
  .ap-photo{flex-direction:column;align-items:center;text-align:center}
  .ap-revsec dl{grid-template-columns:1fr}
  .ap-revsec dt{padding-bottom:0;border-top:1px solid #EDF1F7;font-size:11.5px;text-transform:uppercase;letter-spacing:.06em}
  .ap-revsec dd{border-top:0;padding-top:2px}
  .ap-actions{position:sticky;bottom:0;margin:24px -16px -18px;padding:12px 16px calc(12px + env(safe-area-inset-bottom));background:rgba(255,255,255,.92);backdrop-filter:blur(10px);border-top:1px solid #E6EBF3;border-radius:0 0 20px 20px;flex-wrap:nowrap;z-index:5}
  .ap-actions .ap-btn{flex:1;padding:0 14px}
  .ap-actions .ap-btn.ghost{flex:0 0 auto}
}
@media (prefers-reduced-motion:reduce){.ap *{transition:none !important}}
`

const ICONS = {
  who: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>,
  fam: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9.5" r="2.4"/><path d="M2.5 20c0-3.6 2.9-5.8 6.5-5.8s6.5 2.2 6.5 5.8M15.5 14.6c3 0 6 1.6 6 5"/></svg>,
  addr: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5h4v5"/></svg>,
  course: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m2.5 9.5 9.5-5 9.5 5-9.5 5z"/><path d="M6.5 12v4.5c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8V12"/></svg>,
  docs: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>,
  rev: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5L16 9.5"/></svg>,
}
const CHECK = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>
const FILE_ICON = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>

function Shell({ title, children, nav, hero }) {
  const inst = getInstitute()
  const here = typeof window !== 'undefined' ? window.location.pathname : ''
  return (
    <div className="ap">
      <style>{PORTAL_CSS}</style>
      <div className="ap-flag" />
      <header className="ap-head">
        <div className="ap-wrap">
          <div className="ap-bar">
            <div className="ap-logo"><img src={gnsiCrest} alt="GNSI" width="52" height="52" /></div>
            <div className="ap-brand"><b>{inst.name || 'GNSI'}</b><span>{title}</span></div>
            <nav className="ap-nav">{(nav || NAV).map(([href, label]) => <a key={href} href={href} className={here.startsWith(href) ? 'on' : ''}>{label}</a>)}</nav>
          </div>
          <div className="ap-hero">{hero}<img className="ap-art" src="/gnsi-logo-10y.webp" alt="Guidance Navodaya & Sainik Institute — celebrating 10 years of success" width="684" height="1100" /></div>
        </div>
      </header>
      <main className="ap-main">{children}</main>
      <footer className="ap-foot">{inst.name}{inst.address ? ` · ${inst.address}` : ''}</footer>
    </div>
  )
}
const Card = ({ children, style, className = '' }) => <section className={`ap-card ${className}`} style={style}>{children}</section>
const Btn = ({ children, onClick, disabled, kind = 'blue', small, style }) => (
  <button type="button" onClick={onClick} disabled={disabled} className={`ap-btn ${kind === 'orange' ? 'orange' : kind === 'ghost' ? 'ghost' : ''} ${small ? 'sm' : ''}`} style={style}>{children}</button>
)
const Hero = ({ eyebrow, title, children }) => (<><div className="ap-eyebrow">{eyebrow}</div><h1>{title}</h1>{children && <p>{children}</p>}</>)

function Field({ label, req, error, hint, children, span }) {
  return (
    <label className={`ap-f${span ? ' full' : ''}`}>
      <span className="l">{label}{req && <em>*</em>}</span>
      {children}
      {hint && !error && <span className="h">{hint}</span>}
      {error && <span className="e">{error}</span>}
    </label>
  )
}

const TONE = { good: ['#E8F7EE', GOOD], warn: ['#FFF4E5', '#B45309'], bad: ['#FEF3F2', BAD], info: ['#E6EEF9', BLUE] }
const Pill = ({ tone = 'info', children }) => <span className="ap-pill" style={{ background: TONE[tone][0], color: TONE[tone][1] }}>{children}</span>

// Reads a chosen file → { data (data URL), name, note }. Photos are shrunk in the browser; PDFs are sent as they are.
async function readUpload(file, kind) {
  if (kind === 'photo') {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG or WebP image.')
    const info = await compressImage(file, { maxDim: 700, quality: 0.86, targetKB: MAX_PHOTO_KB - 40 })
    if (info.file.size > MAX_PHOTO_KB * 1024) throw new Error(`That image is still too large after shrinking (limit ${MAX_PHOTO_KB} KB). Use a smaller picture.`)
    return { data: await toDataUrl(info.file), name: file.name, note: sizeNote(info) }
  }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_DOC_KB * 1024) throw new Error(`PDF is too large (limit ${MAX_DOC_KB} KB). Compress it or upload photos of the pages.`)
    return { data: await toDataUrl(file), name: file.name, note: `${Math.max(1, Math.round(file.size / 1024))} KB` }
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('Use a JPG, PNG, WebP or PDF file.')
  const info = await compressImage(file, { maxDim: 1700, quality: 0.82, targetKB: MAX_DOC_KB - 200 })
  if (info.file.size > MAX_DOC_KB * 1024) throw new Error(`That image is still too large (limit ${MAX_DOC_KB} KB).`)
  return { data: await toDataUrl(info.file), name: file.name, note: sizeNote(info) }
}

// ── Pay panel ───────────────────────────────────────────────────────────────
function PayPanel({ reference, dob, fee, onPaid }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const pay = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await payPortalFee({ reference, dob })
      if (r.paid) { setMsg({ ok: true, text: 'Payment received. Thank you!' }); onPaid?.(r) }
      else if (r.cancelled) setMsg({ ok: false, text: 'Payment window closed — you have not been charged. You can pay any time from the Track application page.' })
      else setMsg({ ok: false, text: 'Payment could not be confirmed. If money was deducted, contact the office with your reference number.' })
    } catch (e) { setMsg({ ok: false, text: e.message }) }
    setBusy(false)
  }
  return (
    <div>
      <Btn kind="orange" onClick={pay} disabled={busy}>{busy ? 'Opening payment…' : `Pay admission fee ${inr(fee)}`}</Btn>
      {msg && <div className={`ap-note ${msg.ok ? 'warn' : 'err'}`} style={{ marginTop: 12, ...(msg.ok ? { background: '#E8F7EE', borderColor: '#B7E2C7', color: GOOD, fontWeight: 600 } : null) }}>{msg.text}</div>}
    </div>
  )
}

// ── Documents: one row per document type, each with its own upload ────────────────
function DocList({ reference, dob, docs, editable, onChange }) {
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const rows = documentStatus(docs)
  const upload = async (type, file) => {
    if (!file) return
    setBusy(type); setErr('')
    try {
      const u = await readUpload(file, 'doc')
      await api('adm-upload', { reference, dob, docType: type, fileName: u.name, file: u.data })
      onChange?.()
    } catch (e) { setErr(e.message) }
    setBusy('')
  }
  const chip = r => (r.state === 'verified' ? <Pill tone="good">Verified</Pill> : r.state === 'uploaded' ? <Pill tone="info">Received — awaiting check</Pill> : r.state === 'rejected' ? <Pill tone="bad">Rejected — upload again</Pill> : <Pill tone={r.required ? 'warn' : 'info'}>{r.required ? 'Required' : 'Optional'}</Pill>)
  return (
    <div>
      {rows.map(r => (
        <div key={r.key} className="ap-row">
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: NAVY }}>{r.label}{r.required && <span style={{ color: BAD }}> *</span>}</div>
            {r.doc?.remark && r.state === 'rejected' && <div style={{ fontSize: 12.5, color: BAD, marginTop: 2 }}>Office note: {r.doc.remark}</div>}
            {r.doc?.file_name && <div style={{ fontSize: 11.5, color: '#7A8AA3' }}>{r.doc.file_name}</div>}
          </div>
          {chip(r)}
          {editable && r.state !== 'verified' && (
            <label className={`ap-up${busy ? ' off' : ''}`}>
              {busy === r.key ? 'Uploading…' : r.state === 'missing' ? 'Upload' : 'Upload another'}
              <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!!busy} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; upload(r.key, f) }} />
            </label>
          )}
        </div>
      ))}
      <div style={{ fontSize: 12, color: '#7A8AA3', marginTop: 10 }}>JPG, PNG, WebP or PDF, up to {MAX_DOC_KB} KB each. Documents marked * are needed before the office can confirm the admission.</div>
      {err && <div className="ap-note err" style={{ marginTop: 10 }}>{err}</div>}
    </div>
  )
}

// ── Receipt ─────────────────────────────────────────────────────────────────
function printReceipt(a) {
  const inst = getInstitute()
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const rows = [['Reference no.', a.reference_no], ['Applicant', a.student_name], ['Course / batch', [a.course, a.batch].filter(Boolean).join(' · ')], ['Hostel', a.hostel_type], ['Session', a.session],
    ['Paid on', fmt(a.fee_paid_on)], ['Payment id', a.payment_id || '—'], ['Mode', a.payment_mode || '—'], ['Amount paid', inr(a.fee_amount)]]
  openPrint(`Payment receipt · ${a.reference_no}`, `
    <div style="max-width:620px;margin:30px auto;font-family:system-ui,sans-serif;color:#1B2A41;border:1px solid #CBD5E3;padding:26px">
      <div style="text-align:center;border-bottom:2px solid #17375E;padding-bottom:12px;margin-bottom:16px">
        <div style="font:700 20px Georgia,serif;color:#17375E">${esc(inst.name || 'GNSI')}</div><div style="font-size:12px;color:#4A5B73">${esc(inst.address || '')}</div>
        <div style="margin-top:8px;font-weight:800;letter-spacing:.1em;font-size:13px">ADMISSION FEE — PAYMENT RECEIPT</div></div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.map(([k, v]) => `<tr><td style="padding:7px 10px;border:1px solid #CBD5E3;background:#F3F6FA;width:36%;font-weight:700">${esc(k)}</td><td style="padding:7px 10px;border:1px solid #CBD5E3">${esc(v)}</td></tr>`).join('')}</table>
      <p style="font-size:12px;color:#4A5B73;margin-top:16px">This is a computer-generated receipt for an online payment and does not need a signature. The admission is confirmed only after the office approves the application.</p>
    </div>`)
}

// ── Status page ─────────────────────────────────────────────────────────────
export function ApplyStatusPage() {
  const qs = new URLSearchParams(window.location.search)
  const [ref, setRef] = useState((qs.get('ref') || '').toUpperCase())
  const [dob, setDob] = useState('')
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const load = async (r = ref, d = dob) => {
    setBusy(true); setErr('')
    try { setData(await api('adm-lookup', { reference: r.trim(), dob: d })) } catch (e) { setData(null); setErr(e.message) }
    setBusy(false)
  }
  const a = data?.application
  const stage = a ? applicantStage(a, data.docs) : null
  return (
    <Shell title="Admission — track your application" nav={NAV}
      hero={<Hero eyebrow="Admission desk" title="Track your application">Enter the reference number you received when you applied and the applicant's date of birth to see your status, documents and payment.</Hero>}>
      <Card>
        <h2 className="ap-h2">Find your application</h2>
        <form onSubmit={e => { e.preventDefault(); load() }} className="ap-lookup">
          <Field label="Reference number"><input className="ap-input" value={ref} onChange={e => setRef(e.target.value.toUpperCase())} placeholder="e.g. AP26-0001" /></Field>
          <Field label="Date of birth"><input type="date" className="ap-input" value={dob} onChange={e => setDob(e.target.value)} /></Field>
          <Btn kind="orange" disabled={busy || !ref || !dob} onClick={() => load()}>{busy ? 'Checking…' : 'Show my application'}</Btn>
        </form>
        {err && <div className="ap-note err" style={{ marginTop: 16 }}>{err}</div>}
      </Card>
      {a && (
        <>
          <Card>
            <div className="ap-sum">
              {data.photo && <img src={data.photo} alt="" />}
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="ap-eyebrow" style={{ color: BLUE }}>Reference {a.reference_no}</div>
                <h2 className="ap-h2" style={{ marginTop: 4 }}>{a.student_name}</h2>
                <div style={{ fontSize: 13.5, color: SUB, marginTop: 4 }}>{a.course} · {a.batch} · {a.hostel_type} · Session {a.session}</div>
                <div style={{ marginTop: 12 }}><Pill tone={stage.tone}>{stage.label}</Pill></div>
                {stage.next && <div style={{ fontSize: 14, marginTop: 10, lineHeight: 1.6 }}>{stage.next}</div>}
              </div>
            </div>
          </Card>
          <Card>
            <h3 className="ap-h3">Admission fee</h3>
            {Number(a.fee_amount) > 0 ? (
              a.fee_status === 'Paid' ? (
                <div>
                  <div style={{ color: GOOD, fontWeight: 800, fontSize: 18, marginTop: 6 }}>✓ {inr(a.fee_amount)} paid on {fmt(a.fee_paid_on)}</div>
                  <div style={{ fontSize: 12.5, color: SUB, margin: '4px 0 14px' }}>Payment id {a.payment_id || '—'}</div>
                  <Btn kind="ghost" small onClick={() => printReceipt(a)}>Print receipt</Btn>
                </div>
              ) : a.fee_status === 'Refund due' || a.fee_status === 'Refunded' ? (
                <div style={{ color: SUB, fontSize: 14 }}>{a.fee_status === 'Refunded' ? `Your ${inr(a.fee_amount)} has been refunded${a.refund_ref ? ` (ref ${a.refund_ref})` : ''}.` : `A refund of ${inr(a.fee_amount)} is being processed by the office.`}</div>
              ) : OPEN_STATUSES.includes(a.status) ? (
                <div className="ap-fee" style={{ marginTop: 10 }}>
                  <div style={{ flex: 1 }}><small>Amount due</small><strong>{inr(a.fee_amount)}</strong></div>
                  <PayPanel reference={a.reference_no} dob={dob} fee={a.fee_amount} onPaid={() => load()} />
                </div>
              ) : <div style={{ color: SUB }}>No payment due.</div>
            ) : <div style={{ color: SUB, fontSize: 14 }}>No admission fee is due online for this application.</div>}
          </Card>
          <Card>
            <h3 className="ap-h3">Documents</h3>
            <DocList reference={a.reference_no} dob={dob} docs={data.docs} editable={OPEN_STATUSES.includes(a.status)} onChange={() => load()} />
          </Card>
          <Card>
            <h3 className="ap-h3" style={{ marginBottom: 14 }}>Timeline</h3>
            {data.events.length === 0 ? <div style={{ color: SUB }}>Nothing yet.</div> : (
              <ul className="ap-tl" style={{ margin: 0 }}>
                {data.events.slice().reverse().map((e, i) => (
                  <li key={i}><small>{fmtTime(e.at)}</small><b>{String(e.action).replace(/_/g, ' ')}</b>{e.detail ? <span style={{ color: SUB }}> — {e.detail}</span> : null} <span style={{ color: '#9AA7BB', fontSize: 12 }}>({e.actor})</span></li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </Shell>
  )
}

// ── Application form ────────────────────────────────────────────────────────
const STEPS = [
  { id: 'who', title: 'Applicant', blurb: 'Tell us about the student who is applying.', keys: ['student_name', 'dob', 'gender', 'category', 'aadhaar'] },
  { id: 'fam', title: 'Parents & contact', blurb: 'Who should we reach about this application?', keys: ['father_name', 'mother_name', 'phone', 'alt_phone', 'email'] },
  { id: 'addr', title: 'Address & school', blurb: 'Where the family lives and the school last attended.', keys: ['address', 'state', 'district', 'pincode', 'prev_school'] },
  { id: 'course', title: 'Course', blurb: 'Choose the programme — the admission fee is shown below.', keys: ['course', 'batch', 'hostel_type'] },
  { id: 'docs', title: 'Photo & documents', blurb: 'A recent photograph and the supporting papers.', keys: ['photo'] },
  { id: 'rev', title: 'Review & submit', blurb: 'Check everything once more before you submit.', keys: ['declared'] },
]

function ApplyPage() {
  const [cfg, setCfg] = useState(null)       // { open, session, options, reason }
  const [loadErr, setLoadErr] = useState('')
  const [f, setF] = useState({ gender: '', category: 'General', state: 'Manipur' })
  const [photo, setPhoto] = useState(null)
  const [docs, setDocs] = useState({})       // docType → { data, name, note }
  const [step, setStep] = useState(0)
  const [shown, setShown] = useState({})
  const [busy, setBusy] = useState('')
  const [serverErr, setServerErr] = useState(null)
  const [fileErr, setFileErr] = useState('')
  const [done, setDone] = useState(null)     // { reference, dob, fee, failed:[labels] }
  useEffect(() => { api('adm-options', null, 'GET').then(setCfg).catch(e => setLoadErr(e.message)) }, [])
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const options = useMemo(() => cfg?.options || [], [cfg])
  const errors = useMemo(() => validateApplication(f, options, { hasPhoto: !!photo }), [f, options, photo])
  const stepErrors = i => STEPS[i].keys.filter(k => errors[k])
  const err = (k, i) => ((shown[i] || shown.all) ? (errors[k] || serverErr?.errors?.[k]) : undefined)

  const courses = [...new Set(options.map(o => o.course))]
  const batches = [...new Set(options.filter(o => o.course === f.course).map(o => o.batch))]
  const hostels = options.filter(o => o.course === f.course && o.batch === f.batch).map(o => o.hostel_type)
  const fee = portalFee(options, f)

  const pick = async (file, kind, key) => {
    setFileErr('')
    if (!file) return
    try { const u = await readUpload(file, kind); if (kind === 'photo') setPhoto(u); else setDocs(d => ({ ...d, [key]: u })) } catch (e) { setFileErr(e.message) }
  }
  const next = () => {
    setShown(s => ({ ...s, [step]: true }))
    if (stepErrors(step).length) return
    setStep(s => Math.min(s + 1, STEPS.length - 1)); window.scrollTo?.({ top: 0, behavior: 'smooth' })
  }
  const submit = async () => {
    setShown({ all: true })
    const first = STEPS.findIndex((_, i) => stepErrors(i).length)
    if (first >= 0) { setStep(first); return }
    setBusy('Submitting your application…'); setServerErr(null)
    try {
      const r = await api('adm-submit', { form: f, photo: photo.data })
      const failed = []
      for (const t of DOC_TYPES) {
        const d = docs[t.key]; if (!d) continue
        setBusy(`Uploading ${t.label}…`)
        try { await api('adm-upload', { reference: r.reference, dob: f.dob, docType: t.key, fileName: d.name, file: d.data }) } catch { failed.push(t.label) }
      }
      setDone({ reference: r.reference, dob: f.dob, fee: r.fee, failed })
    } catch (e) {
      if (e.data?.duplicate) setDone({ reference: e.data.reference, dob: f.dob, fee: 0, duplicate: true, failed: [] })
      else { setServerErr({ error: e.message, errors: e.data?.errors }); if (e.data?.errors) { const i = STEPS.findIndex(s => s.keys.some(k => e.data.errors[k])); if (i >= 0) setStep(i) } }
    }
    setBusy('')
  }

  if (done) {
    return (
      <Shell title="Admission — online application" nav={NAV}
        hero={<Hero eyebrow={done.duplicate ? 'Already applied' : 'All done'} title={done.duplicate ? 'You have already applied' : 'Application submitted'}>Keep your reference number safe — with the applicant's date of birth it is your key to payment, documents and status.</Hero>}>
        <Card style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <div className="ap-tick" style={done.duplicate ? { background: 'linear-gradient(160deg,#F2B04C,#D98A12)', boxShadow: '0 0 0 8px rgba(217,138,18,.14)' } : undefined}>{done.duplicate ? <span style={{ fontSize: 30, fontWeight: 800 }}>!</span> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>}</div>
          <div className="ap-ref"><small>Your reference number</small><strong>{done.reference}</strong></div>
          {done.failed.length > 0 && <div className="ap-note warn" style={{ textAlign: 'left', marginBottom: 16 }}>These documents did not upload: {done.failed.join(', ')}. Add them from the Track application page.</div>}
          {done.fee > 0 && (
            <div className="ap-fee" style={{ textAlign: 'left', marginBottom: 16 }}>
              <div style={{ flex: 1 }}><small>Admission fee</small><strong>{inr(done.fee)}</strong></div>
              <PayPanel reference={done.reference} dob={done.dob} fee={done.fee} onPaid={() => setDone(d => ({ ...d, fee: 0, paid: true }))} />
            </div>
          )}
          {done.paid && <div className="ap-note" style={{ background: '#E8F7EE', borderColor: '#B7E2C7', color: GOOD, fontWeight: 700, marginBottom: 16 }}>Admission fee paid — thank you.</div>}
          <Btn kind="ghost" onClick={() => { window.location.href = `/apply-status?ref=${encodeURIComponent(done.reference)}` }}>Track this application</Btn>
        </Card>
      </Shell>
    )
  }

  const s = STEPS[step]
  const text = (k, label, i, extra = {}) => (
    <Field label={label} req={extra.req !== false} error={err(k, i)} hint={extra.hint} span={extra.span}>
      {extra.area
        ? <textarea rows={3} className={`ap-input${err(k, i) ? ' bad' : ''}`} value={f[k] || ''} onChange={e => set(k, e.target.value)} />
        : <input type={extra.type || 'text'} inputMode={extra.mode} maxLength={extra.max} className={`ap-input${err(k, i) ? ' bad' : ''}`} value={f[k] || ''} max={extra.type === 'date' ? new Date().toLocaleDateString('en-CA') : undefined}
            onChange={e => set(k, extra.digits ? e.target.value.replace(/\D/g, '').slice(0, extra.max || 12) : e.target.value)} />}
    </Field>
  )
  const sel = (k, label, i, opts, extra = {}) => (
    <Field label={label} req={extra.req !== false} error={err(k, i)} hint={extra.hint}>
      <select className={`ap-input${err(k, i) ? ' bad' : ''}`} value={f[k] || ''} onChange={e => extra.onChange ? extra.onChange(e.target.value) : set(k, e.target.value)}>
        <option value="">Select</option>{opts.map(o => <option key={o}>{o}</option>)}
      </select>
    </Field>
  )
  const feeBox = findOption(options, f) && (
    <div className="ap-fee" style={{ gridColumn: '1 / -1' }}>
      <div style={{ flex: 1, minWidth: 180 }}><small>Admission fee · {f.course} · {f.batch} · {f.hostel_type}</small><strong>{fee > 0 ? inr(fee) : 'No online fee'}</strong></div>
      {fee > 0 && <small style={{ maxWidth: 260 }}>Payable securely online right after you submit the form.</small>}
    </div>
  )
  const docTile = (t, has, onFile, label, sub) => (
    <div key={t} className={`ap-doc${has ? ' has' : ''}`}>
      <div className="ic">{has ? CHECK : FILE_ICON}</div>
      <div className="tx"><b>{label}</b><small>{has ? `✓ ${has.name} · ${has.note}` : sub}</small></div>
      <label className="ap-up">{has ? 'Replace' : 'Choose file'}
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" style={{ display: 'none' }} onChange={e => { const x = e.target.files?.[0]; e.target.value = ''; onFile(x) }} />
      </label>
    </div>
  )
  const reviewSections = [
    ['Applicant', 0, [['Name', f.student_name], ['Date of birth', f.dob], ['Gender / category', [f.gender, f.category].filter(Boolean).join(' / ')]]],
    ['Family & contact', 1, [['Father / guardian', f.father_name], ['Mother', f.mother_name], ['Mobile', f.phone], ['Email', f.email]]],
    ['Address & school', 2, [['Address', [f.address, f.district, f.state, f.pincode].filter(Boolean).join(', ')], ['Last school', f.prev_school]]],
    ['Course', 3, [['Programme', [f.course, f.batch, f.hostel_type].filter(Boolean).join(' · ')]]],
    ['Documents', 4, [['Uploaded', Object.keys(docs).map(docLabel).join(', ') || 'None yet — add them later']]],
  ]

  return (
    <Shell title="Admission — online application" nav={NAV}
      hero={<Hero eyebrow={cfg?.open ? `Session ${cfg.session}` : 'Admissions'} title={cfg?.open ? `Admission ${cfg.session}` : 'Online admission'}>Fill the form, upload the documents and pay the admission fee online. Fields marked <b style={{ color: '#FFB4A8' }}>*</b> are required. Already applied? <a href="/apply-status">Track your application</a>.</Hero>}>
      {loadErr && <Card><div className="ap-note err">{loadErr}</div></Card>}
      {!loadErr && !cfg && <Card><div style={{ color: SUB }}>Loading the admission form…</div></Card>}
      {cfg && !cfg.open && <Card><h2 className="ap-h2">Admissions</h2><div className="ap-note warn" style={{ marginTop: 14 }}>{cfg.reason}</div></Card>}
      {cfg?.open && (
        <div className="ap-layout">
          <aside className="ap-rail">
            <div className="ap-steps">
              <h4>Your progress</h4>
              {STEPS.map((x, i) => (
                <button key={x.id} type="button" disabled={i > step} className={`ap-step ${i < step ? 'done' : i === step ? 'on' : 'todo'}`} onClick={() => { if (i <= step) setStep(i) }}>
                  <span className="ap-dot">{i < step ? CHECK : i + 1}</span>
                  <span><b>{x.title}</b><small>{i < step ? 'Completed' : i === step ? 'In progress' : 'Upcoming'}</small></span>
                </button>
              ))}
            </div>
            {fee > 0 && <div className="ap-fee" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}><small>Admission fee</small><strong>{inr(fee)}</strong></div>}
            <div className="ap-help"><b>Need help?</b>Keep the birth certificate, last marksheet and a recent photograph ready. You can add documents later from <i>Track application</i>.</div>
          </aside>

          <Card>
            <div className="ap-mprog">
              <div className="ap-mprog-row"><b>{s.title}</b><span>Step {step + 1} of {STEPS.length}</span></div>
              <div className="ap-track"><i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
            </div>
            <div className="ap-sechead">
              <div className="ap-secico">{ICONS[s.id]}</div>
              <div><h2 className="ap-h2">{s.title}</h2><p className="ap-lead" style={{ marginTop: 3 }}>{s.blurb}</p></div>
            </div>
            {serverErr && <div className="ap-note err" style={{ marginBottom: 18 }}>{serverErr.error}</div>}

            {s.id === 'who' && (
              <div className="ap-grid">
                {text('student_name', "Applicant's full name", 0, { span: true, hint: 'As on the school record / birth certificate' })}
                {text('dob', 'Date of birth', 0, { type: 'date' })}
                {sel('gender', 'Gender', 0, GENDERS)}
                {sel('category', 'Category', 0, CATEGORIES)}
                {text('aadhaar', 'Aadhaar number', 0, { req: false, digits: true, max: 12, mode: 'numeric', hint: 'Optional — only the last 4 digits are kept' })}
                {text('religion', 'Religion', 0, { req: false })}
                {text('mother_tongue', 'Mother tongue', 0, { req: false })}
                {sel('blood_group', 'Blood group', 0, ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], { req: false })}
              </div>
            )}
            {s.id === 'fam' && (
              <div className="ap-grid">
                {text('father_name', "Father's / guardian's name", 1)}
                {text('mother_name', "Mother's name", 1)}
                {text('phone', 'Mobile number', 1, { digits: true, max: 10, mode: 'tel', hint: 'Updates about the application are sent here' })}
                {text('alt_phone', 'Alternate mobile', 1, { req: false, digits: true, max: 10, mode: 'tel' })}
                {text('email', 'Email address', 1, { req: false, type: 'email', span: true })}
              </div>
            )}
            {s.id === 'addr' && (
              <div className="ap-grid">
                {text('address', 'Postal address', 2, { area: true, span: true })}
                {sel('state', 'State', 2, STATES)}
                {text('district', 'District', 2)}
                {text('pincode', 'PIN code', 2, { digits: true, max: 6, mode: 'numeric' })}
                {text('prev_school', 'School last attended', 2, { span: true })}
                {text('prev_class', 'Class last passed', 2, { req: false })}
                {text('prev_percent', 'Marks / percentage', 2, { req: false })}
              </div>
            )}
            {s.id === 'course' && (
              <div className="ap-grid">
                {sel('course', 'Course', 3, courses, { onChange: v => setF(x => ({ ...x, course: v, batch: '', hostel_type: '' })) })}
                {sel('batch', 'Batch / class', 3, batches, { onChange: v => setF(x => ({ ...x, batch: v, hostel_type: '' })) })}
                {sel('hostel_type', 'Day scholar / boarder', 3, hostels)}
                {text('sibling_gcc', 'Sibling GCC no. (if a sibling studies here)', 3, { req: false, digits: true, max: 8 })}
                {options.length === 0 && <div className="ap-note warn full" style={{ gridColumn: '1 / -1' }}>No course is open for online admission yet — please contact the office.</div>}
                {feeBox}
              </div>
            )}
            {s.id === 'docs' && (
              <div>
                <div className="ap-photo">
                  <div className={`ap-photo-box${photo?.data ? ' has' : ''}${err('photo', 4) ? ' bad' : ''}`}>
                    {photo?.data ? <img src={photo.data} alt="" /> : <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>No photo yet</>}
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="ap-f"><span className="l">Passport-size photograph<em>*</em></span></div>
                    <p className="ap-lead" style={{ margin: '0 0 12px' }}>{photo?.note || `JPG/PNG, shrunk automatically to under ${MAX_PHOTO_KB} KB. Recent, plain background, face clearly visible.`}</p>
                    <label className="ap-btn sm" style={{ cursor: 'pointer' }}>{photo ? 'Replace photo' : 'Choose photo'}
                      <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { const x = e.target.files?.[0]; e.target.value = ''; pick(x, 'photo') }} />
                    </label>
                    {err('photo', 4) && <div style={{ fontSize: 12.5, color: BAD, fontWeight: 600, marginTop: 8 }}>{err('photo', 4)}</div>}
                  </div>
                </div>
                <div className="ap-f"><span className="l">Documents <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: '#7A8AA3' }}>— upload now, or later from Track application</span></span></div>
                <div className="ap-docs">
                  {DOC_TYPES.map(t => docTile(t.key, docs[t.key], x => pick(x, 'doc', t.key), <>{t.label}{t.required && <span style={{ color: BAD }}> *</span>}</>, 'JPG, PNG, WebP or PDF'))}
                </div>
                {fileErr && <div className="ap-note err" style={{ marginTop: 14 }}>{fileErr}</div>}
              </div>
            )}
            {s.id === 'rev' && (
              <div className="ap-rev">
                {photo?.data && <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><img src={photo.data} alt="" style={{ width: 72, height: 90, objectFit: 'cover', borderRadius: 14, boxShadow: '0 0 0 2px #fff,0 0 0 4px #C9A24B' }} /><div><div style={{ fontWeight: 800, fontSize: 18, fontFamily: 'Georgia,serif', color: NAVY }}>{f.student_name}</div><div style={{ fontSize: 13, color: SUB }}>{[f.course, f.batch].filter(Boolean).join(' · ')}</div></div></div>}
                {reviewSections.map(([title, i, rows]) => (
                  <div key={title} className="ap-revsec">
                    <header><span>{title}</span><button type="button" onClick={() => setStep(i)}>Edit</button></header>
                    <dl>{rows.map(([k, v]) => <Fragment key={k}><dt>{k}</dt><dd>{v || '—'}</dd></Fragment>)}</dl>
                  </div>
                ))}
                {fee > 0 && <div className="ap-fee"><div style={{ flex: 1 }}><small>Admission fee payable online</small><strong>{inr(fee)}</strong></div></div>}
                <label className="ap-decl">
                  <input type="checkbox" checked={!!f.declared} onChange={e => set('declared', e.target.checked)} />
                  <span>I declare that the information given is true and correct. I understand that a false statement can lead to cancellation of the admission, and that the admission is confirmed only after the institute verifies my documents and approves the application.</span>
                </label>
                {err('declared', 5) && <div style={{ color: BAD, fontSize: 12.5, fontWeight: 600 }}>{err('declared', 5)}</div>}
              </div>
            )}

            <div className="ap-actions">
              <Btn kind="ghost" disabled={step === 0 || !!busy} onClick={() => setStep(x => Math.max(0, x - 1))}>← Back</Btn>
              {busy && <span style={{ fontSize: 13, color: SUB, fontWeight: 600 }}>{busy}</span>}
              {step < STEPS.length - 1 ? <Btn onClick={next}>Save &amp; next →</Btn> : <Btn kind="orange" disabled={!!busy} onClick={submit}>{fee > 0 ? 'Submit & continue to payment' : 'Submit application'}</Btn>}
            </div>
          </Card>
        </div>
      )}
    </Shell>
  )
}

export default function AdmissionPortalPublic({ page }) {
  const [, setTick] = useState(0)
  useEffect(() => { loadSystemSettings().then(() => setTick(t => t + 1)).catch(() => {}) }, [])
  return page === 'apply-status' ? <ApplyStatusPage /> : <ApplyPage />
}

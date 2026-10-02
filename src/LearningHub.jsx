// ─── LearningHub.jsx ─────────────────────────────────────────────────────────
// ONE module for everything academic-content: Study Materials, Teaching Aids,
// Question Bank, Question Bank Viewer and Entrance Exam are tabs of this page
// (sidebar id 'learninghub'), laid out as a flow:
//   Learn (Study Materials · Teaching Aids) → Practice (Question Bank · Viewer) → Assess (Entrance Exam)
// • a premium ribbon is the tab bar, with a live count on every tab (refreshes
//   when a question/material is saved anywhere);
// • "Connected to this page" cards link each tab to the ones it feeds / is fed by;
// • tabs keep their state while you switch (a visited tab stays mounted, hidden),
//   so a half-written question or an open filter is not lost;
// • each tab keeps its own permission key (questionbank, entrance, …), so role
//   settings still decide who sees which tab.
// Styled with the portal's premiumUI tokens (navy + antique gold).
import { lazy, Suspense, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { NavIcon } from './navIcons';
import { PX } from './premiumUI';
import { EventBus, GNSI_EVENTS } from './EventBus';
import { HUB_TABS } from './learningHubTabs';

const StudyMaterial = lazy(() => import('./StudyMaterial'));
const TeachingAids = lazy(() => import('./TeachingAids'));
const QuestionBank = lazy(() => import('./QuestionBank'));
const QuestionBankViewer = lazy(() => import('./QuestionBankViewer'));
const Entrance = lazy(() => import('./Entrance'));

const MODULES = {
  studymaterial:      { label: 'Study Materials',      short: 'Materials',  metric: 'materials', unit: 'materials' },
  teachingaids:       { label: 'Teaching Aids',        short: 'Aids',       metric: 'aids',      unit: 'aids' },
  questionbank:       { label: 'Question Bank',        short: 'Bank',       metric: 'questions', unit: 'questions' },
  questionbankviewer: { label: 'Question Bank Viewer', short: 'Viewer',     metric: 'questions', unit: 'questions' },
  entrance:           { label: 'Entrance Exam',        short: 'Entrance',   metric: 'exams',     unit: 'exams' },
};

const FLOW = [
  { stage: 'Learn', ids: ['studymaterial', 'teachingaids'] },
  { stage: 'Practice', ids: ['questionbank', 'questionbankviewer'] },
  { stage: 'Assess', ids: ['entrance'] },
];

// For each module: the other modules it connects to, and why.
const RELATED = {
  questionbank: [
    { to: 'questionbankviewer', title: 'Student view', hint: 'See the bank exactly as students see it' },
    { to: 'studymaterial', title: 'Chapter materials', hint: 'Notes and lessons behind these questions' },
    { to: 'entrance', title: 'Entrance papers', hint: 'Entrance question papers are drawn from this bank' },
  ],
  questionbankviewer: [
    { to: 'questionbank', title: 'Edit & add questions', hint: 'Open the full Question Bank to change or add' },
    { to: 'studymaterial', title: 'Revise the chapter', hint: 'Jump to the study material for what you are viewing' },
    { to: 'entrance', title: 'Entrance exams', hint: 'Use these questions in an entrance paper' },
  ],
  entrance: [
    { to: 'questionbank', title: 'Question source', hint: 'Papers are generated from the Question Bank' },
    { to: 'questionbankviewer', title: 'Preview questions', hint: 'Browse the questions a paper can draw on' },
    { to: 'studymaterial', title: 'Prepare candidates', hint: 'Study materials for the entrance syllabus' },
  ],
  studymaterial: [
    { to: 'questionbank', title: 'Practice questions', hint: 'Question Bank questions for the same chapters' },
    { to: 'teachingaids', title: 'Teaching aids', hint: 'Books and aids to teach from' },
    { to: 'questionbankviewer', title: 'Test yourself', hint: 'Read-only question view for revision' },
  ],
  teachingaids: [
    { to: 'studymaterial', title: 'Study materials', hint: 'Chapter notes that go with these aids' },
    { to: 'questionbank', title: 'Practice questions', hint: 'Question Bank for the same subjects' },
    { to: 'entrance', title: 'Entrance exams', hint: 'Where the learning is assessed' },
  ],
};

// ── live counts (shared + cached, so five screens do not each re-query) ──────
const TABLES = { questions: 'qbank_questions', materials: 'study_materials', aids: 'teaching_aids', exams: 'entrance_exams' };
let cache = { at: 0, data: {}, pending: null };
async function countOf(table) {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    return error ? null : count ?? null;
  } catch { return null; }
}
function loadCounts(force = false) {
  if (!force && cache.pending) return cache.pending;
  if (!force && Date.now() - cache.at < 60000 && Object.keys(cache.data).length) return Promise.resolve(cache.data);
  cache.pending = Promise.all(Object.entries(TABLES).map(async ([k, t]) => [k, await countOf(t)])).then((pairs) => {
    cache = { at: Date.now(), data: Object.fromEntries(pairs), pending: null };
    return cache.data;
  });
  return cache.pending;
}
function useLearningCounts() {
  const [counts, setCounts] = useState(cache.data);
  useEffect(() => {
    let live = true;
    const refresh = (force) => loadCounts(force).then((d) => { if (live) setCounts({ ...d }); });
    refresh(false);
    const offs = [GNSI_EVENTS.QUESTION_SAVED, GNSI_EVENTS.MATERIAL_SAVED].map((ev) => EventBus.on(ev, () => refresh(true)));
    return () => { live = false; offs.forEach((o) => o && o()); };
  }, []);
  return counts;
}
const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('en-IN'));

const CSS = `
.lh-root{--lh-navy:${PX.navy};--lh-gold:${PX.gold};font-family:${PX.sans}}
.lh-wrap{padding:16px 24px 0}
.lh-title{display:flex;align-items:center;gap:12px;margin:0 2px 12px;flex-wrap:wrap}
.lh-title-ico{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:${PX.goldLt};box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 8px 16px -8px rgba(19,42,79,.6)}
.lh-title-e{font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${PX.gold}}
.lh-title-t{font-family:${PX.serif};font-size:22px;font-weight:600;color:${PX.ink};line-height:1.1}
.lh-title-s{font-size:12.5px;color:${PX.sub};margin-left:auto}
@media (max-width:640px){.lh-title-s{display:none}.lh-title-t{font-size:19px}}
.lh-ribbon{display:flex;align-items:stretch;gap:0;background:#fff;border:1px solid ${PX.line};border-radius:18px;padding:8px;box-shadow:0 1px 2px rgba(19,42,79,.05),0 14px 30px -22px rgba(19,42,79,.4);overflow-x:auto;scrollbar-width:none}
.lh-ribbon::-webkit-scrollbar{display:none}
.lh-stage{display:flex;flex-direction:column;gap:5px;padding:2px 10px 4px;flex:0 0 auto;position:relative}
.lh-stage + .lh-stage{border-left:1px dashed ${PX.line2}}
.lh-stage + .lh-stage::before{content:'';position:absolute;left:-6px;top:50%;width:11px;height:11px;margin-top:-1px;border-radius:50%;background:#fff;border:1px solid ${PX.line2};box-shadow:inset 0 0 0 3px ${PX.goldBg}}
.lh-stage-h{font-size:9.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${PX.gold};padding-left:4px}
.lh-pills{display:flex;gap:6px}
.lh-pill{position:relative;display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 13px 0 11px;border:1px solid ${PX.line};border-radius:13px;background:linear-gradient(180deg,#fff,#faf8f3);color:${PX.ink2};font:700 12.5px/1 ${PX.sans};cursor:pointer;white-space:nowrap;transition:transform .09s ease,box-shadow .12s ease,border-color .12s ease,background .12s ease;box-shadow:0 2px 0 ${PX.line}}
.lh-pill:hover{transform:translateY(-1px);border-color:${PX.goldLine};box-shadow:0 4px 0 ${PX.goldLine},0 10px 16px -10px rgba(19,42,79,.3)}
.lh-pill:active{transform:translateY(1px);box-shadow:inset 0 2px 4px rgba(19,42,79,.18)}
.lh-pill:focus-visible{outline:2px solid ${PX.gold};outline-offset:2px}
.lh-pill svg{color:${PX.gold}}
.lh-pill .lh-n{font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:99px;background:${PX.goldBg};color:#7a5a12;font-variant-numeric:tabular-nums}
.lh-pill.on{color:#fff;border-color:#0e203f;background:linear-gradient(180deg,${PX.navy2},${PX.navy});box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 3px 0 ${PX.navyDeep},0 10px 18px -8px rgba(19,42,79,.6)}
.lh-pill.on svg{color:${PX.goldLt}}
.lh-pill.on .lh-n{background:rgba(233,217,176,.2);color:${PX.goldLt}}
.lh-links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
.lh-link{display:flex;align-items:center;gap:12px;text-align:left;padding:10px 12px;border-radius:14px;border:1px solid ${PX.line};background:#fff;cursor:pointer;font-family:${PX.sans};color:${PX.ink};transition:transform .1s ease,box-shadow .12s ease,border-color .12s ease;min-width:0}
.lh-link:hover{transform:translateY(-2px);border-color:${PX.goldLine};box-shadow:0 12px 24px -16px rgba(19,42,79,.45)}
.lh-link:focus-visible{outline:2px solid ${PX.gold};outline-offset:2px}
.lh-link-ico{width:38px;height:38px;border-radius:11px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:${PX.goldLt};box-shadow:inset 0 1px 0 rgba(255,255,255,.2)}
.lh-link-t{font-weight:800;font-size:13px;line-height:1.2;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.lh-link-t i{font-style:normal;font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:99px;background:${PX.goldBg};color:#7a5a12}
.lh-link-d{font-size:11.5px;color:${PX.sub};margin-top:2px;line-height:1.3}
.lh-link-go{margin-left:auto;color:${PX.gold};flex-shrink:0}
@media (max-width:900px){.lh-links{grid-template-columns:1fr}}
@media (min-width:641px){.lh-ribbon{flex-wrap:wrap;overflow-x:visible;row-gap:10px}.lh-stage + .lh-stage{border-left:0}.lh-stage + .lh-stage::before{display:none}.lh-stage{padding:2px 12px 4px 4px}}
@media (max-width:640px){
  .lh-wrap{padding:10px 12px 0}
  .lh-pill{height:40px;padding:0 11px 0 9px}
  .lh-pill:not(.on) .lh-label-long{display:none}
  .lh-links{display:flex;overflow-x:auto;gap:8px;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin:8px -12px 0;padding:2px 12px 4px}
  .lh-links::-webkit-scrollbar{display:none}
  .lh-link{flex:0 0 auto;padding:8px 12px 8px 8px;gap:9px}
  .lh-link-d,.lh-link-go{display:none}
  .lh-link-ico{width:32px;height:32px;border-radius:10px}
}
`;

const HOME_CSS = `
.lhp{max-width:980px;margin:0 auto;padding-bottom:28px}
.lhp-hero{position:relative;overflow:hidden;background:radial-gradient(90% 140% at 100% 0%,rgba(184,146,58,.30) 0%,transparent 55%),linear-gradient(135deg,${PX.navyDeep} 0%,${PX.navy} 45%,${PX.navy2} 100%);padding:18px 18px 60px;border-radius:0 0 26px 26px;color:#fff}
.lhp-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,${PX.gold},transparent)}
.lhp-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.lhp-logo{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12);color:${PX.goldLt};box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.lhp-t{font-family:${PX.serif};font-size:27px;font-weight:600;line-height:1.1}
.lhp-t span{color:${PX.goldLt}}
.lhp-s{font-size:12px;opacity:.72;margin-top:3px;font-weight:500}
.lhp-search{display:flex;align-items:center;gap:10px;background:#fff;color:${PX.sub};border-radius:14px;padding:0 14px;height:46px;box-shadow:0 8px 20px -10px rgba(0,0,0,.5)}
.lhp-search input{flex:1;min-width:0;border:0;outline:0;background:none;font:500 14px ${PX.sans};color:${PX.ink}}
.lhp-clear{border:0;background:none;color:${PX.faint};font-size:14px;cursor:pointer;padding:4px}
.lhp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:-42px 16px 14px;position:relative}
.lhp-stat{background:#fff;border-radius:16px;padding:12px 6px;text-align:center;box-shadow:0 4px 16px rgba(19,42,79,.12)}
.lhp-stat b{display:block;font-size:20px;font-weight:800;color:${PX.navy};line-height:1.1;font-variant-numeric:tabular-nums}
.lhp-stat span{font-size:10px;font-weight:700;color:${PX.sub};text-transform:uppercase;letter-spacing:.05em}
.lhp-card{background:#fff;border-radius:18px;margin:0 16px 14px;padding:14px 12px 8px;box-shadow:0 2px 12px rgba(19,42,79,.07);border:1px solid ${PX.line}}
.lhp-card-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:${PX.ink};padding:0 4px 10px}
.lhp-card-h i{width:4px;height:16px;border-radius:2px;display:inline-block}
.lhp-card-h small{margin-left:auto;font-size:11px;font-weight:600;color:${PX.faint}}
.lhp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:4px 2px}
.lhp-tile{background:none;border:0;padding:6px 2px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;color:${PX.ink};border-radius:12px;font-family:${PX.sans};text-align:center}
.lhp-tile:active{background:${PX.tint}}
.lhp-tile:focus-visible,.lhp-qb:focus-visible,.lhp-promo:focus-visible{outline:2px solid ${PX.gold};outline-offset:2px}
.lhp-ico{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 3px 0 rgba(19,42,79,.12),0 7px 12px rgba(19,42,79,.10);transition:transform .09s ease,box-shadow .09s ease}
.lhp-tile:hover .lhp-ico{transform:translateY(-2px)}
.lhp-tile:active .lhp-ico{transform:translateY(2px);box-shadow:inset 0 2px 4px rgba(19,42,79,.18)}
.lhp-lbl{font-size:12px;font-weight:700;line-height:1.2}
.lhp-cnt{font-size:10.5px;font-weight:700;color:${PX.faint};margin-top:-3px}
.lhp-quick{display:flex;justify-content:space-around;gap:4px;padding:14px 8px 12px;overflow-x:auto;scrollbar-width:none}
.lhp-quick::-webkit-scrollbar{display:none}
.lhp-qb{background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:7px;cursor:pointer;font:700 11px/1.2 ${PX.sans};color:${PX.ink};text-align:center;min-width:62px}
.lhp-round{width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;background-image:linear-gradient(180deg,rgba(255,255,255,.32),rgba(255,255,255,0) 55%,rgba(0,0,0,.12));box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 3px 0 rgba(0,0,0,.18),0 8px 14px -6px rgba(19,42,79,.5);transition:transform .09s ease}
.lhp-qb:active .lhp-round{transform:translateY(2px)}
.lhp-promo{width:calc(100% - 32px);margin:0 16px 14px;border:0;border-radius:18px;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;cursor:pointer;color:#fff;font-family:${PX.sans};background:radial-gradient(90% 140% at 100% 0%,rgba(184,146,58,.45) 0%,transparent 60%),linear-gradient(135deg,${PX.navyDeep},${PX.navy2});box-shadow:0 10px 22px -12px rgba(19,42,79,.7)}
.lhp-promo em{font-style:normal;font-size:10px;font-weight:800;letter-spacing:.12em;background:linear-gradient(180deg,#d4ae58,${PX.gold});color:#1a1406;padding:2px 9px;border-radius:999px}
.lhp-promo b{display:block;font-size:17px;margin:6px 0 3px}
.lhp-promo span{font-size:12px;opacity:.9;line-height:1.35;display:block}
.lhp-promo .lhp-promo-ico{display:flex;flex-shrink:0;color:${PX.goldLt}}
.lhp-empty{text-align:center;color:${PX.sub};font-size:13px;padding:14px 0 18px}
.lhp-bar{display:none}
.lhp-bottom{display:none}
@media (max-width:767px){
  .lhp-bar{display:flex;align-items:center;gap:8px;padding:8px 12px 8px 6px;background:#fff;border-bottom:1px solid ${PX.line};box-shadow:0 2px 10px rgba(19,42,79,.06)}
  .lhp-back{width:38px;height:38px;border:0;background:none;font-size:30px;line-height:1;color:${PX.navy};cursor:pointer;border-radius:50%}
  .lhp-back:active{background:${PX.tint}}
  .lhp-bar-t{min-width:0;display:flex;flex-direction:column}
  .lhp-bar-t b{font-size:16px;font-weight:800;color:${PX.ink};white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .lhp-bar-t small{font-size:11px;color:${PX.sub}}
  .lhp-bar-ico{display:flex;color:${PX.navy}}
  .lhp-bottom{display:grid;position:fixed;left:0;right:0;bottom:0;z-index:90;grid-template-columns:repeat(var(--n),1fr);background:${PX.navy};box-shadow:0 -8px 24px rgba(11,30,61,.4);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .lhp-nb{background:none;border:0;display:flex;flex-direction:column;align-items:center;gap:3px;padding:3px 0;font:600 10.5px ${PX.sans};color:#b9c3d6;cursor:pointer}
  .lhp-nb .lhp-bi{display:flex;align-items:center;justify-content:center;width:42px;height:27px;border-radius:10px}
  .lhp-nb.on{color:#fff;font-weight:800}
  .lhp-nb.on .lhp-bi{background:linear-gradient(180deg,#d4ae58,${PX.gold});color:#1a1406;box-shadow:inset 0 1px 0 rgba(255,255,255,.45),0 4px 10px -4px rgba(184,146,58,.8)}
  .lhp-tabs-pad{padding-bottom:78px}
  .lh-desk{display:none!important}
}
@media (max-width:520px){.lhp-stats{gap:7px;margin-left:12px;margin-right:12px}.lhp-stat{padding:10px 2px}.lhp-stat b{font-size:17px}.lhp-stat span{font-size:9px;letter-spacing:.02em}.lhp-t{font-size:24px}}
@media (min-width:768px){.lhp-hero{border-radius:22px;margin:16px 16px 0}}
`;

const STAGE_COLOR = { Learn: '#185FA5', Practice: '#a7771f', Assess: '#0f766e' };
const tint = (hex, a = '1F') => `${hex}${a}`;

function HubTile({ id, color, counts, onNavigate }) {
  const m = MODULES[id];
  return (
    <button className="lhp-tile" onClick={() => onNavigate(id)}>
      <span className="lhp-ico" style={{ background: tint(color), color }}><NavIcon id={id} size={24} /></span>
      <span className="lhp-lbl">{m.label}</span>
      <span className="lhp-cnt">{fmt(counts[m.metric])} {m.unit}</span>
    </button>
  );
}

function HubHome({ visible, counts, onNavigate }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const stages = FLOW.map((st) => ({ ...st, color: STAGE_COLOR[st.stage], ids: st.ids.filter((id) => visible.includes(id)) })).filter((st) => st.ids.length);
  const flat = stages.flatMap((st) => st.ids.map((id) => ({ id, color: st.color, stage: st.stage })));
  const hits = needle ? flat.filter(({ id, stage }) => `${MODULES[id].label} ${MODULES[id].unit} ${stage}`.toLowerCase().includes(needle)) : null;
  const promoTo = ['entrance', 'questionbank'].find((id) => visible.includes(id));
  const stats = [['Materials', counts.materials], ['Aids', counts.aids], ['Questions', counts.questions], ['Exams', counts.exams]];
  return (
    <div className="lhp">
      <div className="lhp-hero">
        <div className="lhp-top">
          <span className="lhp-logo"><NavIcon id="learninghub" size={22} /></span>
          <div>
            <div className="lhp-t">Learning <span>Hub</span></div>
            <div className="lhp-s">Study · Practise · Assess — one connected place</div>
          </div>
        </div>
        <label className="lhp-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search materials, questions, exams…" />
          {q ? <button type="button" className="lhp-clear" onClick={() => setQ('')} aria-label="Clear search">✕</button> : null}
        </label>
      </div>
      <div className="lhp-stats">
        {stats.map(([l, v]) => <div key={l} className="lhp-stat"><b>{fmt(v)}</b><span>{l}</span></div>)}
      </div>
      {hits ? (
        <div className="lhp-card">
          <div className="lhp-card-h">{hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'Nothing found'}</div>
          {hits.length
            ? <div className="lhp-grid">{hits.map((t) => <HubTile key={t.id} id={t.id} color={t.color} counts={counts} onNavigate={onNavigate} />)}</div>
            : <div className="lhp-empty">Try “questions”, “exam” or “materials”.</div>}
        </div>
      ) : (
        <>
          <div className="lhp-card lhp-quick">
            {flat.map(({ id, color }) => (
              <button key={id} className="lhp-qb" onClick={() => onNavigate(id)}>
                <span className="lhp-round" style={{ background: color }}><NavIcon id={id} size={24} /></span>
                <span>{MODULES[id].short}</span>
              </button>
            ))}
          </div>
          {promoTo ? (
            <button className="lhp-promo" onClick={() => onNavigate(promoTo)}>
              <div>
                <em>CONNECTED</em>
                <b>Notes → Questions → Entrance papers</b>
                <span>Every section links to the next, so a chapter flows from learning to assessment.</span>
              </div>
              <span className="lhp-promo-ico"><NavIcon id={promoTo} size={44} /></span>
            </button>
          ) : null}
          {stages.map((st) => (
            <div key={st.stage} className="lhp-card">
              <div className="lhp-card-h"><i style={{ background: st.color }} />{st.stage}<small>{st.ids.length} section{st.ids.length > 1 ? 's' : ''}</small></div>
              <div className="lhp-grid">{st.ids.map((id) => <HubTile key={id} id={id} color={st.color} counts={counts} onNavigate={onNavigate} />)}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function HubBar({ active, onHome }) {
  return (
    <div className="lhp-bar">
      <button className="lhp-back" onClick={onHome} aria-label="Back to Learning Hub">‹</button>
      <span className="lhp-bar-ico"><NavIcon id={active} size={20} /></span>
      <div className="lhp-bar-t"><b>{MODULES[active].label}</b><small>Learning Hub</small></div>
    </div>
  );
}

function HubBottom({ visible, active, onNavigate }) {
  return (
    <nav className="lhp-bottom" style={{ '--n': visible.length }} aria-label="Learning Hub sections">
      {visible.map((id) => (
        <button key={id} className={`lhp-nb${active === id ? ' on' : ''}`} onClick={() => onNavigate(id)} aria-current={active === id ? 'page' : undefined}>
          <span className="lhp-bi"><NavIcon id={id} size={20} /></span>
          <span>{MODULES[id].short}</span>
        </button>
      ))}
    </nav>
  );
}

export function LearningRibbon({ active, onNavigate, counts, visible }) {
  return (
    <nav className="lh-ribbon" aria-label="Learning flow">
      {FLOW.map((st) => ({ ...st, ids: st.ids.filter((id) => !visible || visible.includes(id)) })).filter((st) => st.ids.length).map((st) => (
        <div key={st.stage} className="lh-stage">
          <div className="lh-stage-h">{st.stage}</div>
          <div className="lh-pills">
            {st.ids.map((id) => {
              const m = MODULES[id];
              return (
                <button key={id} className={`lh-pill${active === id ? ' on' : ''}`} onClick={() => active !== id && onNavigate && onNavigate(id)} aria-current={active === id ? 'page' : undefined} title={m.label}>
                  <NavIcon id={id} size={17} />
                  <span><span className="lh-label-long">{m.label}</span></span>
                  <span className="lh-n" title={`${fmt(counts[m.metric])} ${m.unit}`}>{fmt(counts[m.metric])}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function LearningLinks({ active, onNavigate, counts, visible }) {
  const rel = (RELATED[active] || []).filter((r) => !visible || visible.includes(r.to));
  if (!rel.length || !onNavigate) return null;
  return (
    <div className="lh-links" aria-label="Connected to this page">
      {rel.map((r) => {
        const m = MODULES[r.to];
        return (
          <button key={r.to} className="lh-link" onClick={() => onNavigate(r.to)}>
            <span className="lh-link-ico"><NavIcon id={r.to} size={19} /></span>
            <span style={{ minWidth: 0 }}>
              <span className="lh-link-t">{r.title}<i>{fmt(counts[m.metric])} {m.unit}</i></span>
              <span className="lh-link-d" style={{ display: 'block' }}>{r.hint}</span>
            </span>
            <span className="lh-link-go"><NavIcon id="chevron" size={18} /></span>
          </button>
        );
      })}
    </div>
  );
}

const Loading = () => (
  <div style={{ padding: '60px 20px', textAlign: 'center', color: PX.sub, fontFamily: PX.sans, fontSize: 13 }}>Loading…</div>
);

// tab: active tab id (controlled by App so links from other modules can open a
// specific tab); onNavigate(id): App's router (tab ids stay inside the hub).
// perms(key) / canAccess(key): the signed-in user's rights per tab module.
export default function LearningHub({ currentUser, tab, home = false, onHome, onNavigate, perms, canAccess }) {
  const counts = useLearningCounts();
  const visible = HUB_TABS.filter((id) => !canAccess || canAccess(id));
  const active = visible.includes(tab) ? tab : visible[0];
  // tabs stay mounted once opened (hidden when inactive) so their state survives switching
  const [opened, setOpened] = useState(() => new Set(active ? [active] : []));
  if (active && !opened.has(active)) setOpened(new Set(opened).add(active)); // derived state: adjust during render
  const showHome = home && !!onHome;
  if (!active) return <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>You do not have access to any Learning Hub section.</div>;

  const view = (id) => {
    const common = { currentUser, onNavigate };
    switch (id) {
      case 'studymaterial': return <StudyMaterial {...common} perms={perms('studymaterial')} />;
      case 'teachingaids': return <TeachingAids {...common} perms={perms('teachingaids')} />;
      case 'questionbank': return <QuestionBank {...common} perms={perms('questionbank')} />;
      case 'questionbankviewer': return <QuestionBankViewer {...common} />;
      case 'entrance': return <Entrance {...common} perms={perms('entrance')} />;
      default: return null;
    }
  };

  return (
    <div className="lh-root">
      <style>{CSS}</style>
      <style>{HOME_CSS}</style>
      {showHome ? <HubHome visible={visible} counts={counts} onNavigate={onNavigate} /> : <HubBar active={active} onHome={onHome || (() => {})} />}
      <div className="lh-wrap" style={showHome ? { display: 'none' } : undefined}>
        <div className="lh-title lh-desk">
          <span className="lh-title-ico"><NavIcon id="learninghub" size={18} /></span>
          <div>
            <div className="lh-title-e">GNSI · Academics</div>
            <div className="lh-title-t">Learning Hub</div>
          </div>
          <div className="lh-title-s">Study · Practise · Assess — one connected place</div>
        </div>
        <div className="lh-desk"><LearningRibbon active={active} onNavigate={onNavigate} counts={counts} visible={visible} /></div>
        <LearningLinks active={active} onNavigate={onNavigate} counts={counts} visible={visible} />
      </div>
      {visible.filter((id) => opened.has(id)).map((id) => (
        <div key={id} className="lhp-tabs-pad" style={{ display: !showHome && id === active ? 'block' : 'none' }}>
          <Suspense fallback={<Loading />}>{view(id)}</Suspense>
        </div>
      ))}
      {!showHome ? <HubBottom visible={visible} active={active} onNavigate={onNavigate} /> : null}
    </div>
  );
}

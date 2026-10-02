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
export default function LearningHub({ currentUser, tab, onNavigate, perms, canAccess }) {
  const counts = useLearningCounts();
  const visible = HUB_TABS.filter((id) => !canAccess || canAccess(id));
  const active = visible.includes(tab) ? tab : visible[0];
  // tabs stay mounted once opened (hidden when inactive) so their state survives switching
  const [opened, setOpened] = useState(() => new Set(active ? [active] : []));
  if (active && !opened.has(active)) setOpened(new Set(opened).add(active)); // derived state: adjust during render
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
      <div className="lh-wrap">
        <div className="lh-title">
          <span className="lh-title-ico"><NavIcon id="learninghub" size={18} /></span>
          <div>
            <div className="lh-title-e">GNSI · Academics</div>
            <div className="lh-title-t">Learning Hub</div>
          </div>
          <div className="lh-title-s">Study · Practise · Assess — one connected place</div>
        </div>
        <LearningRibbon active={active} onNavigate={onNavigate} counts={counts} visible={visible} />
        <LearningLinks active={active} onNavigate={onNavigate} counts={counts} visible={visible} />
      </div>
      {visible.filter((id) => opened.has(id)).map((id) => (
        <div key={id} style={{ display: id === active ? 'block' : 'none' }}>
          <Suspense fallback={<Loading />}>{view(id)}</Suspense>
        </div>
      ))}
    </div>
  );
}

// ─── LearningHub.jsx ─────────────────────────────────────────────────────────
// ONE module for everything academic-content: Study Materials, Teaching Aids, Study Lockers,
// Question Bank, Question Bank Viewer, Entrance Exam, Model Sets and Model Set Maker are tabs of this page
// (sidebar id 'learninghub'); Study Materials, Class Material, Teaching Aids and Study Lockers are presented as ONE
// "Study Library" entry with a Notes · Class · Aids · Lockers switcher. Laid out as a flow:
//   Learn (Study Materials · Teaching Aids · Study Lockers) → Practice (Question Bank · Viewer) → Test (Entrance Exam · Model Sets · Model Set Maker)
// • it opens on an icon page of the sections (phones and computers); inside a
//   section, "‹ All sections" (computers) or the back arrow (phones) returns there;
// • a premium ribbon is the tab bar, with a live count on every tab (refreshes
//   when a question/material is saved anywhere);
// • no extra link cards: the section icons and the ribbon are the only navigation;
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
const StudyLockers = lazy(() => import('./StudyLockers'));
const QuestionBank = lazy(() => import('./QuestionBank'));
const QuestionBankViewer = lazy(() => import('./QuestionBankViewer'));
const Entrance = lazy(() => import('./Entrance'));
const ModelSets = lazy(() => import('./ModelSets'));
const SetMaker = lazy(() => import('./SetMaker'));
const ClassMaterial = lazy(() => import('./ClassMaterial'));

const MODULES = {
  studymaterial:      { label: 'Study Materials', desc: 'Read notes and chapters',      short: 'Materials',  metric: 'materials', unit: 'materials' },
  teachingaids:       { label: 'Teaching Aids', desc: 'Books and aids to teach from',        short: 'Aids',       metric: 'aids',      unit: 'aids' },
  studylockers:       { label: 'Study Lockers', desc: 'Your saved study items',        short: 'Lockers',    metric: 'lockers',   unit: 'lockers' },
  questionbank:       { label: 'Question Bank', desc: 'Add and manage questions',        short: 'Bank',       metric: 'questions', unit: 'questions' },
  questionbankviewer: { label: 'Question Bank Viewer', desc: 'Browse questions to revise', short: 'Viewer',     metric: 'questions', unit: 'questions' },
  entrance:           { label: 'Entrance Exam', desc: 'Run entrance exams',        short: 'Entrance',   metric: 'exams',     unit: 'exams' },
  modelsets:          { label: 'Model Sets', desc: 'Take a practice paper',           short: 'Model Sets', metric: 'modelsets', unit: 'sets' },
  setmaker:           { label: 'Model Set Maker', desc: 'Print papers and answer sheets',      short: 'Set Maker',  metric: 'setmaker',  unit: 'added' },
  classmaterial:      { label: 'Class Material', desc: 'Class files from your teachers',       short: 'Class Material', metric: 'classmaterial', unit: 'files' },
};

const FLOW = [
  { stage: 'Learn', ids: ['studymaterial', 'classmaterial', 'teachingaids', 'studylockers'] },
  { stage: 'Practice', ids: ['questionbank', 'questionbankviewer'] },
  { stage: 'Test', ids: ['entrance', 'modelsets', 'setmaker'] },
];

// The four "Learn" sections are shown to users as ONE module (Study Library) with a simple switcher inside.
// Their ids / permission keys / routes are unchanged — only the presentation is merged.
const GROUPS = {
  library: { label: 'Study Library', short: 'Study', desc: 'Notes, class files, aids and lockers', icon: 'studymaterial', ids: ['studymaterial', 'classmaterial', 'teachingaids', 'studylockers'] },
};
const SUB_LABEL = { studymaterial: 'Notes', classmaterial: 'Class', teachingaids: 'Aids', studylockers: 'Lockers' };
const groupOf = (id) => Object.keys(GROUPS).find((g) => GROUPS[g].ids.includes(id));
// one entry per thing the user sees on the home page / tab bar / bottom bar
function buildStages(visible) {
  return FLOW.map((st) => {
    const items = [];
    st.ids.forEach((id) => {
      const g = groupOf(id);
      if (g) {
        if (items.some((i) => i.key === g)) return;
        const kids = GROUPS[g].ids.filter((k) => visible.includes(k));
        if (!kids.length) return;
        items.push({ key: g, ...GROUPS[g], kids, go: kids[0], isOn: (a) => kids.includes(a), count: (c) => kids.reduce((n, k) => n + (Number(c[MODULES[k].metric]) || 0), 0) });
      } else if (visible.includes(id)) {
        const m = MODULES[id];
        items.push({ key: id, label: m.label, short: m.short, desc: m.desc, icon: id, kids: [id], go: id, isOn: (a) => a === id, count: (c) => c[m.metric] });
      }
    });
    return { stage: st.stage, items };
  }).filter((st) => st.items.length);
}

// ── live counts (shared + cached, so five screens do not each re-query) ──────
const TABLES = { questions: 'qbank_questions', materials: 'study_materials', aids: 'teaching_aids', lockers: 'study_lockers', exams: 'entrance_exams', modelsets: 'model_sets', setmaker: 'set_maker_items', classmaterial: 'class_materials' };
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
.lh-home{display:inline-flex;align-items:center;gap:6px;height:38px;padding:0 14px 0 10px;border:1px solid ${PX.goldLine};border-radius:12px;background:${PX.goldBg};color:${PX.ink};font:700 12.5px/1 ${PX.sans};cursor:pointer;white-space:nowrap}
.lh-home b{font-size:20px;line-height:1;color:${PX.gold};margin-top:-2px}
.lh-home:hover{border-color:${PX.gold}}
.lh-home:focus-visible{outline:2px solid ${PX.gold};outline-offset:2px}
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
.lh-sub{display:flex;gap:6px;margin:12px 24px 0;padding:4px;background:${PX.tint};border-radius:14px;width:fit-content;max-width:calc(100% - 48px);overflow-x:auto;scrollbar-width:none}
.lh-subb{display:inline-flex;align-items:center;gap:6px;height:36px;padding:0 14px;border:0;border-radius:11px;background:none;color:${PX.ink2};font:700 12.5px/1 ${PX.sans};cursor:pointer;white-space:nowrap}
.lh-subb.on{background:#fff;color:${PX.navy};box-shadow:0 1px 3px rgba(19,42,79,.18)}
.lh-subb:focus-visible{outline:2px solid ${PX.gold};outline-offset:2px}
@media (max-width:640px){.lh-sub{margin:10px 12px 0;max-width:calc(100% - 24px)}}
@media (min-width:641px){.lh-ribbon{flex-wrap:wrap;overflow-x:visible;row-gap:10px}.lh-stage + .lh-stage{border-left:0}.lh-stage + .lh-stage::before{display:none}.lh-stage{padding:2px 12px 4px 4px}}
@media (max-width:640px){
  .lh-wrap{padding:10px 12px 0}
  .lh-pill{height:40px;padding:0 11px 0 9px}
  .lh-pill:not(.on) .lh-label-long{display:none}
}
`;

const HOME_CSS = `
.lhp{max-width:980px;margin:0 auto;padding-bottom:28px}
.lhp-hero{position:relative;overflow:hidden;background:radial-gradient(90% 140% at 100% 0%,rgba(184,146,58,.30) 0%,transparent 55%),linear-gradient(135deg,${PX.navyDeep} 0%,${PX.navy} 45%,${PX.navy2} 100%);padding:18px 18px 22px;border-radius:0 0 26px 26px;color:#fff}
.lhp-hero::after{content:'';position:absolute;left:0;right:0;bottom:0;height:2px;background:linear-gradient(90deg,transparent,${PX.gold},transparent)}
.lhp-top{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.lhp-logo{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.12);color:${PX.goldLt};box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.lhp-t{font-family:${PX.serif};font-size:27px;font-weight:600;line-height:1.1}
.lhp-t span{color:${PX.goldLt}}
.lhp-s{font-size:12px;opacity:.72;margin-top:3px;font-weight:500}
.lhp-search{display:flex;align-items:center;gap:10px;background:#fff;color:${PX.sub};border-radius:14px;padding:0 14px;height:46px;box-shadow:0 8px 20px -10px rgba(0,0,0,.5)}
.lhp-search input{flex:1;min-width:0;border:0;outline:0;background:none;font:500 14px ${PX.sans};color:${PX.ink}}
.lhp-clear{border:0;background:none;color:${PX.faint};font-size:14px;cursor:pointer;padding:4px}
.lhp-card{background:#fff;border-radius:18px;margin:14px 16px 0;padding:14px 12px 8px;box-shadow:0 2px 12px rgba(19,42,79,.07);border:1px solid ${PX.line}}
.lhp-card-h{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:800;color:${PX.ink};padding:0 4px 10px}
.lhp-card-h i{width:4px;height:16px;border-radius:2px;display:inline-block}
.lhp-card-h small{margin-left:auto;font-size:11px;font-weight:600;color:${PX.faint}}
.lhp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:4px 2px}
.lhp-tile{background:none;border:0;padding:6px 2px 10px;display:flex;flex-direction:column;align-items:center;gap:6px;cursor:pointer;color:${PX.ink};border-radius:12px;font-family:${PX.sans};text-align:center}
.lhp-tile:active{background:${PX.tint}}
.lhp-tile:focus-visible{outline:2px solid ${PX.gold};outline-offset:2px}
.lhp-ico{width:52px;height:52px;border-radius:16px;display:flex;align-items:center;justify-content:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 3px 0 rgba(19,42,79,.12),0 7px 12px rgba(19,42,79,.10);transition:transform .09s ease,box-shadow .09s ease}
.lhp-tile:hover .lhp-ico{transform:translateY(-2px)}
.lhp-tile:active .lhp-ico{transform:translateY(2px);box-shadow:inset 0 2px 4px rgba(19,42,79,.18)}
.lhp-lbl{font-size:12px;font-weight:700;line-height:1.2}
.lhp-cnt{font-size:11px;font-weight:500;color:${PX.sub};margin-top:-3px;line-height:1.25}
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
@media (max-width:520px){.lhp-t{font-size:24px}}
@media (min-width:768px){.lhp-hero{border-radius:22px;margin:16px 16px 0}}
`;

const STAGE_COLOR = { Learn: '#185FA5', Practice: '#a7771f', Test: '#0f766e' };
const tint = (hex, a = '1F') => `${hex}${a}`;

function HubTile({ item, color, counts, onNavigate }) {
  return (
    <button className="lhp-tile" onClick={() => onNavigate(item.go)}>
      <span className="lhp-ico" style={{ background: tint(color), color }}><NavIcon id={item.icon} size={24} /></span>
      <span className="lhp-lbl">{item.label}</span>
      <span className="lhp-cnt">{item.desc}</span>
    </button>
  );
}

function HubHome({ visible, counts, onNavigate }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const stages = buildStages(visible).map((st) => ({ ...st, color: STAGE_COLOR[st.stage] }));
  const flat = stages.flatMap((st) => st.items.map((item) => ({ item, color: st.color, stage: st.stage })));
  const hits = needle ? flat.filter(({ item, stage }) => `${item.label} ${item.desc} ${stage} ${item.kids.map((k) => MODULES[k].label).join(' ')}`.toLowerCase().includes(needle)) : null;
  return (
    <div className="lhp">
      <div className="lhp-hero">
        <div className="lhp-top">
          <span className="lhp-logo"><NavIcon id="learninghub" size={22} /></span>
          <div>
            <div className="lhp-t">Learning <span>Hub</span></div>
            <div className="lhp-s">Learn · Practice · Test</div>
          </div>
        </div>
        <label className="lhp-search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find what you need…" />
          {q ? <button type="button" className="lhp-clear" onClick={() => setQ('')} aria-label="Clear search">✕</button> : null}
        </label>
      </div>
      {hits ? (
        <div className="lhp-card">
          <div className="lhp-card-h">{hits.length ? `${hits.length} result${hits.length > 1 ? 's' : ''}` : 'Nothing found'}</div>
          {hits.length
            ? <div className="lhp-grid">{hits.map((t) => <HubTile key={t.item.key} item={t.item} color={t.color} counts={counts} onNavigate={onNavigate} />)}</div>
            : <div className="lhp-empty">Try “questions”, “exam” or “notes”.</div>}
        </div>
      ) : (
        stages.map((st) => (
          <div key={st.stage} className="lhp-card">
            <div className="lhp-card-h"><i style={{ background: st.color }} />{st.stage}</div>
            <div className="lhp-grid">{st.items.map((item) => <HubTile key={item.key} item={item} color={st.color} counts={counts} onNavigate={onNavigate} />)}</div>
          </div>
        ))
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
  const items = buildStages(visible).flatMap((st) => st.items);
  return (
    <nav className="lhp-bottom" style={{ '--n': items.length }} aria-label="Learning Hub sections">
      {items.map((it) => {
        const on = it.isOn(active);
        return (
          <button key={it.key} className={`lhp-nb${on ? ' on' : ''}`} onClick={() => !on && onNavigate(it.go)} aria-current={on ? 'page' : undefined}>
            <span className="lhp-bi"><NavIcon id={it.icon} size={20} /></span>
            <span>{it.short}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function LearningRibbon({ active, onNavigate, counts, visible }) {
  return (
    <nav className="lh-ribbon" aria-label="Learning flow">
      {buildStages(visible || HUB_TABS).map((st) => (
        <div key={st.stage} className="lh-stage">
          <div className="lh-stage-h">{st.stage}</div>
          <div className="lh-pills">
            {st.items.map((it) => {
              const on = it.isOn(active);
              return (
                <button key={it.key} className={`lh-pill${on ? ' on' : ''}`} onClick={() => !on && onNavigate && onNavigate(it.go)} aria-current={on ? 'page' : undefined} title={it.label}>
                  <NavIcon id={it.icon} size={17} />
                  <span><span className="lh-label-long">{it.label}</span></span>
                  <span className="lh-n">{fmt(it.count(counts))}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

// switcher shown inside the merged Study Library (Notes · Class · Aids · Lockers)
function SubTabs({ active, visible, onNavigate }) {
  const g = groupOf(active);
  const kids = g ? GROUPS[g].ids.filter((k) => visible.includes(k)) : [];
  if (kids.length < 2) return null;
  return (
    <div className="lh-sub" role="tablist" aria-label={GROUPS[g].label}>
      {kids.map((k) => (
        <button key={k} role="tab" aria-selected={k === active} className={`lh-subb${k === active ? ' on' : ''}`} onClick={() => k !== active && onNavigate(k)}>
          <NavIcon id={k} size={16} />{SUB_LABEL[k]}
        </button>
      ))}
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
      case 'studylockers': return <StudyLockers {...common} perms={perms('studylockers')} />;
      case 'questionbank': return <QuestionBank {...common} perms={perms('questionbank')} />;
      case 'questionbankviewer': return <QuestionBankViewer {...common} />;
      case 'entrance': return <Entrance {...common} perms={perms('entrance')} />;
      case 'modelsets': return <ModelSets {...common} perms={perms('modelsets')} />;
      case 'setmaker': return <SetMaker {...common} perms={perms('setmaker')} />;
      case 'classmaterial': return <ClassMaterial {...common} perms={perms('classmaterial')} />;
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
          {onHome ? <button type="button" className="lh-home" onClick={onHome} title="Back to the Learning Hub icons"><b>‹</b>All sections</button> : null}
          <span className="lh-title-ico"><NavIcon id="learninghub" size={18} /></span>
          <div>
            <div className="lh-title-e">GNSI · Academics</div>
            <div className="lh-title-t">Learning Hub</div>
          </div>
          <div className="lh-title-s">Learn · Practice · Test</div>
        </div>
        <div className="lh-desk"><LearningRibbon active={active} onNavigate={onNavigate} counts={counts} visible={visible} /></div>
      </div>
      {!showHome ? <SubTabs active={active} visible={visible} onNavigate={onNavigate} /> : null}
      {visible.filter((id) => opened.has(id)).map((id) => (
        <div key={id} className="lhp-tabs-pad" style={{ display: !showHome && id === active ? 'block' : 'none' }}>
          <Suspense fallback={<Loading />}>{view(id)}</Suspense>
        </div>
      ))}
      {!showHome ? <HubBottom visible={visible} active={active} onNavigate={onNavigate} /> : null}
    </div>
  );
}

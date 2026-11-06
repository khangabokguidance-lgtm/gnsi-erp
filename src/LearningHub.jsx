// ─── LearningHub.jsx ─────────────────────────────────────────────────────────
// ONE unified page for all academic content. Every section the user may open (Study Materials, Class Material,
// Teaching Aids, Study Lockers, Question Bank, Question Bank Viewer, Entrance Exam, Model Sets, Model Set Maker)
// is a collapsible block on the same page, grouped Learn → Practice → Test:
// • no home screen and no tab bar — open a block to see its full content;
// • a block mounts the first time it is opened and then stays mounted (hidden when collapsed),
//   so a half-written question or an open filter is not lost;
// • links from inside a section (App's onNavigate) open + scroll to the target block;
// • each section keeps its own permission key, so role settings still decide who sees which block.
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
.lh-root{font-family:${PX.sans};max-width:1100px;margin:0 auto;padding:16px 16px 40px}
.lh-title{display:flex;align-items:center;gap:12px;margin:0 2px 14px;flex-wrap:wrap}
.lh-title-ico{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:${PX.goldLt}}
.lh-title-t{font-family:${PX.serif};font-size:22px;font-weight:600;color:${PX.ink};line-height:1.1}
.lh-title-s{font-size:12.5px;color:${PX.sub}}
.lh-tools{margin-left:auto;display:flex;gap:8px}
.lh-tool{height:34px;padding:0 12px;border:1px solid ${PX.line};border-radius:10px;background:#fff;color:${PX.ink2};font:700 12px/1 ${PX.sans};cursor:pointer}
.lh-tool:hover{border-color:${PX.goldLine}}
.lh-stage-h{display:flex;align-items:center;gap:8px;font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${PX.gold};margin:20px 4px 8px}
.lh-stage-h i{width:4px;height:14px;border-radius:2px;display:inline-block}
.lh-sec{background:#fff;border:1px solid ${PX.line};border-radius:16px;margin-bottom:10px;box-shadow:0 1px 2px rgba(19,42,79,.05);scroll-margin-top:12px}
.lh-sec.open{border-color:${PX.goldLine};box-shadow:0 10px 24px -18px rgba(19,42,79,.45)}
.lh-sec-h{width:100%;display:flex;align-items:center;gap:12px;padding:12px 14px;border:0;background:none;cursor:pointer;text-align:left;font-family:${PX.sans};color:${PX.ink};border-radius:16px}
.lh-sec-h:focus-visible{outline:2px solid ${PX.gold};outline-offset:-2px}
.lh-sec-ico{width:40px;height:40px;border-radius:12px;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.lh-sec-t{font-weight:800;font-size:14.5px;line-height:1.2}
.lh-sec-d{font-size:12px;color:${PX.sub};margin-top:2px}
.lh-sec-n{margin-left:auto;font-size:11px;font-weight:800;padding:2px 9px;border-radius:99px;background:${PX.goldBg};color:#7a5a12;font-variant-numeric:tabular-nums;white-space:nowrap}
.lh-chev{flex-shrink:0;color:${PX.gold};transition:transform .15s ease;display:flex}
.lh-sec.open .lh-chev{transform:rotate(90deg)}
.lh-sec-b{border-top:1px solid ${PX.line};padding:6px 0 4px;overflow-x:auto}
@media (max-width:640px){.lh-root{padding:10px 10px 40px}.lh-sec-d{display:none}.lh-title-s{display:none}.lh-title-t{font-size:19px}}
`;

const STAGE_COLOR = { Learn: '#185FA5', Practice: '#a7771f', Test: '#0f766e' };
const tint = (hex, a = '1F') => `${hex}${a}`;
const Loading = () => (
  <div style={{ padding: '40px 20px', textAlign: 'center', color: PX.sub, fontFamily: PX.sans, fontSize: 13 }}>Loading…</div>
);

// tab: section id App wants open (links from other modules); onNavigate(id): App's router.
// perms(key) / canAccess(key): the signed-in user's rights per section module.
export default function LearningHub({ currentUser, tab, onNavigate, perms, canAccess }) {
  const counts = useLearningCounts();
  const visible = HUB_TABS.filter((id) => !canAccess || canAccess(id));
  const [open, setOpen] = useState(() => new Set(visible.includes(tab) ? [tab] : visible.slice(0, 1)));
  const [mounted, setMounted] = useState(() => new Set(open));
  const toggle = (id) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
    if (next.has(id)) setMounted((m) => (m.has(id) ? m : new Set(m).add(id)));
  };
  const openOnly = (ids) => { setOpen(new Set(ids)); setMounted((m) => new Set([...m, ...ids])); };

  // App asks for a specific section (e.g. a link from inside another section) → open it and scroll to it
  useEffect(() => {
    if (!tab || !visible.includes(tab)) return;
    setOpen((o) => (o.has(tab) ? o : new Set(o).add(tab)));
    setMounted((m) => (m.has(tab) ? m : new Set(m).add(tab)));
    const t = setTimeout(() => { const el = document.getElementById(`lh-sec-${tab}`); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!visible.length) return <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>You do not have access to any Learning Hub section.</div>;

  const view = (id) => {
    const common = { currentUser, onNavigate: (to) => { if (to && visible.includes(to)) { setOpen((o) => new Set(o).add(to)); setMounted((m) => new Set(m).add(to)); setTimeout(() => { const el = document.getElementById(`lh-sec-${to}`); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); } else if (onNavigate) onNavigate(to); } };
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
      <div className="lh-title">
        <span className="lh-title-ico"><NavIcon id="learninghub" size={18} /></span>
        <div>
          <div className="lh-title-t">Learning Hub</div>
          <div className="lh-title-s">Learn · Practice · Test — everything on one page</div>
        </div>
        <div className="lh-tools">
          <button type="button" className="lh-tool" onClick={() => openOnly(visible)}>Expand all</button>
          <button type="button" className="lh-tool" onClick={() => setOpen(new Set())}>Collapse all</button>
        </div>
      </div>
      {FLOW.map((st) => ({ ...st, ids: st.ids.filter((id) => visible.includes(id)) })).filter((st) => st.ids.length).map((st) => (
        <section key={st.stage}>
          <div className="lh-stage-h"><i style={{ background: STAGE_COLOR[st.stage] }} />{st.stage}</div>
          {st.ids.map((id) => {
            const m = MODULES[id];
            const isOpen = open.has(id);
            return (
              <div key={id} id={`lh-sec-${id}`} className={`lh-sec${isOpen ? ' open' : ''}`}>
                <button type="button" className="lh-sec-h" onClick={() => toggle(id)} aria-expanded={isOpen} aria-controls={`lh-body-${id}`}>
                  <span className="lh-sec-ico" style={{ background: tint(STAGE_COLOR[st.stage]), color: STAGE_COLOR[st.stage] }}><NavIcon id={id} size={22} /></span>
                  <span style={{ minWidth: 0 }}>
                    <div className="lh-sec-t">{m.label}</div>
                    <div className="lh-sec-d">{m.desc}</div>
                  </span>
                  <span className="lh-sec-n">{fmt(counts[m.metric])} {m.unit}</span>
                  <span className="lh-chev"><NavIcon id="chevron" size={18} /></span>
                </button>
                {mounted.has(id) ? (
                  <div id={`lh-body-${id}`} className="lh-sec-b" style={{ display: isOpen ? 'block' : 'none' }}>
                    <Suspense fallback={<Loading />}>{view(id)}</Suspense>
                  </div>
                ) : null}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

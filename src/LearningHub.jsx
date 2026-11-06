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
  questionbank:       { label: 'Question Bank', desc: 'Add, edit and read questions',        short: 'Bank',       metric: 'questions', unit: 'questions' },
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

// ── plain-language help shown at the top of every section ───────────────────
const HELP = {
  studymaterial: { what: 'Notes, formula sheets, practice sets, videos and solved papers, arranged by course, subject and chapter.', steps: ['Pick a course button.', 'Choose a subject, then open a chapter.', 'Tap a material to read or watch it. Use the search box to find one by name.'] },
  classmaterial: { what: 'Files your teachers share for each class.', steps: ['Choose your class.', 'Tap a file to open it.', 'Teachers can add new files with the Add button.'] },
  teachingaids: { what: 'A bookshelf of teaching books you read page by page.', steps: ['Pick a batch such as Lakshya or Umeed.', 'Narrow by subject if you like.', 'Tap a book cover to read. Your last page is remembered.'] },
  studylockers: { what: 'Lockers that group study items together for easy revision.', steps: ['Open a locker.', 'Read or practise what is inside.', 'Teachers can create lockers and add items.'] },
  questionbank: { what: 'All questions, organised by course, subject and chapter. Add new ones or switch to Read-only to just study.', steps: ['Open "Question Bank" to browse and search.', 'Use "Manual Add" or "Bulk Paste" to add questions.', 'Use "More tools" for papers, tests and reports (Admin).'] },
  questionbankviewer: { what: 'A read-only view of the questions for revision.', steps: ['Pick a course, subject and chapter.', 'Read the questions and answers.', 'Print a chapter with or without answers.'] },
  entrance: { what: 'Runs a whole entrance exam from applications to results.', steps: ['Click "New exam" and fill the name and date.', 'Follow the steps in order: Applications, Question Paper, Hall Tickets, Exam Day, Results.', 'The Overview shows the next thing to do.'] },
  modelsets: { what: 'Full practice papers you take on screen with a timer and OMR sheet.', steps: ['Open a set.', 'Answer the questions before the timer ends.', 'See your section-wise score at the end.'] },
  setmaker: { what: 'Builds a fresh printed booklet with answer key and OMR sheet.', steps: ['Choose the questions or topics.', 'Generate the paper.', 'Download or print it.'] },
};
const helpKey = (id) => `gnsi_lh_help_${id}`;
function SectionHelp({ id }) {
  const h = HELP[id];
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(helpKey(id)) !== 'closed'; } catch { return true; } });
  if (!h) return null;
  return (
    <details className="lh-help" open={open} onToggle={(e) => { const o = e.currentTarget.open; setOpen(o); try { localStorage.setItem(helpKey(id), o ? 'open' : 'closed'); } catch { /* storage blocked */ } }}>
      <summary>How to use this</summary>
      <p>{h.what}</p>
      <ol>{h.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
    </details>
  );
}

// ── recently opened sections (per browser) ──────────────────────────────────
const RECENT_KEY = 'gnsi_lh_recent';
const readRecent = () => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); return Array.isArray(v) ? v.filter((x) => HUB_TABS.includes(x)) : []; } catch { return []; } };
const pushRecent = (id) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...readRecent().filter((x) => x !== id)].slice(0, 4))); } catch { /* storage blocked */ } };

// ── search across the content of every section the user may open ────────────
const SEARCHES = [
  { id: 'studymaterial', table: 'study_materials', col: 'title', pick: (r) => r.title },
  { id: 'teachingaids', table: 'teaching_aids', col: 'title', pick: (r) => r.title },
  { id: 'questionbankviewer', table: 'qbank_questions', col: 'question', pick: (r) => r.question },
  { id: 'entrance', table: 'entrance_exams', col: 'exam_name', pick: (r) => r.exam_name },
  { id: 'modelsets', table: 'model_sets', col: 'data->>title', sel: 'id,title:data->>title', pick: (r) => r.title },
];
async function searchAll(term, visible) {
  const t = term.replace(/[%,()]/g, ' ').trim();
  const out = [];
  await Promise.all(SEARCHES.map(async (d) => {
    // questions are searched from the viewer (read-only) or the bank, whichever the user may open
    const sec = d.id === 'questionbankviewer' ? ['questionbankviewer', 'questionbank'].find((x) => visible.includes(x)) : d.id;
    if (!sec || !visible.includes(sec)) return;
    try {
      const { data, error } = await supabase.from(d.table).select(d.sel || `id,${d.col}`).ilike(d.col, `%${t}%`).limit(6);
      if (!error) (data || []).forEach((r) => out.push({ key: `${d.table}-${r.id}`, section: sec, text: String(d.pick(r) || '').slice(0, 140) }));
    } catch { /* table missing or blocked — skip this source */ }
  }));
  return out;
}

const CSS = `
.lh-root{font-family:${PX.sans};max-width:1100px;margin:0 auto;padding:16px 16px 40px}
.lh-title{display:flex;align-items:center;gap:12px;margin:0 2px 14px;flex-wrap:wrap}
.lh-title-ico{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:${PX.goldLt}}
.lh-title-t{font-family:${PX.serif};font-size:22px;font-weight:600;color:${PX.ink};line-height:1.1}
.lh-title-s{font-size:12.5px;color:${PX.sub}}
.lh-tools{margin-left:auto;display:flex;gap:8px}
.lh-tool{height:34px;padding:0 12px;border:1px solid ${PX.line};border-radius:10px;background:#fff;color:${PX.ink2};font:700 12px/1 ${PX.sans};cursor:pointer}
.lh-tool:hover{border-color:${PX.goldLine}}
.lh-find{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid ${PX.line};border-radius:14px;padding:0 14px;height:46px;margin:0 0 10px;color:${PX.sub}}
.lh-find:focus-within{border-color:${PX.gold}}
.lh-find input{flex:1;min-width:0;border:0;outline:0;background:none;font:500 14px ${PX.sans};color:${PX.ink}}
.lh-find button{border:0;background:none;color:${PX.faint};cursor:pointer;font-size:14px}
.lh-recent{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 6px}
.lh-recent b{font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${PX.sub}}
.lh-chip{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid ${PX.line};border-radius:99px;background:#fff;color:${PX.ink2};font:700 12px/1 ${PX.sans};cursor:pointer}
.lh-chip:hover{border-color:${PX.goldLine}}
.lh-res{background:#fff;border:1px solid ${PX.line};border-radius:14px;margin-bottom:10px;overflow:hidden}
.lh-res-i{display:flex;align-items:center;gap:10px;width:100%;padding:10px 14px;border:0;border-bottom:1px solid ${PX.line};background:none;text-align:left;cursor:pointer;font:500 13px ${PX.sans};color:${PX.ink}}
.lh-res-i:last-child{border-bottom:0}
.lh-res-i:hover{background:${PX.tint}}
.lh-res-i span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.lh-res-i em{font-style:normal;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:99px;background:${PX.goldBg};color:#7a5a12;white-space:nowrap}
.lh-res-e{padding:14px;text-align:center;color:${PX.sub};font-size:13px}
.lh-sub{display:flex;gap:6px;margin:10px 14px;padding:4px;background:${PX.tint};border-radius:12px;width:fit-content}
.lh-subb{height:32px;padding:0 14px;border:0;border-radius:9px;background:none;color:${PX.ink2};font:700 12.5px/1 ${PX.sans};cursor:pointer}
.lh-subb.on{background:#fff;color:${PX.navy};box-shadow:0 1px 3px rgba(19,42,79,.18)}
.lh-help{margin:10px 14px;padding:10px 14px;border:1px solid ${PX.goldLine};border-radius:12px;background:${PX.goldBg};font-size:12.5px;color:${PX.ink};line-height:1.5}
.lh-help summary{cursor:pointer;font-weight:800;font-size:12px;letter-spacing:.04em;color:#7a5a12}
.lh-help p{margin:6px 0 4px}
.lh-help ol{margin:0;padding-left:20px}
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
  const allowed = HUB_TABS.filter((id) => !canAccess || canAccess(id));
  // Question Bank Viewer is the read-only mode of the Question Bank block when the user may open both
  const visible = allowed.includes('questionbank') ? allowed.filter((id) => id !== 'questionbankviewer') : allowed;
  const [qbMode, setQbMode] = useState('edit');
  const canonical = (id) => (id === 'questionbankviewer' && visible.includes('questionbank') ? 'questionbank' : id);
  const [recent, setRecent] = useState(readRecent);
  const [open, setOpen] = useState(() => {
    const last = readRecent().map(canonical).find((x) => visible.includes(x));
    const role = String(currentUser?.role || '').toLowerCase();
    const byRole = role.includes('student') || role.includes('parent') ? ['studymaterial', 'classmaterial', 'modelsets'] : role.includes('teacher') ? ['studymaterial', 'teachingaids', 'questionbank'] : [];
    const start = canonical(tab) && visible.includes(canonical(tab)) ? canonical(tab) : last || byRole.find((x) => visible.includes(x)) || visible[0];
    return new Set([start].filter(Boolean));
  });
  const [q, setQ] = useState('');
  const [qbSeen, setQbSeen] = useState(false);
  if (qbMode === 'view' && !qbSeen) setQbSeen(true);
  const [hits, setHits] = useState(null);
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits(null); return undefined; }
    let live = true;
    const t = setTimeout(async () => {
      const found = await searchAll(term, visible);
      const names = visible.filter((id) => `${MODULES[id].label} ${MODULES[id].desc}`.toLowerCase().includes(term.toLowerCase())).map((id) => ({ key: `sec-${id}`, section: id, text: MODULES[id].label, isSection: true }));
      if (live) setHits([...names, ...found]);
    }, 300);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  const goTo = (rawId) => {
    const id = canonical(rawId);
    if (rawId === 'questionbankviewer' && id === 'questionbank') setQbMode('view');
    setOpen((o) => new Set(o).add(id));
    setMounted((m) => (m.has(id) ? m : new Set(m).add(id)));
    pushRecent(id); setRecent(readRecent());
    setTimeout(() => { const el = document.getElementById(`lh-sec-${id}`); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
  };
  const [mounted, setMounted] = useState(() => new Set(open));
  const toggle = (id) => {
    const next = new Set(open);
    if (next.has(id)) next.delete(id); else next.add(id);
    setOpen(next);
    if (next.has(id)) { setMounted((m) => (m.has(id) ? m : new Set(m).add(id))); pushRecent(id); setRecent(readRecent()); }
  };
  const openOnly = (ids) => { setOpen(new Set(ids)); setMounted((m) => new Set([...m, ...ids])); };

  // App asks for a specific section (e.g. a link from inside another section) → open it and scroll to it
  useEffect(() => {
    if (!tab) return undefined;
    const id = canonical(tab);
    if (!visible.includes(id)) return undefined;
    if (tab === 'questionbankviewer' && id === 'questionbank') setQbMode('view');
    setOpen((o) => (o.has(id) ? o : new Set(o).add(id)));
    setMounted((m) => (m.has(id) ? m : new Set(m).add(id)));
    const t = setTimeout(() => { const el = document.getElementById(`lh-sec-${id}`); if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!visible.length) return <div style={{ padding: 40, textAlign: 'center', color: PX.sub }}>You do not have access to any Learning Hub section.</div>;

  const view = (id) => {
    const common = { currentUser, onNavigate: (to) => { if (to && visible.includes(canonical(to))) goTo(to); else if (onNavigate) onNavigate(to); } };
    switch (id) {
      case 'studymaterial': return <StudyMaterial {...common} perms={perms('studymaterial')} />;
      case 'teachingaids': return <TeachingAids {...common} perms={perms('teachingaids')} />;
      case 'studylockers': return <StudyLockers {...common} perms={perms('studylockers')} />;
      case 'questionbank': return allowed.includes('questionbankviewer') ? (
        <>
          <div className="lh-sub" role="tablist" aria-label="Question Bank mode">
            {[['edit', 'Add & edit'], ['view', 'Read-only']].map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={qbMode === k} className={`lh-subb${qbMode === k ? ' on' : ''}`} onClick={() => setQbMode(k)}>{l}</button>
            ))}
          </div>
          <div style={{ display: qbMode === 'edit' ? 'block' : 'none' }}><QuestionBank {...common} perms={perms('questionbank')} /></div>
          {qbSeen ? <div style={{ display: qbMode === 'view' ? 'block' : 'none' }}><Suspense fallback={<Loading />}><QuestionBankViewer {...common} /></Suspense></div> : null}
        </>
      ) : <QuestionBank {...common} perms={perms('questionbank')} />;
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
      <label className="lh-find">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, aids, questions, exams…" aria-label="Search the Learning Hub" />
        {q ? <button type="button" onClick={() => setQ('')} aria-label="Clear search">✕</button> : null}
      </label>
      {hits ? (
        <div className="lh-res">
          {hits.length ? hits.map((h) => (
            <button key={h.key} type="button" className="lh-res-i" onClick={() => { goTo(h.section); setQ(''); }}>
              <span>{h.text}</span><em>{MODULES[h.section].label}</em>
            </button>
          )) : <div className="lh-res-e">Nothing found. Try a shorter word.</div>}
        </div>
      ) : (recent.filter((id) => visible.includes(id)).length ? (
        <div className="lh-recent"><b>Recent</b>
          {recent.filter((id) => visible.includes(id)).map((id) => <button key={id} type="button" className="lh-chip" onClick={() => goTo(id)}><NavIcon id={id} size={15} />{MODULES[id].short}</button>)}
        </div>
      ) : null)}
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
                    <div className="lh-sec-t">{id === 'questionbank' && allowed.includes('questionbankviewer') ? 'Question Bank' : m.label}</div>
                    <div className="lh-sec-d">{m.desc}</div>
                  </span>
                  <span className="lh-sec-n">{fmt(counts[m.metric])} {m.unit}</span>
                  <span className="lh-chev"><NavIcon id="chevron" size={18} /></span>
                </button>
                {mounted.has(id) ? (
                  <div id={`lh-body-${id}`} className="lh-sec-b" style={{ display: isOpen ? 'block' : 'none' }}>
                    <SectionHelp id={id} />
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

// ─── MockTestAnalyzer.jsx ────────────────────────────────────────────────────
// Exams → "Mock Analyzer".  Advanced student / subject / batch performance
// analysis over mock-test result sheets, with Excel upload, permanent storage
// and professional A4 printouts.
//
//   engine   lib/mockTestEngine.js   parsing, identity matching, statistics
//   charts   lib/mockTestCharts.js   SVG charts (screen + print)
//   reports  lib/mockTestReports.js  A4 print documents
//   store    lib/mockTestStore.js    Supabase table + browser fallback
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  DEFAULT_SERIES, MEGA_SERIES, inScope, parseResultSheet, inferMax, guessFromFilename, resolveIdentities, seriesMeta,
  studentAnalysis, batchAnalysis, batchComparison, matchingReport, rowsFromSeed, strengthLabel, r1, r2, cleanName, gccDigits,
} from './lib/mockTestEngine';
import { lineChart, barChart, radarChart, hBars, subjColor } from './lib/mockTestCharts';
import { printDocument, studentReportHTML, batchReportHTML, subjectReportHTML } from './lib/mockTestReports';
import ResponsiveTables from './ResponsiveTables';
import { loadAll, loadSettings, saveSettings, saveRows, deleteTest, resetSeries, resetAll, migrateLocalToCloud, localCount, loadFixes, migrateLocalFixes, localFixCount, loadGroupChoices, saveGroupChoice, clearGroupChoices, GROUP_BASIS_ALL, loadGroupMentors, saveGroupMentor, mentorKey, loadClassLanguages, saveClassLanguage, loadRemoved, saveRemoved, loadCustomGroups, saveCustomGroup, deleteCustomGroup, newGroupId, loadSchedule, saveScheduleEntry, resetSchedule } from './lib/mockTestStore';
import { applyFixes } from './lib/studentFixEngine';
import { classGroups, subjectsOf, languageOfBatch, LANGUAGES, GROUP_META } from './lib/mockTestGroups';
import { loadHouseDirectory } from './houseDirectory';
import MockGroupReport from './MockGroupReport';
import MockDutyDesk from './MockDutyDesk';
import MockRevisionPlan from './MockRevisionPlan';
import { InstructionForm, InstructionSummary } from './DutyInstruction';
import { pickInstruction, hasInstruction, slotText, DAYS } from './lib/dutyInstruction';
import { mergeSchedule, withSchedule, stripScheduleDefaults } from './lib/studySchedule';
import { collectDuties, assignmentsFrom, parseScope, mixScope, dutyRoomClashes } from './lib/mockTestDuty';
import { sheetName } from './lib/mockTestReport';
import { printPremium, ICON } from './lib/printPremium';
import { loggedInName } from './lib/collector';
import { emptyFilter, isFilterActive, describeFilter, applyDataFilter, studentRoster, loadPresets, savePresets } from './lib/mockTestFilter';
import ExamIcon from './examIcons';
import MockFixEngine from './MockFixEngine';

const NAVY = '#132a4f';
const NO_BATCH_MARKS = {};
const ui = {
  card: { background: '#fff', border: '1px solid #e8e3d8', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 2px 10px rgba(19,42,79,.06)' },
  input: { padding: '8px 12px', borderRadius: 12, border: '1px solid #d9d2c2', fontSize: 13, background: '#fff', color: '#0f1b2e', fontFamily: 'inherit', minWidth: 0 },
  btn: { padding: '10px 18px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: NAVY, color: '#fff', fontFamily: 'inherit' },
  ghost: { padding: '9px 14px', borderRadius: 12, border: '1px solid #d9d2c2', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#2e3b52', fontFamily: 'inherit' },
  th: { background: NAVY, color: '#fff', padding: '7px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, textAlign: 'center', whiteSpace: 'nowrap', position: 'sticky', top: 0 },
  td: { padding: '6px 8px', borderBottom: '1px solid #E5E7EB', textAlign: 'center', fontSize: 13, whiteSpace: 'nowrap' },
  label: { fontSize: 11, fontWeight: 700, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 4, display: 'block' },
};
const SUBTABS = [
  { id: 'overview', color: '#1e3a6e', icon: 'home', label: 'Overview' },
  { id: 'student', color: '#0e7490', icon: 'student', label: 'Student Analyser' },
  { id: 'subject', color: '#b45309', icon: 'subject', label: 'Subject Analysis' },
  { id: 'batch', color: '#047857', icon: 'batch', label: 'Batch / Test Report' },
  { id: 'groups', color: '#be185d', icon: 'groups', label: 'Self-Study Groups' },
  { id: 'revision', color: '#0369a1', icon: 'subject', label: 'Revision Plan' },
  { id: 'data', color: '#6d28d9', icon: 'data', label: 'Upload & Data' },
];

const fx = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : String(Math.round(n * 10 ** d) / 10 ** d));
const sgn = (n, d = 1) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : `${n > 0 ? '+' : ''}${fx(n, d)}`);
const tone = (v, g = 0) => (v > g ? '#047857' : v < -g ? '#b91c1c' : '#4b5870');

const Svg = ({ html, minW }) => <div className="mta-svg"><div style={minW ? { '--mw': `${minW}px` } : undefined} dangerouslySetInnerHTML={{ __html: html }} /></div>;
const Pill = ({ text, color }) => <span style={{ background: color, color: '#fff', borderRadius: 10, padding: '1px 9px', fontSize: 11, fontWeight: 700 }}>{text}</span>;
const Stat = ({ label, value, sub, color = '#0f1b2e' }) => (
  <div style={{ flex: '1 1 calc(50% - 10px)', minWidth: 130, boxSizing: 'border-box', background: '#fff', border: '1px solid #e8e3d8', borderLeft: `4px solid ${color}`, borderRadius: 14, padding: '10px 12px', boxShadow: '0 2px 8px rgba(19,42,79,.05)' }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: .8 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.25 }}>{value}</div>
    {sub ? <div style={{ fontSize: 11.5, color: '#5d6b82' }}>{sub}</div> : null}
  </div>
);
const Field = ({ label, children, grow }) => (
  <div className={grow ? 'mta-field mta-grow' : 'mta-field'} style={{ flex: grow ? '1 1 220px' : '0 1 auto' }}><span style={ui.label}>{label}</span>{children}</div>
);
const Table = ({ head, children, maxH }) => (
  <div className="mta-tbl" style={{ overflow: 'auto', maxHeight: maxH, border: '1px solid #e8e3d8', borderRadius: 12 }}>
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead><tr>{head.map((h, i) => <th key={i} style={{ ...ui.th, textAlign: i === 0 ? 'left' : 'center' }}>{h}</th>)}</tr></thead>
      <tbody>{children}</tbody>
    </table>
  </div>
);
const heatBg = (p) => (p === null || p === undefined ? '#fff' : p >= 75 ? '#bbf7d0' : p >= 60 ? '#e4ebf6' : p >= 45 ? '#fef3c7' : '#fecaca');

// Phone layout (<= 640px).  Scoped to .mta so nothing else in the portal is touched.
const MOBILE_CSS = `
@media screen and (max-width: 640px) {
  .mta select, .mta input:not([type=file]) { font-size: 16px !important; }
  .mta button { min-height: 40px; }
  .mta td button, .mta summary { min-height: 0; }
  .mta .mta-field { flex: 1 1 calc(50% - 6px) !important; min-width: 0; }
  .mta .mta-grow { flex: 1 1 100% !important; }
  .mta .mta-field select, .mta .mta-field input:not([type=file]) { width: 100% !important; box-sizing: border-box; }
  .mta .mta-half { flex: 1 1 calc(50% - 6px); }
  .mta .mta-svg { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .mta .mta-svg > div { min-width: var(--mw, 0); }
  /* sub-tabs: two per row, every tab visible (no sideways scrolling) */
  .mta .mta-tabs { display: grid !important; grid-template-columns: 1fr 1fr; gap: 6px !important; }
  .mta .mta-tab { width: 100%; min-width: 0; min-height: 40px; padding: 4px 10px 4px 5px !important; gap: 7px !important; font-size: 12.5px !important; white-space: normal !important; text-align: left; line-height: 1.2; }
  .mta .mta-tab > span:first-child { width: 26px !important; height: 26px !important; }
}`;

// scope: 'pre' = the Pre Mock Test tab, 'mega' = the Mega Mock Test tab. Each keeps its own series.
export default function MockTestAnalyzer({ institute, currentUser, canUpload = true, canDelete = false, scope = 'pre' }) {
  const mega = scope === 'mega';
  const homeSeries = mega ? MEGA_SERIES : DEFAULT_SERIES;
  const [tab, setTab] = useState('overview');
  const [allRows, setAllRows] = useState([]);
  const [mode, setMode] = useState('cloud');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [series, setSeries] = useState(homeSeries);
  // Pass marks live per series in Supabase (mock_test_settings) so they follow the user across devices.
  const [cfg, setCfg] = useState({});
  const cfgRef = useRef({});
  const cfgMode = useRef('local');
  const saveTimer = useRef(null);
  const cur = cfg[series] || {};
  const passPct = cur.passPct ?? 40;
  const passBy = cur.passBy || NO_BATCH_MARKS;
  const updateCfg = useCallback((patch) => {
    const next = { ...(cfgRef.current[series] || {}), ...patch };
    cfgRef.current = { ...cfgRef.current, [series]: next };
    setCfg(cfgRef.current);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSettings(series, { passPct: next.passPct ?? 40, passBy: next.passBy || {} }, cfgMode.current, currentUser?.username || currentUser?.name || '')
        .catch((e) => setErr(`Could not save the pass mark: ${e.message || e}`));
    }, 500);
  }, [series, currentUser]);
  const setPassPct = useCallback((v) => updateCfg({ passPct: v }), [updateCfg]);
  const setBatchPass = useCallback((b, v) => {
    const n = { ...(cfgRef.current[series]?.passBy || {}) };
    if (v === '') delete n[b]; else n[b] = Math.max(0, Math.min(100, Number(v) || 0));
    updateCfg({ passBy: n });
  }, [series, updateCfg]);
  const [fixes, setFixes] = useState([]);
  const [fixMode, setFixMode] = useState('cloud');

  const apply = useCallback((r) => {
    setAllRows(r.rows); setMode(r.mode); setNote(r.note); setErr('');
    const names = [...new Set(r.rows.map((x) => x.series))].filter((n) => inScope(n, scope));
    setSeries((cur) => (names.length && !names.includes(cur) ? names[0] : cur));
  }, [scope]);
  const applyFix = useCallback((f) => { setFixes(f.fixes); setFixMode(f.mode); }, []);
  const reload = useCallback(async () => {
    try { apply(await loadAll()); applyFix(await loadFixes()); } catch (e) { setErr(e.message || String(e)); }
  }, [apply, applyFix]);
  useEffect(() => {
    let live = true;
    Promise.all([loadAll(), loadFixes().catch(() => ({ fixes: [], mode: 'local' })), loadSettings().catch(() => ({ settings: {}, mode: 'local' }))])
      .then(([r, f, st]) => { if (live) { apply(r); applyFix(f); cfgRef.current = st.settings; cfgMode.current = st.mode; setCfg(st.settings); } })
      .catch((e) => { if (live) setErr(e.message || String(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [apply, applyFix]);

  const seriesNames = useMemo(() => [...new Set(allRows.map((r) => r.series))].filter((n) => inScope(n, scope)).sort(), [allRows, scope]);
  // uploaded rows -> saved Student Data Fix Engine rules -> identity matching
  const seriesRaw = useMemo(() => allRows.filter((r) => r.series === series), [allRows, series]);
  const resolved = useMemo(() => resolveIdentities(applyFixes(seriesRaw, fixes.filter((f) => !f.series || f.series === series))), [seriesRaw, fixes, series]);
  // Custom data filter: every analysis tab sees only the filtered rows; the
  // Upload & Data tab keeps working on the full records.
  const [filter, setFilter] = useState(emptyFilter);
  const filterOn = isFilterActive(filter);
  const rows = useMemo(() => applyDataFilter(resolved, filter), [resolved, filter]);
  const metaAll = useMemo(() => seriesMeta(resolved), [resolved]);
  const meta = useMemo(() => seriesMeta(rows), [rows]);
  const changeSeries = useCallback((s) => { setSeries(s); setFilter(emptyFilter()); }, []);
  // Remount the analysis views when the available batches / tests / subjects change,
  // so a stale dropdown selection can never point at data the filter removed.
  const viewKey = `${meta.batches.join('|')}#${meta.tests.join('|')}#${meta.subjects.join('|')}`;
  const seriesLabel = filterOn ? `${series} (filtered)` : series;
  const who = currentUser?.username || currentUser?.name || '';

  const header = (
    <div style={{ ...ui.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: 12 }}>
      <Field label="Test series">
        <select style={ui.input} value={series} onChange={(e) => changeSeries(e.target.value)}>
          {[...new Set([...seriesNames, series])].map((s) => <option key={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Pass mark (%)"><input type="number" min={0} max={100} style={{ ...ui.input, width: 80 }} value={passPct} onChange={(e) => setPassPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} /></Field>
      {metaAll.batches.map((b) => (
        <Field key={b} label={`${b} pass (%)`}>
          <input type="number" min={0} max={100} placeholder={String(passPct)} style={{ ...ui.input, width: 80 }} value={passBy[b] ?? ''} onChange={(e) => setBatchPass(b, e.target.value)} />
        </Field>
      ))}
      <div style={{ fontSize: 12, color: '#5d6b82', paddingBottom: 8 }}>
        {rows.length ? `${meta.tests.length} tests · ${meta.batches.length} batches · ${new Set(rows.map((r) => r.sid)).size} students · ${rows.length} results${filterOn ? ` (of ${resolved.length})` : ''}` : (resolved.length ? 'No results match the filter' : 'No results saved for this series yet')}
        {' · '}<b style={{ color: mode === 'cloud' ? '#047857' : '#b45309' }}>{mode === 'cloud' ? 'Saved to database' : 'Saved in this browser only'}</b>
      </div>
    </div>
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#8a93a6' }}>⏳ Loading mock-test records…</div>;

  return (
    <ResponsiveTables><div className="mta">
      <style>{MOBILE_CSS}</style>
      {note ? <div style={{ ...ui.card, background: '#FFFBEB', borderColor: '#FCD34D', fontSize: 13, color: '#92400E' }}>⚠️ {note}</div> : null}
      {err ? <div style={{ ...ui.card, background: '#FEF2F2', borderColor: '#FCA5A5', fontSize: 13, color: '#991B1B' }}>❌ {err}</div> : null}
      {header}
      {resolved.length ? <FilterPanel filter={filter} setFilter={setFilter} metaAll={metaAll} resolved={resolved} shown={rows.length} total={resolved.length} /> : null}
      <div className="mta-tabs" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '0 0 12px', padding: '2px 0 6px' }}>
        {SUBTABS.map((t) => (
          <button key={t.id} className="mta-tab" onClick={() => setTab(t.id)} style={{ ...ui.ghost, flex: '0 1 auto', borderRadius: 999, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 9, padding: '6px 16px 6px 7px', ...(tab === t.id ? { background: NAVY, color: '#fff', border: `1px solid ${NAVY}`, boxShadow: '0 4px 10px rgba(19,42,79,.25)' } : {}) }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 999, flexShrink: 0, color: tab === t.id ? '#f3d58a' : t.color, background: tab === t.id ? 'rgba(255,255,255,.16)' : `${t.color}1F` }}><ExamIcon id={t.icon} size={17} stroke={2} /></span>{t.label}</button>
        ))}
      </div>
      {!rows.length && tab !== 'data' && tab !== 'revision' ? (
        resolved.length ? (
          <div style={{ ...ui.card, textAlign: 'center', padding: 36 }}>
            <div style={{ fontSize: 34 }}>🔎</div>
            <div style={{ fontWeight: 700, margin: '6px 0' }}>No results match the current filter</div>
            <div style={{ color: '#5d6b82', fontSize: 13, marginBottom: 12 }}>{describeFilter(filter)}</div>
            <button style={ui.btn} onClick={() => setFilter(emptyFilter())}>Clear filter</button>
          </div>
        ) : (
        <div style={{ ...ui.card, textAlign: 'center', padding: 36 }}>
          <div style={{ fontSize: 34 }}>📊</div>
          <div style={{ fontWeight: 700, margin: '6px 0' }}>No mock-test results for “{series}” yet</div>
          <div style={{ color: '#5d6b82', fontSize: 13, marginBottom: 12 }}>{mega ? 'Upload the Mega Mock Test Excel result sheets to start analysing.' : 'Upload the Excel result sheets (or load the built-in Pre Mock Test 2026 data) to start analysing.'}</div>
          <button style={ui.btn} onClick={() => setTab('data')}>Go to Upload &amp; Data</button>
        </div>
        )
      ) : null}
      {rows.length && tab === 'overview' ? <Overview key={viewKey} rows={rows} meta={meta} passPct={passPct} passBy={passBy} institute={institute} series={seriesLabel} /> : null}
      {rows.length && tab === 'student' ? <StudentView key={viewKey} rows={rows} meta={meta} passPct={passPct} passBy={passBy} institute={institute} series={seriesLabel} /> : null}
      {rows.length && tab === 'subject' ? <SubjectView key={viewKey} rows={rows} meta={meta} passPct={passPct} passBy={passBy} institute={institute} series={seriesLabel} /> : null}
      {rows.length && tab === 'batch' ? <BatchView key={viewKey} rows={rows} meta={meta} passPct={passPct} passBy={passBy} institute={institute} series={seriesLabel} /> : null}
      {rows.length && tab === 'groups' ? <GroupsView key={`${series}|${viewKey}`} rows={rows} institute={institute} series={seriesLabel} seriesName={series} canEdit={canUpload} who={who} passPct={passPct} currentUser={currentUser} /> : null}
      {tab === 'revision' ? <MockRevisionPlan key={`${series}|${viewKey}`} rows={rows} series={seriesLabel} passPct={passPct} institute={institute} /> : null}
      {tab === 'data' ? (
        <DataView scope={scope} allRows={allRows} rawRows={seriesRaw} rows={resolved} fixes={fixes} fixMode={fixMode} series={series} setSeries={changeSeries} mode={mode} meta={metaAll} who={who}
          canUpload={canUpload} canDelete={canDelete} reload={reload} />
      ) : null}
    </div></ResponsiveTables>
  );
}

// ─── Data filter ──────────────────────────────────────────────────────────────
const chip = (on) => ({ padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? NAVY : '#d9d2c2'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#2e3b52' });
const EMPTY_OBJ = {};
const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function FilterPanel({ filter, setFilter, metaAll, resolved, shown, total }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState('');
  const [presets, setPresets] = useState(loadPresets);
  const [presetName, setPresetName] = useState('');
  const roster = useMemo(() => studentRoster(resolved), [resolved]);
  const byId = useMemo(() => new Map(roster.map((s) => [s.sid, s])), [roster]);
  const on = isFilterActive(filter);
  const set = (patch) => setFilter((f) => ({ ...f, ...patch }));
  const matches = useMemo(() => {
    const t = pick.trim().toLowerCase();
    if (!t) return [];
    return roster.filter((s) => !filter.students.includes(s.sid) && `${s.name} ${s.gcc}`.toLowerCase().includes(t)).slice(0, 8);
  }, [pick, roster, filter.students]);

  const savePreset = () => {
    const name = presetName.trim();
    if (!name || !on) return;
    const next = [...presets.filter((p) => p.name !== name), { name, filter }];
    setPresets(next); savePresets(next); setPresetName('');
  };
  const removePreset = (name) => { const next = presets.filter((p) => p.name !== name); setPresets(next); savePresets(next); };
  // Only apply the parts of a saved preset that still exist in this series.
  const loadPreset = (p) => setFilter({
    ...emptyFilter(), ...p.filter,
    batches: (p.filter.batches || []).filter((b) => metaAll.batches.includes(b)),
    tests: (p.filter.tests || []).filter((t) => metaAll.tests.includes(t)),
    subjects: (p.filter.subjects || []).filter((x) => metaAll.subjects.includes(x)),
    students: (p.filter.students || []).filter((id) => byId.has(id)),
  });

  const group = (label, children) => <div style={{ marginBottom: 12 }}><span style={ui.label}>{label}</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div></div>;

  return (
    <div style={{ ...ui.card, padding: 12, borderColor: on ? '#c9a24b' : '#e8e3d8', background: on ? '#fffdf6' : '#fff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button style={{ ...ui.ghost, ...(open ? { background: NAVY, color: '#fff', border: `1px solid ${NAVY}` } : {}) }} onClick={() => setOpen((o) => !o)} aria-expanded={open}>🎛️ Data filter {open ? '▲' : '▼'}</button>
        <div style={{ fontSize: 12.5, color: on ? '#7a5b10' : '#5d6b82', flex: '1 1 200px', minWidth: 0 }}>
          {on ? <><b>Showing {shown} of {total} results</b> · {describeFilter(filter)}</> : 'Showing all results. Filter by batch, test, subject, or pick students manually.'}
        </div>
        {on ? <button style={ui.ghost} onClick={() => setFilter(emptyFilter())}>✕ Clear filter</button> : null}
      </div>

      {open ? (
        <div style={{ marginTop: 14, borderTop: '1px solid #eee7d6', paddingTop: 14 }}>
          {group('Batches (none selected = all)', metaAll.batches.map((b) => <button key={b} style={chip(filter.batches.includes(b))} onClick={() => set({ batches: toggleIn(filter.batches, b) })}>{b}</button>))}
          {group('Tests (none selected = all)', metaAll.tests.map((t) => <button key={t} style={chip(filter.tests.includes(t))} title={metaAll.testNames[t] || ''} onClick={() => set({ tests: toggleIn(filter.tests, t).sort((a, c) => a - c) })}>T{t}</button>))}
          {group('Subjects (totals & ranks are recalculated from the chosen subjects)', metaAll.subjects.map((x) => <button key={x} style={chip(filter.subjects.includes(x))} onClick={() => set({ subjects: toggleIn(filter.subjects, x) })}>{x}</button>))}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
            <Field label="Name / GCC contains"><input style={ui.input} value={filter.q} onChange={(e) => set({ q: e.target.value })} placeholder="e.g. Singh or 1234" /></Field>
            <Field label="Min. tests taken"><input type="number" min={0} style={{ ...ui.input, width: 90 }} value={filter.minTests} onChange={(e) => set({ minTests: Math.max(0, Number(e.target.value) || 0) })} /></Field>
            <Field label="Student avg % from"><input type="number" min={0} max={100} style={{ ...ui.input, width: 90 }} value={filter.avgMin} onChange={(e) => set({ avgMin: e.target.value })} placeholder="0" /></Field>
            <Field label="to"><input type="number" min={0} max={100} style={{ ...ui.input, width: 90 }} value={filter.avgMax} onChange={(e) => set({ avgMax: e.target.value })} placeholder="100" /></Field>
          </div>

          <div style={{ marginBottom: 12 }}>
            <span style={ui.label}>Manual student selection</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <button style={chip(filter.studentMode === 'exclude')} onClick={() => set({ studentMode: 'exclude' })}>Everyone except these</button>
              <button style={chip(filter.studentMode === 'only')} onClick={() => set({ studentMode: 'only' })}>Only these students</button>
            </div>
            <div style={{ position: 'relative', maxWidth: 420 }}>
              <input style={{ ...ui.input, width: '100%', boxSizing: 'border-box' }} value={pick} onChange={(e) => setPick(e.target.value)} placeholder="Search a student to add…" />
              {matches.length ? (
                <div style={{ position: 'absolute', zIndex: 5, left: 0, right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1px solid #d9d2c2', borderRadius: 12, boxShadow: '0 8px 24px rgba(19,42,79,.15)', overflow: 'hidden' }}>
                  {matches.map((m) => (
                    <button key={m.sid} onClick={() => { set({ students: [...filter.students, m.sid] }); setPick(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', border: 0, borderBottom: '1px solid #f1ecdf', background: '#fff', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                      {m.name}{m.gcc ? ` · GCC ${m.gcc}` : ''} <span style={{ color: '#8a93a6' }}>· {m.batch}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {filter.students.length ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {filter.students.map((id) => (
                  <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 12px', borderRadius: 999, background: filter.studentMode === 'only' ? '#e4ebf6' : '#fee2e2', fontSize: 12.5, fontWeight: 600 }}>
                    {byId.get(id)?.name || id}
                    <button aria-label="Remove" onClick={() => set({ students: filter.students.filter((x) => x !== id) })} style={{ border: 0, background: 'rgba(0,0,0,.08)', borderRadius: '50%', width: 20, height: 20, minHeight: 0, cursor: 'pointer', lineHeight: 1 }}>×</button>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div style={{ borderTop: '1px solid #eee7d6', paddingTop: 12 }}>
            <span style={ui.label}>Saved filters (this browser)</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {presets.map((p) => (
                <span key={p.name} style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid #d9d2c2', borderRadius: 999, overflow: 'hidden' }}>
                  <button onClick={() => loadPreset(p)} style={{ border: 0, background: '#fff', padding: '5px 10px 5px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', minHeight: 0 }}>{p.name}</button>
                  <button aria-label={`Delete ${p.name}`} onClick={() => removePreset(p.name)} style={{ border: 0, borderLeft: '1px solid #eee7d6', background: '#faf7ef', padding: '5px 9px', cursor: 'pointer', minHeight: 0 }}>×</button>
                </span>
              ))}
              {!presets.length ? <span style={{ fontSize: 12.5, color: '#8a93a6' }}>None yet</span> : null}
              <input style={{ ...ui.input, width: 160 }} value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Name this filter" />
              <button style={ui.ghost} disabled={!on || !presetName.trim()} onClick={savePreset}>💾 Save</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Overview ─────────────────────────────────────────────────────────────────
const passLabel = (b) => (b.passMixed ? 'Pass (per-batch mark)' : `Pass ≥ ${b.passPct}%`);

function Overview({ rows, meta, passPct, passBy, institute, series }) {
  const cmp = useMemo(() => batchComparison(rows, passPct, passBy), [rows, passPct, passBy]);
  const all = useMemo(() => batchAnalysis(rows, '', null, { passPct, passByBatch: passBy }), [rows, passPct, passBy]);
  const subs = meta.subjects;
  const leaderboard = useMemo(() => [...all.students].sort((a, b) => b.avgTotal - a.avgTotal || b.avgPct - a.avgPct || a.name.localeCompare(b.name)), [all]);
  const trend = lineChart({
    labels: all.perTest.map((t) => `T${t.test_no}`), yMax: 100, unit: '%', title: 'Institute average % by test',
    series: [{ name: 'Overall', color: NAVY, values: all.perTest.map((t) => t.avgPct), thick: true },
      ...subs.map((s) => ({ name: s, color: subjColor(subs, s), values: all.perTest.map((t) => t.subj[s]?.avgPct ?? null) }))],
  });
  const batchBars = barChart({
    title: 'Batch average % by subject', yMax: 100, unit: '%',
    groups: cmp.map((c) => ({ label: c.batch, bars: subs.map((s) => ({ name: s, value: c.subj[s] ?? null, color: subjColor(subs, s) })) })),
  });
  return (
    <>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat label="Students" value={all.studentCount} sub={`${all.rowsCount} results`} color={NAVY} />
        <Stat label="Overall average" value={`${fx(all.avgPct)}%`} color={strengthLabel(all.avgPct, passPct).color} />
        <Stat label={passLabel(all)} value={`${fx(all.pass, 0)}%`} color={all.pass >= 75 ? '#047857' : '#b45309'} />
        <Stat label="Strongest subject" value={all.easiest.subject} sub={`${fx(all.easiest.avgPct)}% avg`} color="#047857" />
        <Stat label="Weakest subject" value={all.toughest.subject} sub={`${fx(all.toughest.avgPct)}% avg`} color="#b91c1c" />
        <Stat label="At risk" value={all.atRisk.length} sub="students" color="#b91c1c" />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...ui.card, flex: '1 1 min(420px, 100%)' }}><Svg minW={520} html={trend} /></div>
        <div style={{ ...ui.card, flex: '1 1 min(420px, 100%)' }}><Svg minW={520} html={batchBars} /></div>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 4px' }}>🏆 Toppers → lowest — total marks of all subjects</h4>
        <div style={{ fontSize: 12.5, color: '#5d6b82', marginBottom: 8 }}>Ranked by average total marks across all tests ({all.students.length} students, all batches).</div>
        <Table maxH={560} head={['#', 'Student', 'GCC', 'Batch', 'Tests', 'Avg total', 'Out of', 'Avg %', 'Best total']}>
          {leaderboard.map((s, i) => (
            <tr key={s.sid}><td style={{ ...ui.td, fontWeight: 700 }}>{i + 1}</td><td style={{ ...ui.td, textAlign: 'left', fontWeight: 600 }}>{s.name}</td><td style={ui.td}>{s.gcc || '—'}</td><td style={ui.td}>{s.batch}</td><td style={ui.td}>{s.tests}</td>
              <td style={{ ...ui.td, fontWeight: 700 }}>{fx(s.avgTotal, 2)}</td><td style={ui.td}>{s.max ?? '—'}</td>
              <td style={{ ...ui.td, fontWeight: 700, color: strengthLabel(s.avgPct, passPct).color }}>{fx(s.avgPct)}%</td><td style={ui.td}>{fx(s.best, 2)}</td></tr>
          ))}
        </Table>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Batch comparison</h4>
        <Table head={['Batch', 'Students', 'Tests', 'Avg %', 'Pass % (mark)', 'Highest', ...subs.map((s) => `${s} %`)]}>
          {cmp.map((c) => (
            <tr key={c.batch}>
              <td style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>{c.batch}</td><td style={ui.td}>{c.students}</td><td style={ui.td}>{c.tests}</td>
              <td style={{ ...ui.td, fontWeight: 700, color: strengthLabel(c.avgPct, c.passPct).color }}>{fx(c.avgPct)}%</td><td style={ui.td}>{fx(c.pass, 0)}% <span style={{ color: '#8a93a6', fontSize: 11 }}>(≥{c.passPct})</span></td><td style={ui.td}>{fx(c.high, 2)}</td>
              {subs.map((s) => <td key={s} style={{ ...ui.td, background: heatBg(c.subj[s]) }}>{fx(c.subj[s])}%</td>)}
            </tr>
          ))}
        </Table>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Subject difficulty — all batches</h4>
        <Svg minW={440} html={hBars({ items: [...all.perSubject].sort((a, b) => a.avgPct - b.avgPct).map((s) => ({ label: s.subject, value: s.avgPct, color: subjColor(subs, s.subject) })), width: 640 })} />
        <div style={{ marginTop: 10 }}>
          <button style={ui.btn} onClick={() => printDocument(batchReportHTML(all, { institute, series }), `${series} — Institute report`, institute)}>🖨️ Print institute report</button>
        </div>
      </div>
    </>
  );
}

// ─── Student analyser ─────────────────────────────────────────────────────────
function StudentView({ rows, meta, passPct, passBy, institute, series }) {
  const [batch, setBatch] = useState('');
  const [q, setQ] = useState('');
  const [pickedSid, setSid] = useState('');

  const roster = useMemo(() => {
    const last = new Map();
    rows.forEach((r) => { const c = last.get(r.sid); if (!c || r.test_no >= c.test_no) last.set(r.sid, r); });
    return [...last.values()].map((r) => ({
      sid: r.sid, batch: r.batch, gcc: gccDigits(r.gcc_no),
      name: cleanName(rows.filter((x) => x.sid === r.sid).map((x) => x.student_name).sort((a, b) => b.length - a.length)[0]),
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const list = useMemo(() => roster.filter((s) => (!batch || s.batch === batch) && (!q || (s.name + ' ' + s.gcc).toLowerCase().includes(q.toLowerCase()))), [roster, batch, q]);
  const sid = list.some((s) => s.sid === pickedSid) ? pickedSid : (list[0]?.sid || '');

  const a = useMemo(() => (sid ? studentAnalysis(rows, sid, { passPct, passByBatch: passBy }) : null), [rows, sid, passPct, passBy]);
  const idx = list.findIndex((s) => s.sid === sid);
  const ctx = { institute, series };

  const printAll = () => {
    const html = list.map((s) => studentReportHTML(studentAnalysis(rows, s.sid, { passPct, passByBatch: passBy }), ctx)).join('');
    printDocument(html, `${series} — Student reports${batch ? ' · ' + batch : ''}`, institute);
  };

  return (
    <>
      <div style={{ ...ui.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: 12 }}>
        <Field label="Batch">
          <select style={ui.input} value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">All batches</option>{meta.batches.map((b) => <option key={b}>{b}</option>)}</select>
        </Field>
        <Field label="Search name / GCC"><input style={ui.input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to filter…" /></Field>
        <Field label={`Student (${list.length})`} grow>
          <select style={{ ...ui.input, width: '100%' }} value={sid} onChange={(e) => setSid(e.target.value)}>
            {list.map((s) => <option key={s.sid} value={s.sid}>{s.name}{s.gcc ? ` · GCC ${s.gcc}` : ''} · {s.batch}</option>)}
          </select>
        </Field>
        <button className="mta-half" style={ui.ghost} disabled={idx <= 0} onClick={() => setSid(list[idx - 1].sid)}>◀ Prev</button>
        <button className="mta-half" style={ui.ghost} disabled={idx < 0 || idx >= list.length - 1} onClick={() => setSid(list[idx + 1].sid)}>Next ▶</button>
      </div>
      {!a ? <div style={ui.card}>No student matches the filter.</div> : <StudentCard a={a} onPrint={() => printDocument(studentReportHTML(a, ctx), `${a.name} — Performance report`, institute)} onPrintAll={printAll} count={list.length} batch={batch} />}
    </>
  );
}

function StudentCard({ a, onPrint, onPrintAll, count, batch }) {
  const S = a.summary, subs = a.subjects;
  const labels = a.tests.map((t) => `T${t.test_no}`);
  const score = lineChart({ labels, yMax: 100, unit: '%', title: 'Overall score % vs batch average', series: [
    { name: a.name.slice(0, 22), color: NAVY, values: a.tests.map((t) => t.pct), thick: true },
    { name: 'Batch average', color: '#8a93a6', values: a.tests.map((t) => (t.cohortAvg / t.max) * 100), dashed: true }] });
  const subj = lineChart({ labels, yMax: 100, unit: '%', title: 'Subject-wise trend (%)', series: subs.map((s) => ({ name: s, color: subjColor(subs, s), values: a.tests.map((t) => t.subj[s]?.pct ?? null) })) });
  const rank = lineChart({ labels, yMin: 0, yMax: Math.max(5, ...a.tests.map((t) => t.n)), title: 'Class rank by test (lower is better)', series: [{ name: 'Rank', color: '#be123c', values: a.tests.map((t) => t.rank), thick: true }] });
  const radar = radarChart({ title: 'Subject profile (avg %)', axes: a.subjSummary.map((s) => ({ label: s.subject })), series: [
    { name: 'Student', color: NAVY, values: a.subjSummary.map((s) => s.avgPct), fill: 0.22 },
    { name: 'Batch avg', color: '#d97706', values: a.subjSummary.map((s) => s.cohortAvgPct), fill: 0.05, dashed: true }] });
  return (
    <>
      <div style={{ ...ui.card, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 min(260px, 100%)' }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>{a.name}</div>
          <div style={{ fontSize: 13, color: '#5d6b82' }}>GCC {a.gcc || '—'} · {a.batch}{a.batches.length > 1 ? ` (also ${a.batches.filter((b) => b !== a.batch).join(', ')})` : ''} · {S.testsAttended} of {S.testsHeld} tests</div>
          <div style={{ marginTop: 4 }}><Pill text={S.band.label} color={S.band.color} /> {S.atRisk ? <Pill text="At risk" color="#b91c1c" /> : null} <Pill text={S.avgPct >= S.passPct ? `Avg ≥ ${S.passPct}% pass mark` : `Avg below ${S.passPct}% pass mark`} color={S.avgPct >= S.passPct ? '#047857' : '#b91c1c'} /></div>
        </div>
        <button style={ui.btn} onClick={onPrint}>🖨️ Print report</button>
        <button style={ui.ghost} onClick={onPrintAll}>🖨️ Print all {count}{batch ? ` in ${batch}` : ''}</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat label="Average" value={`${fx(S.avgTotal)}/${a.maxTotal}`} sub={`${fx(S.avgPct)}%`} color={S.band.color} />
        <Stat label="Best rank" value={S.bestRank} sub={`Latest ${S.latest.rank} of ${S.latest.n}`} color={NAVY} />
        <Stat label="Best score" value={fx(S.best.total, 2)} sub={`Test ${S.best.test_no}`} color="#047857" />
        <Stat label="Trend" value={S.trendLabel} sub={`${sgn(S.trend, 2)} pts / test`} color={tone(S.trend, 1.5)} />
        <Stat label="Consistency" value={fx(S.consistency)} sub={S.consistencyLabel} color="#4b5870" />
        <Stat label="Next test (proj.)" value={S.predictedTotal === null ? '—' : fx(S.predictedTotal)} sub={S.predictedPct === null ? '' : `${fx(S.predictedPct)}%`} color="#a7771f" />
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Test-wise performance</h4>
        <Table head={['Test', 'Batch', ...subs, 'Total', '%', 'Result', 'Rank', 'Pctile', 'Batch avg', '± avg']}>
          {a.tests.map((t) => (
            <tr key={t.test_no}>
              <td style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>T{t.test_no}</td><td style={ui.td}>{t.batch}</td>
              {subs.map((s) => <td key={s} style={{ ...ui.td, background: heatBg(t.subj[s]?.pct) }}>{t.subj[s] ? fx(t.subj[s].marks, 2) : '—'}</td>)}
              <td style={{ ...ui.td, fontWeight: 700 }}>{fx(t.total, 2)}/{t.max}</td><td style={{ ...ui.td, fontWeight: 700, color: t.passed ? '#047857' : '#b91c1c' }}>{fx(t.pct)}%</td>
              <td style={{ ...ui.td, fontWeight: 700, color: t.passed ? '#047857' : '#b91c1c' }}>{t.passed ? 'Pass' : 'Fail'} <span style={{ color: '#8a93a6', fontSize: 11, fontWeight: 400 }}>(≥{t.passPct})</span></td>
              <td style={ui.td}><b>{t.rank}</b>/{t.n}</td><td style={ui.td}>{fx(t.percentile, 0)}</td><td style={ui.td}>{fx(t.cohortAvg)}</td>
              <td style={{ ...ui.td, fontWeight: 700, color: tone(t.diff) }}>{sgn(t.diff)}</td>
            </tr>
          ))}
        </Table>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...ui.card, flex: '1 1 min(400px, 100%)' }}><Svg minW={520} html={score} /></div>
        <div style={{ ...ui.card, flex: '1 1 min(400px, 100%)' }}><Svg minW={520} html={rank} /></div>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Subject-wise analysis</h4>
        <Table head={['Subject', 'Avg', 'Avg %', 'Best', 'Lowest', 'Latest', 'Batch %', '± batch', 'Trend', 'SD', 'Batch rank', 'Status']}>
          {a.subjSummary.map((s) => (
            <tr key={s.subject}>
              <td style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}><span style={{ color: subjColor(subs, s.subject) }}>■</span> {s.subject} <small style={{ color: '#8a93a6' }}>/{s.max}</small></td>
              <td style={ui.td}>{fx(s.avg, 2)}</td><td style={{ ...ui.td, fontWeight: 700, color: s.label.color }}>{fx(s.avgPct)}%</td>
              <td style={ui.td}>{fx(s.best.marks, 2)} <small>T{s.best.test_no}</small></td><td style={ui.td}>{fx(s.worst.marks, 2)} <small>T{s.worst.test_no}</small></td>
              <td style={ui.td}>{fx(s.latest.marks, 2)}</td><td style={ui.td}>{fx(s.cohortAvgPct)}%</td>
              <td style={{ ...ui.td, fontWeight: 700, color: tone(s.gapPct, 1) }}>{sgn(s.gapPct)}</td>
              <td style={{ ...ui.td, color: tone(s.trend, 1.5) }}>{s.trendLabel} <small>({sgn(s.trend, 2)})</small></td>
              <td style={ui.td}>{fx(s.consistency)}</td><td style={ui.td}>{s.batchRank ?? '—'}/{s.batchSize}</td>
              <td style={ui.td}><Pill text={s.label.label} color={s.label.color} /></td>
            </tr>
          ))}
        </Table>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...ui.card, flex: '1 1 min(400px, 100%)' }}><Svg minW={520} html={subj} /></div>
        <div style={{ ...ui.card, flex: '1 1 min(300px, 100%)', display: 'flex', justifyContent: 'center' }}><Svg html={radar} /></div>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Where the marks are being lost</h4>
        <Table head={['#', 'Subject', 'Average', 'Marks lost / test', 'Gap to own best', 'Action']}>
          {a.focus.map((s, i) => (
            <tr key={s.subject}><td style={ui.td}>{i + 1}</td><td style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>{s.subject}</td>
              <td style={ui.td}>{fx(s.avg, 2)} / {s.max}</td><td style={ui.td}>{fx(s.lost, 2)}</td><td style={ui.td}>{fx(s.max - s.best.marks, 2)}</td>
              <td style={ui.td}>{i === 0 ? <Pill text="Priority" color="#b91c1c" /> : i === 1 ? <Pill text="Next" color="#b45309" /> : <Pill text="Maintain" color="#047857" />}</td></tr>
          ))}
        </Table>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Insights &amp; recommendations</h4>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7 }}>{a.insights.map((i, k) => <li key={k}>{i}</li>)}</ul>
      </div>
    </>
  );
}

// ─── Subject analysis ─────────────────────────────────────────────────────────
function SubjectView({ rows, meta, passPct, passBy, institute, series }) {
  const [batch, setBatch] = useState('');
  const [test, setTest] = useState('');
  const [pickedSubject, setSubject] = useState('');
  const subject = meta.subjects.includes(pickedSubject) ? pickedSubject : (meta.subjects[0] || '');
  const b = useMemo(() => batchAnalysis(rows, batch, test === '' ? null : Number(test), { passPct, passByBatch: passBy }), [rows, batch, test, passPct, passBy]);
  if (!b) return <div style={ui.card}>No results for this selection.</div>;
  const ps = b.perSubject.find((s) => s.subject === subject) || b.perSubject[0];
  if (!ps) return null;
  const col = subjColor(meta.subjects, ps.subject);
  const tests = b.meta.tests;
  const ranked = b.students.filter((s) => s.sub[ps.subject] !== undefined).sort((x, y) => y.sub[ps.subject] - x.sub[ps.subject]);
  const trend = tests.length > 1 ? lineChart({ labels: tests.map((t) => `T${t}`), yMax: 100, unit: '%', title: `${ps.subject} — average % by test`, series: [{ name: ps.subject, color: col, values: ps.byTest.map((x) => x.avgPct), thick: true }] }) : '';
  const compare = barChart({ title: 'This subject vs other subjects (avg %)', yMax: 100, unit: '%', groups: b.perSubject.map((s) => ({ label: s.subject, bars: [{ name: 'Average %', value: s.avgPct, color: s.subject === ps.subject ? col : '#d9d2c2' }] })) });
  return (
    <>
      <div style={{ ...ui.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: 12 }}>
        <Field label="Subject"><select style={ui.input} value={ps.subject} onChange={(e) => setSubject(e.target.value)}>{meta.subjects.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Batch"><select style={ui.input} value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">All batches</option>{meta.batches.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Test"><select style={ui.input} value={test} onChange={(e) => setTest(e.target.value)}><option value="">All tests</option>{meta.tests.map((t) => <option key={t} value={t}>Test {t}</option>)}</select></Field>
        <button style={ui.btn} onClick={() => printDocument(subjectReportHTML(b, ps.subject, { institute, series }), `${ps.subject} — Subject analysis`, institute)}>🖨️ Print subject report</button>
        <button style={ui.ghost} onClick={() => printDocument(b.meta.subjects.map((s) => subjectReportHTML(b, s, { institute, series })).join(''), 'All subjects — analysis', institute)}>🖨️ Print all subjects</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat label="Average" value={`${fx(ps.avg, 2)}/${ps.max}`} sub={`${fx(ps.avgPct)}%`} color={ps.label.color} />
        <Stat label="Highest" value={fx(ps.high, 2)} sub={`${ps.highWho} (T${ps.highTest})`} color="#047857" />
        <Stat label="Lowest" value={fx(ps.low, 2)} sub={`${ps.lowWho} (T${ps.lowTest})`} color="#b91c1c" />
        <Stat label="Median / SD" value={fx(ps.median, 2)} sub={`SD ${fx(ps.sd)}`} color={NAVY} />
        <Stat label={passLabel(b)} value={`${fx(ps.pass, 0)}%`} color={ps.pass >= 75 ? '#047857' : '#b45309'} />
        <Stat label="Full marks" value={ps.full} sub="scores" color="#a7771f" />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...ui.card, flex: '1 1 min(400px, 100%)' }}>{trend ? <Svg minW={520} html={trend} /> : <i style={{ color: '#5d6b82' }}>Single test selected — no trend.</i>}</div>
        <div style={{ ...ui.card, flex: '1 1 min(400px, 100%)' }}><Svg minW={520} html={compare} /></div>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...ui.card, flex: '1 1 min(300px, 100%)' }}><h4 style={{ margin: '0 0 6px' }}>Score distribution</h4><Svg minW={440} html={hBars({ items: ps.dist.map((d) => ({ label: `${d.label}%`, value: d.count, color: col })), max: Math.max(1, ...ps.dist.map((d) => d.count)), unit: '', labelW: 70, width: 340 })} /></div>
        <div style={{ ...ui.card, flex: '1 1 min(300px, 100%)' }}><h4 style={{ margin: '0 0 6px', color: '#047857' }}>Top 5</h4>{ps.toppers.map((t, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>{i + 1}. {t.name} <b style={{ float: 'right' }}>{fx(t.pct)}%</b></div>)}</div>
        <div style={{ ...ui.card, flex: '1 1 min(300px, 100%)' }}><h4 style={{ margin: '0 0 6px', color: '#b91c1c' }}>Needs support</h4>{ps.weakest.map((t, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>{t.name} <b style={{ float: 'right' }}>{fx(t.pct)}%</b></div>)}</div>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Student-wise marks in {ps.subject}</h4>
        <Table maxH={520} head={['#', 'Student', 'GCC', 'Batch', ...tests.map((t) => `T${t}`), 'Avg %', 'Result', 'Band']}>
          {ranked.map((s, i) => {
            const pm = b.passOf(s.batch);
            const ok = s.sub[ps.subject] >= pm;
            const st = strengthLabel(s.sub[ps.subject], pm);
            return (
              <tr key={s.sid}>
                <td style={ui.td}>{i + 1}</td><td style={{ ...ui.td, textAlign: 'left', fontWeight: 600 }}>{s.name}</td><td style={ui.td}>{s.gcc || '—'}</td><td style={ui.td}>{s.batch}</td>
                {tests.map((t) => { const v = s.subTests?.[ps.subject]?.[t]; return <td key={t} style={{ ...ui.td, background: heatBg(v == null ? null : (v / ps.max) * 100) }}>{v == null ? '—' : fx(v, 2)}</td>; })}
                <td style={{ ...ui.td, fontWeight: 700, color: st.color }}>{fx(s.sub[ps.subject])}%</td><td style={ui.td}><Pill text={ok ? 'Pass' : 'Fail'} color={ok ? '#047857' : '#b91c1c'} /></td><td style={ui.td}><Pill text={st.label} color={st.color} /></td>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}

// ─── Batch / test report ──────────────────────────────────────────────────────
function BatchView({ rows, meta, passPct, passBy, institute, series }) {
  const [batch, setBatch] = useState(meta.batches[0] || '');
  const [test, setTest] = useState('');
  const b = useMemo(() => batchAnalysis(rows, batch, test === '' ? null : Number(test), { passPct, passByBatch: passBy }), [rows, batch, test, passPct, passBy]);
  if (!b) return <div style={ui.card}>No results for this selection.</div>;
  const subs = b.meta.subjects;
  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const data = b.students.map((s) => ({ Rank: s.rank, Name: s.name, GCC: s.gcc, Batch: s.batch, Tests: s.tests, 'Avg Total': r2(s.avgTotal), 'Avg %': r1(s.avgPct), Best: s.best, ...Object.fromEntries(subs.map((x) => [`${x} %`, r1(s.sub[x])])), 'Trend (pts/test)': r2(s.trend) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Ranking');
    XLSX.writeFile(wb, `${series} - ${batch || 'All'} - ${test ? 'T' + test : 'All tests'}.xlsx`);
  };
  return (
    <>
      <div style={{ ...ui.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', padding: 12 }}>
        <Field label="Batch"><select style={ui.input} value={batch} onChange={(e) => setBatch(e.target.value)}><option value="">All batches</option>{meta.batches.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Test"><select style={ui.input} value={test} onChange={(e) => setTest(e.target.value)}><option value="">All tests</option>{meta.tests.map((t) => <option key={t} value={t}>Test {t}</option>)}</select></Field>
        <button style={ui.btn} onClick={() => printDocument(batchReportHTML(b, { institute, series }), `${series} — ${batch || 'All batches'} report`, institute)}>🖨️ Print report</button>
        <button style={ui.ghost} onClick={exportXlsx}>⬇️ Export ranking (Excel)</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat label="Students" value={b.studentCount} sub={`${b.rowsCount} results`} color={NAVY} />
        <Stat label="Average" value={`${fx(b.avgPct)}%`} color={strengthLabel(b.avgPct, b.passPct).color} />
        <Stat label={passLabel(b)} value={`${fx(b.pass, 0)}%`} color={b.pass >= 75 ? '#047857' : '#b45309'} />
        <Stat label="Top performer" value={<span style={{ fontSize: 14 }}>{b.topper?.name}</span>} sub={b.topper ? `${fx(b.topper.avgPct)}% avg` : ''} color="#047857" />
        <Stat label="Weakest subject" value={b.toughest.subject} sub={`${fx(b.toughest.avgPct)}%`} color="#b91c1c" />
        <Stat label="At risk" value={b.atRisk.length} sub="students" color="#b91c1c" />
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Test-wise summary</h4>
        <Table head={['Test', 'N', 'Avg', 'Avg %', 'Median', 'High', 'Low', 'SD', 'Pass', ...subs.map((s) => `${s} %`), 'Topper']}>
          {b.perTest.map((t) => (
            <tr key={t.test_no}><td style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>T{t.test_no}</td><td style={ui.td}>{t.n}</td><td style={ui.td}>{fx(t.avg, 2)}</td>
              <td style={{ ...ui.td, fontWeight: 700 }}>{fx(t.avgPct)}%</td><td style={ui.td}>{fx(t.median, 2)}</td><td style={ui.td}>{fx(t.high, 2)}</td><td style={ui.td}>{fx(t.low, 2)}</td><td style={ui.td}>{fx(t.sd)}</td><td style={ui.td}>{fx(t.pass, 0)}%</td>
              {subs.map((s) => <td key={s} style={{ ...ui.td, background: heatBg(t.subj[s]?.avgPct) }}>{t.subj[s] ? fx(t.subj[s].avgPct) + '%' : '—'}</td>)}
              <td style={{ ...ui.td, textAlign: 'left' }}>{cleanName(t.topper.student_name)}</td></tr>
          ))}
        </Table>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Student ranking</h4>
        <Table maxH={560} head={['Rank', 'Student', 'GCC', ...(batch ? [] : ['Batch']), 'Tests', 'Avg', 'Avg %', 'Best', ...subs.map((s) => `${s} %`), 'Trend']}>
          {b.students.map((s) => (
            <tr key={s.sid}><td style={{ ...ui.td, fontWeight: 700 }}>{s.rank}</td><td style={{ ...ui.td, textAlign: 'left', fontWeight: 600 }}>{s.name}</td><td style={ui.td}>{s.gcc || '—'}</td>
              {batch ? null : <td style={ui.td}>{s.batch}</td>}<td style={ui.td}>{s.tests}</td><td style={ui.td}>{fx(s.avgTotal, 2)}</td>
              <td style={{ ...ui.td, fontWeight: 700, color: strengthLabel(s.avgPct, b.passOf(s.batch)).color }}>{fx(s.avgPct)}%</td><td style={ui.td}>{fx(s.best, 2)}</td>
              {subs.map((x) => <td key={x} style={{ ...ui.td, background: heatBg(s.sub[x]) }}>{s.sub[x] === undefined ? '—' : fx(s.sub[x], 0) + '%'}</td>)}
              <td style={{ ...ui.td, color: tone(s.trend, 1.5) }}>{s.tests >= 3 ? sgn(s.trend) : '—'}</td></tr>
          ))}
        </Table>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        {[['🚀 Most improved', b.improvers, (s) => `${sgn(s.trend, 2)} pts/test`, '#047857'], ['📉 Declining', b.decliners, (s) => `${sgn(s.trend, 2)} pts/test`, '#b91c1c'],
          ['🎯 Most consistent', b.consistent, (s) => `SD ${fx(s.consistency)}`, NAVY], ['⚠️ At risk', b.atRisk.slice(0, 8), (s) => `${fx(s.avgPct)}% avg`, '#b91c1c']].map(([t, arr, f, c]) => (
          <div key={t} style={{ ...ui.card, flex: '1 1 min(240px, 100%)' }}><h4 style={{ margin: '0 0 6px', color: c }}>{t}</h4>
            {arr.length ? arr.map((s) => <div key={s.sid} style={{ fontSize: 13, padding: '3px 0' }}>{s.name} <b style={{ float: 'right' }}>{f(s)}</b></div>) : <i style={{ color: '#5d6b82' }}>None</i>}</div>
        ))}
      </div>
    </>
  );
}

// ─── Upload & data ────────────────────────────────────────────────────────────
const SEED_SUBJECTS = ['Mental Ability', 'EVS', 'Mathematics', 'Passage'];

function DataView({ scope, allRows, rawRows, rows, fixes, fixMode, series, setSeries, mode, meta, who, canUpload, canDelete, reload }) {
  const [files, setFiles] = useState([]);
  const [seriesEdit, setNewSeries] = useState(null);
  const newSeries = seriesEdit ?? series;
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const known = useMemo(() => {
    const m = {};
    allRows.filter((r) => r.series === newSeries).forEach((r) => { Object.entries(r.max_marks || {}).forEach(([s, v]) => { m[s] = v; }); });
    return m;
  }, [allRows, newSeries]);
  const batchNames = useMemo(() => [...new Set(allRows.map((r) => r.batch))].sort(), [allRows]);
  const match = useMemo(() => matchingReport(rows), [rows]);

  const onFiles = async (fl) => {
    setMsg(''); setBusy('Reading files…');
    try {
      const XLSX = await import('xlsx');
      const out = [];
      for (const f of Array.from(fl)) {
        try {
          const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
          const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null, raw: true });
          const p = parseResultSheet(aoa);
          const g = guessFromFilename(f.name);
          const inf = inferMax(p.rows, p.subjects);
          const max = {};
          p.subjects.forEach((s) => { max[s] = known[s] ?? inf[s]; });
          out.push({ key: f.name + Math.random(), name: f.name, test_no: g.test_no ?? '', batch: g.batch, test_name: g.test_no ? `Pre Mock Test ${g.test_no}` : '', test_date: '', parsed: p, max });
        } catch (e) { out.push({ key: f.name + Math.random(), name: f.name, error: e.message || String(e) }); }
      }
      setFiles((cur) => [...cur, ...out]);
    } finally { setBusy(''); if (fileRef.current) fileRef.current.value = ''; }
  };
  const patch = (key, p) => setFiles((cur) => cur.map((f) => (f.key === key ? { ...f, ...p } : f)));
  const buildRows = (f) => {
    const maxTotal = f.parsed.subjects.reduce((s, x) => s + Number(f.max[x] || 0), 0);
    return f.parsed.rows.map((r) => ({
      series: newSeries.trim(), test_no: Number(f.test_no), test_name: f.test_name || `Test ${f.test_no}`, test_date: f.test_date || null, batch: f.batch.trim(),
      gcc_no: r.gcc_no, student_name: r.student_name, marks: r.marks, max_marks: { ...f.max }, total: r.total, max_total: maxTotal, rank: r.rank, source_file: f.name,
    }));
  };
  const valid = (f) => !f.error && f.parsed?.rows.length && Number(f.test_no) > 0 && f.batch.trim() && newSeries.trim();
  const overOf = (f) => allRows.filter((r) => r.series === newSeries.trim() && r.test_no === Number(f.test_no) && r.batch === f.batch.trim()).length;

  const saveAll = async () => {
    const ok = files.filter(valid);
    if (!ok.length) return;
    if (!inScope(newSeries.trim(), scope)) { setMsg(scope === 'mega' ? '❌ Mega Mock Test results must be saved into a series with “Mega” in its name (for example “Mega Mock Test 2026”).' : '❌ This tab is for Pre Mock Tests — a series with “Mega” in its name belongs in the Mega Mock Test tab.'); return; }
    setBusy('Saving…'); setMsg('');
    try {
      const rows = ok.flatMap(buildRows);
      await saveRows(rows, mode, who);
      setFiles((cur) => cur.filter((f) => !valid(f)));
      setSeries(newSeries.trim());
      setMsg(`✅ Saved ${rows.length} results from ${ok.length} sheet(s) to ${mode === 'cloud' ? 'the database' : 'this browser'}.`);
      await reload();
    } catch (e) { setMsg(`❌ ${e.message || e}`); }
    setBusy('');
  };

  const loadSeed = async () => {
    const seed = (await import('./data/preMockTest2026.json')).default;
    const sheets = new Set(seed.map((r) => `${r[0]}|${r[1]}`)).size, tests = new Set(seed.map((r) => r[0])).size, batches = new Set(seed.map((r) => r[1])).size;
    if (!window.confirm(`Load the built-in Pre Mock Test 2026 data (${sheets} sheets, ${seed.length.toLocaleString('en-IN')} results — ${tests} tests · ${batches} batches)? Sheets already saved for the same test and batch will be replaced.`)) return;
    setBusy('Loading built-in data…'); setMsg('');
    try {
      const rows = rowsFromSeed(seed, DEFAULT_SERIES, SEED_SUBJECTS, 25);
      await saveRows(rows, mode, who || 'seed');
      setSeries(DEFAULT_SERIES);
      setMsg(`✅ Loaded ${rows.length} results (${tests} tests · ${batches} batches).`);
      await reload();
    } catch (e) { setMsg(`❌ ${e.message || e}`); }
    setBusy('');
  };

  const saved = useMemo(() => {
    const m = new Map();
    allRows.forEach((r) => {
      const k = `${r.series}|${r.test_no}|${r.batch}`;
      if (!m.has(k)) m.set(k, { series: r.series, test_no: r.test_no, batch: r.batch, n: 0, avg: 0, file: r.source_file, at: r.created_at, test_name: r.test_name });
      const o = m.get(k); o.n++; o.avg += (r.total / (r.max_total || 1)) * 100;
    });
    return [...m.values()].sort((a, b) => a.series.localeCompare(b.series) || a.test_no - b.test_no || a.batch.localeCompare(b.batch));
  }, [allRows]);

  const del = async (s) => {
    if (!window.confirm(`Delete ${s.n} saved results for ${s.series} · Test ${s.test_no} · ${s.batch}? This cannot be undone.`)) return;
    setBusy('Deleting…');
    try { await deleteTest(s.series, s.test_no, s.batch, mode); await reload(); } catch (e) { setMsg(`❌ ${e.message || e}`); }
    setBusy('');
  };
  const exportAll = async () => {
    const XLSX = await import('xlsx');
    const subs = [...new Set(allRows.filter((r) => r.series === series).flatMap((r) => Object.keys(r.marks || {})))];
    const data = allRows.filter((r) => r.series === series).sort((a, b) => a.test_no - b.test_no || a.batch.localeCompare(b.batch) || (a.rank ?? 0) - (b.rank ?? 0))
      .map((r) => ({ Series: r.series, Test: r.test_no, Batch: r.batch, GCC: r.gcc_no, Name: r.student_name, ...Object.fromEntries(subs.map((s) => [s, r.marks?.[s] ?? ''])), Total: r.total, Max: r.max_total, Rank: r.rank }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'Results');
    XLSX.writeFile(wb, `${series} - all results.xlsx`);
  };
  const resetData = async (all) => {
    const count = all ? allRows.length : allRows.filter((r) => r.series === series).length;
    if (!count && !(all && localCount())) { setMsg('Nothing to reset.'); return; }
    const typed = window.prompt(`This permanently deletes ${count} saved results from ${all ? 'ALL series' : `series "${series}"`}. This cannot be undone.\n\nType RESET to confirm.`);
    if (typed === null) return;
    if (typed.trim() !== 'RESET') { setMsg('Reset cancelled — confirmation text did not match.'); return; }
    setBusy('Resetting…'); setMsg('');
    try {
      if (all) await resetAll(mode); else await resetSeries(series, mode);
      setFiles([]);
      await reload();
      setMsg(`✅ Reset complete — ${count} results removed.`);
    } catch (e) { setMsg(`❌ ${e.message || e}`); }
    setBusy('');
  };
  const migrate = async () => {
    setBusy('Moving to database…');
    try { const n = await migrateLocalToCloud(); setMsg(`✅ Moved ${n} browser-saved results into the database.`); await reload(); } catch (e) { setMsg(`❌ ${e.message || e}`); }
    setBusy('');
  };

  return (
    <>
      {msg ? <div style={{ ...ui.card, fontSize: 13 }}>{msg}</div> : null}
      {busy ? <div style={{ ...ui.card, fontSize: 13, color: '#5d6b82' }}>⏳ {busy}</div> : null}
      {mode === 'cloud' && localCount() > 0 && canUpload ? (
        <div style={{ ...ui.card, background: '#eef2f9', fontSize: 13 }}>This browser holds {localCount()} results saved before the database table existed. <button style={{ ...ui.btn, marginLeft: 8 }} onClick={migrate}>Move to database</button></div>
      ) : null}
      {canUpload ? (
        <div style={ui.card}>
          <h4 style={{ margin: '0 0 4px' }}>📤 Upload result sheets (Excel / CSV)</h4>
          <div style={{ fontSize: 12.5, color: '#5d6b82', marginBottom: 10 }}>
            One sheet per batch per test with columns <b>GCC No · Name · subject columns · Score · Rank</b> (any column order). Several files can be uploaded at once; test number and batch are read from the file name and can be corrected below. Re-uploading the same test + batch replaces the earlier copy.
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label="Save into series" grow><input style={{ ...ui.input, width: '100%' }} list="mta-series" value={newSeries} onChange={(e) => setNewSeries(e.target.value)} /><datalist id="mta-series">{[...new Set(allRows.map((r) => r.series))].filter((n) => inScope(n, scope)).map((s) => <option key={s} value={s} />)}</datalist></Field>
            <Field label="Excel / CSV files"><input ref={fileRef} type="file" multiple accept=".xls,.xlsx,.csv" onChange={(e) => e.target.files?.length && onFiles(e.target.files)} /></Field>
          </div>
          {files.map((f) => (
            <div key={f.key} style={{ border: '1px solid #E5E7EB', borderRadius: 10, padding: 12, marginTop: 12, background: '#faf8f3' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 13, wordBreak: 'break-all' }}>📄 {f.name}</b>
                <button style={ui.ghost} onClick={() => setFiles((cur) => cur.filter((x) => x.key !== f.key))}>✕ Remove</button>
              </div>
              {f.error ? <div style={{ color: '#b91c1c', fontSize: 13 }}>Could not read: {f.error}</div> : (
                <>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '8px 0' }}>
                    <Field label="Test no."><input type="number" min={1} style={{ ...ui.input, width: 80 }} value={f.test_no} onChange={(e) => patch(f.key, { test_no: e.target.value })} /></Field>
                    <Field label="Test name"><input style={ui.input} value={f.test_name} onChange={(e) => patch(f.key, { test_name: e.target.value })} /></Field>
                    <Field label="Batch"><input style={ui.input} list="mta-batches" value={f.batch} onChange={(e) => patch(f.key, { batch: e.target.value })} /><datalist id="mta-batches">{batchNames.map((x) => <option key={x} value={x} />)}</datalist></Field>
                    <Field label="Test date"><input type="date" style={ui.input} value={f.test_date} onChange={(e) => patch(f.key, { test_date: e.target.value })} /></Field>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                    {f.parsed.subjects.map((s) => (
                      <Field key={s} label={`${s} — max marks`}><input type="number" min={1} style={{ ...ui.input, width: 100 }} value={f.max[s]} onChange={(e) => patch(f.key, { max: { ...f.max, [s]: Number(e.target.value) } })} /></Field>
                    ))}
                  </div>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{f.parsed.rows.length}</b> students · subjects: {f.parsed.subjects.join(', ')}
                    {overOf(f) ? <span style={{ color: '#b45309' }}> · ⚠ replaces {overOf(f)} saved results for this test + batch</span> : null}
                    {!valid(f) ? <span style={{ color: '#b91c1c' }}> · fill in test no. and batch</span> : null}
                  </div>
                  {f.parsed.warnings.length ? <details style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}><summary>{f.parsed.warnings.length} warning(s)</summary>{f.parsed.warnings.slice(0, 15).map((w, i) => <div key={i}>• {w}</div>)}</details> : null}
                  <details style={{ marginTop: 6 }}><summary style={{ fontSize: 12, cursor: 'pointer' }}>Preview first rows</summary>
                    <Table head={['GCC', 'Name', ...f.parsed.subjects, 'Total', 'Rank']}>
                      {f.parsed.rows.slice(0, 6).map((r, i) => <tr key={i}><td style={ui.td}>{r.gcc_no || '—'}</td><td style={{ ...ui.td, textAlign: 'left' }}>{r.student_name}</td>{f.parsed.subjects.map((s) => <td key={s} style={ui.td}>{r.marks[s]}</td>)}<td style={ui.td}>{r2(r.total)}</td><td style={ui.td}>{r.rank}</td></tr>)}
                    </Table>
                  </details>
                </>
              )}
            </div>
          ))}
          {files.length ? <div style={{ marginTop: 12 }}><button style={ui.btn} disabled={!!busy || !files.some(valid)} onClick={saveAll}>💾 Save {files.filter(valid).length} sheet(s) to records</button></div> : null}
        </div>
      ) : <div style={{ ...ui.card, fontSize: 13, color: '#5d6b82' }}>You do not have permission to upload results.</div>}

      {canUpload && scope !== 'mega' ? (
        <div style={{ ...ui.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 min(300px, 100%)' }}><b>Built-in data: Pre Mock Test 2026</b><div style={{ fontSize: 12.5, color: '#5d6b82' }}>59 result sheets · 13 tests (1, 2, 5–8 and 10–16) · Lakshya A/B, Umeed, Combined English &amp; Manipuri · Mental Ability, EVS, Mathematics, Passage (25 each).</div></div>
          <button style={ui.btn} disabled={!!busy} onClick={loadSeed}>📥 Load Pre Mock Test 2026 data</button>
          <button style={ui.ghost} disabled={!meta.tests.length} onClick={exportAll}>⬇️ Export this series (Excel)</button>
        </div>
      ) : null}

      {fixMode === 'cloud' && localFixCount() > 0 && canUpload ? (
        <div style={{ ...ui.card, background: '#eef2f9', fontSize: 13 }}>This browser holds {localFixCount()} data fix(es) saved before the fixes table existed. <button style={{ ...ui.btn, marginLeft: 8 }} onClick={async () => { await migrateLocalFixes(); await reload(); }}>Move to database</button></div>
      ) : null}
      {fixMode === 'local' ? <div style={{ ...ui.card, background: '#FFFBEB', borderColor: '#FCD34D', fontSize: 13, color: '#92400E' }}>⚠️ Data fixes are saved in this browser only — run supabase/migrations/20261003_mock_test_fixes.sql to keep them permanently and share them.</div> : null}
      {rows.length ? <MockFixEngine rows={rows} rawRows={rawRows} fixes={fixes} series={series} mode={fixMode} who={who} canEdit={canUpload} onChanged={reload} /> : null}

      {match.students ? (
        <div style={ui.card}>
          <h4 style={{ margin: '0 0 4px' }}>🔍 Student matching check</h4>
          <div style={{ fontSize: 12.5, color: '#5d6b82', marginBottom: 8 }}>
            Students are tied together across tests by GCC number, then by name (spelling variants, blank or mistyped GCC). Check the lists below if a student looks like they are missing data.
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
            <Stat label="Students" value={match.students} color={NAVY} />
            <Stat label="Joined from variants" value={match.merged.length} sub="more than one GCC" color="#0e7490" />
            <Stat label="Skipped a test" value={match.gaps.length} sub="check if absent" color={match.gaps.length ? '#b45309' : '#047857'} />
          </div>
          <details style={{ marginBottom: 6 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Matched under different GCC numbers or spellings ({match.merged.length})</summary>
            <div style={{ marginTop: 6 }}>
              <Table maxH={320} head={['Student', 'GCC numbers', 'Spellings seen', 'Tests']}>
                {match.merged.map((m) => (
                  <tr key={m.sid}><td style={{ ...ui.td, textAlign: 'left', fontWeight: 600 }}>{m.name}</td><td style={ui.td}>{m.gccs.join(', ')}</td>
                    <td style={{ ...ui.td, textAlign: 'left' }}>{m.names.join(' · ')}</td><td style={ui.td}>{m.tests.map((t) => 'T' + t).join(' ')}</td></tr>
                ))}
              </Table>
            </div>
          </details>
          <details open={match.gaps.length > 0}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Students who skipped a test their batch sat ({match.gaps.length})</summary>
            <div style={{ marginTop: 6 }}>
              {match.gaps.length ? (
                <Table maxH={320} head={['Student', 'Batch', 'GCC', 'Has tests', 'Missing']}>
                  {match.gaps.map((g) => (
                    <tr key={g.sid}><td style={{ ...ui.td, textAlign: 'left', fontWeight: 600 }}>{g.name}</td><td style={ui.td}>{g.batch}</td><td style={ui.td}>{g.gcc || '—'}</td>
                      <td style={ui.td}>{g.tests.map((t) => 'T' + t).join(' ')}</td><td style={{ ...ui.td, color: '#b91c1c', fontWeight: 700 }}>{g.missing.map((t) => 'T' + t).join(' ')}</td></tr>
                  ))}
                </Table>
              ) : <div style={{ fontSize: 13, color: '#047857' }}>✅ Every student has every test their batch sat (between their first and last test).</div>}
            </div>
          </details>
        </div>
      ) : null}

      {canDelete ? (
        <div style={{ ...ui.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', background: '#FEF2F2', borderColor: '#FECACA' }}>
          <div style={{ flex: '1 1 min(300px, 100%)' }}><b style={{ color: '#b91c1c' }}>Reset data</b><div style={{ fontSize: 12.5, color: '#5d6b82' }}>Permanently delete saved results. You will be asked to type RESET to confirm.</div></div>
          <button style={{ ...ui.ghost, color: '#b91c1c' }} disabled={!!busy} onClick={() => resetData(false)}>Reset this series</button>
          <button style={{ ...ui.btn, background: '#b91c1c' }} disabled={!!busy} onClick={() => resetData(true)}>Reset everything</button>
        </div>
      ) : null}

      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>🗂️ Saved records ({saved.length} sheets · {allRows.length} results)</h4>
        {saved.length ? (
          <Table maxH={460} head={['Series', 'Test', 'Batch', 'Students', 'Avg %', 'Source file', '']}>
            {saved.map((s) => (
              <tr key={`${s.series}|${s.test_no}|${s.batch}`}>
                <td style={{ ...ui.td, textAlign: 'left' }}>{s.series}</td><td style={ui.td}>T{s.test_no}</td><td style={ui.td}>{s.batch}</td><td style={ui.td}>{s.n}</td><td style={ui.td}>{fx(s.avg / s.n)}%</td>
                <td style={{ ...ui.td, textAlign: 'left', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.file || '—'}</td>
                <td style={ui.td}>{canDelete ? <button style={{ ...ui.ghost, color: '#b91c1c', padding: '3px 10px' }} onClick={() => del(s)}>Delete</button> : null}</td>
              </tr>
            ))}
          </Table>
        ) : <div style={{ color: '#5d6b82', fontSize: 13 }}>Nothing saved yet.</div>}
      </div>
    </>
  );
}

// ─── Self-study groups ────────────────────────────────────────────────────────
// Every class is split into 7 self-study groups from Group 1 (weakest marks) to Group 7 (strongest),
// by each student's average % over the tests in view. See lib/mockTestGroups.js.
const escH = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// "House Master/Mistress: Rohit Sharma (5), Anita Devi (3)" — who is assigned to the students in a group.
function hmSummary(group, hmOf) {
  const counts = new Map();
  group.students.forEach((s) => { const l = hmOf(s.gcc).label || ''; counts.set(l, (counts.get(l) || 0) + 1); });
  const named = [...counts].filter(([l]) => l).sort((a, b) => b[1] - a[1]);
  const none = counts.get('') || 0;
  if (!named.length) return 'Their House Masters: none recorded';
  return `Their House Masters: ${named.map(([l, n]) => `${l} (${n})`).join(', ')}${none ? ` · ${none} not recorded` : ''}`;
}

function GroupsView({ rows, institute, series, seriesName, canEdit = false, who = '', passPct = 40, currentUser = null }) {
  const [language, setLanguage] = useState('');
  const [batch, setBatch] = useState('');
  const [mode, setMode] = useState('equal');
  const [house, setHouse] = useState('');
  // Assigned House Master / Mistress for each student's house, from the Staff Records (null while loading / unavailable).
  const [dir, setDir] = useState(null);
  const [dirErr, setDirErr] = useState('');
  useEffect(() => {
    let live = true;
    loadHouseDirectory().then((d) => { if (live) setDir(d); }).catch((e) => { if (live) setDirErr(e.message || String(e)); });
    return () => { live = false; };
  }, []);
  const hmOf = useCallback((gcc) => (dir ? dir.lookup(gcc) : { house: '', masters: [], label: '' }), [dir]);
  const scoped = useMemo(() => (house && dir ? rows.filter((r) => dir.lookup(r.gcc_no).house === house) : rows), [rows, house, dir]);
  // Layout: one set of 7 groups per class, or ONE mixed set across the chosen classes. Basis: overall marks, or one subject.
  const [layout, setLayout] = useState('class');
  const [mixPick, setMixPick] = useState([]);
  const [basis, setBasis] = useState('');
  const subjects = useMemo(() => subjectsOf(rows), [rows]);
  // Manual choices (admin): { [basis]: { [sid]: 1..7 } }, saved per series.
  const [choices, setChoices] = useState({});
  const [choiceMode, setChoiceMode] = useState('local');
  const [editing, setEditing] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  useEffect(() => {
    let live = true;
    loadGroupChoices(seriesName).then((r) => { if (live) { setChoices(r.choices); setChoiceMode(r.mode); } }).catch((e) => { if (live) setSaveMsg(`Manual group choices could not be loaded: ${e.message || e}`); });
    return () => { live = false; };
  }, [seriesName]);
  const basisKey = basis || GROUP_BASIS_ALL;
  const overrides = choices[basisKey] || EMPTY_OBJ;
  const manualTotal = Object.keys(overrides).length;
  const move = async (sid, grp, b = basis) => {
    setSaveMsg('');
    const bk = b || GROUP_BASIS_ALL;
    setChoices((cur) => { const m = { ...(cur[bk] || {}) }; if (grp === null) delete m[sid]; else m[sid] = grp; return { ...cur, [bk]: m }; });
    try { await saveGroupChoice(seriesName, b, sid, grp, choiceMode, who); flash(grp === null ? 'Back to the automatic group ✓' : `Moved to Group ${grp} ✓`); }
    catch (e) { setSaveMsg(`Could not save the change: ${e.message || e}`); }
  };
  const resetManual = async () => {
    if (!window.confirm(`Remove all ${manualTotal} manual group choice${manualTotal === 1 ? '' : 's'} for ${basis || 'overall marks'}? Students go back to their automatic group.`)) return;
    setChoices((cur) => ({ ...cur, [basisKey]: {} }));
    try { await clearGroupChoices(seriesName, basis, choiceMode); } catch (e) { setSaveMsg(`Could not reset: ${e.message || e}`); }
  };
  // Top group (admin's choice): Group 7 = the best N students (across all chosen classes when mixed). 0 = automatic.
  const [topText, setTopText] = useState('');
  const topN = Math.max(0, Math.floor(Number(topText) || 0));
  // House Master / Mistress assigned to each group (per subject / overall, per set of students).
  const [mentors, setMentors] = useState({});
  const [mentorMode, setMentorMode] = useState('local');
  useEffect(() => {
    let live = true;
    loadGroupMentors(seriesName).then((r) => { if (live) { setMentors(r.mentors); setMentorMode(r.mode); } }).catch((e) => { if (live) setSaveMsg(`Assigned House Masters could not be loaded: ${e.message || e}`); });
    return () => { live = false; };
  }, [seriesName]);
  // Language of each class, set by the admin (wins over the language guessed from the class name).
  const [languages, setLanguages] = useState({});
  const [langMode, setLangMode] = useState('local');
  useEffect(() => {
    let live = true;
    loadClassLanguages().then((r) => { if (live) { setLanguages(r.languages); setLangMode(r.mode); } }).catch((e) => { if (live) setSaveMsg(`Class languages could not be loaded: ${e.message || e}`); });
    return () => { live = false; };
  }, []);
  const setClassLanguage = async (name, value) => {
    setSaveMsg('');
    setLanguages((cur) => { const n = { ...cur }; if (value) n[name] = value; else delete n[name]; return n; });
    if (language && value !== language) setBatch('');
    try { await saveClassLanguage(name, value || null, langMode, who); flash('Class language saved ✓'); }
    catch (e) { setSaveMsg(`Could not save the class language: ${e.message || e}`); }
  };
  const setKeyOf = (c) => (c.mixed ? mixScope(language, mixPick) : `class:${c.batch}`);
  const mentorOf = (c, b, g) => mentors[mentorKey(b, setKeyOf(c), g.no)] || null;
  const assign = async (c, g, key) => {
    setSaveMsg('');
    const person = key ? [...(dir?.masters || []), ...(dir?.teachers || [])].find((m) => m.key === key) : null;
    const value = person ? { ...pickInstruction(mentorOf(c, basis, g)), name: person.name, title: person.title } : null;   // a new person keeps the instruction of the slot
    const k = mentorKey(basis, setKeyOf(c), g.no);
    setMentors((cur) => { const n = { ...cur }; if (value) n[k] = value; else delete n[k]; return n; });
    try { await saveGroupMentor(seriesName, basis, setKeyOf(c), g.no, value, mentorMode, who); flash(value ? `${value.name} is now on duty ✓` : 'Duty removed ✓'); }
    catch (e) { setSaveMsg(`Could not save who is on duty: ${e.message || e}`); }
  };
  // Duty desk: students a teacher/admin removed from the groups, and groups built by hand.
  const userName = String(currentUser?.name || '').trim() || loggedInName(currentUser);
  const userStaffId = currentUser?.staff_profile_id ?? null;
  const [removed, setRemoved] = useState({});
  const [removedMode, setRemovedMode] = useState('local');
  const [custom, setCustom] = useState([]);
  const [customMode, setCustomMode] = useState('local');
  const [view, setView] = useState('groups');          // 'groups' | 'duty' | 'report'
  const [guideOpen, setGuideOpen] = useState(() => { try { return localStorage.getItem('gnsi_mock_groups_guide_v1') !== 'done'; } catch { return true; } });
  const [showEmpty, setShowEmpty] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const flash = useCallback((m) => { setToast(m); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(''), 2600); }, []);
  const closeGuide = () => { setGuideOpen(false); try { localStorage.setItem('gnsi_mock_groups_guide_v1', 'done'); } catch { /* storage unavailable */ } };
  useEffect(() => {
    let live = true;
    loadRemoved(seriesName).then((r) => { if (live) { setRemoved(r.removed); setRemovedMode(r.mode); } }).catch((e) => { if (live) setSaveMsg(`Removed students could not be loaded: ${e.message || e}`); });
    loadCustomGroups(seriesName).then((r) => { if (live) { setCustom(r.groups); setCustomMode(r.mode); } }).catch((e) => { if (live) setSaveMsg(`Manual groups could not be loaded: ${e.message || e}`); });
    return () => { live = false; };
  }, [seriesName]);
  const removedFor = useCallback((b) => removed[b || GROUP_BASIS_ALL] || EMPTY_OBJ, [removed]);
  const removeIn = async (b, sid, reason) => {
    const bk = b || GROUP_BASIS_ALL;
    setRemoved((cur) => ({ ...cur, [bk]: { ...(cur[bk] || {}), [sid]: { reason, by: userName || who, at: new Date().toISOString() } } }));
    try { await saveRemoved(seriesName, b, sid, { reason }, removedMode, userName || who); flash('Student removed ✓'); } catch (e) { setSaveMsg(`Could not save the removal: ${e.message || e}`); }
  };
  const restoreIn = async (b, sid) => {
    const bk = b || GROUP_BASIS_ALL;
    setRemoved((cur) => { const m = { ...(cur[bk] || {}) }; delete m[sid]; return { ...cur, [bk]: m }; });
    try { await saveRemoved(seriesName, b, sid, null, removedMode, userName || who); flash('Student restored ✓'); } catch (e) { setSaveMsg(`Could not restore: ${e.message || e}`); }
  };
  const saveCustom = async (g) => {
    const group = { ...g, id: g.id || newGroupId() };
    setCustom((cur) => [...cur.filter((x) => x.id !== group.id), group]);
    try { await saveCustomGroup(seriesName, group, customMode, userName || who); flash('Group saved ✓'); } catch (e) { setSaveMsg(`Could not save the group: ${e.message || e}`); }
  };
  const deleteCustom = async (id) => {
    setCustom((cur) => cur.filter((x) => x.id !== id));
    try { await deleteCustomGroup(seriesName, id, customMode); flash('Group deleted ✓'); } catch (e) { setSaveMsg(`Could not delete the group: ${e.message || e}`); }
  };
  const removedHere = removedFor(basis);
  const viewRows = useMemo(() => (Object.keys(removedHere).length ? scoped.filter((r) => !removedHere[r.sid]) : scoped), [scoped, removedHere]);
  // Duties are built from the saved assignments themselves (not from the layout / filters on screen), so the
  // Duty desk, the duty sheets and the report always show everyone who is on duty.
  // Study schedule: a time slot for each subject and a room for each group number (defaults: Passage 6-7 am, Maths 3:15-4:45 pm,
  // EVS 5:30-7 pm; Group 1-7 -> Room 1-7). It fills in whatever a duty assignment leaves empty.
  const [savedSchedule, setSavedSchedule] = useState({ subjects: {}, rooms: {} });
  const [scheduleMode, setScheduleMode] = useState('local');
  const [schedOpen, setSchedOpen] = useState(false);
  useEffect(() => {
    let live = true;
    loadSchedule(seriesName).then((r) => { if (live) { setSavedSchedule(r.saved); setScheduleMode(r.mode); } }).catch((e) => { if (live) setSaveMsg(`The study schedule could not be loaded: ${e.message || e}`); });
    return () => { live = false; };
  }, [seriesName]);
  const schedule = useMemo(() => mergeSchedule(savedSchedule), [savedSchedule]);
  const setSubjectSlot = async (subject, value) => {
    setSavedSchedule((cur) => ({ ...cur, subjects: { ...cur.subjects, [subject]: value } }));
    try { await saveScheduleEntry(seriesName, 'subject', subject, value, scheduleMode, who); } catch (e) { setSaveMsg(`Could not save the time slot: ${e.message || e}`); }
  };
  const setRoomName = (group, value) => setSavedSchedule((cur) => ({ ...cur, rooms: { ...cur.rooms, [group]: value } }));
  const saveRoomName = async (group) => {
    try { await saveScheduleEntry(seriesName, 'room', group, String(schedule.rooms[group] ?? ''), scheduleMode, who); flash('Room saved ✓'); } catch (e) { setSaveMsg(`Could not save the room: ${e.message || e}`); }
  };
  const resetSched = async () => {
    if (!window.confirm('Go back to the standard schedule (Passage 6:00–7:00 am, Mathematics 3:15–4:45 pm, EVS 5:30–7:00 pm; Group 1–7 in Room 1–7)?')) return;
    setSavedSchedule({ subjects: {}, rooms: {} });
    try { await resetSchedule(seriesName, scheduleMode); flash('Standard schedule restored ✓'); } catch (e) { setSaveMsg(`Could not reset the schedule: ${e.message || e}`); }
  };
  const assignments = useMemo(() => assignmentsFrom(mentors), [mentors]);
  const dutyOpts = useCallback((b, scope) => {
    const sc = parseScope(scope);
    return { mode, basis: b, topN, languages, overrides: choices[b || GROUP_BASIS_ALL] || EMPTY_OBJ, ...(sc.mix ? { mix: true, language: sc.language, classes: sc.classes } : { batch: sc.batch }) };
  }, [mode, topN, languages, choices]);
  const duties = useMemo(() => collectDuties({ rows, assignments, optsFor: dutyOpts, removedFor, custom, hmOf, schedule }), [rows, assignments, dutyOpts, removedFor, custom, hmOf, schedule]);
  const roomClash = useMemo(() => dutyRoomClashes(duties), [duties]);
  // Instruction (where / why / when / what to do) for the person on duty of a group.
  const [instEditKey, setInstEditKey] = useState(null);   // `${setKey}|${group}` of the card being edited
  const [instDraft, setInstDraft] = useState(null);
  const [instAll, setInstAll] = useState(false);
  const saveDutyDetails = async (b, setKey, grp, details) => {
    const k = mentorKey(b, setKey, grp);
    const cur = mentors[k];
    if (!cur?.name) return;
    const value = { ...cur, ...stripScheduleDefaults(details, schedule, b || 'Overall marks', grp) };
    setMentors((m) => ({ ...m, [k]: value }));
    try { await saveGroupMentor(seriesName, b, setKey, grp, value, mentorMode, who); flash('Instruction saved ✓'); }
    catch (e) { setSaveMsg(`Could not save the instruction: ${e.message || e}`); }
  };
  const saveInstructionFor = async (sec, details) => {
    if (sec.kind === 'custom') {
      const cg = custom.find((x) => x.id === sec.id);
      if (cg) await saveCustom({ ...cg, ...stripScheduleDefaults(details, schedule, cg.basis || 'Overall marks', 0) });
      return;
    }
    await saveDutyDetails(sec.basis, sec.scope, sec.group, details);
  };
  const everything = useMemo(() => classGroups(rows, { mode, languages }), [rows, mode, languages]);
  const classes = useMemo(() => classGroups(viewRows, { language, batch: layout === 'mix' ? '' : batch, mode, basis, overrides, mix: layout === 'mix', classes: mixPick, topN, languages }), [viewRows, language, batch, mode, basis, overrides, layout, mixPick, topN, languages]);
  // The same groups without any manual moves — to show where manually moved students started.
  const autoClasses = useMemo(() => classGroups(viewRows, { language, batch: layout === 'mix' ? '' : batch, mode, basis, overrides: EMPTY_OBJ, mix: layout === 'mix', classes: mixPick, topN, languages }), [viewRows, language, batch, mode, basis, layout, mixPick, topN, languages]);
  const layoutLabel = layout === 'mix' ? `Mixed classes${language ? ` · ${language}` : ''}` : `Class-wise${language ? ` · ${language}` : ''}`;
  const langCount = (l) => everything.filter((c) => c.language === l).length;
  const unlabelled = everything.filter((c) => !c.language).map((c) => c.batch);
  const pickable = everything.filter((c) => !language || c.language === language);

  const flatOf = (cls, b) => cls.flatMap((c) => c.groups.flatMap((g) => g.students.map((s) => ({
    'Assigned for duty (group)': mentorOf(c, b, g)?.name || '—',
    Class: s.batch || c.batch, 'Group layout': c.mixed ? `Mixed (${c.classes.join(' + ')})` : 'Class-wise', Language: c.language || '—', Basis: b || 'Overall marks', Group: `${g.name} — ${g.tag}`,
    'Group set by': s.manual ? 'Admin (manual)' : 'Automatic', GCC: s.gcc, Name: s.name, House: hmOf(s.gcc).house || '—', 'House Master / Mistress': hmOf(s.gcc).label || '—',
    [`${b || 'Average'} %`]: Math.round(s.avg * 10) / 10, 'Overall %': Math.round(s.overall * 10) / 10,
    'Tests taken': s.tests, 'Weakest subject': s.weakest || '—', 'Group focus subject': g.focus || '—',
  }))));
  const opts = (b) => ({ language, batch: layout === 'mix' ? '' : batch, mode, basis: b, overrides: choices[b || GROUP_BASIS_ALL] || EMPTY_OBJ, mix: layout === 'mix', classes: mixPick, topN, languages });
  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatOf(classes, basis)), 'Self-study groups');
    XLSX.writeFile(wb, `${series} - self-study groups${basis ? ` - ${basis}` : ''}${language ? ` - ${language}` : ''}.xlsx`);
  };
  // One sheet per subject (each subject has its own 7 groups), using the same layout, filters and manual choices.
  const exportAllSubjects = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    const used = new Set();
    subjects.forEach((sub) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(flatOf(classGroups(scoped, opts(sub)), sub)), sheetName(sub, used)));
    XLSX.writeFile(wb, `${series} - self-study groups - every subject.xlsx`);
  };
  // Print: the admin chooses which subject(s) to include; each subject prints as its own section.
  const [printOpen, setPrintOpen] = useState(false);
  const [printPick, setPrintPick] = useState([]);
  const groupsFor = (b) => (b === basis ? classes : classGroups(scoped.filter((r) => !removedFor(b)[r.sid]), opts(b)));
  const groupsHtml = (cls, b) => cls.map((c) => `<h2>${escH(c.batch)}${c.mixed ? ` (${escH(c.classes.join(' + '))})` : ''}${c.language ? ` · ${escH(c.language)}` : ''} <small>— ${c.count} students · avg ${fx(c.avg)}%</small></h2>
      ${c.groups.map((g) => `<h3>${escH(g.name)} — ${escH(g.tag)} <small>${(() => { const sc = withSchedule(mentorOf(c, b, g), schedule, b || 'Overall marks', g.no); return [sc.venue && `${ICON.pin}${escH(sc.venue)}`, slotText(sc) && `${ICON.clock}${escH(slotText(sc))}`].filter(Boolean).join(' · ') + (sc.venue || slotText(sc) ? ' · ' : ''); })()}${mentorOf(c, b, g) ? `On duty: ${escH(mentorOf(c, b, g).name)} · ` : ''}${g.n ? `${g.n} students · ${fx(g.min)}–${fx(g.max)}% · focus: ${escH(g.focus || '—')}` : 'no students'}</small></h3>
      ${g.n ? `<table><thead><tr><th>#</th><th>GCC</th><th>Name</th><th>House</th><th>House Master / Mistress</th><th>${escH(b || 'Avg')} %</th><th>Weakest subject</th></tr></thead><tbody>${g.students.map((s, i) => `<tr><td>${i + 1}</td><td>${escH(s.gcc)}</td><td>${escH(s.name)}</td><td>${escH(hmOf(s.gcc).house || '—')}</td><td>${escH(hmOf(s.gcc).label || '—')}</td><td>${fx(s.avg)}${s.manual ? ' ✎' : ''}</td><td>${escH(s.weakest || '—')}</td></tr>`).join('')}</tbody></table>` : ''}`).join('')}`).join('');
  const print = (bases = [basis]) => {
    const list = (bases.length ? bases : [basis]);
    const body = list.map((b, i) => `<div style="${i ? 'break-before:page;page-break-before:always' : ''}"><h2 style="background:#0f2d5e;color:#fff;padding:5px 10px;border-radius:4px">Subject: ${escH(b || 'Overall marks')}</h2>${groupsHtml(groupsFor(b), b)}</div>`).join('');
    printPremium(`<h1>Self-study groups — ${escH(series)}</h1><p>${escH(institute?.name || '')}${language ? ` · ${escH(language)}` : ''} · ${list.length === 1 ? `subject: ${escH(list[0] || 'overall marks')}` : `subjects: ${escH(list.map((b) => b || 'Overall marks').join(', '))}`} · ${layout === 'mix' ? 'mixed classes' : 'class-wise'} · ${mode === 'bands' ? 'by fixed mark bands' : '7 equal groups, weakest to strongest'}</p>${body}`, { title: `Self-study groups - ${series}`, institute, docLabel: `Self-study groups · ${series}` });
  };

  const prog = (() => { let total = 0, assigned = 0, instr = 0; classes.forEach((c) => c.groups.forEach((g) => { if (!g.n) return; total++; const m = mentorOf(c, basis, g); if (m?.name) { assigned++; if (hasInstruction(m)) instr++; } })); return { total, assigned, instr }; })();
  const emptyHidden = showEmpty ? 0 : classes.reduce((t, c) => t + c.groups.filter((g) => !g.n).length, 0);
  return (
    <>
      <div style={{ ...ui.card, padding: 0, overflow: 'hidden' }}>
        <div style={{ background: 'linear-gradient(135deg,#0f2347 0%,#1e3a6e 60%,#2b4f8f 100%)', color: '#fff', padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 20, fontWeight: 700 }}>Self-Study Groups</div>
              <div style={{ fontSize: 12.5, color: '#d6def0', marginTop: 2, maxWidth: 560 }}>Split students into 7 groups from weakest to strongest marks, choose who looks after each group, and print their duty sheets.</div>
            </div>
            <button style={{ ...ui.ghost, background: 'rgba(255,255,255,.12)', color: '#fff', border: '1px solid rgba(255,255,255,.3)', padding: '6px 12px' }} onClick={() => (guideOpen ? closeGuide() : setGuideOpen(true))} aria-expanded={guideOpen}>❓ How it works</button>
          </div>
          <div role="tablist" aria-label="Self-study views" style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
            {[['groups', '👥 Groups'], ['duty', `🧑‍🏫 Duty desk${duties.length ? ` (${duties.length})` : ''}`], ['report', '📑 Reports']].map(([id, label]) => (
              <button key={id} role="tab" aria-selected={view === id} onClick={() => setView(id)} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: view === id ? '#fff' : 'rgba(255,255,255,.14)', color: view === id ? NAVY : '#fff' }}>{label}</button>
            ))}
          </div>
        </div>
        {guideOpen ? (
          <div style={{ padding: '12px 16px', background: '#fffbeb', borderTop: '1px solid #f1deaa', fontSize: 13, lineHeight: 1.6 }}>
            <b>How it works — 3 steps</b>
            <ol style={{ margin: '4px 0 6px', paddingLeft: 20 }}>
              <li><b>Groups:</b> choose the subject, and whether students are grouped within each class or mixed across classes. Group 1 is the weakest, Group 7 the strongest.</li>
              <li><b>Duty:</b> on each group, pick who is on duty (a House Master or a teacher) and add an instruction — where, why and when.</li>
              <li><b>Duty desk:</b> every person's groups and students in one place. Print their duty sheet; teachers can remove or transfer their own students.</li>
            </ol>
            <button style={{ ...ui.ghost, padding: '4px 12px', fontSize: 12.5 }} onClick={closeGuide}>Got it — hide this</button>
          </div>
        ) : null}
      </div>
      {saveMsg ? <div role="alert" style={{ fontSize: 12.5, color: '#991B1B', background: '#fef2f2', border: '1px solid #fbd5d5', borderRadius: 10, padding: '6px 12px', margin: '0 0 10px' }}>{saveMsg}</div> : null}

      {view === 'groups' ? (
        <>
          <div style={ui.card}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <Field label="Group by marks in">
                <select style={ui.input} value={basis} onChange={(e) => setBasis(e.target.value)} aria-label="Group by marks in">
                  <option value="">Overall marks (all subjects)</option>
                  {subjects.map((sub) => <option key={sub} value={sub}>{sub} only</option>)}
                </select>
              </Field>
              <Field label="Group students">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={chip(layout === 'class')} onClick={() => setLayout('class')}>Within each class</button>
                  <button style={chip(layout === 'mix')} onClick={() => setLayout('mix')}>Mixed across classes</button>
                </div>
              </Field>
              <Field label="Language">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button style={chip(!language)} onClick={() => { setLanguage(''); setBatch(''); }}>All</button>
                  {LANGUAGES.map((l) => <button key={l} style={chip(language === l)} onClick={() => { setLanguage(l); setBatch(''); }}>{l}{` (${langCount(l)})`}</button>)}
                </div>
              </Field>
              {layout === 'class' ? (
                <Field label="Class">
                  <select style={ui.input} value={batch} onChange={(e) => setBatch(e.target.value)} aria-label="Class">
                    <option value="">All classes</option>
                    {pickable.map((c) => <option key={c.batch} value={c.batch}>{c.batch}</option>)}
                  </select>
                </Field>
              ) : (
                <Field label="Classes in the mix">
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button style={chip(!mixPick.length)} onClick={() => setMixPick([])}>All{language ? ` ${language}` : ''}</button>
                    {pickable.map((c) => <button key={c.batch} style={chip(mixPick.includes(c.batch))} onClick={() => setMixPick((cur) => toggleIn(cur, c.batch))}>{c.batch}</button>)}
                  </div>
                </Field>
              )}
            </div>
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: '#2e3b52' }}>⚙️ More options — house, how to divide, top group size{canEdit ? ', class languages' : ''}</summary>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', margin: '10px 0 4px' }}>
                {dir && dir.houses.length ? (
                  <Field label="House">
                    <select style={ui.input} value={house} onChange={(e) => setHouse(e.target.value)} aria-label="House">
                      <option value="">All houses</option>
                      {dir.houses.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </Field>
                ) : null}
                <Field label="How to divide">
                  <select style={ui.input} value={mode} onChange={(e) => setMode(e.target.value)} aria-label="How to divide">
                    <option value="equal">7 equal groups (by rank)</option>
                    <option value="bands">Fixed mark bands (&lt;30 … 80+)</option>
                  </select>
                </Field>
                <Field label={layout === 'mix' ? 'Top group size — best … students' : 'Top group size — best … per class'}>
                  <input type="number" min={0} placeholder="0 = automatic" style={{ ...ui.input, width: 130 }} value={topText} onChange={(e) => setTopText(e.target.value)} aria-label="Number of students in the top group" />
                </Field>
                <label style={{ fontSize: 13, paddingBottom: 8 }}><input type="checkbox" checked={showEmpty} onChange={(e) => setShowEmpty(e.target.checked)} /> Show empty groups</label>
              </div>
              {canEdit ? (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#2e3b52', marginBottom: 4 }}>Language of each class (English / Meitei Mayek)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {everything.map((c) => (
                      <label key={c.batch} style={{ fontSize: 12, color: '#5d6b82' }}>{c.batch}
                        <select aria-label={`Language of ${c.batch}`} style={{ ...ui.input, display: 'block', padding: '3px 6px', fontSize: 12.5, marginTop: 2 }} value={LANGUAGES.includes(languages[c.batch]) ? languages[c.batch] : ''} onChange={(e) => setClassLanguage(c.batch, e.target.value)}>
                          <option value="">{`Automatic (${languageOfBatch(c.batch) || 'none — from the name'})`}</option>
                          {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5d6b82', marginTop: 4 }}>Used by the Language filter. Saved for every series · <b style={{ color: langMode === 'cloud' ? '#047857' : '#b45309' }}>{langMode === 'cloud' ? 'saved to database' : 'saved in this browser only'}</b></div>
                </div>
              ) : null}
            </details>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #f1ede3', marginTop: 12, paddingTop: 10 }}>
              <span style={{ fontSize: 12.5, color: '#5d6b82', flex: '1 1 220px' }}>
                {classes.length ? <>Showing <b>{classes.reduce((t, c) => t + c.count, 0)} students</b> in {classes.length} {layout === 'mix' ? 'mixed set' : `class${classes.length === 1 ? '' : 'es'}`} · by <b>{basis || 'overall marks'}</b>{language ? ` · ${language}` : ''}{house ? ` · ${house}` : ''}{topN ? ` · top group of ${topN}` : ''}</> : 'No students match these choices.'}
              </span>
              <button style={printOpen ? { ...ui.btn } : ui.ghost} disabled={!classes.length} onClick={() => { setPrintPick([basis]); setPrintOpen((v) => !v); }} aria-expanded={printOpen}>🖨️ Print…</button>
              <button style={ui.ghost} disabled={!classes.length} onClick={exportXlsx}>⬇️ Excel</button>
              <button style={ui.ghost} disabled={!classes.length || !subjects.length} onClick={exportAllSubjects} title="One sheet per subject, each with its own 7 groups">⬇️ Excel — every subject</button>
              {canEdit ? <button style={editing ? { ...ui.btn, background: '#be185d' } : ui.ghost} onClick={() => setEditing((e) => !e)}>{editing ? '✅ Done moving' : '✏️ Move students by hand'}</button> : null}
            </div>
            {printOpen ? (
              <div style={{ marginTop: 10, background: '#f8fafc', border: '1px solid #d9e2f0', borderRadius: 12, padding: '10px 12px' }} role="group" aria-label="Subjects to print">
                <b style={{ fontSize: 13 }}>Print which subjects?</b>
                <span style={{ fontSize: 12, color: '#5d6b82', marginLeft: 8 }}>Each subject prints as its own section.</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0' }}>
                  {[['', 'Overall marks'], ...subjects.map((x) => [x, x])].map(([b, label]) => <button key={label} style={chip(printPick.includes(b))} onClick={() => setPrintPick((cur) => (cur.includes(b) ? cur.filter((x) => x !== b) : [...cur, b]))} aria-pressed={printPick.includes(b)}>{label}</button>)}
                  <button style={{ ...chip(false), borderStyle: 'dashed' }} onClick={() => setPrintPick(['', ...subjects])}>All subjects</button>
                  <button style={{ ...chip(false), borderStyle: 'dashed' }} onClick={() => setPrintPick([basis])}>Only {basis || 'overall marks'}</button>
                </div>
                <button style={ui.btn} disabled={!printPick.length} onClick={() => { print(printPick); setPrintOpen(false); }}>🖨️ Print {printPick.length || ''} subject{printPick.length === 1 ? '' : 's'}</button>
                <button style={{ ...ui.ghost, marginLeft: 8 }} onClick={() => setPrintOpen(false)}>Cancel</button>
              </div>
            ) : null}
            {canEdit && (editing || manualTotal) ? (
              <div style={{ fontSize: 12, color: '#5d6b82', marginTop: 8 }}>
                {manualTotal ? `${manualTotal} student${manualTotal === 1 ? '' : 's'} moved by hand for ${basis || 'overall marks'} (marked ✎)` : `Nobody moved by hand for ${basis || 'overall marks'} yet`}
                {' · '}<b style={{ color: choiceMode === 'cloud' ? '#047857' : '#b45309' }}>{choiceMode === 'cloud' ? 'saved to database' : 'saved in this browser only'}</b>
                {manualTotal ? <> {' · '}<button style={{ ...ui.ghost, padding: '2px 10px', fontSize: 12 }} onClick={resetManual}>↺ Reset to automatic</button></> : null}
              </div>
            ) : null}
          </div>

          {prog.total ? (
            <div style={{ ...ui.card, padding: '10px 14px', display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <b style={{ fontSize: 13 }}>Duty setup</b>
              <div style={{ flex: '1 1 140px', maxWidth: 240 }} aria-label={`${prog.assigned} of ${prog.total} groups have someone on duty`}>
                <div style={{ height: 8, borderRadius: 999, background: '#eceff4', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round((prog.assigned / prog.total) * 100)}%`, background: prog.assigned === prog.total ? '#16a34a' : '#ca8a04' }} /></div>
              </div>
              <span style={{ fontSize: 12.5 }}><b>{prog.assigned}</b> of {prog.total} groups have someone on duty{prog.assigned ? <> · <b>{prog.instr}</b> with an instruction</> : null}</span>
              {canEdit && prog.assigned < prog.total ? <span style={{ fontSize: 12, color: '#92400E' }}>Use “Assigned for duty” on each group below.</span> : null}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
                <button style={schedOpen ? { ...ui.btn, padding: '4px 12px', fontSize: 12.5 } : { ...ui.ghost, padding: '4px 12px', fontSize: 12.5 }} onClick={() => setSchedOpen((v) => !v)} aria-expanded={schedOpen}>🗓 Time slots &amp; rooms</button>
                <button style={{ ...ui.ghost, padding: '4px 12px', fontSize: 12.5 }} onClick={() => setView('duty')}>Open Duty desk →</button>
              </span>
            </div>
          ) : null}
          {schedOpen ? (
            <div style={{ ...ui.card, border: '1.5px solid #b8923a' }} role="region" aria-label="Study schedule">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <b style={{ fontSize: 14 }}>🗓 Study schedule — time slot for each subject, room for each group</b>
                <span style={{ fontSize: 12, color: '#5d6b82' }}>Applies to every duty card, the Duty desk, duty sheets and reports · <b style={{ color: scheduleMode === 'cloud' ? '#047857' : '#b45309' }}>{scheduleMode === 'cloud' ? 'saved to database' : 'saved in this browser only'}</b></span>
              </div>
              <div style={{ fontSize: 12, color: '#5d6b82', margin: '4px 0 10px' }}>A person's own “where / when” (set on their instruction) still wins; the schedule fills in the rest. Leave a time empty for no fixed slot.</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>Time slot for each subject</div>
                  {[...new Set([...subjects, ...Object.keys(schedule.subjects)])].map((sub) => {
                    const v = schedule.subjects[sub] || { from: '', to: '', days: [] };
                    const bad = v.from && v.to && v.to <= v.from;
                    return (
                      <div key={sub} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', padding: '6px 0', borderTop: '1px solid #f4f0e6' }}>
                        <b style={{ width: 110, fontSize: 13 }}>{sub}</b>
                        {canEdit ? (
                          <>
                            <input type="time" style={ui.input} value={v.from} onChange={(e) => setSubjectSlot(sub, { ...v, from: e.target.value })} aria-label={`${sub} from`} />
                            <span style={{ color: '#5d6b82' }}>to</span>
                            <input type="time" style={ui.input} value={v.to} onChange={(e) => setSubjectSlot(sub, { ...v, to: e.target.value })} aria-label={`${sub} to`} />
                            <span style={{ display: 'inline-flex', gap: 3, flexWrap: 'wrap' }}>
                              {DAYS.map((d) => <button key={d} type="button" style={{ ...chip((v.days || []).includes(d)), padding: '2px 7px', fontSize: 11 }} onClick={() => setSubjectSlot(sub, { ...v, days: (v.days || []).includes(d) ? v.days.filter((x) => x !== d) : [...(v.days || []), d] })} aria-pressed={(v.days || []).includes(d)} aria-label={`${sub} ${d}`}>{d}</button>)}
                            </span>
                            {bad ? <span role="alert" style={{ fontSize: 11.5, color: '#b42318' }}>end must be after start</span> : null}
                          </>
                        ) : <span style={{ fontSize: 13 }}>{slotText(v) || 'no fixed slot'}</span>}
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.8px', marginBottom: 4 }}>Room for each group</div>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <div key={n} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '4px 0', borderTop: '1px solid #f4f0e6' }}>
                      <b style={{ width: 70, fontSize: 13, color: GROUP_META[n - 1].color }}>Group {n}</b>
                      {canEdit ? <input style={{ ...ui.input, width: 160 }} value={schedule.rooms[n] ?? ''} onChange={(e) => setRoomName(n, e.target.value)} onBlur={() => saveRoomName(n)} aria-label={`Room for Group ${n}`} /> : <span style={{ fontSize: 13 }}>{schedule.rooms[n] || '—'}</span>}
                    </div>
                  ))}
                </div>
              </div>
              {layout === 'class' && classes.length > 1 ? <div style={{ fontSize: 12, color: '#92400E', marginTop: 8 }}>With <b>Within each class</b>, every class has its own Group 1…7, so several Group 1s are sent to the same room at the same time. <b>Mixed across classes</b> gives one set of 7 groups for 7 rooms.</div> : null}
              {roomClash.length ? (
                <div role="alert" style={{ marginTop: 8, background: '#fef2f2', border: '1px solid #fbd5d5', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, color: '#b42318' }}>
                  <b>⚠ {roomClash.length} room clash{roomClash.length === 1 ? '' : 'es'}:</b> two groups in the same room at the same time — e.g. {roomClash.slice(0, 2).map((x) => `${x.venue}: ${x.a} and ${x.b}`).join('; ')}{roomClash.length > 2 ? '…' : ''}
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {canEdit ? <button style={ui.ghost} onClick={resetSched}>↺ Back to the standard schedule</button> : null}
                <button style={ui.ghost} onClick={() => setSchedOpen(false)}>Close</button>
              </div>
            </div>
          ) : null}
          {Object.keys(removedHere).length ? <div style={{ fontSize: 12, color: '#5d6b82', margin: '0 2px 10px' }}>{Object.keys(removedHere).length} student{Object.keys(removedHere).length === 1 ? ' is' : 's are'} removed from the {basis || 'overall'} groups — restore them in the Duty desk.</div> : null}
          {dirErr ? <div style={{ fontSize: 12, color: '#92400E', margin: '0 2px 10px' }}>House Master / Mistress could not be loaded ({dirErr}) — the groups are shown without them.</div> : null}
          {language && !classes.length ? (
            <div style={{ ...ui.card, background: '#FFFBEB', borderColor: '#FCD34D', fontSize: 13, color: '#92400E' }}>
              No class is marked <b>{language}</b>. {canEdit ? 'Open “More options” and set the language of each class.' : 'Ask an admin to set the language of each class.'}
            </div>
          ) : null}
          {!language && unlabelled.length ? <div style={{ fontSize: 12, color: '#5d6b82', margin: '0 2px 10px' }}>No language is set for {unlabelled.join(', ')} — they appear under “All” only.</div> : null}
          {emptyHidden ? <div style={{ fontSize: 12, color: '#5d6b82', margin: '0 2px 10px' }}>{emptyHidden} empty group{emptyHidden === 1 ? ' is' : 's are'} hidden — tick “Show empty groups” in More options to see {emptyHidden === 1 ? 'it' : 'them'}.</div> : null}
        </>
      ) : null}

      {view === 'duty' ? (
        <MockDutyDesk rows={rows} series={series} institute={institute} subjects={subjects} duties={duties}
          removed={removed} custom={custom} dir={dir} canEdit={canEdit} userName={userName} userStaffId={userStaffId}
          onRemove={removeIn} onRestore={restoreIn} onTransfer={(b, sid, grp) => move(sid, grp, b)} onSaveCustom={saveCustom} onDeleteCustom={deleteCustom} onSaveInstruction={saveInstructionFor}
          storageNote={removedMode === 'local' || customMode === 'local' ? 'Removals and manual groups are saved in this browser only until the database tables are added (migration 20261052).' : ''}
          onClose={() => setView('groups')} />
      ) : null}

      {view === 'report' ? (
        classes.length ? (
          <MockGroupReport classes={classes} autoClasses={autoClasses} basis={basis} series={series} institute={institute} passPct={passPct} duties={duties} allSubjects={subjects}
            hmOf={hmOf} mentorOf={(c, g) => mentorOf(c, basis, g)} layoutLabel={layoutLabel} onClose={() => setView('groups')} />
        ) : <div style={{ ...ui.card, textAlign: 'center', color: '#5d6b82' }}>There are no students to report on with the current choices. <button style={{ ...ui.ghost, marginLeft: 8 }} onClick={() => setView('groups')}>← Back to groups</button></div>
      ) : null}

      {view === 'groups' ? classes.map((c) => (
        <div key={c.batch} style={ui.card}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>{c.batch}</h3>
            {c.mixed ? <span style={{ fontSize: 12.5, color: '#2e3b52' }}>{c.classes.join(' + ')}</span> : null}
            {basis ? <Pill text={`${basis} only`} color="#be185d" /> : null}
            {c.language ? <Pill text={c.language} color={c.language === 'English' ? '#1e3a6e' : '#7c3aed'} /> : null}
            <span style={{ fontSize: 12.5, color: '#5d6b82' }}>{c.count} students · {c.mixed ? 'average' : 'class average'} {fx(c.avg)}%</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
            {c.groups.filter((g) => showEmpty || g.n).map((g) => (
              <div key={g.no} style={{ border: '1px solid #e8e3d8', borderTop: `4px solid ${g.color}`, borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
                <div style={{ padding: '8px 10px', background: `${g.color}12` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
                    <b style={{ color: g.color }}>{g.name} · {g.tag}</b>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{g.n}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#5d6b82' }}>{g.n ? `${fx(g.min)}–${fx(g.max)}% · avg ${fx(g.avg)}%` : 'no students'}</div>
                  {g.focus ? <div style={{ fontSize: 11.5, marginTop: 3 }}>{basis ? 'Subject' : 'Focus'}: <b>{g.focus}</b> <span style={{ color: '#5d6b82' }}>({fx(g.focusPct, 0)}%)</span></div> : null}
                  {dir && g.n ? <div style={{ fontSize: 11.5, marginTop: 3, color: '#2e3b52' }}>{hmSummary(g, hmOf)}</div> : null}
                  {g.n && !mentorOf(c, basis, g) ? <div style={{ fontSize: 11.5, marginTop: 3, color: '#b45309', fontWeight: 700 }}>⚠ Nobody on duty yet</div> : null}
                  {g.n && !mentorOf(c, basis, g) ? (() => { const sc = withSchedule({}, schedule, basis || 'Overall marks', g.no); const t = [sc.venue && `📍 ${sc.venue}`, slotText(sc) && `🕔 ${slotText(sc)}`].filter(Boolean).join(' · '); return t ? <div style={{ fontSize: 11.5, marginTop: 3, color: '#2e3b52' }}>{t}</div> : null; })() : null}
                  {canEdit && dir ? (
                    <label style={{ display: 'block', fontSize: 11, marginTop: 5, color: '#5d6b82' }}>Assigned for duty
                      <select aria-label={`Assigned for duty for ${g.name}`} style={{ ...ui.input, width: '100%', padding: '3px 6px', fontSize: 12, marginTop: 2 }}
                        value={([...dir.masters, ...dir.teachers].find((m) => m.name === mentorOf(c, basis, g)?.name) || {}).key || ''} onChange={(e) => assign(c, g, e.target.value)}>
                        <option value="">— not assigned —</option>
                        {dir.masters.length ? <optgroup label="House Masters / Mistresses">{dir.masters.map((m) => <option key={m.key} value={m.key}>{m.name} ({m.title})</option>)}</optgroup> : null}
                        {dir.teachers.length ? <optgroup label="Teaching staff">{dir.teachers.map((m) => <option key={m.key} value={m.key}>{m.name} ({m.title})</option>)}</optgroup> : null}
                      </select>
                    </label>
                  ) : mentorOf(c, basis, g) ? <div style={{ fontSize: 11.5, marginTop: 4 }}>Assigned: <b>{mentorOf(c, basis, g).name}</b> <span style={{ color: '#5d6b82' }}>({mentorOf(c, basis, g).title})</span></div> : null}
                  {mentorOf(c, basis, g) ? (
                    <div style={{ marginTop: 5 }}>
                      <InstructionSummary value={withSchedule(mentorOf(c, basis, g), schedule, basis || 'Overall marks', g.no)} compact />
                      {canEdit && dir ? (
                        <button style={{ ...ui.ghost, padding: '2px 8px', fontSize: 11.5, marginTop: 2 }} onClick={() => {
                          const key = `${setKeyOf(c)}|${g.no}`;
                          if (instEditKey === key) { setInstEditKey(null); return; }
                          setInstEditKey(key); setInstDraft(withSchedule(mentorOf(c, basis, g), schedule, basis || 'Overall marks', g.no)); setInstAll(false);
                        }} aria-label={`Instructions for ${g.name}`}>{hasInstruction(mentorOf(c, basis, g)) ? '📋 Edit instruction' : '📋 Add instruction'}</button>
                      ) : null}
                      {instEditKey === `${setKeyOf(c)}|${g.no}` && instDraft ? (
                        <div style={{ marginTop: 6, background: '#fffdf5', border: '1px solid #f1deaa', borderRadius: 10, padding: 8 }}>
                          <InstructionForm value={instDraft} onChange={setInstDraft} who={mentorOf(c, basis, g).name} />
                          <label style={{ display: 'block', fontSize: 11.5, margin: '6px 0' }}><input type="checkbox" checked={instAll} onChange={(e) => setInstAll(e.target.checked)} /> Same for all of {mentorOf(c, basis, g).name}'s groups in {basis || 'overall marks'}</label>
                          <button style={{ ...ui.btn, padding: '5px 12px', fontSize: 12 }} disabled={!!(instDraft.from && instDraft.to && instDraft.to <= instDraft.from)} onClick={async () => {
                            const who2 = mentorOf(c, basis, g).name;
                            const targets = instAll ? classes.flatMap((c2) => c2.groups.filter((g2) => mentorOf(c2, basis, g2)?.name === who2).map((g2) => [c2, g2])) : [[c, g]];
                            for (const [c2, g2] of targets) await saveDutyDetails(basis, setKeyOf(c2), g2.no, instDraft);
                            setInstEditKey(null);
                          }}>Save</button>
                          <button style={{ ...ui.ghost, padding: '4px 10px', fontSize: 12, marginLeft: 6 }} onClick={() => setInstEditKey(null)}>Cancel</button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {g.students.map((s) => (
                    <div key={s.sid} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '4px 10px', borderTop: '1px solid #f1ede3', fontSize: 12.5 }}>
                      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.manual ? <span title="Placed here by an admin" style={{ color: '#be185d' }}>✎ </span> : null}{s.name} <span style={{ color: '#8a93a6' }}>{s.gcc ? `· ${s.gcc}` : ''}</span>
                        {c.mixed ? <span style={{ display: 'block', fontSize: 11, color: '#7c3aed' }}>{s.batch}</span> : null}
                        {dir ? <span style={{ display: 'block', fontSize: 11, color: '#5d6b82' }}>{hmOf(s.gcc).house ? `${hmOf(s.gcc).house} · ${hmOf(s.gcc).label || 'no House Master / Mistress assigned'}` : 'House not recorded'}</span> : null}</span>
                      {editing && canEdit ? (
                        <select aria-label={`Group for ${s.name}`} style={{ ...ui.input, padding: '2px 4px', fontSize: 12, flexShrink: 0 }} value={s.manual ? g.no : 'auto'}
                          onChange={(e) => move(s.sid, e.target.value === 'auto' ? null : Number(e.target.value))}>
                          <option value="auto">Auto</option>
                          {GROUP_META.map((m) => <option key={m.no} value={m.no}>Group {m.no}</option>)}
                        </select>
                      ) : null}
                      <b style={{ color: g.color, flexShrink: 0 }}>{fx(s.avg)}%</b>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )) : null}
      {toast ? <div role="status" style={{ position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', background: '#0f2347', color: '#fff', padding: '9px 18px', borderRadius: 999, fontSize: 13, fontWeight: 600, boxShadow: '0 10px 26px -10px rgba(0,0,0,.5)', zIndex: 9999 }}>{toast}</div> : null}
    </>
  );
}

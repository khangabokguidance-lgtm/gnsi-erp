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
  DEFAULT_SERIES, parseResultSheet, inferMax, guessFromFilename, resolveIdentities, seriesMeta,
  studentAnalysis, batchAnalysis, batchComparison, matchingReport, rowsFromSeed, strengthLabel, r1, r2, cleanName, gccDigits,
} from './lib/mockTestEngine';
import { lineChart, barChart, radarChart, hBars, subjColor } from './lib/mockTestCharts';
import { printDocument, studentReportHTML, batchReportHTML, subjectReportHTML } from './lib/mockTestReports';
import ResponsiveTables from './ResponsiveTables';
import { loadAll, saveRows, deleteTest, resetSeries, resetAll, migrateLocalToCloud, localCount, loadFixes, migrateLocalFixes, localFixCount } from './lib/mockTestStore';
import { applyFixes } from './lib/studentFixEngine';
import { emptyFilter, isFilterActive, describeFilter, applyDataFilter, studentRoster, loadPresets, savePresets } from './lib/mockTestFilter';
import ExamIcon from './examIcons';
import MockFixEngine from './MockFixEngine';

const NAVY = '#132a4f';
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
  { id: 'overview', icon: 'home', label: 'Overview' },
  { id: 'student', icon: 'student', label: 'Student Analyser' },
  { id: 'subject', icon: 'subject', label: 'Subject Analysis' },
  { id: 'batch', icon: 'batch', label: 'Batch / Test Report' },
  { id: 'data', icon: 'data', label: 'Upload & Data' },
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
}`;

export default function MockTestAnalyzer({ institute, currentUser, canUpload = true, canDelete = false }) {
  const [tab, setTab] = useState('overview');
  const [allRows, setAllRows] = useState([]);
  const [mode, setMode] = useState('cloud');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [series, setSeries] = useState(DEFAULT_SERIES);
  const [passPct, setPassPct] = useState(40);
  const [fixes, setFixes] = useState([]);
  const [fixMode, setFixMode] = useState('cloud');

  const apply = useCallback((r) => {
    setAllRows(r.rows); setMode(r.mode); setNote(r.note); setErr('');
    const names = [...new Set(r.rows.map((x) => x.series))];
    setSeries((cur) => (names.length && !names.includes(cur) ? names[0] : cur));
  }, []);
  const applyFix = useCallback((f) => { setFixes(f.fixes); setFixMode(f.mode); }, []);
  const reload = useCallback(async () => {
    try { apply(await loadAll()); applyFix(await loadFixes()); } catch (e) { setErr(e.message || String(e)); }
  }, [apply, applyFix]);
  useEffect(() => {
    let live = true;
    Promise.all([loadAll(), loadFixes().catch(() => ({ fixes: [], mode: 'local' }))])
      .then(([r, f]) => { if (live) { apply(r); applyFix(f); } })
      .catch((e) => { if (live) setErr(e.message || String(e)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [apply, applyFix]);

  const seriesNames = useMemo(() => [...new Set(allRows.map((r) => r.series))].sort(), [allRows]);
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
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -12px 12px', padding: '2px 12px 6px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
        {SUBTABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ ...ui.ghost, flex: '0 0 auto', borderRadius: 999, padding: '8px 16px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 7, ...(tab === t.id ? { background: NAVY, color: '#fff', border: `1px solid ${NAVY}`, boxShadow: '0 4px 10px rgba(19,42,79,.25)' } : {}) }}><ExamIcon id={t.icon} size={16} />{t.label}</button>
        ))}
      </div>
      {!rows.length && tab !== 'data' ? (
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
          <div style={{ color: '#5d6b82', fontSize: 13, marginBottom: 12 }}>Upload the Excel result sheets (or load the built-in Pre Mock Test 2026 data) to start analysing.</div>
          <button style={ui.btn} onClick={() => setTab('data')}>Go to Upload &amp; Data</button>
        </div>
        )
      ) : null}
      {rows.length && tab === 'overview' ? <Overview key={viewKey} rows={rows} meta={meta} passPct={passPct} institute={institute} series={seriesLabel} /> : null}
      {rows.length && tab === 'student' ? <StudentView key={viewKey} rows={rows} meta={meta} passPct={passPct} institute={institute} series={seriesLabel} /> : null}
      {rows.length && tab === 'subject' ? <SubjectView key={viewKey} rows={rows} meta={meta} passPct={passPct} institute={institute} series={seriesLabel} /> : null}
      {rows.length && tab === 'batch' ? <BatchView key={viewKey} rows={rows} meta={meta} passPct={passPct} institute={institute} series={seriesLabel} /> : null}
      {tab === 'data' ? (
        <DataView allRows={allRows} rawRows={seriesRaw} rows={resolved} fixes={fixes} fixMode={fixMode} series={series} setSeries={changeSeries} mode={mode} meta={metaAll} who={who}
          canUpload={canUpload} canDelete={canDelete} reload={reload} />
      ) : null}
    </div></ResponsiveTables>
  );
}

// ─── Data filter ──────────────────────────────────────────────────────────────
const chip = (on) => ({ padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? NAVY : '#d9d2c2'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#2e3b52' });
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
function Overview({ rows, meta, passPct, institute, series }) {
  const cmp = useMemo(() => batchComparison(rows, passPct), [rows, passPct]);
  const all = useMemo(() => batchAnalysis(rows, '', null, { passPct }), [rows, passPct]);
  const subs = meta.subjects;
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
        <Stat label="Overall average" value={`${fx(all.avgPct)}%`} color={strengthLabel(all.avgPct).color} />
        <Stat label={`Pass ≥ ${passPct}%`} value={`${fx(all.pass, 0)}%`} color={all.pass >= 75 ? '#047857' : '#b45309'} />
        <Stat label="Strongest subject" value={all.easiest.subject} sub={`${fx(all.easiest.avgPct)}% avg`} color="#047857" />
        <Stat label="Weakest subject" value={all.toughest.subject} sub={`${fx(all.toughest.avgPct)}% avg`} color="#b91c1c" />
        <Stat label="At risk" value={all.atRisk.length} sub="students" color="#b91c1c" />
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ ...ui.card, flex: '1 1 min(420px, 100%)' }}><Svg minW={520} html={trend} /></div>
        <div style={{ ...ui.card, flex: '1 1 min(420px, 100%)' }}><Svg minW={520} html={batchBars} /></div>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Batch comparison</h4>
        <Table head={['Batch', 'Students', 'Tests', 'Avg %', `Pass ≥${passPct}%`, 'Highest', ...subs.map((s) => `${s} %`)]}>
          {cmp.map((c) => (
            <tr key={c.batch}>
              <td style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>{c.batch}</td><td style={ui.td}>{c.students}</td><td style={ui.td}>{c.tests}</td>
              <td style={{ ...ui.td, fontWeight: 700, color: strengthLabel(c.avgPct).color }}>{fx(c.avgPct)}%</td><td style={ui.td}>{fx(c.pass, 0)}%</td><td style={ui.td}>{fx(c.high, 2)}</td>
              {subs.map((s) => <td key={s} style={{ ...ui.td, background: heatBg(c.subj[s]) }}>{fx(c.subj[s])}%</td>)}
            </tr>
          ))}
        </Table>
      </div>
      <div style={ui.card}>
        <h4 style={{ margin: '0 0 8px' }}>Subject difficulty — all batches</h4>
        <Svg minW={440} html={hBars({ items: [...all.perSubject].sort((a, b) => a.avgPct - b.avgPct).map((s) => ({ label: s.subject, value: s.avgPct, color: subjColor(subs, s.subject) })), width: 640 })} />
        <div style={{ marginTop: 10 }}>
          <button style={ui.btn} onClick={() => printDocument(batchReportHTML(all, { institute, series }), `${series} — Institute report`)}>🖨️ Print institute report</button>
        </div>
      </div>
    </>
  );
}

// ─── Student analyser ─────────────────────────────────────────────────────────
function StudentView({ rows, meta, passPct, institute, series }) {
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

  const a = useMemo(() => (sid ? studentAnalysis(rows, sid, { passPct }) : null), [rows, sid, passPct]);
  const idx = list.findIndex((s) => s.sid === sid);
  const ctx = { institute, series };

  const printAll = () => {
    const html = list.map((s) => studentReportHTML(studentAnalysis(rows, s.sid, { passPct }), ctx)).join('');
    printDocument(html, `${series} — Student reports${batch ? ' · ' + batch : ''}`);
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
      {!a ? <div style={ui.card}>No student matches the filter.</div> : <StudentCard a={a} onPrint={() => printDocument(studentReportHTML(a, ctx), `${a.name} — Performance report`)} onPrintAll={printAll} count={list.length} batch={batch} />}
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
          <div style={{ marginTop: 4 }}><Pill text={S.band.label} color={S.band.color} /> {S.atRisk ? <Pill text="At risk" color="#b91c1c" /> : null}</div>
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
        <Table head={['Test', 'Batch', ...subs, 'Total', '%', 'Rank', 'Pctile', 'Batch avg', '± avg']}>
          {a.tests.map((t) => (
            <tr key={t.test_no}>
              <td style={{ ...ui.td, textAlign: 'left', fontWeight: 700 }}>T{t.test_no}</td><td style={ui.td}>{t.batch}</td>
              {subs.map((s) => <td key={s} style={{ ...ui.td, background: heatBg(t.subj[s]?.pct) }}>{t.subj[s] ? fx(t.subj[s].marks, 2) : '—'}</td>)}
              <td style={{ ...ui.td, fontWeight: 700 }}>{fx(t.total, 2)}/{t.max}</td><td style={{ ...ui.td, fontWeight: 700, color: strengthLabel(t.pct).color }}>{fx(t.pct)}%</td>
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
function SubjectView({ rows, meta, passPct, institute, series }) {
  const [batch, setBatch] = useState('');
  const [test, setTest] = useState('');
  const [pickedSubject, setSubject] = useState('');
  const subject = meta.subjects.includes(pickedSubject) ? pickedSubject : (meta.subjects[0] || '');
  const b = useMemo(() => batchAnalysis(rows, batch, test === '' ? null : Number(test), { passPct }), [rows, batch, test, passPct]);
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
        <button style={ui.btn} onClick={() => printDocument(subjectReportHTML(b, ps.subject, { institute, series }), `${ps.subject} — Subject analysis`)}>🖨️ Print subject report</button>
        <button style={ui.ghost} onClick={() => printDocument(b.meta.subjects.map((s) => subjectReportHTML(b, s, { institute, series })).join(''), 'All subjects — analysis')}>🖨️ Print all subjects</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat label="Average" value={`${fx(ps.avg, 2)}/${ps.max}`} sub={`${fx(ps.avgPct)}%`} color={ps.label.color} />
        <Stat label="Highest" value={fx(ps.high, 2)} sub={`${ps.highWho} (T${ps.highTest})`} color="#047857" />
        <Stat label="Lowest" value={fx(ps.low, 2)} sub={`${ps.lowWho} (T${ps.lowTest})`} color="#b91c1c" />
        <Stat label="Median / SD" value={fx(ps.median, 2)} sub={`SD ${fx(ps.sd)}`} color={NAVY} />
        <Stat label={`Pass ≥ ${passPct}%`} value={`${fx(ps.pass, 0)}%`} color={ps.pass >= 75 ? '#047857' : '#b45309'} />
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
        <Table maxH={520} head={['#', 'Student', 'GCC', 'Batch', ...tests.map((t) => `T${t}`), 'Avg %', 'Status']}>
          {ranked.map((s, i) => {
            const st = strengthLabel(s.sub[ps.subject]);
            return (
              <tr key={s.sid}>
                <td style={ui.td}>{i + 1}</td><td style={{ ...ui.td, textAlign: 'left', fontWeight: 600 }}>{s.name}</td><td style={ui.td}>{s.gcc || '—'}</td><td style={ui.td}>{s.batch}</td>
                {tests.map((t) => { const v = s.subTests?.[ps.subject]?.[t]; return <td key={t} style={{ ...ui.td, background: heatBg(v == null ? null : (v / ps.max) * 100) }}>{v == null ? '—' : fx(v, 2)}</td>; })}
                <td style={{ ...ui.td, fontWeight: 700, color: st.color }}>{fx(s.sub[ps.subject])}%</td><td style={ui.td}><Pill text={st.label} color={st.color} /></td>
              </tr>
            );
          })}
        </Table>
      </div>
    </>
  );
}

// ─── Batch / test report ──────────────────────────────────────────────────────
function BatchView({ rows, meta, passPct, institute, series }) {
  const [batch, setBatch] = useState(meta.batches[0] || '');
  const [test, setTest] = useState('');
  const b = useMemo(() => batchAnalysis(rows, batch, test === '' ? null : Number(test), { passPct }), [rows, batch, test, passPct]);
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
        <button style={ui.btn} onClick={() => printDocument(batchReportHTML(b, { institute, series }), `${series} — ${batch || 'All batches'} report`)}>🖨️ Print report</button>
        <button style={ui.ghost} onClick={exportXlsx}>⬇️ Export ranking (Excel)</button>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat label="Students" value={b.studentCount} sub={`${b.rowsCount} results`} color={NAVY} />
        <Stat label="Average" value={`${fx(b.avgPct)}%`} color={strengthLabel(b.avgPct).color} />
        <Stat label={`Pass ≥ ${passPct}%`} value={`${fx(b.pass, 0)}%`} color={b.pass >= 75 ? '#047857' : '#b45309'} />
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
              <td style={{ ...ui.td, fontWeight: 700, color: strengthLabel(s.avgPct).color }}>{fx(s.avgPct)}%</td><td style={ui.td}>{fx(s.best, 2)}</td>
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

function DataView({ allRows, rawRows, rows, fixes, fixMode, series, setSeries, mode, meta, who, canUpload, canDelete, reload }) {
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
    if (!window.confirm('Load the built-in Pre Mock Test 2026 data (24 sheets, 1,046 results)? Sheets already saved for the same test and batch will be replaced.')) return;
    setBusy('Loading built-in data…'); setMsg('');
    try {
      const seed = (await import('./data/preMockTest2026.json')).default;
      const rows = rowsFromSeed(seed, DEFAULT_SERIES, SEED_SUBJECTS, 25);
      await saveRows(rows, mode, who || 'seed');
      setSeries(DEFAULT_SERIES);
      setMsg(`✅ Loaded ${rows.length} results (8 tests · 5 batches).`);
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
            <Field label="Save into series" grow><input style={{ ...ui.input, width: '100%' }} list="mta-series" value={newSeries} onChange={(e) => setNewSeries(e.target.value)} /><datalist id="mta-series">{[...new Set(allRows.map((r) => r.series))].map((s) => <option key={s} value={s} />)}</datalist></Field>
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

      {canUpload ? (
        <div style={{ ...ui.card, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 min(300px, 100%)' }}><b>Built-in data: Pre Mock Test 2026</b><div style={{ fontSize: 12.5, color: '#5d6b82' }}>24 result sheets · 8 tests · Lakshya A/B, Umeed, Combined English &amp; Manipuri · Mental Ability, EVS, Mathematics, Passage (25 each).</div></div>
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

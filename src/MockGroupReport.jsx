// MockGroupReport.jsx — "Smart report generator" for the Self-Study Groups.
// Works on the groups currently in view (see GroupsView), adds advanced filters, six report types, automatic
// insights, saved presets, and print / Excel output. Logic lives in lib/mockTestReport.js.
import { useMemo, useState } from 'react';
import { printDocument, letterhead } from './lib/mockTestReports';
import {
  REPORT_TYPES, QUICK_REPORTS, SORT_OPTIONS, NOT_ASSIGNED, emptyReportFilter, isReportFilterActive, recordsFrom,
  applyReportFilter, sortRecords, buildReport, smartInsights, describeReportFilter, sheetName,
} from './lib/mockTestReport';

const NAVY = '#132a4f';
const PRESET_KEY = 'gnsi_mock_group_report_presets_v1';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fx = (n) => (n === null || n === undefined || !Number.isFinite(n) ? '—' : String(Math.round(n * 10) / 10));
const readPresets = () => { try { const v = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const writePresets = (l) => { try { localStorage.setItem(PRESET_KEY, JSON.stringify(l)); } catch { /* storage unavailable */ } };
const heat = (p) => (p === null || p === undefined ? '#fff' : p >= 75 ? '#bbf7d0' : p >= 60 ? '#e4ebf6' : p >= 45 ? '#fef3c7' : '#fecaca');
const barColor = (p, pass) => (p >= 75 ? '#16a34a' : p >= 60 ? '#65a30d' : p >= pass ? '#ca8a04' : '#dc2626');

const S = {
  card: { background: '#fff', border: '1px solid #e8e3d8', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 2px 10px rgba(19,42,79,.06)' },
  input: { padding: '7px 10px', borderRadius: 10, border: '1px solid #d9d2c2', fontSize: 13, background: '#fff', color: '#0f1b2e', fontFamily: 'inherit', minWidth: 0, boxSizing: 'border-box' },
  btn: { padding: '9px 16px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: NAVY, color: '#fff', fontFamily: 'inherit' },
  ghost: { padding: '8px 13px', borderRadius: 12, border: '1px solid #d9d2c2', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#2e3b52', fontFamily: 'inherit' },
  label: { fontSize: 11, fontWeight: 700, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: .8, marginBottom: 3, display: 'block' },
  chip: (on) => ({ padding: '5px 12px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? NAVY : '#d9d2c2'}`, background: on ? NAVY : '#fff', color: on ? '#fff' : '#2e3b52' }),
  th: { background: NAVY, color: '#fff', padding: '6px 8px', fontSize: 11, textTransform: 'uppercase', letterSpacing: .5, textAlign: 'left', whiteSpace: 'nowrap', position: 'sticky', top: 0 },
  td: { padding: '5px 8px', borderBottom: '1px solid #E5E7EB', fontSize: 12.5, whiteSpace: 'nowrap' },
};
const F = ({ label, children, grow }) => <label className="mta-field" style={{ flex: grow ? '1 1 200px' : '0 1 auto', display: 'block' }}><span style={S.label}>{label}</span>{children}</label>;
const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export default function MockGroupReport({ classes, autoClasses, basis, series, institute, passPct, hmOf, mentorOf, layoutLabel, duties = null, allSubjects = [], onClose }) {
  const [type, setType] = useState('roster');
  const [f, setF] = useState(emptyReportFilter);
  const [presets, setPresets] = useState(readPresets);
  const [presetName, setPresetName] = useState('');
  const [msg, setMsg] = useState('');
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));

  const autoMap = useMemo(() => { const m = new Map(); autoClasses.forEach((c) => c.groups.forEach((g) => g.students.forEach((s) => m.set(`${c.batch}|${s.sid}`, g.no)))); return m; }, [autoClasses]);
  const all = useMemo(() => recordsFrom(classes, { hmOf, mentorOf, autoGroupOf: (sid, c) => autoMap.get(`${c.batch}|${sid}`) ?? null, basis, passPct }), [classes, hmOf, mentorOf, autoMap, basis, passPct]);
  const filtered = useMemo(() => sortRecords(applyReportFilter(all, f), f.sort), [all, f]);
  const report = useMemo(() => buildReport(type, filtered, { basis, duties, filter: f, passPct }), [type, filtered, basis, duties, f, passPct]);
  const insights = useMemo(() => smartInsights(filtered, { passPct, basis, duties, allSubjects }), [filtered, passPct, basis, duties, allSubjects]);
  const dutySubjects = useMemo(() => [...new Set((duties || []).flatMap((p) => p.sections.map((x) => x.subject)))].sort((a, b) => (b === 'Overall marks') - (a === 'Overall marks') || a.localeCompare(b)), [duties]);
  const desc = describeReportFilter(f);
  const opt = (key) => [...new Set(all.map((r) => r[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const classNames = opt('class'), houses = opt('house'), hms = opt('hm'), mentors = opt('mentor'), weakSubs = opt('weakest');
  const active = isReportFilterActive(f);

  const quick = (q) => { setType(q.type); setF({ ...emptyReportFilter(), ...q.filter }); setMsg(''); };
  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const next = [...presets.filter((p) => p.name !== name), { name, type, filter: f }];
    setPresets(next); writePresets(next); setPresetName(''); setMsg(`Saved “${name}”.`);
  };
  const loadPreset = (name) => { const p = presets.find((x) => x.name === name); if (p) { setType(p.type); setF({ ...emptyReportFilter(), ...p.filter }); } };
  const delPreset = (name) => { const next = presets.filter((p) => p.name !== name); setPresets(next); writePresets(next); };

  const summaryText = () => `${report.title} — ${series}${basis ? ` · ${basis}` : ''} · ${layoutLabel}\n${desc}\n\n${insights.map((l) => `• ${l}`).join('\n')}`;
  const copy = async () => { try { await navigator.clipboard.writeText(summaryText()); setMsg('Summary copied — paste it into WhatsApp or a message.'); } catch { setMsg('Could not copy automatically — select the summary text and copy it.'); } };

  const exportXlsx = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(report.rows.length ? report.rows : [{ Note: 'No students match the filters.' }]), sheetName(report.title));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Report', report.title], ['Series', series], ['Marks of', basis || 'Overall marks'], ['Groups', layoutLabel], ['Filters', desc], [], ['Smart summary'], ...insights.map((l) => [l])]), 'Summary');
    XLSX.writeFile(wb, `${series} - ${report.title}.xlsx`);
  };

  const print = () => {
    const subs = report.subjects || [];
    const kpis = `<div class="kpis" style="grid-template-columns:repeat(4,1fr)"><div class="kpi"><small>Students</small><b>${filtered.length}</b></div><div class="kpi"><small>Average</small><b>${fx(filtered.length ? filtered.reduce((t, r) => t + r.score, 0) / filtered.length : null)}%</b></div><div class="kpi"><small>Below pass (${passPct}%)</small><b>${filtered.filter((r) => r.below).length}</b></div><div class="kpi"><small>Declining</small><b>${filtered.filter((r) => r.trendText === 'Declining').length}</b></div></div>`;
    const head = (cs) => `<thead><tr>${cs.map((c, i) => `<th class="${i < 4 ? 'l' : ''}">${esc(c.label)}</th>`).join('')}</tr></thead>`;
    const rowHtml = (cs, r) => `<tr>${cs.map((c, i) => `<td class="${i < 4 ? 'l' : ''}"${report.heat && report.heat.includes(c.key) ? ` style="background:${heat(r[c.key])};font-weight:700"` : ''}>${esc(r[c.key] ?? '')}</td>`).join('')}</tr>`;
    let body;
    if (report.dutyView) {
      const people = [...new Set(report.rows.map((r) => r['Person on duty']))];
      body = people.map((person) => {
        const rs = report.rows.filter((r) => r['Person on duty'] === person);
        const subs = [...new Set(rs.map((r) => r['Supervises study duty for']))];
        return `<div class="avoid" style="border:1.5px solid #0f2d5e;border-radius:8px;padding:9px 11px;margin:0 0 10px">
          <div style="font-size:13px;font-weight:800;color:#0f2d5e">${esc(person)}</div>
          <div style="margin:3px 0 6px"><span style="font-size:9.5px;text-transform:uppercase;letter-spacing:1px;color:#475569;font-weight:700">Supervises study duty for:</span> ${subs.map((x) => `<span class="pill" style="background:#0f2d5e;margin-left:4px">${esc(x)}</span>`).join('')}</div>
          <table><thead><tr><th class="l">Subject</th><th class="l">Group</th><th class="l">Class / set</th><th>Students</th><th>Avg %</th><th class="l">Where</th><th class="l">Days &amp; time</th><th class="l">Why (reason)</th></tr></thead>
          <tbody>${rs.map((r) => `<tr><td class="l"><b>${esc(r['Supervises study duty for'])}</b></td><td class="l">${esc(r.Group)}</td><td class="l">${esc(r['Class / set'])}</td><td>${esc(r.Students)}</td><td>${fx(r['Average %'])}</td><td class="l">${esc(r.Where)}</td><td class="l">${esc(r['Days & time'])}</td><td class="l">${esc(r.Why)}</td></tr>`).join('')}</tbody></table>
          ${rs.filter((r) => r.Instruction && r.Instruction !== '—').map((r) => `<div style="font-size:10px;margin-top:3px"><b>📋 ${esc(r['Supervises study duty for'])} · ${esc(r.Group)}:</b> ${esc(r.Instruction)}</div>`).join('')}</div>`;
      }).join('') || '<p>Nobody is on duty yet.</p>';
    } else if (type === 'cards') {
      body = `<div class="grid2">${report.cards.map((r) => `<div class="box avoid"><b style="font-size:12.5px">${esc(r.name)}</b> <span style="color:#475569">· ${esc(r.class)} · GCC ${esc(r.gcc)}</span><br><span class="pill" style="background:${r.group <= 2 ? '#dc2626' : r.group >= 6 ? '#047857' : '#ca8a04'}">Group ${r.group} · ${esc(r.tag)}</span> <b>${fx(r.score)}%</b>${r.trendText ? ` · ${esc(r.trendText)}` : ''}
        <div style="margin-top:5px">${subs.map((s) => `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="width:92px;font-size:10px">${esc(s)}</span><span style="flex:1;background:#e2e8f0;border-radius:4px;height:8px"><span style="display:block;height:8px;width:${Math.min(100, Math.max(0, r.subj[s] ?? 0))}%;background:${barColor(r.subj[s] ?? 0, passPct)};border-radius:4px"></span></span><span style="width:34px;text-align:right;font-size:10px">${fx(r.subj[s])}%</span></div>`).join('')}</div>
        <div style="margin-top:4px;font-size:10px"><b>Focus:</b> ${esc(report.rows.find((x) => x.Name === r.name && x.GCC === r.gcc)?.['Study focus'] || '—')}<br><b>House:</b> ${esc(r.house || '—')} · <b>House Master/Mistress:</b> ${esc(r.hm || '—')}<br><b>On duty:</b> ${esc(r.mentor || '—')}</div></div>`).join('')}</div>`;
    } else if (report.groupBy === 'Group') {
      const groups = [...new Set(report.rows.map((r) => r.Group))];
      body = groups.map((g) => { const rs = report.rows.filter((r) => r.Group === g); return `<div class="avoid"><h3>${esc(g)} — ${rs.length} student${rs.length === 1 ? '' : 's'}</h3><table>${head(report.columns.filter((c) => c.key !== 'Group'))}<tbody>${rs.map((r) => rowHtml(report.columns.filter((c) => c.key !== 'Group'), r)).join('')}</tbody></table></div>`; }).join('');
    } else {
      body = `<table>${head(report.columns)}<tbody>${report.rows.map((r) => rowHtml(report.columns, r)).join('') || `<tr><td colspan="${report.columns.length}">Nothing to show.</td></tr>`}</tbody></table>`;
    }
    printDocument(`<div class="page">${letterhead(institute)}<div class="title">${esc(report.title)}</div>
      <div class="sub">${esc(series)}${basis ? ` · ${esc(basis)}` : ''} · ${esc(layoutLabel)}<br>${esc(desc)}</div>${kpis}
      <h3>Smart summary</h3><ul class="ins">${insights.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>${body}
      <div class="sig"><span>Prepared by</span><span>Person on duty</span><span>Principal</span></div>
      <div class="foot">Generated ${esc(new Date().toLocaleString('en-IN'))}</div></div>`, `${report.title} - ${series}`);
  };

  const rowsShown = report.rows.slice(0, 150);
  const grpOpts = [1, 2, 3, 4, 5, 6, 7];
  return (
    <div style={{ ...S.card, border: '1.5px solid #be185d' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0 }}>📑 Smart report generator</h3>
        <button style={S.ghost} onClick={onClose}>← Back to groups</button>
      </div>
      <div style={{ fontSize: 12.5, color: '#5d6b82', margin: '4px 0 10px' }}>Based on the groups chosen in the Groups view ({layoutLabel}{basis ? `, ${basis}` : ''}) — change them there with “← Back to groups”. Pick a report, narrow it with the advanced filters, then print or export it.</div>

      <span style={S.label}>Quick reports</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {QUICK_REPORTS.map((q) => <button key={q.id} style={S.chip(false)} onClick={() => quick(q)}>{q.label}</button>)}
        {active ? <button style={{ ...S.chip(false), borderStyle: 'dashed' }} onClick={() => setF(emptyReportFilter())}>↺ Clear filters</button> : null}
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 10 }}>
        <F label="Report" grow>
          <select style={{ ...S.input, width: '100%' }} value={type} onChange={(e) => setType(e.target.value)} aria-label="Report type">
            {REPORT_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </F>
        <F label="Sort by">
          <select style={S.input} value={f.sort} onChange={(e) => set({ sort: e.target.value })} aria-label="Sort by">{SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </F>
      </div>
      <div style={{ fontSize: 12, color: '#5d6b82', marginBottom: 10 }}>{REPORT_TYPES.find((t) => t.id === type)?.hint}</div>

      <details open style={{ marginBottom: 10 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13, color: '#2e3b52' }}>🔎 Advanced filters{active ? ` — ${desc}` : ''}</summary>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '10px 0' }}>
          <F label="Groups from">
            <select style={S.input} value={f.groupFrom} onChange={(e) => { const v = Number(e.target.value); set({ groupFrom: v, groupTo: Math.max(v, f.groupTo) }); }} aria-label="Groups from">{grpOpts.map((g) => <option key={g} value={g}>Group {g}</option>)}</select>
          </F>
          <F label="to">
            <select style={S.input} value={f.groupTo} onChange={(e) => { const v = Number(e.target.value); set({ groupTo: v, groupFrom: Math.min(v, f.groupFrom) }); }} aria-label="Groups to">{grpOpts.map((g) => <option key={g} value={g}>Group {g}</option>)}</select>
          </F>
          <F label="House"><select style={S.input} value={f.house} onChange={(e) => set({ house: e.target.value })} aria-label="House"><option value="">All houses</option>{houses.map((h) => <option key={h}>{h}</option>)}</select></F>
          <F label="House Master / Mistress"><select style={S.input} value={f.hm} onChange={(e) => set({ hm: e.target.value })} aria-label="House Master or Mistress"><option value="">Anyone</option>{hms.map((h) => <option key={h}>{h}</option>)}</select></F>
          <F label="On duty"><select style={S.input} value={f.mentor} onChange={(e) => set({ mentor: e.target.value })} aria-label="Person on duty"><option value="">Anyone</option><option value={NOT_ASSIGNED}>Nobody assigned</option>{mentors.map((h) => <option key={h}>{h}</option>)}</select></F>
          <F label="Weakest subject"><select style={S.input} value={f.weakest} onChange={(e) => set({ weakest: e.target.value })} aria-label="Weakest subject"><option value="">Any</option>{weakSubs.map((h) => <option key={h}>{h}</option>)}</select></F>
          {type === 'mentors' && duties ? <F label="Supervised subject"><select style={S.input} value={f.dutySubject} onChange={(e) => set({ dutySubject: e.target.value })} aria-label="Supervised subject"><option value="">Every subject</option>{dutySubjects.map((h) => <option key={h}>{h}</option>)}</select></F> : null}
          <F label="Trend"><select style={S.input} value={f.trend} onChange={(e) => set({ trend: e.target.value })} aria-label="Trend"><option value="">Any</option><option>Improving</option><option>Steady</option><option>Declining</option></select></F>
          <F label="Marks from %"><input type="number" min={0} max={100} style={{ ...S.input, width: 80 }} value={f.scoreMin} onChange={(e) => set({ scoreMin: e.target.value })} aria-label="Marks from" /></F>
          <F label="to %"><input type="number" min={0} max={100} style={{ ...S.input, width: 80 }} value={f.scoreMax} onChange={(e) => set({ scoreMax: e.target.value })} aria-label="Marks to" /></F>
          <F label="Min. tests taken"><input type="number" min={0} style={{ ...S.input, width: 80 }} value={f.minTests} onChange={(e) => set({ minTests: e.target.value })} aria-label="Minimum tests taken" /></F>
          <F label="Search" grow><input style={{ ...S.input, width: '100%' }} placeholder="Name or GCC" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Search student" /></F>
        </div>
        {classNames.length > 1 ? (
          <div style={{ marginBottom: 8 }}>
            <span style={S.label}>Classes</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{classNames.map((c) => <button key={c} style={S.chip(f.classes.includes(c))} onClick={() => set({ classes: toggleIn(f.classes, c) })}>{c}</button>)}</div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 13 }}>
          <label><input type="checkbox" checked={f.belowPass} onChange={(e) => set({ belowPass: e.target.checked })} /> Below the {passPct}% pass mark only</label>
          <label><input type="checkbox" checked={f.manualOnly} onChange={(e) => set({ manualOnly: e.target.checked })} /> Moved by an admin only</label>
        </div>
      </details>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input style={{ ...S.input, width: 180 }} placeholder="Name this setup…" value={presetName} onChange={(e) => setPresetName(e.target.value)} aria-label="Preset name" />
        <button style={S.ghost} disabled={!presetName.trim()} onClick={savePreset}>💾 Save setup</button>
        {presets.length ? (
          <select style={S.input} value="" onChange={(e) => e.target.value && loadPreset(e.target.value)} aria-label="Load a saved setup"><option value="">Load a saved setup…</option>{presets.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}</select>
        ) : null}
        {presets.map((p) => <button key={p.name} style={{ ...S.chip(false), fontSize: 11 }} onClick={() => delPreset(p.name)} title={`Delete “${p.name}”`}>✕ {p.name}</button>)}
      </div>

      <div style={{ background: '#fdf2f8', border: '1px solid #f9a8d4', borderRadius: 12, padding: '10px 14px', marginBottom: 12 }}>
        <b style={{ color: '#9d174d' }}>🧠 Smart summary</b>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13, lineHeight: 1.55 }}>{insights.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <button style={S.btn} onClick={print} disabled={!filtered.length}>🖨️ Print / PDF</button>
        <button style={S.ghost} onClick={exportXlsx} disabled={!filtered.length}>⬇️ Excel</button>
        <button style={S.ghost} onClick={copy}>📋 Copy summary</button>
        <span style={{ fontSize: 12, color: '#5d6b82', alignSelf: 'center' }}>{filtered.length} of {all.length} students · {report.rows.length} row{report.rows.length === 1 ? '' : 's'}</span>
      </div>
      {msg ? <div role="status" style={{ fontSize: 12.5, color: '#047857', marginBottom: 8 }}>{msg}</div> : null}

      <div style={{ overflow: 'auto', maxHeight: 340, border: '1px solid #e8e3d8', borderRadius: 12 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }} aria-label="Report preview">
          <thead><tr>{report.columns.map((c) => <th key={c.key} style={S.th}>{c.label}</th>)}</tr></thead>
          <tbody>
            {rowsShown.map((r, i) => <tr key={i}>{report.columns.map((c) => <td key={c.key} style={{ ...S.td, ...(report.heat && report.heat.includes(c.key) ? { background: heat(r[c.key]), fontWeight: 700 } : null) }}>{c.key === 'Supervises study duty for' || c.key === 'Supervises (subject)' ? <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: '#132a4f', color: '#fff', fontWeight: 700, fontSize: 12 }}>{r[c.key] ?? ''}</span> : (r[c.key] ?? '')}</td>)}</tr>)}
            {!rowsShown.length ? <tr><td style={{ ...S.td, color: '#5d6b82' }} colSpan={report.columns.length}>No students match these filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {report.rows.length > rowsShown.length ? <div style={{ fontSize: 12, color: '#5d6b82', marginTop: 6 }}>Showing the first {rowsShown.length} rows — print or export for all {report.rows.length}.</div> : null}
    </div>
  );
}

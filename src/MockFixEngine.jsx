// ─── MockFixEngine.jsx ───────────────────────────────────────────────────────
// Student Data Fix Engine panel (Mock Analyzer → Upload & Data).
// Finds errors in uploaded student data, proposes the exact fix, saves approved
// fixes as rules that are re-applied on every load and every future upload, and
// lets a person merge / correct / remove records by hand.  Non-destructive:
// uploaded rows are never edited and every rule can be undone.
// Logic lives in lib/studentFixEngine.js.
import { useMemo, useState } from 'react';
import { detectIssues, ruleSetStudent, ruleMerge, ruleDropRecord, describeRule, ruleMatches } from './lib/studentFixEngine';
import { cleanName, gccDigits } from './lib/mockTestEngine';
import { saveFixes, deleteFixGroup } from './lib/mockTestStore';

const NAVY = '#002E6E';
const st = {
  card: { background: '#fff', border: '1px solid #E6ECF4', borderRadius: 16, padding: 14, marginBottom: 12, boxShadow: '0 2px 10px rgba(0,46,110,.06)' },
  input: { padding: '8px 12px', borderRadius: 12, border: '1px solid #D6E0EE', fontSize: 13, background: '#fff', color: '#111827', fontFamily: 'inherit', minWidth: 0, width: '100%', boxSizing: 'border-box' },
  btn: { padding: '9px 16px', borderRadius: 12, border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', background: NAVY, color: '#fff', fontFamily: 'inherit' },
  ghost: { padding: '8px 14px', borderRadius: 12, border: '1px solid #D6E0EE', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: '#334155', fontFamily: 'inherit' },
  label: { fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8, margin: '8px 0 4px', display: 'block' },
};
// group id shared by the rules of one fix, so Undo removes them together
const stamp = () => `fx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const SEV = { fix: { c: '#047857', t: 'Auto-fix' }, review: { c: '#b45309', t: 'Review' }, info: { c: '#64748B', t: 'Info' } };
const Pill = ({ text, color }) => <span style={{ background: color, color: '#fff', borderRadius: 10, padding: '1px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{text}</span>;
const studentLabel = (s) => `${s.name}${s.gcc ? ` · GCC ${s.gcc}` : ''} · ${s.batch} · ${s.tests.map((t) => 'T' + t).join('')}`;
function StudentSelect({ roster, value, onChange, placeholder }) {
  return (
    <select style={st.input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {roster.map((s) => <option key={s.sid} value={s.sid}>{studentLabel(s)}</option>)}
    </select>
  );
}
const Tile = ({ label, value, color }) => (
  <div style={{ flex: '1 1 calc(33% - 8px)', minWidth: 96, boxSizing: 'border-box', background: '#fff', border: '1px solid #E6ECF4', borderLeft: `4px solid ${color}`, borderRadius: 14, padding: '8px 12px' }}>
    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.8 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
  </div>
);

export default function MockFixEngine({ rows, rawRows, fixes, series, mode, who, canEdit, onChanged }) {
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [cId, setCId] = useState('');
  const [newGcc, setNewGcc] = useState('');
  const [newName, setNewName] = useState('');
  const [dropId, setDropId] = useState('');
  const [dropTest, setDropTest] = useState('');

  const issues = useMemo(() => detectIssues(rows), [rows]);
  const mine = useMemo(() => fixes.filter((f) => !f.series || f.series === series), [fixes, series]);
  const roster = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => { if (!m.has(r.sid)) m.set(r.sid, []); m.get(r.sid).push(r); });
    return [...m.entries()].map(([sid, rs]) => {
      const last = [...rs].sort((a, b) => b.test_no - a.test_no)[0];
      return { sid, rs, name: cleanName([...rs].map((r) => r.student_name).sort((a, b) => b.length - a.length)[0]), gcc: gccDigits(last.gcc_no), batch: last.batch, tests: rs.map((r) => r.test_no).sort((a, b) => a - b) };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);
  const byId = (id) => roster.find((s) => s.sid === id);

  const fixable = issues.filter((i) => i.severity === 'fix' && i.rules.length);
  const review = issues.filter((i) => i.severity === 'review');
  const info = issues.filter((i) => i.severity === 'info');

  const run = async (text, fn) => {
    setBusy(text); setMsg('');
    try { await fn(); await onChanged(); } catch (e) { setMsg(`❌ ${e.message || e}`); setBusy(''); return; }
    setBusy('');
  };
  const withGroup = (rules, g) => rules.map((r) => ({ ...r, series, group: g }));
  const applyIssue = (i) => run('Applying fix…', async () => { await saveFixes(withGroup(i.rules, stamp()), mode, who); setMsg(`✅ Fixed: ${i.title}`); });
  const applyAll = () => {
    if (!window.confirm(`Apply ${fixable.length} automatic fix(es)? Uploaded sheets are not changed, and each fix can be undone.`)) return;
    run('Applying fixes…', async () => {
      const all = fixable.flatMap((i) => withGroup(i.rules, stamp()));
      await saveFixes(all, mode, who);
      setMsg(`✅ Applied ${fixable.length} fix(es) (${all.length} rule(s)).`);
    });
  };
  const undo = (rule) => run('Undoing…', async () => { await deleteFixGroup(rule, mode); setMsg('↩️ Fix undone.'); });

  const A = byId(aId), B = byId(bId), C = byId(cId), D = byId(dropId);
  const doMerge = () => run('Merging…', async () => {
    await saveFixes(withGroup(ruleMerge(A.rs, B.rs), stamp()), mode, who);
    setAId(''); setBId(''); setMsg(`✅ ${A.name}'s records are now counted under ${B.name}.`);
  });
  const doCorrect = () => run('Saving correction…', async () => {
    const rules = ruleSetStudent(C.rs, { gcc: newGcc, name: newName }, `Correct ${C.name}${newGcc ? ` GCC → ${gccDigits(newGcc)}` : ''}${newName ? ` name → ${cleanName(newName)}` : ''}`);
    await saveFixes(withGroup(rules, stamp()), mode, who);
    setCId(''); setNewGcc(''); setNewName(''); setMsg(`✅ Correction saved for ${C.name}.`);
  });
  const doDrop = () => run('Removing record…', async () => {
    const row = D.rs.find((r) => String(r.test_no) === String(dropTest));
    await saveFixes(withGroup([ruleDropRecord(row)], stamp()), mode, who);
    setDropId(''); setDropTest(''); setMsg(`✅ Record removed from analysis: ${D.name} T${dropTest}.`);
  });

  // active rules, grouped (one group = one issue or one manual action)
  const groups = useMemo(() => {
    const m = new Map();
    mine.forEach((f) => { const k = f.group || f.id; if (!m.has(k)) m.set(k, []); m.get(k).push(f); });
    return [...m.values()].reverse();
  }, [mine]);
  // records (as uploaded) a group of rules touches — includes records a rule removed
  const affected = (g) => rawRows.filter((r) => g.some((f) => ruleMatches(f.match, r))).length;


  return (
    <div style={st.card}>
      <h4 style={{ margin: '0 0 4px' }}>🛠️ Student Data Fix Engine</h4>
      <div style={{ fontSize: 12.5, color: '#64748B', marginBottom: 10 }}>
        Finds errors in student data (wrong or blank GCC, duplicates, bad marks) and corrects them with saved rules that are applied to every analysis and every future upload.
        Your uploaded sheets are never edited, and every fix can be undone.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <Tile label="Auto-fixable" value={fixable.length} color={fixable.length ? '#b45309' : '#047857'} />
        <Tile label="Need review" value={review.length} color={review.length ? '#b91c1c' : '#047857'} />
        <Tile label="Active fixes" value={groups.length} color={NAVY} />
      </div>
      {msg ? <div style={{ fontSize: 13, margin: '6px 0' }}>{msg}</div> : null}
      {busy ? <div style={{ fontSize: 13, color: '#64748B' }}>⏳ {busy}</div> : null}
      {canEdit && fixable.length ? <button style={{ ...st.btn, margin: '4px 0 10px' }} disabled={!!busy} onClick={applyAll}>✨ Apply all {fixable.length} automatic fixes</button> : null}
      {!issues.filter((i) => i.severity !== 'info').length ? <div style={{ fontSize: 13, color: '#047857', marginBottom: 6 }}>✅ No data errors found.</div> : null}

      {[['Auto-fixable', fixable, 'fix'], ['Needs review', review, 'review']].map(([title, list, sev]) => (list.length ? (
        <details key={sev} open style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>{title} ({list.length})</summary>
          <div style={{ marginTop: 6, display: 'grid', gap: 8 }}>
            {list.map((i) => (
              <div key={i.id} style={{ border: '1px solid #E6ECF4', borderLeft: `4px solid ${SEV[sev].c}`, borderRadius: 12, padding: '8px 12px' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5, overflowWrap: 'anywhere' }}>{i.title}</div>
                    <div style={{ fontSize: 12, color: '#64748B', marginTop: 2, overflowWrap: 'anywhere' }}>{i.detail}</div>
                  </div>
                  {canEdit && i.rules.length ? <button style={st.ghost} disabled={!!busy} onClick={() => applyIssue(i)}>Apply fix</button> : <Pill text={SEV[sev].t} color={SEV[sev].c} />}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null))}
      {info.length ? (
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>For information ({info.length})</summary>
          <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
            {info.map((i) => <div key={i.id} style={{ fontSize: 12.5, padding: '4px 0', borderBottom: '1px dashed #E6ECF4' }}><b>{i.title}</b><div style={{ color: '#64748B' }}>{i.detail}</div></div>)}
          </div>
        </details>
      ) : null}

      {canEdit ? (
        <details style={{ marginBottom: 8 }}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Fix by hand</summary>
          <div style={{ marginTop: 8, display: 'grid', gap: 12 }}>
            <div style={{ border: '1px solid #E6ECF4', borderRadius: 12, padding: 12 }}>
              <b style={{ fontSize: 13 }}>Merge two students</b>
              <div style={{ fontSize: 12, color: '#64748B' }}>The same child appears as two students? Choose the wrong one and the right one.</div>
              <span style={st.label}>Wrong / duplicate</span><StudentSelect roster={roster} value={aId} onChange={setAId} placeholder="Select student…" />
              <span style={st.label}>Count their records under</span><StudentSelect roster={roster} value={bId} onChange={setBId} placeholder="Select student…" />
              {A && B && A.sid === B.sid ? <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 6 }}>Pick two different students.</div> : null}
              {A && B && A.sid !== B.sid && A.tests.some((t) => B.tests.includes(t)) ? <div style={{ fontSize: 12, color: '#b45309', marginTop: 6 }}>⚠ Both have a record for the same test ({A.tests.filter((t) => B.tests.includes(t)).map((t) => 'T' + t).join(' ')}) — merging would put two records in one test.</div> : null}
              <button style={{ ...st.btn, marginTop: 10 }} disabled={!!busy || !A || !B || A.sid === B.sid} onClick={doMerge}>Merge</button>
            </div>
            <div style={{ border: '1px solid #E6ECF4', borderRadius: 12, padding: 12 }}>
              <b style={{ fontSize: 13 }}>Correct GCC / name</b>
              <span style={st.label}>Student</span><StudentSelect roster={roster} value={cId} onChange={setCId} placeholder="Select student…" />
              <span style={st.label}>Correct GCC number</span><input style={st.input} inputMode="numeric" value={newGcc} onChange={(e) => setNewGcc(e.target.value)} placeholder={C ? `now ${C.gcc || 'blank'}` : ''} />
              <span style={st.label}>Correct name</span><input style={st.input} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={C ? `now ${C.name}` : ''} />
              <button style={{ ...st.btn, marginTop: 10 }} disabled={!!busy || !C || (!gccDigits(newGcc) && !newName.trim())} onClick={doCorrect}>Save correction</button>
            </div>
            <div style={{ border: '1px solid #E6ECF4', borderRadius: 12, padding: 12 }}>
              <b style={{ fontSize: 13 }}>Remove a bad record</b>
              <div style={{ fontSize: 12, color: '#64748B' }}>Ignores one test record in all analyses (the uploaded sheet is untouched).</div>
              <span style={st.label}>Student</span><StudentSelect roster={roster} value={dropId} onChange={(v) => { setDropId(v); setDropTest(''); }} placeholder="Select student…" />
              <span style={st.label}>Test</span>
              <select style={st.input} value={dropTest} onChange={(e) => setDropTest(e.target.value)} disabled={!D}>
                <option value="">Select test…</option>
                {(D ? D.tests : []).map((t) => <option key={t} value={t}>Test {t}</option>)}
              </select>
              <button style={{ ...st.btn, marginTop: 10, background: '#b91c1c' }} disabled={!!busy || !D || !dropTest} onClick={doDrop}>Remove record</button>
            </div>
          </div>
        </details>
      ) : null}

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>Active fixes ({groups.length})</summary>
        <div style={{ marginTop: 6, display: 'grid', gap: 8 }}>
          {groups.length ? groups.map((g) => (
            <div key={g[0].group || g[0].id} style={{ border: '1px solid #E6ECF4', borderRadius: 12, padding: '8px 12px', display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, overflowWrap: 'anywhere' }}>{g[0].note || describeRule(g[0])}</div>
                <div style={{ fontSize: 12, color: '#64748B', overflowWrap: 'anywhere' }}>{g.map(describeRule).join(' · ')}</div>
                <div style={{ fontSize: 11.5, color: '#94A3B8' }}>Affects {affected(g)} record(s){g[0].created_by ? ` · by ${g[0].created_by}` : ''}</div>
              </div>
              {canEdit ? <button style={{ ...st.ghost, color: '#b91c1c' }} disabled={!!busy} onClick={() => undo(g[0])}>Undo</button> : null}
            </div>
          )) : <div style={{ fontSize: 13, color: '#64748B' }}>No fixes saved yet.</div>}
        </div>
      </details>
    </div>
  );
}

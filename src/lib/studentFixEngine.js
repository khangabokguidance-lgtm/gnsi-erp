// ─── studentFixEngine.js ─────────────────────────────────────────────────────
// Student Data Fix Engine for the Mock Test Analyzer — pure functions.
//
// Uploaded sheets contain human errors: a GCC typed 566 instead of 966, a blank
// GCC, the same child spelled three ways, a stray "*", a record entered twice.
// This engine
//   1. DETECTS those errors              detectIssues()
//   2. PROPOSES the exact correction     issue.rules  (declarative rules)
//   3. APPLIES saved rules, every time   applyFixes()   (before identity matching)
//
// It is NON-DESTRUCTIVE: the uploaded rows are never edited.  Corrections live
// as small rules (a separate table) that are re-applied on every load, so they
// also fix future uploads of the same child, and any rule can be undone.
//
// Rule shape  { id, series?, kind:'row'|'drop', match, changes?, note, group }
//   match    { batch?, test_no?, gcc?, name? }   all given keys must match the
//            ORIGINAL row (gcc:'' means "blank GCC"; name compares normalised).
//   changes  { gcc?, name?, batch? }             written onto matching rows.
// Rules are evaluated against the original values, so order never matters;
// if two rules change the same field the later-created rule wins.
import { normName, gccDigits, cleanName, denseRanks, num, matchingReport } from './mockTestEngine.js';

const sum = (o) => Object.values(o || {}).reduce((s, v) => s + (num(v) || 0), 0);

export function ruleMatches(match, row) {
  const m = match || {};
  if (m.batch !== undefined && m.batch !== row.batch) return false;
  if (m.test_no !== undefined && Number(m.test_no) !== Number(row.test_no)) return false;
  if (m.gcc !== undefined && String(m.gcc) !== gccDigits(row.gcc_no)) return false;
  if (m.name !== undefined && normName(m.name) !== normName(row.student_name)) return false;
  return true;
}

// Returns rows with the rules applied.  Changed rows carry `fixed` (rule ids)
// and `orig` (the values as uploaded).  Dropped rows are removed.
export function applyFixes(rows, rules) {
  const active = (rules || []).slice().sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  if (!active.length) return rows;
  const out = [];
  rows.forEach((r) => {
    let set = null, drop = false;
    const ids = [];
    for (const rule of active) {
      if (rule.series && rule.series !== r.series) continue;
      if (!ruleMatches(rule.match, r)) continue;
      ids.push(rule.id);
      if (rule.kind === 'drop') { drop = true; break; }
      set = { ...(set || {}), ...(rule.changes || {}) };
    }
    if (drop) return;
    if (!set) { out.push(r); return; }
    out.push({
      ...r,
      gcc_no: set.gcc !== undefined ? String(set.gcc) : r.gcc_no,
      student_name: set.name !== undefined ? set.name : r.student_name,
      batch: set.batch !== undefined ? set.batch : r.batch,
      fixed: ids,
      orig: { gcc_no: r.gcc_no, student_name: r.student_name, batch: r.batch },
    });
  });
  return out;
}

// A row as it was uploaded (before any rule changed it): rules always match on these.
export const asUploaded = (r) => (r.orig ? { ...r, ...r.orig } : r);

// Variants of one student's rows that share (batch, gcc, name) → one rule each.
function variantsOf(rs) {
  const m = new Map();
  rs.map(asUploaded).forEach((r) => {
    const k = `${r.batch}\u0001${gccDigits(r.gcc_no)}\u0001${normName(r.student_name)}`;
    if (!m.has(k)) m.set(k, { batch: r.batch, gcc: gccDigits(r.gcc_no), name: r.student_name, tests: [] });
    m.get(k).tests.push(r.test_no);
  });
  return [...m.values()];
}

const displayName = (rs) => [...new Set(rs.map((r) => cleanName(r.student_name)))].sort((a, b) => b.length - a.length)[0];
const T = (tests) => [...new Set(tests)].sort((a, b) => a - b).map((t) => 'T' + t).join(' ');

// Canonical GCC of a student = the number on most of their sheets (ties → the
// most recent sheet).
export function canonicalGcc(rs) {
  const c = {};
  rs.forEach((r) => { const g = gccDigits(r.gcc_no); if (g) c[g] = (c[g] || 0) + 1; });
  const best = Math.max(0, ...Object.values(c));
  if (!best) return '';
  const tops = Object.keys(c).filter((g) => c[g] === best);
  if (tops.length === 1) return tops[0];
  const latest = [...rs].sort((a, b) => b.test_no - a.test_no).find((r) => tops.includes(gccDigits(r.gcc_no)));
  return latest ? gccDigits(latest.gcc_no) : tops[0];
}

// rows: identity-resolved rows (after applyFixes) of ONE series.
// → [{ id, type, severity:'fix'|'review'|'info', title, detail, rules:[…] }]
export function detectIssues(rows) {
  const issues = [];
  const by = new Map();
  rows.forEach((r) => { if (!by.has(r.sid)) by.set(r.sid, []); by.get(r.sid).push(r); });

  by.forEach((rs, sid) => {
    const name = displayName(rs);
    const canon = canonicalGcc(rs);
    // 1 — a GCC on some sheets that differs from the child's usual number
    const odd = rs.filter((r) => gccDigits(r.gcc_no) && gccDigits(r.gcc_no) !== canon);
    if (odd.length) {
      const vs = variantsOf(odd);
      issues.push({
        id: `gcc:${sid}`, type: 'gcc_typo', severity: 'fix',
        title: `${name}: GCC ${[...new Set(vs.map((v) => v.gcc))].join(', ')} → ${canon}`,
        detail: `Usually ${canon}; sheet${vs.length > 1 ? 's' : ''} ${vs.map((v) => `${T(v.tests)} (${v.batch}) say ${v.gcc}`).join('; ')}.`,
        rules: vs.map((v) => ({ kind: 'row', match: { batch: v.batch, gcc: v.gcc, name: v.name }, changes: { gcc: canon }, note: `GCC ${v.gcc} → ${canon} for ${name}` })),
      });
    }
    // 2 — blank GCC
    const blanks = rs.filter((r) => !gccDigits(r.gcc_no));
    if (blanks.length) {
      if (canon) {
        const vs = variantsOf(blanks);
        issues.push({
          id: `blank:${sid}`, type: 'blank_gcc', severity: 'fix',
          title: `${name}: blank GCC → ${canon}`,
          detail: `${T(blanks.map((r) => r.test_no))} has no GCC number; the child's other sheets say ${canon}.`,
          rules: vs.map((v) => ({ kind: 'row', match: { batch: v.batch, gcc: '', name: v.name }, changes: { gcc: canon }, note: `Fill blank GCC with ${canon} for ${name}` })),
        });
      } else {
        issues.push({ id: `nogcc:${sid}`, type: 'no_gcc', severity: 'review', title: `${name}: no GCC number on any sheet`, detail: 'Use "Correct GCC / name" below to add the right number.', rules: [] });
      }
    }
  });

  // 3 — the same GCC twice in one test of one batch
  const seen = new Map();
  rows.forEach((r) => {
    const g = gccDigits(r.gcc_no); if (!g) return;
    const k = `${r.test_no}|${r.batch}|${g}`;
    if (!seen.has(k)) seen.set(k, []);
    seen.get(k).push(r);
  });
  seen.forEach((rs, k) => {
    if (rs.length < 2) return;
    const [t, b, g] = k.split('|');
    issues.push({ id: `dup:${k}`, type: 'duplicate', severity: 'review', title: `GCC ${g} appears ${rs.length}× in ${b} T${t}`, detail: rs.map((r) => `${cleanName(r.student_name)} (${r.total})`).join(' · ') + ' — correct one GCC, or remove a duplicate record below.', rules: [] });
  });

  // 4 — marks outside 0…max, or total ≠ sum of subjects
  rows.forEach((r) => {
    const bad = Object.entries(r.marks || {}).filter(([s, v]) => num(v) < 0 || (num(r.max_marks?.[s]) && num(v) > num(r.max_marks[s])));
    if (bad.length) issues.push({ id: `range:${r.test_no}|${r.batch}|${r.sid}`, type: 'marks_range', severity: 'review', title: `${cleanName(r.student_name)} (${r.batch} T${r.test_no}): ${bad.map(([s, v]) => `${s} ${v}/${r.max_marks?.[s]}`).join(', ')}`, detail: 'Marks are outside 0…maximum. Fix in the Excel sheet and upload it again, or remove this record.', rules: [] });
    else if (Math.abs(num(r.total) - sum(r.marks)) > 0.01) issues.push({ id: `total:${r.test_no}|${r.batch}|${r.sid}`, type: 'total_mismatch', severity: 'review', title: `${cleanName(r.student_name)} (${r.batch} T${r.test_no}): total ${r.total} ≠ subjects ${sum(r.marks)}`, detail: 'The sheet total does not equal the sum of its subjects.', rules: [] });
  });

  // 5 — printed rank differs from rank by total
  const cohorts = new Map();
  rows.forEach((r) => { const k = `${r.test_no}|${r.batch}`; if (!cohorts.has(k)) cohorts.set(k, []); cohorts.get(k).push(r); });
  cohorts.forEach((rs, k) => {
    const dr = denseRanks(rs.map((r) => r.total));
    const bad = rs.filter((r, i) => r.rank !== null && r.rank !== undefined && r.rank !== dr[i]);
    if (bad.length) issues.push({ id: `rank:${k}`, type: 'rank', severity: 'info', title: `${k.split('|')[1]} T${k.split('|')[0]}: ${bad.length} printed rank(s) differ from rank by total`, detail: 'Analyses use the rank recomputed from totals where needed.', rules: [] });
  });

  // 6 — children who skipped a test their batch sat (information only)
  matchingReport(rows).gaps.forEach((g) => issues.push({ id: `gap:${g.sid}`, type: 'gap', severity: 'info', title: `${g.name} (${g.batch}): missing ${g.missing.map((t) => 'T' + t).join(' ')}`, detail: 'Treated as absent. If they did sit it, look for them under another name in that sheet.', rules: [] }));

  const order = { fix: 0, review: 1, info: 2 };
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || a.title.localeCompare(b.title));
}

// ── manual correction builders (used by the panel) ───────────────────────────
// Set GCC and/or name for every record of a student.
export function ruleSetStudent(studentRows, changes, note) {
  const set = {};
  if (changes.gcc !== undefined && changes.gcc !== '') set.gcc = gccDigits(changes.gcc);
  if (changes.name !== undefined && String(changes.name).trim()) set.name = cleanName(changes.name);
  return variantsOf(studentRows).map((v) => ({ kind: 'row', match: { batch: v.batch, gcc: v.gcc, name: v.name }, changes: set, note }));
}
// Count student A's records as student B (A's records get B's GCC and name).
export function ruleMerge(rowsA, rowsB) {
  const gcc = canonicalGcc(rowsB), name = displayName(rowsB);
  return ruleSetStudent(rowsA, { gcc, name }, `Merge ${displayName(rowsA)} into ${name}`);
}
export function ruleDropRecord(current, note) {
  const row = asUploaded(current);
  return { kind: 'drop', match: { batch: row.batch, test_no: row.test_no, gcc: gccDigits(row.gcc_no), name: row.student_name }, changes: {}, note: note || `Remove ${cleanName(row.student_name)} ${row.batch} T${row.test_no}` };
}

export function describeRule(rule) {
  const m = rule.match || {}, c = rule.changes || {};
  const who = [m.name ? `"${cleanName(m.name)}"` : '', m.gcc !== undefined ? (m.gcc === '' ? 'blank GCC' : `GCC ${m.gcc}`) : '', m.batch || '', m.test_no !== undefined ? `T${m.test_no}` : ''].filter(Boolean).join(' · ');
  if (rule.kind === 'drop') return `Remove record: ${who}`;
  const what = [c.gcc !== undefined ? `GCC → ${c.gcc}` : '', c.name !== undefined ? `name → "${c.name}"` : '', c.batch !== undefined ? `batch → ${c.batch}` : ''].filter(Boolean).join(', ');
  return `${what} for ${who}`;
}

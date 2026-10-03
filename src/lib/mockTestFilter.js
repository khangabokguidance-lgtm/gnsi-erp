// ─── mockTestFilter.js ───────────────────────────────────────────────────────
// Custom data filter for the Mock Test Analyzer (pure functions, no React).
// Applied to identity-resolved result rows (each row carries `sid`) before any
// tab analyses them, so every chart, table and printout reflects the filter.
//
//   batches   [string]   only these batches                (empty = all)
//   tests     [number]   only these test numbers           (empty = all)
//   subjects  [string]   only these subjects — totals, max totals and ranks
//                        are recomputed from the chosen subjects (empty = all)
//   students  [sid]      manual student list, used with studentMode:
//                          'exclude' → everyone EXCEPT these (default)
//                          'only'    → ONLY these students
//   q         string     name / GCC contains this text
//   minTests  number     student must have taken at least this many tests
//   avgMin / avgMax      student's average % (over the rows that remain) must
//                        be within this range ('' = no limit)
import { num, mean, rowPct, denseRanks, cleanName, gccDigits } from './mockTestEngine';

export const emptyFilter = () => ({
  batches: [], tests: [], subjects: [], students: [], studentMode: 'exclude',
  q: '', minTests: 0, avgMin: '', avgMax: '',
});

const numOrNull = (v) => (v === '' || v === null || v === undefined ? null : num(v));

export function isFilterActive(f) {
  if (!f) return false;
  return !!(f.batches.length || f.tests.length || f.subjects.length || f.students.length
    || f.q.trim() || Number(f.minTests) > 0 || numOrNull(f.avgMin) !== null || numOrNull(f.avgMax) !== null);
}

// Short human description, e.g. "Batches: A, B · Tests: 1–3 · Subjects: Maths".
export function describeFilter(f) {
  if (!isFilterActive(f)) return 'No filter';
  const bits = [];
  if (f.batches.length) bits.push(`Batches: ${f.batches.join(', ')}`);
  if (f.tests.length) bits.push(`Tests: ${f.tests.map((t) => `T${t}`).join(', ')}`);
  if (f.subjects.length) bits.push(`Subjects: ${f.subjects.join(', ')}`);
  if (f.students.length) bits.push(`${f.studentMode === 'only' ? 'Only' : 'Excluding'} ${f.students.length} student${f.students.length > 1 ? 's' : ''}`);
  if (f.q.trim()) bits.push(`Search “${f.q.trim()}”`);
  if (Number(f.minTests) > 0) bits.push(`≥ ${f.minTests} tests taken`);
  const lo = numOrNull(f.avgMin), hi = numOrNull(f.avgMax);
  if (lo !== null || hi !== null) bits.push(`Avg ${lo !== null ? lo : 0}%–${hi !== null ? hi : 100}%`);
  return bits.join(' · ');
}

// Re-score each row using only the chosen subjects, then re-rank within each
// test + batch (the sheet's own rank was for the full paper).
function restrictSubjects(rows, subjects) {
  const scored = rows.map((r) => {
    const marks = {}, max_marks = {};
    let total = 0, max_total = 0;
    subjects.forEach((s) => {
      const v = num(r.marks?.[s]);
      if (v === null) return;
      marks[s] = v;
      const m = num(r.max_marks?.[s]) || 0;
      max_marks[s] = m;
      total += v; max_total += m;
    });
    return { ...r, marks, max_marks, total, max_total };
  }).filter((r) => Object.keys(r.marks).length);
  const groups = new Map();
  scored.forEach((r) => { const k = `${r.test_no}|${r.batch}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  groups.forEach((g) => { const rk = denseRanks(g.map((r) => r.total)); g.forEach((r, i) => { r.rank = rk[i]; }); });
  return scored;
}

export function applyDataFilter(rows, f) {
  if (!isFilterActive(f)) return rows;
  let out = rows;
  if (f.batches.length) out = out.filter((r) => f.batches.includes(r.batch));
  if (f.tests.length) out = out.filter((r) => f.tests.includes(r.test_no));
  if (f.subjects.length) out = restrictSubjects(out, f.subjects);

  if (f.students.length) {
    const set = new Set(f.students);
    out = out.filter((r) => (f.studentMode === 'only' ? set.has(r.sid) : !set.has(r.sid)));
  }
  const q = f.q.trim().toLowerCase();
  if (q) out = out.filter((r) => `${cleanName(r.student_name)} ${gccDigits(r.gcc_no)}`.toLowerCase().includes(q));

  const minTests = Number(f.minTests) || 0;
  const lo = numOrNull(f.avgMin), hi = numOrNull(f.avgMax);
  if (minTests > 0 || lo !== null || hi !== null) {
    const per = new Map();
    out.forEach((r) => {
      const p = per.get(r.sid) || { tests: new Set(), pcts: [] };
      p.tests.add(r.test_no);
      const pc = rowPct(r);
      if (pc !== null) p.pcts.push(pc);
      per.set(r.sid, p);
    });
    out = out.filter((r) => {
      const p = per.get(r.sid);
      if (p.tests.size < minTests) return false;
      const avg = mean(p.pcts);
      if (lo !== null && (avg === null || avg < lo)) return false;
      if (hi !== null && (avg === null || avg > hi)) return false;
      return true;
    });
  }
  return out;
}

// Unique students (one entry per sid) for the manual picker.
export function studentRoster(rows) {
  const by = new Map();
  rows.forEach((r) => {
    const c = by.get(r.sid) || { sid: r.sid, names: [], batch: r.batch, gcc: '', lastTest: -1 };
    c.names.push(r.student_name);
    if (r.test_no >= c.lastTest) { c.lastTest = r.test_no; c.batch = r.batch; }
    if (!c.gcc) c.gcc = gccDigits(r.gcc_no);
    by.set(r.sid, c);
  });
  return [...by.values()]
    .map((c) => ({ sid: c.sid, batch: c.batch, gcc: c.gcc, name: cleanName(c.names.sort((a, b) => b.length - a.length)[0]) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ── Saved presets (browser only) ──
const PRESET_KEY = 'gnsi_mock_filter_presets_v1';
export function loadPresets() {
  try { const v = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function savePresets(list) {
  try { localStorage.setItem(PRESET_KEY, JSON.stringify(list)); } catch { /* storage unavailable */ }
}

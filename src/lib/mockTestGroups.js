// mockTestGroups.js — self-study groups for the Mock Test Analyzer (pure, no React).
//
// Every class (= batch) is split into 7 self-study groups, from Group 1 (weakest marks) to Group 7
// (strongest marks), by each student's average % over the tests in view. Two ways to split:
//   'equal'  — 7 groups of (nearly) equal size, in rank order        [default: balanced study groups]
//   'bands'  — fixed mark bands:  <30 · 30–40 · 40–50 · 50–60 · 60–70 · 70–80 · 80+ (%)
// Each group also gets a focus subject: the subject its members score lowest in.
import { mean, rowPct, num } from './mockTestEngine.js';

export const GROUP_COUNT = 7;
export const BAND_LIMITS = [30, 40, 50, 60, 70, 80]; // upper limits (%) of groups 1..6
export const LANGUAGES = ['English', 'Meitei Mayek'];
export const GROUP_META = [
  { no: 1, tag: 'Weakest', color: '#b91c1c' },
  { no: 2, tag: 'Weak', color: '#dc2626' },
  { no: 3, tag: 'Below average', color: '#ea580c' },
  { no: 4, tag: 'Average', color: '#ca8a04' },
  { no: 5, tag: 'Above average', color: '#65a30d' },
  { no: 6, tag: 'Strong', color: '#16a34a' },
  { no: 7, tag: 'Strongest', color: '#047857' },
];

// Medium of a class, read from its name ('' when the class name does not say).
export function languageOfBatch(batch) {
  const s = String(batch || '');
  if (/manipuri|meitei|mayek|\bmm\b/i.test(s)) return 'Meitei Mayek';
  if (/english|\beng\b/i.test(s)) return 'English';
  return '';
}

const subjPct = (row, s) => {
  const v = num(row.marks?.[s]), m = num(row.max_marks?.[s]);
  return v !== null && m ? (v / m) * 100 : null;
};

// One summary per student (row.sid, from resolveIdentities): average %, per-subject average %, weakest subject.
export function studentAverages(rows) {
  const by = new Map();
  rows.forEach((r) => {
    const k = r.sid || `n:${r.student_name}`;
    if (!by.has(k)) by.set(k, []);
    by.get(k).push(r);
  });
  return [...by.entries()].map(([sid, rs]) => {
    const pcts = rs.map(rowPct).filter((x) => x !== null);
    const subjects = [...new Set(rs.flatMap((r) => Object.keys(r.marks || {})))];
    const subj = {};
    subjects.forEach((s) => { const v = rs.map((r) => subjPct(r, s)).filter((x) => x !== null); if (v.length) subj[s] = mean(v); });
    const ranked = Object.entries(subj).sort((a, b) => a[1] - b[1]);
    // the batch the student sat most tests in
    const counts = {};
    rs.forEach((r) => { counts[r.batch] = (counts[r.batch] || 0) + 1; });
    const batch = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
    const named = rs.find((r) => r.student_name) || rs[0];
    return {
      sid, name: named.student_name, gcc: rs.find((r) => r.gcc_no)?.gcc_no || '', batch, language: languageOfBatch(batch),
      tests: rs.length, avg: mean(pcts), subj, weakest: ranked[0]?.[0] || '', strongest: ranked[ranked.length - 1]?.[0] || '',
    };
  }).filter((s) => s.avg !== null);
}

// Split students into 7 groups, weakest first. mode: 'equal' | 'bands'.
export function selfStudyGroups(students, { mode = 'equal' } = {}) {
  const sorted = [...students].sort((a, b) => a.avg - b.avg || String(a.name).localeCompare(String(b.name)));
  const n = sorted.length;
  const groups = GROUP_META.map((m) => ({ ...m, name: `Group ${m.no}`, students: [] }));
  sorted.forEach((s, i) => {
    const idx = mode === 'bands'
      ? BAND_LIMITS.filter((l) => s.avg >= l).length
      : Math.min(GROUP_COUNT - 1, Math.floor((i * GROUP_COUNT) / n));
    groups[idx].students.push(s);
  });
  groups.forEach((g) => {
    const avgs = g.students.map((s) => s.avg);
    g.n = g.students.length;
    g.min = g.n ? Math.min(...avgs) : null;
    g.max = g.n ? Math.max(...avgs) : null;
    g.avg = g.n ? mean(avgs) : null;
    const subjects = [...new Set(g.students.flatMap((s) => Object.keys(s.subj)))];
    g.subj = {};
    subjects.forEach((sub) => { const v = g.students.map((s) => s.subj[sub]).filter((x) => x !== undefined); if (v.length) g.subj[sub] = mean(v); });
    const low = Object.entries(g.subj).sort((a, b) => a[1] - b[1])[0];
    g.focus = low ? low[0] : '';
    g.focusPct = low ? low[1] : null;
  });
  return groups;
}

// Every class with its 7 groups. language: '' (all) | 'English' | 'Meitei Mayek' — classes whose name does
// not state a medium only appear under "all". batch: '' for every class, or one class.
export function classGroups(rows, { language = '', mode = 'equal', batch = '' } = {}) {
  const all = studentAverages(rows);
  const batches = [...new Set(all.map((s) => s.batch))].sort();
  return batches
    .filter((b) => (!batch || b === batch) && (!language || languageOfBatch(b) === language))
    .map((b) => {
      const students = all.filter((s) => s.batch === b);
      return { batch: b, language: languageOfBatch(b), count: students.length, avg: mean(students.map((s) => s.avg)), groups: selfStudyGroups(students, { mode }) };
    });
}

// Navodaya / Sainik exam insights for the Pre- and Mega-Mock analyzers.
// Pure functions only (no React) so they can be unit tested.
import { courseOfBatch } from './mockTestCourse.js';
import { mean, sd, slope, normName, cleanName, gccDigits, num, denseRanks } from './mockTestEngine.js';

export const EXAMS = {
  navodaya: { label: 'Navodaya (JNVST)', short: 'Navodaya', cutoff: 50, seats: 10, sectionMin: 0, color: '#0e7490' },
  sainik: { label: 'Sainik (AISSEE)', short: 'Sainik', cutoff: 50, seats: 10, sectionMin: 25, color: '#9a3412' },
};
export const EXAM_IDS = Object.keys(EXAMS);

// Exam a batch is preparing for, from its name. `override` ({batch: exam}) wins.
export function examOfBatch(batch, override = {}) {
  const o = override?.[batch];
  if (o && (EXAMS[o] || o === 'none')) return o === 'none' ? '' : o;
  const t = String(batch || '');
  if (/\bss\b/i.test(t)) return 'sainik';
  const c = courseOfBatch(t);
  return EXAMS[c] ? c : '';
}

const SECTION_RULES = {
  navodaya: [[/mental|reason|ability|intelligen/i, 'Mental Ability'], [/arith|math/i, 'Arithmetic'], [/lang|english|hindi|meitei|manipuri|mayek/i, 'Language']],
  sainik: [[/math/i, 'Mathematics'], [/gk|general|knowledge|aware/i, 'General Knowledge'], [/lang|english|hindi|meitei|manipuri|mayek/i, 'Language'], [/intelligen|reason|mental/i, 'Intelligence']],
};
export function sectionOf(exam, subject) {
  const hit = (SECTION_RULES[exam] || []).find(([re]) => re.test(subject));
  return hit ? hit[1] : '';
}

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const r1 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);

// Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf).
export function normCdf(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return 0.5 * (1 + (z < 0 ? -y : y));
}

// Score statistics from a student's per-test percentages (shared by real data and the what-if simulator).
export function statsFromPcts(pcts, testNos) {
  const recent = mean(pcts.slice(-3));
  const trend = pcts.length >= 2 ? slope(pcts, testNos) : 0;
  return { avgPct: mean(pcts), recent, trend, spread: sd(pcts), projected: pcts.length ? clamp(recent + 0.5 * trend) : null };
}

// One record per student: score history, projection and subject averages.
export function examStudents(rows, override = {}) {
  const by = new Map();
  rows.forEach((r) => { (by.get(r.sid) || by.set(r.sid, []).get(r.sid)).push(r); });
  return [...by.entries()].map(([sid, rs]) => {
    rs.sort((a, b) => a.test_no - b.test_no);
    const withPct = rs.filter((r) => r.max_total && Number.isFinite(Number(r.total)));
    const pcts = withPct.map((r) => (Number(r.total) / r.max_total) * 100);
    const last = rs[rs.length - 1];
    const sub = {};
    const subs = new Set(rs.flatMap((r) => Object.keys(r.marks || {})));
    subs.forEach((s) => {
      const v = rs.map((r) => { const m = num(r.max_marks?.[s]), x = num(r.marks?.[s]); return m && x !== null ? (x / m) * 100 : null; }).filter((x) => x !== null);
      if (v.length) sub[s] = mean(v);
    });
    const testNos = withPct.map((r) => r.test_no);
    const st = statsFromPcts(pcts, testNos);
    return {
      sid, name: cleanName([...rs].map((r) => r.student_name).sort((a, b) => b.length - a.length)[0]),
      gcc: gccDigits(last.gcc_no) || '', batch: last.batch, exam: examOfBatch(last.batch, override),
      tests: pcts.length, pcts, testNos, sub, ...st,
    };
  }).filter((s) => s.tests);
}

// Chance (0–1) of finishing at or above the cut-off in the real exam.
export function qualifyProbability(s, cutoff) {
  if (s.projected === null || s.projected === undefined) return null;
  const n = s.tests;
  const predSd = Math.max(s.spread, 4) * Math.sqrt(1 + 1 / n);
  return clamp(1 - normCdf((cutoff - s.projected) / predSd), 0, 1);
}
// A student needs MIN_TESTS_SAFE tests of history before the tool will call them Safe.
export const MIN_TESTS_SAFE = 3;
export function qualifyBand(p, tests = MIN_TESTS_SAFE) {
  if (p === null) return { label: '—', color: '#8a93a6' };
  return p >= 0.75 && tests >= MIN_TESTS_SAFE ? { label: 'Safe', color: '#047857' } : p >= 0.4 ? { label: 'Borderline', color: '#b45309' } : { label: 'At risk', color: '#b91c1c' };
}

// Rank by projected score; the top `seats` students who clear the cut-off are selected.
export function seatPrediction(students, { seats, cutoff }) {
  const sorted = [...students].sort((a, b) => b.projected - a.projected || b.avgPct - a.avgPct || a.name.localeCompare(b.name));
  const eligible = sorted.filter((s) => s.projected >= cutoff);
  const selected = eligible.slice(0, Math.max(0, seats));
  const waiting = eligible.slice(Math.max(0, seats));
  const below = sorted.filter((s) => s.projected < cutoff);
  const lastIn = selected[selected.length - 1] || null, firstOut = waiting[0] || null;
  return {
    sorted, selected, waiting, below, lastIn, firstOut,
    margin: lastIn && firstOut ? r1(lastIn.projected - firstOut.projected) : null,
    // students within 5 points of the seat line (either side) – the ones worth coaching hardest
    bubble: sorted.filter((s) => lastIn && Math.abs(s.projected - lastIn.projected) <= 5),
  };
}

// Section-wise picture: how far the selected group leads the rest in each subject.
export function sectionAnalysis(students, exam, selectedIds, sectionMin = 0) {
  const subjects = [...new Set(students.flatMap((s) => Object.keys(s.sub)))];
  const sel = new Set(selectedIds);
  return subjects.map((subject) => {
    const have = students.filter((s) => s.sub[subject] !== undefined);
    const a = have.map((s) => s.sub[subject]);
    const inSel = have.filter((s) => sel.has(s.sid)).map((s) => s.sub[subject]);
    const out = have.filter((s) => !sel.has(s.sid)).map((s) => s.sub[subject]);
    return {
      subject, section: sectionOf(exam, subject), n: have.length, avg: mean(a),
      selAvg: mean(inSel), restAvg: mean(out), gap: inSel.length && out.length ? mean(inSel) - mean(out) : null,
      belowMin: sectionMin ? have.filter((s) => s.sub[subject] < sectionMin).map((s) => s.name) : [],
      weakFor: students.filter((s) => { const e = Object.entries(s.sub); return e.length > 1 && e.sort((x, y) => x[1] - y[1])[0][0] === subject; }).length,
    };
  }).sort((a, b) => a.avg - b.avg);
}

// Pre vs Mega: match students across two series by GCC number, else by name.
export function compareSeries(preStudents, megaStudents) {
  const key = (s) => (s.gcc ? `g${s.gcc}` : `n${normName(s.name)}`);
  const megaBy = new Map(), byName = new Map();
  megaStudents.forEach((s) => {
    if (s.gcc && !megaBy.has(key(s))) megaBy.set(key(s), s);
    const n = `n${normName(s.name)}`;
    byName.set(n, byName.has(n) ? null : s); // null = ambiguous (two students share the name)
  });
  const used = new Set();
  const pairs = [];
  preStudents.forEach((p) => {
    let m = p.gcc ? megaBy.get(key(p)) : null;
    if (!m) {
      const c = byName.get(`n${normName(p.name)}`);
      // name fallback only when it is unambiguous and the GCC numbers don't contradict each other
      if (c && !(p.gcc && c.gcc)) m = c;
    }
    if (!m || used.has(m.sid)) return;
    used.add(m.sid);
    pairs.push({ name: p.name, gcc: p.gcc || m.gcc, batch: m.batch || p.batch, exam: m.exam || p.exam, pre: p.avgPct, mega: m.avgPct, preProj: p.projected, megaProj: m.projected });
  });
  const ra = denseRanks(pairs.map((x) => Math.round(x.pre * 100) / 100)), rb = denseRanks(pairs.map((x) => Math.round(x.mega * 100) / 100));
  pairs.forEach((x, i) => { x.delta = x.mega - x.pre; x.rankPre = ra[i]; x.rankMega = rb[i]; x.move = ra[i] - rb[i]; });
  pairs.sort((a, b) => b.delta - a.delta);
  return { pairs, matched: pairs.length, preOnly: preStudents.length - pairs.length, avgDelta: mean(pairs.map((x) => x.delta)), improved: pairs.filter((x) => x.delta > 1).length, declined: pairs.filter((x) => x.delta < -1).length };
}


// ─── Groups, what-if, watch-list ──────────────────────────────────────────────
// Which of `groups` equal rank groups (1 = top) position `index` of `total` falls in
// (students ÷ groups each, leftovers go to the top groups — same rule as the leaderboard).
export function groupOfRank(index, total, groups = 6) {
  const base = Math.floor(total / groups), extra = total % groups;
  let start = 0;
  for (let g = 0; g < groups; g++) {
    const size = base + (g < extra ? 1 : 0);
    if (index < start + size) return g + 1;
    start += size;
  }
  return groups;
}

// What if `student` scores `nextPct` in their next test (and/or the cut-off moves)?
export function simulate(student, nextPct, pool, { cutoff, seats }) {
  const nextNo = Math.max(0, ...(student.testNos || [0])) + 1;
  const pcts = [...student.pcts, clamp(Number(nextPct) || 0)];
  const moved = { ...student, tests: pcts.length, pcts, testNos: [...(student.testNos || []), nextNo], ...statsFromPcts(pcts, [...(student.testNos || []), nextNo]) };
  const sp = seatPrediction(pool.map((p) => (p.sid === student.sid ? moved : p)), { cutoff, seats });
  const idx = sp.sorted.findIndex((p) => p.sid === student.sid);
  const status = sp.selected.some((p) => p.sid === student.sid) ? 'Selected' : sp.waiting.some((p) => p.sid === student.sid) ? 'Waiting' : 'Below cut-off';
  return { student: moved, projected: moved.projected, probability: qualifyProbability(moved, cutoff), position: idx + 1, status };
}
// Lowest next-test % that lifts the student to `target` qualify chance (null = even 100% is not enough).
export function scoreNeeded(student, cutoff, target = 0.75) {
  const nextNo = Math.max(0, ...(student.testNos || [0])) + 1;
  for (let x = 0; x <= 100; x += 1) {
    const pcts = [...student.pcts, x];
    const m = { ...student, tests: pcts.length, pcts, ...statsFromPcts(pcts, [...(student.testNos || []), nextNo]) };
    if (qualifyProbability(m, cutoff) >= target && pcts.length >= MIN_TESTS_SAFE) return x;
  }
  return null;
}

// Students a mentor should look at first, each with the reasons why.
export function watchList(pool, cutoff) {
  const allTests = [...new Set(pool.flatMap((s) => s.testNos || []))].sort((a, b) => a - b);
  const lastTest = allTests[allTests.length - 1];
  const out = [];
  pool.forEach((s) => {
    const flags = [];
    const n = s.pcts.length;
    if (n >= 2) {
      const prev = mean(s.pcts.slice(0, -1)), drop = prev - s.pcts[n - 1];
      if (drop >= 10) flags.push({ type: 'drop', severity: 3, text: `Latest test ${Math.round(s.pcts[n - 1])}% — ${Math.round(drop)} points below their earlier average` });
    }
    if (n >= 3 && s.trend <= -3) flags.push({ type: 'trend', severity: 2, text: `Falling ${Math.abs(Math.round(s.trend * 10) / 10)} points per test` });
    const missed = allTests.filter((t) => !(s.testNos || []).includes(t));
    if (missed.length >= 2 || (missed.length === 1 && missed[0] === lastTest)) flags.push({ type: 'missed', severity: missed.includes(lastTest) ? 3 : 2, text: `Missed ${missed.length} test${missed.length > 1 ? 's' : ''} (${missed.map((t) => 'T' + t).join(', ')})` });
    const p = qualifyProbability(s, cutoff);
    if (qualifyBand(p, s.tests).label === 'At risk') flags.push({ type: 'risk', severity: 3, text: `Only ${Math.round(p * 100)}% chance to reach the ${cutoff}% cut-off` });
    if (s.tests < MIN_TESTS_SAFE) flags.push({ type: 'few', severity: 1, text: `Only ${s.tests} test${s.tests > 1 ? 's' : ''} so far — prediction is low confidence` });
    if (flags.length) out.push({ student: s, flags, score: flags.reduce((t, f) => t + f.severity, 0) });
  });
  return out.sort((a, b) => b.score - a.score || a.student.name.localeCompare(b.student.name));
}

// Plain-language advice for the parent report.
export function adviceFor(s, { cutoff, status }) {
  const lines = [];
  const subs = Object.entries(s.sub).sort((a, b) => a[1] - b[1]);
  if (subs.length > 1) {
    lines.push(`Needs most work: ${subs.slice(0, 2).map(([k, v]) => `${k} (${Math.round(v)}%)`).join(', ')}.`);
    lines.push(`Strongest: ${subs[subs.length - 1][0]} (${Math.round(subs[subs.length - 1][1])}%).`);
  }
  if (s.tests >= 3 && s.trend >= 1.5) lines.push('Marks are improving test after test — keep the same routine.');
  else if (s.tests >= 3 && s.trend <= -1.5) lines.push('Marks have been falling recently — please talk to the mentor and check revision time at home.');
  if (status === 'Below cut-off') lines.push(`Projected score is below the ${cutoff}% target; daily practice on the weakest subjects is needed.`);
  else if (status === 'Waiting') lines.push('Close to the selection line — every extra mark can move the rank.');
  else lines.push('On track for selection — maintain consistency and avoid careless mistakes.');
  return lines;
}

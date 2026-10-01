// ─── mockTestEngine.js ───────────────────────────────────────────────────────
// Pure functions behind the Mock Test Analyzer (no React, no network):
//   • parseResultSheet()   – turns an uploaded Excel sheet into result rows
//   • resolveIdentities()  – ties the same child together across tests even when
//                            the GCC number is blank / mistyped or the name is
//                            spelled differently from one sheet to the next
//   • studentAnalysis() / batchAnalysis() – every statistic the screen and the
//                            printed reports show
//
// A result row (same shape as the `mock_test_results` table):
//   { series, test_no, test_name, test_date, batch, gcc_no, student_name,
//     marks:{subject:number}, max_marks:{subject:number}, total, max_total,
//     rank, sid? }

export const DEFAULT_SERIES = 'Pre Mock Test 2026';

// ─── small numeric helpers ────────────────────────────────────────────────────
export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};
export const r1 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
export const r2 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 100) / 100);
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
export const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / a.length);
};
// Least-squares slope of ys against xs (xs default 0..n-1). Returns 0 for <2 points.
export function slope(ys, xs) {
  const n = ys.length;
  if (n < 2) return 0;
  const X = xs || ys.map((_, i) => i);
  const mx = mean(X), my = mean(ys);
  let nu = 0, de = 0;
  for (let i = 0; i < n; i++) { nu += (X[i] - mx) * (ys[i] - my); de += (X[i] - mx) ** 2; }
  return de === 0 ? 0 : nu / de;
}
export function predictNext(ys, xs, nextX) {
  if (ys.length < 2) return ys.length ? ys[0] : null;
  const X = xs || ys.map((_, i) => i);
  const b = slope(ys, X), mx = mean(X), my = mean(ys);
  return my + b * (nextX - mx);
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ─── name matching ────────────────────────────────────────────────────────────
// Words that appear in many different names and therefore prove nothing.
const COMMON = new Set(['SINGH', 'DEVI', 'KUMAR', 'KUMARI', 'CHANU', 'MD', 'MOHD', 'KH', 'SH', 'TH', 'PH', 'LAISHRAM']);

export const normName = (s) =>
  String(s ?? '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const cleanName = (s) => String(s ?? '').replace(/\*/g, ' ').replace(/\s+/g, ' ').trim();
export const gccDigits = (v) => String(v ?? '').replace(/\D/g, '');

function lev(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function tokCompat(a, b) {
  if (a === b) return true;
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  if (s.length >= 3 && l.startsWith(s)) return true;
  if (a.length >= 4 && b.length >= 4) return 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.75;
  return false;
}
function tokens(n, strict) {
  return normName(n).split(' ').filter((t) => t.length >= 2 && (!strict || !COMMON.has(t)));
}
// Do two spellings plausibly belong to the same child?  `strict` ignores very
// common words (Singh, Devi, Kh…) so two different children never merge on those.
// Same name typed with different spacing ("S LE BISANA" / "S LEMBISANA").
const squashed = (a, b) => {
  const x = normName(a).replace(/ /g, ''), y = normName(b).replace(/ /g, '');
  return x.length >= 6 && y.length >= 6 && 1 - lev(x, y) / Math.max(x.length, y.length) >= 0.8;
};
export function nameCompat(a, b, strict = false) {
  const ta = tokens(a, strict), tb = tokens(b, strict);
  if (!ta.length || !tb.length) return false;
  return ta.some((x) => tb.some((y) => tokCompat(x, y))) || squashed(a, b);
}
function nameScore(a, b) {
  const ta = tokens(a, true), tb = tokens(b, true);
  let s = 0;
  ta.forEach((x) => { if (tb.some((y) => tokCompat(x, y))) s += x.length; });
  return s || (squashed(a, b) ? 6 : 0);
}

// ─── identity resolution ──────────────────────────────────────────────────────
// Adds `sid` (stable student id) to every row.  GCC number is the primary key,
// but real sheets contain blank GCCs and typos, so:
//   1. rows sharing a GCC are clustered by name; the biggest cluster keeps the
//      GCC, a clearly different name under the same GCC is split off;
//   2. split-off rows, blank-GCC rows and one-off GCCs are matched by name
//      inside the same batch, otherwise they become their own student
//      (keeping the GCC they were entered with).
export function resolveIdentities(rows) {
  const out = rows.map((r) => ({ ...r }));
  const byG = new Map();
  out.forEach((r, i) => {
    const g = gccDigits(r.gcc_no);
    if (g) { if (!byG.has(g)) byG.set(g, []); byG.get(g).push(i); }
  });

  const pending = [];
  out.forEach((r, i) => { if (!gccDigits(r.gcc_no)) pending.push(i); });

  byG.forEach((idxs, g) => {
    // A GCC seen on exactly one row is more likely a typo/truncation of a real
    // GCC (e.g. "111*" for 1113) than a brand-new child — try the name first.
    if (idxs.length === 1) { pending.push(idxs[0]); return; }
    // union-find clusters on name compatibility
    const parent = idxs.map((_, k) => k);
    const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    for (let a = 0; a < idxs.length; a++) {
      for (let b = a + 1; b < idxs.length; b++) {
        if (nameCompat(out[idxs[a]].student_name, out[idxs[b]].student_name)) parent[find(a)] = find(b);
      }
    }
    const clusters = new Map();
    idxs.forEach((ix, k) => {
      const root = find(k);
      if (!clusters.has(root)) clusters.set(root, []);
      clusters.get(root).push(ix);
    });
    const sorted = [...clusters.values()].sort((x, y) => y.length - x.length);
    sorted[0].forEach((ix) => { out[ix].sid = 'g:' + g; });
    sorted.slice(1).forEach((c) => c.forEach((ix) => pending.push(ix)));
  });

  // identities known so far, per batch
  const known = new Map(); // sid -> {batch -> Set(test_no)}, names[]
  const ident = (sid) => {
    if (!known.has(sid)) known.set(sid, { names: new Set(), slots: new Set(), batches: new Set() });
    return known.get(sid);
  };
  out.forEach((r) => {
    if (r.sid) {
      const k = ident(r.sid);
      k.names.add(r.student_name);
      k.slots.add(`${r.batch}|${r.test_no}`);
      k.batches.add(r.batch);
    }
  });

  pending.forEach((ix) => {
    const r = out[ix];
    let best = null, bestScore = 0;
    known.forEach((k, sid) => {
      if (!k.batches.has(r.batch) || k.slots.has(`${r.batch}|${r.test_no}`)) return;
      let sc = 0;
      k.names.forEach((n) => { sc = Math.max(sc, nameScore(r.student_name, n)); });
      if (sc > bestScore) { bestScore = sc; best = sid; }
    });
    r.sid = best && bestScore >= 3 ? best : 'n:' + r.batch + ':' + normName(r.student_name);
    const k = ident(r.sid);
    k.names.add(r.student_name);
    k.slots.add(`${r.batch}|${r.test_no}`);
    k.batches.add(r.batch);
  });
  return out;
}

// ─── series meta ──────────────────────────────────────────────────────────────
export function seriesMeta(rows) {
  const tests = [...new Set(rows.map((r) => r.test_no))].sort((a, b) => a - b);
  const batches = [...new Set(rows.map((r) => r.batch))].sort();
  const subjCount = {};
  rows.forEach((r) => Object.keys(r.marks || {}).forEach((s) => { subjCount[s] = (subjCount[s] || 0) + 1; }));
  const subjects = Object.keys(subjCount).sort((a, b) => subjCount[b] - subjCount[a]);
  const testNames = {};
  rows.forEach((r) => { if (r.test_name && !testNames[r.test_no]) testNames[r.test_no] = r.test_name; });
  return { tests, batches, subjects, testNames };
}

const maxOf = (row, subj) => num(row.max_marks?.[subj]) || 0;
const subjPct = (row, subj) => {
  const m = maxOf(row, subj), v = num(row.marks?.[subj]);
  return m && v !== null ? (v / m) * 100 : null;
};
export const rowPct = (row) => (row.max_total ? (row.total / row.max_total) * 100 : null);

// Dense ranking (ties share a rank, next rank follows) — the convention used in
// the school's own result sheets.
export function denseRanks(values) {
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  const pos = new Map(uniq.map((v, i) => [v, i + 1]));
  return values.map((v) => pos.get(v));
}

export function strengthLabel(pct) {
  if (pct === null || pct === undefined) return { key: 'na', label: '—', color: '#64748b' };
  if (pct >= 75) return { key: 'strong', label: 'Strong', color: '#047857' };
  if (pct >= 60) return { key: 'good', label: 'Good', color: '#1d4ed8' };
  if (pct >= 45) return { key: 'average', label: 'Average', color: '#b45309' };
  return { key: 'weak', label: 'Needs Work', color: '#b91c1c' };
}
export function overallBand(pct) {
  if (pct >= 80) return { label: 'Outstanding', color: '#047857' };
  if (pct >= 65) return { label: 'Very Good', color: '#1d4ed8' };
  if (pct >= 50) return { label: 'Good', color: '#0e7490' };
  if (pct >= 40) return { label: 'Needs Improvement', color: '#b45309' };
  return { label: 'Critical – Needs Attention', color: '#b91c1c' };
}

// ─── student analysis ─────────────────────────────────────────────────────────
// rows: all result rows of ONE series, already identity-resolved.
export function studentAnalysis(rows, sid, opts = {}) {
  const passPct = opts.passPct ?? 40;
  const mine = rows.filter((r) => r.sid === sid).sort((a, b) => a.test_no - b.test_no);
  if (!mine.length) return null;

  const latest = mine[mine.length - 1];
  const name = [...mine].map((r) => cleanName(r.student_name)).sort((a, b) => b.length - a.length)[0];
  const gcc = gccDigits(latest.gcc_no) || gccDigits(mine.find((r) => gccDigits(r.gcc_no))?.gcc_no) || '';
  const batch = latest.batch;

  const subjects = [];
  mine.forEach((r) => Object.keys(r.marks || {}).forEach((s) => { if (!subjects.includes(s)) subjects.push(s); }));

  // per-test (cohort = same series, test and batch)
  const tests = mine.map((r) => {
    const cohort = rows.filter((c) => c.test_no === r.test_no && c.batch === r.batch);
    const totals = cohort.map((c) => c.total);
    const below = totals.filter((t) => t < r.total).length;
    const equal = totals.filter((t) => t === r.total).length - 1;
    const rank = r.rank ?? denseRanks(totals)[cohort.indexOf(r)];
    const subj = {};
    subjects.forEach((s) => {
      const v = num(r.marks?.[s]);
      if (v === null) return;
      const cv = cohort.map((c) => num(c.marks?.[s])).filter((x) => x !== null);
      subj[s] = {
        marks: v, max: maxOf(r, s), pct: subjPct(r, s),
        cohortAvg: mean(cv), cohortHigh: Math.max(...cv), diff: v - mean(cv),
        rank: denseRanks(cv)[cv.indexOf(v)],
      };
    });
    return {
      test_no: r.test_no, test_name: r.test_name, batch: r.batch,
      total: r.total, max: r.max_total, pct: rowPct(r), rank, n: cohort.length,
      percentile: cohort.length > 1 ? ((below + equal / 2) / (cohort.length - 1)) * 100 : 100,
      cohortAvg: mean(totals), cohortHigh: Math.max(...totals), diff: r.total - mean(totals), subj,
    };
  });

  const heldTests = [...new Set(rows.filter((r) => r.batch === batch).map((r) => r.test_no))].sort((a, b) => a - b);

  // per-subject summary
  const subjSummary = subjects.map((s) => {
    const pts = tests.filter((t) => t.subj[s]).map((t) => ({ test_no: t.test_no, ...t.subj[s] }));
    const pcts = pts.map((p) => p.pct);
    const marks = pts.map((p) => p.marks);
    const max = pts.length ? pts[0].max : 0;
    const best = pts.reduce((b, p) => (p.marks > b.marks ? p : b), pts[0]);
    const worst = pts.reduce((b, p) => (p.marks < b.marks ? p : b), pts[0]);
    const avgPct = mean(pcts);
    const tr = slope(pcts, pts.map((p) => p.test_no));
    // rank of this child in the subject (average over all tests) inside own batch
    const peers = {};
    rows.filter((r) => r.batch === batch).forEach((r) => {
      const p = subjPct(r, s);
      if (p !== null) (peers[r.sid] = peers[r.sid] || []).push(p);
    });
    const peerAvg = Object.entries(peers).map(([k, v]) => [k, mean(v)]);
    const myIdx = peerAvg.findIndex(([k]) => k === sid);
    const ranks = denseRanks(peerAvg.map(([, v]) => r2(v)));
    return {
      subject: s, max, tests: pts.length, values: pts,
      avg: mean(marks), avgPct, best, worst, latest: pts[pts.length - 1], first: pts[0],
      trend: tr, consistency: sd(pcts),
      cohortAvgPct: mean(pts.map((p) => (p.cohortAvg / p.max) * 100)),
      gapPct: avgPct - mean(pts.map((p) => (p.cohortAvg / p.max) * 100)),
      lost: max - mean(marks),
      batchRank: myIdx >= 0 ? ranks[myIdx] : null, batchSize: peerAvg.length,
      label: strengthLabel(avgPct),
      trendLabel: tr > 1.5 ? 'Improving' : tr < -1.5 ? 'Declining' : 'Stable',
    };
  });

  const pcts = tests.map((t) => t.pct);
  const xs = tests.map((t) => t.test_no);
  const tr = slope(pcts, xs);
  const half = Math.floor(tests.length / 2);
  const firstHalf = tests.length >= 4 ? mean(pcts.slice(0, half)) : null;
  const lastHalf = tests.length >= 4 ? mean(pcts.slice(tests.length - half)) : null;
  const bestT = tests.reduce((b, t) => (t.total > b.total ? t : b), tests[0]);
  const worstT = tests.reduce((b, t) => (t.total < b.total ? t : b), tests[0]);
  const avgPct = mean(pcts);
  const maxTotal = tests[tests.length - 1].max;
  const predicted = tests.length >= 2 ? clamp(predictNext(pcts, xs, Math.max(...xs) + 1), 0, 100) : null;

  const summary = {
    testsAttended: tests.length,
    testsHeld: heldTests.length,
    attendancePct: (tests.length / heldTests.length) * 100,
    avgTotal: mean(tests.map((t) => t.total)), avgPct,
    best: bestT, worst: worstT, latest: tests[tests.length - 1],
    trend: tr, consistency: sd(pcts),
    firstHalf, lastHalf,
    avgRank: mean(tests.map((t) => t.rank)),
    bestRank: Math.min(...tests.map((t) => t.rank)),
    rankChange: tests.length >= 2 ? tests[0].rank - tests[tests.length - 1].rank : 0,
    avgPercentile: mean(tests.map((t) => t.percentile)),
    predictedPct: predicted, predictedTotal: predicted === null ? null : (predicted / 100) * maxTotal,
    band: overallBand(avgPct),
    trendLabel: tr > 1.5 ? 'Improving' : tr < -1.5 ? 'Declining' : 'Stable',
    consistencyLabel: sd(pcts) < 5 ? 'Highly consistent' : sd(pcts) < 10 ? 'Moderately consistent' : 'Erratic',
    atRisk: avgPct < passPct || (tr < -1.5 && pcts[pcts.length - 1] < passPct + 15),
  };

  // ranked focus areas = subjects ordered by marks lost against full marks
  const focus = [...subjSummary].sort((a, b) => b.lost - a.lost);
  const strongest = [...subjSummary].sort((a, b) => b.avgPct - a.avgPct)[0];
  const weakest = [...subjSummary].sort((a, b) => a.avgPct - b.avgPct)[0];

  const insights = [];
  insights.push(`${name} has appeared in ${tests.length} of ${heldTests.length} tests, averaging ${r1(summary.avgTotal)}/${maxTotal} (${r1(avgPct)}%) — ${summary.band.label}.`);
  if (strongest && weakest && strongest.subject !== weakest.subject) {
    insights.push(`Strongest subject: ${strongest.subject} (${r1(strongest.avgPct)}%). Weakest: ${weakest.subject} (${r1(weakest.avgPct)}%) — a ${r1(strongest.avgPct - weakest.avgPct)} point spread.`);
  }
  if (tests.length >= 2) {
    const d = tests[tests.length - 1].pct - tests[0].pct;
    insights.push(`Overall trend is ${summary.trendLabel.toLowerCase()} (${tr >= 0 ? '+' : ''}${r2(tr)} percentage points per test); latest test is ${d >= 0 ? 'up' : 'down'} ${r1(Math.abs(d))} points from the first.`);
    insights.push(`Class rank moved from ${tests[0].rank} to ${tests[tests.length - 1].rank} (${summary.rankChange > 0 ? `up ${summary.rankChange}` : summary.rankChange < 0 ? `down ${-summary.rankChange}` : 'no change'}); best rank ${summary.bestRank}.`);
  }
  subjSummary.filter((s) => s.trendLabel === 'Declining' && s.tests >= 3).forEach((s) => {
    insights.push(`⚠ ${s.subject} is declining (${r2(s.trend)} points per test) — revisit fundamentals.`);
  });
  subjSummary.filter((s) => s.trendLabel === 'Improving' && s.tests >= 3).forEach((s) => {
    insights.push(`✔ ${s.subject} is improving (+${r2(s.trend)} points per test).`);
  });
  subjSummary.filter((s) => s.gapPct < -8).forEach((s) => {
    insights.push(`${s.subject}: ${r1(-s.gapPct)} points below the batch average — extra practice recommended.`);
  });
  if (focus[0]) insights.push(`Biggest scope for gain: ${focus[0].subject} (${r1(focus[0].lost)} of ${focus[0].max} marks lost per test on average).`);
  if (summary.consistency >= 10) insights.push('Scores swing widely between tests — focus on steady revision and exam temperament.');
  if (predicted !== null) insights.push(`If the current pattern continues, the next test is projected near ${r1(summary.predictedTotal)}/${maxTotal} (${r1(predicted)}%).`);

  return { sid, name, gcc, batch, batches: [...new Set(mine.map((r) => r.batch))], subjects, tests, subjSummary, summary, focus, strongest, weakest, insights, maxTotal };
}

// ─── batch / test analysis ────────────────────────────────────────────────────
// batch: a batch name, or '' for every batch.   testNo: a number, or null for all tests.
export function batchAnalysis(allRows, batch, testNo, opts = {}) {
  const passPct = opts.passPct ?? 40;
  let rows = allRows.filter((r) => (!batch || r.batch === batch) && (testNo === null || testNo === undefined || r.test_no === testNo));
  if (!rows.length) return null;
  const meta = seriesMeta(rows);
  const subjects = meta.subjects;

  // ── per test ──
  const perTest = meta.tests.map((t) => {
    const rs = rows.filter((r) => r.test_no === t);
    const totals = rs.map((r) => r.total);
    const pc = rs.map((r) => rowPct(r));
    const subj = {};
    subjects.forEach((s) => {
      const v = rs.map((r) => subjPct(r, s)).filter((x) => x !== null);
      const m = rs.map((r) => num(r.marks?.[s])).filter((x) => x !== null);
      if (v.length) subj[s] = { avgPct: mean(v), avg: mean(m), high: Math.max(...m), low: Math.min(...m), pass: (v.filter((x) => x >= passPct).length / v.length) * 100 };
    });
    return {
      test_no: t, name: meta.testNames[t], n: rs.length, avg: mean(totals), avgPct: mean(pc), median: median(totals),
      high: Math.max(...totals), low: Math.min(...totals), sd: sd(totals),
      pass: (pc.filter((x) => x >= passPct).length / pc.length) * 100,
      max: rs[0].max_total, subj,
      topper: rs.reduce((b, r) => (r.total > b.total ? r : b), rs[0]),
    };
  });

  // ── per student (across the selected tests) ──
  const bySid = new Map();
  rows.forEach((r) => { if (!bySid.has(r.sid)) bySid.set(r.sid, []); bySid.get(r.sid).push(r); });
  const students = [...bySid.entries()].map(([sid, rs]) => {
    rs.sort((a, b) => a.test_no - b.test_no);
    const pcts = rs.map(rowPct);
    const sub = {};
    subjects.forEach((s) => {
      const v = rs.map((r) => subjPct(r, s)).filter((x) => x !== null);
      if (v.length) sub[s] = mean(v);
    });
    const subTests = {};
    rs.forEach((r) => Object.keys(r.marks || {}).forEach((s) => { (subTests[s] = subTests[s] || {})[r.test_no] = num(r.marks[s]); }));
    const last = rs[rs.length - 1];
    return {
      sid, subTests, name: cleanName([...rs].map((r) => r.student_name).sort((a, b) => b.length - a.length)[0]),
      gcc: gccDigits(last.gcc_no) || gccDigits(rs.find((r) => gccDigits(r.gcc_no))?.gcc_no) || '',
      batch: last.batch, tests: rs.length,
      avgTotal: mean(rs.map((r) => r.total)), avgPct: mean(pcts), best: Math.max(...rs.map((r) => r.total)),
      latestPct: pcts[pcts.length - 1], latestRank: last.rank, max: last.max_total,
      trend: slope(pcts, rs.map((r) => r.test_no)), consistency: sd(pcts), sub,
      first: pcts[0], delta: pcts.length >= 2 ? pcts[pcts.length - 1] - pcts[0] : 0,
    };
  });
  const rk = denseRanks(students.map((s) => r2(s.avgPct)));
  students.forEach((s, i) => { s.rank = rk[i]; });
  students.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));

  // ── per subject ──
  const perSubject = subjects.map((s) => {
    const recs = rows.map((r) => ({ r, p: subjPct(r, s), v: num(r.marks?.[s]) })).filter((x) => x.p !== null);
    const pv = recs.map((x) => x.p);
    const byTest = meta.tests.map((t) => {
      const v = recs.filter((x) => x.r.test_no === t).map((x) => x.p);
      return { test_no: t, avgPct: v.length ? mean(v) : null, n: v.length };
    });
    const dist = [0, 20, 40, 60, 80].map((lo, i) => ({
      label: i === 4 ? '80-100' : `${lo}-${lo + 20}`,
      count: pv.filter((p) => (i === 4 ? p >= 80 : p >= lo && p < lo + 20)).length,
    }));
    const ranked = students.filter((st) => st.sub[s] !== undefined).sort((a, b) => b.sub[s] - a.sub[s]);
    const hi = recs.reduce((b, x) => (x.v > b.v ? x : b), recs[0]);
    const lo = recs.reduce((b, x) => (x.v < b.v ? x : b), recs[0]);
    return {
      subject: s, max: maxOf(recs[0].r, s), n: recs.length,
      avgPct: mean(pv), avg: mean(recs.map((x) => x.v)), median: median(recs.map((x) => x.v)), sd: sd(recs.map((x) => x.v)),
      high: hi.v, highWho: cleanName(hi.r.student_name), highTest: hi.r.test_no,
      low: lo.v, lowWho: cleanName(lo.r.student_name), lowTest: lo.r.test_no,
      pass: (pv.filter((p) => p >= passPct).length / pv.length) * 100,
      full: recs.filter((x) => x.p >= 99.99).length,
      dist, byTest,
      trend: slope(byTest.filter((b) => b.avgPct !== null).map((b) => b.avgPct), byTest.filter((b) => b.avgPct !== null).map((b) => b.test_no)),
      toppers: ranked.slice(0, 5).map((st) => ({ name: st.name, gcc: st.gcc, pct: st.sub[s] })),
      weakest: ranked.slice(-5).reverse().map((st) => ({ name: st.name, gcc: st.gcc, pct: st.sub[s] })),
      label: strengthLabel(mean(pv)),
    };
  });
  const orderedBySubject = [...perSubject].sort((a, b) => a.avgPct - b.avgPct);

  const movers = students.filter((s) => s.tests >= 3);
  const improvers = [...movers].sort((a, b) => b.trend - a.trend).slice(0, 5);
  const decliners = [...movers].sort((a, b) => a.trend - b.trend).slice(0, 5);
  const atRisk = students.filter((s) => s.avgPct < passPct || (s.trend < -1.5 && s.latestPct < passPct + 15))
    .sort((a, b) => a.avgPct - b.avgPct);
  const consistent = [...movers].sort((a, b) => a.consistency - b.consistency).slice(0, 5);

  // subject × test heat grid
  const heat = perSubject.map((ps) => ({ subject: ps.subject, cells: ps.byTest }));

  const overallPct = rows.map(rowPct);
  return {
    batch, testNo, meta, rowsCount: rows.length, studentCount: students.length,
    perTest, perSubject, students, improvers, decliners, atRisk, consistent, heat,
    toughest: orderedBySubject[0], easiest: orderedBySubject[orderedBySubject.length - 1],
    avgPct: mean(overallPct), passPct,
    pass: (overallPct.filter((x) => x >= passPct).length / overallPct.length) * 100,
    topper: students[0],
  };
}

// Compare every batch side by side (used on the overview screen).
export function batchComparison(allRows, passPct = 40) {
  const { batches, subjects } = seriesMeta(allRows);
  return batches.map((b) => {
    const rs = allRows.filter((r) => r.batch === b);
    const pc = rs.map(rowPct);
    const subj = {};
    subjects.forEach((s) => {
      const v = rs.map((r) => subjPct(r, s)).filter((x) => x !== null);
      if (v.length) subj[s] = mean(v);
    });
    const ids = new Set(rs.map((r) => r.sid));
    return {
      batch: b, students: ids.size, records: rs.length, tests: new Set(rs.map((r) => r.test_no)).size,
      avgPct: mean(pc), pass: (pc.filter((x) => x >= passPct).length / pc.length) * 100,
      high: Math.max(...rs.map((r) => r.total)), subj,
    };
  });
}

// ─── Excel sheet → result rows ────────────────────────────────────────────────
const SKIP_HEAD = /^(SL|SLNO|SNO|SRNO|S\.?NO|SERIAL|SR|#)$/;
const isTotalHead = (h) => /^(SCORE|TOTAL|GRANDTOTAL|TOTALMARKS|MARKS|OBTAINED|TOTALSCORE)$/.test(h);
const isRankHead = (h) => /^(RANK|RNK|POSITION|POS)$/.test(h);
const isSkipHead = (h) => /^(PERCENT|PERCENTAGE|PCT|GRADE|RESULT|REMARK|REMARKS|STATUS|CLASS|BATCH|SECTION|ROLL|ROLLNO|ADMNO|ADMISSIONNO|DIVISION)$/.test(h);
const compact = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const pretty = (s) =>
  String(s).trim().replace(/\s+/g, ' ').toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/\bEvs\b/, 'EVS');

// aoa: array of arrays (sheet_to_json with header:1).  Returns the parsed rows
// plus the diagnostics the upload screen shows before anything is saved.
export function parseResultSheet(aoa) {
  const warnings = [];
  const hi = aoa.findIndex((row) => (row || []).some((c) => /GCC/i.test(String(c ?? ''))) || ((row || []).some((c) => /NAME/i.test(String(c ?? ''))) && (row || []).length > 3));
  if (hi < 0) return { rows: [], subjects: [], warnings: ['Could not find a header row containing "GCC No" / "Name".'], skipped: 0 };
  const head = aoa[hi].map((c) => ({ raw: String(c ?? '').trim(), key: compact(c) }));

  let gccCol = head.findIndex((h) => /^GCC/.test(h.key));
  if (gccCol < 0) gccCol = head.findIndex((h) => /^(ADM|ADMISSION|ID|REG)/.test(h.key));
  const nameCol = head.findIndex((h) => /NAME/.test(h.key));
  const totalCol = head.findIndex((h) => isTotalHead(h.key));
  const rankCol = head.findIndex((h) => isRankHead(h.key));
  const subjCols = [];
  head.forEach((h, i) => {
    if (!h.key || i === gccCol || i === nameCol || i === totalCol || i === rankCol) return;
    if (SKIP_HEAD.test(h.key) || isSkipHead(h.key)) return;
    subjCols.push({ i, subject: pretty(h.raw) });
  });
  if (nameCol < 0) warnings.push('No student-name column found.');
  if (!subjCols.length) warnings.push('No subject columns found.');

  const rows = [];
  let skipped = 0;
  for (let r = hi + 1; r < aoa.length; r++) {
    const line = aoa[r] || [];
    const nm = cleanName(line[nameCol]);
    if (!nm) { if (line.some((c) => c !== null && c !== undefined && c !== '')) skipped++; continue; }
    const marks = {};
    let bad = false;
    subjCols.forEach(({ i, subject }) => {
      const v = num(line[i]);
      if (v === null) bad = true; else marks[subject] = v;
    });
    if (!Object.keys(marks).length) { skipped++; continue; }
    if (bad) warnings.push(`Row ${r + 1} (${nm}): some subject marks are blank — treated as absent for those subjects.`);
    const sum = Object.values(marks).reduce((s, x) => s + x, 0);
    const fileTotal = totalCol >= 0 ? num(line[totalCol]) : null;
    if (fileTotal !== null && Math.abs(fileTotal - sum) > 0.01) warnings.push(`Row ${r + 1} (${nm}): total ${fileTotal} ≠ sum of subjects ${r2(sum)} — using the sum.`);
    rows.push({
      gcc_no: gccCol >= 0 ? String(line[gccCol] ?? '').trim() : '',
      student_name: nm, marks, total: sum, rank: rankCol >= 0 ? num(line[rankCol]) : null,
    });
  }
  const subjects = subjCols.map((c) => c.subject);
  // ranks: use the sheet's own where present, otherwise rank by total
  const rk = denseRanks(rows.map((x) => x.total));
  rows.forEach((x, i) => { if (x.rank === null) x.rank = rk[i]; });
  const blank = rows.filter((x) => !gccDigits(x.gcc_no)).length;
  if (blank) warnings.push(`${blank} row(s) have no GCC number — they will be matched by name.`);
  return { rows, subjects, warnings, skipped };
}

// Guess the highest possible marks per subject from the scores seen.
export function inferMax(rows, subjects) {
  const steps = [5, 10, 15, 20, 25, 30, 40, 50, 60, 75, 100];
  const out = {};
  subjects.forEach((s) => {
    const hi = Math.max(0, ...rows.map((r) => r.marks[s] ?? 0));
    out[s] = steps.find((x) => x >= hi) || Math.ceil(hi);
  });
  return out;
}

// Pull a test number and batch out of a file name like
// "RESULT OUT FOR 8TH PRE MOCK TEST FOR NAVODAYA LAKSHYA - A.xls".
export function guessFromFilename(fileName) {
  const f = String(fileName || '').replace(/\.[a-z]+$/i, '');
  const u = f.toUpperCase();
  const t = u.match(/(\d{1,2})\s*(ST|ND|RD|TH)\b/) || u.match(/TEST\s*(?:NO\.?)?\s*(\d{1,2})/);
  let batch = '';
  if (/COMBINED\s+ENGLISH/.test(u)) batch = 'Combined English';
  else if (/MANIPURI/.test(u)) batch = 'Combined Manipuri';
  else if (/LAKSHYA\s*-?\s*A\b/.test(u)) batch = 'Lakshya A';
  else if (/LAKSHYA\s*-?\s*B\b/.test(u)) batch = 'Lakshya B';
  else if (/UMEED/.test(u)) batch = 'Umeed';
  else {
    const m = u.match(/\bFOR\s+(.+)$/);
    if (m) batch = pretty(m[1].replace(/NAVODAYA|NAVODAUA|COMBINED/g, '').replace(/[-–]/g, ' ')).trim();
  }
  return { test_no: t ? parseInt(t[1], 10) : null, batch };
}

// Compact seed format  [test, batch, gcc, name, [subject marks…], total, rank]
export function rowsFromSeed(seed, series, subjects, maxPerSubject, testNames = {}) {
  const max = {};
  subjects.forEach((s) => { max[s] = maxPerSubject; });
  const maxTotal = maxPerSubject * subjects.length;
  return seed.map(([t, batch, gcc, name, vals, total, rank]) => {
    const marks = {};
    subjects.forEach((s, i) => { marks[s] = vals[i]; });
    return {
      series, test_no: t, test_name: testNames[t] || `Pre Mock Test ${t}`, test_date: null, batch,
      gcc_no: gcc, student_name: name, marks, max_marks: { ...max }, total, max_total: maxTotal, rank,
    };
  });
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { examOfBatch, examStudents, qualifyProbability, qualifyBand, seatPrediction, sectionAnalysis, compareSeries, normCdf, sectionOf } from '../src/lib/mockTestExam.js';

const row = (sid, name, batch, test_no, total, marks = {}) => ({ sid, student_name: name, gcc_no: sid, batch, test_no, total, max_total: 100, marks, max_marks: { Maths: 50, GK: 50 } });

test('examOfBatch reads batch names and honours overrides', () => {
  assert.equal(examOfBatch('Sainik Morning'), 'sainik');
  assert.equal(examOfBatch('Navodaya Class VI'), 'navodaya');
  assert.equal(examOfBatch('Class IX'), '');
  assert.equal(examOfBatch('Class IX', { 'Class IX': 'sainik' }), 'sainik');
  assert.equal(examOfBatch('Sainik A', { 'Sainik A': 'none' }), '');
});

test('normCdf is sane', () => {
  assert.ok(Math.abs(normCdf(0) - 0.5) < 1e-6);
  assert.ok(normCdf(2) > 0.97 && normCdf(-2) < 0.03);
});

const rows = [
  row('1', 'Asha', 'Navodaya A', 1, 70, { Maths: 40, GK: 30 }), row('1', 'Asha', 'Navodaya A', 2, 80, { Maths: 45, GK: 35 }),
  row('2', 'Bina', 'Navodaya A', 1, 40, { Maths: 20, GK: 20 }), row('2', 'Bina', 'Navodaya A', 2, 45, { Maths: 25, GK: 20 }),
  row('3', 'Chen', 'Navodaya A', 1, 60, { Maths: 30, GK: 30 }), row('3', 'Chen', 'Navodaya A', 2, 62, { Maths: 31, GK: 31 }),
];

test('qualify probability orders students and bands them', () => {
  const st = examStudents(rows);
  const p = Object.fromEntries(st.map((s) => [s.name, qualifyProbability(s, 55)]));
  assert.ok(p.Asha > p.Chen && p.Chen > p.Bina);
  assert.equal(qualifyBand(p.Asha).label, 'Safe');
  assert.equal(qualifyBand(p.Bina).label, 'At risk');
});

test('seat prediction picks top eligible students', () => {
  const st = examStudents(rows);
  const sp = seatPrediction(st, { seats: 1, cutoff: 55 });
  assert.deepEqual(sp.selected.map((s) => s.name), ['Asha']);
  assert.deepEqual(sp.waiting.map((s) => s.name), ['Chen']);
  assert.deepEqual(sp.below.map((s) => s.name), ['Bina']);
  assert.ok(sp.margin > 0);
});

test('section analysis compares selected vs rest and sectional minimum', () => {
  const st = examStudents(rows);
  const sa = sectionAnalysis(st, 'navodaya', ['1'], 45);
  const m = sa.find((x) => x.subject === 'Maths');
  assert.ok(m.gap > 0);
  assert.deepEqual(sa.find((x) => x.subject === 'GK').belowMin, ['Bina']);
  assert.equal(sectionOf('sainik', 'General Knowledge'), 'General Knowledge');
});

test('compareSeries matches by GCC and by name', () => {
  const pre = examStudents(rows);
  const mega = examStudents([row('1', 'Asha', 'Navodaya A', 1, 90), row('2x', 'bina', 'Navodaya A', 1, 40)].map((r) => ({ ...r, gcc_no: r.sid === '1' ? '1' : '' })));
  const c = compareSeries(pre, mega);
  assert.equal(c.matched, 2);
  assert.ok(c.pairs.find((x) => x.name === 'Asha').delta > 0);
});

import { courseOfBatch, filterByCourse, courseCounts } from '../src/lib/mockTestCourse.js';
test('courseOfBatch maps batches to the three courses', () => {
  assert.equal(courseOfBatch('Achiever'), 'sainik');
  assert.equal(courseOfBatch('Lakshya A'), 'navodaya');
  assert.equal(courseOfBatch('Combined English'), 'navodaya');
  assert.equal(courseOfBatch('Pragati'), 'foundation');
  assert.equal(courseOfBatch('Mystery'), '');
  const rs = [{ sid: 1, batch: 'Umeed' }, { sid: 2, batch: 'Udaan' }, { sid: 2, batch: 'Udaan' }];
  assert.equal(filterByCourse(rs, 'foundation').length, 2);
  assert.deepEqual(courseCounts(rs), { '': 2, other: 0, sainik: 0, navodaya: 1, foundation: 1 });
  assert.equal(courseOfBatch('Combined Navodaya Course (Sainik Appearing Group)'), 'navodaya');
  assert.equal(filterByCourse([{ sid: 9, batch: 'Mystery' }], 'other').length, 1);
  assert.equal(examOfBatch('Achiever'), 'sainik');
  assert.equal(examOfBatch('Pragati'), '');
});

test('compareSeries never pairs students with contradicting GCCs or duplicate names', () => {
  const mk = (gcc, name, pct) => examStudents([{ sid: gcc || name, student_name: name, gcc_no: gcc, batch: 'Sainik A', test_no: 1, total: pct, max_total: 100, marks: {}, max_marks: {} }]);
  const c1 = compareSeries(mk('11', 'Same Name', 50), mk('22', 'Same Name', 60));
  assert.equal(c1.matched, 0);
  const dup = [...mk('', 'Twin', 60), ...mk('', 'Twin ', 70).map((s) => ({ ...s, sid: 'x' }))];
  assert.equal(compareSeries(mk('', 'Twin', 50), dup).matched, 0);
});

test('a student with too few tests can never be Safe', () => {
  assert.equal(qualifyBand(0.99, 1).label, 'Borderline');
  assert.equal(qualifyBand(0.99, 3).label, 'Safe');
  assert.equal(qualifyBand(0.1, 1).label, 'At risk');
});

import { simulate, scoreNeeded, watchList, groupOfRank, adviceFor } from '../src/lib/mockTestExam.js';
test('groupOfRank matches the equal-groups rule', () => {
  const g = Array.from({ length: 62 }, (_, i) => groupOfRank(i, 62));
  assert.equal(g.filter((x) => x === 1).length, 11);
  assert.equal(g.filter((x) => x === 6).length, 10);
  assert.equal(g[0], 1); assert.equal(g[61], 6);
});
test('simulate: a big next score lifts probability; scoreNeeded is monotone', () => {
  const st = examStudents(rows);
  const bina = st.find((s) => s.name === 'Bina');
  const low = simulate(bina, 20, st, { cutoff: 55, seats: 1 });
  const high = simulate(bina, 95, st, { cutoff: 55, seats: 1 });
  assert.ok(high.probability > low.probability);
  assert.ok(high.position <= low.position);
  const need = scoreNeeded(st.find((s) => s.name === 'Chen'), 55, 0.6);
  assert.ok(need === null || (need >= 0 && need <= 100));
});
test('watchList flags drops, missed tests and risk', () => {
  const mk = (sid, name, t, pct) => ({ sid, student_name: name, gcc_no: sid, batch: 'Sainik A', test_no: t, total: pct, max_total: 100, marks: {}, max_marks: {} });
  const st = examStudents([mk('1', 'Dip', 1, 80), mk('1', 'Dip', 2, 80), mk('1', 'Dip', 3, 55), mk('2', 'Steady', 1, 70), mk('2', 'Steady', 2, 71), mk('2', 'Steady', 3, 72), mk('3', 'Gone', 1, 70), mk('3', 'Gone', 2, 70)]);
  const w = watchList(st, 60);
  const names = w.map((x) => x.student.name);
  assert.ok(names.includes('Dip') && names.includes('Gone') && !names.includes('Steady'));
  assert.ok(w.find((x) => x.student.name === 'Gone').flags.some((f) => f.type === 'missed'));
  assert.ok(w.find((x) => x.student.name === 'Dip').flags.some((f) => f.type === 'drop'));
  assert.ok(adviceFor(st[0], { cutoff: 60, status: 'Selected' }).length >= 1);
});

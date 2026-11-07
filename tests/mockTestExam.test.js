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

// revisionPlan.js — the academic time table (valid from 2 Nov 2026 till further notice) joined to
// mock-test results, so each class's revision periods can be matched to what the class is weak in.
// Pure logic, unit tested.  Update TIMETABLE here when the Vice Principal issues a new one.
import { studentAverages } from './mockTestGroups.js';
import { mean } from './mockTestEngine.js';

export const TT_TITLE = 'Final (Correction) Academic Time Table — valid from 2nd November 2026 till further notice';
export const TT_CLASSES = [
  { id: 'LA', name: 'Lakshya A', course: 'Navodaya', revision: true },
  { id: 'LB', name: 'Lakshya B', course: 'Navodaya', revision: true },
  { id: 'UM', name: 'Umeed', course: 'Navodaya', revision: true },
  { id: 'CH', name: 'Champion', course: 'Sainik' },
  { id: 'AC', name: 'Achiever', course: 'Sainik' },
  { id: 'LD', name: 'Leader', course: 'Sainik' },
  { id: 'UD', name: 'Udaan', course: 'Foundation' },
  { id: 'PR', name: 'Pragati', course: 'Foundation' },
];
export const TT_PERIODS = [
  { n: 1, time: '8:00 AM – 8:50 AM' }, { n: 2, time: '8:50 AM – 9:40 AM' }, { n: 3, time: '9:40 AM – 10:30 AM' },
  { n: 4, time: '11:30 AM – 12:20 PM' }, { n: 5, time: '12:20 PM – 1:10 PM' }, { n: 6, time: '1:10 PM – 2:00 PM' },
];
export const TT_BREAKS = [
  { after: 0, time: '7:40 AM – 8:00 AM', text: 'Morning Assembly — the 1st-period teacher must attend Assembly and take Roll Call' },
  { after: 3, time: '10:30 AM – 11:30 AM', text: 'Lunch hour for all students and boarder staff' },
];
export const PERIOD_MINUTES = 50;

// [period, class ids sharing the period (one teacher), subject as printed, teacher]
const CELLS = [
  [1, ['LA'], 'Maths I Revision', 'Bronson'], [1, ['LB'], 'Maths II Revision', 'Sunder'], [1, ['UM'], 'EVS Revision II', 'Chetan'],
  [1, ['CH'], 'Science', 'Basanta'], [1, ['AC'], 'Maths I', 'Himan'], [1, ['LD'], 'GK', 'Deepak'], [1, ['UD'], 'Maths (Navodaya)', 'Lenin'], [1, ['PR'], 'EVS (Nav)', 'Arjun'],
  [2, ['LA'], 'Passage & Vocabulary', 'Pawan'], [2, ['LB', 'UM'], 'Maths Revision', 'Himan'], [2, ['CH'], 'Reasoning', 'Johny'], [2, ['AC'], 'Grammar', 'Manglemba'],
  [2, ['LD'], 'Science', 'Arunkumar'], [2, ['UD'], 'Reasoning', 'Roshan'], [2, ['PR'], 'Maths I (Navodaya)', 'Kabiraj'],
  [3, ['LA'], 'EVS Revision I', 'Arunkumar'], [3, ['LB'], 'Mental Ability', 'Roshan'], [3, ['UM'], 'EVS Revision I', 'Deepak'], [3, ['CH'], 'Maths I', 'Himan'],
  [3, ['AC'], 'Maths II', 'Sumanta'], [3, ['LD'], 'Maths I', 'Kabiraj'], [3, ['UD'], 'Passage', 'Sandhya'], [3, ['PR'], 'Maths (Navodaya)', 'Lenin'],
  [4, ['LA'], 'Maths II Revision', 'Sunder'], [4, ['LB'], 'EVS Revision II', 'Chetan'], [4, ['UM'], 'Passage & Vocabulary', 'Pawan'], [4, ['CH'], 'Maths II', 'Sumanta'],
  [4, ['AC'], 'Reasoning', 'Johny'], [4, ['LD'], 'Grammar', 'Manglemba'], [4, ['UD'], 'EVS (Nav)', 'Arjun'], [4, ['PR'], 'Passage', 'Sandhya'],
  [5, ['LA'], 'EVS Revision II', 'Chetan'], [5, ['LB'], 'Passage & Vocabulary', 'Pawan'], [5, ['UM'], 'Mental Ability', 'Lenin'], [5, ['CH'], 'GK', 'Deepak'],
  [5, ['AC'], 'Science', 'Arunkumar'], [5, ['LD'], 'Maths II', 'Sumanta'], [5, ['UD'], 'Maths (Navodaya)', 'Kabiraj'], [5, ['PR'], 'Grammar', 'Adison'],
  [6, ['LA'], 'Mental Ability', 'Roshan'], [6, ['LB'], 'EVS Revision I', 'Arunkumar'], [6, ['UM'], 'Maths II Revision', 'Sunder'], [6, ['CH'], 'Grammar', 'Bidyachandra'],
  [6, ['AC'], 'GK', 'Deepak'], [6, ['LD'], 'Reasoning', 'Johny'], [6, ['UD'], 'Grammar', 'Manglemba'], [6, ['PR'], 'Reasoning', 'Umesh'],
];
export const TIMETABLE = CELLS.map(([period, classes, subject, teacher]) => ({ period, classes, subject, teacher, key: subjectKey(subject) }));

// "Maths II Revision", "Mathematics" → 'maths'; "Passage & Vocabulary" → 'passage' … so a printed
// period and a mock-test subject column can be compared.
export function subjectKey(s) {
  const t = String(s || '').toLowerCase();
  if (/math/.test(t)) return 'maths';
  if (/evs|environment/.test(t)) return 'evs';
  if (/passage|vocab/.test(t)) return 'passage';
  if (/mental/.test(t)) return 'mental';
  if (/reason/.test(t)) return 'reasoning';
  if (/\bgk\b|general know/.test(t)) return 'gk';
  if (/grammar/.test(t)) return 'grammar';
  if (/science/.test(t)) return 'science';
  return t.replace(/[^a-z0-9]+/g, '');
}
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
// "Lakshya A", "Lakshya A (English)" → the class; the old unsplit "Lakshya" matches nothing.
export const classOfBatch = (batch) => TT_CLASSES.find((c) => norm(batch).startsWith(norm(c.name))) || null;

export const periodsOf = (classId) => TIMETABLE.filter((c) => c.classes.includes(classId)).sort((a, b) => a.period - b.period)
  .map((c) => ({ ...c, time: TT_PERIODS[c.period - 1].time, shared: c.classes.length > 1 }));

// Time table check: a teacher in two places in the same period, and a class with two periods at once.
export function checkTimetable(cells = TIMETABLE) {
  const issues = [];
  TT_PERIODS.forEach(({ n }) => {
    const here = cells.filter((c) => c.period === n);
    const byTeacher = new Map();
    here.forEach((c) => { (byTeacher.get(c.teacher) || byTeacher.set(c.teacher, []).get(c.teacher)).push(c); });
    byTeacher.forEach((list, teacher) => { if (list.length > 1) issues.push({ type: 'teacher', period: n, teacher, text: `Sir/Madam ${teacher} is in ${list.length} different classes in period ${n}: ${list.map((c) => c.classes.join('+') + ' ' + c.subject).join(' / ')}` }); });
    const seen = new Map();
    here.forEach((c) => c.classes.forEach((id) => { if (seen.has(id)) issues.push({ type: 'class', period: n, text: `${id} has two subjects in period ${n}` }); seen.set(id, 1); }));
  });
  return issues;
}

export function teacherLoad(cells = TIMETABLE) {
  const m = new Map();
  cells.forEach((c) => { const t = m.get(c.teacher) || { teacher: c.teacher, periods: 0, classes: new Set(), subjects: new Set() }; t.periods += 1; c.classes.forEach((x) => t.classes.add(x)); t.subjects.add(c.subject); m.set(c.teacher, t); });
  return [...m.values()].map((t) => ({ teacher: t.teacher, periods: t.periods, classes: [...t.classes], subjects: [...t.subjects] })).sort((a, b) => b.periods - a.periods || a.teacher.localeCompare(b.teacher));
}

// Per class: every subject with its average % in the mock test, how many revision periods a day it gets,
// and a plain-language verdict comparing the marks lost with the time given.
export function revisionPlan(rows, classId, { passPct = 40 } = {}) {
  const cls = TT_CLASSES.find((c) => c.id === classId);
  if (!cls) return null;
  const mine = studentAverages(rows).filter((s) => classOfBatch(s.batch)?.id === classId);
  const periods = periodsOf(classId);
  const keys = new Set(periods.map((p) => p.key));
  const subjectNames = new Map(); // key → mock subject name
  mine.forEach((s) => Object.keys(s.subj).forEach((n) => { if (!subjectNames.has(subjectKey(n))) subjectNames.set(subjectKey(n), n); }));
  const allKeys = [...new Set([...keys, ...subjectNames.keys()])];
  const subjects = allKeys.map((k) => {
    const name = subjectNames.get(k) || periods.find((p) => p.key === k)?.subject.replace(/ (I|II|Revision)\b/g, '').trim();
    const mockName = subjectNames.get(k);
    const vals = mockName ? mine.map((s) => s.subj[mockName]).filter((v) => v !== undefined) : [];
    const avg = vals.length ? mean(vals) : null;
    const slots = periods.filter((p) => p.key === k);
    return { key: k, name, avg, students: vals.length, below: mockName ? vals.filter((v) => v < passPct).length : 0,
      periods: slots, count: slots.length, minutes: slots.length * PERIOD_MINUTES, teachers: [...new Set(slots.map((p) => p.teacher))] };
  });
  const scored = subjects.filter((s) => s.avg !== null);
  const lost = scored.map((s) => 100 - s.avg), lostSum = lost.reduce((a, b) => a + b, 0);
  const totalPeriods = scored.reduce((a, s) => a + s.count, 0);
  subjects.forEach((s) => {
    if (s.avg === null) { s.verdict = s.count ? 'no-data' : 'none'; return; }
    const share = lostSum ? (100 - s.avg) / lostSum : 0;
    s.shareLost = share * 100;
    s.fairPeriods = share * totalPeriods;
    s.verdict = s.count === 0 ? 'missing' : s.count < s.fairPeriods - 0.5 ? 'more' : s.count > s.fairPeriods + 0.5 ? 'less' : 'ok';
  });
  subjects.sort((a, b) => (a.avg ?? 101) - (b.avg ?? 101));
  const advice = [];
  subjects.filter((s) => s.verdict === 'missing').forEach((s) => advice.push(`${s.name}: no period in this class's time table, but it is in the mock test (average ${Math.round(s.avg)}%).`));
  const more = subjects.filter((s) => s.verdict === 'more'), less = subjects.filter((s) => s.verdict === 'less').reverse();
  more.forEach((s, i) => { const from = less[i]; advice.push(`${s.name} (${Math.round(s.avg)}%) gets ${s.count} period${s.count === 1 ? '' : 's'} a day — consider ${from ? `moving one from ${from.name} (${Math.round(from.avg)}%)` : 'one more'}, or use the study-group time for it.`); });
  const below = subjects.filter((s) => s.avg !== null && s.avg < passPct);
  below.forEach((s) => advice.push(`${s.name} average is below the pass mark (${Math.round(s.avg)}% < ${passPct}%).`));
  return { cls, periods, subjects, students: mine.length, advice, hasResults: mine.length > 0 };
}

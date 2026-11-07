// The three courses the institute runs — Sainik, Navodaya and Foundation — and
// the batch → course mapping used by the mock-test analyzers.
export const COURSES = [
  { id: 'sainik', label: 'Sainik', icon: '🎖️', color: '#9a3412', hint: 'Achiever · Leader · Champion' },
  { id: 'navodaya', label: 'Navodaya', icon: '🎓', color: '#0e7490', hint: 'Lakshya · Umeed · Combined' },
  { id: 'foundation', label: 'Foundation', icon: '🌱', color: '#047857', hint: 'Pragati · Udaan' },
];

export function courseOfBatch(batch) {
  const t = String(batch || '');
  if (/combined/i.test(t) && /navodaya/i.test(t)) return 'navodaya'; // "Combined Navodaya Course (Sainik Appearing Group)"
  if (/sainik|aissee|achiever|leader|champion/i.test(t)) return 'sainik';
  if (/foundation|pragati|udaan/i.test(t)) return 'foundation';
  if (/navodaya|jnv|lakshya|umeed|umed|combined/i.test(t)) return 'navodaya';
  return '';
}

export const OTHER_COURSE = { id: 'other', label: 'Other batches', icon: '🗂️', color: '#6b7280', hint: 'Not matched to a course' };
export const filterByCourse = (rows, course) => (course ? rows.filter((r) => (courseOfBatch(r.batch) || 'other') === course) : rows);
export const courseCounts = (rows) => {
  const sets = { '': new Set(), other: new Set() };
  COURSES.forEach((c) => { sets[c.id] = new Set(); });
  rows.forEach((r) => { sets[''].add(r.sid); const c = courseOfBatch(r.batch); sets[c || 'other'].add(r.sid); });
  return Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, v.size]));
};

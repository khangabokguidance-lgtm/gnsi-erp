// Pure logic for Class Material: view-only study material and test-series papers uploaded by the admin
// for classroom use, organised course → subject. No database access (unit tested).
export const COURSES = ['Navodaya', 'Sainik', 'Foundation'];
export const KINDS = [
  { id: 'material', label: 'Study material', icon: '📘' },
  { id: 'test_series', label: 'Test series', icon: '📝' },
];
export const SUBJECTS = {
  Navodaya: ['Mental Ability', 'EVS', 'Maths', 'Passage / Language', 'Hindi', 'General'],
  Sainik: ['Maths', 'Intelligence', 'English', 'GK', 'Science', 'Social Science', 'General'],
  Foundation: ['Maths', 'Science', 'Social Science', 'English', 'Reasoning', 'GK', 'General'],
};
export const MAX_BYTES = 40 * 1024 * 1024;
const OK_EXT = { pdf: 'pdf', png: 'image', jpg: 'image', jpeg: 'image', webp: 'image' };

export const extOf = (name) => String(name || '').toLowerCase().split('.').pop();
export const fileTypeOf = (name) => OK_EXT[extOf(name)] || '';

// Validate a draft before upload. → { ok, error?, row? }
export function buildMaterial(d, file, who) {
  const title = String(d.title || '').trim();
  if (!title) return { ok: false, error: 'Give the material a title.' };
  if (!COURSES.includes(d.course)) return { ok: false, error: 'Choose a course.' };
  const subject = String(d.subject || '').trim();
  if (!subject) return { ok: false, error: 'Choose or type a subject.' };
  const kind = d.kind === 'test_series' ? 'test_series' : 'material';
  const series = String(d.series_name || '').trim();
  if (kind === 'test_series' && !series) return { ok: false, error: 'Give the test series a name, e.g. “Navodaya Series 2026”.' };
  if (!file) return { ok: false, error: 'Choose a PDF or image to upload.' };
  const type = fileTypeOf(file.name);
  if (!type) return { ok: false, error: 'Only PDF, PNG, JPG or WEBP files can be shown here.' };
  if (file.size > MAX_BYTES) return { ok: false, error: `File is too large (max ${Math.round(MAX_BYTES / 1048576)} MB).` };
  const testNo = d.test_no === '' || d.test_no === undefined || d.test_no === null ? null : Number(d.test_no);
  if (kind === 'test_series' && testNo !== null && (!Number.isFinite(testNo) || testNo < 1)) return { ok: false, error: 'Test number must be 1 or more.' };
  return { ok: true, row: {
    kind, course: d.course, batch: d.batch || '', subject, title,
    series_name: kind === 'test_series' ? series : '', test_no: kind === 'test_series' ? testNo : null,
    description: String(d.description || '').trim(), file_name: file.name, file_type: type, file_size: file.size,
    uploaded_by: who || '', active: true,
  } };
}

// Storage path: no spaces / odd characters, unique per upload.
export const storagePath = (course, subject, fileName, stamp = Date.now()) => {
  const clean = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x';
  const ext = extOf(fileName);
  return `${clean(course)}/${clean(subject)}/${stamp}-${clean(String(fileName).replace(/\.[^.]+$/, ''))}.${ext}`;
};

const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
// Subject cards for the browse screen: [{ subject, materials, tests }] sorted by name.
export function subjectSummary(rows, course, batch = '') {
  const m = new Map();
  rows.filter((r) => r.course === course && r.active !== false && (!batch || !r.batch || r.batch === batch)).forEach((r) => {
    const s = m.get(r.subject) || { subject: r.subject, materials: 0, tests: 0 };
    if (r.kind === 'test_series') s.tests += 1; else s.materials += 1;
    m.set(r.subject, s);
  });
  return [...m.values()].sort((a, b) => natural(a.subject, b.subject));
}
// Everything inside one subject: material list + test series grouped by series name, tests in order.
export function subjectContent(rows, course, subject, batch = '') {
  const here = rows.filter((r) => r.course === course && r.subject === subject && r.active !== false && (!batch || !r.batch || r.batch === batch));
  const materials = here.filter((r) => r.kind !== 'test_series').sort((a, b) => natural(a.title, b.title));
  const bySeries = new Map();
  here.filter((r) => r.kind === 'test_series').forEach((r) => { (bySeries.get(r.series_name) || bySeries.set(r.series_name, []).get(r.series_name)).push(r); });
  const series = [...bySeries.entries()].map(([name, tests]) => ({ name, tests: tests.sort((a, b) => (a.test_no ?? 1e9) - (b.test_no ?? 1e9) || natural(a.title, b.title)) })).sort((a, b) => natural(a.name, b.name));
  return { materials, series };
}
export const searchRows = (rows, q) => {
  const t = String(q || '').trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) => [r.title, r.subject, r.series_name, r.description, r.course, r.batch].some((x) => String(x || '').toLowerCase().includes(t)));
};
export const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB');

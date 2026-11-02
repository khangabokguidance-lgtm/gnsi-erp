// Pure logic for the Checklist "Today" tool (no database access, unit tested).
export const COURSES = ['Navodaya', 'Sainik', 'Foundation'];

// ── pure helpers ──
const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export function shiftDate(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days));
}
export function dayLabel(key, today = dateKey()) {
  if (key === today) return 'Today';
  if (key === shiftDate(today, 1)) return 'Tomorrow';
  if (key === shiftDate(today, -1)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}
const norm = (s) => String(s || '').trim().toLowerCase();
export const sameOwner = (row, who) => norm(row.owner_name) === norm(who);

// Normalise a user-typed link (adds https:// when missing; rejects non-web schemes).
export function cleanUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^(javascript|data|vbscript):/i.test(s)) return '';
  return /^https?:\/\//i.test(s) ? s : 'https://' + s;
}

// Validate + shape a task draft. → { ok, error?, row? }
export function buildTask(d, who, date) {
  const title = String(d.title || '').trim();
  if (!title) return { ok: false, error: 'Write what needs to be done.' };
  if (!COURSES.includes(d.course)) return { ok: false, error: 'Choose a course.' };
  return { ok: true, row: {
    task_date: date, owner_name: who, course: d.course, batch: d.batch || '', subject: String(d.subject || '').trim(),
    title, notes: String(d.notes || '').trim(), done: false, done_at: null,
  } };
}

export function buildMaterial(d, who, date) {
  const title = String(d.title || '').trim();
  if (!title) return { ok: false, error: 'Give the material a title.' };
  if (!COURSES.includes(d.course)) return { ok: false, error: 'Choose a course.' };
  const kind = d.kind || 'note';
  let url = '', body = '';
  if (kind === 'link') { url = cleanUrl(d.url); if (!url) return { ok: false, error: 'Paste a valid link.' }; }
  else if (kind === 'file') { url = String(d.url || ''); if (!url) return { ok: false, error: 'Choose a file to upload.' }; }
  else { body = String(d.body || '').trim(); if (!body) return { ok: false, error: 'Write the note.' }; }
  return { ok: true, row: {
    task_date: date, owner_name: who, course: d.course, batch: d.batch || '', subject: String(d.subject || '').trim(),
    title, kind, url, body, file_name: kind === 'file' ? (d.file_name || '') : '', task_id: d.task_id || null,
  } };
}

// Group rows by course (fixed order) → [{course, tasks, mats, done, total}]
export function groupByCourse(tasks, mats, courseFilter = 'All') {
  return COURSES.filter((c) => courseFilter === 'All' || c === courseFilter).map((course) => {
    const t = tasks.filter((x) => x.course === course);
    const m = mats.filter((x) => x.course === course);
    return { course, tasks: t, mats: m, done: t.filter((x) => x.done).length, total: t.length };
  }).filter((g) => g.tasks.length || g.mats.length);
}

export function progress(tasks) {
  const total = tasks.length, done = tasks.filter((t) => t.done).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

// Copy the unfinished tasks of one day to another (skips ones already there).
export function carryOver(tasks, toDate) {
  return tasks.filter((t) => !t.done).map((t) => ({
    task_date: toDate, owner_name: t.owner_name, course: t.course, batch: t.batch, subject: t.subject,
    title: t.title, notes: t.notes, done: false, done_at: null,
  }));
}
export function dropDuplicates(newRows, existing) {
  const key = (t) => [t.course, t.batch, t.subject, norm(t.title)].join('\u0001');
  const have = new Set(existing.map(key));
  return newRows.filter((r) => !have.has(key(r)));
}


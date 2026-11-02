// mockTestDuty.js — the Duty Desk logic (pure, no React).
//
// A duty person (House Master / Mistress or teacher) is assigned to self-study groups, per subject ("basis").
// collectDuties walks every basis, drops the students a teacher has removed, and gathers — per person — every
// group they are on duty for, plus the manually built groups they look after. That is what a duty sheet prints.
import { classGroups, studentAverages } from './mockTestGroups.js';
import { pickInstruction } from './dutyInstruction.js';

const norm = (s) => String(s ?? '').trim().toLowerCase();
export const sameName = (a, b) => !!norm(a) && norm(a) === norm(b);
export const initials = (name) => String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

// A student as shown on a duty list.
const studentRow = (s, basis, hmOf) => {
  const h = hmOf ? hmOf(s.gcc) : { house: '', label: '' };
  const score = basis ? (s.subj?.[basis] ?? null) : s.avg;
  return { sid: s.sid, name: s.name, gcc: s.gcc, class: s.batch, score, overall: s.overall ?? s.avg, weakest: s.weakest || '', house: h.house || '', hm: h.label || '', manual: !!s.manual };
};

// ── assignments are saved against a "scope": one class ("class:Lakshya A") or a mix of classes
//    ("mix:all", "mix:English", "mix:all:Lakshya A~Umeed"). The duty desk is built from the saved assignments
//    themselves, so it never depends on which layout or filter happens to be on screen.
export const mixScope = (language, classes = []) => `mix:${language || 'all'}${classes.length ? `:${[...classes].sort().join('~')}` : ''}`;
export function parseScope(scope) {
  const sc = String(scope || '');
  if (sc.startsWith('class:')) return { mix: false, batch: sc.slice(6), language: '', classes: [] };
  const [, lang = 'all', list = ''] = sc.split(':');
  return { mix: true, batch: '', language: lang === 'all' ? '' : lang, classes: list ? list.split('~') : [] };
}
// the saved assignment map { 'basis|scope|grp': { name, title, ...instruction } } as a list
export function assignmentsFrom(mentors) {
  return Object.entries(mentors || {}).map(([key, mentor]) => {
    const parts = key.split('|');
    const grp = Number(parts[parts.length - 1]);
    const basis = parts[0] === 'overall' ? '' : parts[0];
    return { basis, scope: parts.slice(1, -1).join('|'), grp, mentor };
  }).filter((a) => a.mentor && a.mentor.name && Number.isInteger(a.grp));
}
const scopeLabel = (c, scope) => {
  if (!c.mixed) return c.batch;
  const { language, classes } = parseScope(scope);
  return `Mixed classes · ${language || 'all languages'}${classes.length ? ` (${classes.join(' + ')})` : ''}`;
};

// assignments: assignmentsFrom(mentors)
// optsFor(basis, scope) → classGroups options for that assignment's view (mode, top-N, manual moves, language, classes…)
// removedFor(basis)     → { [sid]: … } students taken out of that basis' groups
// custom                → [{ id, name, basis, dutyName, dutyTitle, students: [sid], … }]
export function collectDuties({ rows, assignments, optsFor, removedFor, custom = [], hmOf }) {
  const people = new Map();
  const person = (name, title) => {
    const k = norm(name);
    if (!people.has(k)) people.set(k, { name, title: title || '', sections: [] });
    const p = people.get(k);
    if (!p.title && title) p.title = title;
    return p;
  };
  const computed = new Map();   // `${basis}|${scope}` → the groups of that view (worked out once)
  assignments.forEach((a) => {
    const ck = `${a.basis}|${a.scope}`;
    if (!computed.has(ck)) {
      const gone = removedFor ? removedFor(a.basis) || {} : {};
      computed.set(ck, classGroups(rows.filter((r) => !gone[r.sid]), optsFor(a.basis, a.scope)));
    }
    computed.get(ck).forEach((c) => {
      const g = c.groups.find((x) => x.no === a.grp);
      if (!g || !g.n) return;
      person(a.mentor.name, a.mentor.title).sections.push({
        kind: 'group', id: `${a.basis}|${a.scope}|${g.no}`, scope: a.scope, basis: a.basis, subject: a.basis || 'Overall marks',
        set: c.batch, mixed: !!c.mixed, group: g.no, tag: g.tag, color: g.color, label: `${scopeLabel(c, a.scope)} · Group ${g.no} · ${g.tag}`,
        students: g.students.map((s) => studentRow(s, a.basis, hmOf)), instruction: pickInstruction(a.mentor),
      });
    });
  });
  const index = new Map(studentAverages(rows).map((s) => [s.sid, s]));
  custom.forEach((cg) => {
    if (!cg.dutyName) return;
    const students = cg.students.map((sid) => index.get(sid)).filter(Boolean).map((s) => studentRow(s, cg.basis, hmOf));
    person(cg.dutyName, cg.dutyTitle).sections.push({
      kind: 'custom', id: cg.id, scope: '', basis: cg.basis || '', subject: cg.basis || 'Overall marks', set: 'Manual group', mixed: false,
      group: 0, tag: 'Manual', color: '#7c3aed', label: cg.name, note: cg.note || '', students,
      // an older group may only have a free-text note: that note is its instruction
      instruction: (() => { const d = pickInstruction(cg); return d.instruction || !cg.note ? d : { ...d, instruction: String(cg.note).trim() }; })(),
    });
  });
  return [...people.values()].map((p) => ({
    ...p,
    groups: p.sections.length,
    students: new Set(p.sections.flatMap((s) => s.students.map((x) => x.sid))).size,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// The removed students as a list (for the "removed / transferred out" strip and the duty sheet).
// removed: { [basis]: { [sid]: { reason, by, at } } }
export function removedList(removed, rows) {
  const index = new Map(studentAverages(rows).map((s) => [s.sid, s]));
  return Object.entries(removed || {}).flatMap(([basis, m]) => Object.entries(m || {}).map(([sid, info]) => {
    const s = index.get(sid);
    return { basis: basis === 'overall' ? '' : basis, sid, name: s?.name || sid, gcc: s?.gcc || '', class: s?.batch || '', reason: info.reason || '', by: info.by || '', at: info.at || '' };
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// May this user change a group's students? Admins always; otherwise only the person on duty for it.
// The user is matched to the duty person by name, or by their Staff Record id when both are known.
export const mayAct = ({ canEdit, userName, dutyName, userStaffId = null, dutyStaffId = null }) =>
  !!canEdit || sameName(userName, dutyName) || (userStaffId !== null && userStaffId !== undefined && dutyStaffId !== null && dutyStaffId !== undefined && String(userStaffId) === String(dutyStaffId));

// Keep only the duties for the chosen subjects ("Overall marks" or a subject name); [] keeps everything.
// People left with no duty are dropped and every person's counts are recomputed.
export function filterDutiesBySubjects(duties, subjects = []) {
  if (!subjects.length) return duties;
  return duties
    .map((p) => {
      const sections = p.sections.filter((x) => subjects.includes(x.subject));
      return { ...p, sections, groups: sections.length, students: new Set(sections.flatMap((x) => x.students.map((y) => y.sid))).size };
    })
    .filter((p) => p.sections.length);
}

// The subjects that appear in the duties — "Overall marks" first, then alphabetical.
export const dutySubjects = (duties) => [...new Set(duties.flatMap((p) => p.sections.map((x) => x.subject)))]
  .sort((a, b) => (b === 'Overall marks') - (a === 'Overall marks') || a.localeCompare(b));

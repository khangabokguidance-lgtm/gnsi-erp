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

// bases: ['' (overall), 'Mathematics', …]
// optsFor(basis)      → classGroups options (language, layout, top-N, manual moves…) for that basis
// mentorFor(basis, c, g) → { name, title } | null     (who is on duty for that group)
// removedFor(basis)   → { [sid]: … } students taken out of that basis' groups
// custom              → [{ id, name, basis, dutyName, dutyTitle, students: [sid], note }]
export function collectDuties({ rows, bases, optsFor, mentorFor, removedFor, custom = [], hmOf }) {
  const people = new Map();
  const person = (name, title) => {
    const k = norm(name);
    if (!people.has(k)) people.set(k, { name, title: title || '', sections: [] });
    const p = people.get(k);
    if (!p.title && title) p.title = title;
    return p;
  };
  bases.forEach((basis) => {
    const gone = removedFor ? removedFor(basis) || {} : {};
    const kept = rows.filter((r) => !gone[r.sid]);
    classGroups(kept, optsFor(basis)).forEach((c) => c.groups.forEach((g) => {
      if (!g.n) return;
      const m = mentorFor(basis, c, g);
      if (!m || !m.name) return;
      person(m.name, m.title).sections.push({
        kind: 'group', id: `${basis}|${c.batch}|${g.no}`, basis, subject: basis || 'Overall marks', set: c.batch, mixed: !!c.mixed,
        group: g.no, tag: g.tag, color: g.color, label: `${c.batch} · Group ${g.no} · ${g.tag}`,
        students: g.students.map((s) => studentRow(s, basis, hmOf)), instruction: pickInstruction(m),
      });
    }));
  });
  const index = new Map(studentAverages(rows).map((s) => [s.sid, s]));
  custom.forEach((cg) => {
    if (!cg.dutyName) return;
    const students = cg.students.map((sid) => index.get(sid)).filter(Boolean).map((s) => studentRow(s, cg.basis, hmOf));
    person(cg.dutyName, cg.dutyTitle).sections.push({
      kind: 'custom', id: cg.id, basis: cg.basis || '', subject: cg.basis || 'Overall marks', set: 'Manual group', mixed: false,
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

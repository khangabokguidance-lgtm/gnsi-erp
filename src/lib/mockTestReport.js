// mockTestReport.js — smart report generator for the Self-Study Groups (pure, no React).
//
// Works on the groups currently in view (language / class / house / basis / top-N / manual moves already applied),
// flattens them into one record per student, then:
//   applyReportFilter  advanced filters on top of the view
//   buildReport        one of six report types → { title, columns, rows }
//   smartInsights      plain-language findings (weak subject, below pass mark, who is declining, unassigned groups…)
import { mean } from './mockTestEngine.js';
import { pickInstruction, slotText } from './dutyInstruction.js';

export const REPORT_TYPES = [
  { id: 'roster', label: 'Group roster', hint: 'Every student with group, house, House Master / Mistress, weakest subject and trend' },
  { id: 'cards', label: 'Student study cards', hint: 'One card per student: marks by subject, study focus and the person on duty' },
  { id: 'summary', label: 'Group summary', hint: 'Per group: students, average, range, focus subject, below pass mark, who is on duty' },
  { id: 'subjects', label: 'Subject-wise matrix', hint: 'Average % in every subject, group by group' },
  { id: 'mentors', label: 'Duty roster — who supervises which subject', hint: 'Every person on duty with the SUBJECT they supervise study duty for, the group, where, when and why' },
  { id: 'moves', label: 'Manual moves', hint: 'Students an admin moved away from their automatic group' },
];

// A student is improving / declining when the trend moves by at least this many percentage points per test.
export const TREND_STEP = 1;
export const trendLabel = (t) => (t === null || t === undefined ? '' : t >= TREND_STEP ? 'Improving' : t <= -TREND_STEP ? 'Declining' : 'Steady');

const r1 = (n) => (n === null || n === undefined || !Number.isFinite(n) ? null : Math.round(n * 10) / 10);
const NONE = '__none';
export { NONE as NOT_ASSIGNED };

export const emptyReportFilter = () => ({
  groupFrom: 1, groupTo: 7, classes: [], house: '', hm: '', mentor: '', weakest: '', trend: '',
  scoreMin: '', scoreMax: '', minTests: '', belowPass: false, manualOnly: false, q: '', sort: 'group', dutySubject: '',
});
const numOrNull = (v) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));
export function isReportFilterActive(f) {
  const e = emptyReportFilter();
  return Object.keys(e).some((k) => k !== 'sort' && JSON.stringify(f[k]) !== JSON.stringify(e[k]));
}

// One record per student in the groups on screen.
// ctx: { hmOf(gcc) → { house, label }, mentorOf(set, group) → { name } | null, autoGroupOf(sid, set) → number | null, basis, passPct }
export function recordsFrom(classes, ctx) {
  const { hmOf, mentorOf, autoGroupOf, basis = '', passPct = 40 } = ctx;
  return classes.flatMap((c) => c.groups.flatMap((g) => g.students.map((s) => {
    const h = hmOf ? hmOf(s.gcc) : { house: '', label: '' };
    const t = basis ? (s.trendSubj?.[basis] ?? null) : (s.trend ?? null);
    return {
      sid: s.sid, set: c.batch, mixed: !!c.mixed, language: c.language || '', class: s.batch, group: g.no, tag: g.tag,
      name: s.name, gcc: s.gcc, score: s.avg, overall: s.overall, subj: s.subj || {}, tests: s.tests,
      weakest: s.weakest || '', strongest: s.strongest || '', trend: t, trendText: trendLabel(t),
      manual: !!s.manual, autoGroup: autoGroupOf ? autoGroupOf(s.sid, c) : null,
      house: h.house || '', hm: h.label || '', mentor: mentorOf?.(c, g)?.name || '', mentorTitle: mentorOf?.(c, g)?.title || '', instruction: pickInstruction(mentorOf?.(c, g)), focus: g.focus || '',
      below: s.avg < passPct,
    };
  })));
}

export function applyReportFilter(records, f) {
  const lo = numOrNull(f.scoreMin), hi = numOrNull(f.scoreMax), mt = numOrNull(f.minTests);
  const q = String(f.q || '').trim().toLowerCase();
  return records.filter((r) => {
    if (r.group < f.groupFrom || r.group > f.groupTo) return false;
    if (f.classes.length && !f.classes.includes(r.class)) return false;
    if (f.house && r.house !== f.house) return false;
    if (f.hm && r.hm !== f.hm) return false;
    if (f.mentor === NONE ? r.mentor : (f.mentor && r.mentor !== f.mentor)) return false;
    if (f.weakest && r.weakest !== f.weakest) return false;
    if (f.trend && r.trendText !== f.trend) return false;
    if (lo !== null && r.score < lo) return false;
    if (hi !== null && r.score > hi) return false;
    if (mt !== null && r.tests < mt) return false;
    if (f.belowPass && !r.below) return false;
    if (f.manualOnly && !r.manual) return false;
    if (q && !`${r.name} ${r.gcc}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

const byName = (a, b) => String(a.name).localeCompare(String(b.name));
const SORTS = {
  group: (a, b) => a.group - b.group || a.score - b.score || byName(a, b),
  scoreAsc: (a, b) => a.score - b.score || byName(a, b),
  scoreDesc: (a, b) => b.score - a.score || byName(a, b),
  name: byName,
  class: (a, b) => String(a.class).localeCompare(String(b.class)) || a.group - b.group || byName(a, b),
  trendAsc: (a, b) => (a.trend ?? 0) - (b.trend ?? 0) || byName(a, b),
  trendDesc: (a, b) => (b.trend ?? 0) - (a.trend ?? 0) || byName(a, b),
};
export const SORT_OPTIONS = [['group', 'Group, then marks'], ['scoreAsc', 'Marks — lowest first'], ['scoreDesc', 'Marks — highest first'], ['name', 'Name'], ['class', 'Class'], ['trendAsc', 'Trend — most declining first'], ['trendDesc', 'Trend — most improving first']];
export const sortRecords = (records, sort = 'group') => [...records].sort(SORTS[sort] || SORTS.group);

// Quick, ready-made reports: they set the type and the filters.
export const QUICK_REPORTS = [
  { id: 'support', label: 'Needs support', type: 'roster', filter: { groupFrom: 1, groupTo: 2, sort: 'scoreAsc' } },
  { id: 'top', label: 'Top group', type: 'roster', filter: { groupFrom: 7, groupTo: 7, sort: 'scoreDesc' } },
  { id: 'belowpass', label: 'Below pass mark', type: 'cards', filter: { belowPass: true, sort: 'scoreAsc' } },
  { id: 'declining', label: 'Declining students', type: 'roster', filter: { trend: 'Declining', sort: 'trendAsc' } },
  { id: 'improving', label: 'Most improved', type: 'roster', filter: { trend: 'Improving', sort: 'trendDesc' } },
  { id: 'moved', label: 'Moved by admin', type: 'moves', filter: { manualOnly: true } },
  { id: 'dutyroster', label: 'Who supervises which subject', type: 'mentors', filter: {} },
  { id: 'nomentor', label: 'Nobody on duty', type: 'summary', filter: { mentor: NONE } },
];

const gLabel = (r) => `Group ${r.group} · ${r.tag}`;
const focusText = (r) => Object.entries(r.subj).sort((a, b) => a[1] - b[1]).slice(0, 2).map(([s, v]) => `${s} (${Math.round(v)}%)`).join(', ');
const subjectsIn = (records) => [...new Set(records.flatMap((r) => Object.keys(r.subj)))];
const avgOf = (rs, get) => { const v = rs.map(get).filter((x) => x !== null && x !== undefined); return v.length ? mean(v) : null; };
const lowestSubject = (rs) => {
  const t = subjectsIn(rs).map((s) => [s, avgOf(rs, (r) => r.subj[s] ?? null)]).filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1]);
  return t[0] ? { subject: t[0][0], pct: t[0][1] } : null;
};
const cols = (...pairs) => pairs.map(([key, label]) => ({ key, label }));

// groups records into (set, group) buckets, in group order
const buckets = (records) => {
  const m = new Map();
  records.forEach((r) => { const k = `${r.set}|${r.group}`; if (!m.has(k)) m.set(k, { set: r.set, group: r.group, tag: r.tag, rs: [] }); m.get(k).rs.push(r); });
  return [...m.values()].sort((a, b) => a.set.localeCompare(b.set) || a.group - b.group);
};

const SUBJECT_FIRST = (a, b) => (b === 'Overall marks') - (a === 'Overall marks') || String(a).localeCompare(String(b));

// One row per (person on duty, subject, group) across EVERY subject — what each person supervises.
// duties: collectDuties(...) result. Filters used: person (mentor), supervised subject (dutySubject), group range, classes.
export function dutyRows(duties, f = emptyReportFilter(), passPct = 40) {
  const out = [];
  (duties || []).forEach((p) => {
    if (f.mentor && f.mentor !== NONE && p.name !== f.mentor) return;
    p.sections.forEach((sec) => {
      if (f.dutySubject && sec.subject !== f.dutySubject) return;
      if (sec.kind === 'group' && (sec.group < f.groupFrom || sec.group > f.groupTo)) return;
      if (f.classes.length && sec.kind === 'group' && !sec.mixed && !f.classes.includes(sec.set)) return;
      const scores = sec.students.map((x) => x.score).filter((v) => v !== null && v !== undefined);
      const d = pickInstruction(sec.instruction);
      out.push({
        person: p.name, title: p.title || '', subject: sec.subject, label: sec.label, set: sec.set, kind: sec.kind, group: sec.group,
        students: sec.students.length, avg: scores.length ? mean(scores) : null, below: scores.filter((v) => v < passPct).length,
        venue: d.venue, slot: slotText(d), reason: d.reason, instruction: d.instruction,
      });
    });
  });
  return out.sort((a, b) => a.person.localeCompare(b.person) || SUBJECT_FIRST(a.subject, b.subject) || a.group - b.group || a.label.localeCompare(b.label));
}

export function buildReport(type, records, ctx = {}) {
  const basisName = ctx.basis || 'Average';
  const dutySubject = ctx.basis || 'Overall marks';
  const dutyText = (r) => (r.mentor ? `${r.mentor} — ${dutySubject}` : 'not assigned');
  const recs = records;
  if (type === 'cards') {
    const subs = subjectsIn(recs);
    return {
      type, title: 'Student study cards', groupBy: 'Group',
      columns: cols(['Group', 'Group'], ['Class', 'Class'], ['GCC', 'GCC'], ['Name', 'Name'], [basisName + ' %', `${basisName} %`], ...subs.map((s) => [s + ' %', `${s} %`]), ['Study focus', 'Study focus'], ['Trend', 'Trend'], ['House', 'House'], ['House Master / Mistress', 'House Master / Mistress'], ['On duty (subject)', 'On duty (subject)']),
      rows: recs.map((r) => ({ Group: gLabel(r), Class: r.class, GCC: r.gcc, Name: r.name, [basisName + ' %']: r1(r.score), ...Object.fromEntries(subs.map((s) => [s + ' %', r1(r.subj[s] ?? null)])), 'Study focus': focusText(r) || '—', Trend: r.trendText || '—', House: r.house || '—', 'House Master / Mistress': r.hm || '—', 'On duty (subject)': dutyText(r) })),
      cards: recs, subjects: subs,
    };
  }
  if (type === 'summary') {
    return {
      type, title: 'Group summary',
      columns: cols(['Class / set', 'Class / set'], ['Group', 'Group'], ['Students', 'Students'], [`Average %`, 'Average %'], ['Lowest %', 'Lowest %'], ['Highest %', 'Highest %'], ['Below pass', 'Below pass mark'], ['Declining', 'Declining'], ['Focus subject', 'Focus subject'], ['Moved by admin', 'Moved by admin'], ['On duty (subject)', 'On duty (subject)']),
      rows: buckets(recs).map(({ set, group, tag, rs }) => { const low = lowestSubject(rs); return { 'Class / set': set, Group: `Group ${group} · ${tag}`, Students: rs.length, 'Average %': r1(avgOf(rs, (r) => r.score)), 'Lowest %': r1(Math.min(...rs.map((r) => r.score))), 'Highest %': r1(Math.max(...rs.map((r) => r.score))), 'Below pass': rs.filter((r) => r.below).length, Declining: rs.filter((r) => r.trendText === 'Declining').length, 'Focus subject': low ? `${low.subject} (${Math.round(low.pct)}%)` : '—', 'Moved by admin': rs.filter((r) => r.manual).length, 'On duty (subject)': rs[0].mentor ? `${rs[0].mentor} — ${dutySubject}` : 'not assigned' }; }),
    };
  }
  if (type === 'subjects') {
    const subs = subjectsIn(recs);
    return {
      type, title: 'Subject-wise matrix', heat: subs,
      columns: cols(['Class / set', 'Class / set'], ['Group', 'Group'], ['Students', 'Students'], ...subs.map((s) => [s, `${s} %`]), ['Weakest', 'Weakest subject']),
      rows: buckets(recs).map(({ set, group, tag, rs }) => { const low = lowestSubject(rs); return { 'Class / set': set, Group: `Group ${group} · ${tag}`, Students: rs.length, ...Object.fromEntries(subs.map((s) => [s, r1(avgOf(rs, (r) => r.subj[s] ?? null))])), Weakest: low ? low.subject : '—' }; }),
    };
  }
  if (type === 'mentors' && ctx.duties) {
    const rows = dutyRows(ctx.duties, ctx.filter || emptyReportFilter(), ctx.passPct).map((r) => ({
      'Person on duty': `${r.person}${r.title ? ` (${r.title})` : ''}`, 'Supervises study duty for': r.subject, Group: r.label, 'Class / set': r.set, Students: r.students,
      'Average %': r1(r.avg), 'Below pass': r.below, Where: r.venue || '—', 'Days & time': r.slot || '—', Why: r.reason || '—', Instruction: r.instruction || '—',
    }));
    return {
      type, title: 'Duty roster — who supervises which subject', groupBy: 'Person on duty', dutyView: true, rows,
      columns: cols(['Person on duty', 'Person on duty'], ['Supervises study duty for', 'Supervises study duty for (subject)'], ['Group', 'Group'], ['Class / set', 'Class / set'], ['Students', 'Students'], ['Average %', 'Average %'], ['Below pass', 'Below pass mark'], ['Where', 'Where'], ['Days & time', 'Days & time'], ['Why', 'Why (reason)'], ['Instruction', 'Instruction']),
    };
  }
  if (type === 'mentors') {
    const by = new Map();
    buckets(recs).forEach((b) => { const k = b.rs[0].mentor || ''; if (!by.has(k)) by.set(k, []); by.get(k).push(b); });
    const people = [...by.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b));
    const rows = [...people, ...(by.has('') ? [''] : [])].map((name) => {
      const bs = by.get(name), rs = bs.flatMap((b) => b.rs);
      const title = bs[0].rs[0].mentorTitle || '';
      const isHouse = /^house/i.test(title);
      const details = bs.map((b) => { const d = b.rs[0].instruction; return [d.venue && `Where: ${d.venue}`, slotText(d) && `When: ${slotText(d)}`, d.reason && `Why: ${d.reason}`].filter(Boolean).length ? `${b.set} · G${b.group} — ${[d.venue && `Where: ${d.venue}`, slotText(d) && `When: ${slotText(d)}`, d.reason && `Why: ${d.reason}`].filter(Boolean).join(' · ')}` : ''; }).filter(Boolean).join(' | ');
      return { Person: name ? `${name}${title ? ` (${title})` : ''}` : 'Nobody on duty', 'Supervises (subject)': name ? (ctx.basis || 'Overall marks') : '—', 'Groups on duty': bs.map((b) => `${b.set} · G${b.group}`).join(', '), 'Where / when / why': details || (name ? 'No instruction yet' : '—'), 'Students in those groups': rs.length, 'Average %': r1(avgOf(rs, (r) => r.score)), 'Below pass': rs.filter((r) => r.below).length, 'Students from their house': name && isHouse ? recs.filter((r) => r.hm.split(' / ').includes(name)).length : '—' };
    });
    return { type, title: 'Duty roster', columns: cols(['Person', 'On duty'], ['Supervises (subject)', 'Supervises (subject)'], ['Groups on duty', 'Groups on duty'], ['Where / when / why', 'Where / when / why'], ['Students in those groups', 'Students in those groups'], ['Average %', 'Average %'], ['Below pass', 'Below pass mark'], ['Students from their house', 'Students from their house (House Masters)']), rows };
  }
  if (type === 'moves') {
    return {
      type, title: 'Manual moves',
      columns: cols(['Name', 'Student'], ['GCC', 'GCC'], ['Class', 'Class'], ['From', 'Automatic group'], ['To', 'Group now'], [`${basisName} %`, `${basisName} %`], ['On duty (subject)', 'On duty (subject)']),
      rows: recs.filter((r) => r.manual).map((r) => ({ Name: r.name, GCC: r.gcc, Class: r.class, From: r.autoGroup ? `Group ${r.autoGroup}` : '—', To: `Group ${r.group} · ${r.tag}`, [`${basisName} %`]: r1(r.score), 'On duty (subject)': dutyText(r) })),
    };
  }
  // roster (default)
  return {
    type: 'roster', title: 'Group roster', groupBy: 'Group',
    columns: cols(['Group', 'Group'], ['Class', 'Class'], ['GCC', 'GCC'], ['Name', 'Name'], ['House', 'House'], ['House Master / Mistress', 'House Master / Mistress'], ['On duty (subject)', 'On duty (subject)'], [`${basisName} %`, `${basisName} %`], ['Weakest subject', 'Weakest subject'], ['Trend', 'Trend'], ['Moved', 'Moved by admin']),
    rows: recs.map((r) => ({ Group: gLabel(r), Class: r.class, GCC: r.gcc, Name: r.name, House: r.house || '—', 'House Master / Mistress': r.hm || '—', 'On duty (subject)': dutyText(r), [`${basisName} %`]: r1(r.score), 'Weakest subject': r.weakest || '—', Trend: r.trendText || '—', Moved: r.manual ? 'Yes' : '' })),
  };
}

// Plain-language findings about the (filtered) students.
export function smartInsights(records, { passPct = 40, basis = '', duties = null, allSubjects = [] } = {}) {
  const out = [];
  const n = records.length;
  if (!n) return ['No students match the filters.'];
  const below = records.filter((r) => r.below).length;
  out.push(`${n} student${n === 1 ? '' : 's'} · average ${r1(avgOf(records, (r) => r.score))}%${basis ? ` in ${basis}` : ''} · ${below} below the ${passPct}% pass mark (${Math.round((below / n) * 100)}%).`);
  const subs = subjectsIn(records).map((s) => [s, avgOf(records, (r) => r.subj[s] ?? null)]).filter(([, v]) => v !== null).sort((a, b) => a[1] - b[1]);
  if (!basis && subs.length > 1) out.push(`Weakest subject overall: ${subs[0][0]} (average ${r1(subs[0][1])}%). Strongest: ${subs[subs.length - 1][0]} (${r1(subs[subs.length - 1][1])}%).`);
  const weakGroups = records.filter((r) => r.group <= 2);
  if (weakGroups.length) { const low = lowestSubject(weakGroups); out.push(`Groups 1–2 hold ${weakGroups.length} student${weakGroups.length === 1 ? '' : 's'} (average ${r1(avgOf(weakGroups, (r) => r.score))}%)${low ? ` — start with ${low.subject} (${Math.round(low.pct)}%)` : ''}.`); }
  const dec = records.filter((r) => r.trendText === 'Declining').sort((a, b) => a.trend - b.trend);
  const imp = records.filter((r) => r.trendText === 'Improving').sort((a, b) => b.trend - a.trend);
  const names = (rs) => rs.slice(0, 3).map((r) => `${r.name} (${r.trend > 0 ? '+' : ''}${r1(r.trend)} pts/test)`).join(', ');
  if (dec.length) out.push(`${dec.length} declining: ${names(dec)}${dec.length > 3 ? '…' : ''}.`);
  if (imp.length) out.push(`${imp.length} improving: ${names(imp)}${imp.length > 3 ? '…' : ''}.`);
  const sets = buckets(records);
  const unassigned = sets.filter((b) => !b.rs[0].mentor).length;
  if (unassigned) out.push(`${unassigned} of ${sets.length} group${sets.length === 1 ? '' : 's'} ha${unassigned === 1 ? 's' : 've'} nobody assigned for duty yet.`);
  if (duties && duties.length) {
    const by = new Map();
    duties.forEach((p) => p.sections.forEach((sec) => { if (!by.has(sec.subject)) by.set(sec.subject, new Set()); by.get(sec.subject).add(p.name); }));
    const subjects = [...by.keys()].sort(SUBJECT_FIRST);
    out.push(`${duties.length} ${duties.length === 1 ? 'person supervises' : 'people supervise'} study duty across ${subjects.length} subject${subjects.length === 1 ? '' : 's'}: ${subjects.map((sub) => `${sub} (${[...by.get(sub)].join(', ')})`).join('; ')}.`);
    const uncovered = ['Overall marks', ...allSubjects].filter((sub) => !by.has(sub));
    if (uncovered.length) out.push(`Nobody is assigned to supervise: ${uncovered.join(', ')}.`);
  }
  const moved = records.filter((r) => r.manual).length;
  if (moved) out.push(`${moved} student${moved === 1 ? ' was' : 's were'} moved by an admin from the automatic group.`);
  return out;
}

// Short description of the active filters, for the report header ("Groups 1–2 · House Ashoka · Declining").
export function describeReportFilter(f) {
  const bits = [];
  if (f.groupFrom > 1 || f.groupTo < 7) bits.push(f.groupFrom === f.groupTo ? `Group ${f.groupFrom}` : `Groups ${f.groupFrom}–${f.groupTo}`);
  if (f.classes.length) bits.push(`Class: ${f.classes.join(', ')}`);
  if (f.house) bits.push(`House: ${f.house}`);
  if (f.hm) bits.push(`House Master/Mistress: ${f.hm}`);
  if (f.mentor) bits.push(f.mentor === NONE ? 'Nobody on duty' : `On duty: ${f.mentor}`);
  if (f.weakest) bits.push(`Weakest subject: ${f.weakest}`);
  if (f.trend) bits.push(f.trend);
  const lo = numOrNull(f.scoreMin), hi = numOrNull(f.scoreMax);
  if (lo !== null || hi !== null) bits.push(`Marks ${lo !== null ? lo : 0}%–${hi !== null ? hi : 100}%`);
  if (numOrNull(f.minTests) !== null) bits.push(`≥ ${f.minTests} tests`);
  if (f.dutySubject) bits.push(`Supervising: ${f.dutySubject}`);
  if (f.belowPass) bits.push('Below pass mark');
  if (f.manualOnly) bits.push('Moved by admin');
  if (String(f.q || '').trim()) bits.push(`Search “${String(f.q).trim()}”`);
  return bits.join(' · ') || 'No extra filters';
}

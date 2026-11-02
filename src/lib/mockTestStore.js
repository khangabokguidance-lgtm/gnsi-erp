// ─── mockTestStore.js ────────────────────────────────────────────────────────
// Persistence for the Mock Test Analyzer.  Primary store: Supabase table
// `mock_test_results` (see supabase/migrations/20261002_mock_test_results.sql).
// If that table does not exist yet, results are kept in this browser's
// localStorage instead so nothing is lost, and the screen tells the user to
// run the migration.
import { supabase } from '../supabase';
import { pickInstruction, daysToText, daysFromText } from './dutyInstruction.js';

const TABLE = 'mock_test_results';
const LS_KEY = 'gnsi_mock_test_results_v1';
const PAGE = 1000;

const lsRead = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } };
const lsWrite = (rows) => { try { localStorage.setItem(LS_KEY, JSON.stringify(rows)); return true; } catch { return false; } };

const missingTable = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(e.message || ''));

// → { rows, mode: 'cloud' | 'local', note }
export async function loadAll() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(TABLE).select('*').order('test_no').order('id').range(from, from + PAGE - 1);
    if (error) {
      if (missingTable(error)) {
        return { rows: lsRead(), mode: 'local', note: 'The mock_test_results table is not created in Supabase yet — run supabase/migrations/20261002_mock_test_results.sql. Until then results are saved in this browser only.' };
      }
      throw error;
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { rows, mode: 'cloud', note: '' };
}

// Replace every (series, test_no, batch) present in `newRows` with the new rows.
export async function saveRows(newRows, mode, who = '') {
  const stamped = newRows.map((r) => {
    const c = { ...r, uploaded_by: who || r.uploaded_by || null };
    delete c.sid; delete c.id;
    return c;
  });
  const keys = [...new Set(stamped.map((r) => `${r.series}\u0001${r.test_no}\u0001${r.batch}`))];
  if (mode === 'local') {
    const keep = lsRead().filter((r) => !keys.includes(`${r.series}\u0001${r.test_no}\u0001${r.batch}`));
    const withIds = stamped.map((r, i) => ({ ...r, id: `local-${Date.now()}-${i}` }));
    if (!lsWrite([...keep, ...withIds])) throw new Error('Browser storage is full — apply the Supabase migration to save permanently.');
    return;
  }
  for (const k of keys) {
    const [series, test_no, batch] = k.split('\u0001');
    const { error } = await supabase.from(TABLE).delete().eq('series', series).eq('test_no', Number(test_no)).eq('batch', batch);
    if (error) throw error;
  }
  for (let i = 0; i < stamped.length; i += 500) {
    const { error } = await supabase.from(TABLE).insert(stamped.slice(i, i + 500));
    if (error) throw error;
  }
}

export async function deleteTest(series, test_no, batch, mode) {
  if (mode === 'local') {
    lsWrite(lsRead().filter((r) => !(r.series === series && r.test_no === test_no && r.batch === batch)));
    return;
  }
  const { error } = await supabase.from(TABLE).delete().eq('series', series).eq('test_no', test_no).eq('batch', batch);
  if (error) throw error;
}

// Remove every saved result of one series.
export async function resetSeries(series, mode) {
  if (mode === 'local') { lsWrite(lsRead().filter((r) => r.series !== series)); return; }
  const { error } = await supabase.from(TABLE).delete().eq('series', series);
  if (error) throw error;
}

// Remove every saved result in every series (also clears any browser-saved copy).
export async function resetAll(mode) {
  if (mode !== 'local') {
    const { error } = await supabase.from(TABLE).delete().not('id', 'is', null);
    if (error) throw error;
  }
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
}

// Move anything saved locally (before the migration was applied) into Supabase.
export async function migrateLocalToCloud() {
  const local = lsRead();
  if (!local.length) return 0;
  await saveRows(local, 'cloud');
  try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  return local.length;
}
export const localCount = () => lsRead().length;

// ─── Student Data Fix Engine rules (see studentFixEngine.js) ─────────────────
// Table `mock_test_fixes`; browser fallback until the migration
// 20261003_mock_test_fixes.sql is applied.
const FIX_TABLE = 'mock_test_fixes';
const FIX_LS = 'gnsi_mock_test_fixes_v1';
const fixRead = () => { try { return JSON.parse(localStorage.getItem(FIX_LS) || '[]'); } catch { return []; } };
const fixWrite = (rules) => { try { localStorage.setItem(FIX_LS, JSON.stringify(rules)); return true; } catch { return false; } };
const fromDb = (r) => ({ ...r, group: r.grp });

// → { fixes, mode: 'cloud' | 'local' }
export async function loadFixes() {
  const { data, error } = await supabase.from(FIX_TABLE).select('*').order('created_at');
  if (error) {
    if (missingTable(error)) return { fixes: fixRead(), mode: 'local' };
    throw error;
  }
  return { fixes: data.map(fromDb), mode: 'cloud' };
}

// rules: [{series?, kind, match, changes, note, group}]
export async function saveFixes(rules, mode, who = '') {
  const stamp = new Date().toISOString();
  if (mode === 'local') {
    const withIds = rules.map((r, i) => ({ ...r, id: `local-fix-${Date.now()}-${i}`, created_at: new Date(Date.parse(stamp) + i).toISOString(), created_by: who || null }));
    if (!fixWrite([...fixRead(), ...withIds])) throw new Error('Browser storage is full — apply the Supabase migration to save fixes permanently.');
    return;
  }
  const rows = rules.map((r, i) => ({ series: r.series ?? null, kind: r.kind, match: r.match || {}, changes: r.changes || {}, note: r.note || null, grp: r.group || null, created_by: who || null, created_at: new Date(Date.parse(stamp) + i).toISOString() }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from(FIX_TABLE).insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
}

// Undo: remove every rule of a group (or one rule when it has no group).
export async function deleteFixGroup(rule, mode) {
  if (mode === 'local') {
    fixWrite(fixRead().filter((r) => (rule.group ? r.group !== rule.group : r.id !== rule.id)));
    return;
  }
  const q = supabase.from(FIX_TABLE).delete();
  const { error } = rule.group ? await q.eq('grp', rule.group) : await q.eq('id', rule.id);
  if (error) throw error;
}

// Move rules saved in this browser into Supabase (after the migration is applied).
export async function migrateLocalFixes() {
  const local = fixRead();
  if (!local.length) return 0;
  await saveFixes(local.map((r) => ({ series: r.series, kind: r.kind, match: r.match, changes: r.changes, note: r.note, group: r.group })), 'cloud');
  try { localStorage.removeItem(FIX_LS); } catch { /* ignore */ }
  return local.length;
}
export const localFixCount = () => fixRead().length;

// ─── Pass marks per series ───────────────────────────────────────────────────
// Table `mock_test_settings` (20261013_mock_test_settings.sql). A copy is always
// kept in this browser too, so the value survives while the migration is pending.
const SET_TABLE = 'mock_test_settings';
const SET_LS = 'gnsi_mock_test_settings_v1';
const setRead = () => { try { return JSON.parse(localStorage.getItem(SET_LS) || '{}') || {}; } catch { return {}; } };
const setWrite = (all) => { try { localStorage.setItem(SET_LS, JSON.stringify(all)); } catch { /* ignore */ } };

// → { settings: { [series]: { passPct, passBy } }, mode: 'cloud' | 'local' }
export async function loadSettings() {
  const local = setRead();
  const { data, error } = await supabase.from(SET_TABLE).select('*');
  if (error) {
    if (missingTable(error)) return { settings: local, mode: 'local' };
    throw error;
  }
  const settings = { ...local };
  data.forEach((r) => { settings[r.series] = { passPct: Number(r.pass_pct), passBy: r.pass_by_batch || {} }; });
  return { settings, mode: 'cloud' };
}

export async function saveSettings(series, cfg, mode, who = '') {
  setWrite({ ...setRead(), [series]: cfg });
  if (mode === 'local') return;
  const { error } = await supabase.from(SET_TABLE).upsert(
    { series, pass_pct: cfg.passPct, pass_by_batch: cfg.passBy || {}, updated_by: who || null, updated_at: new Date().toISOString() },
    { onConflict: 'series' },
  );
  if (error) throw error;
}

// ─── Manual self-study groups ────────────────────────────────────────────────
// The admin's own choice of group (1 = weakest … 7 = strongest) for a student, kept per series and per basis
// ('overall' or a subject name). Table `mock_test_study_groups` (20261049_mock_test_study_groups.sql); a copy
// is always kept in this browser too, so choices survive while the migration is pending.
const GRP_TABLE = 'mock_test_study_groups';
const GRP_LS = 'gnsi_mock_study_groups_v1';
export const GROUP_BASIS_ALL = 'overall';
const grpRead = () => { try { return JSON.parse(localStorage.getItem(GRP_LS) || '{}') || {}; } catch { return {}; } };
const grpWrite = (all) => { try { localStorage.setItem(GRP_LS, JSON.stringify(all)); } catch { /* ignore */ } };
const basisKey = (b) => b || GROUP_BASIS_ALL;

// → { choices: { [basis]: { [sid]: 1..7 } }, mode: 'cloud' | 'local' }
export async function loadGroupChoices(series) {
  const local = grpRead()[series] || {};
  const { data, error } = await supabase.from(GRP_TABLE).select('basis, student_key, grp').eq('series', series);
  if (error) {
    if (missingTable(error)) return { choices: local, mode: 'local' };
    throw error;
  }
  const choices = {};
  data.forEach((r) => { (choices[r.basis] ||= {})[r.student_key] = Number(r.grp); });
  return { choices, mode: 'cloud' };
}

// grp: 1..7, or null to remove the manual choice (back to the automatic group).
export async function saveGroupChoice(series, basis, sid, grp, mode, who = '') {
  const b = basisKey(basis);
  const all = grpRead();
  const cur = { ...(all[series] || {}) };
  const forBasis = { ...(cur[b] || {}) };
  if (grp === null) delete forBasis[sid]; else forBasis[sid] = grp;
  cur[b] = forBasis;
  grpWrite({ ...all, [series]: cur });
  if (mode === 'local') return;
  if (grp === null) {
    const { error } = await supabase.from(GRP_TABLE).delete().eq('series', series).eq('basis', b).eq('student_key', sid);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from(GRP_TABLE).upsert(
    { series, basis: b, student_key: sid, grp, updated_by: who || null, updated_at: new Date().toISOString() },
    { onConflict: 'series,basis,student_key' },
  );
  if (error) throw error;
}

// Remove every manual choice for one basis of a series.
export async function clearGroupChoices(series, basis, mode) {
  const b = basisKey(basis);
  const all = grpRead();
  if (all[series]) { const cur = { ...all[series] }; delete cur[b]; grpWrite({ ...all, [series]: cur }); }
  if (mode === 'local') return;
  const { error } = await supabase.from(GRP_TABLE).delete().eq('series', series).eq('basis', b);
  if (error) throw error;
}

// ─── House Master / Mistress assigned to a self-study group ──────────────────
// The admin picks, for each group of each subject (or overall), the House Master / Mistress who looks after it.
// Key = basis ('overall' or a subject) + set (one class, or the mixed set of a language) + group number.
// Table `mock_test_group_mentors` (20261050_mock_test_group_mentors.sql); browser copy kept as the fallback.
const MEN_TABLE = 'mock_test_group_mentors';
const MEN_LS = 'gnsi_mock_group_mentors_v1';
const menRead = () => { try { return JSON.parse(localStorage.getItem(MEN_LS) || '{}') || {}; } catch { return {}; } };
const menWrite = (all) => { try { localStorage.setItem(MEN_LS, JSON.stringify(all)); } catch { /* ignore */ } };
export const mentorKey = (basis, set, grp) => `${basis || GROUP_BASIS_ALL}|${set}|${grp}`;

// → { mentors: { [mentorKey]: { name, title } }, mode: 'cloud' | 'local' }
export async function loadGroupMentors(series) {
  const local = menRead()[series] || {};
  const { data, error } = await supabase.from(MEN_TABLE).select('*').eq('series', series);
  if (error) {
    if (missingTable(error)) return { mentors: local, mode: 'local' };
    throw error;
  }
  const mentors = {};
  data.forEach((r) => {
    const k = mentorKey(r.basis, r.scope, r.grp);
    const det = pickInstruction(r);
    const mine = local[k] && local[k].name === r.mentor_name ? pickInstruction(local[k]) : null;   // details kept in this browser while the columns are missing
    mentors[k] = { name: r.mentor_name, title: r.mentor_title || '', ...(Object.values(det).some((v) => (Array.isArray(v) ? v.length : v)) || !mine ? det : mine) };
  });
  return { mentors, mode: 'cloud' };
}

// mentor: { name, title } or null to clear.
export async function saveGroupMentor(series, basis, set, grp, mentor, mode, who = '') {
  const k = mentorKey(basis, set, grp);
  const all = menRead();
  const cur = { ...(all[series] || {}) };
  if (mentor) cur[k] = mentor; else delete cur[k];
  menWrite({ ...all, [series]: cur });
  if (mode === 'local') return;
  const b = basis || GROUP_BASIS_ALL;
  if (!mentor) {
    const { error } = await supabase.from(MEN_TABLE).delete().eq('series', series).eq('basis', b).eq('scope', set).eq('grp', grp);
    if (error) throw error;
    return;
  }
  const base = { series, basis: b, scope: set, grp, mentor_name: mentor.name, mentor_title: mentor.title || null, updated_by: who || null, updated_at: new Date().toISOString() };
  const d = pickInstruction(mentor);
  const full = { ...base, venue: d.venue || null, reason: d.reason || null, days: daysToText(d.days) || null, time_from: d.from || null, time_to: d.to || null, instruction: d.instruction || null };
  let { error } = await supabase.from(MEN_TABLE).upsert(full, { onConflict: 'series,basis,scope,grp' });
  // the instruction columns come with migration 20261053: until then the name is saved and the instruction stays in this browser
  if (error && /column|schema cache/i.test(error.message || '')) ({ error } = await supabase.from(MEN_TABLE).upsert(base, { onConflict: 'series,basis,scope,grp' }));
  if (error) throw error;
}

// ─── Language of each class (English / Meitei Mayek) ─────────────────────────
// The admin's own setting, used by the Self-Study Groups language filter. It wins over the language guessed from
// the class name, and applies to every series (a class keeps its language). Table `mock_test_class_languages`
// (20261051_mock_test_class_languages.sql); browser copy kept as the fallback.
const LANG_TABLE = 'mock_test_class_languages';
const LANG_LS = 'gnsi_mock_class_languages_v1';
const langRead = () => { try { return JSON.parse(localStorage.getItem(LANG_LS) || '{}') || {}; } catch { return {}; } };
const langWrite = (all) => { try { localStorage.setItem(LANG_LS, JSON.stringify(all)); } catch { /* ignore */ } };

// → { languages: { [class]: 'English' | 'Meitei Mayek' }, mode: 'cloud' | 'local' }
export async function loadClassLanguages() {
  const local = langRead();
  const { data, error } = await supabase.from(LANG_TABLE).select('batch, language');
  if (error) {
    if (missingTable(error)) return { languages: local, mode: 'local' };
    throw error;
  }
  return { languages: Object.fromEntries(data.map((r) => [r.batch, r.language])), mode: 'cloud' };
}

// language: 'English' | 'Meitei Mayek', or null to go back to the language guessed from the class name.
export async function saveClassLanguage(batch, language, mode, who = '') {
  const all = { ...langRead() };
  if (language) all[batch] = language; else delete all[batch];
  langWrite(all);
  if (mode === 'local') return;
  if (!language) {
    const { error } = await supabase.from(LANG_TABLE).delete().eq('batch', batch);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from(LANG_TABLE).upsert(
    { batch, language, updated_by: who || null, updated_at: new Date().toISOString() },
    { onConflict: 'batch' },
  );
  if (error) throw error;
}

// ─── Duty desk: students removed from a group, and manually built groups ─────
// removed: a teacher/admin takes a student out of the self-study groups (kept per series + basis, restorable).
// custom : a group built from a manual choice of students, with its own name, duty person and student list.
// Tables `mock_test_removed_students` and `mock_test_custom_groups` (20261052_mock_test_duty_desk.sql);
// browser copies are kept as the fallback while the migration is pending.
const REM_TABLE = 'mock_test_removed_students';
const REM_LS = 'gnsi_mock_removed_students_v1';
const CUS_TABLE = 'mock_test_custom_groups';
const CUS_LS = 'gnsi_mock_custom_groups_v1';
const jread = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? d; } catch { return d; } };
const jwrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

// → { removed: { [basis]: { [sid]: { reason, by, at } } }, mode }
export async function loadRemoved(series) {
  const local = (jread(REM_LS, {}) || {})[series] || {};
  const { data, error } = await supabase.from(REM_TABLE).select('basis, student_key, reason, removed_by, removed_at').eq('series', series);
  if (error) {
    if (missingTable(error)) return { removed: local, mode: 'local' };
    throw error;
  }
  const removed = {};
  data.forEach((r) => { (removed[r.basis] ||= {})[r.student_key] = { reason: r.reason || '', by: r.removed_by || '', at: r.removed_at || '' }; });
  return { removed, mode: 'cloud' };
}

// info: { reason } to remove, or null to bring the student back.
export async function saveRemoved(series, basis, sid, info, mode, who = '') {
  const b = basisKey(basis);
  const all = jread(REM_LS, {}) || {};
  const cur = { ...(all[series] || {}) };
  const forBasis = { ...(cur[b] || {}) };
  if (info) forBasis[sid] = { reason: info.reason || '', by: who, at: new Date().toISOString() }; else delete forBasis[sid];
  cur[b] = forBasis;
  jwrite(REM_LS, { ...all, [series]: cur });
  if (mode === 'local') return;
  if (!info) {
    const { error } = await supabase.from(REM_TABLE).delete().eq('series', series).eq('basis', b).eq('student_key', sid);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from(REM_TABLE).upsert(
    { series, basis: b, student_key: sid, reason: info.reason || null, removed_by: who || null, removed_at: new Date().toISOString() },
    { onConflict: 'series,basis,student_key' },
  );
  if (error) throw error;
}

// → { groups: [{ id, name, basis, dutyName, dutyTitle, students: [sid], note }], mode }
export async function loadCustomGroups(series) {
  const local = (jread(CUS_LS, {}) || {})[series] || [];
  const { data, error } = await supabase.from(CUS_TABLE).select('*').eq('series', series).order('created_at', { ascending: true });
  if (error) {
    if (missingTable(error)) return { groups: local, mode: 'local' };
    throw error;
  }
  const localById = new Map(local.map((g) => [g.id, g]));
  return { groups: data.map((r) => {
    const det = pickInstruction(r), mine = localById.get(r.id);
    const has = Object.values(det).some((v) => (Array.isArray(v) ? v.length : v));
    return { id: r.id, name: r.name, basis: r.basis || '', dutyName: r.duty_name || '', dutyTitle: r.duty_title || '', students: Array.isArray(r.student_keys) ? r.student_keys : [], note: r.note || '', ...(has || !mine ? det : pickInstruction(mine)) };
  }), mode: 'cloud' };
}

export const newGroupId = () => `cg-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export async function saveCustomGroup(series, group, mode, who = '') {
  const all = jread(CUS_LS, {}) || {};
  const list = [...(all[series] || []).filter((g) => g.id !== group.id), group];
  jwrite(CUS_LS, { ...all, [series]: list });
  if (mode === 'local') return;
  const base = { id: group.id, series, name: group.name, basis: group.basis || null, duty_name: group.dutyName || null, duty_title: group.dutyTitle || null, student_keys: group.students, note: group.note || null, updated_by: who || null, updated_at: new Date().toISOString() };
  const d = pickInstruction(group);
  let { error } = await supabase.from(CUS_TABLE).upsert({ ...base, venue: d.venue || null, reason: d.reason || null, days: daysToText(d.days) || null, time_from: d.from || null, time_to: d.to || null, instruction: d.instruction || null }, { onConflict: 'id' });
  if (error && /column|schema cache/i.test(error.message || '')) ({ error } = await supabase.from(CUS_TABLE).upsert(base, { onConflict: 'id' }));
  if (error) throw error;
}

export async function deleteCustomGroup(series, id, mode) {
  const all = jread(CUS_LS, {}) || {};
  jwrite(CUS_LS, { ...all, [series]: (all[series] || []).filter((g) => g.id !== id) });
  if (mode === 'local') return;
  const { error } = await supabase.from(CUS_TABLE).delete().eq('series', series).eq('id', id);
  if (error) throw error;
}

// ─── Study schedule: time slot per subject, room per group number ────────────
// Saved per series. Anything not saved falls back to DEFAULT_SCHEDULE (lib/studySchedule.js). Table
// `mock_test_study_schedule` (20261054_mock_test_study_schedule.sql); browser copy kept as the fallback.
const SCH_TABLE = 'mock_test_study_schedule';
const SCH_LS = 'gnsi_mock_study_schedule_v1';

// → { saved: { subjects: { [subject]: { from, to, days } }, rooms: { [group]: 'Room 1' } }, mode }
export async function loadSchedule(series) {
  const local = (jread(SCH_LS, {}) || {})[series] || { subjects: {}, rooms: {} };
  const { data, error } = await supabase.from(SCH_TABLE).select('*').eq('series', series);
  if (error) {
    if (missingTable(error)) return { saved: local, mode: 'local' };
    throw error;
  }
  const saved = { subjects: {}, rooms: {} };
  data.forEach((r) => {
    if (r.kind === 'subject') saved.subjects[r.key] = { from: r.time_from || '', to: r.time_to || '', days: daysFromText(r.days) };
    else if (r.kind === 'room') saved.rooms[r.key] = r.room || '';
  });
  return { saved, mode: 'cloud' };
}

// kind 'subject': value { from, to, days }   ·   kind 'room': value 'Room 1'   ·   value null = back to the default
export async function saveScheduleEntry(series, kind, key, value, mode, who = '') {
  const all = jread(SCH_LS, {}) || {};
  const cur = { subjects: { ...(all[series]?.subjects || {}) }, rooms: { ...(all[series]?.rooms || {}) } };
  const bucket = kind === 'subject' ? cur.subjects : cur.rooms;
  if (value === null) delete bucket[key]; else bucket[key] = value;
  jwrite(SCH_LS, { ...all, [series]: cur });
  if (mode === 'local') return;
  if (value === null) {
    const { error } = await supabase.from(SCH_TABLE).delete().eq('series', series).eq('kind', kind).eq('key', String(key));
    if (error) throw error;
    return;
  }
  const row = kind === 'subject'
    ? { series, kind, key: String(key), time_from: value.from || null, time_to: value.to || null, days: daysToText(value.days) || null, room: null }
    : { series, kind, key: String(key), time_from: null, time_to: null, days: null, room: String(value) };
  const { error } = await supabase.from(SCH_TABLE).upsert({ ...row, updated_by: who || null, updated_at: new Date().toISOString() }, { onConflict: 'series,kind,key' });
  if (error) throw error;
}

// Remove every saved entry of a series: back to the defaults.
export async function resetSchedule(series, mode) {
  const all = jread(SCH_LS, {}) || {};
  const next = { ...all }; delete next[series]; jwrite(SCH_LS, next);
  if (mode === 'local') return;
  const { error } = await supabase.from(SCH_TABLE).delete().eq('series', series);
  if (error) throw error;
}

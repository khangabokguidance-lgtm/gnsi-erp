// ─── dailyTasks.js ───────────────────────────────────────────────────────────
// Checklist "Today" tool: each teacher's tasks for the day + the material
// prepared for that day's classes (Navodaya / Sainik / Foundation).
// Tables: daily_tasks, daily_materials (supabase/migrations/20261055_daily_tasks.sql).
// If they are missing, everything is kept in this browser's localStorage.
import { supabase } from '../supabase';
import { sameOwner } from './dailyTaskLogic.js';
export * from './dailyTaskLogic.js';

export const KINDS = [
  { id: 'note', label: 'Note', icon: '📝' },
  { id: 'link', label: 'Link', icon: '🔗' },
  { id: 'file', label: 'File', icon: '📎' },
];
export const BUCKET = 'teacher-materials';

const T_TASKS = 'daily_tasks';
const T_MATS = 'daily_materials';
const LS_TASKS = 'gnsi_daily_tasks_v1';
const LS_MATS = 'gnsi_daily_materials_v1';

const lsRead = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const lsWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
const missingTable = (e) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|Could not find the table/i.test(e.message || ''));

// ── persistence ──
// → { tasks, mats, mode, note }  (all owners for the date range; the screen filters by owner)
export async function loadDay(date, who, { everyone = false } = {}) {
  let tq = supabase.from(T_TASKS).select('*').eq('task_date', date).order('created_at');
  let mq = supabase.from(T_MATS).select('*').eq('task_date', date).order('created_at');
  if (!everyone) { tq = tq.ilike('owner_name', who); mq = mq.ilike('owner_name', who); }
  const [t, m] = await Promise.all([tq, mq]);
  const err = t.error || m.error;
  if (err) {
    if (missingTable(err)) {
      const pick = (rows) => rows.filter((r) => r.task_date === date && (everyone || sameOwner(r, who)));
      return { tasks: pick(lsRead(LS_TASKS)), mats: pick(lsRead(LS_MATS)), mode: 'local',
        note: 'The daily_tasks / daily_materials tables are not created yet — run supabase/migrations/20261055_daily_tasks.sql. Until then your tasks are saved in this browser only.' };
    }
    throw err;
  }
  return { tasks: t.data, mats: m.data, mode: 'cloud', note: '' };
}

async function insertRows(table, ls, rows, mode) {
  if (mode === 'local') {
    const withIds = rows.map((r, i) => ({ ...r, id: `local-${Date.now()}-${i}`, created_at: new Date().toISOString() }));
    if (!lsWrite(ls, [...lsRead(ls), ...withIds])) throw new Error('Browser storage is full — apply the Supabase migration.');
    return withIds;
  }
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw error;
  return data;
}
async function patchRow(table, ls, id, patch, mode) {
  if (mode === 'local') { lsWrite(ls, lsRead(ls).map((r) => (r.id === id ? { ...r, ...patch } : r))); return; }
  const { error } = await supabase.from(table).update(patch).eq('id', id);
  if (error) throw error;
}
async function removeRow(table, ls, id, mode) {
  if (mode === 'local') { lsWrite(ls, lsRead(ls).filter((r) => r.id !== id)); return; }
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) throw error;
}

export const addTasks = (rows, mode) => insertRows(T_TASKS, LS_TASKS, rows, mode);
export const addMaterial = (row, mode) => insertRows(T_MATS, LS_MATS, [row], mode).then((r) => r[0]);
export const setTaskDone = (id, done, mode) => patchRow(T_TASKS, LS_TASKS, id, { done, done_at: done ? new Date().toISOString() : null }, mode);
export const deleteTask = (id, mode) => removeRow(T_TASKS, LS_TASKS, id, mode);
export const deleteMaterial = (id, mode) => removeRow(T_MATS, LS_MATS, id, mode);

export async function uploadMaterialFile(file, who) {
  const safe = file.name.replace(/[^\w.-]+/g, '_');
  const path = `${String(who||'').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'staff'}/${Date.now()}-${safe}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

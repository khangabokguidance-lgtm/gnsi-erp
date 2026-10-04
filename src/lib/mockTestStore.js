// ─── mockTestStore.js ────────────────────────────────────────────────────────
// Persistence for the Mock Test Analyzer.  Primary store: Supabase table
// `mock_test_results` (see supabase/migrations/20261002_mock_test_results.sql).
// If that table does not exist yet, results are kept in this browser's
// localStorage instead so nothing is lost, and the screen tells the user to
// run the migration.
import { supabase } from '../supabase';

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

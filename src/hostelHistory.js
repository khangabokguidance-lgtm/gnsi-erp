// hostelHistory.js — hostel type changes with an effective month.
//
// A student may move between Boarder / Day Boarder / Day Scholar mid-session.
// Each change is stored in student_hostel_history (migration
// 20260930_hostel_type_history.sql) with the month it takes effect, so:
//   • months before the change keep the old type's rate — past payments and
//     the dues/ledger for those months are unchanged;
//   • months from the effective month use the new type's rate.
// students.hostel_type always holds the current type; the latest segment of
// the timeline is always the current record (so an edit made elsewhere still
// applies from the last recorded change onward).
import { supabase } from './supabase'

export const HOSTEL_TYPE_LIST = ['Boarder', 'Day Boarder', 'Day Scholar']
export const HISTORY_SETUP_MSG = 'Changing hostel type with an effective month needs the database update 20260930_hostel_type_history.sql — run it in Supabase (SQL editor) first.'

const MONTH_IDX = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 }
const gccKey = v => String(parseInt(v) || 0)
const missingTable = err => err && (err.code === '42P01' || err.code === 'PGRST205' || /student_hostel_history/.test(err.message || ''))

export const monthStart = (month, year) => `${year}-${String(MONTH_IDX[month] || 1).padStart(2, '0')}-01`
export const currentType = student => student?.hostel_type || 'Day Scholar'
const byDate = (a, b) => String(a.effective_from).localeCompare(String(b.effective_from)) || String(a.created_at || '').localeCompare(String(b.created_at || ''))

// Hostel type in effect for a fee month.
export function typeOnMonth(student, changes, month, year) {
  const cur = currentType(student)
  if (!changes?.length) return cur
  const ms = monthStart(month, year)
  let idx = -1
  changes.forEach((c, i) => { if (String(c.effective_from).slice(0, 10) <= ms) idx = i })
  if (idx === -1) return changes[0].from_type || cur
  return idx === changes.length - 1 ? cur : changes[idx].to_type
}

// Timeline segments for display: [{ type, from: 'YYYY-MM-DD' | null, to: 'YYYY-MM-DD' | null }]
export function timeline(student, changes) {
  if (!changes?.length) return [{ type: currentType(student), from: null, to: null }]
  const segs = [{ type: changes[0].from_type, from: null, to: changes[0].effective_from }]
  changes.forEach((c, i) => segs.push({ type: i === changes.length - 1 ? currentType(student) : c.to_type, from: c.effective_from, to: changes[i + 1]?.effective_from || null }))
  return segs
}

// All changes, grouped by GCC (sorted oldest first). { map, setupNeeded }
export async function loadHostelHistory(gccs = null) {
  let q = supabase.from('student_hostel_history').select('*')
  if (gccs?.length) q = q.in('gcc_no', gccs.map(gccKey))
  const { data, error } = await q
  const map = new Map()
  if (error) return { map, setupNeeded: missingTable(error), failed: !missingTable(error) }
  for (const r of data || []) { const k = gccKey(r.gcc_no); if (!map.has(k)) map.set(k, []); map.get(k).push(r) }
  for (const list of map.values()) list.sort(byDate)
  return { map, setupNeeded: false, failed: false }
}

// One student's changes. Staff read the table; a parent (no staff session)
// goes through the public_hostel_history() function. Never throws.
export async function loadStudentHistory(gcc, { staff = true } = {}) {
  try {
    if (staff) {
      const { data, error } = await supabase.from('student_hostel_history').select('*').eq('gcc_no', gccKey(gcc))
      if (!error) return (data || []).sort(byDate)
    }
    const { data, error } = await supabase.rpc('public_hostel_history', { p_gcc: gccKey(gcc) })
    return error ? [] : (data || []).sort(byDate)
  } catch { return [] }
}

// Hostel types used across a session's months (to fetch each type's rates once).
export function typesInSession(student, changes, session, months) {
  const start = Number(String(session).slice(0, 4))
  const set = new Set()
  for (const m of months) set.add(typeOnMonth(student, changes, m, MONTH_IDX[m] >= 4 ? start : start + 1))
  return [...set]
}

// Change a student's hostel type from a month onward. Earlier months keep the
// old type's rate. Admin only (enforced by RLS). effectiveFrom: 'YYYY-MM-01'.
export async function changeHostelType({ student, toType, effectiveFrom, reason, by, changes = [] }) {
  const fromType = currentType(student)
  if (!HOSTEL_TYPE_LIST.includes(toType)) throw new Error('Choose Boarder, Day Boarder or Day Scholar.')
  if (toType === fromType) throw new Error(`${student.name} is already a ${toType}.`)
  if (!/^\d{4}-\d{2}-01$/.test(effectiveFrom || '')) throw new Error('Choose the month the new hostel type starts.')
  const last = changes[changes.length - 1]
  if (last && String(effectiveFrom) < String(last.effective_from).slice(0, 10)) throw new Error(`The last change took effect on ${String(last.effective_from).slice(0, 10)} — a new change can't start before it.`)
  const { error } = await supabase.from('student_hostel_history').insert({
    student_id: student.id != null ? String(student.id) : null, gcc_no: gccKey(student.gcc_no), student_name: student.name || null,
    from_type: fromType, to_type: toType, effective_from: effectiveFrom, reason: reason || null, changed_by: by || null,
  })
  // Without the history row, updating the student would re-price every past month — stop.
  if (error) throw new Error(missingTable(error) ? HISTORY_SETUP_MSG : error.message)
  const { error: sErr } = await supabase.from('students').update({ hostel_type: toType }).eq('id', student.id)
  if (sErr) throw new Error(`History saved, but the student record could not be updated: ${sErr.message}`)
  try { await supabase.from('admissions').update({ hostel_type: toType }).eq('gcc_no', student.gcc_no) } catch { /* best-effort mirror */ }
  try {
    await supabase.from('audit_log').insert({
      action: 'hostel_type_changed', changed_by: by || 'Admin', target_id: String(student.id ?? ''),
      new_values: JSON.stringify({ gcc: student.gcc_no, student_name: student.name, from: fromType, to: toType, effective_from: effectiveFrom, reason: reason || null }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
}

// Undo the latest change (admin): the student goes back to its from_type.
export async function undoLastChange({ student, changes, by }) {
  const last = changes?.[changes.length - 1]
  if (!last) return
  const { error } = await supabase.from('student_hostel_history').delete().eq('id', last.id)
  if (error) throw new Error(error.message)
  const { error: sErr } = await supabase.from('students').update({ hostel_type: last.from_type }).eq('id', student.id)
  if (sErr) throw new Error(sErr.message)
  try { await supabase.from('admissions').update({ hostel_type: last.from_type }).eq('gcc_no', student.gcc_no) } catch { /* best-effort */ }
  try {
    await supabase.from('audit_log').insert({
      action: 'hostel_type_change_undone', changed_by: by || 'Admin', target_id: String(student.id ?? ''),
      new_values: JSON.stringify({ gcc: student.gcc_no, student_name: student.name, from: last.to_type, to: last.from_type, effective_from: last.effective_from }),
      created_at: new Date().toISOString(),
    })
  } catch { /* audit is best-effort */ }
}

// A record CORRECTION (the type was wrong all along) replaces the whole
// timeline: the student is that type for every month.
export async function clearHistory(gcc) {
  try { await supabase.from('student_hostel_history').delete().eq('gcc_no', gccKey(gcc)) } catch { /* table not there yet */ }
}

const SESSION_MONTHS = ['April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'January', 'February', 'March']

// Rates for a session honouring the timeline. rateOf(type) → Promise<rates>.
// No changes → the plain rates object for the current type (unchanged
// behaviour). With changes → a function (month, year) → rates for the type in
// effect that month (with .hostelType); fn.current = current type's rates.
export async function sessionRates(student, session, changes, rateOf) {
  const cur = currentType(student)
  if (!changes?.length) return rateOf(cur)
  const types = new Set([cur, ...typesInSession(student, changes, session, SESSION_MONTHS)])
  const byType = {}
  for (const t of types) byType[t] = await rateOf(t)
  const fn = (month, year) => { const t = typeOnMonth(student, changes, month, year); return { ...(byType[t] || byType[cur]), hostelType: t } }
  fn.current = byType[cur]
  return fn
}

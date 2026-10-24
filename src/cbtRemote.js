// cbtRemote.js — the online side of the CBT Exam: publish a test as a link, and let a candidate take it from
// anywhere. Candidates only ever call the cbt_* database functions (supabase/migrations/20261034_cbt_online_exam.sql);
// the answer key stays in a staff-only table. Staff read and manage the tables directly.
import { supabase } from './supabase'
import { friendly, splitKey, joinKey, toAttempt, packMarks } from './lib/cbtOnlineLogic'
export * from './lib/cbtOnlineLogic'

// ── staff ────────────────────────────────────────────────────────────────────
export async function publishOnline(test, { code = '', opensAt = null, closesAt = null, status = 'live', by = '' } = {}) {
  const { sections, key } = splitKey(test)
  const iso = v => (v ? new Date(v).toISOString() : null)
  const { error } = await supabase.from('cbt_tests').upsert({
    id: test.id, name: test.name, duration_min: test.durationMin, marking: test.marking, instructions: test.instructions, show_result: test.showResult !== false,
    show_answers: test.showAnswers !== false, sections, status, access_code: String(code || '').trim() || null, opens_at: iso(opensAt), closes_at: iso(closesAt),
    created_by: by || null, updated_at: new Date().toISOString(),
  })
  if (error) throw new Error(friendly(error))
  const k = await supabase.from('cbt_keys').upsert({ test_id: test.id, answers: key })
  if (k.error) throw new Error(friendly(k.error))
}

export async function listOnline() {
  const { data, error } = await supabase.from('cbt_tests').select('id, name, status, access_code, opens_at, closes_at, duration_min, updated_at, created_at').order('created_at', { ascending: false })
  if (error) throw new Error(friendly(error))
  const att = await supabase.from('cbt_attempts').select('test_id, state')
  const counts = {}
  for (const a of att.data || []) { const c = counts[a.test_id] ||= { total: 0, submitted: 0 }; c.total++; if (a.state === 'submitted') c.submitted++ }
  return (data || []).map(t => ({ ...t, attempts: counts[t.id] || { total: 0, submitted: 0 } }))
}
export async function onlineAttempts(testId, testName = '') {
  const { data, error } = await supabase.from('cbt_attempts').select('*').eq('test_id', testId).order('started_at', { ascending: false })
  if (error) throw new Error(friendly(error))
  return (data || []).map(r => toAttempt(r, testName))
}
export async function setOnline(id, patch) {
  const { error } = await supabase.from('cbt_tests').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw new Error(friendly(error))
}
export async function deleteOnline(id) { const { error } = await supabase.from('cbt_tests').delete().eq('id', id); if (error) throw new Error(friendly(error)) }
export async function deleteOnlineAttempt(id) { const { error } = await supabase.from('cbt_attempts').delete().eq('id', id); if (error) throw new Error(friendly(error)) }
// A published test with its key, as a test this computer can show results for.
export async function fetchOnlineTest(id) {
  const [t, k] = await Promise.all([supabase.from('cbt_tests').select('*').eq('id', id).maybeSingle(), supabase.from('cbt_keys').select('answers').eq('test_id', id).maybeSingle()])
  if (t.error) throw new Error(friendly(t.error))
  if (!t.data) return null
  const r = t.data
  return { id: r.id, name: r.name, durationMin: Number(r.duration_min), marking: r.marking, instructions: r.instructions, showResult: r.show_result, showAnswers: r.show_answers, sections: joinKey(r.sections, k.data?.answers || {}), createdAt: Date.parse(r.created_at), online: true }
}

// ── candidate ────────────────────────────────────────────────────────────────
// Wrong code / too many tries come back as { error: 'EXAM-…: message' } (a raised error would undo the server's attempt count).
const fail = raw => { const e = new Error(friendly(raw)); e.code = /EXAM-([A-Z0-9]+)/.exec(String(raw?.message || raw))?.[1] || ''; return e }   // e.code: 'SESSION', 'EARLY', …
const rpc = async (fn, args) => { const { data, error } = await supabase.rpc(fn, args); if (error) throw fail(error); if (data && !Array.isArray(data) && typeof data.error === 'string') throw fail(data.error); return data }
export const examInfo = id => rpc('cbt_exam_info', { p_test: id })
export const startExam = (id, code, name, roll, phone, gcc, parent) => rpc('cbt_start', { p_test: id, p_code: code || '', p_name: name, p_roll: roll, p_phone: phone || null, p_gcc: gcc || null, p_parent: parent || null })
export const lookupStudent = (id, code, q) => rpc('cbt_lookup', { p_test: id, p_code: code || '', p_q: q })
export const resumeExam = (attempt, token, session) => rpc('cbt_resume', { p_attempt: attempt, p_token: token, p_session: session || null })
export const saveExam = (attempt, token, a, session) => rpc('cbt_save', { p_attempt: attempt, p_token: token, p_answers: a.answers, p_marked: packMarks(a.marked, a.visited, a.proctor, a), p_current: a.current, p_lang: a.lang, p_switches: a.switches || 0, p_session: session || null })
export const submitExam = (attempt, token, a, session) => rpc('cbt_submit', { p_attempt: attempt, p_token: token, p_answers: a.answers, p_marked: packMarks(a.marked, a.visited, a.proctor, a), p_switches: a.switches || 0, p_session: session || null })


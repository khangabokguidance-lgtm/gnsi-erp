// cbtRemote.js — the online side of the CBT Exam: publish a test as a link, and let a candidate take it from
// anywhere. Candidates only ever call the cbt_* database functions (supabase/migrations/20261034_cbt_online_exam.sql);
// the answer key stays in a staff-only table. Staff read and manage the tables directly.
import { supabase } from './supabase'
import { buildMockFile, manifestEntry, upsertIndex, dropIndex, MOCK_SLUG } from './lib/cbtMock'
import { friendly, splitKey, joinKey, toAttempt, packMarks } from './lib/cbtOnlineLogic'
export * from './lib/cbtOnlineLogic'

// ── staff ────────────────────────────────────────────────────────────────────
export async function publishOnline(test, { code = '', opensAt = null, closesAt = null, status = 'live', by = '', publicList, practiceAfterClose, autoCode } = {}) {
  const { sections, key } = splitKey(test)
  const iso = v => (v ? new Date(v).toISOString() : null)
  const row = {
    id: test.id, name: test.name, duration_min: test.durationMin, marking: test.marking, instructions: test.instructions, show_result: test.showResult !== false,
    show_answers: test.showAnswers !== false, sections, status, access_code: String(code || '').trim() || null, opens_at: iso(opensAt), closes_at: iso(closesAt),
    created_by: by || null, updated_at: new Date().toISOString(),
  }
  const extra = { ...(typeof publicList === 'boolean' ? { public_list: publicList } : {}), ...(typeof practiceAfterClose === 'boolean' ? { practice_after_close: practiceAfterClose } : {}), ...(typeof autoCode === 'boolean' ? { auto_code: autoCode } : {}) }
  let { error } = await supabase.from('cbt_tests').upsert({ ...row, ...extra })
  // public_list / practice_after_close exist only after 20261115 / 20261116: publishing must still work before they are run
  if (error && /public_list|practice_after_close|auto_code/.test(error.message || '')) ({ error } = await supabase.from('cbt_tests').upsert(row))
  if (error) throw new Error(friendly(error))
  const k = await supabase.from('cbt_keys').upsert({ test_id: test.id, answers: key })
  if (k.error) throw new Error(friendly(k.error))
}

// Readiness probes (staff): is each migration in this database? A column / key that is missing means it was not run.
export async function probeSchema(testId) {
  const col = async (table, c) => !(await supabase.from(table).select(c).limit(1)).error
  const info = await supabase.rpc('cbt_exam_info', { p_test: testId })
  return {
    extra: await col('cbt_attempts', 'extra_seconds'),
    district: await col('cbt_attempts', 'district,gender,caste'),
    dobEntered: await col('cbt_attempts', 'dob_entered'),
    studentDistrict: await col('students', 'district,caste'),
    guestsInfo: !!info.data && Object.prototype.hasOwnProperty.call(info.data, 'guests'),
  }
}
// The students the readiness check looks at (only the columns it needs).
export async function loadStudentsForReadiness() {
  const { data, error } = await supabase.from('students').select('id,status,deleted_at,parent_phone,father_phone,mother_phone,guardian_phone,guardian_mobile,dob').limit(5000)
  if (error) return null
  return data || []
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
// Give one attempt extra time (staff). Adds to what it already has; capped at 2 hours by the database.
export async function extendOnlineAttempt(id, seconds) {
  const cur = await supabase.from('cbt_attempts').select('extra_seconds').eq('id', id).maybeSingle()
  if (cur.error) throw new Error(friendly(cur.error))
  const next = Math.min(7200, Math.max(0, (cur.data?.extra_seconds || 0) + seconds))
  const { error } = await supabase.from('cbt_attempts').update({ extra_seconds: next }).eq('id', id)
  if (error) throw new Error(friendly(error))
  return next
}
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
// The tests open right now (and starting within 14 days) that an admin has not hidden — for the public exam page. [] if the database update is not run yet.
export const listPublicTests = async () => { try { const r = await rpc('cbt_public_tests', {}); return Array.isArray(r) ? r : [] } catch { return [] } }
// Staff: is this test shown on the public page? (true when the column does not exist yet)
export async function getPublicListFlag(id) { try { const { data, error } = await supabase.from('cbt_tests').select('public_list').eq('id', id).maybeSingle(); return error || !data ? true : data.public_list !== false } catch { return true } }
// Staff: does the exam page fill in this test's current access code by itself? (false when the column does not exist yet)
export async function getAutoCodeFlag(id) { try { const { data, error } = await supabase.from('cbt_tests').select('auto_code').eq('id', id).maybeSingle(); return error || !data ? false : data.auto_code === true } catch { return false } }
// ── the public TOP 5 board ─────────────────────────────────────────────────────
// Staff publish a snapshot (top 5 only) into cbt_tests.top5; the public page reads it through cbt_top5_list().
export async function saveTop5(id, snapshot) {
  // .select() so we can SEE whether a row changed: when the database refuses the change (no permission, or the test is not
  // published online) it answers "0 rows, no error", which must not be reported as success
  const { data, error } = await supabase.from('cbt_tests').update({ top5: snapshot }).eq('id', id).select('id')
  if (error) throw new Error(/top5/.test(error.message || '') ? 'Run supabase/RUN_cbt_top5.sql in Supabase once, then try again.' : friendly(error))
  if (!data || !data.length) throw new Error('Nothing was saved — you may not have permission, or this test is not published online.')
}
export async function getTop5(id) { try { const { data, error } = await supabase.from('cbt_tests').select('top5').eq('id', id).maybeSingle(); return error ? null : data?.top5 || null } catch { return null } }
// The latest published top-5 boards, newest first: [] if none or the database update is not run yet.
// GCC practice limit: asks the database to count this try (3 per GCC per test). Resolves { ok, used, limit, left } or { skipped: true } when
// the database update is not run yet / there is no connection (practice must keep working); a "no" from the server (wrong GCC, tries used up) throws.
export async function mockBegin(slug, gcc) {
  try { return await rpc('cbt_mock_begin', { p_slug: slug, p_gcc: gcc }) } catch (e) { if (e && e.code) throw e; return { skipped: true } }
}
// Staff: who practised (newest first) and giving a student more tries (admin).
export async function listMockPractice(limit = 5000) {
  const { data, error } = await supabase.from('cbt_mock_practice').select('gcc,slug,started_at').order('started_at', { ascending: false }).limit(limit)
  if (error) throw new Error(friendly(error))
  return data || []
}
export async function resetMockPractice(gcc, slug) { const { error } = await supabase.from('cbt_mock_practice').delete().eq('gcc', gcc).eq('slug', slug); if (error) throw new Error(friendly(error)) }
// GCC no. (no leading zeros) → { name, batch } for the staff list; read client-side so it works whatever the column type is.
export async function nameMap() {
  const { data } = await supabase.from('students').select('gcc_no,name,batch').limit(5000)
  const out = {}
  for (const r of data || []) out[String(r.gcc_no).replace(/^0+/, '')] = { name: r.name || '', batch: r.batch || '' }
  return out
}
// Static-mock counters: +1 view / +1 appeared (fire and forget — a mock must never fail because of a counter), and all counters at once.
export const mockHit = (slug, kind) => { try { Promise.resolve(supabase.rpc('cbt_mock_hit', { p_slug: slug, p_kind: kind })).catch(() => {}) } catch { /* ignore */ } }
export const listMockStats = async () => { try { const r = await rpc('cbt_mock_stats', {}); return r && typeof r === 'object' && !Array.isArray(r) ? r : {} } catch { return {} } }
export const listTop5 = async () => { try { const r = await rpc('cbt_top5_list', {}); return Array.isArray(r) ? r : [] } catch { return [] } }
export async function getPracticeFlag(id) { try { const { data, error } = await supabase.from('cbt_tests').select('practice_after_close').eq('id', id).maybeSingle(); return error || !data ? true : data.practice_after_close !== false } catch { return true } }
// Ask the site to put this closed exam's practice copy on the CDN (the first student triggers it once; the rest read the CDN). → true when a copy
// exists / was made; false on any problem, and the page then uses the database copy as before.
export async function ensurePracticeCopy(id) {
  try { const r = await fetch(`/api/entrance?action=practice-copy&id=${encodeURIComponent(id)}`, { method: 'POST' }); if (!r.ok) return false; const j = await r.json().catch(() => ({})); return !!j.ok } catch { return false }
}
// Past (closed) exams anyone may practise: [] if the database update is not run yet.
export const listPracticeTests = async () => { try { const r = await rpc('cbt_practice_list', {}); return Array.isArray(r) ? r : [] } catch { return [] } }
// The past paper with its key, turned into a test the exam screen can run and mark locally (nothing is sent anywhere).
export async function practiceTest(id) {
  const p = await rpc('cbt_practice_paper', { p_test: id })
  return {
    id: `practice-${p.id}`, name: `${p.name} — practice`, durationMin: Number(p.durationMin) || 60,
    marking: { ...(p.marking || {}), minMinutes: 0, proctor: { camera: 'off', shield: false, fullscreen: 'off' }, tools: { calc: true, rough: true, ...((p.marking || {}).tools || {}) } },
    instructions: `PRACTICE — this is a past exam. Nothing you do here is recorded or counted.\n\n${p.instructions || ''}`.trim(),
    showResult: true, showAnswers: true, sections: joinKey(p.sections || [], p.key || {}), createdAt: 0, updatedAt: 0,
  }
}
export const startExam = (id, code, gcc, parent, phone, dob) => rpc('cbt_start', { p_test: id, p_code: code || '', p_gcc: gcc, p_parent: parent || null, p_phone: phone || null, ...(dob ? { p_dob: dob } : {}) })
// A guest (not in the ERP) — only when the test allows guests. One attempt per mobile number.
export const startGuest = (id, code, name, phone, district, gender, caste) => rpc('cbt_start_guest', { p_test: id, p_code: code || '', p_name: name, p_phone: phone, ...(district ? { p_district: district } : {}), ...(gender ? { p_gender: gender } : {}), ...(caste ? { p_caste: caste } : {}) })
// A GCC no. is matched exactly (no name search). With `parent` it also checks that number against the ERP record: verified true / false / null (none on file).
export const lookupStudent = (id, code, gcc, parent, dob) => rpc('cbt_lookup', { p_test: id, p_code: code || '', p_q: gcc, ...(parent ? { p_parent: parent } : {}), ...(dob ? { p_dob: dob } : {}) })
export const resumeExam = (attempt, token, session) => rpc('cbt_resume', { p_attempt: attempt, p_token: token, p_session: session || null })
export const saveExam = (attempt, token, a, session) => rpc('cbt_save', { p_attempt: attempt, p_token: token, p_answers: a.answers, p_marked: packMarks(a.marked, a.visited, a.proctor, a), p_current: a.current, p_lang: a.lang, p_switches: a.switches || 0, p_session: session || null })
export const submitExam = (attempt, token, a, session) => rpc('cbt_submit', { p_attempt: attempt, p_token: token, p_answers: a.answers, p_marked: packMarks(a.marked, a.visited, a.proctor, a), p_switches: a.switches || 0, p_session: session || null })


// Re-evaluation (staff): write the new score of each changed attempt. The old marks are kept inside the score so the
// change can always be traced. plan = rescorePlan(...).changes
export async function applyRescore(changes) {
  const at = new Date().toISOString()
  let done = 0
  for (const c of changes) {
    const score = { ...c.now, rescored: { at, wasMarks: c.was?.marks ?? null, wasCorrect: c.was?.correct ?? null } }
    const { error } = await supabase.from('cbt_attempts').update({ score }).eq('id', c.attempt.id)
    if (error) throw new Error(`${done} of ${changes.length} updated, then: ${friendly(error)}`)
    done++
  }
  return done
}

// ── practice copies on the CDN (public storage bucket cbt-practice; supabase/RUN_cbt_practice_bucket.sql) ──
const PRACTICE_BUCKET = 'cbt-practice'
const practiceUrl = name => supabase.storage.from(PRACTICE_BUCKET).getPublicUrl(name).data.publicUrl
export const practiceCopyUrl = slug => practiceUrl(`${slug}.json`)
const putJson = async (name, body, cacheControl) => {
  const { error } = await supabase.storage.from(PRACTICE_BUCKET).upload(name, new Blob([JSON.stringify(body)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl })
  if (error) throw new Error(/bucket not found/i.test(error.message || '') ? 'Run supabase/RUN_cbt_practice_bucket.sql in the Supabase SQL editor first.' : friendly(error))
}
// the public list (fresh from the network; null if the bucket or list does not exist yet)
export async function listPracticeCopies() {
  try { const r = await fetch(practiceUrl('index.json'), { cache: 'no-cache' }); if (!r.ok) return []; const j = await r.json(); return Array.isArray(j) ? j.filter(m => m && MOCK_SLUG.test(String(m.slug))) : [] } catch { return [] }
}
// Make the paper (with its key) practisable by any number of students. Only for a CLOSED exam: the file carries the answers.
export async function publishPracticeCopy(test, until = '') {
  const file = buildMockFile(test)                                   // refuses a paper with a missing key
  await putJson(`${file.slug}.json`, file, '3600')
  await putJson('index.json', upsertIndex(await listPracticeCopies(), manifestEntry(file, until)), '60')
  return file.slug
}
export async function removePracticeCopy(slug) {
  if (!MOCK_SLUG.test(slug)) throw new Error('Bad name.')
  await putJson('index.json', dropIndex(await listPracticeCopies(), slug), '60')
  await supabase.storage.from(PRACTICE_BUCKET).remove([`${slug}.json`])
}

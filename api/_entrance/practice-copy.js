// POST /api/entrance?action=practice-copy&id=<exam id>
// Makes sure a closed exam has a practice copy on the CDN (public bucket cbt-practice), so 300 students practising it
// read ONE file from the CDN instead of the whole paper from the database 300 times.
//   • The database function cbt_practice_paper decides whether practice is allowed (closed, listed, answers out, practice on).
//     If it says no, nothing is published and the page falls back to its normal path.
//   • If a copy for this exam is already in the bucket's index.json, nothing is read or written (a copy staff removed or let expire is left alone only while its entry exists).
//   • The first student pays the one database read; everyone after reads the CDN.
// Nothing in api/ imports from src/: the small file-building rules below mirror src/lib/cbtMock.js (tests/practiceCopy.test.js checks they agree).
import { db, send, only, timedFetch, DB_TIMEOUT_MS } from './_lib.js'

const BUCKET = 'cbt-practice'
const ID = /^[A-Za-z0-9_-]{3,64}$/
const FORMAT = 'gnsi-mock-1'
const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** A slug that cannot clash with another exam of the same name: <name>-<exam id>, within the 61-character limit. */
export const copySlug = (name, id) => {
  const tag = String(id).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'exam'
  const base = slugify(name).slice(0, 40).replace(/-+$/, '')
  return base ? `${base}-${tag}` : `exam-${tag}`
}

/** The paper (as cbt_practice_paper returns it, with `key`) → the mock file. Throws when a question has no answer key. */
export function buildPracticeFile(paper, now = Date.now()) {
  const key = paper.key || {}
  const sections = (paper.sections || []).map(s => ({ ...s, questions: (s.questions || []).map(q => ({ ...q, answer: key[q.no] || null })) }))
  const qs = sections.flatMap(s => s.questions)
  if (!qs.length) throw new Error('no questions')
  if (qs.some(q => !q.answer)) throw new Error('missing answer key')
  return {
    format: FORMAT, slug: copySlug(paper.name, paper.id), builtAt: now, id: paper.id, name: paper.name, durationMin: Number(paper.durationMin) || 60,
    marking: paper.marking || {}, instructions: paper.instructions || '', showResult: true, showAnswers: true, sections,
  }
}
export const entryOf = (file, count) => ({ slug: file.slug, name: file.name, durationMin: file.durationMin, questions: count, date: new Date(file.builtAt).toISOString().slice(0, 10), testId: file.id })

const publicUrl = (supabase, name) => supabase.storage.from(BUCKET).getPublicUrl(name).data.publicUrl
const inflight = new Map()   // exam id → the publish in progress in this instance (so a rush of first requests does one database read)

async function ensure(id) {
  const supabase = db()
  const idx = await timedFetch(DB_TIMEOUT_MS)(publicUrl(supabase, 'index.json'), { cache: 'no-store' }).then(r => (r.ok ? r.json() : [])).catch(() => [])
  const list = Array.isArray(idx) ? idx : []
  const have = list.find(m => m && m.testId === id)
  if (have) return { slug: have.slug, existing: true }
  const { data: paper, error } = await supabase.rpc('cbt_practice_paper', { p_test: id })
  if (error || !paper || typeof paper !== 'object') return { refused: true }
  const file = buildPracticeFile(paper)
  const put = async (name, body, cacheControl) => {
    const { error: e } = await supabase.storage.from(BUCKET).upload(name, new Blob([JSON.stringify(body)], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl })
    if (e) throw new Error(e.message || 'upload failed')
  }
  await put(`${file.slug}.json`, file, '3600')
  const count = file.sections.reduce((n, s) => n + s.questions.length, 0)
  await put('index.json', [entryOf(file, count), ...list.filter(m => m && m.slug !== file.slug)], '60')
  return { slug: file.slug, existing: false }
}

export default async function handler(req, res) {
  if (!only(req, res, 'POST')) return
  const id = String(req.query?.id || '')
  if (!ID.test(id)) return send(res, 400, { error: 'Bad exam id' })
  try {
    if (!inflight.has(id)) inflight.set(id, ensure(id).finally(() => inflight.delete(id)))
    const r = await inflight.get(id)
    if (r.refused) return send(res, 403, { error: 'Practice copy not available' })
    return send(res, 200, { ok: true, slug: r.slug, existing: r.existing })
  } catch (e) {
    console.error('entrance/practice-copy', e)
    return send(res, 500, { error: 'Could not prepare the practice copy' })   // the page falls back to the database copy
  }
}

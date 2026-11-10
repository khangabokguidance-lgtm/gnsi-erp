// cbtMock.js — "static mock tests": a whole mock paper (questions + answer key) saved as one JSON file under
// public/mocks/ and served from the CDN. The exam page runs it in the browser: timer, proctoring and marking all
// happen on the student's device, so a mock with hundreds of students adds no exam traffic (no login, no autosave, no polling).
// Trade-off: the answer key travels inside the file, so a determined student can read it. Use these for practice /
// pre-mocks, and keep the official exam on the online (server-marked) path.
import { flatQuestions } from './cbtEngine.js'

export const MOCK_FORMAT = 'gnsi-mock-1'
export const MOCK_SLUG = /^[a-z0-9][a-z0-9-]{0,60}$/

export const slugify = s => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'mock'

// builder test → the file's content
export function buildMockFile(test, { slug = '', now = Date.now() } = {}) {
  if (!test || !Array.isArray(test.sections) || !flatQuestions(test).length) throw new Error('This test has no questions yet.')
  const qs = flatQuestions(test)
  const missing = qs.filter(q => !q.answer).length
  if (missing) throw new Error(`${missing} question${missing === 1 ? ' has' : 's have'} no answer key — set every answer first, or the score would be wrong.`)
  const s = slug || slugify(test.name)
  if (!MOCK_SLUG.test(s)) throw new Error('The file name may use only a–z, 0–9 and dashes.')
  return {
    format: MOCK_FORMAT, slug: s, builtAt: now,
    id: test.id, name: test.name, durationMin: Number(test.durationMin) || 60, marking: test.marking || {},
    instructions: test.instructions || '', showResult: test.showResult !== false, showAnswers: test.showAnswers !== false,
    sections: test.sections,
  }
}

// file content → a test the exam screen can run (throws a readable error for a bad / foreign file)
export function parseMock(raw) {
  if (!raw || typeof raw !== 'object' || raw.format !== MOCK_FORMAT) throw new Error('This mock test file is not valid.')
  if (!Array.isArray(raw.sections) || !raw.sections.length) throw new Error('This mock test has no questions.')
  const test = {
    id: `mock-${raw.slug || raw.id}`, name: String(raw.name || 'Mock test'), durationMin: Number(raw.durationMin) || 60,
    marking: raw.marking || {}, instructions: String(raw.instructions || ''),
    showResult: raw.showResult !== false, showAnswers: raw.showAnswers !== false,
    sections: raw.sections, createdAt: raw.builtAt || 0, updatedAt: raw.builtAt || 0,
  }
  if (!flatQuestions(test).length) throw new Error('This mock test has no questions.')
  return test
}

// the manifest the exam page lists: public/mocks/index.json = [{ slug, name, durationMin, questions, date }]
export function manifestEntry(file) {
  return { slug: file.slug, name: file.name, durationMin: file.durationMin, questions: flatQuestions(file).length, date: new Date(file.builtAt || Date.now()).toISOString().slice(0, 10), testId: file.id || '' }
}
export const mockPath = (slug, base = '/') => `${base}mocks/${slug}.json`
export const mockLink = (slug, origin = typeof window !== 'undefined' ? window.location.origin : '') => `${origin}/exam?mock=${encodeURIComponent(slug)}`

// the list of practice copies (index.json): newest first, one entry per slug
export const upsertIndex = (list, entry) => [entry, ...(Array.isArray(list) ? list : []).filter(m => m && m.slug !== entry.slug)]
export const dropIndex = (list, slug) => (Array.isArray(list) ? list : []).filter(m => m && m.slug !== slug)

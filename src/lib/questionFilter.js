// questionFilter.js — the advanced filter for question lists (Mission Sainik builders and the Mission Foundation question maker).
// Pure: takes the questions and a filter object, returns the questions that pass, in the chosen order.

export const EMPTY_FILTER = { search: '', level: '', setter: '', topic: '', explain: '', figure: '', chosen: '', problem: '', sort: '' }
const LEVEL_RANK = { Hard: 0, Medium: 1, Easy: 2 }
const optsOf = q => (q.opts ? q.opts.map(o => o.text) : [q.option_a, q.option_b, q.option_c, q.option_d])
export const hasProblem = q => optsOf(q).filter(x => String(x ?? '').trim()).length < 4 || !/^[A-D]$/i.test(String(q.answer || ''))

// How many filters (besides the plain search box) are switched on.
export const activeFilters = f => Object.keys(EMPTY_FILTER).filter(k => k !== 'search' && k !== 'sort' && f?.[k]).length

// The choices each dropdown offers, from the questions themselves.
export function filterChoices(list) {
  const uniq = k => [...new Set((list || []).map(q => String(q[k] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  return { setters: uniq('uploaded_by'), topics: uniq('topic') }
}

// list: questions; f: filter (see EMPTY_FILTER); offIds: ids of questions off the syllabus plan (filter problem 'off').
export function filterQuestions(list, f = EMPTY_FILTER, { offIds = null } = {}) {
  const s = String(f.search || '').trim().toLowerCase()
  const out = (list || []).filter(q => {
    if (s && ![q.question, q.topic, q.explanation, q.passage, q.uploaded_by, ...optsOf(q)].join(' ').toLowerCase().includes(s)) return false
    if (f.level === 'none' ? !!q.difficulty : f.level && q.difficulty !== f.level) return false
    if (f.setter && String(q.uploaded_by || '').trim() !== f.setter) return false
    if (f.topic === 'none' ? String(q.topic || '').trim() : f.topic && String(q.topic || '').trim() !== f.topic) return false
    const ex = !!String(q.explanation || '').trim(), fig = !!q.image_data
    if ((f.explain === 'yes' && !ex) || (f.explain === 'no' && ex)) return false
    if ((f.figure === 'yes' && !fig) || (f.figure === 'no' && fig)) return false
    if ((f.chosen === 'yes' && !q.in_paper) || (f.chosen === 'no' && q.in_paper)) return false
    if (f.problem === 'fix' && !hasProblem(q)) return false
    if (f.problem === 'off' && !(offIds && offIds.has(q.id))) return false
    return true
  })
  if (f.sort === 'hard') return [...out].sort((a, b) => (LEVEL_RANK[a.difficulty] ?? 3) - (LEVEL_RANK[b.difficulty] ?? 3))
  if (f.sort === 'easy') return [...out].sort((a, b) => (LEVEL_RANK[b.difficulty] ?? -1) - (LEVEL_RANK[a.difficulty] ?? -1))
  if (f.sort === 'setter') return [...out].sort((a, b) => String(a.uploaded_by || '').localeCompare(String(b.uploaded_by || '')))
  if (f.sort === 'newest') return [...out].reverse()
  return out
}

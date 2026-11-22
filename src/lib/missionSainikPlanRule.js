// missionSainikPlanRule.js — the Pre Mock upload rule.
//  1. A question must be on a chapter that the Syllabus Plan lists for that test and section (when the plan has one).
//  2. A section holds only `q` questions (25). Questions beyond the room left go to the Practice bank, tagged with their chapter.
const norm = x => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim()

// The plan's own spelling of a chapter, or null when the topic is not one of the planned chapters.
export const matchChapter = (chapters, topic) => (chapters || []).find(c => norm(c) === norm(topic)) || null

// list: questions being uploaded · chapters: planned for this test+section · defTopic: chapter picked / the only planned chapter · room: places left in the paper.
// Returns { error: 'chapter', bad, planned } or { paper, extra } (every question carries its planned chapter in `topic`).
export function routePreMock({ list, chapters = [], defTopic = '', room = 0 }) {
  const tagged = list.map(q => ({ ...q, topic: q.topic || defTopic || q.topic }))
  let fixed = tagged
  if (chapters.length) {
    const bad = tagged.filter(q => !matchChapter(chapters, q.topic))
    if (bad.length) return { error: 'chapter', bad, planned: chapters }
    fixed = tagged.map(q => ({ ...q, topic: matchChapter(chapters, q.topic) }))
  }
  const r = Math.max(0, room)
  return { paper: fixed.slice(0, r), extra: fixed.slice(r) }
}

// Questions that are NOT on the chapter planned for their test and section (untagged ones count). No plan -> nothing is off.
export const offPlan = (list, chapters = []) => (chapters.length ? (list || []).filter(q => !matchChapter(chapters, q.topic)) : [])

// Each Pre Mock section has exactly ONE chapter, the same for every teacher: 'ok' | 'none' (not planned yet) | 'multi' (more than one listed).
export const planState = (chapters = []) => (!chapters.length ? 'none' : chapters.length > 1 ? 'multi' : 'ok')

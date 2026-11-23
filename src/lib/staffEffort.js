// staffEffort.js — the staff board for the Practice Maker and the Pre Mock builder.
// For every setter: questions uploaded against their share, sections finished and verified, the mix of levels,
// achievement badges and a difficulty-weighted effort score. The "smart detector" compares each setter with the
// rest of the team, so a teacher who writes many hard questions stands out above one who writes many easy ones.
// Pure functions: no React, no database. The builder passes in what it already loaded.

export const LEVEL_POINTS = { Easy: 1, Medium: 2, Hard: 3 }
export const UNTAGGED_POINTS = 1            // a question with no level counts as easy until it is tagged
export const EXPLAIN_BONUS = 0.25           // a worked explanation is extra work

const levelOf = q => (LEVEL_POINTS[q?.difficulty] ? q.difficulty : '')
export const questionPoints = q => (LEVEL_POINTS[levelOf(q)] || UNTAGGED_POINTS) + (String(q?.explanation || '').trim() ? EXPLAIN_BONUS : 0)

const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const round1 = x => Math.round(x * 10) / 10

// assignments: [{ name, test_no, section, target }] — one row per setter per section they owe (target = questions they owe there).
// rows: the series' questions ({ uploaded_by, test_no, section, difficulty, explanation }).
// signoffs: [{ test_no, section }] sections marked verified.
// same(uploadedBy, panelName) → true when the upload belongs to that panel name.
export function staffBoard({ assignments = [], rows = [], signoffs = [], same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase() } = {}) {
  const people = new Map()
  const person = name => {
    if (!people.has(name)) people.set(name, { name, assigned: 0, target: 0, uploaded: 0, levels: { Easy: 0, Medium: 0, Hard: 0, untagged: 0 }, explained: 0, points: 0, secs: [], secsDone: 0, secsVerified: 0, assignedSecs: 0 })
    return people.get(name)
  }
  const verified = new Set(signoffs.map(s => s.test_no + '|' + s.section))
  assignments.forEach(a => { if (a?.name) person(a.name) })
  const names = [...people.keys()]
  // Who wrote each question: the panel name it belongs to, else the uploader's own name (an admin or a helper who is not on the panel).
  const owner = q => names.find(n => same(q.uploaded_by, n)) || String(q.uploaded_by || '').trim() || ''
  const mine = new Map()          // name|test|section → count
  rows.forEach(q => {
    const n = owner(q); if (!n) return
    const p = person(n), lv = levelOf(q)
    p.uploaded++; p.points += questionPoints(q)
    if (lv) p.levels[lv]++; else p.levels.untagged++
    if (String(q.explanation || '').trim()) p.explained++
    const k = n + '|' + q.test_no + '|' + q.section; mine.set(k, (mine.get(k) || 0) + 1)
  })
  assignments.forEach(a => {
    if (!a?.name) return
    const p = person(a.name), have = mine.get(a.name + '|' + a.test_no + '|' + a.section) || 0, target = Math.max(0, Number(a.target) || 0)
    const done = target > 0 && have >= target, ver = verified.has(a.test_no + '|' + a.section)
    p.assignedSecs++; p.target += target; p.assigned += Math.min(have, target)
    if (done) p.secsDone++
    if (ver) p.secsVerified++
    p.secs.push({ test_no: a.test_no, section: a.section, have, target, done, verified: ver })
  })
  const list = [...people.values()].map(p => {
    const tagged = p.uploaded - p.levels.untagged
    return {
      ...p,
      points: round1(p.points),
      progress: p.target ? Math.round((p.assigned / p.target) * 100) : (p.uploaded ? 100 : 0),
      hardShare: p.uploaded ? p.levels.Hard / p.uploaded : 0,
      easyShare: p.uploaded ? (p.levels.Easy + p.levels.untagged) / p.uploaded : 0,
      tagShare: p.uploaded ? tagged / p.uploaded : 0,
      explainShare: p.uploaded ? p.explained / p.uploaded : 0,
      avgLevel: p.uploaded ? round1(p.points / p.uploaded) : 0,
      onPanel: p.assignedSecs > 0,
    }
  })
  const active = list.filter(p => p.uploaded > 0)
  const med = median(active.map(p => p.points)), top = Math.max(0, ...list.map(p => p.points))
  const medProgress = median(list.filter(p => p.onPanel).map(p => p.progress))
  list.forEach(p => {
    p.index = med ? round1(p.points / med) : 0          // 1.0 = the team's middle; 2.0 = twice the effort of the middle setter
    p.badges = badgesOf(p)
    p.detector = detect(p, { med, top, medProgress, teamSize: active.length })
  })
  list.sort((a, b) => b.points - a.points || b.progress - a.progress || a.name.localeCompare(b.name))
  let rank = 0, last = null
  list.forEach((p, i) => { if (p.points !== last) { rank = i + 1; last = p.points } p.rank = p.uploaded ? rank : null })
  return { people: list, median: med, top, team: { uploaded: list.reduce((a, p) => a + p.uploaded, 0), target: list.reduce((a, p) => a + p.target, 0), points: round1(list.reduce((a, p) => a + p.points, 0)) } }
}

// Achievements a setter has earned (shown as chips; each with an icon, a label and why).
export function badgesOf(p) {
  const b = [], L = p.levels || {}, n = p.uploaded || 0
  if (n >= 1) b.push({ id: 'first', icon: '🌱', label: 'First upload', why: 'Uploaded a first question' })
  if (n >= 100) b.push({ id: 'century', icon: '💯', label: '100 club', why: `${n} questions uploaded` })
  else if (n >= 50) b.push({ id: 'fifty', icon: '🏅', label: '50 club', why: `${n} questions uploaded` })
  if ((p.secsDone || 0) >= 1) b.push({ id: 'finisher', icon: '✅', label: p.secsDone > 1 ? `${p.secsDone} sections done` : 'Section done', why: 'Finished the full share of a section' })
  if (p.assignedSecs && p.secsDone === p.assignedSecs) b.push({ id: 'allDone', icon: '🏆', label: 'All done', why: 'Every allotted section is complete' })
  if ((p.secsVerified || 0) >= 1) b.push({ id: 'verified', icon: '🛡️', label: 'Verified', why: `${p.secsVerified} section${p.secsVerified > 1 ? 's' : ''} passed verification` })
  if ((L.Hard || 0) >= 10) b.push({ id: 'hard', icon: '🧗', label: 'Hard hitter', why: `${L.Hard} hard questions` })
  if (n >= 10 && ['Easy', 'Medium', 'Hard'].every(k => (L[k] || 0) / n >= 0.2)) b.push({ id: 'balanced', icon: '⚖️', label: 'Balanced mix', why: 'At least a fifth of each level' })
  if (n >= 10 && (p.explained || 0) / n >= 0.9) b.push({ id: 'explainer', icon: '📝', label: 'Explainer', why: 'Explanations on 9 in 10 questions' })
  if (n >= 10 && (L.untagged || 0) === 0) b.push({ id: 'tagged', icon: '🏷️', label: 'Fully tagged', why: 'Every question has a level' })
  return b
}

// The smart detector: one verdict per setter, from effort compared with the team, the share of hard questions and progress.
export function detect(p, { med = 0, top = 0, medProgress = 0, teamSize = 0 } = {}) {
  const n = p.uploaded || 0
  if (!n) return p.onPanel ? { id: 'notStarted', tone: 'bad', label: 'Not started', why: 'No questions uploaded yet' } : null
  const hardWork = teamSize >= 2 ? p.points >= Math.max(1.25 * med, 0.8 * top) : p.progress >= 100
  const tough = n >= 10 && p.hardShare >= 0.3
  if (hardWork && tough) return { id: 'star', tone: 'gold', label: 'Hardworking · tough setter', why: `Top effort, and ${Math.round(p.hardShare * 100)}% of the questions are hard` }
  if (hardWork) return { id: 'hardworking', tone: 'ok', label: 'Hardworking', why: teamSize >= 2 ? `Effort ${p.index}× the team's middle setter` : 'Full share uploaded' }
  if (tough) return { id: 'tough', tone: 'ok', label: 'Tough setter', why: `${Math.round(p.hardShare * 100)}% hard questions` }
  if (n >= 10 && p.easyShare >= 0.7) return { id: 'easyHeavy', tone: 'warn', label: 'Mostly easy', why: `${Math.round(p.easyShare * 100)}% easy or untagged; add medium and hard questions` }
  if (p.onPanel && p.progress < 50 && medProgress >= 50) return { id: 'behind', tone: 'warn', label: 'Behind the team', why: `${p.progress}% of the share; the team's middle is ${medProgress}%` }
  return { id: 'steady', tone: 'info', label: 'Steady', why: 'On pace with the team' }
}

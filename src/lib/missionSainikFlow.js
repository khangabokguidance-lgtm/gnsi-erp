// missionSainikFlow.js — the Mission Sainik work flow, in the order the work actually happens.
// Each step opens one screen (tab). `tabs` lists every screen that belongs to the step, so the Back / Next bar knows where you are.
export const FLOW = [
  { id: 'plan',    icon: '📘', label: 'Plan chapters',   tab: 'syllabus',   tabs: ['syllabus'],                                               hint: 'Pick the chapter for every test and subject' },
  { id: 'assign',  icon: '👥', label: 'Assign setters',  tab: 'allotment',  tabs: ['allotment', 'panel'],                                     hint: 'Decide who sets and who verifies each paper' },
  { id: 'set',     icon: '✅', label: 'Set & verify',    tab: 'mine',       tabs: ['mine', 'practice', 'material'],                           hint: 'Set questions, then verify and approve them' },
  { id: 'build',   icon: '🧱', label: 'Build papers',    tab: 'prebuilder', tabs: ['prebuilder', 'megabuilder', 'dailybuilder', 'practicebuilder'], hint: 'Put approved questions into a printable paper' },
  { id: 'marks',   icon: '📝', label: 'Enter marks',     tab: 'marks',      tabs: ['marks'],                                                  hint: 'Type or import the marks after each test' },
  { id: 'analyse', icon: '📊', label: 'Analyse results', tab: 'premock',    tabs: ['premock', 'megamock', 'activity'],                        hint: 'See how every student and subject did' },
  { id: 'improve', icon: '💡', label: 'Improve',         tab: 'insights',   tabs: ['insights'],                                               hint: 'Weak chapters to revisit, trends and tips' },
]

export const stepOfTab = tab => FLOW.findIndex(s => s.tabs.includes(tab))

// Back / Next neighbours of a screen: [previous step | null, current step | null, next step | null]
export function flowNeighbors(tab) {
  const i = stepOfTab(tab)
  return i < 0 ? [null, null, null] : [FLOW[i - 1] || null, FLOW[i], FLOW[i + 1] || null]
}

// progress: { plan, assign, set, marks } each { done, total } (steps without a measurable total are omitted).
// Returns the steps with a status: 'done' | 'now' (the first unfinished step) | 'next', plus a short progress label.
export function flowStatus(progress = {}) {
  let nowSet = false
  return FLOW.map((s, i) => {
    const p = progress[s.id]
    const measurable = !!(p && p.total > 0)
    const done = measurable && p.done >= p.total
    let status = 'next'
    if (done) status = 'done'
    else if (!nowSet) { status = 'now'; nowSet = true }
    return { ...s, n: i + 1, status, pct: measurable ? Math.round((p.done / p.total) * 100) : null, label2: measurable ? `${p.done}/${p.total}` : '' }
  })
}

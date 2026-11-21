// missionSainikFlow.js — the Mission Sainik work flow, in the order the work actually happens.
// Each step opens one screen (tab). `tabs` lists every screen that belongs to the step, so the Back / Next bar knows where you are.
export const FLOW = [
  { id: 'panel',   icon: '🧑‍🏫', label: 'Panel & students', tab: 'panel',      tabs: ['panel', 'students'],                                       hint: 'Choose who sets questions and study material; check the student list' },
  { id: 'plan',    icon: '📘', label: 'Plan chapters',   tab: 'syllabus',   tabs: ['syllabus'],                                               hint: 'Pick the chapter for every test and subject' },
  { id: 'assign',  icon: '👥', label: 'Assign setters',  tab: 'allotment',  tabs: ['allotment'],                                              hint: 'Decide who sets and who verifies each paper' },
  { id: 'set',     icon: '✅', label: 'Questions & study material', tab: 'mine', tabs: ['mine', 'practice', 'material'],                      hint: 'Set questions and study material on the planned chapters, then verify and approve' },
  { id: 'build',   icon: '🧱', label: 'Build papers',    tab: 'prebuilder', tabs: ['prebuilder', 'megabuilder', 'dailybuilder', 'practicebuilder'], hint: 'Practice, Pre Mock and Mega Mock papers from approved questions' },
  { id: 'admit',   icon: '🪪', label: 'Admit cards',     tab: 'admit',      tabs: ['admit'],                                                  hint: 'Print admit cards for the mock test' },
  { id: 'marks',   icon: '📝', label: 'Enter marks',     tab: 'mockmarks',  tabs: ['mockmarks', 'marks'],                                     hint: 'Marks of every student who appeared; mark Absent' },
  { id: 'analyse', icon: '📊', label: 'Analyse scores',  tab: 'premock',    tabs: ['premock', 'megamock', 'activity'],                        hint: 'See how every student, subject and batch did' },
  { id: 'results', icon: '🏆', label: 'Results & certificates', tab: 'certs', tabs: ['certs'],                                              hint: 'Rank list, result sheet and merit certificates' },
  { id: 'improve', icon: '💡', label: 'Improve',         tab: 'insights',   tabs: ['insights'],                                               hint: 'Weak chapters to revisit, trends and tips' },
]

export const stepOfTab = (tab, flow = FLOW) => flow.findIndex(s => s.tabs.includes(tab))

// Back / Next neighbours of a screen: [previous step | null, current step | null, next step | null]
export function flowNeighbors(tab, flow = FLOW) {
  const i = stepOfTab(tab, flow)
  return i < 0 ? [null, null, null] : [flow[i - 1] || null, flow[i], flow[i + 1] || null]
}

// progress: { panel, plan, assign, set, marks } each { done, total } (steps without a measurable total are omitted).
// Returns the steps with a status: 'done' | 'now' (the first unfinished step) | 'next', plus a short progress label.
export function flowStatus(progress = {}, flow = FLOW) {
  let nowSet = false
  return flow.map((s, i) => {
    const p = progress[s.id]
    const measurable = !!(p && p.total > 0)
    const done = measurable && p.done >= p.total
    let status = 'next'
    if (done) status = 'done'
    else if (!nowSet) { status = 'now'; nowSet = true }
    return { ...s, n: i + 1, status, pct: measurable ? Math.round((p.done / p.total) * 100) : null, label2: measurable ? `${p.done}/${p.total}` : '' }
  })
}

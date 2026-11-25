// missionFoundationFlow.js — the Mission Foundation work flow, in the order the work happens (same shape as missionSainikFlow.js).
export const FOUNDATION_FLOW = [
  { id: 'schedule', icon: '🗓️', label: 'Schedule',        tab: 'schedule', tabs: ['schedule'],               hint: 'Create the 8 Monday tests and set chapters' },
  { id: 'teachers', icon: '🧑‍🏫', label: 'Teachers',        tab: 'teachers', tabs: ['teachers'],               hint: 'Who teaches and sets each subject' },
  { id: 'students', icon: '🎓', label: 'Students',        tab: 'students', tabs: ['students'],               hint: 'Every Udaan and Pragati student placed' },
  { id: 'teach',    icon: '📖', label: 'Teach',           tab: 'teaching', tabs: ['teaching', 'material'],   hint: 'Tick chapters as they are taught' },
  { id: 'papers',   icon: '✍️', label: 'Set & check papers', tab: 'mine',  tabs: ['mine', 'maker'],          hint: 'Set, check and approve every paper' },
  { id: 'conduct',  icon: '🛡️', label: 'Test day',        tab: 'conduct',  tabs: ['conduct', 'examkit'],     hint: 'Checklist, attendance and marks sheets' },
  { id: 'marks',    icon: '📝', label: 'Marks',           tab: 'marks',    tabs: ['marks'],                  hint: 'Enter all subjects, one batch at a time' },
  { id: 'results',  icon: '📊', label: 'Results',         tab: 'results',  tabs: ['results', 'analyser'],    hint: 'Rank list, report cards and analysis' },
  { id: 'prizes',   icon: '🏆', label: 'Prizes',          tab: 'prizes',   tabs: ['prizes'],                 hint: 'Winners, certificates, ceremony list' },
]

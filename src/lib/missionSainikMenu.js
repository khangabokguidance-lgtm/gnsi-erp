// missionSainikMenu.js — which screens of Mission Sainik each user sees. The admin sets it once (Admin → Menu) and it applies to every user
// at the same time. Pure and unit-tested. The admin always sees everything; Home and "How to use" are always on.
export const ALWAYS_ON = ['overview', 'guide']

// "certs,admit" → Set(['certs','admit']), ignoring the screens that can never be hidden.
export const hiddenFrom = value => new Set(String(value || '').split(',').map(x => x.trim()).filter(x => x && !ALWAYS_ON.includes(x) && x !== 'admin'))

// groups: NAV_GROUPS. The admin sees all; everyone else loses the hidden screens and the Admin screen (and any group left empty).
export function applyMenu(groups, hidden, isAdmin) {
  if (isAdmin) return groups
  return groups.map(g => ({ ...g, items: g.items.filter(i => i[0] !== 'admin' && !(hidden && hidden.has(i[0]))) })).filter(g => g.items.length)
}

export const visibleTabIds = groups => new Set(groups.flatMap(g => g.items.map(i => i[0])))

// Ready-made menus for the admin: the screens a person with that job needs. Everything not listed is hidden for staff.
export const MENU_PRESETS = [
  { key: 'all', label: 'Everything', show: null },
  { key: 'setters', label: 'Question setters', show: ['overview', 'syllabus', 'mine', 'practice', 'material', 'prebuilder', 'megabuilder', 'dailybuilder', 'practicebuilder', 'guide'] },
  { key: 'exam', label: 'Exam team', show: ['overview', 'schedule', 'mock', 'students', 'admit', 'marks', 'mockmarks', 'premock', 'megamock', 'certs', 'insights', 'guide'] },
]

// The set of hidden screens that a preset means, given every screen id.
export function hiddenForPreset(preset, allIds) {
  if (!preset || !preset.show) return new Set()
  return new Set(allIds.filter(id => !preset.show.includes(id) && !ALWAYS_ON.includes(id) && id !== 'admin'))
}

// The stored value for a set of hidden screens ('' when nothing is hidden).
export const hiddenToValue = hidden => [...hidden].sort().join(',')

// The flow (steps) for a user who cannot see every screen: a step uses its first visible screen, and a step with none disappears.
export function visibleFlow(flow, visible) {
  return flow.map(step => {
    const tab = [step.tab, ...step.tabs].find(t => visible.has(t))
    return tab ? { ...step, tab, tabs: step.tabs.filter(t => visible.has(t)) } : null
  }).filter(Boolean)
}

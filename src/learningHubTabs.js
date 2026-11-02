// learningHubTabs.js — the modules that live inside the single "Learning Hub" module (id 'learninghub').
// They stay separate permission keys in the admin matrix: a user sees a tab only if they may read that
// module, and the Learning Hub menu entry shows when they can open at least one of them.
export const HUB_ID = 'learninghub'
export const HUB_TABS = ['studymaterial', 'classmaterial', 'teachingaids', 'studylockers', 'questionbank', 'questionbankviewer', 'entrance', 'modelsets', 'setmaker']
export const isHubTab = (id) => HUB_TABS.includes(id)

// Tabs that CREATE or RUN things (add questions, run entrance exams, print papers). Ordinary staff do not need
// them for teaching, so they are hidden unless the admin gave that user add / edit / delete rights on the tab —
// read access alone is not enough. Everything else is view content (materials, viewers, model sets).
export const MANAGE_TABS = ['questionbank', 'entrance', 'setmaker']

// p = { read, add, edit, delete } the signed-in (non-admin) user holds for the tab's module key.
export const hubTabAllowed = (id, p) => {
  if (!p || p.read !== true) return false
  if (!MANAGE_TABS.includes(id)) return true
  return p.add === true || p.edit === true || p.delete === true
}
export const canSeeHub = (can) => HUB_TABS.some((id) => can(id))

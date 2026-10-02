// learningHubTabs.js — the five modules that now live inside the single
// "Learning Hub" module (id 'learninghub'). They stay separate permission keys
// in the admin matrix: a user sees a tab only if they may read that module, and
// the Learning Hub menu entry shows when they can read at least one of them.
export const HUB_ID = 'learninghub'
export const HUB_TABS = ['studymaterial', 'teachingaids', 'questionbank', 'questionbankviewer', 'entrance']
export const isHubTab = (id) => HUB_TABS.includes(id)
export const canSeeHub = (can) => HUB_TABS.some((id) => can(id))

import test from 'node:test'
import assert from 'node:assert/strict'
import { NAV_GROUPS } from '../src/lib/missionSainikNav.js'
import { FLOW } from '../src/lib/missionSainikFlow.js'
import { hiddenFrom, applyMenu, visibleTabIds, MENU_PRESETS, hiddenForPreset, hiddenToValue, visibleFlow } from '../src/lib/missionSainikMenu.js'

const ids = g => g.flatMap(x => x.items.map(i => i[0]))
const ALL = ids(NAV_GROUPS)

test('hiddenFrom parses the stored value and never hides Home, How to use or Admin', () => {
  assert.deepEqual([...hiddenFrom('certs, admit ,,overview,guide,admin')], ['certs', 'admit'])
  assert.equal(hiddenFrom('').size, 0); assert.equal(hiddenFrom(null).size, 0)
})

test('the admin sees every screen; staff lose the hidden ones and empty groups disappear', () => {
  const hidden = hiddenFrom('certs,admit')
  assert.equal(applyMenu(NAV_GROUPS, hidden, true), NAV_GROUPS)
  const staff = applyMenu(NAV_GROUPS, hidden, false)
  assert.ok(!ids(staff).includes('certs') && !ids(staff).includes('admit') && ids(staff).includes('premock'))
  const noHelp = applyMenu(NAV_GROUPS, new Set(['mine', 'practice', 'material']), false)
  assert.ok(!noHelp.some(g => g.title === 'My work'))                       // a group with nothing left is dropped
  assert.deepEqual(ids(applyMenu(NAV_GROUPS, new Set(), false)), ALL.filter(id => id !== 'admin'))   // nothing hidden: staff still never get Admin
})

test('presets: Everything hides nothing; Question setters and Exam team keep only their screens (plus Home and the guide)', () => {
  const by = Object.fromEntries(MENU_PRESETS.map(p => [p.key, p]))
  assert.equal(hiddenForPreset(by.all, ALL).size, 0)
  const setters = applyMenu(NAV_GROUPS, hiddenForPreset(by.setters, ALL), false)
  assert.deepEqual(ids(setters).sort(), [...by.setters.show].sort())
  const exam = applyMenu(NAV_GROUPS, hiddenForPreset(by.exam, ALL), false)
  assert.ok(ids(exam).includes('admit') && ids(exam).includes('certs') && !ids(exam).includes('prebuilder') && ids(exam).includes('overview'))
  MENU_PRESETS.filter(p => p.show).forEach(p => p.show.forEach(id => assert.ok(ALL.includes(id), id)))   // every preset screen exists
})

test('the stored value round-trips', () => {
  const h = hiddenFrom('mine,certs')
  assert.equal(hiddenToValue(h), 'certs,mine'); assert.deepEqual([...hiddenFrom(hiddenToValue(h))].sort(), ['certs', 'mine'])
  assert.equal(hiddenToValue(new Set()), '')
})

test('the flow follows the menu: a step uses its first visible screen and drops out when it has none', () => {
  const vis = visibleTabIds(applyMenu(NAV_GROUPS, hiddenFrom('prebuilder,megabuilder,dailybuilder,practicebuilder,admit,certs,mockmarks'), false))
  const flow = visibleFlow(FLOW, vis)
  assert.ok(!flow.some(s => s.id === 'build' || s.id === 'admit' || s.id === 'results'))
  assert.equal(flow.find(s => s.id === 'marks').tab, 'marks')                 // mockmarks is hidden, class test marks is not
  assert.equal(visibleFlow(FLOW, visibleTabIds(NAV_GROUPS)).length, FLOW.length)
})

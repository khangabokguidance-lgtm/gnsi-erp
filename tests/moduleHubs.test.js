// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { MODULE_HUBS, HUB_BY_ID, HUB_OF, hubTabs, visibleHubTabs } from '../src/moduleHubs.js'
import { HUB_TABS } from '../src/learningHubTabs.js'

test('every module lives in at most one hub, and no tab is itself a hub', () => {
  const ids = MODULE_HUBS.flatMap(hubTabs).map(t => t.id)
  assert.equal(new Set(ids).size, ids.length)
  ids.forEach(id => assert.ok(!HUB_BY_ID[id], `${id} is a hub id`))
  ids.forEach(id => assert.ok(!HUB_TABS.includes(id), `${id} is also a Learning Hub tab`))
  ids.forEach(id => assert.equal(HUB_BY_ID[HUB_OF[id]].groups.flatMap(g => g.tabs).some(t => t.id === id), true))
})

test('a hub shows the tabs the user may open; admin-only tabs need an admin', () => {
  const students = HUB_BY_ID.studentshub
  const can = id => ['students', 'student360', 'bulkadmission'].includes(id)
  assert.deepEqual(visibleHubTabs(students, can, false), ['students', 'bulkadmission'])
  assert.deepEqual(visibleHubTabs(students, can, true), ['students', 'student360', 'bulkadmission'])
  assert.deepEqual(visibleHubTabs(HUB_BY_ID.adminhub, id => id === 'admin', false), [], 'admin page alone does not show the hub to a non-admin')
})

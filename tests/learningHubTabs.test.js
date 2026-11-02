import test from 'node:test'
import assert from 'node:assert/strict'
import { HUB_TABS, MANAGE_TABS, hubTabAllowed, canSeeHub } from '../src/learningHubTabs.js'

const R = { read: true }, RW = { read: true, edit: true }
test('no read access → never shown', () => {
  HUB_TABS.forEach((id) => { assert.equal(hubTabAllowed(id, undefined), false); assert.equal(hubTabAllowed(id, { read: false, add: true }), false) })
})
test('view tabs open on read access alone', () => {
  ;['studymaterial', 'classmaterial', 'teachingaids', 'studylockers', 'questionbankviewer', 'modelsets'].forEach((id) => assert.equal(hubTabAllowed(id, R), true, id))
})
test('create / run tabs need edit-type rights as well as read', () => {
  assert.deepEqual(MANAGE_TABS, ['questionbank', 'entrance', 'setmaker'])
  MANAGE_TABS.forEach((id) => { assert.equal(hubTabAllowed(id, R), false, id); assert.equal(hubTabAllowed(id, RW), true, id); assert.equal(hubTabAllowed(id, { read: true, add: true }), true); assert.equal(hubTabAllowed(id, { read: true, delete: true }), true) })
})
test('hub menu shows only when a tab is allowed', () => {
  const perm = { questionbank: R, entrance: R, setmaker: R }
  assert.equal(canSeeHub((k) => hubTabAllowed(k, perm[k])), false)
  assert.equal(canSeeHub((k) => hubTabAllowed(k, { ...perm, classmaterial: R }[k])), true)
})

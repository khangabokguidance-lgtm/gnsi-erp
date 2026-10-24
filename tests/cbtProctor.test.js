import test from 'node:test'
import assert from 'node:assert/strict'
import { proctorOf, classify, yawRatio, createTracker, isShotKey, isBlockedKey, addEvent, faceStrikes, flagTotal, flagText } from '../src/lib/cbtProctorLogic.js'

test('the setting is read from marking.proctor, defaults to off', () => {
  assert.deepEqual(proctorOf({ marking: { correct: 1 } }), { camera: 'off', shield: false, maxStrikes: 5 })
  assert.deepEqual(proctorOf({ marking: { proctor: { camera: 'strict', shield: true, maxStrikes: 3 } } }), { camera: 'strict', shield: true, maxStrikes: 3 })
  assert.equal(proctorOf({ marking: { proctor: { camera: 'bogus' } } }).camera, 'off')
})

test('faces are classified: none, one, a second person near, head turned', () => {
  assert.equal(classify([]), 'none')
  assert.equal(classify([{ w: 200, ratio: 0.5 }]), 'ok')
  assert.equal(classify([{ w: 200, ratio: 0.5 }, { w: 120, ratio: 0.5 }]), 'multi')
  assert.equal(classify([{ w: 200, ratio: 0.5 }, { w: 30, ratio: 0.5 }]), 'ok', 'a tiny far-away face (poster) is not a person next to the candidate')
  assert.equal(classify([{ w: 200, ratio: 0.12 }]), 'away')
  assert.equal(classify([{ w: 200, ratio: 0.88 }]), 'away')
})

test('yaw ratio comes from the jaw ends and nose tip', () => {
  const pts = Array.from({ length: 68 }, () => ({ x: 0, y: 0 }))
  pts[0].x = 100; pts[16].x = 200; pts[30].x = 150
  assert.equal(yawRatio(pts), 0.5)
  pts[30].x = 110
  assert.ok(yawRatio(pts) < 0.3)
  assert.equal(yawRatio([]), null)
})

test('a condition must last before it is a violation, and repeats only every 10 s', () => {
  const tr = createTracker()
  assert.equal(tr.push('ok', 0).event, null)
  assert.equal(tr.push('none', 1000).event, null)
  assert.equal(tr.push('none', 3500).event, null, '2.5 s: still a blink')
  assert.equal(tr.push('none', 4200).event, 'none', '3.2 s: raised')
  assert.equal(tr.push('none', 6000).event, null, 'not again straight away')
  assert.equal(tr.push('none', 14500).event, 'none', 'still there 10 s later: another strike')
  assert.equal(tr.push('ok', 15000).event, null)
  assert.equal(tr.push('multi', 16000).event, null)
  assert.equal(tr.push('multi', 18100).event, 'multi', 'a second person is raised after 2 s')
  assert.equal(tr.push('away', 19000).event, null); assert.equal(tr.push('away', 23900).event, null); assert.equal(tr.push('away', 24100).event, 'away')
})

test('screenshot and blocked shortcuts are recognised', () => {
  assert.ok(isShotKey({ key: 'PrintScreen' }))
  assert.ok(isShotKey({ key: 'S', metaKey: true, shiftKey: true }))
  assert.ok(isShotKey({ key: '4', metaKey: true, shiftKey: true }))
  assert.ok(!isShotKey({ key: 's', ctrlKey: true }))
  assert.ok(isBlockedKey({ key: 'c', ctrlKey: true })); assert.ok(isBlockedKey({ key: 'F12' })); assert.ok(isBlockedKey({ key: 'I', ctrlKey: true, shiftKey: true }))
  assert.ok(!isBlockedKey({ key: 'a' })); assert.ok(!isBlockedKey({ key: '1' }))
})

test('events are counted and the log is capped', () => {
  let p = null
  for (let i = 0; i < 50; i++) p = addEvent(p, 'none', i)
  p = addEvent(p, 'shot', 99); p = addEvent(p, 'multi', 100)
  assert.equal(p.log.length, 40); assert.equal(faceStrikes(p), 51); assert.equal(flagTotal(p), 52)
  assert.match(flagText(p), /Face not visible ×50.*More than one person ×1.*Screenshot attempt ×1/)
  assert.equal(flagText(null), '')
})

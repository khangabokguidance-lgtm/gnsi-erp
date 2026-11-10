import test from 'node:test'
import assert from 'node:assert/strict'
import { proctorOf, classify, yawRatio, createTracker, isShotKey, isBlockedKey, addEvent, faceStrikes, flagTotal, flagText } from '../src/lib/cbtProctorLogic.js'

test('the setting is read from marking.proctor, defaults to off', () => {
  assert.deepEqual(proctorOf({ marking: { correct: 1 } }), { camera: 'off', shield: false, maxStrikes: 5, fullscreen: 'off', maxFsExits: 3 })
  assert.deepEqual(proctorOf({ marking: { proctor: { camera: 'strict', shield: true, maxStrikes: 3 } } }), { camera: 'strict', shield: true, maxStrikes: 3, fullscreen: 'off', maxFsExits: 3 })
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
  assert.equal(tr.push('away', 19000).event, null); assert.equal(tr.push('away', 22900).event, null); assert.equal(tr.push('away', 23100).event, 'away', 'looking away is raised after 4 s (was 5)')
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

import { streamHealth, isVirtualCamera, AWAY_LOW, AWAY_HIGH, MIN_FACE_FRACTION, HOLD_SECONDS, EVENT_LABEL } from '../src/lib/cbtProctorLogic.js'

test('tighter away window: a third of the way round already counts', () => {
  assert.equal(AWAY_LOW, 0.33); assert.equal(AWAY_HIGH, 0.67)
  for (const [r, want] of [[0.5, 'ok'], [0.35, 'ok'], [0.65, 'ok'], [0.32, 'away'], [0.68, 'away'], [0.2, 'away'], [0.9, 'away']]) assert.equal(classify([{ w: 200, ratio: r }]), want, String(r))
})
test('a face that is too small in the frame is "far", but only when the frame width is known', () => {
  assert.equal(MIN_FACE_FRACTION, 0.12)
  assert.equal(classify([{ w: 60, ratio: 0.5 }], 640), 'far')           // 9% of 640
  assert.equal(classify([{ w: 90, ratio: 0.5 }], 640), 'ok')            // 14%
  assert.equal(classify([{ w: 60, ratio: 0.5 }]), 'ok')                 // no frame width given: as before
  assert.equal(classify([], 640), 'none')
})
test('a frozen, paused or muted camera is a stopped camera, a healthy one is not', () => {
  const base = { readyState: 4, paused: false, muted: false, trackLive: true, lastAdvance: 10000, now: 11000 }
  assert.equal(streamHealth(base), 'ok')
  assert.equal(streamHealth({ ...base, now: 14500 }), 'nocam', 'no new frame for 4.5 s')
  assert.equal(streamHealth({ ...base, muted: true }), 'nocam')
  assert.equal(streamHealth({ ...base, trackLive: false }), 'nocam')
  assert.equal(streamHealth({ ...base, readyState: 1, now: 11500 }), 'ok', 'a short hiccup is tolerated')
  assert.equal(streamHealth({ ...base, readyState: 1, now: 15000 }), 'nocam')
  assert.equal(streamHealth({ ...base, paused: true, now: 15000 }), 'nocam')
})
test('virtual cameras are recognised, real ones are not', () => {
  for (const l of ['OBS Virtual Camera', 'ManyCam Virtual Webcam', 'Snap Camera', 'XSplit VCam', 'Streamlabs Virtual Camera', 'mmhmm', 'NDI Webcam']) assert.equal(isVirtualCamera(l), true, l)
  for (const l of ['Integrated Webcam', 'FaceTime HD Camera', 'USB2.0 HD UVC WebCam', 'HD Pro Webcam C920', 'Front Camera', 'camera2 1, facing front', '', undefined]) assert.equal(isVirtualCamera(l), false, String(l))
})
test('a stopped camera counts as a strike after 4 s and repeats; far counts after 3 s; new kinds are labelled and counted', () => {
  const tr = createTracker()
  assert.equal(tr.push('nocam', 0).event, null)
  assert.equal(tr.push('nocam', 3000).event, null)
  assert.equal(tr.push('nocam', 4100).event, 'nocam')
  assert.equal(tr.push('nocam', 9000).event, null)
  assert.equal(tr.push('nocam', 14200).event, 'nocam')
  const t2 = createTracker(); t2.push('far', 0); assert.equal(t2.push('far', 3100).event, 'far')
  assert.deepEqual(HOLD_SECONDS, { none: 3, far: 3, multi: 2, away: 4, nocam: 4 })
  assert.ok(EVENT_LABEL.far && EVENT_LABEL.vcam)
  const p = addEvent(addEvent(addEvent(null, 'far'), 'vcam'), 'nocam')
  assert.equal(faceStrikes(p), 2, 'far + nocam are strikes; a recorded virtual camera is not')
  assert.match(flagText(p), /Too far from the camera ×1/); assert.match(flagText(p), /Virtual camera ×1/)
})


import { iou, mergeFaces, createExtraMemory, NEAR_FRACTION_DEEP } from '../src/lib/cbtProctorLogic.js'
const bx = (x, y, w, h = w) => ({ x, y, w, h })
test('two models, one verdict: a face both saw is counted once, one only the second model saw is added', () => {
  assert.equal(iou(bx(0, 0, 100), bx(0, 0, 100)), 1); assert.equal(iou(bx(0, 0, 100), bx(200, 0, 100)), 0)
  const primary = [{ w: 200, ratio: 0.5, box: bx(100, 100, 200) }]
  assert.equal(mergeFaces(primary, [{ w: 190, box: bx(110, 105, 190) }]).length, 1, 'same face from both models')
  const m = mergeFaces(primary, [{ w: 190, box: bx(110, 105, 190) }, { w: 50, box: bx(450, 300, 50) }])
  assert.equal(m.length, 2); assert.equal(m[1].deep, true); assert.equal(m[1].ratio, null)
  assert.equal(mergeFaces([], [{ w: 90, box: bx(10, 10, 90) }]).length, 1, 'the second model rescues a face the fast one missed')
  assert.equal(mergeFaces(null, null).length, 0)
})
test('a small second face counts when the second model confirmed it, but not when only the fast model saw it', () => {
  assert.equal(NEAR_FRACTION_DEEP, 0.18)
  const one = { w: 200, ratio: 0.5, box: bx(0, 0, 200) }
  assert.equal(classify([one, { w: 45, ratio: null, deep: true, box: bx(300, 0, 45) }]), 'multi', '22% of the candidate, confirmed')
  assert.equal(classify([one, { w: 45, ratio: 0.5, box: bx(300, 0, 45) }]), 'ok', 'same size, fast model only: still ignored')
  assert.equal(classify([one, { w: 30, ratio: null, deep: true, box: bx(300, 0, 30) }]), 'ok', '15%: a poster / far background')
})
test('several small faces are "more than one person", not "too far"', () => {
  const f = w => ({ w, ratio: 0.5, box: bx(0, 0, w) })
  assert.equal(classify([f(96), f(93), f(94), f(94)], 1366), 'multi')
  assert.equal(classify([f(60)], 640), 'far')
})
test('the second look is remembered for a few frames, then forgotten — independent of how slow the device is', () => {
  const m = createExtraMemory(); assert.equal(m.get().length, 0, 'nothing before the first look')
  m.set([{ w: 50 }]); assert.equal(m.get().length, 1)
  m.next(); m.next(); m.next(); assert.equal(m.get().length, 1, 'still kept 3 frames later')
  m.next(); assert.equal(m.get().length, 0, 'forgotten after that')
  m.set([{ w: 50 }]); m.clear(); assert.equal(m.get().length, 0)
})

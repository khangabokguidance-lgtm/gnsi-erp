import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyTest, numbersIn } from '../src/lib/cbtVerify.js'
import { buildTest, attachImages } from '../src/lib/cbtPaper.js'

const opt = (k, text, textMm = text) => ({ key: k, text, textMm })
const four = (...t) => ['A', 'B', 'C', 'D'].map((k, i) => { const x = t[i] ?? `o${i}`; return opt(k, x, x.replace(/[a-z]+/gi, 'ꯑ')) })
const q = (no, o = {}) => ({ no, figure: false, text: 'Question text about a shelter', textMm: 'ꯃꯦꯅ ꯇꯦꯛꯁꯠ', options: four('a1', 'b2', 'c3', 'd4'), passage: '', passageMm: '', image: null, images: [], figHash: [], figHashMm: [], answer: null, ...o })
const verify = (...qs) => verifyTest([{ id: 's1', questions: qs }])
const msgs = (v, no) => v.byNo.get(no).problems.map(p => p.msg).join(' | ')

test('numbers are compared across languages, Meitei Mayek digits included', () => {
  assert.deepEqual(numbersIn('12 and 1,500 and 3.5'), ['12', '1500', '3.5'])
  assert.deepEqual(numbersIn('꯱꯲ ꯵'), ['12', '5'])
})

test('a clean question passes', () => {
  const v = verify(q(1))
  assert.equal(v.items[0].status, 'ok'); assert.deepEqual(v.counts, { ok: 1, warn: 0, error: 0 })
})

test('numbers that differ between English and Meitei Mayek flag a shifted translation', () => {
  const v = verify(q(2, { text: 'The prime factors of 420 are', textMm: 'ꯃꯦꯅ 120 ꯇꯦꯛꯁꯠ' }))
  assert.equal(v.byNo.get(2).status, 'warn'); assert.match(msgs(v, 2), /Numbers differ between the languages: English 420 · Meitei Mayek 120/)
  const o = verify(q(3, { options: [opt('A', '2 × 3', '2 × 3'), opt('B', '5', '6'), opt('C', 'x', 'ꯑ'), opt('D', 'y', 'ꯑ')] }))
  assert.match(msgs(o, 3), /Option \(B\) numbers differ/)
})

test('errors: no text, wrong option count, empty option, figure question without a picture', () => {
  assert.equal(verify(q(4, { text: '' })).byNo.get(4).status, 'error')
  assert.match(msgs(verify(q(5, { options: four('a', 'b', 'c').slice(0, 3) })), 5), /3 options found, 4 expected/)
  assert.match(msgs(verify(q(6, { options: [opt('A', ''), opt('B', 'b'), opt('C', 'c'), opt('D', 'd')] })), 6), /Option \(A\) is empty/)
  assert.match(msgs(verify(q(7, { figure: true, text: '', options: [] })), 7), /figure question with no picture/)
  assert.equal(verify(q(8, { figure: true, text: '', options: four(), image: 'data:x', images: ['data:x'] })).byNo.get(8).status, 'ok')
})

test('the two papers must carry the same picture for a question', () => {
  const fig = o => q(9, { figure: true, text: '', textMm: '', options: four(), image: 'd', images: ['d'], ...o })
  assert.equal(verify(fig({ figHash: ['h1'], figHashMm: ['h1'] })).byNo.get(9).status, 'ok')
  assert.match(msgs(verify(fig({ figHash: ['h1'], figHashMm: ['h2'] })), 9), /different picture/)
  assert.match(msgs(verify(fig({ figHash: ['h1'], figHashMm: [] })), 9), /Meitei Mayek paper has no picture/)
})

test('Meitei Mayek problems: missing, untranslated, unconverted, passage in one language only', () => {
  assert.match(msgs(verify(q(10), q(11, { textMm: '' })), 11), /No Meitei Mayek text/)
  assert.match(msgs(verify(q(12, { text: 'What is a shelter', textMm: 'What is a shelter' })), 12), /same as the English/)
  assert.match(msgs(verify(q(13, { text: 'What is a shelter', textMm: 'sheLtr kri ni sheLtr hOjiKkaNgi' })), 13), /mostly Latin letters/)
  assert.match(msgs(verify(q(14, { passage: 'Long English passage text here' })), 14), /no Meitei Mayek passage/)
  assert.match(msgs(verify(q(15, { passageMm: 'ꯄꯦꯁꯦꯖ' })), 15), /Meitei Mayek passage but no English/)
})

test('a repeated question and identical options are noticed', () => {
  const v = verify(q(16, { text: 'What is the primary purpose of a shelter?' }), q(17, { text: 'What is the primary purpose of a shelter?' }))
  assert.match(msgs(v, 17), /Same question text as Q16/)
  assert.match(msgs(verify(q(18, { options: [opt('A', 'same'), opt('B', 'same'), opt('C', 'c'), opt('D', 'd')] })), 18), /Options \(A\) and \(B\) have the same text/)
})

test('without a second language nothing is demanded of it', () => {
  const v = verify(q(19, { textMm: '', options: [opt('A', 'a', ''), opt('B', 'b', ''), opt('C', 'c', ''), opt('D', 'd', '')] }))
  assert.equal(v.hasMm, false); assert.equal(v.items[0].status, 'ok')
})

test('pictures follow the question they sit under, not their order in the file', () => {
  const pic = h => ({ dataUrl: `data:${h}`, hash: h })
  const en = [
    { text: 'Q1.', images: [] }, { text: '', images: [pic('one')] },
    { text: 'Q2.', images: [pic('two')] },            // picture inside the Q line's own paragraph
    { text: 'Q3. Which is bigger?', images: [] }, { text: '(A) 1 (B) 2', images: [] }, { text: '(C) 3 (D) 4', images: [pic('three')] }, // a diagram after the options
    { text: 'Q4.', images: [] },                      // a figure question that lost its picture
  ]
  const { sections, warnings } = buildTest(en)
  const byNo = n => sections.flatMap(s => s.questions).find(x => x.no === n)
  assert.deepEqual([1, 2, 3, 4].map(n => byNo(n).images.length), [1, 1, 1, 0])
  assert.equal(byNo(1).image, 'data:one'); assert.equal(byNo(2).image, 'data:two'); assert.equal(byNo(3).image, 'data:three')
  assert.equal(byNo(1).figure, true); assert.equal(byNo(3).figure, false)
  assert.deepEqual(byNo(2).figHash, ['two'])
  assert.ok(attachImages(sections, []).some(w => /Question 4 looks like a figure question/.test(w)))
  // a picture before any question (a logo) is left out and reported
  assert.ok(buildTest([{ text: '', images: [pic('logo')] }, { text: 'Q1. a', images: [] }]).warnings.some(w => /1 picture sit outside any question/.test(w)))
})

test('a question the admin marked "looks fine" is accepted, unless it has an error', () => {
  const warn = q(20, { text: 'The prime factors of 420 are', textMm: 'ꯃꯦꯅ 120 ꯇꯦꯛꯁꯠ', reviewed: true })
  assert.equal(verify(warn).items[0].status, 'ok'); assert.equal(verify(warn).items[0].reviewed, true)
  assert.equal(verify({ ...warn, text: '' }).items[0].status, 'error')
})

test('a page footer is never read as part of an option', () => {
  const { sections } = buildTest(['Q1. a question here', '(A) one', '(B) two', '(C) three', '(D) four', 'pesej-3', 'Page - 4', 'Q2. next', '(A) a', '(B) b', '(C) c', '(D) d'])
  assert.deepEqual(sections[0].questions[0].options.map(o => o.text), ['one', 'two', 'three', 'four'])
})

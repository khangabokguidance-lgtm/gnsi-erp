import test from 'node:test'
import assert from 'node:assert/strict'
import { questionsToNotes } from '../src/lib/questionNotes.js'
import { renderMaterial, materialDocHtml } from '../src/lib/materialMarkup.js'

const q = (n, extra = {}) => ({ id: n, question: `What is ${n} + ${n}?`, option_a: `${n}`, option_b: `${n * 2}`, option_c: `${n * 3}`, option_d: `${n * 4}`, answer: 'B', explanation: 'Add them.', ...extra })

test('numbers from the start value and includes answers only when asked', () => {
  const t = questionsToNotes([q(1), q(2)], { answers: false, start: 5 })
  assert.ok(t.includes('Q5. What is 1 + 1?') && t.includes('Q6. What is 2 + 2?'))
  assert.ok(!t.includes('Answer:'))
  assert.ok(questionsToNotes([q(1)], { answers: true }).includes('Answer: B) 2'))
})

test('explanations and passages and figures are added as notes', () => {
  const t = questionsToNotes([q(1, { passage: 'A long passage', image_data: 'data:image/jpeg;base64,AAAA' })], { answers: true, explain: true })
  assert.ok(t.includes('> Note: Passage — A long passage') && t.includes('[[img:data:image/jpeg;base64,AAAA|Figure]]') && t.includes('> Note: Add them.'))
})

test('the same passage is printed once for a run of questions', () => {
  const t = questionsToNotes([q(1, { passage: 'P' }), q(2, { passage: 'P' })], {})
  assert.equal((t.match(/Passage — P/g) || []).length, 1)
})

test('the notes render as question, options grid and answer pill', () => {
  const html = renderMaterial(questionsToNotes([q(1), q(2)], { answers: true }))
  assert.equal((html.match(/<p class="q">/g) || []).length, 2)
  assert.equal((html.match(/class="op"/g) || []).length, 8)
  assert.equal((html.match(/class="ans"/g) || []).length, 2)
})

test('fractions and a picture option survive the round trip', () => {
  const html = renderMaterial(questionsToNotes([q(1, { option_a: '\\frac{1}{2}', option_b: '[[img:data:image/jpeg;base64,AAAA]]', answer: 'B' })], { answers: true }))
  assert.ok(html.includes('class="fr"') && html.includes('<img class="oi"'))
  assert.ok(!html.includes('IMG'))
})

test('a whole paper builds into a printable document', () => {
  const d = materialDocHtml({ title: 'Paper', body: '**Time:** 30 min\n\n## Maths\n\n' + questionsToNotes([q(1)], { answers: false }), uploaded_by: 'Sir X' }, { institute: 'Acme', author: { name: 'Sir X', designation: 'Teacher' } })
  assert.ok(d.includes('Prepared by <b>Sir X</b>, Teacher') && d.includes('class="opts ') && d.includes('>Maths</h2>'))
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { splitOptions, fractionsIn, looksBmei, smartFormat, figureQuestions, insertFigureAfterQuestion, paragraphsToNotes } from '../src/lib/smartNotes.js'

test('options run together on one line are split', () => {
  assert.deepEqual(splitOptions('(a) Freezing    (b) Condensation'), [['a', 'Freezing'], ['b', 'Condensation']])
  assert.deepEqual(splitOptions('(c) Evaporation (d) Precipitation'), [['c', 'Evaporation'], ['d', 'Precipitation']])
  assert.deepEqual(splitOptions('(A) 50(B) 100(C) 49(D) 99'), [['A', '50'], ['B', '100'], ['C', '49'], ['D', '99']])
  assert.deepEqual(splitOptions('a) 1/2 b) 3/4 c) 1 d) 2'), [['a', '1/2'], ['b', '3/4'], ['c', '1'], ['d', '2']])
})

test('ordinary words in brackets are not options', () => {
  assert.equal(splitOptions('Water (a) is wet'), null)
  assert.equal(splitOptions('The answer is (b) here'), null)
  assert.deepEqual(splitOptions('(a) Plan (x) is good'), [['a', 'Plan (x) is good']])
  assert.deepEqual(splitOptions('(a) Plan (c) skips b'), [['a', 'Plan (c) skips b']])   // letters must run in order
})

test('fractions: 3/4 and 2 1/2 become fractions, dates and units do not', () => {
  assert.equal(fractionsIn('Add 1/2 and 3/4').text, 'Add \\frac{1}{2} and \\frac{3}{4}')
  assert.equal(fractionsIn('2 1/2 litres').text, '2\\frac{1}{2} litres')
  assert.equal(fractionsIn('On 12/12/2026 at 60 km/h').text, 'On 12/12/2026 at 60 km/h')
  assert.equal(fractionsIn('and/or either/or').count, 0)
  assert.equal(fractionsIn('\\frac{1}{2} already').count, 0)
})

test('Bmei04 text that lost its font is recognised; English and acronyms are not', () => {
  assert.ok(looksBmei('wahx HudiZmKt paUHuM mri'))
  assert.ok(looksBmei('kr_os sruK mteK'))
  assert.ok(!looksBmei('Water changing into water vapour on heating is called:'))
  assert.ok(!looksBmei('GUIDANCE NAVODAYA & SAINIK INSTITUTE (GNSI)'))
  assert.ok(!looksBmei('Use an iPhone or YouTube'))
  assert.ok(!looksBmei('ꯃꯅꯤꯄꯨꯔꯤ ꯃꯅꯤꯄꯨꯔꯤ'))
})

const SAMPLE = `GUIDANCE NAVODAYA & SAINIK INSTITUTE (GNSI), KHANGABOK
Mission Sainik 2027 · AISSEE Class VI · GK 11 – Evaporation, Condensation & Water Cycle
Name: ______________________ 50 Questions Roll No.: ______ Score: ___/50

A. Evaporation
1. Water changing into water vapour on heating is called:
(a) Freezing    (b) Condensation
(c) Evaporation (d) Precipitation
2. Evaporation of a liquid takes place from its:
(a) middle only (b) surface
(c) bottom only (d) whole body
3. What fraction of the Earth is water? Choose 3/4 or 1/4.
a) 1/2 b) 3/4
c) 1/4 d) 1/3`

test('the pasted sheet: each option on its own line, "A. Evaporation" is a heading', () => {
  const { text, report } = smartFormat(SAMPLE)
  const lines = text.split('\n')
  assert.ok(lines.includes('### A. Evaporation'))
  assert.ok(lines.includes('(a) Freezing') && lines.includes('(b) Condensation') && lines.includes('(c) Evaporation') && lines.includes('(d) Precipitation'))
  assert.ok(lines.includes('1. Water changing into water vapour on heating is called:'))
  assert.equal(report.questions, 3)
  assert.equal(report.optionLines, 12)
  assert.equal(report.headings, 1)
  assert.ok(lines.includes('(b) \\frac{3}{4}') && lines.includes('(d) \\frac{1}{3}'))
  assert.ok(lines.some(l => l.startsWith('3. ') && l.includes('\\frac{3}{4} or \\frac{1}{4}')))
})

test('a real A/B/C/D group is never turned into a heading', () => {
  const { text, report } = smartFormat('1. Pick one\nA. one\nB. two\nC. three\nD. four')
  assert.equal(report.headings, 0)
  assert.ok(text.includes('(a) one') && text.includes('(d) four'))
})

test('wrapped lines from a PDF are joined to their question or option', () => {
  const { text } = smartFormat('4. Which gas is\nneeded for burning?\n(a) Oxygen (b) Nitrogen\n(c) Hydrogen\ngas (d) Helium')
  assert.ok(text.includes('4. Which gas is needed for burning?'))
  assert.ok(text.includes('(c) Hydrogen gas'))
})

test('Bmei lines are converted to Meetei Mayek; English lines stay', () => {
  const { text, report } = smartFormat('1. Water is wet\nwahx HudiZmKt paUHuM mri')
  assert.equal(report.bmeiLines, 1)
  assert.ok(/[ꯀ-꯿]/.test(text.split('\n')[1]))
  assert.equal(text.split('\n')[0], '1. Water is wet')
})

test('figure questions are found, and a figure line is put under the stem, before the options', () => {
  const body = '1. Look at the figure. Which is a triangle?\n(a) One\n(b) Two\n2. Name the capital of Manipur.\n(a) Imphal\n(b) Delhi\n3. The bar graph shows rainfall. Which month is highest?\n[[img:data:image/png;base64,AAAA]]\n(a) JUN\n(b) JUL'
  const f = figureQuestions(body)
  assert.deepEqual(f.map(x => [x.no, x.hasFigure]), [['1', false], ['3', true]])
  const next = insertFigureAfterQuestion(body, f[0].line, '[[img:data:image/png;base64,BBBB]]').split('\n')
  assert.equal(next[1], '[[img:data:image/png;base64,BBBB]]')
  assert.equal(next[2], '(a) One')
})

test('Word paragraphs become notes with their pictures in place', () => {
  const t = paragraphsToNotes([{ text: '1. See the figure', images: [] }, { text: '', images: [{ dataUrl: 'data:image/png;base64,AAAA' }] }, { text: '(a) One (b) Two', images: [] }], d => `[[img:${d}]]`)
  assert.equal(t, '1. See the figure\n[[img:data:image/png;base64,AAAA]]\n(a) One (b) Two')
  const { text, report } = smartFormat(t)
  assert.ok(text.includes('(a) One\n(b) Two'))
  assert.deepEqual(report.figureQuestions, [])
})

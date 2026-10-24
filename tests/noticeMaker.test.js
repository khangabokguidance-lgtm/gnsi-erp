import test from 'node:test'
import assert from 'node:assert/strict'
import { PRESETS, blankNotice, newBlock, noticeText, noticeHTML, buildNoticeDocx, runsOf, richHTML } from '../src/noticeMaker.js'

test('rich text: bold and red markup, HTML escaped', () => {
  assert.deepEqual(runsOf('a **b** [[c]] d'), [{ text: 'a ' }, { text: 'b', bold: true }, { text: ' ' }, { text: 'c', bold: true, red: true }, { text: ' d' }])
  assert.equal(richHTML('x <y> **z**'), 'x &lt;y&gt; <b>z</b>')
})

test('every preset builds text, HTML and a Word file', async () => {
  for (const [name, make] of Object.entries(PRESETS)) {
    const n = make()
    assert.ok(noticeText(n).includes(n.letterhead.name), name)
    assert.ok(noticeHTML(n).includes('<table class="wrap">'), name)
    const blob = await buildNoticeDocx(n)
    assert.ok(blob.size > 3000, `${name} docx too small`)
  }
})

test('fee drive preset matches the supplied notice', () => {
  const n = PRESETS['Fee Collection Drive']()
  const t = noticeText(n)
  assert.match(t, /Ref\. No\.: GN&SI\/Fees\/2026\/____/)
  assert.match(t, /To: All Fee Counter Staff, GN&SI/)
  assert.match(t, /\(URGENT\)/)
  assert.match(t, /\n2\. All Fee Counter Staff are hereby directed to:\n {3}\(a\) collect all outstanding fees on or before 10 November 2026;/)
  assert.match(t, /FINAL DEADLINE:/)
  const h = noticeHTML(n)
  assert.match(h, /ACKNOWLEDGEMENT/)
  assert.match(h, /class="urg">URGENT/)
  assert.equal((h.match(/class="step"/g) || []).length, 6)
})

test('paragraphs are numbered, empty ones skipped, blocks can be added', () => {
  const n = blankNotice()
  n.blocks = [{ ...newBlock('para'), text: 'One' }, newBlock('para'), { ...newBlock('para'), text: 'Two' }]
  const t = noticeText(n)
  assert.match(t, /1\. One/)
  assert.match(t, /2\. Two/)
  assert.equal(noticeHTML(n).includes('<b class="n">3.</b>'), false)
  for (const type of ['para', 'list', 'steps', 'table', 'box']) assert.equal(newBlock(type).type, type)
})

test('no acknowledgement slip or urgent tag unless asked', () => {
  const n = blankNotice()
  const h = noticeHTML(n)
  assert.equal(h.includes('ACKNOWLEDGEMENT'), false)
  assert.equal(h.includes('class="urg"'), false)
})

import { noticeFromBoard, noticesCSV, addDays } from '../src/noticeMaker.js'

test('board notice becomes a letterhead notice', () => {
  const n = noticeFromBoard({ title: 'Holiday on Monday', description: 'Para one.\n\nPara two.', audience: 'Parents', priority: 'Urgent', category: 'Holiday', publish_date: '2026-10-24' })
  assert.equal(n.subject, 'Holiday on Monday')
  assert.equal(n.to, 'All Parents')
  assert.equal(n.urgent, true)
  assert.equal(n.subtitle, 'HOLIDAY')
  assert.equal(n.date, '24 October 2026')
  assert.deepEqual(n.blocks.map(b => b.text), ['Para one.', 'Para two.'])
  assert.equal(noticeFromBoard({ title: 'x', description: '', audience: 'Class Specific', class_target: 'Class 10 A' }).to, 'Class 10 A')
})

test('CSV export quotes commas, quotes and newlines', () => {
  const csv = noticesCSV([{ title: 'A, "B"', description: 'line1\nline2', category: 'Fee', pinned: true }])
  const lines = csv.split('\r\n')
  assert.equal(lines[0].split(',')[0], 'Title')
  assert.match(csv, /"A, ""B"""/)
  assert.match(csv, /"line1\nline2"/)
  assert.match(csv, /,Yes,No,/)
})

test('addDays rolls over months and years', () => {
  assert.equal(addDays('2026-10-28', 7), '2026-11-04')
  assert.equal(addDays('2026-12-30', 7), '2027-01-06')
})

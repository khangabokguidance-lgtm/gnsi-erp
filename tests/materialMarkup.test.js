import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMaterial, embedFor, kindOf, wordCount, figureLine, materialDocHtml } from '../src/lib/materialMarkup.js'

test('headings, paragraphs, bold and italic', () => {
  const h = renderMaterial('# Fractions\n\nA **proper** fraction is *less* than 1.')
  assert.ok(h.includes('>Fractions</h1>'))
  assert.ok(h.includes('<b>proper</b>') && h.includes('<i>less</i>'))
})

test('lists are grouped', () => {
  const h = renderMaterial('- one\n- two\n\n1. first\n2. second')
  assert.equal((h.match(/<li>/g) || []).length, 4)
  assert.ok(h.includes('<ul>') && h.includes('<ol>'))
})

test('callouts get a label and class', () => {
  const h = renderMaterial('> Formula: area = \\frac{1}{2} b h')
  assert.ok(h.includes('class="box formula"') && h.includes('Formula') && h.includes('class="fr"'))
  assert.ok(renderMaterial('> just a quote').includes('class="box info"'))
})

test('tables', () => {
  const h = renderMaterial('| Shape | Sides |\n|---|---|\n| Triangle | 3 |')
  assert.ok(h.includes('<th>Shape</th>') && h.includes('<td>Triangle</td>') && h.includes('<td>3</td>'))
  assert.equal((h.match(/<tr>/g) || []).length, 2)
})

test('figures render only for safe data URLs', () => {
  const u = 'data:image/jpeg;base64,AAAA'
  assert.ok(renderMaterial(figureLine(u, 'A triangle')).includes('<figcaption>A triangle</figcaption>'))
  assert.ok(!renderMaterial('[[img:javascript:alert(1)]]').includes('<img'))
  assert.ok(!renderMaterial('[[img:data:text/html;base64,AAAA]]').includes('<img'))
})

test('HTML in text is escaped', () => {
  const h = renderMaterial('# <script>alert(1)</script>\n\n<img src=x onerror=alert(1)>')
  assert.ok(!h.includes('<script>') && !h.includes('<img src=x'))
})

test('divider and maths', () => {
  assert.ok(renderMaterial('---').includes('<hr>'))
  assert.ok(renderMaterial('x^2 + y^2').includes('<sup>2</sup>'))
})

test('empty input renders nothing', () => { assert.equal(renderMaterial(''), ''); assert.equal(renderMaterial(null), '') })

test('word count ignores pictures', () => {
  assert.equal(wordCount('one two [[img:data:image/png;base64,AAA]] three'), 3)
})

test('embedFor recognises YouTube and Drive links', () => {
  assert.equal(embedFor('https://www.youtube.com/watch?v=dQw4w9WgXcQ').src, 'https://www.youtube.com/embed/dQw4w9WgXcQ')
  assert.equal(embedFor('https://youtu.be/dQw4w9WgXcQ').kind, 'video')
  assert.equal(embedFor('https://drive.google.com/file/d/abc123/view').src, 'https://drive.google.com/file/d/abc123/preview')
  assert.equal(embedFor('https://example.com/x'), null)
})

test('kindOf', () => {
  assert.equal(kindOf({ link_url: 'https://x' }), 'link')
  assert.equal(kindOf({ file_path: 'a/b.PDF', file_name: 'b.PDF' }), 'pdf')
  assert.equal(kindOf({ file_name: 'p.jpg', file_path: 'p' }), 'image')
  assert.equal(kindOf({ file_name: 'n.docx', file_path: 'p' }), 'office')
  assert.equal(kindOf({ body: 'text' }), 'text')
})

test('document html escapes the title and includes the body', () => {
  const d = materialDocHtml({ title: '<b>T</b>', body: '# Hi', subject: 'Maths' }, { institute: 'Acme' })
  assert.ok(!d.includes('<b>T</b>') && d.includes('&lt;b&gt;T') && d.includes('>Hi</h1>') && d.includes('Acme'))
})

import { outline, PRINT_DEFAULTS } from '../src/lib/materialMarkup.js'

test('headings get ids that match the outline', () => {
  const src = '# One\ntext\n## Two\n### Three'
  const h = renderMaterial(src)
  const o = outline(src)
  assert.deepEqual(o.map(x => x.id), ['h1', 'h2', 'h3'])
  assert.deepEqual(o.map(x => x.level), [1, 2, 3])
  for (const x of o) assert.ok(h.includes(`id="${x.id}"`))
})

test('teacher boxes can be hidden for the student copy', () => {
  const src = '> Teacher: answer is 12\n\n> Note: visible'
  assert.ok(renderMaterial(src).includes('class="box teacher"'))
  const stu = renderMaterial(src, { teacher: false })
  assert.ok(!stu.includes('answer is 12') && stu.includes('visible'))
})

test('print options: byline with designation, columns, compact, ink saver, header', () => {
  const m = { title: 'T', body: '# A\n# B\n# C\ntext', subject: 'Maths', uploaded_by: 'Sir X' }
  const d = materialDocHtml(m, { institute: 'Acme', author: { name: 'Sumanta', designation: 'Maths Teacher' }, reviewer: 'Kabiraj', columns: 2, compact: true, inkSaver: true, header: 'compact', toc: true, margin: 'minimal', paper: 'a5', landscape: true })
  assert.ok(d.includes('Prepared by <b>Sumanta</b>, Maths Teacher') && d.includes('Reviewed by <b>Kabiraj</b>'))
  assert.ok(d.includes('column-count:2') && d.includes('grayscale') && d.includes('class="lh1"') && d.includes('class="toc"'))
  assert.ok(d.includes('size:A5 landscape') && d.includes('6mm 7mm 8mm'))
})

test('byline falls back to the uploader and can be switched off; header can be dropped', () => {
  const m = { title: 'T', body: 'x', uploaded_by: 'Sir X' }
  assert.ok(materialDocHtml(m).includes('Prepared by <b>Sir X</b>'))
  assert.ok(!materialDocHtml(m, { byline: false }).includes('Prepared by'))
  assert.ok(!materialDocHtml(m, { header: 'none' }).includes('class="lh"'))
  assert.ok(PRINT_DEFAULTS.columns === 1)
})

test('author text is escaped', () => {
  const d = materialDocHtml({ title: 'T', body: 'x' }, { author: { name: '<b>n</b>', designation: '<i>d</i>' } })
  assert.ok(!d.includes('<b>n</b>') && !d.includes('<i>d</i>'))
})

test('plain-text multiple-choice questions become a question, an options grid and an answer pill', () => {
  const h = renderMaterial("What is the feminine gender of 'Duke'?\nA) Duchess\nB) Queen\nC) Princess\nD) Lady\nAnswer: A) Duchess")
  assert.ok(h.includes('<p class="q">'))
  assert.equal((h.match(/class="op"/g) || []).length, 4)
  assert.ok(h.includes('<span class="ol">A</span>') && h.includes('class="ans"') && h.includes('Duchess</div>'))
})

test('a blank line between the question and its options still attaches them', () => {
  const h = renderMaterial('Which is a noun?\n\nA) run\nB) table')
  assert.ok(h.includes('<p class="q">Which is a noun?</p>') && h.includes('class="opts"'))
})

test('options and answers are escaped and ordinary paragraphs are untouched', () => {
  assert.ok(!renderMaterial('Q?\nA) <b>x</b>\nAnswer: <i>y</i>').includes('<b>x</b>'))
  assert.equal(renderMaterial('Just a paragraph'), '<p>Just a paragraph</p>')
})

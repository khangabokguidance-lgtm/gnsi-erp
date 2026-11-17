import test from 'node:test'
import assert from 'node:assert/strict'
import { renderMaterial, embedFor, kindOf, wordCount, figureLine, materialDocHtml } from '../src/lib/materialMarkup.js'

test('headings, paragraphs, bold and italic', () => {
  const h = renderMaterial('# Fractions\n\nA **proper** fraction is *less* than 1.')
  assert.ok(h.includes('<h1>Fractions</h1>'))
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
  assert.ok(!d.includes('<b>T</b>') && d.includes('&lt;b&gt;T') && d.includes('<h1>Hi</h1>') && d.includes('Acme'))
})

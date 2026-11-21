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
  const d = materialDocHtml({ title: '<b>T</b>', body: '# Hi', subject: 'Maths' }, { institute: 'Acme', hf: false })
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
  const d = materialDocHtml(m, { institute: 'Acme', author: { name: 'Sumanta', designation: 'Maths Teacher' }, reviewer: 'Kabiraj', hf: false, columns: 2, compact: true, inkSaver: true, header: 'compact', toc: true, margin: 'minimal', paper: 'a5', landscape: true })
  assert.ok(d.includes('Prepared by <b>Sumanta</b>, Maths Teacher') && d.includes('Reviewed by <b>Kabiraj</b>'))
  assert.ok(d.includes('column-count:2') && d.includes('grayscale') && d.includes('class="lh1"') && d.includes('class="toc"'))
  assert.ok(d.includes('size:A5 landscape') && d.includes('6mm 7mm 8mm'))
})

test('byline falls back to the uploader and can be switched off; header can be dropped', () => {
  const m = { title: 'T', body: 'x', uploaded_by: 'Sir X' }
  assert.ok(materialDocHtml(m, { hf: false }).includes('Prepared by <b>Sir X</b>'))
  assert.ok(!materialDocHtml(m, { byline: false }).includes('Prepared by'))
  assert.ok(!materialDocHtml(m, { header: 'none' }).includes('class="lh"'))
  assert.ok(PRINT_DEFAULTS.columns === 1)
})

test('author text is escaped', () => {
  const d = materialDocHtml({ title: 'T', body: 'x' }, { hf: false, author: { name: '<b>n</b>', designation: '<i>d</i>' } })
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
  assert.ok(h.includes('<p class="q">Which is a noun?</p>') && h.includes('class="opts '))
})

test('options and answers are escaped and ordinary paragraphs are untouched', () => {
  assert.ok(!renderMaterial('Q?\nA) <b>x</b>\nAnswer: <i>y</i>').includes('<b>x</b>'))
  assert.equal(renderMaterial('Just a paragraph'), '<p>Just a paragraph</p>')
})

import { parseFigureLine } from '../src/lib/materialMarkup.js'

test('underline, strike, code and links', () => {
  const h = renderMaterial('This is __underlined__, ~~old~~ and `code`, see [the site](https://example.com/a?x=1&y=2).')
  assert.ok(h.includes('<u>underlined</u>') && h.includes('<s>old</s>') && h.includes('<code>code</code>'))
  assert.ok(h.includes('<a href="https://example.com/a?x=1&amp;y=2" target="_blank" rel="noopener noreferrer">the site</a>'))
})

test('unsafe links are not made clickable and blanks are not underlined', () => {
  assert.ok(!renderMaterial('[x](javascript:alert(1))').includes('<a '))
  assert.ok(!renderMaterial('[x](data:text/html,hi)').includes('<a '))
  const blanks = renderMaterial('Name: ____________   Date: ________')
  assert.ok(!blanks.includes('<u>'))
})

test('checklists', () => {
  const h = renderMaterial('- [ ] revise\n- [x] done')
  assert.ok(h.includes('☐ revise') && h.includes('☑ done') && h.includes('class="chk"'))
})

test('figure width and caption round trip', () => {
  const u = 'data:image/png;base64,AAAA'
  assert.deepEqual(parseFigureLine(figureLine(u, 'A shape', 50)), { url: u, caption: 'A shape', width: 50 })
  assert.deepEqual(parseFigureLine(figureLine(u, '', 75)), { url: u, caption: '', width: 75 })
  assert.deepEqual(parseFigureLine(figureLine(u, 'Only caption')), { url: u, caption: 'Only caption', width: 0 })
  assert.equal(parseFigureLine('not a figure'), null)
  assert.ok(renderMaterial(figureLine(u, 'x', 50)).includes('style="max-width:50%"'))
  assert.ok(!renderMaterial(figureLine(u, 'x')).includes('max-width:'))
})

test('compact class exists in the material css', async () => {
  const { MATERIAL_CSS } = await import('../src/lib/materialMarkup.js')
  assert.ok(MATERIAL_CSS.includes('.md.compact'))
})

import { answerGridHtml, FONTS } from '../src/lib/materialMarkup.js'

const mcq = (opts) => `Which?\n${opts.map((t, i) => `${'ABCD'[i]}) ${t}`).join('\n')}`

test('options layout: auto picks 4-up, 2-up or 1 per line by length; a fixed style wins', () => {
  assert.ok(renderMaterial(mcq(['1', '2', '3', '4'])).includes('class="opts four"'))
  assert.ok(renderMaterial(mcq(['a medium length one', 'another medium one', 'third medium', 'fourth medium'])).includes('class="opts two"'))
  assert.ok(renderMaterial(mcq(['x'.repeat(50), 'y', 'z', 'w'])).includes('class="opts one"'))
  assert.ok(renderMaterial(mcq(['1', '2', '3', '4']), { optStyle: 'one' }).includes('class="opts one"'))
  assert.ok(renderMaterial(mcq(['1', '2', '3', '4']), { optStyle: 'two' }).includes('class="opts two"'))
})

test('answer grid has one cell per question with A to D bubbles', () => {
  const g = answerGridHtml(12)
  assert.equal((g.match(/class="agc"/g) || []).length, 12)
  assert.equal(answerGridHtml(0), '')
  const body = [mcq(['1', '2', '3', '4']), mcq(['1', '2', '3', '4']), mcq(['1', '2', '3', '4'])].join('\n\n')
  const d = materialDocHtml({ title: 'T', body }, { answerGrid: true })
  assert.equal((d.match(/class="agc"/g) || []).length, 3)
  assert.ok(!materialDocHtml({ title: 'T', body }, {}).includes('class="agc"'))
})

test('student line, narrow font and small figures options', () => {
  const d = materialDocHtml({ title: 'T', body: 'x' }, { studentLine: true, font: 'narrow', smallFigs: true })
  assert.ok(d.includes('class="stu"') && d.includes('Name:') && d.includes('Roll no.:') && d.includes('Arial Narrow') && d.includes('max-height:120px'))
  assert.ok(!materialDocHtml({ title: 'T', body: 'x' }, {}).includes('class="stu"'))
  assert.ok(FONTS.times.includes('Times New Roman'))
})

test('2-up prints two copies per sheet on A4 landscape and rounds the sheets up for the class size', () => {
  const one = materialDocHtml({ title: 'T', body: 'x' }, { nup: 2, copies: 1 })
  assert.ok(one.includes('size:A4 landscape') && (one.match(/class="panel"/g) || []).length === 2 && (one.match(/class="sheet"/g) || []).length === 1)
  const thirty = materialDocHtml({ title: 'T', body: 'x' }, { nup: 2, copies: 30 })
  assert.equal((thirty.match(/class="sheet"/g) || []).length, 15)
  assert.equal((materialDocHtml({ title: 'T', body: 'x' }, { nup: 2, copies: 31 }).match(/class="sheet"/g) || []).length, 16)
  assert.ok(!materialDocHtml({ title: 'T', body: 'x' }, {}).includes('class="sheet"'))
})

test('in narrow columns (3 columns or 2-up) 4-across options become 2 x 2', () => {
  assert.ok(renderMaterial(mcq(['1', '2', '3', '4']), { narrow: true }).includes('class="opts two"'))
  assert.ok(materialDocHtml({ title: 'T', body: mcq(['1', '2', '3', '4']) }, { columns: 3 }).includes('class="opts two"'))
  assert.ok(materialDocHtml({ title: 'T', body: mcq(['1', '2', '3', '4']) }, { nup: 2 }).includes('class="opts two"'))
  assert.ok(materialDocHtml({ title: 'T', body: mcq(['1', '2', '3', '4']) }, { columns: 2 }).includes('class="opts four"'))
})

test('questions all typed as "1." are numbered on, and bulleted options stay options', () => {
  const html = renderMaterial('1. First?\n• A) 6\n• B) 7\n\n1. Second?\n- A) 1\n- B) 2\n\n1. Third?\nA) x\nB) y')
  assert.deepEqual([...html.matchAll(/<b class="qn">(\d+)\./g)].map(m => m[1]), ['1', '2', '3'])
  assert.ok(!/<ul>/.test(html))
})

test('print size and font are not overridden by the shared stylesheet', () => {
  const html = materialDocHtml({ title: 'T', body: 'x' }, { size: 10, font: 'sans' }, '.md{font-size:14px;font-family:Georgia}')
  assert.ok(html.lastIndexOf('.md{font-size:10px;font-family:Arial') > html.lastIndexOf('.md{font-size:14px'))
})

test('header and footer on every page carry the non-question text, and the body keeps only the content', () => {
  const m = { title: 'GK 11', body: '1. Q?\nA) a\nB) b', subject: 'GK', test_no: 4, uploaded_by: 'Sir X' }
  const d = materialDocHtml(m, { institute: 'Acme', author: { name: 'Sumanta', designation: 'Teacher' }, margin: 'minimal' })
  const page = d.match(/@page\{[^<]*?\}\}/)[0]
  assert.ok(page.includes('@top-left{content:"Acme"') && page.includes('@top-center{content:"GK 11"') && page.includes('@top-right{content:"GK · Test 4"'))
  assert.ok(page.includes('@bottom-left{content:"Prepared by Sumanta, Teacher"') && page.includes('counter(page)'))
  assert.ok(!d.includes('class="ti"') && !d.includes('class="lh') && !d.includes('Prepared by <b>'))
  assert.ok(page.includes('margin:13mm 7mm 13mm;'))
})

test('header and footer text cannot break out of the style block', () => {
  const d = materialDocHtml({ title: '</style><script>alert(1)</script>"x"', body: 'x' }, { institute: 'A"B' })
  assert.ok(!d.includes('</style><script>') && !/content:"[^"]*[<>][^"]*"/.test(d.match(/@page\{[^<]*?\}\}/)?.[0] || ''))
})

test('header and footer can be turned off (letterhead stays on the first page) and are not used with header none', () => {
  const m = { title: 'T', body: 'x', uploaded_by: 'Sir X' }
  assert.ok(materialDocHtml(m, { hf: false }).includes('class="ti"'))
  assert.ok(!materialDocHtml(m, { header: 'none' }).includes('@top-center'))
})

test('premium look: gold rule header, logo tile, navy badges; plain when ink saver is on; logo must be https or an image data URL', () => {
  const m = { title: 'T', body: '1. Q?\nA) a\nB) b', subject: 'GK', uploaded_by: 'Sir X' }
  const d = materialDocHtml(m, { institute: 'Acme', logo: 'https://example.com/logo.webp' })
  assert.ok(d.includes('@top-left-corner{content:"";background:#0f2d5e url("https://example.com/logo.webp")') && d.includes('border-bottom:1.3pt solid #b8923a') && d.includes('.md .qn{display:inline-block'))
  assert.ok(!materialDocHtml(m, { institute: 'Acme', logo: 'https://example.com/logo.webp', inkSaver: true }).includes('@top-left-corner'))
  assert.ok(!materialDocHtml(m, { institute: 'Acme', logo: 'javascript:alert(1)' }).includes('@top-left-corner'))
  assert.ok(!materialDocHtml(m, { institute: 'Acme', logo: 'https://x.com/a").evil{' }).includes('").evil{'))
})

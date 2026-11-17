import test from 'node:test'
import assert from 'node:assert/strict'
import { mathToHtml, mathPlain, setMathStacked, withPicture, pictureOf, hasPicture, withoutPicture } from '../src/lib/mathText.js'

test('fractions are stacked', () => {
  assert.match(mathToHtml('\\frac{3}{4}'), /<span class="fr"><span>3<\/span><span>4<\/span><\/span>/)
  assert.match(mathToHtml('2\\frac{1}{3} + 1'), /2<span class="fr"><span>1<\/span><span>3<\/span><\/span> \+ 1/)
})

test('fractions fall back to sup/sub for Word', () => {
  setMathStacked(false)
  try { assert.equal(mathToHtml('\\frac{1}{2}'), '<sup>1</sup>⁄<sub>2</sub>') } finally { setMathStacked(true) }
})

test('powers, subscripts and roots', () => {
  assert.equal(mathToHtml('x^2'), 'x<sup>2</sup>')
  assert.equal(mathToHtml('10^{-3}'), '10<sup>-3</sup>')
  assert.equal(mathToHtml('H_2O'), 'H<sub>2</sub>O')
  assert.match(mathToHtml('\\sqrt{16}'), /√<span class="rt">16<\/span>/)
})

test('symbols', () => {
  assert.equal(mathToHtml('3 \\times 4 \\div 2'), '3 × 4 ÷ 2')
  assert.equal(mathToHtml('90\\deg'), '90°')
})

test('blanks, ordinary slashes and unknown commands are untouched', () => {
  assert.equal(mathToHtml('Fill in the ____ here'), 'Fill in the ____ here')
  assert.equal(mathToHtml('3/4 and/or 1/2'), '3/4 and/or 1/2')
  assert.equal(mathToHtml('\\unknown'), '\\unknown')
})

test('HTML in the text is escaped', () => {
  assert.equal(mathToHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
  assert.ok(!mathToHtml('\\frac{<b>}{2}').includes('<b>'))
})

test('picture tokens become images only for safe data URLs', () => {
  const u = 'data:image/jpeg;base64,AAAA'
  assert.equal(mathToHtml(withPicture('', u)), `<img class="oi" src="${u}" alt="">`)
  assert.ok(!mathToHtml('[[img:javascript:alert(1)]]').includes('<img'))
  assert.ok(!mathToHtml('[[img:data:text/html;base64,AAAA]]').includes('<img'))
})

test('picture helpers', () => {
  const u = 'data:image/png;base64,QUJD'
  const t = withPicture('caption', u)
  assert.ok(hasPicture(t)); assert.equal(pictureOf(t), u); assert.equal(withoutPicture(t), 'caption')
  assert.ok(!hasPicture('plain'))
})

test('plain length ignores markup and pictures', () => {
  assert.equal(mathPlain('\\frac{3}{4}'), '3/4')
  assert.equal(mathPlain('[[img:data:image/jpeg;base64,AAAA]]'), 'IMG')
})

// Question-paper line handling for the Document Translator (src/mayekDocx.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { linesFromText, cleanLines, docxFileName } from '../src/mayekDocx.js'
import { kindOf as lineKind } from '../src/mayekPaper.js'

test('line kinds: questions, options, sections, text', () => {
  assert.equal(lineKind('1. What is the capital of India?'), 'question')
  assert.equal(lineKind('Q.12) Solve for x'), 'question')
  assert.equal(lineKind('(3) Name the river'), 'question')
  assert.equal(lineKind('(a) Delhi'), 'option')
  assert.equal(lineKind('B. Mumbai'), 'option')
  assert.equal(lineKind('iv) none of these'), 'option')
  assert.equal(lineKind('Section A'), 'section')
  assert.equal(lineKind('Read the passage and answer.'), 'text')
  assert.equal(lineKind('   '), 'blank')
})

test('text files: tidy lines, keep blank lines between questions', () => {
  assert.deepEqual(linesFromText('1.  Hello  world  \r\n\r\n(a) x\t y'), ['1. Hello world', '', '(a) x y'])
  assert.deepEqual(cleanLines(['', '', 'a', '', '', 'b', '', '']), ['a', '', 'b'])
})

test('download file name comes from the paper title', () => {
  assert.equal(docxFileName({ title: 'Unit Test 2: Maths (Class VI)' }), 'Unit-Test-2-Maths-Class-VI-Mayek.docx')
  assert.equal(docxFileName({}, 'Bilingual'), 'Question-paper-Bilingual.docx')
})

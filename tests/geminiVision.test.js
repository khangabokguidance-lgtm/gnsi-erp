// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { checkVisionBody } from '../api/_gemini/vision.js'

const page = { mimeType: 'image/jpeg', data: 'QUJD' }

test('a prompt with one or two page images is accepted', () => {
  assert.equal(checkVisionBody({ prompt: 'read', images: [page] }), '')
  assert.equal(checkVisionBody({ prompt: 'read', images: [page, page] }), '')
})

test('questions sent as text only (Auto answer key) are accepted without an image', () => {
  assert.equal(checkVisionBody({ prompt: 'answer', images: [], textOnly: true }), '')
})

test('missing, oversized or unsafe input is refused before Gemini is called', () => {
  assert.match(checkVisionBody({ images: [page] }), /prompt/i)
  assert.match(checkVisionBody({ prompt: 'x'.repeat(20001), images: [page] }), /too long/i)
  assert.match(checkVisionBody({ prompt: 'read', images: [] }), /image/i)
  assert.match(checkVisionBody({ prompt: 'read', images: [page, page, page] }), /at most/i)
  assert.match(checkVisionBody({ prompt: 'read', images: [{ mimeType: 'image/svg+xml', data: 'QUJD' }] }), /JPEG/)
  assert.match(checkVisionBody({ prompt: 'read', images: [{ mimeType: 'image/png', data: 'not base64!' }] }), /base64/)
  assert.equal(checkVisionBody({ prompt: 'read', images: [{ mimeType: 'image/png', data: 'A'.repeat(3_000_001) }] }), 'Image too large')
})

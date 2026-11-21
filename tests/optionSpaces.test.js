import test from 'node:test'
import assert from 'node:assert/strict'
import { withPictureRaw, withoutPictureRaw, withPicture, withoutPicture, hasPicture, pictureOf } from '../src/lib/mathText.js'

const PIC = 'data:image/jpeg;base64,AAAA'

test('typing in an option box keeps the space after each word', () => {
  // the box shows withoutPictureRaw(stored); each key stores withPictureRaw(typed, picture)
  let stored = ''
  for (const typed of ['N', 'Ne', 'New', 'New ', 'New G', 'New Guidance']) stored = withPictureRaw(typed, pictureOf(stored))
  assert.equal(withoutPictureRaw(stored), 'New Guidance')
})

test('the same typing is broken by the trimming helpers (why the space vanished)', () => {
  const stored = withPicture('New ', '')
  assert.equal(withoutPicture(stored), 'New')
})

test('a picture stays attached while the caption is typed with spaces', () => {
  let stored = withPictureRaw('', PIC)
  for (const typed of ['A', 'A ', 'A b']) stored = withPictureRaw(typed, pictureOf(stored))
  assert.ok(hasPicture(stored)); assert.equal(pictureOf(stored), PIC); assert.equal(withoutPictureRaw(stored), 'A b')
})

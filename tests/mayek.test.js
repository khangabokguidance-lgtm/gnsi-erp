// BMEI04 <-> Unicode Meetei Mayek key table (src/meetei_mayek.js).
import test from 'node:test'
import assert from 'node:assert/strict'
import { romanToMeetei, meeteiToRoman, getAllCharacters, MAPPING } from '../src/meetei_mayek.js'

test('capital Y is THOU and small y is YANG, both ways', () => {
  assert.equal(romanToMeetei('Ya'), 'ꯊꯥ')
  assert.equal(romanToMeetei('ya'), 'ꯌꯥ')
  assert.equal(meeteiToRoman('ꯊꯤꯕꯤꯌꯨ'), 'Yibiyu')
})

test('every mapped key converts back to itself', () => {
  for (const [key, char] of Object.entries(MAPPING)) assert.equal(meeteiToRoman(char), key)
})

test('letters with a BMEI04 key but no forward mapping still convert to keystrokes', () => {
  assert.equal(meeteiToRoman('ꯏꯁꯤꯡ'), 'IsiZ')
  assert.equal(meeteiToRoman('ꯓ ꯘ ꯙ'), 'J G D')
  // ...and those capitals stay unknown going forward, which keeps English words Latin.
  for (const word of ['Delhi', 'Gopal', 'June']) assert.match(romanToMeetei(word), /\[\?/)
})

test('the character picker lists every key once', () => {
  const keys = getAllCharacters().map(c => c.key)
  assert.deepEqual([...keys].sort(), Object.keys(MAPPING).sort())
  assert.ok(getAllCharacters().every(c => c.name))
})

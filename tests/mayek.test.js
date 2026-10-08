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

test('APUN IYEK is typed after the cluster in BMEI04 but sits between the consonants in Unicode', () => {
  assert.equal(romanToMeetei('fy_utaIL'), 'ꯐ꯭ꯌꯨꯇꯥꯏꯜ')
  assert.equal(meeteiToRoman('ꯐ꯭ꯌꯨꯇꯥꯏꯜ'), 'fy_utaIL')
  // no cluster to join (word-final, or after a vowel sign): APUN stays where it was typed
  assert.equal(romanToMeetei('r_ ka_'), 'ꯔ꯭ ꯀꯥ꯭')
})

test('capital I is the letter I; I LONSUM still converts back to I', () => {
  assert.equal(romanToMeetei('taI'), 'ꯇꯥꯏ')
  assert.equal(meeteiToRoman('ꯢ'), 'I')
})

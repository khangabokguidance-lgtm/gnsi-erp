import test from 'node:test'
import assert from 'node:assert/strict'
import { loggedInName } from '../src/lib/collector.js'

test('collector is the signed-in user, trimmed', () => {
  assert.equal(loggedInName({ name: '  Rohit Sharma ' }), 'Rohit Sharma')
  assert.equal(loggedInName({ userName: 'rohit', name: 'Rohit Sharma' }), 'rohit')
  assert.equal(loggedInName({ username: 'accounts1' }), 'accounts1')
})
test('no usable name gives an empty string, never "Admin"', () => {
  assert.equal(loggedInName(null), '')
  assert.equal(loggedInName({}), '')
  assert.equal(loggedInName({ name: '   ' }), '')
})

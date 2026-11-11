// The exam draws ¹⁄₉ as a stacked fraction; the stored text stays the compact form.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
test('CbtPlayer.pick knows the true-fraction pattern', () => {
  const src = readFileSync(new URL('../src/CbtPlayer.jsx', import.meta.url), 'utf8')
  assert.match(src, /cbt-frac/)
  assert.match(src, /FRACTION/)
})

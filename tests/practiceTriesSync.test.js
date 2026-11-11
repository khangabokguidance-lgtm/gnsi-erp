import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { PRACTICE_TRIES } from '../src/lib/cbtMockStats.js'

// The page text and the database limit must agree, or students are told the wrong number of tries.
test('the SQL limit matches PRACTICE_TRIES in both SQL files', () => {
  for (const f of ['supabase/migrations/20261122_cbt_mock_practice_gcc.sql', 'supabase/RUN_cbt_mock_practice_gcc.sql']) {
    const m = /lim constant int := (\d+);/.exec(fs.readFileSync(new URL(`../${f}`, import.meta.url), 'utf8'))
    assert.ok(m, `${f} has no lim`)
    assert.equal(Number(m[1]), PRACTICE_TRIES, f)
  }
})

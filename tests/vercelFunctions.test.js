// Run with: npm test
// Vercel's Hobby plan builds at most 12 serverless functions per deployment; one more and the
// whole deployment fails. Every .js file under api/ is a function unless it sits in a folder
// whose name starts with "_" (shared code such as api/_guard).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX_FUNCTIONS = 12
const functions = (dir) => readdirSync(dir).flatMap((name) => {
  if (name.startsWith('_') || name.startsWith('.')) return []
  const p = join(dir, name)
  if (statSync(p).isDirectory()) return functions(p)
  return /\.(js|mjs|cjs|ts)$/.test(name) ? [p] : []
})

test(`api/ stays within ${MAX_FUNCTIONS} serverless functions`, () => {
  const list = functions('api')
  assert.ok(list.length <= MAX_FUNCTIONS, `${list.length} functions: ${list.join(', ')} — move shared code into an api/_folder or merge endpoints`)
})

// cbtRescore.js — re-evaluate submitted attempts after the answer key was corrected. Pure.
// Given the test (with the NEW key) and the attempts, work out each attempt's new score and who changed.
import { grade } from './cbtEngine.js'

export function rescorePlan(test, attempts) {
  const changes = []
  const same = []
  for (const a of attempts) {
    if (a.state !== 'submitted') continue
    const now = grade(test, a.answers)
    const was = a.score || null
    const changed = !was || was.marks !== now.marks || was.correct !== now.correct || was.wrong !== now.wrong || was.max !== now.max
    ;(changed ? changes : same).push({ attempt: a, was, now, delta: Math.round((now.marks - (was?.marks ?? 0)) * 100) / 100 })
  }
  return { changes: changes.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta)), unchanged: same.length }
}

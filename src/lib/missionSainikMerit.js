// missionSainikMerit.js — ranked merit list from the Daily Class Test marks (pure, unit-tested).
// marks: rows { test_no, batch (batch / student name), <col keys> }. testNo = 0 means "all tests together" (each person's marks are added up).
// cols: [[key, label, max]]. Ties share a rank (1, 2, 2, 4). Returns { rows, fullMax, tests } with rows sorted best first.
export function meritList(marks, cols, testNo = 0) {
  const use = (marks || []).filter(r => !testNo || r.test_no === testNo)
  const by = new Map()
  use.forEach(r => {
    const name = String(r.batch || '').trim() || '(no name)'
    const e = by.get(name) || { name, parts: Object.fromEntries(cols.map(([k]) => [k, 0])), max: 0, tests: new Set() }
    if (!e.tests.has(r.test_no)) {
      e.tests.add(r.test_no)
      e.max += cols.reduce((n, [, , m]) => n + m, 0)
    }
    cols.forEach(([k]) => { e.parts[k] += Number(r[k]) || 0 })
    by.set(name, e)
  })
  const rows = [...by.values()].map(e => {
    const total = cols.reduce((n, [k]) => n + e.parts[k], 0)
    return { name: e.name, parts: e.parts, total, max: e.max, tests: e.tests.size, pct: e.max ? Math.round((total / e.max) * 1000) / 10 : 0 }
  }).sort((a, b) => b.pct - a.pct || b.total - a.total || a.name.localeCompare(b.name))
  rows.forEach((r, i) => { r.rank = i && rows[i - 1].pct === r.pct ? rows[i - 1].rank : i + 1 })
  return { rows, fullMax: cols.reduce((n, [, , m]) => n + m, 0), tests: new Set(use.map(r => r.test_no)).size }
}

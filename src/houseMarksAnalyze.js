import { buildCalc } from './houseMarksCalc'

// Analysis of one saved shared test (used by Past results and the admin Dashboard).
export function analyze(r, schoolById, group = '') {
  const subs = Array.isArray(r.subjects) ? r.subjects : []
  const mx = subs.reduce((a, x) => a + Number(x.max || 0), 0)
  const entries = Object.entries(r.marks || {}).filter(([, e]) => !group || (e.group || '') === group)
  const cc = buildCalc(entries.map(([id, e]) => ({ id, m: e.m || [] })), subs, mx)
  const rows = entries.map(([id, e]) => {
    const st = schoolById[id] || {}
    return { id, name: st.name || e.name || 'Student', gcc: st.gcc_no || e.gcc || '', cls: st.class_name || '', house: st.house || '', teacher: e.byName || e.by || r.created_by || 'Not recorded', group: e.group || '', m: e.m || [], c: cc[id] }
  })
  const ranked = rows.filter(x => x.c && x.c.rank).sort((a, b) => a.c.rank - b.c.rank || a.name.localeCompare(b.name))
  const rest = rows.filter(x => !(x.c && x.c.rank)).sort((a, b) => a.name.localeCompare(b.name))
  const by = key => {
    const m = new Map(); rows.forEach(x => { const k = key(x); if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(x) } })
    return [...m].map(([name, list]) => {
      const rk = list.filter(x => x.c && x.c.rank).sort((a, b) => a.c.rank - b.c.rank)
      return { name, count: list.length, ranked: rk.length, avg: rk.length ? rk.reduce((a, x) => a + x.c.pct, 0) / rk.length : null, pass: rk.length ? rk.filter(x => x.c.pass).length / rk.length * 100 : null, top: rk[0] || null }
    }).sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1))
  }
  const subjects = subs.map((sub, i) => {
    const vals = rows.map(x => ({ x, v: x.m[i] })).filter(o => typeof o.v === 'number' && o.v <= Number(sub.max))
    if (!vals.length) return { n: sub.n, max: sub.max, count: 0 }
    const hi = Math.max(...vals.map(o => o.v)), lo = Math.min(...vals.map(o => o.v)), minV = sub.min === '' || sub.min == null ? null : Number(sub.min)
    return { n: sub.n, max: sub.max, count: vals.length, avg: vals.reduce((a, o) => a + o.v, 0) / vals.length, hi, lo, hiNames: vals.filter(o => o.v === hi).map(o => o.x.name), pass: minV == null ? null : vals.filter(o => o.v >= minV).length / vals.length * 100 }
  })
  const gradeCount = {}; ranked.forEach(x => { gradeCount[x.c.grade] = (gradeCount[x.c.grade] || 0) + 1 })
  return {
    subs, mx, rows, ranked, rest, subjects, gradeCount,
    teachers: by(x => x.teacher), groups: by(x => x.group), classes: by(x => x.cls),
    avg: ranked.length ? ranked.reduce((a, x) => a + x.c.pct, 0) / ranked.length : null,
    pass: ranked.length ? ranked.filter(x => x.c.pass).length / ranked.length * 100 : null,
    top: ranked[0] || null,
  }
}

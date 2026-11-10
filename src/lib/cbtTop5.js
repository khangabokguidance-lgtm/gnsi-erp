// cbtTop5.js — the public TOP 5 board. An admin publishes a snapshot from CBT → Result out; viewers see only the top 5
// of that test (overall and per class) and a trend across the latest tests — never the full result list.

const clean = s => String(s ?? '').replace(/\s+/g, ' ').trim()

/** "Moirangthem Himan Singh" → "Moirangthem S." ; one word stays as it is. */
export function shortName(name) {
  const p = clean(name).split(' ').filter(Boolean)
  if (p.length <= 1) return p[0] || ''
  return `${p[0]} ${p[p.length - 1][0].toUpperCase()}.`
}

const rankPool = (pool, n) => {
  const sorted = [...pool].sort((a, b) => b.marks - a.marks || (a.took ?? 1e9) - (b.took ?? 1e9) || a.name.localeCompare(b.name))
  let rank = 0, prev = null
  sorted.forEach((e, i) => { if (prev === null || e.marks !== prev) { rank = i + 1; prev = e.marks } e._r = rank })
  return sorted.slice(0, n)
}

/**
 * entries: buildBoard() output. Options: n (5), nameStyle 'short' | 'full', skipFlagged (leave out candidates the camera /
 * shield flagged), byClass (also the top of each class).
 */
export function makeTop5Snapshot({ entries, n = 5, nameStyle = 'short', skipFlagged = true, byClass = true, now = new Date() }) {
  const submitted = entries.filter(e => e.submitted)
  const pool = submitted.filter(e => !(skipFlagged && e.flags > 0))
  const show = e => ({ rank: e._r, name: nameStyle === 'full' ? clean(e.name) : shortName(e.name), cls: e.classLabel, marks: e.marks, max: e.max, percent: e.percent })
  const overall = rankPool(pool, n).map(show)
  const classes = []
  if (byClass) {
    const keys = [...new Set(pool.filter(e => e.classKey !== 'guest' && e.classKey !== 'unclassified').map(e => e.classKey))]
    for (const k of keys) {
      const members = pool.filter(e => e.classKey === k)
      classes.push({ key: k, label: members[0].classLabel, list: rankPool(members, n).map(show) })
    }
    // keep the school's class order, which entries already carry through their order in the board
    const order = [...new Set(entries.map(e => e.classKey))]
    classes.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  }
  const pct = submitted.map(e => e.percent).filter(p => p != null)
  const topP = pool.map(e => e.percent).filter(p => p != null)
  const r1 = x => Math.round(x * 10) / 10
  return {
    publishedAt: new Date(now).toISOString(), n, nameStyle,
    stats: { appeared: submitted.length, avgPercent: pct.length ? r1(pct.reduce((t, x) => t + x, 0) / pct.length) : null, topPercent: topP.length ? Math.max(...topP) : null, topMarks: overall[0]?.marks ?? null, max: overall[0]?.max ?? null },
    overall, byClass: classes,
  }
}

/** items: cbt_top5_list() result (newest first). → points oldest → newest for the trend line, and which way the top score moved. */
export function trendOf(items) {
  const pts = (Array.isArray(items) ? items : [])
    .filter(i => i && i.top5 && i.top5.stats)
    .map(i => ({ id: i.id, name: String(i.name || ''), at: Date.parse(i.publishedAt || i.top5.publishedAt) || 0, topPercent: i.top5.stats.topPercent ?? null, avgPercent: i.top5.stats.avgPercent ?? null, appeared: i.top5.stats.appeared ?? 0 }))
    .sort((a, b) => a.at - b.at)
    .slice(-8)
  const last = pts.at(-1), prev = pts.at(-2)
  let direction = null
  if (last && prev && last.topPercent != null && prev.topPercent != null) direction = last.topPercent > prev.topPercent ? 'up' : last.topPercent < prev.topPercent ? 'down' : 'flat'
  return { points: pts, direction, change: direction ? Math.round((last.topPercent - prev.topPercent) * 10) / 10 : null }
}

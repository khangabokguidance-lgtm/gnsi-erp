// Smart paper maker: choose questions from the bank to match a blueprint (subjects, chapters, how many, Easy/Medium/Hard mix),
// spreading chapters evenly, keeping reading passages together and preferring questions not used before. Seeded, so the same
// seed always gives the same paper and "shuffle again" is just a new seed.

export function rng(seed) {                         // mulberry32
  let a = (Number(seed) || 1) >>> 0
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
export const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
export const levelOf = q => (['Easy', 'Medium', 'Hard'].includes(q.difficulty) ? q.difficulty : 'Medium')

// Whole-number targets from percentages (largest remainder), always summing to `count`.
export function levelTargets(count, mix) {
  const keys = ['Easy', 'Medium', 'Hard'], total = keys.reduce((t, k) => t + (Number(mix[k]) || 0), 0) || 1
  const raw = keys.map(k => ((Number(mix[k]) || 0) / total) * count), out = Object.fromEntries(keys.map((k, i) => [k, Math.floor(raw[i])]))
  let left = count - keys.reduce((t, k) => t + out[k], 0)
  for (const i of keys.map((k, i) => i).sort((x, y) => (raw[y] - Math.floor(raw[y])) - (raw[x] - Math.floor(raw[x])))) { if (left <= 0) break; out[keys[i]]++; left-- }
  return out
}

// Order a bucket so chapters alternate (one from each topic in turn) and unused questions come first.
function spread(bucket, r, used) {
  const fresh = shuffle(bucket.filter(q => !used.has(q.id)), r), stale = shuffle(bucket.filter(q => used.has(q.id)), r)
  const run = list => {
    const byTopic = new Map(); list.forEach(q => { const k = (q.topic || '').trim() || '—'; (byTopic.get(k) || byTopic.set(k, []).get(k)).push(q) })
    const queues = shuffle([...byTopic.values()], r), out = []
    while (queues.some(x => x.length)) for (const x of queues) if (x.length) out.push(x.shift())
    return out
  }
  return [...run(fresh), ...run(stale)]
}

// Split the Easy/Medium/Hard targets across subjects so the whole paper matches the mix, not just each subject.
export function allocateLevels(count, mix, quotas) {
  const keys = ['Easy', 'Medium', 'Hard'], G = levelTargets(count, mix), left = { ...G }, out = {}
  Object.keys(quotas).forEach(s => {
    const qn = quotas[s], t = { Easy: 0, Medium: 0, Hard: 0 }
    keys.forEach(k => { t[k] = Math.max(0, Math.min(left[k], Math.floor((G[k] * qn) / count))) })
    let rem = qn - keys.reduce((a, k) => a + t[k], 0)
    while (rem > 0) { const k = [...keys].sort((a, b) => (left[b] - t[b]) - (left[a] - t[a]))[0]; t[k]++; rem-- }
    keys.forEach(k => { left[k] -= t[k] }); out[s] = t
  })
  return out
}

export function buildPaper(bank, spec, { seed = 1, locked = [], exclude = [] } = {}) {
  const r = rng(seed), used = new Set(spec.avoidUsed || []), skip = new Set(exclude)
  const count = Math.max(1, Math.min(200, Number(spec.count) || 1))
  const subjects = spec.subjects?.length ? spec.subjects : [...new Set(bank.map(q => q.section))]
  const pool = bank.filter(q => !q.deleted_at && !skip.has(q.id) && subjects.includes(q.section)
    && (!spec.sets?.length || spec.sets.includes(q.test_no)) && (!spec.topics?.length || spec.topics.includes((q.topic || '').trim()))
    && (spec.figures !== false || !q.image_data) && (spec.passages !== false || !q.passage))
  const lockedRows = locked.map(id => bank.find(q => q.id === id)).filter(Boolean)
  const picked = [...lockedRows], have = new Set(picked.map(q => q.id))
  const shortfall = { Easy: 0, Medium: 0, Hard: 0 }
  // subject quotas: split evenly, remainder to the first subjects
  const quota = Object.fromEntries(subjects.map((s, i) => [s, Math.floor(count / subjects.length) + (i < count % subjects.length ? 1 : 0)]))
  const alloc = allocateLevels(count, spec.mix || { Easy: 40, Medium: 40, Hard: 20 }, quota)
  for (const s of subjects) {
    const lockedHere = picked.filter(q => q.section === s).length
    const need0 = quota[s] - lockedHere
    if (need0 <= 0) continue
    const mineAll = pool.filter(q => q.section === s && !have.has(q.id))
    const targets = lockedHere ? levelTargets(need0, spec.mix || { Easy: 40, Medium: 40, Hard: 20 }) : alloc[s]
    const buckets = { Easy: [], Medium: [], Hard: [] }; spread(mineAll, r, used).forEach(q => buckets[levelOf(q)].push(q))
    const take = (q, left) => {                      // a reading passage comes with its other questions
      const group = q.passage ? mineAll.filter(x => x.passage === q.passage && !have.has(x.id)) : [q]
      const chosen = (group.length <= left || !q.passage ? group : [q]).slice(0, Math.max(left, 1))
      chosen.forEach(x => { picked.push(x); have.add(x.id) })
      return chosen.length
    }
    let left = need0
    for (const lv of ['Easy', 'Medium', 'Hard']) {
      let want = Math.min(targets[lv], left)
      for (const q of buckets[lv]) { if (want <= 0 || left <= 0) break; if (have.has(q.id)) continue; const n = take(q, Math.min(want, left)); want -= n; left -= n }
      if (want > 0) shortfall[lv] += want
    }
    for (const lv of ['Medium', 'Easy', 'Hard']) for (const q of buckets[lv]) { if (left <= 0) break; if (have.has(q.id)) continue; left -= take(q, left) }   // borrow to fill
  }
  // order: subjects in the order given, passage groups together, others shuffled once
  const ordered = []
  const seenP = new Set()
  for (const s of subjects) {
    const mine = [...picked.filter(q => q.section === s)]
    const shuffled = shuffle(mine.filter(q => !q.passage), r)
    const groups = [...new Set(mine.filter(q => q.passage).map(q => q.passage))].map(p => mine.filter(q => q.passage === p))
    const units = shuffle([...shuffled.map(q => [q]), ...groups], r)
    units.forEach(u => u.forEach(q => { if (!seenP.has(q.id)) { seenP.add(q.id); ordered.push(q) } }))
  }
  const byLevel = { Easy: 0, Medium: 0, Hard: 0 }; ordered.forEach(q => { byLevel[levelOf(q)]++ })
  const topics = {}; ordered.forEach(q => { const t = (q.topic || '').trim() || 'Other'; topics[t] = (topics[t] || 0) + 1 })
  return { picked: ordered, byLevel, topics, shortfall, requested: count, short: Math.max(0, count - ordered.length), poolSize: pool.length }
}

// A replacement for one question: same subject and level, unused, not already in the paper.
export function swapOne(bank, picked, q, spec, seed) {
  const have = new Set(picked.map(x => x.id)), used = new Set(spec.avoidUsed || [])
  const opts = bank.filter(x => !x.deleted_at && !have.has(x.id) && x.section === q.section && levelOf(x) === levelOf(q) && !x.passage && !q.passage
    && (!spec.sets?.length || spec.sets.includes(x.test_no)) && (!spec.topics?.length || spec.topics.includes((x.topic || '').trim())) && (spec.figures !== false || !x.image_data))
  if (!opts.length) return null
  const r = rng(seed), fresh = opts.filter(x => !used.has(x.id))
  const pool = fresh.length ? fresh : opts
  return pool[Math.floor(r() * pool.length)]
}

// Pure calculation helpers for the House Marks tabs (grading, ranking, mark parsing).
export const GRADES = [[90, 'A+'], [80, 'A'], [70, 'B+'], [60, 'B'], [50, 'C'], [40, 'D'], [0, 'E']]
export const gradeOf = p => (GRADES.find(([m]) => p >= m) || [0, 'E'])[1]
export const gradeColor = g => g === 'A+' || g === 'A' ? '#047857' : g === 'B+' || g === 'B' ? '#1d4ed8' : g === 'C' || g === 'D' ? '#a16207' : '#b91c1c'
export const medal = k => k === 0 ? '🥇' : k === 1 ? '🥈' : k === 2 ? '🥉' : ''
export function buildCalc(items, subjects, maxTotal) {
    const out = {}
    items.forEach(({ id, m }) => {
      let tot = 0, n = 0, ab = 0, bad = false, low = false
      subjects.forEach((sub, i) => {
        const v = m[i] ?? null, st = cellState(v, sub)
        if (st === 'err') bad = true
        if (st === 'low') low = true
        if (typeof v === 'number' && st !== 'err') { tot += v; n++ } else if (v === 'AB') { ab++; if (sub.min !== '' && sub.min != null && !isNaN(Number(sub.min))) low = true }   // absent where a minimum applies cannot pass
      })
      out[id] = { tot, n, bad, low, complete: subjects.length > 0 && !bad && n + ab === subjects.length, partial: !bad && n + ab > 0 && n + ab < subjects.length, absent: subjects.length > 0 && ab === subjects.length, pct: maxTotal ? tot / maxTotal * 100 : 0, rank: null }
    })
    const ids = Object.keys(out).filter(id => out[id].n > 0 && out[id].complete).sort((a, b) => out[b].tot - out[a].tot)
    let rk = 0, prev = null
    ids.forEach((id, k) => { if (out[id].tot !== prev) { rk = k + 1; prev = out[id].tot } out[id].rank = rk })
    const hasMin = subjects.some(sub => sub.min !== '' && sub.min != null && !isNaN(Number(sub.min)))
    // percentile = share of ranked students this one scored higher than; grade from percent; pass = no mark below its minimum
    ids.forEach(id => {
      const c = out[id]
      c.percentile = ids.length > 1 ? ids.filter(o => out[o].tot < c.tot).length / (ids.length - 1) * 100 : 100
      c.grade = gradeOf(c.pct)
      c.pass = c.complete && !c.absent && (hasMin ? !c.low : c.pct >= 40)
    })
    return out
}
export const subjSig = subs => JSON.stringify((subs || []).map(x => [String(x.n || ''), Number(x.max || 0), x.min === '' || x.min == null ? '' : Number(x.min)]))
export function parseMark(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (s === '' || s === '-') return null
  if (/^(ab|a|abs|absent)$/i.test(s)) return 'AB'
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)
  return s // invalid text — kept so it gets flagged
}
export function cellState(v, sub) {
  if (v === null || v === undefined || v === 'AB') return ''
  if (typeof v === 'string') return 'err'
  if (v < 0 || v > Number(sub.max)) return 'err'
  if (sub.min !== '' && sub.min != null && v < Number(sub.min)) return 'low'
  return ''
}

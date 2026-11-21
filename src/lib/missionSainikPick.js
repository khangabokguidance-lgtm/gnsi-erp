// missionSainikPick.js — which of a section's questions go into the paper when several teachers have set it (pure, unit-tested).
// list: the section's questions in upload order, each possibly { in_paper: true } (chosen by an admin). q: how many the paper needs.

// The questions the paper actually uses, in order:
//   • nothing chosen            → the first q uploaded (the old behaviour);
//   • some chosen               → the chosen ones, topped up with the earliest unchosen ones until there are q;
//   • more than q chosen        → the first q chosen.
export function usedQuestions(list, q) {
  const all = list || []
  const chosen = all.filter(x => x.in_paper)
  if (!chosen.length) return all.slice(0, q)
  if (chosen.length >= q) return chosen.slice(0, q)
  const fill = all.filter(x => !x.in_paper).slice(0, q - chosen.length)
  const keep = new Set([...chosen, ...fill])
  return all.filter(x => keep.has(x))                 // keep upload order, so numbering stays stable
}

// Summary for the section header: how many were uploaded, chosen and used, and whether the choice is incomplete or too big.
export function pickSummary(list, q) {
  const all = list || []
  const chosen = all.filter(x => x.in_paper).length
  const used = usedQuestions(all, q).length
  return { total: all.length, chosen, used, extra: Math.max(0, all.length - q), over: chosen > q, short: chosen > 0 && chosen < q, filled: chosen > 0 && chosen < q ? Math.min(q, all.length) - chosen : 0 }
}

// Who contributed how many questions (and how many of theirs are chosen / used).
export function contributors(list, q) {
  const used = new Set(usedQuestions(list, q).map(x => x.id))
  const m = new Map()
  ;(list || []).forEach(x => {
    const name = String(x.uploaded_by || '').trim() || '(unknown)'
    const e = m.get(name) || { name, n: 0, chosen: 0, used: 0 }
    e.n++; if (x.in_paper) e.chosen++; if (used.has(x.id)) e.used++
    m.set(name, e)
  })
  return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))
}

// ── Practice bank: every teacher sets their OWN set of questions for the same practice test (Set N) ───────────────
// Students receive the different versions ("flavours"): Version A is the first teacher's set, Version B the second's, and so on.
// list: the section's questions in upload order (each with uploaded_by); q: questions a full set needs.

// One entry per teacher, in the order they first uploaded: { by, items, count, complete, letter }.
export function flavours(list, q) {
  const m = new Map()
  ;(list || []).forEach(x => {
    const by = String(x.uploaded_by || '').trim() || '(unknown)'
    if (!m.has(by)) m.set(by, [])
    m.get(by).push(x)
  })
  return [...m.entries()].map(([by, items], i) => ({ by, items, count: items.length, complete: items.length >= q, letter: String.fromCharCode(65 + (i % 26)) }))
}

// The questions of version number `idx` (0 = A, 1 = B, …). Complete sets are preferred; versions wrap around when there are fewer
// teachers than versions asked for. One teacher only → their first q questions (same as before).
export function flavourItems(list, q, idx = 0) {
  const fl = flavours(list, q)
  if (!fl.length) return []
  const pool = fl.some(f => f.complete) ? fl.filter(f => f.complete) : fl
  return pool[((idx % pool.length) + pool.length) % pool.length].items.slice(0, q)
}

// Section state for the practice bank: 'ok' when every teacher's set is complete, 'part' when some questions exist, 'none' otherwise.
export function flavourStatus(list, q) {
  const fl = flavours(list, q)
  if (!fl.length) return 'none'
  return fl.every(f => f.complete) ? 'ok' : 'part'
}

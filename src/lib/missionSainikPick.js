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

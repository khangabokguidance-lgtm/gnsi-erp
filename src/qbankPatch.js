// qbankPatch.js — apply a known change to the Question Bank list on screen.
// Used instead of re-downloading all ~10,000 questions after an edit, a delete
// or a single add. `prev` is never changed; a new list comes back.
//   remove: ids to drop · update: [{ id, ...changedFields }] · add: new rows
export function applyBankPatch(prev, { remove = [], update = [], add = [] } = {}) {
  let next = prev
  if (remove.length) {
    const gone = new Set(remove)
    next = next.filter(q => !gone.has(q.id))
  }
  if (update.length) {
    const byId = new Map(update.map(u => [u.id, u]))
    next = next.map(q => (byId.has(q.id) ? { ...q, ...byId.get(q.id) } : q))
  }
  if (add.length) {
    const have = new Set(next.map(q => q.id))
    next = [...next, ...add.filter(r => !have.has(r.id))]
  }
  return next
}

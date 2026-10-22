// courseCatalog.js — fold the batches created in the Courses module (course_batches) into
// the standard course/batch lists the other screens use (pure, so it can be tested).
// Only batches of a course we already know are added; nothing is removed or reordered.

// `structure` is { course: { subtypes: [...] } } or { course: [...] }. Returns true if it changed.
export function mergeLiveBatches(structure, rows, canonical = x => x) {
  let changed = false
  for (const r of rows || []) {
    if (r.status && r.status !== 'Active') continue
    const course = r.course, name = canonical(String(r.subtype || '').trim())
    const entry = structure[course]
    if (!entry || !name) continue
    const list = Array.isArray(entry) ? entry : entry.subtypes
    if (!Array.isArray(list)) continue
    // A course without batches uses '—' as a placeholder (Fee Setup); real batches replace it.
    if (list.length === 1 && list[0] === '—') list.splice(0, 1)
    if (!list.includes(name)) { list.push(name); changed = true }
  }
  return changed
}

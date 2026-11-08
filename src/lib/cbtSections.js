// cbtSections.js — per-section time limits for the CBT exam. Pure: no browser, no database.
// A test can set marking.sectionMinutes = [20, 30, 25] (0 or missing = no limit for that section). The candidate then goes
// through the sections IN ORDER: when a section's time is up the next one opens and the earlier one cannot be
// reopened; they may also move on early. The attempt keeps sec = { i, at } (current section index and when it opened,
// in epoch ms of the server clock) — it rides inside the saved attempt so a reload or another device continues
// correctly. The overall clock (test.durationMin) still applies on top.
// NOTE: this is enforced in the candidate's browser; the server still ends the whole attempt on its own clock.

export const sectionLimits = test => {
  const raw = test?.marking?.sectionMinutes
  const n = (test?.sections || []).length
  return Array.from({ length: n }, (_, i) => Math.max(0, Number(Array.isArray(raw) ? raw[i] : 0) || 0))
}
export const sectionTimed = test => sectionLimits(test).some(m => m > 0)

// Where the candidate is at `now`: { i, at, left } — left is seconds left in the section (null = no limit), `over` when
// the LAST section has run out (the exam is finished). Sections whose time has run out are skipped over in order.
export function settleSection(sec, test, now) {
  const lim = sectionLimits(test)
  let i = Math.min(Math.max(0, sec?.i ?? 0), lim.length - 1)
  let at = sec?.at ?? now
  while (lim[i] > 0 && now - at >= lim[i] * 60000 && i < lim.length - 1) { at += lim[i] * 60000; i += 1 }
  const over = lim[i] > 0 && now - at >= lim[i] * 60000 && i === lim.length - 1
  const left = lim[i] > 0 ? Math.max(0, Math.round((lim[i] * 60000 - (now - at)) / 1000)) : null
  return { i, at, left, over }
}

// Moving on early: the next section opens now.
export const nextSection = (sec, test, now) => ({ i: Math.min((sec?.i ?? 0) + 1, (test.sections || []).length - 1), at: now })

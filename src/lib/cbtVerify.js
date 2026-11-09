// cbtVerify.js — the CBT builder's smart check. After a paper is read (or while a test is edited) every
// question is checked on its own and against its other-language twin, so a figure on the wrong question, a
// shifted translation, a missing option or a repeated question is caught before the test is saved.
// Pure — takes the sections the builder holds, returns a verdict per question.
//
// Errors (a candidate would see something wrong): no question text and no figure; a figure question with no
//   picture; not 4 options, or an empty option; the two papers carry a different picture for the question.
// Checks (probably wrong, look at it): numbers in the Meitei Mayek text differ from the English (numbers do
//   not change with language, so a different number means a different question); the Meitei Mayek text is
//   missing, identical to the English, or mostly Latin letters (not converted); passage present in one
//   language only or with different numbers; two options with the same text; a repeated question.

const MEETEI_DIGITS = /[꯰-꯹]/g
const toAscii = t => String(t || '').replace(MEETEI_DIGITS, c => String(c.charCodeAt(0) - 0xABF0))
export const numbersIn = t => (toAscii(t).match(/\d+(?:[.,]\d+)*/g) || []).map(x => x.replace(/,/g, '')).sort()
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])
const norm = t => String(t || '').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]+/gu, '')
const mayekShare = t => {
  const latin = (String(t).match(/[A-Za-z]/g) || []).length, mayek = (String(t).match(/[ꯀ-꯿]/g) || []).length
  return { latin, mayek }
}

export function verifyTest(sections) {
  const qs = (sections || []).flatMap(s => s.questions)
  const hasMm = qs.some(q => q.textMm || (q.options || []).some(o => o.textMm))
  const firstSeen = new Map()
  const items = qs.map(q => {
    const problems = []
    const err = msg => problems.push({ level: 'error', msg })
    const chk = msg => problems.push({ level: 'warn', msg })
    const opts = q.options || []
    const pics = q.images?.length ? q.images : q.image ? [q.image] : []

    if (q.figure) {
      if (!pics.length) err('A figure question with no picture.')
    } else {
      if (!String(q.text || '').trim()) err('No question text.')
      else if (String(q.text).trim().length < 8) chk('Very short question text — was it cut off?')
      if (opts.length !== 4) err(`${opts.length} option${opts.length === 1 ? '' : 's'} found, 4 expected.`)
      for (const o of opts) if (!String(o.text || '').trim()) err(`Option (${o.key}) is empty.`)
      const seen = new Map()
      for (const o of opts) { const k = norm(o.text); if (!k) continue; if (seen.has(k)) chk(`Options (${seen.get(k)}) and (${o.key}) have the same text.`); else seen.set(k, o.key) }
    }

    // picture: the same question in the other paper must carry the same picture
    if (q.figHash?.length && q.figHashMm?.length) {
      if (!same(q.figHash, q.figHashMm)) err('The Meitei Mayek paper has a different picture for this question.')
    } else if (hasMm && q.figHash?.length && q.figHashMm && !q.figHashMm.length && q.figure) chk('The Meitei Mayek paper has no picture for this question.')
    else if (hasMm && !q.figHash?.length && q.figHashMm?.length) chk('Only the Meitei Mayek paper has a picture for this question.')

    // the other language
    if (hasMm && !q.figure) {
      if (!String(q.textMm || '').trim()) chk('No Meitei Mayek text for this question.')
      else {
        const { latin, mayek } = mayekShare(q.textMm)
        if (norm(q.textMm) === norm(q.text) && /[A-Za-z]{3,}/.test(q.text)) chk('The Meitei Mayek text is the same as the English (not translated?).')
        else if (latin >= 12 && latin / (latin + mayek || 1) > 0.4) chk('The Meitei Mayek text is mostly Latin letters — it may not have been converted.')
        const a = numbersIn(q.text), b = numbersIn(q.textMm)
        if (!same(a, b)) chk(`Numbers differ between the languages: English ${a.join(', ') || 'none'} · Meitei Mayek ${b.join(', ') || 'none'}.`)
      }
      for (const o of opts) {
        if (!String(o.textMm || '').trim()) { chk(`Option (${o.key}) has no Meitei Mayek text.`); continue }
        const a = numbersIn(o.text), b = numbersIn(o.textMm)
        if (!same(a, b)) chk(`Option (${o.key}) numbers differ between the languages: ${a.join(', ') || 'none'} vs ${b.join(', ') || 'none'}.`)
      }
    }
    if (hasMm) {
      if (q.passage && !q.passageMm) chk('There is an English passage but no Meitei Mayek passage.')
      else if (!q.passage && q.passageMm) chk('There is a Meitei Mayek passage but no English passage.')
      else if (q.passage && !same(numbersIn(q.passage), numbersIn(q.passageMm))) chk('Numbers in the passage differ between the languages.')
    }

    // a question that is already in the test
    const key = norm(q.text)
    if (!q.figure && key.length > 12) {
      if (firstSeen.has(key)) chk(`Same question text as Q${firstSeen.get(key)}.`)
      else firstSeen.set(key, q.no)
    }
    // "Looks fine" in the builder: the admin has looked at the checks and accepts them (errors still count).
    const status = problems.some(p => p.level === 'error') ? 'error' : problems.length && !q.reviewed ? 'warn' : 'ok'
    return { no: q.no, status, problems, reviewed: !!q.reviewed && problems.length > 0 }
  })
  const counts = { ok: 0, warn: 0, error: 0 }
  for (const i of items) counts[i.status]++
  return { items, counts, byNo: new Map(items.map(i => [i.no, i])), hasMm }
}

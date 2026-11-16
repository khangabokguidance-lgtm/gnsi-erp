// Advanced paper tools for the Mission Sainik builders — pure functions (unit-tested):
// seeded shuffling into Set A/B/C, paper health report, CSV import, OMR sheet and Word export helpers.

const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim()

// ── seeded shuffle (same seed → same paper every time it is reprinted) ──────────────────────────────
function hash(str) { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19) } return h >>> 0 }
function rng(seed) { let a = hash(seed); return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
function shuffle(list, rand) { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

// items: [{question, option_a..d, answer:'A'..'D', ...}] → same items with `opts` [{k, text}] in the printed order and `answer` remapped.
export function makeVersion(items, { seed = '', shuffleQ = false, shuffleOpts = false } = {}) {
  const rand = rng(seed)
  // Questions that share a reading passage stay together (in their original order) when the questions are shuffled.
  const blocks = []; const byPassage = new Map()
  items.forEach(q => {
    if (q.passage) { if (!byPassage.has(q.passage)) { const b = []; byPassage.set(q.passage, b); blocks.push(b) } byPassage.get(q.passage).push(q) } else blocks.push([q])
  })
  const base = shuffleQ ? shuffle(blocks, rand).flat() : [...items]
  return base.map(q => {
    const opts = ['A', 'B', 'C', 'D'].map(k => ({ k, text: q['option_' + k.toLowerCase()] }))
    const order = shuffleOpts ? shuffle(opts, rand) : opts
    const letters = ['A', 'B', 'C', 'D']
    const printed = order.map((o, i) => ({ k: letters[i], text: o.text, orig: o.k }))
    return { ...q, opts: printed, answer: printed.find(o => o.orig === q.answer)?.k || q.answer, origAnswer: q.answer }
  })
}

// ── health report ───────────────────────────────────────────────────────────────────────────────────
// secs: [{label, q, items}] for one test; others: every question of the same series (to find repeats across tests).
export function paperHealth(secs, others = [], testNo = 0) {
  const all = secs.flatMap(s => s.items)
  const need = secs.reduce((a, s) => a + s.q, 0)
  const lvl = { Easy: 0, Medium: 0, Hard: 0, none: 0 }
  all.forEach(q => { lvl[q.difficulty] != null ? lvl[q.difficulty]++ : lvl.none++ })
  const n = all.length || 1
  const pct = k => Math.round((lvl[k] / n) * 100)
  const mixOk = all.length > 0 && Math.abs(pct('Easy') - 40) <= 10 && Math.abs(pct('Medium') - 40) <= 10 && Math.abs(pct('Hard') - 20) <= 10
  const dist = { A: 0, B: 0, C: 0, D: 0 }; all.forEach(q => { if (dist[q.answer] != null) dist[q.answer]++ })
  const biased = all.length >= 20 && Object.values(dist).some(c => c / all.length > 0.4)
  const seen = new Map(), dupWithin = []
  all.forEach(q => { const k = norm(q.question); if (seen.has(k)) dupWithin.push(q.question); else seen.set(k, q) })
  const across = new Map(); others.filter(o => o.test_no !== testNo).forEach(o => across.set(norm(o.question), o.test_no))
  const dupAcross = all.filter(q => across.has(norm(q.question))).map(q => ({ question: q.question, test: across.get(norm(q.question)) }))
  const sections = secs.map(s => ({ label: s.label, have: s.items.length, need: s.q, noTopic: s.items.filter(q => !q.topic).length, noExp: s.items.filter(q => !q.explanation).length }))
  const checks = [
    { id: 'count', ok: all.length >= need, text: `${Math.min(all.length, need)} of ${need} questions uploaded` },
    { id: 'mix', ok: mixOk, text: `Difficulty mix ${pct('Easy')}/${pct('Medium')}/${pct('Hard')} (aim 40/40/20)${lvl.none ? ` · ${lvl.none} untagged` : ''}` },
    { id: 'bias', ok: !biased, text: `Answer balance A ${dist.A} · B ${dist.B} · C ${dist.C} · D ${dist.D}${biased ? ' — one letter is over 40%' : ''}` },
    { id: 'dup', ok: dupWithin.length === 0, text: dupWithin.length ? `${dupWithin.length} repeated question(s) inside this test` : 'No repeated questions inside this test' },
    { id: 'across', ok: dupAcross.length === 0, text: dupAcross.length ? `${dupAcross.length} question(s) already used in other tests` : 'No question reused from other tests' },
    { id: 'exp', ok: sections.every(s => s.noExp === 0), text: sections.reduce((a, s) => a + s.noExp, 0) ? `${sections.reduce((a, s) => a + s.noExp, 0)} question(s) without an explanation` : 'Every question has an explanation' },
    { id: 'topic', ok: sections.every(s => s.noTopic === 0), text: sections.reduce((a, s) => a + s.noTopic, 0) ? `${sections.reduce((a, s) => a + s.noTopic, 0)} question(s) without a topic` : 'Every question has a topic' },
  ]
  const score = Math.round((checks.filter(c => c.ok).length / checks.length) * 100)
  return { checks, score, dist, lvl, sections, dupWithin, dupAcross }
}

// ── CSV import → the builder's text format ──────────────────────────────────────────────────────────
export function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false
  const s = String(text || '').replace(/^\uFEFF/, '')
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c }
    else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(x => x.trim())) rows.push(row); row = [] }
    else cell += c
  }
  row.push(cell); if (row.some(x => x.trim())) rows.push(row)
  return rows
}
// Columns: Question, A, B, C, D, Answer, Explanation, Topic, Level (header row optional)
export function csvToQuestionText(csv) {
  let rows = parseCsv(csv)
  if (rows.length && /^question/i.test(rows[0][0].trim())) rows = rows.slice(1)
  return rows.map((r, i) => {
    const c = r.map(x => x.trim())
    return [`Q${i + 1}. ${c[0] || ''}`, `A) ${c[1] || ''}`, `B) ${c[2] || ''}`, `C) ${c[3] || ''}`, `D) ${c[4] || ''}`, `Ans: ${(c[5] || '').toUpperCase()}`,
      c[6] ? `Exp: ${c[6]}` : '', c[7] ? `Topic: ${c[7]}` : '', c[8] ? `Level: ${c[8]}` : ''].filter(Boolean).join('\n')
  }).join('\n\n')
}
export const CSV_TEMPLATE = 'Question,A,B,C,D,Answer,Explanation,Topic,Level\n"What is 3/4 + 1/4?","1/2","1","3/4","2","B","Same denominator, add numerators.","Fractions","Easy"\n'

// ── OMR answer sheet (HTML) ─────────────────────────────────────────────────────────────────────────
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
export function omrHtml({ title, institute = '', total = 150, setLabel = '', autoPrint = true }) {
  const perCol = 25, cols = Math.ceil(total / perCol)
  const col = c => Array.from({ length: Math.min(perCol, total - c * perCol) }, (_, i) => {
    const n = c * perCol + i + 1
    return `<div class="r"><b>${n}</b>${['A', 'B', 'C', 'D'].map(l => `<span class="b">${l}</span>`).join('')}</div>`
  }).join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>OMR – ${esc(title)}</title><style>
@page{size:A4;margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,sans-serif;color:#111;font-size:11px}
h1{margin:0;text-align:center;font-size:16px;color:#132a4f}.s{text-align:center;margin:2px 0 8px;color:#444}
.f{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px;margin-bottom:10px}.f div{border:1px solid #444;padding:6px 8px;min-height:30px}
.g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:10px}.r{display:flex;align-items:center;gap:6px;margin:0 0 4px}.r b{width:22px;text-align:right}
.b{width:18px;height:18px;border:1.4px solid #132a4f;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:#132a4f}
.n{margin-top:10px;font-size:10.5px;color:#444;border-top:1px solid #999;padding-top:6px}</style></head><body>
<h1>${esc(institute) || 'Guidance Navodaya &amp; Sainik Institute'}</h1><div class="s">OMR Answer Sheet · ${esc(title)}${setLabel ? ' · Set ' + esc(setLabel) : ''}</div>
<div class="f"><div>Name:</div><div>Roll / GCC no.:</div><div>Batch / Date:</div></div>
<div class="g">${Array.from({ length: cols }, (_, c) => `<div>${col(c)}</div>`).join('')}</div>
<div class="n">Darken one circle per question with a blue/black pen. No negative marking. Do not fold or stain this sheet.</div>
${autoPrint ? '<script>window.onload=()=>window.print()</script>' : ''}</body></html>`
}

// Word opens HTML saved with the .doc extension and keeps the layout.
export function wordWrap(innerHtml, title = 'Paper') {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>${innerHtml}</body></html>`
}

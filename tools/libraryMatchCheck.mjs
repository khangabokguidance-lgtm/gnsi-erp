// libraryMatchCheck.mjs — GNSI Portal
// Checks that the Sainik chapters in the ERP (Study Material + Question Bank) and the
// Library (Claude project "Library/" files) list exactly the same chapters.
//
//   npm run check:library                       → ERP vs manifest (no Library folder needed)
//   node tools/libraryMatchCheck.mjs <folder>   → also checks the Library .md files in <folder>
//        (export/download the project's Library folder; sub-folders Maths/ GK/ etc. are searched)
//
// When you add or rename a chapter on either side, update tools/libraryManifest.json too.
// Exit code 1 = mismatch.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'tools/libraryManifest.json'), 'utf8'))
const libDir = process.argv[2] ? path.resolve(process.argv[2]) : null

let problems = 0
const bad = (msg) => { problems++; console.log('  ✗ ' + msg) }
const ok = (msg) => console.log('  ✓ ' + msg)

// ── ERP sources, read from the source text (no imports needed) ─────────────────
const read = (f) => readFileSync(path.join(root, f), 'utf8')
function slice(src, startMarker, endMarker, from = 0) {
  const s = src.indexOf(startMarker, from)
  if (s < 0) throw new Error(`Could not find "${startMarker}"`)
  const e = src.indexOf(endMarker, s + startMarker.length)
  if (e < 0) throw new Error(`Could not find "${endMarker}" after "${startMarker}"`)
  return src.slice(s, e)
}
// subject → [chapters]; handles both `Subj: [..]` and `Subj: { icon:'..', chapters: [..] }`
function parseSubjects(block) {
  const out = {}
  const re = /(?:'([^']+)'|([A-Za-z_]+))\s*:\s*(?:\{\s*icon:\s*'[^']*'\s*,\s*chapters:\s*)?\[([^\]]*)\]/g
  let m
  while ((m = re.exec(block))) {
    const name = m[1] || m[2]
    if (['chapters', 'subjects', 'sections', 'notes'].includes(name)) continue
    out[name] = [...m[3].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1].replace(/\\'/g, "'"))
  }
  return out
}
const qbSainik = parseSubjects(slice(read('src/qbankTaxonomy.js'), 'sainik: {', 'navodaya: {'))
const smSainik = parseSubjects(slice(read('src/StudyMaterial.jsx'), 'sainik: {', 'navodaya: {'))
const offSrc = read('src/officialSyllabus.js')
const offSainik = parseSubjects(slice(offSrc, '6: {', '9: {', offSrc.indexOf('export const OFFICIAL_CHAPTERS')))

const diff = (a, b) => a.filter(x => !b.includes(x))
const dupes = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i)

console.log('\nERP vs Library manifest (Sainik)\n')
for (const [subj, def] of Object.entries(manifest.subjects)) {
  console.log(subj)
  const lib = def.files.flatMap(f => f.chapters)
  const d = dupes(lib); if (d.length) bad(`manifest lists chapter twice: ${d.join(', ')}`)
  const sm = smSainik[def.erpStudyMaterial]
  const qb = qbSainik[def.erpQBank]
  const off = offSainik[def.erpQBank]
  if (!sm) bad(`Study Material has no subject "${def.erpStudyMaterial}"`)
  if (!qb) bad(`Question Bank has no subject "${def.erpQBank}"`)
  if (!off) bad(`officialSyllabus.js (Sainik Class 6) has no subject "${def.erpQBank}"`)
  if (sm && qb) {
    const a = diff(sm, qb), b = diff(qb, sm)
    if (a.length) bad(`only in Study Material (not in Question Bank): ${a.join(' | ')}`)
    if (b.length) bad(`only in Question Bank (not in Study Material): ${b.join(' | ')}`)
    if (!a.length && !b.length) ok(`Study Material and Question Bank agree (${sm.length} chapters)`)
  }
  for (const [label, erp] of [['Study Material', sm], ['Question Bank', qb], ['official Class 6 syllabus', off]]) {
    if (!erp) continue
    const miss = diff(erp, lib), extra = diff(lib, erp)
    if (miss.length) bad(`in ${label} but no Library file: ${miss.join(' | ')}`)
    if (extra.length) bad(`Library file maps to a chapter missing in ${label}: ${extra.join(' | ')}`)
    if (!miss.length && !extra.length) ok(`Library covers every ${label} chapter`)
  }
}
const known = new Set(Object.values(manifest.subjects).flatMap(d => [d.erpStudyMaterial]))
for (const s of Object.keys(smSainik)) {
  if (!known.has(s) && !manifest.excludedErpSubjects.includes(s)) { console.log(s); bad(`Study Material subject "${s}" is not in the manifest (add it, or list it under excludedErpSubjects)`) }
}

// ── Library folder (optional) ──────────────────────────────────────────────────
if (libDir) {
  console.log('\nLibrary folder: ' + libDir + '\n')
  const found = new Map()
  const walk = (d) => { for (const n of readdirSync(d)) { const p = path.join(d, n); statSync(p).isDirectory() ? walk(p) : found.set(n, p) } }
  walk(libDir)
  const expected = new Set()
  let filled = 0, empty = 0
  for (const [subj, def] of Object.entries(manifest.subjects)) {
    for (const f of def.files) {
      expected.add(f.file)
      const p = found.get(f.file)
      if (!p) { bad(`${subj}: missing Library file ${f.file}`); continue }
      const txt = readFileSync(p, 'utf8')
      if (/Status:\s*empty/i.test(txt)) empty++; else filled++
    }
  }
  for (const n of found.keys()) if (/^(Maths|Intelligence|Language|GK)_\d+_.*\.md$/.test(n) && !expected.has(n)) bad(`Library file not in manifest: ${n}`)
  ok(`${filled} topic files have material, ${empty} are still empty templates`)
}

console.log(problems ? `\n${problems} mismatch(es) — fix the ERP or the Library, then update tools/libraryManifest.json\n` : '\nERP and Library match.\n')
process.exit(problems ? 1 : 0)

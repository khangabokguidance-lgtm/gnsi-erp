// Usage: node scripts/add-mock.mjs path/to/<slug>.json
// Copies a static mock test into public/mocks/ and updates public/mocks/index.json (the list on the exam page).
// Remove a mock: node scripts/add-mock.mjs --remove <slug>
import fs from 'node:fs'
import path from 'node:path'
import { parseMock, manifestEntry, MOCK_SLUG } from '../src/lib/cbtMock.js'

const dir = path.resolve(new URL('../public/mocks', import.meta.url).pathname)
const indexFile = path.join(dir, 'index.json')
fs.mkdirSync(dir, { recursive: true })
const index = fs.existsSync(indexFile) ? JSON.parse(fs.readFileSync(indexFile, 'utf8')) : []
const save = list => fs.writeFileSync(indexFile, JSON.stringify(list, null, 2) + '\n')

const [a, b] = process.argv.slice(2)
if (a === '--remove') {
  if (!MOCK_SLUG.test(b || '')) { console.error('Give the mock name to remove.'); process.exit(1) }
  fs.rmSync(path.join(dir, `${b}.json`), { force: true })
  save(index.filter(m => m.slug !== b)); console.log(`Removed ${b}`); process.exit(0)
}
if (!a) { console.error('Usage: node scripts/add-mock.mjs <file.json>'); process.exit(1) }
const file = JSON.parse(fs.readFileSync(a, 'utf8'))
parseMock(file)                                                   // refuses a bad or empty file
if (!MOCK_SLUG.test(file.slug)) { console.error('Bad mock name in the file.'); process.exit(1) }
fs.writeFileSync(path.join(dir, `${file.slug}.json`), JSON.stringify(file))
save([manifestEntry(file), ...index.filter(m => m.slug !== file.slug)])
console.log(`Added ${file.slug}. Open: /exam?mock=${file.slug}`)

// node scripts/build-guide.mjs — writes docs/GNSI_ERP_Complete_Guide.md from the guide data.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { bookMarkdown, orderChapters } from '../src/lib/guideBook.js'
import * as intro from '../src/data/guideIntro.js'

const dir = path.resolve('src/data/tutorials')
const guides = []
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) guides.push((await import(pathToFileURL(path.join(dir, f)).href)).default)
const chapters = orderChapters(guides, intro.CHAPTER_ORDER, intro.GROUP_TITLES)
const md = bookMarkdown({ title: intro.GUIDE_TITLE, subtitle: intro.GUIDE_SUBTITLE, parts: intro.PARTS, appendix: intro.APPENDIX, chapters, generated: `Generated from the app's built-in guides — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}` })
fs.mkdirSync('docs', { recursive: true })
fs.writeFileSync('docs/GNSI_ERP_Complete_Guide.md', md)
console.log(`wrote docs/GNSI_ERP_Complete_Guide.md — ${guides.length} modules, ${md.split('\n').length} lines`)

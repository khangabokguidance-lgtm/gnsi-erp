// node scripts/build-guide-pdf.mjs — renders docs/GNSI_ERP_Complete_Guide.pdf with headless Chromium.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { bookHtml, orderChapters, BOOK_CSS } from '../src/lib/guideBook.js'
import * as intro from '../src/data/guideIntro.js'

const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE || '/opt/node22/lib/node_modules/playwright/index.mjs')) }

const dir = path.resolve('src/data/tutorials')
const guides = []
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.js')).sort()) guides.push((await import(pathToFileURL(path.join(dir, f)).href)).default)
const chapters = orderChapters(guides, intro.CHAPTER_ORDER, intro.GROUP_TITLES)
const generated = 'Version ' + new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
const html = `<html><head><meta charset="utf-8"><title>${intro.GUIDE_TITLE}</title><style>body{margin:0}${BOOK_CSS}
.book{max-width:none;font-size:11.5px}.book .cover{padding:150px 0 60px}.book h1{font-size:38px}.book h2.part{break-before:page}</style></head>
<body>${bookHtml({ title: intro.GUIDE_TITLE, subtitle: intro.GUIDE_SUBTITLE, parts: intro.PARTS, appendix: intro.APPENDIX, chapters, generated })}</body></html>`

const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({ executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
fs.mkdirSync('docs', { recursive: true })
await page.pdf({
  path: 'docs/GNSI_ERP_Complete_Guide.pdf', format: 'A4', printBackground: true,
  margin: { top: '18mm', bottom: '16mm', left: '16mm', right: '16mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:8px;color:#94a3b8;width:100%;padding:0 16mm;text-align:right">GNSI ERP — Complete User Guide</div>',
  footerTemplate: '<div style="font-size:8px;color:#94a3b8;width:100%;padding:0 16mm;text-align:center">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
})
await browser.close()
console.log('wrote docs/GNSI_ERP_Complete_Guide.pdf', (fs.statSync('docs/GNSI_ERP_Complete_Guide.pdf').size / 1024 / 1024).toFixed(2) + ' MB')

import test from 'node:test'
import assert from 'node:assert/strict'
import { logoSrc, printPremium, DESIGN_CREDIT, FONT_LINKS, FONT_STACK, ICON, PRINT_NOW } from '../src/lib/printPremium.js'

test('the logo: a set https or embedded image is used, anything else falls back to the emblem shipped with the app', () => {
  assert.equal(logoSrc({ logoUrl: 'https://example.com/logo.png' }), 'https://example.com/logo.png')
  assert.equal(logoSrc({ logoUrl: 'data:image/webp;base64,AAAA' }), 'data:image/webp;base64,AAAA')
  assert.match(logoSrc({ logoUrl: 'http://insecure.example/logo.png' }), /\/gnsi-mark\.webp$/)
  assert.match(logoSrc({ logoUrl: 'https://postimg.cc/HrDFYwKn' }), /^https:\/\/postimg\.cc/)   // a configured https link is trusted as is
  assert.match(logoSrc({}), /\/gnsi-mark\.webp$/); assert.match(logoSrc(null), /\/gnsi-mark\.webp$/)
})
test('fonts: Inter, Fraunces and Noto Sans Meetei Mayek are loaded, and printing waits for them', () => {
  for (const f of ['family=Inter', 'family=Fraunces', 'family=Noto+Sans+Meetei+Mayek']) assert.ok(FONT_LINKS.includes(f), f)
  assert.match(FONT_STACK, /^'Inter','Noto Sans Meetei Mayek'/)
  assert.ok(PRINT_NOW.includes('document.fonts') && PRINT_NOW.includes('window.print'))
})
test('icons are inline svg, not emoji', () => {
  for (const k of ['pin', 'clock', 'target', 'note', 'alert']) { assert.match(ICON[k], /^<svg /); assert.ok(!/[\u{1F300}-\u{1FAFF}]/u.test(ICON[k])) }
})
test('the premium print window: letterhead with logo, watermark, a footer on every page with the design credit, no browser header/footer', () => {
  let html = ''
  globalThis.window = { open: () => ({ document: { write: (h) => { html = h }, close: () => {} } }) }
  printPremium('<div class="title">Test</div>', { title: 'T', institute: { name: 'Guidance Navodaya & Sainik Institute', logoUrl: 'https://example.com/l.png', tagline: 'Tag', address: 'Addr' }, docLabel: 'Duty sheet · Meera' })
  delete globalThis.window
  assert.ok(html.includes(DESIGN_CREDIT) && DESIGN_CREDIT === 'Design by Moirangthem Himan Singh')
  assert.ok(html.includes('class="pgfoot"') && html.includes('Duty sheet · Meera'))
  assert.ok(html.includes('class="wm"') && html.includes('class="lg"'))                    // watermark + letterhead logo
  assert.equal(html.split('https://example.com/l.png').length - 1, 3)                       // watermark, letterhead and footer each use the logo
  assert.ok(html.includes('@page{size:A4;margin:0}'))                                       // so the browser prints no date / about:blank / page count
  assert.ok(html.includes('fonts.googleapis.com') && html.includes('Inter'))
  assert.ok(html.includes('Guidance Navodaya &amp; Sainik Institute') && html.includes('Tag') && html.includes('Addr'))
  assert.ok(html.includes('<div class="title">Test</div>'))
})

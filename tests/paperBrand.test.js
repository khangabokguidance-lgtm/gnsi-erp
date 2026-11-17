import test from 'node:test'
import assert from 'node:assert/strict'
import { mergePaperConfig, defaultPaperConfig, DEFAULT_COVER_INSTRUCTIONS } from '../src/lib/missionSainikPaper.js'

const sections = [{ label: 'Mathematics' }, { label: 'Reasoning' }]

test('default config has an empty brand with cover instructions', () => {
  const c = defaultPaperConfig(sections)
  assert.equal(c.brand.name, '')
  assert.equal(c.brand.cover, false)
  assert.equal(c.brand.instructions, DEFAULT_COVER_INSTRUCTIONS)
})

test('saved brand is merged over defaults', () => {
  const c = mergePaperConfig(sections, { brand: { name: 'Acme Coaching', cover: true } })
  assert.equal(c.brand.name, 'Acme Coaching')
  assert.equal(c.brand.cover, true)
  assert.equal(c.brand.accent, '#132a4f')
})

test('unsafe logo and bad accent are dropped', () => {
  const c = mergePaperConfig(sections, { brand: { logo: 'javascript:alert(1)', accent: 'red' } })
  assert.equal(c.brand.logo, '')
  assert.equal(c.brand.accent, '#132a4f')
  const ok = mergePaperConfig(sections, { brand: { logo: 'data:image/png;base64,AAA', accent: '#aabbcc' } })
  assert.equal(ok.brand.logo, 'data:image/png;base64,AAA')
  assert.equal(ok.brand.accent, '#aabbcc')
})

test('old saved configs without brand still load', () => {
  const c = mergePaperConfig(sections, { columns: 1, font: 'times' })
  assert.equal(c.columns, 1)
  assert.ok(c.brand)
})

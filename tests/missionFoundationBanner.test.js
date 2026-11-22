import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setterList, bannerHtml } from '../src/lib/missionFoundationBanner.js'

const panel = { 'Mathematics I': ['Kabiraj', 'Lenin'], 'Mathematics II': ['Lenin', 'Kabiraj'], Reasoning: ['Roshan'], EVS: ['Arjun'] }

test('each setter appears once with all their subjects', () => {
  const l = setterList(panel)
  assert.deepEqual(l.map(p => p.name), ['Kabiraj', 'Lenin', 'Roshan', 'Arjun'])
  assert.deepEqual(l[0].subjects, ['Mathematics I', 'Mathematics II'])
})

test('poster and banner list every setter, with photo or initials, and escape text', () => {
  const people = [{ name: 'A <b>', label: 'Sir A <b>', subjects: ['EVS'], photo: 'https://x/a.jpg' }, { name: 'Roshan', label: 'Sir Roshan', subjects: ['Reasoning'], photo: null }]
  for (const layout of ['poster', 'banner']) {
    const h = bannerHtml({ people, layout, institute: 'GNSI' })
    assert.ok(h.includes('Mission Foundation') && h.includes('Our Question Setters') && h.includes('https://x/a.jpg'))
    assert.ok(h.includes('<span>R</span>'), 'initials when no photo')
    assert.ok(!h.includes('Sir A <b>') && h.includes('Sir A &lt;b&gt;'))
    assert.ok(h.includes(layout === 'poster' ? 'A3 portrait' : 'A3 landscape'))
  }
  assert.ok(!bannerHtml({ people }).includes('window.print'))
  assert.ok(bannerHtml({ people, auto: true }).includes('window.print'))
})

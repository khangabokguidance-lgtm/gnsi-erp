import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { TESTS, SUBJECTS } from '../src/missionSainikData.js'
import { EXAM_PATTERNS, officialSubjects } from '../src/officialSyllabus.js'

// The Word builders load the `docx` package on demand; skip when dependencies are not installed.
const hasDocx = existsSync(new URL('../node_modules/docx', import.meta.url))
const opts = { skip: hasDocx ? false : 'docx not installed' }

test('plan Word file is a valid .docx (zip) with the chapters inside', opts, async () => {
  const { buildPlanDocx } = await import('../src/lib/missionSainikDocx.js')
  const blob = await buildPlanDocx({ tests: TESTS, subjects: SUBJECTS, syl: { [TESTS[0].no + '|' + SUBJECTS[0].label]: 'Fractions; Decimals' }, institute: { name: 'GNSI' } })
  const buf = Buffer.from(await blob.arrayBuffer())
  assert.equal(buf.subarray(0, 2).toString(), 'PK')
  const JSZip = (await import('jszip')).default
  const xml = await (await JSZip.loadAsync(buf)).file('word/document.xml').async('string')
  assert.ok(xml.includes('Fractions') && xml.includes('Decimals') && xml.includes(TESTS[0].id))
})

test('official syllabus Word file builds for both classes', opts, async () => {
  const { buildOfficialDocx } = await import('../src/lib/missionSainikDocx.js')
  for (const cls of [6, 9]) {
    const blob = await buildOfficialDocx({ cls, pattern: EXAM_PATTERNS.sainik.classes[cls], subjects: Object.entries(officialSubjects('sainik', cls)), institute: {} })
    assert.ok(blob.size > 5000)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { rankResults } from '../src/missionFoundationData.js'
import { testReportHtml, reportCardsHtml } from '../src/lib/missionFoundationReport.js'

const papers = [{ subject: 'Mathematics I', questions: 25, marks_each: 2 }, { subject: 'EVS', questions: 25, marks_each: 2 }]
const rows = [
  { student_id: 'a', student_name: 'Asha', batch: 'Udaan', subject: 'Mathematics I', marks: 40 }, { student_id: 'a', student_name: 'Asha', batch: 'Udaan', subject: 'EVS', marks: 30 },
  { student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'Mathematics I', marks: 20 }, { student_id: 'b', student_name: 'Bina', batch: 'Pragati', subject: 'EVS', absent: true, marks: null },
]
test('combined report lists every subject, total, rank and subject averages', () => {
  const ranked = rankResults(rows, papers)
  const html = testReportHtml({ title: 'Test 01', batch: 'All', papers, ranked, rows })
  assert.match(html, /Mathematics I<small>\/50/)
  assert.match(html, /Total<small>of papers sat/)
  assert.match(html, /<td class="l">Asha<\/td><td><\/td><td>Udaan<\/td><td>40<\/td><td>30<\/td><td><b>70<\/b><\/td><td>70<\/td><td>B<\/td>/)
  assert.match(html, /<span class="ab">AB<\/span>/)
  assert.match(html, /Subject average<\/td><td>30<\/td><td>30<\/td>/)
  const cards = reportCardsHtml({ title: 'Test 01', papers, ranked, rows })
  assert.equal((cards.match(/class="card"/g) || []).length, 2)
  assert.match(cards, /1st of 2/)
})

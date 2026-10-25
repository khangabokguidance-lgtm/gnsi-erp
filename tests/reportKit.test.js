// Run with: npm test
import test from 'node:test'
import assert from 'node:assert/strict'
import { reportTable, reportCards, esc, cssStr } from '../src/reportParts.js'

test('report tables escape what staff typed and line up totals', () => {
  const html = reportTable([{ label: 'Name', key: 'name' }, { label: 'Due', key: 'due', align: 'right' }],
    [{ name: '<b>Ravi</b> & Co', due: 500 }], { foot: ['Total', '500'] })
  assert.ok(html.includes('&lt;b&gt;Ravi&lt;/b&gt; &amp; Co'))
  assert.ok(html.includes('<td class="rk-r">500</td>'))
  assert.ok(html.includes('<tfoot><tr><td>Total</td><td class="rk-r">500</td></tr></tfoot>'))
  assert.ok(reportTable([{ label: 'A', key: 'a' }], [], { empty: 'Nothing yet' }).includes('Nothing yet'))
})

test('summary cards take a tone; text is safe in HTML and in CSS page footers', () => {
  assert.ok(reportCards([['Due', '₹5', 'today', '#b42318']]).includes('--tone:#b42318'))
  assert.equal(esc(`<'&">`), '&lt;&#39;&amp;&quot;&gt;')
  assert.equal(cssStr('Fee "Defaulters"\nnext'), 'Fee \\"Defaulters\\" next')
  assert.equal(cssStr('a\\b'), 'a\\\\b')
})

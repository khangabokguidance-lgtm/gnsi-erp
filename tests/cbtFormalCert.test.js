import test from 'node:test'
import assert from 'node:assert/strict'
// premiumCertificate pulls in browser-only modules, so test the pure wording through a stub-free import of the file text.
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('../src/cbtFormalCert.js', import.meta.url), 'utf8')
test('wording builder is pure and uses rank/marks', async () => {
  const code = src.replace(/^import .*$/m, 'const drawFormalCertificate=null, certificatePdf=null').replace(/export /g, '')
  const mod = new Function(`${code}\nreturn { cbtFormalOpts }`)()
  const o = mod.cbtFormalOpts({ student: { name: 'A B', course: 'Navodaya', class_name: 'VI', gcc_no: 12 }, row: { g: { marks: 45, max: 60 }, rank: 2 }, test: { id: 'abcdef123', name: 'Mock 1' }, total: 30 })
  assert.equal(o.seal.value, '75%')
  assert.match(o.body[1], /45 out of 60 marks, securing 2nd rank among 30 candidates\./)
  assert.equal(o.detail, 'Navodaya · VI · GCC No. 12')
  assert.equal(o.certNo, 'GNSI/CBT/ABCDEF12/12')
})

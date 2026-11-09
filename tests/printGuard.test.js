import test from 'node:test'
import assert from 'node:assert/strict'

test('print guard blocks only while engaged', async () => {
  const alerts = []
  const listeners = {}
  globalThis.window = { alert: (m) => alerts.push(m), addEventListener: (t, f) => { listeners[t] = f }, removeEventListener: (t) => { delete listeners[t] } }
  globalThis.document = { head: { appendChild() {} }, getElementById: () => null, createElement: () => ({ remove() {} }) }
  const g = await import('../src/lib/printGuard.js')
  assert.equal(g.denyPrint(), false); assert.equal(alerts.length, 0)
  const off = g.blockExamPrinting()
  assert.equal(g.isPrintBlocked(), true); assert.equal(g.denyPrint(), true); assert.equal(alerts[0], g.PRINT_BLOCKED_MESSAGE)
  let prevented = false
  listeners.keydown({ ctrlKey: true, key: 'P', preventDefault: () => { prevented = true }, stopPropagation() {} })
  assert.ok(prevented)
  off()
  assert.equal(g.isPrintBlocked(), false); assert.equal(g.denyPrint(), false); assert.equal(listeners.keydown, undefined)
})

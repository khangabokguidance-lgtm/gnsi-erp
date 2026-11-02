import test from 'node:test'
import assert from 'node:assert/strict'
import { isWriteLabel, hasWriteRights, isWriteControl } from '../src/lib/readOnlyShield.js'

test('write labels are caught, read labels are not', () => {
  ;['Save', '💾 Save Changes', '+ Add Staff', 'Delete', '🗑 Remove', 'Approve', 'Mark Paid', 'Submit', 'Update salary', 'Edit'].forEach((t) => assert.equal(isWriteLabel(t), true, t))
  ;['Summary', 'Dashboard', 'Export Excel', 'Print', 'View', 'Search', 'Next', 'Close', 'Staff list', 'Monthly report', ''].forEach((t) => assert.equal(isWriteLabel(t), false, t))
})
test('rights', () => {
  assert.equal(hasWriteRights(undefined), false); assert.equal(hasWriteRights({ read: true }), false)
  assert.equal(hasWriteRights({ read: true, edit: true }), true); assert.equal(hasWriteRights({ add: true }), true)
})
const mk = (label, attrs = {}, allow = false) => { const btn = { getAttribute: (k) => attrs[k] ?? null, textContent: label, value: '', closest: (sel) => (sel.includes('data-ro-allow') ? (allow ? {} : null) : btn) }; return { closest: btn.closest, ...{ _b: btn } } }
test('controls: submit always blocked, allow-list respected', () => {
  assert.equal(isWriteControl(mk('Anything', { type: 'submit' })), true)
  assert.equal(isWriteControl(mk('Delete')), true)
  assert.equal(isWriteControl(mk('Delete', {}, true)), false)
  assert.equal(isWriteControl(mk('Summary')), false)
  assert.equal(isWriteControl(null), false)
})

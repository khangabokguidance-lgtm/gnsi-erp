// locker.js — the document types in a student's locker and how to read the rows already in `student_documents`
// (written by the Students module with its own, shorter names). Pure; no Supabase here.
export const LOCKER_TYPES = [
  { type: 'Passport Photo', icon: '🖼️', required: true },
  { type: 'Birth Certificate', icon: '👶', required: true },
  { type: 'Aadhaar Card', icon: '🪪', required: true },
  { type: 'Transfer Certificate', icon: '📄', required: true },
  { type: 'Mark Sheet', icon: '📝', required: true },
  { type: 'Medical Certificate', icon: '🩺', required: false },
  { type: 'Caste / Category Certificate', icon: '📑', required: false },
  { type: 'Income Certificate', icon: '💼', required: false },
  { type: 'Other', icon: '📎', required: false },
]
// Names the Students module already saved, mapped onto the locker's names.
const ALIAS = { 'aadhaar': 'Aadhaar Card', 'aadhar': 'Aadhaar Card', 'aadhaar card': 'Aadhaar Card', 'photo': 'Passport Photo', 'passport photo': 'Passport Photo',
  'caste certificate': 'Caste / Category Certificate', 'category certificate': 'Caste / Category Certificate', 'marksheet': 'Mark Sheet', 'tc': 'Transfer Certificate' }
export const lockerType = t => {
  const k = String(t || '').trim().toLowerCase()
  const hit = LOCKER_TYPES.find(x => x.type.toLowerCase() === k)
  return hit ? hit.type : (ALIAS[k] || 'Other')
}
export const docStatus = d => (d && d.status) || 'Uploaded'

// → { slots: [{ type, icon, required, docs: [newest first], current }], counts }
export function buildLocker(rows = []) {
  const byType = new Map(LOCKER_TYPES.map(t => [t.type, []]))
  for (const r of rows) byType.get(lockerType(r.doc_type)).push(r)
  const slots = LOCKER_TYPES.map(t => {
    const docs = (byType.get(t.type) || []).slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    return { ...t, docs, current: docs[0] || null }
  })
  const req = slots.filter(s => s.required)
  return {
    slots,
    counts: {
      required: req.length,
      haveRequired: req.filter(s => s.current).length,
      verifiedRequired: req.filter(s => s.current && docStatus(s.current) === 'Verified').length,
      total: rows.length,
    },
  }
}

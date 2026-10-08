// mayekRepair.js — repair Meetei Mayek already saved in the Question Bank.
//
// Two kinds of saved Unicode text are wrong:
//   1. Questions imported from the Dream Wings / Eng_Man .docx files
//      (import_dreamwings_to_qbank.cjs, apply_extracted_mayek.cjs). Their
//      Meetei Mayek was converted with an old key table that had several
//      wrong keys (H gave ꯍ not ꯈ, I gave ꯤ not ꯏ, Z gave ꯪ not ꯡ, ',' gave
//      ꯈ …) and left APUN IYEK in typing order. mayekImportRepair.json keeps
//      each imported line's original BMEI04 keys with the text that import
//      saved, so such a question is reconverted from its keys — only when its
//      text is still exactly what the import saved, so later edits are kept.
//   2. Any other Unicode text with APUN IYEK in typing order (ꯈꯋ꯭ꯥ), fixed by
//      fixApunOrder, which leaves correct text alone.
import { supabase } from './supabase'
import { bmeiToUnicode } from './mayekSegments'
import { fixApunOrder } from './meetei_mayek'

const FIELDS = ['question_mayek', 'option_a_mayek', 'option_b_mayek', 'option_c_mayek', 'option_d_mayek']

// What the first APUN repair migration (20261022) made of imported text, so
// rows it already touched are still recognised.
const CONS = '[\\uABC0-\\uABCD\\uABD0\\uABD2-\\uABDA]'
const MIGRATION_APUN = new RegExp(`(${CONS})(${CONS})\\uABED(?=[\\uABDB-\\uABED\\uABF0-\\uABFF]|[^\\uABC0-\\uABFF]|$)`, 'g')
const migrated = t => t.replace(MIGRATION_APUN, '$1꯭$2')

let mapPromise = null
/** Imported text (as saved, or after an APUN repair) -> text reconverted from its BMEI04 keys. */
function importRepairMap() {
  mapPromise ||= import('./mayekImportRepair.json').then(({ default: rows }) => {
    const map = new Map()
    for (const [bmei, saved] of rows) {
      const fixed = bmeiToUnicode(bmei)
      for (const old of [saved, migrated(saved), fixApunOrder(saved)]) if (old !== fixed && !map.has(old)) map.set(old, fixed)
    }
    return map
  })
  return mapPromise
}

/**
 * Work out which questions need their Meetei Mayek repaired.
 * Returns [{ id, question, updates: { field: { before, after } } }].
 * BMEI04 questions are skipped: they hold keystrokes, converted when shown.
 */
export async function planMayekRepair(questions) {
  const map = await importRepairMap()
  const plan = []
  for (const q of questions || []) {
    if (q.question_mayek_font === 'bmei04') continue
    const updates = {}
    for (const f of FIELDS) {
      const v = q[f]
      if (!v || typeof v !== 'string') continue
      const after = map.get(v) ?? map.get(v.trim()) ?? fixApunOrder(v)
      if (after !== v) updates[f] = { before: v, after }
    }
    if (Object.keys(updates).length) plan.push({ id: q.id, question: q.question, updates })
  }
  return plan
}

/** Save a plan from planMayekRepair. Returns { saved, failed }. */
export async function applyMayekRepair(plan, onProgress) {
  let saved = 0, failed = 0
  for (const [i, row] of plan.entries()) {
    const patch = Object.fromEntries(Object.entries(row.updates).map(([f, { after }]) => [f, after]))
    const { data, error } = await supabase.from('qbank_questions').update(patch).eq('id', row.id).select('id')
    if (error || !data?.length) failed++
    else saved++
    onProgress?.(i + 1, plan.length)
  }
  return { saved, failed }
}

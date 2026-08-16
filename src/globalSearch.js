// globalSearch.js — search every registered table, not just student names.
// ─────────────────────────────────────────────────────────────────────────────
// StudentSearch (in Student360.jsx) only matches against the active
// roster's own name/gcc/admission_no/batch columns. This searches EVERY
// table in tableRegistry.js — a receipt number, a gate pass reason, a
// discipline note — and resolves each hit back to the student it belongs
// to, so "data centre" search means "search everything," not just names.
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'
import { TABLE_REGISTRY } from './tableRegistry'
import { getActiveStudents } from './studentQueries'

// Builds an .or() ilike filter string across a table's searchCols for one
// term — e.g. "name.ilike.%ram%,gcc_no.ilike.%ram%,phone.ilike.%ram%"
function buildOrFilter(cols, term) {
  return cols.map(c => `${c}.ilike.%${term}%`).join(',')
}

// Searches one table for a term, capped to a small result count per table
// so a broad global search stays fast — this is a "find and jump," not a
// full report.
async function searchTable(entry, term, limit = 8) {
  if (!entry.searchCols?.length) return []
  const { data, error } = await supabase
    .from(entry.key)
    .select('*')
    .or(buildOrFilter(entry.searchCols, term))
    .limit(limit)
  if (error) { console.error(`globalSearch: ${entry.key} failed:`, error.message); return [] }
  return (data || []).map(row => ({ table: entry, row }))
}

// Resolves a raw hit's owning student. Different tables key by different
// columns (gcc_no, internal id, or student_name — see tableRegistry.js),
// so this tries each in the order that table declares.
function resolveStudentKey(entry, row) {
  if (entry.studentKeyIsId) return { type: 'id', value: row[entry.studentKeyCol] }
  if (entry.studentKeyIsName) return { type: 'name', value: row[entry.studentKeyCol] }
  return { type: 'gcc', value: row[entry.studentKeyCol] }
}

// Runs the search across every table in the registry, in parallel, then
// resolves each hit to a student object from the active roster so results
// can show "who" without a second round-trip per hit.
export async function globalSearch(term, { tableKeys = null } = {}) {
  const cleanTerm = (term || '').trim()
  if (cleanTerm.length < 2) return []

  const tables = tableKeys ? TABLE_REGISTRY.filter(t => tableKeys.includes(t.key)) : TABLE_REGISTRY

  const [tableResults, students] = await Promise.all([
    Promise.all(tables.map(t => searchTable(t, cleanTerm))),
    // Active roster to resolve gcc_no/id/name back to a real student —
    // same source of truth every other module uses.
    getActiveStudents('id,name,gcc_no,course,batch,status'),
  ])

  const byGcc = {}, byId = {}, byName = {}
  students.forEach(s => {
    if (s.gcc_no) byGcc[String(s.gcc_no)] = s
    byId[s.id] = s
    byName[(s.name || '').toLowerCase()] = s
  })

  const hits = []
  tableResults.flat().forEach(({ table, row }) => {
    const key = resolveStudentKey(table, row)
    let student = null
    if (key.type === 'gcc' && key.value) student = byGcc[String(key.value)] || null
    if (key.type === 'id' && key.value) student = byId[key.value] || null
    if (key.type === 'name' && key.value) student = byName[key.value.toLowerCase()] || null

    hits.push({
      table,
      row,
      student,
      summary: table.summarize(row),
    })
  })

  return hits
}
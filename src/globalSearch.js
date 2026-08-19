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

// Fetches every row a specific student has in one table, by that table's
// real student key (id, gcc_no, or name) — used by the by-student pass
// below, NOT by ilike text matching. This is what actually fixes global
// search's accuracy gap: tables like exam_marks, hostel_allocations,
// discipline_records, sickbay_records, leave_records, and all three fee
// tables are keyed by student_id/adm_app_id (a UUID or a raw GCC number),
// which searchCols never listed — so a search for a student's NAME could
// never match those columns via ilike, even though every one of those
// rows has a resolvable link to that student. Searching by the actual key
// (an .eq(), not a text pattern) is the correct fix, not adding a UUID
// column to searchCols, which would just add noise (nobody types a UUID
// into search) without fixing the real problem.
async function fetchStudentRowsForTable(entry, student, limit = 8) {
  const keyCol = entry.studentKeyCol
  if (!keyCol) return []
  let keyValue
  if (entry.studentKeyIsId) keyValue = student.id
  else if (entry.studentKeyIsName) keyValue = student.name
  else keyValue = student.gcc_no != null ? String(student.gcc_no) : null
  if (keyValue == null || keyValue === '') return []

  let q = supabase.from(entry.key).select('*').limit(limit)
  q = entry.studentKeyIsName ? q.ilike(keyCol, keyValue) : q.eq(keyCol, keyValue)
  const { data, error } = await q
  if (error) { console.error(`globalSearch: by-student fetch on ${entry.key} failed:`, error.message); return [] }
  return (data || []).map(row => ({ table: entry, row }))
}

// Resolves a search term to matching students on the active roster, by
// the same fields StudentSearch (in Student360.jsx) itself matches
// against — name, gcc_no, admission_no, phone — so "search a student's
// name" behaves consistently whether typed into the Search Student tab
// or Global Search. Capped small: this feeds the by-student pass below,
// not a roster browser.
function matchStudentsByTerm(students, term) {
  const t = term.toLowerCase()
  return students.filter(s =>
    (s.name || '').toLowerCase().includes(t) ||
    String(s.gcc_no || '').includes(t) ||
    (s.admission_no || '').toLowerCase().includes(t) ||
    (s.phone || '').includes(t)
  ).slice(0, 5)
}

// Resolves a raw hit's owning student. Different tables key by different
// columns (gcc_no, internal id, or student_name — see tableRegistry.js),
// so this tries each in the order that table declares.
export function resolveStudentKey(entry, row) {
  if (entry.studentKeyIsId) return { type: 'id', value: row[entry.studentKeyCol] }
  if (entry.studentKeyIsName) return { type: 'name', value: row[entry.studentKeyCol] }
  return { type: 'gcc', value: row[entry.studentKeyCol] }
}

// Runs the search across every table in the registry, in parallel, then
// resolves each hit to a student object from the active roster so results
// can show "who" without a second round-trip per hit.
//
// Two passes, merged and deduped:
//   1. Direct column match — term matches something in a table's own
//      searchCols (receipt refs, subjects, categories, reasons, etc.).
//   2. By-student match — term matches a student's name/gcc/admission_no/
//      phone on the roster; for every registered table, pull THAT
//      student's rows via the table's real key column (id/gcc_no/name),
//      not a text search. This is what makes "search a student's name"
//      actually surface their fee payments, exam marks, hostel
//      allocation, discipline/sickbay/leave records — tables whose
//      student-key column was never in searchCols and so were
//      unreachable by name search before this fix (see
//      fetchStudentRowsForTable's comment for why .eq()/.ilike() on the
//      real key is correct here, not adding those columns to searchCols).
export async function globalSearch(term, { tableKeys = null } = {}) {
  const cleanTerm = (term || '').trim()
  if (cleanTerm.length < 2) return []

  const tables = tableKeys ? TABLE_REGISTRY.filter(t => tableKeys.includes(t.key)) : TABLE_REGISTRY

  const students = await getActiveStudents('id,name,gcc_no,admission_no,phone,course,batch,status')
  const matchedStudents = matchStudentsByTerm(students, cleanTerm)

  const [directResults, byStudentResultsNested] = await Promise.all([
    Promise.all(tables.map(t => searchTable(t, cleanTerm))),
    Promise.all(
      matchedStudents.flatMap(student => tables.map(t => fetchStudentRowsForTable(t, student)))
    ),
  ])

  const byGcc = {}, byId = {}, byName = {}
  students.forEach(s => {
    if (s.gcc_no) byGcc[String(s.gcc_no)] = s
    byId[s.id] = s
    byName[(s.name || '').toLowerCase()] = s
  })

  const resolveHitStudent = (table, row) => {
    const key = resolveStudentKey(table, row)
    if (key.type === 'gcc' && key.value) return byGcc[String(key.value)] || null
    if (key.type === 'id' && key.value) return byId[key.value] || null
    if (key.type === 'name' && key.value) return byName[key.value.toLowerCase()] || null
    return null
  }

  const seen = new Set() // `${table.key}:${row.id}` — dedupes a row found by both passes
  const hits = []
  const addHits = list => {
    list.forEach(({ table, row }) => {
      const dedupeKey = `${table.key}:${row.id ?? JSON.stringify(row)}`
      if (seen.has(dedupeKey)) return
      seen.add(dedupeKey)
      hits.push({ table, row, student: resolveHitStudent(table, row), summary: table.summarize(row) })
    })
  }

  addHits(directResults.flat())
  addHits(byStudentResultsNested.flat())

  return hits
}
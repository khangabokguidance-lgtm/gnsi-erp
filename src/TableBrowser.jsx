// TableBrowser.jsx — pick any table, see every row, across every student.
// ─────────────────────────────────────────────────────────────────────────────
// The other tabs in Student360 are all scoped to "one student" or "one
// summary view." This is the raw-data-centre piece: choose any table from
// tableRegistry.js, search/sort/page through every row it has, jump to
// the owning student, edit a whitelisted field inline, and export.
//
// Search is server-side (queries the whole table via the same
// searchCols/ilike pattern globalSearch.js uses), not a client-side
// filter over whatever page happens to be loaded — searching a name on
// page 3 while viewing page 1 now actually finds it.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { TABLE_REGISTRY } from './tableRegistry'
import { downloadCSV } from './exportUtils'
import { resolveStudentKey } from './globalSearch'
import { getActiveStudents } from './studentQueries'
import { editField, getEditableFields } from './editEngine'

// ─── EVENT BROADCASTER ───
// Dispatches a global event so other open modules instantly refetch 
// their data without requiring a manual page refresh.
function broadcastCrossModuleWrite(tableKey, detail) {
  const eventName = tableKey === 'students' ? 'gnsi:students-updated'
    : tableKey === 'admissions' ? 'gnsi:admissions-updated'
    : null
  if (!eventName) return
  try { window.dispatchEvent(new CustomEvent(eventName, { detail })) } catch (e) {
    console.error('broadcastCrossModuleWrite failed:', e)
  }
}

// Mirrors editEngine.js's STUDENT_ADM_SYNC_FIELDS keys, for confirm-dialog
// copy only — the actual cascade-sync enforcement stays in editEngine.js.
const STUDENT_ADM_SYNC_FIELDS_HINT = new Set([
  'name','dob','gender','blood_group','course','batch','class_name','house',
  'hostel_type','session','father_name','mother_name','phone','parent_phone',
  'address','prev_school','referral_source','remarks',
])

const NAVY = '#0B1E3D', GOLD = '#C9A24B', RED = '#dc2626', GREEN = '#16a34a'
const SLATE = { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155' }
const PAGE_SIZE = 100

function buildOrFilter(cols, term) {
  return cols.map(c => `${c}.ilike.%${term}%`).join(',')
}

// Mobile breakpoint — below this, rows render as stacked cards instead of
// a horizontally-scrolling table, since a table with 10+ columns is
// unusable squeezed into a phone width even with scroll.
const MOBILE_BREAKPOINT = 680

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
  )
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handler = (e) => setIsMobile(e.matches)
    setIsMobile(mq.matches)
    mq.addEventListener ? mq.addEventListener('change', handler) : mq.addListener(handler)
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', handler) : mq.removeListener(handler)
    }
  }, [])
  return isMobile
}

export default function TableBrowser({ onOpenStudent, onOpenModule }) {
  const isMobile = useIsMobile()
  const [tableKey, setTableKey] = useState(TABLE_REGISTRY[0].key)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loadError, setLoadError] = useState(null)
  const [sortCol, setSortCol] = useState(null)   // null = use registry orderCol
  const [sortDir, setSortDir] = useState('desc')
  const [hiddenCols, setHiddenCols] = useState(() => new Set())
  const [showColPicker, setShowColPicker] = useState(false)
  const [studentsByKey, setStudentsByKey] = useState({ byGcc: {}, byId: {}, byName: {} })

  // ─── Bulk edit / find-replace state ───
  // selectedIds keys off row.id — cleared whenever the table changes or a
  // fresh page loads, since selections referring to rows no longer on
  // screen would silently do nothing (or worse, feel like they applied to
  // rows the person can't currently see).
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [bulkField, setBulkField] = useState('')
  const [bulkMatchValue, setBulkMatchValue] = useState('')   // find (optional filter)
  const [bulkNewValue, setBulkNewValue] = useState('')       // replace
  const [bulkConfirming, setBulkConfirming] = useState(false)
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState(null)   // { done, total, errors: [{id,message}] }

  const entry = TABLE_REGISTRY.find(t => t.key === tableKey)
  const effectiveSortCol = sortCol || entry?.orderCol

  // Active roster, loaded once — used to resolve each row to its student
  // for the "Open Student" link, same three-key resolution globalSearch.js
  // uses (gcc_no / internal id / student_name, whichever the table keys by).
  useEffect(() => {
    getActiveStudents('id,name,gcc_no,course,batch,status').then(students => {
      const byGcc = {}, byId = {}, byName = {}
      students.forEach(s => {
        if (s.gcc_no) byGcc[String(s.gcc_no)] = s
        byId[s.id] = s
        byName[(s.name || '').toLowerCase()] = s
      })
      setStudentsByKey({ byGcc, byId, byName })
    })
  }, [])

  const resolveRowStudent = useCallback((row) => {
    if (!entry) return null
    const key = resolveStudentKey(entry, row)
    if (key.type === 'gcc' && key.value) return studentsByKey.byGcc[String(key.value)] || null
    if (key.type === 'id' && key.value) return studentsByKey.byId[key.value] || null
    if (key.type === 'name' && key.value) return studentsByKey.byName[key.value.toLowerCase()] || null
    return null
  }, [entry, studentsByKey])

  // Table/search/sort changed — reset to page 0 and reload from scratch.
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const orderCol = effectiveSortCol
    if (!orderCol) {
      setLoadError(`No orderCol configured for "${tableKey}" in tableRegistry.js — add one before browsing this table.`)
      setRows([]); setTotalCount(0); setLoading(false)
      return
    }
    let q = supabase.from(tableKey).select('*', { count: 'exact' })
    // Server-side search across the whole table, not just the loaded page
    // — same ilike-across-searchCols pattern globalSearch.js uses.
    const term = search.trim()
    if (term.length >= 2 && entry?.searchCols?.length) {
      q = q.or(buildOrFilter(entry.searchCols, term))
    }
    q = q.order(orderCol, { ascending: sortDir === 'asc' }).range(0, PAGE_SIZE - 1)
    const { data, count, error } = await q
    if (error) {
      console.error(`TableBrowser: ${tableKey} load failed:`, error.message)
      setLoadError(`Failed to load "${entry?.label || tableKey}": ${error.message}`)
      setRows([]); setTotalCount(0); setLoading(false)
      return
    }
    setRows(data || [])
    setTotalCount(count || 0)
    setPage(0)
    setLoading(false)
    setSelectedIds(new Set())
    setBulkResult(null)
  }, [tableKey, search, effectiveSortCol, sortDir])

  useEffect(() => { load() }, [load])

  const loadPage = useCallback(async (p) => {
    setLoading(true)
    setLoadError(null)
    const orderCol = effectiveSortCol
    if (!orderCol) { setLoading(false); return }
    let q = supabase.from(tableKey).select('*')
    const term = search.trim()
    if (term.length >= 2 && entry?.searchCols?.length) {
      q = q.or(buildOrFilter(entry.searchCols, term))
    }
    q = q.order(orderCol, { ascending: sortDir === 'asc' }).range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1)
    const { data, error } = await q
    if (error) {
      console.error(`TableBrowser: ${tableKey} page load failed:`, error.message)
      setLoadError(`Failed to load page ${p + 1}: ${error.message}`)
      setLoading(false)
      return
    }
    setRows(data || [])
    setPage(p)
    setLoading(false)
    setSelectedIds(new Set())
    setBulkResult(null)
  }, [tableKey, search, effectiveSortCol, sortDir])

  // Reset per-table UI state (sort/columns) when switching tables — a
  // sort column or hidden-column set from one table has no meaning on
  // another table's different schema.
  const changeTable = (key) => {
    setTableKey(key)
    setSortCol(null)
    setSortDir('desc')
    setHiddenCols(new Set())
    setShowColPicker(false)
    setSelectedIds(new Set())
    setBulkField(''); setBulkMatchValue(''); setBulkNewValue('')
    setBulkConfirming(false); setBulkResult(null)
  }

  const toggleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const allColumns = useMemo(() => rows[0] ? Object.keys(rows[0]).filter(c => c !== 'id') : [], [rows])
  const columns = useMemo(() => allColumns.filter(c => !hiddenCols.has(c)), [allColumns, hiddenCols])
  const editableFields = getEditableFields(tableKey, rows[0])

  const toggleCol = (c) => {
    setHiddenCols(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c); else next.add(c)
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  // ─── Bulk edit / find-replace helpers ───
  // Rows eligible for the "find" filter: if bulkMatchValue is set, only rows
  // whose current value in bulkField equals it (case-insensitive string
  // compare) are eligible — lets "find X, replace with Y" work without a
  // separate code path from plain bulk-set-selected-rows.
  const bulkFieldDef = editableFields?.[bulkField]
  const eligibleForBulk = useMemo(() => {
    if (!bulkField) return rows
    const term = bulkMatchValue.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(r => String(r[bulkField] ?? '').toLowerCase() === term)
  }, [rows, bulkField, bulkMatchValue])

  const toggleRowSelected = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAllEligible = () => {
    setSelectedIds(prev => {
      const eligibleIds = eligibleForBulk.map(r => r.id)
      const allSelected = eligibleIds.length > 0 && eligibleIds.every(id => prev.has(id))
      if (allSelected) return new Set()
      return new Set(eligibleIds)
    })
  }

  // Selected rows, restricted to whichever are still actually eligible
  // (e.g. person picked a match filter after already selecting some rows).
  const selectedRows = rows.filter(r => selectedIds.has(r.id) && eligibleForBulk.includes(r))

  const runBulkApply = async () => {
    if (!bulkField || selectedRows.length === 0) return
    setBulkRunning(true)
    setBulkResult(null)
    const errors = []
    let done = 0
    // Sequential, not Promise.all — each edit goes through editField's own
    // whitelist check, admissions cascade sync, and audit log write. Doing
    // these one at a time keeps failures isolated to a single row and
    // keeps the audit trail's ordering meaningful.
    for (const row of selectedRows) {
      try {
        await editField({
          tableKey, rowId: row.id, field: bulkField,
          oldValue: row[bulkField], newValue: bulkNewValue,
          studentContext: resolveRowStudent(row),
        })
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, [bulkField]: bulkNewValue } : r))
        done++
      } catch (e) {
        errors.push({ id: row.id, message: e.message || 'Save failed' })
      }
    }
    broadcastCrossModuleWrite(tableKey, { type: 'bulk_update', field: bulkField, count: done })
    setBulkResult({ done, total: selectedRows.length, errors })
    setBulkRunning(false)
    setBulkConfirming(false)
    if (errors.length === 0) {
      setSelectedIds(new Set())
      setBulkField(''); setBulkMatchValue(''); setBulkNewValue('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0, maxWidth: '100%', width: '100%', boxSizing: 'border-box' }}>

      {/* Table picker */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={tableKey} onChange={e => changeTable(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${SLATE[200]}`, fontSize: 13, fontWeight: 700, color: NAVY }}>
          {TABLE_REGISTRY.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
        </select>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search the whole table (2+ characters)…"
          style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${SLATE[200]}`, fontSize: 12.5, flex: '1 1 220px', minWidth: 180 }}
        />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowColPicker(o => !o)}
            style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${SLATE[200]}`, background: '#fff', color: NAVY, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Columns {hiddenCols.size > 0 ? `(${allColumns.length - hiddenCols.size}/${allColumns.length})` : ''}
          </button>
          {showColPicker && (
            <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 20, background: '#fff', border: `1px solid ${SLATE[200]}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: 10, minWidth: 200, maxHeight: 280, overflowY: 'auto' }}>
              {allColumns.map(c => (
                <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px', fontSize: 12, color: SLATE[600], cursor: 'pointer' }}>
                  <input type="checkbox" checked={!hiddenCols.has(c)} onChange={() => toggleCol(c)} />
                  {c.replace(/_/g, ' ')}
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => downloadCSV(rows.map(r => Object.fromEntries(columns.map(c => [c, r[c]]))), `${tableKey}_export`)}
          disabled={rows.length === 0}
          style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: rows.length ? NAVY : SLATE[300], color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: rows.length ? 'pointer' : 'default' }}>
          Export CSV
        </button>
        {entry && onOpenModule && (
          <button onClick={() => onOpenModule(entry.module)}
            style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${SLATE[200]}`, background: '#fff', color: NAVY, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Open {entry.label} module &rarr;
          </button>
        )}
      </div>

      <div style={{ fontSize: 11, color: SLATE[400] }}>
        {totalCount.toLocaleString('en-IN')} total row(s) in {entry?.label} &middot; showing page {page + 1} of {totalPages}
        {search.trim().length >= 2 && ` \u00b7 filtered by "${search.trim()}" across the whole table`}
        {sortCol && ` \u00b7 sorted by ${sortCol.replace(/_/g, ' ')} (${sortDir})`}
        {!isMobile && columns.length > 5 && ' \u00b7 scroll sideways to see more columns \u2192'}
      </div>

      {/* Bulk edit / find-replace */}
      {editableFields && !loading && !loadError && rows.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', padding: '10px 12px', background: SLATE[50], border: `1px solid ${SLATE[200]}`, borderRadius: 12 }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: NAVY, textTransform: 'uppercase', letterSpacing: '.03em' }}>Bulk edit</span>
          <select value={bulkField} onChange={e => { setBulkField(e.target.value); setBulkMatchValue(''); setBulkNewValue(''); setBulkResult(null) }}
            style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 12 }}>
            <option value="">Field&hellip;</option>
            {Object.keys(editableFields).map(f => <option key={f} value={f}>{editableFields[f].label}</option>)}
          </select>
          {bulkField && (
            <>
              <input value={bulkMatchValue} onChange={e => setBulkMatchValue(e.target.value)}
                placeholder="Find (optional, exact match)"
                style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 12, flex: '1 1 150px', minWidth: 120, maxWidth: 220 }} />
              <span style={{ fontSize: 12, color: SLATE[400] }}>&rarr;</span>
              {bulkFieldDef?.type === 'select' ? (
                <select value={bulkNewValue} onChange={e => setBulkNewValue(e.target.value)}
                  style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 12 }}>
                  <option value="">Replace with&hellip;</option>
                  {bulkFieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input value={bulkNewValue} onChange={e => setBulkNewValue(e.target.value)}
                  placeholder="Replace with"
                  style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, fontSize: 12, flex: '1 1 130px', minWidth: 110, maxWidth: 200 }} />
              )}
              <button onClick={toggleSelectAllEligible}
                style={{ padding: '6px 10px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 11.5, fontWeight: 700, color: NAVY, cursor: 'pointer' }}>
                {eligibleForBulk.length > 0 && eligibleForBulk.every(r => selectedIds.has(r.id)) ? 'Deselect all' : `Select all matching (${eligibleForBulk.length})`}
              </button>
              <span style={{ fontSize: 11.5, color: SLATE[500] }}>{selectedRows.length} selected on this page</span>
              <button onClick={() => setBulkConfirming(true)} disabled={selectedRows.length === 0 || bulkNewValue === ''}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: selectedRows.length && bulkNewValue !== '' ? NAVY : SLATE[300], color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: selectedRows.length && bulkNewValue !== '' ? 'pointer' : 'default' }}>
                Apply to {selectedRows.length} row{selectedRows.length === 1 ? '' : 's'}
              </button>
            </>
          )}

          {bulkConfirming && (
            <div style={{ width: '100%', marginTop: 4, padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, fontSize: 12.5, color: '#991b1b' }}>
              <div style={{ marginBottom: 8 }}>
                This will set <strong>{editableFields[bulkField]?.label}</strong> to <strong>{bulkNewValue || '(empty)'}</strong> on <strong>{selectedRows.length}</strong> row{selectedRows.length === 1 ? '' : 's'} in <strong>{entry?.label}</strong>{tableKey === 'students' && STUDENT_ADM_SYNC_FIELDS_HINT.has(bulkField) ? ' and will sync to the matching Admissions rows' : ''}. This writes directly to the database and cannot be undone from here.
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={runBulkApply} disabled={bulkRunning}
                  style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: RED, color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: bulkRunning ? 'default' : 'pointer' }}>
                  {bulkRunning ? 'Applying…' : 'Yes, apply'}
                </button>
                <button onClick={() => setBulkConfirming(false)} disabled={bulkRunning}
                  style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: '#fff', color: SLATE[600], fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {bulkResult && (
            <div style={{ width: '100%', marginTop: 4, padding: '8px 12px', borderRadius: 10, fontSize: 12, background: bulkResult.errors.length ? '#fef2f2' : '#f0fdf4', color: bulkResult.errors.length ? '#991b1b' : '#166534' }}>
              Updated {bulkResult.done} of {bulkResult.total} row(s).
              {bulkResult.errors.length > 0 && (
                <span> {bulkResult.errors.length} failed — {bulkResult.errors.map(e => e.message).join('; ')}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Rows: table on desktop, stacked cards on mobile */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: SLATE[400] }}>Loading {entry?.label}&hellip;</div>
      ) : loadError ? (
        <div style={{ padding: '20px 24px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, color: '#991b1b', fontSize: 13 }}>
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Couldn't load this table</div>
          <div>{loadError}</div>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: SLATE[400], background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}` }}>
          No rows{search.trim() ? ' match this search' : ''}.
        </div>
      ) : isMobile ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((r, i) => (
            <RowCard key={r.id ?? i} row={r} columns={columns} tableKey={tableKey}
              editableFields={editableFields} student={resolveRowStudent(r)} onOpenStudent={onOpenStudent}
              selectable={!!editableFields} selected={selectedIds.has(r.id)}
              selectDisabled={!bulkField || !eligibleForBulk.includes(r)}
              onToggleSelected={() => toggleRowSelected(r.id)}
              onRowUpdated={(field, val) => setRows(prev => prev.map(row => row === r ? { ...row, [field]: val } : row))} />
          ))}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}`, overflowX: 'auto', overflowY: 'auto', maxHeight: 560, maxWidth: '100%', minWidth: 0, WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: SLATE[50], position: 'sticky', top: 0 }}>
                <th style={{ padding: '8px 10px', borderBottom: `1px solid ${SLATE[200]}`, width: 1 }} />
                {editableFields && (
                  <th style={{ padding: '8px 10px', borderBottom: `1px solid ${SLATE[200]}`, width: 1 }}>
                    <input type="checkbox" title="Select all matching rows for bulk edit"
                      checked={eligibleForBulk.length > 0 && eligibleForBulk.every(r => selectedIds.has(r.id))}
                      onChange={toggleSelectAllEligible} disabled={!bulkField} />
                  </th>
                )}
                {columns.map(c => {
                  const active = sortCol === c
                  return (
                    <th key={c} onClick={() => toggleSort(c)}
                      style={{ padding: '8px 10px', textAlign: 'left', color: active ? NAVY : SLATE[500], fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.02em', borderBottom: `1px solid ${SLATE[200]}`, whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none' }}>
                      {c.replace(/_/g, ' ')} {active ? (sortDir === 'asc' ? '\u25b2' : '\u25bc') : ''}
                    </th>
                  )
                })}
                {editableFields && <th style={{ padding: '8px 10px', borderBottom: `1px solid ${SLATE[200]}`, width: 1 }} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <TableRow key={r.id ?? i} row={r} columns={columns} tableKey={tableKey}
                  editableFields={editableFields} student={resolveRowStudent(r)} onOpenStudent={onOpenStudent}
                  selectable={!!editableFields} selected={selectedIds.has(r.id)}
                  selectDisabled={!bulkField || !eligibleForBulk.includes(r)}
                  onToggleSelected={() => toggleRowSelected(r.id)}
                  onRowUpdated={(field, val) => setRows(prev => prev.map(row => row === r ? { ...row, [field]: val } : row))} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
          <button onClick={() => loadPage(Math.max(0, page - 1))} disabled={page === 0}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 12, fontWeight: 700, color: page === 0 ? SLATE[300] : NAVY, cursor: page === 0 ? 'default' : 'pointer' }}>
            &larr; Prev
          </button>
          <span style={{ fontSize: 12, color: SLATE[500] }}>Page {page + 1} / {totalPages}</span>
          <button onClick={() => loadPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 12, fontWeight: 700, color: page >= totalPages - 1 ? SLATE[300] : NAVY, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

// Mobile stacked-card equivalent of TableRow — same edit/select behavior,
// laid out as label/value pairs so nothing gets squeezed into unreadable
// table cells on a phone width. Shares the save-via-editField path with
// TableRow rather than reimplementing it, so audit logging and the
// students->admissions cascade sync stay identical between layouts.
function RowCard({ row, columns, tableKey, editableFields, student, onOpenStudent, onRowUpdated, selectable, selected, selectDisabled, onToggleSelected }) {
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const startEdit = (field) => {
    setEditingField(field)
    setDraft(row[field] ?? '')
    setErr(null)
  }

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      await editField({ tableKey, rowId: row.id, field: editingField, oldValue: row[editingField], newValue: draft, studentContext: student })
      broadcastCrossModuleWrite(tableKey, {
        type: 'update',
        student_id: student?.id || (tableKey === 'students' ? row.id : null),
        field: editingField,
      })
      onRowUpdated(editingField, draft)
      setEditingField(null)
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${SLATE[200]}`, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {selectable && (
            <input type="checkbox" checked={selected} disabled={selectDisabled} onChange={onToggleSelected}
              title={selectDisabled ? 'Pick a bulk-edit field above first' : undefined} />
          )}
          {student && onOpenStudent && (
            <button onClick={() => onOpenStudent(student)} title={`Open ${student.name}'s profile`}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 15, padding: 2, flexShrink: 0 }}>
              &#128100;
            </button>
          )}
        </div>
        {editableFields && !editingField && (
          <select onChange={e => { if (e.target.value) startEdit(e.target.value); e.target.value = '' }} defaultValue=""
            style={{ fontSize: 11, color: SLATE[400], border: `1px solid ${SLATE[200]}`, borderRadius: 6, padding: '3px 5px', cursor: 'pointer' }}>
            <option value="" disabled>Edit&hellip;</option>
            {Object.keys(editableFields).map(f => <option key={f} value={f}>{editableFields[f].label}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {columns.map(c => {
          const fieldDef = editableFields?.[c]
          const isEditingThis = editingField === c
          return (
            <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 6, borderBottom: `1px solid ${SLATE[100]}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: SLATE[400], textTransform: 'uppercase', letterSpacing: '.03em' }}>{c.replace(/_/g, ' ')}</span>
              {isEditingThis ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {fieldDef.type === 'select' ? (
                    <select value={draft} onChange={e => setDraft(e.target.value)} autoFocus
                      style={{ padding: '5px 6px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, fontSize: 13, flex: 1, minWidth: 100 }}>
                      {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
                      style={{ padding: '5px 6px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, fontSize: 13, flex: 1, minWidth: 100 }} />
                  )}
                  <button onClick={save} disabled={saving} title="Save"
                    style={{ border: 'none', background: GREEN, color: '#fff', borderRadius: 5, fontSize: 11, fontWeight: 700, padding: '5px 8px', cursor: 'pointer' }}>&#10003;</button>
                  <button onClick={() => setEditingField(null)} disabled={saving} title="Cancel"
                    style={{ border: 'none', background: SLATE[200], color: SLATE[600], borderRadius: 5, fontSize: 11, fontWeight: 700, padding: '5px 8px', cursor: 'pointer' }}>&#10005;</button>
                  {err && <span style={{ fontSize: 10.5, color: RED, width: '100%' }}>{err}</span>}
                </div>
              ) : (
                <span
                  onClick={() => fieldDef && startEdit(c)}
                  style={{ fontSize: 13.5, color: SLATE[700], wordBreak: 'break-word', cursor: fieldDef ? 'pointer' : 'default', borderBottom: fieldDef ? `1px dashed ${SLATE[300]}` : 'none', display: 'inline-block' }}
                >
                  {row[c] == null || row[c] === '' ? <span style={{ color: SLATE[300] }}>&mdash;</span> : String(row[c])}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// One table row — a separate component so its own inline-edit state
// (which field is being edited) doesn't re-render the whole table.
function TableRow({ row, columns, tableKey, editableFields, student, onOpenStudent, onRowUpdated, selectable, selected, selectDisabled, onToggleSelected }) {
  const [editingField, setEditingField] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  const startEdit = (field) => {
    setEditingField(field)
    setDraft(row[field] ?? '')
    setErr(null)
  }

  const save = async () => {
    setSaving(true); setErr(null)
    try {
      await editField({ tableKey, rowId: row.id, field: editingField, oldValue: row[editingField], newValue: draft, studentContext: student })
      
      // ─── BROADCAST THE UPDATE ───
      // Ensures the change is instantly reflected across the rest of the application
      broadcastCrossModuleWrite(tableKey, { 
        type: 'update', 
        student_id: student?.id || (tableKey === 'students' ? row.id : null), 
        field: editingField 
      })

      onRowUpdated(editingField, draft)
      setEditingField(null)
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr style={{ borderBottom: `1px solid ${SLATE[100]}` }}>
      <td style={{ padding: '7px 6px', textAlign: 'center' }}>
        {student && onOpenStudent && (
          <button onClick={() => onOpenStudent(student)} title={`Open ${student.name}'s profile`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, padding: 2 }}>
            &#128100;
          </button>
        )}
      </td>
      {selectable && (
        <td style={{ padding: '7px 6px', textAlign: 'center' }}>
          <input type="checkbox" checked={selected} disabled={selectDisabled} onChange={onToggleSelected}
            title={selectDisabled ? 'Pick a bulk-edit field above first' : undefined} />
        </td>
      )}
      {columns.map(c => {
        const fieldDef = editableFields?.[c]
        const isEditingThis = editingField === c
        return (
          <td key={c} style={{ padding: '7px 10px', color: SLATE[700], whiteSpace: 'normal', wordBreak: 'break-word', maxWidth: 260, position: 'relative' }}>
            {isEditingThis ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {fieldDef.type === 'select' ? (
                  <select value={draft} onChange={e => setDraft(e.target.value)} autoFocus
                    style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, fontSize: 11.5 }}>
                    {fieldDef.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={draft} onChange={e => setDraft(e.target.value)} autoFocus
                    style={{ padding: '3px 6px', borderRadius: 6, border: `1px solid ${SLATE[200]}`, fontSize: 11.5, width: 120 }} />
                )}
                <button onClick={save} disabled={saving} title="Save"
                  style={{ border: 'none', background: GREEN, color: '#fff', borderRadius: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 6px', cursor: 'pointer' }}>&#10003;</button>
                <button onClick={() => setEditingField(null)} disabled={saving} title="Cancel"
                  style={{ border: 'none', background: SLATE[200], color: SLATE[600], borderRadius: 5, fontSize: 10.5, fontWeight: 700, padding: '3px 6px', cursor: 'pointer' }}>&#10005;</button>
                {err && <span style={{ fontSize: 10, color: RED, position: 'absolute', top: '100%', left: 0, whiteSpace: 'normal', background: '#fff', padding: 2 }}>{err}</span>}
              </div>
            ) : (
              <span
                onDoubleClick={() => fieldDef && startEdit(c)}
                title={fieldDef ? 'Double-click to edit' : undefined}
                style={{ cursor: fieldDef ? 'pointer' : 'default', borderBottom: fieldDef ? `1px dashed ${SLATE[300]}` : 'none' }}
              >
                {row[c] == null || row[c] === '' ? <span style={{ color: SLATE[300] }}>&mdash;</span> : String(row[c])}
              </span>
            )}
          </td>
        )
      })}
      {editableFields && (
        <td style={{ padding: '7px 6px' }}>
          {!editingField && (
            <select onChange={e => { if (e.target.value) startEdit(e.target.value); e.target.value = '' }} defaultValue=""
              style={{ fontSize: 10.5, color: SLATE[400], border: `1px solid ${SLATE[200]}`, borderRadius: 6, padding: '2px 4px', cursor: 'pointer' }}>
              <option value="" disabled>Edit&hellip;</option>
              {Object.keys(editableFields).map(f => <option key={f} value={f}>{editableFields[f].label}</option>)}
            </select>
          )}
        </td>
      )}
    </tr>
  )
}
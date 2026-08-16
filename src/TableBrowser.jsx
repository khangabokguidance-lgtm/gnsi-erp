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

const NAVY = '#0B1E3D', GOLD = '#C9A24B', RED = '#dc2626', GREEN = '#16a34a'
const SLATE = { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155' }
const PAGE_SIZE = 100

function buildOrFilter(cols, term) {
  return cols.map(c => `${c}.ilike.%${term}%`).join(',')
}

export default function TableBrowser({ onOpenStudent, onOpenModule }) {
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
  const editableFields = getEditableFields(tableKey)

  const toggleCol = (c) => {
    setHiddenCols(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c); else next.add(c)
      return next
    })
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

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

      <div style={{ fontSize: 11.5, color: SLATE[500] }}>
        {totalCount.toLocaleString('en-IN')} total row(s) in {entry?.label} &middot; showing page {page + 1} of {totalPages}
        {search.trim().length >= 2 && ` \u00b7 filtered by "${search.trim()}" across the whole table`}
        {sortCol && ` \u00b7 sorted by ${sortCol.replace(/_/g, ' ')} (${sortDir})`}
      </div>

      {/* Table */}
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
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}`, overflow: 'auto', maxHeight: 560 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: SLATE[50], position: 'sticky', top: 0 }}>
                <th style={{ padding: '8px 10px', borderBottom: `1px solid ${SLATE[200]}`, width: 1 }} />
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

// One table row — a separate component so its own inline-edit state
// (which field is being edited) doesn't re-render the whole table.
function TableRow({ row, columns, tableKey, editableFields, student, onOpenStudent, onRowUpdated }) {
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
      {columns.map(c => {
        const fieldDef = editableFields?.[c]
        const isEditingThis = editingField === c
        return (
          <td key={c} style={{ padding: '7px 10px', color: SLATE[700], whiteSpace: 'nowrap', maxWidth: 240, overflow: isEditingThis ? 'visible' : 'hidden', textOverflow: 'ellipsis', position: 'relative' }}>
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
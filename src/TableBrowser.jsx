// TableBrowser.jsx — pick any table, see every row, across every student.
// ─────────────────────────────────────────────────────────────────────────────
// The other three tabs in Student360 are all scoped to "one student" or
// "one summary view." This is the raw-data-centre piece: choose any table
// from tableRegistry.js, page through every row it has, filter by a
// keyword, and export the result — without going into that table's owning
// module first.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from './supabase'
import { TABLE_REGISTRY } from './tableRegistry'
import { downloadCSV } from './exportUtils'

const NAVY = '#0B1E3D', GOLD = '#C9A24B'
const SLATE = { 50:'#f8fafc',100:'#f1f5f9',200:'#e2e8f0',300:'#cbd5e1',400:'#94a3b8',500:'#64748b',600:'#475569',700:'#334155' }
const PAGE_SIZE = 100

export default function TableBrowser({ onOpenStudent, onOpenModule }) {
  const [tableKey, setTableKey] = useState(TABLE_REGISTRY[0].key)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  const entry = TABLE_REGISTRY.find(t => t.key === tableKey)

  const load = useCallback(async () => {
    setLoading(true)
    setPage(0)
    // Pagination-safe by construction: PAGE_SIZE caps each request well
    // under PostgREST's 1000-row ceiling, and count:'exact' tells the UI
    // the real total so "showing 100 of 1400" is accurate instead of
    // silently truncating like the bugs this whole project started from.
    const orderCol = entry?.orderCol || 'id'
    const { data, count, error } = await supabase
      .from(tableKey)
      .select('*', { count: 'exact' })
      .order(orderCol, { ascending: false })
      .range(0, PAGE_SIZE - 1)
    if (error) { console.error(`TableBrowser: ${tableKey} load failed:`, error.message); setRows([]); setLoading(false); return }
    setRows(data || [])
    setTotalCount(count || 0)
    setLoading(false)
  }, [tableKey])

  useEffect(() => { load() }, [load])

  const loadPage = useCallback(async (p) => {
    setLoading(true)
    const orderCol = entry?.orderCol || 'id'
    const { data, error } = await supabase
      .from(tableKey)
      .select('*')
      .order(orderCol, { ascending: false })
      .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1)
    if (error) { console.error(`TableBrowser: ${tableKey} page load failed:`, error.message); setLoading(false); return }
    setRows(data || [])
    setPage(p)
    setLoading(false)
  }, [tableKey])

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(r => Object.values(r).some(v => v != null && String(v).toLowerCase().includes(term)))
  }, [rows, filter])

  const columns = useMemo(() => rows[0] ? Object.keys(rows[0]).filter(c => c !== 'id') : [], [rows])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Table picker */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={tableKey} onChange={e => setTableKey(e.target.value)}
          style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${SLATE[200]}`, fontSize: 13, fontWeight: 700, color: NAVY }}>
          {TABLE_REGISTRY.map(t => <option key={t.key} value={t.key}>{t.icon} {t.label}</option>)}
        </select>
        <input
          value={filter} onChange={e => setFilter(e.target.value)}
          placeholder="Filter this page…"
          style={{ padding: '9px 12px', borderRadius: 10, border: `1px solid ${SLATE[200]}`, fontSize: 12.5, flex: '1 1 200px', minWidth: 160 }}
        />
        <button onClick={() => downloadCSV(filtered, `${tableKey}_export`)}
          disabled={filtered.length === 0}
          style={{ padding: '9px 14px', borderRadius: 10, border: 'none', background: filtered.length ? NAVY : SLATE[300], color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: filtered.length ? 'pointer' : 'default' }}>
          ⬇ Export CSV
        </button>
        {entry && onOpenModule && (
          <button onClick={() => onOpenModule(entry.module)}
            style={{ padding: '9px 14px', borderRadius: 10, border: `1px solid ${SLATE[200]}`, background: '#fff', color: NAVY, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
            Open {entry.label} module →
          </button>
        )}
      </div>

      <div style={{ fontSize: 11.5, color: SLATE[500] }}>
        {totalCount.toLocaleString('en-IN')} total row(s) in {entry?.label} · showing page {page + 1} of {totalPages}
        {filter && ` · ${filtered.length} match filter on this page`}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: SLATE[400] }}>⏳ Loading {entry?.label}…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: SLATE[400], background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}` }}>
          No rows{filter ? ' match this filter' : ''}.
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${SLATE[200]}`, overflow: 'auto', maxHeight: 560 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: SLATE[50], position: 'sticky', top: 0 }}>
                {columns.map(c => (
                  <th key={c} style={{ padding: '8px 10px', textAlign: 'left', color: SLATE[500], fontWeight: 700, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.02em', borderBottom: `1px solid ${SLATE[200]}`, whiteSpace: 'nowrap' }}>{c.replace(/_/g, ' ')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.id ?? i} style={{ borderBottom: `1px solid ${SLATE[100]}` }}>
                  {columns.map(c => (
                    <td key={c} style={{ padding: '7px 10px', color: SLATE[700], whiteSpace: 'nowrap', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r[c] == null || r[c] === '' ? <span style={{ color: SLATE[300] }}>—</span> : String(r[c])}
                    </td>
                  ))}
                </tr>
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
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: SLATE[500] }}>Page {page + 1} / {totalPages}</span>
          <button onClick={() => loadPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${SLATE[200]}`, background: '#fff', fontSize: 12, fontWeight: 700, color: page >= totalPages - 1 ? SLATE[300] : NAVY, cursor: page >= totalPages - 1 ? 'default' : 'pointer' }}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
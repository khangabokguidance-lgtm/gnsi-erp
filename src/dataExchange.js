// dataExchange.js — pure helpers for exporting and importing table data.
// No browser or database calls here, so they can be tested.

// Rows → CSV text (RFC 4180 quoting; objects and arrays are written as JSON).
export function toCsv(rows) {
  if (!rows.length) return ''
  const cols = [...rows.reduce((set, r) => { Object.keys(r).forEach(k => set.add(k)); return set }, new Set())]
  const cell = v => {
    if (v === null || v === undefined) return ''
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\r\n')
}

// CSV text → array of objects keyed by the header row. Handles quoted fields,
// doubled quotes and line breaks inside quotes; skips blank lines.
export function parseCsv(text) {
  const rows = []
  let field = '', row = [], inQuote = false
  const src = String(text || '').replace(/^﻿/, '')
  const endField = () => { row.push(field); field = '' }
  const endRow = () => { endField(); if (row.some(v => v.trim() !== '')) rows.push(row); row = [] }
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuote) {
      if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++ } else inQuote = false } else field += ch
    } else if (ch === '"') inQuote = true
    else if (ch === ',') endField()
    else if (ch === '\n') endRow()
    else if (ch === '\r') { if (src[i + 1] === '\n') i++; endRow() }
    else field += ch
  }
  if (field !== '' || row.length) endRow()
  if (rows.length < 2) return []
  const header = rows[0].map(h => h.trim())
  return rows.slice(1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] === undefined ? '' : r[i]])))
}

// A value read from CSV or Excel → what the database should get: empty → null,
// JSON-looking text → the object or array, everything else unchanged.
export function cleanValue(v) {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return v
  const t = v.trim()
  if (t === '') return null
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try { return JSON.parse(t) } catch { return v }
  }
  return v
}

// Rows ready to upsert, keyed by `keyCol`: each value cleaned, rows with no key
// counted as skipped. Rows are de-duplicated by key (the last one wins).
export function rowsForUpsert(rows, keyCol) {
  const byKey = new Map()
  let skipped = 0
  for (const r of rows || []) {
    if (!r || typeof r !== 'object') { skipped++; continue }
    const clean = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, cleanValue(v)]))
    const key = clean[keyCol]
    if (key === null || key === undefined) { skipped++; continue }
    byKey.set(String(key), clean)
  }
  return { rows: [...byKey.values()], skipped }
}

export function chunk(list, size) {
  const out = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

// Whatever a backup / export file contains → { tableName: rows[] }.
// Accepts our bundle {tables:{…}}, a plain {table: rows[]} object, or a bare
// array (needs `fallbackTable`).
export function tablesFromJson(parsed, fallbackTable) {
  if (Array.isArray(parsed)) return fallbackTable ? { [fallbackTable]: parsed } : {}
  if (!parsed || typeof parsed !== 'object') return {}
  const source = parsed.tables && typeof parsed.tables === 'object' ? parsed.tables : parsed
  return Object.fromEntries(Object.entries(source).filter(([, v]) => Array.isArray(v)))
}

// Spreadsheet cells cannot hold more than 32,767 characters.
export const forSheet = v => {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'object' ? JSON.stringify(v) : v
  return typeof s === 'string' && s.length > 32000 ? s.slice(0, 32000) : s
}

// DataExchangeCards.jsx — System Settings → Data Mgmt: backup status, export
// to Excel / CSV / JSON, and import (restore) from those files.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { BACKUP_TABLES, exportableTables, importableNames, pkOf } from './backupTables'
import { toCsv, parseCsv, rowsForUpsert, chunk, tablesFromJson, forSheet } from './dataExchange'

const PAGE = 1000
const btn = (primary, disabled) => ({
  padding: '10px 18px', borderRadius: 9, fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  border: primary ? 'none' : '1px solid #D1D5DB', background: primary ? '#1D4ED8' : 'white', color: primary ? 'white' : '#374151',
})
const note = { fontSize: 12.5, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.5 }
const today = () => new Date().toLocaleDateString('en-CA')

function download(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

async function fetchAll(name, onPage) {
  const pk = pkOf(name)
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(name).select('*').order(pk, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(`${name}: ${error.message}`)
    rows.push(...(data || []))
    onPage?.(rows.length)
    if (!data || data.length < PAGE) break
  }
  return rows
}

// ── Last automatic backup ────────────────────────────────────────────────
export function BackupStatusCard({ Card, SectionTitle }) {
  const [info, setInfo] = useState(undefined) // undefined = loading, null = none yet
  useEffect(() => {
    let alive = true
    supabase.from('system_settings').select('value').eq('key', 'last_backup').maybeSingle().then(({ data }) => {
      if (!alive) return
      try { setInfo(data?.value ? (typeof data.value === 'string' ? JSON.parse(data.value) : data.value) : null) } catch { setInfo(null) }
    })
    return () => { alive = false }
  }, [])
  const mb = b => (b / 1048576).toFixed(2) + ' MB'
  const problems = info ? [...Object.entries(info.errors || {}).map(([t, m]) => `${t}: ${m}`), ...(info.skipped || []).map(t => `${t}: skipped (time ran out)`), ...(info.fatal ? [info.fatal] : [])] : []
  return (
    <Card>
      <SectionTitle>🛟 Automatic daily backup</SectionTitle>
      <p style={note}>Every night at about 5:30 AM the core tables are saved to a private file; on Sundays the large tables (attendance, exam marks, question bank, audit log) are included too. The last 14 daily and 8 weekly files are kept.</p>
      {info === undefined && <div style={{ fontSize: 13, color: '#9CA3AF' }}>Checking…</div>}
      {info === null && <div style={{ fontSize: 13, color: '#B45309', fontWeight: 600 }}>No backup has run yet. The first one runs after the next deployment, at the next 5:30 AM.</div>}
      {info && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
          <div style={{ padding: '9px 12px', borderRadius: 9, background: info.ok ? '#F0FDF4' : '#FEF2F2', color: info.ok ? '#15803D' : '#B91C1C', fontWeight: 700 }}>
            {info.ok ? '✅ Last backup succeeded' : '⚠️ Last backup had problems'} · {new Date(info.at).toLocaleString('en-IN')}
          </div>
          <div style={{ color: '#374151' }}>File: <b>{info.path}</b> · {mb(info.bytes || 0)} · {Object.values(info.rows || {}).reduce((s, n) => s + n, 0).toLocaleString('en-IN')} rows in {Object.keys(info.rows || {}).length} tables</div>
          {problems.map(p => <div key={p} style={{ color: '#B91C1C', fontSize: 12 }}>• {p}</div>)}
        </div>
      )}
      <p style={{ ...note, marginTop: 10 }}>To download a backup: Supabase → <b>Storage → backups</b> → open the file. To restore from one, use <b>Import</b> below (it reads the .json.gz file directly).</p>
    </Card>
  )
}

// ── Export ────────────────────────────────────────────────────────────────
export function ExportCard({ Card, SectionTitle }) {
  const tables = exportableTables()
  const [picked, setPicked] = useState(() => new Set(tables.filter(t => t.tier === 'daily').map(t => t.name)))
  const [format, setFormat] = useState('xlsx')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const groups = [...new Set(tables.map(t => t.group))]
  const toggle = name => setPicked(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })

  const run = async () => {
    const names = tables.filter(t => picked.has(t.name)).map(t => t.name)
    if (!names.length) return
    setBusy(true); setError(''); setStatus('')
    try {
      const data = {}
      for (const name of names) {
        setStatus(`Reading ${name}…`)
        data[name] = await fetchAll(name, n => setStatus(`Reading ${name}… ${n} rows`))
      }
      setStatus('Building the file…')
      const stamp = today()
      if (format === 'json') {
        download(new Blob([JSON.stringify({ app: 'gnsi-erp', kind: 'export', taken_at: new Date().toISOString(), tables: data })], { type: 'application/json' }), `gnsi-export-${stamp}.json`)
      } else if (format === 'xlsx') {
        const XLSX = await import('xlsx')
        const wb = XLSX.utils.book_new()
        for (const name of names) {
          const rows = data[name].map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, forSheet(v)])))
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name.slice(0, 31))
        }
        const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
        download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `gnsi-export-${stamp}.xlsx`)
      } else if (names.length === 1) {
        download(new Blob(['﻿' + toCsv(data[names[0]])], { type: 'text/csv;charset=utf-8' }), `${names[0]}-${stamp}.csv`)
      } else {
        const { default: JSZip } = await import('jszip')
        const zip = new JSZip()
        names.forEach(name => zip.file(`${name}.csv`, '﻿' + toCsv(data[name])))
        download(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), `gnsi-export-${stamp}.zip`)
      }
      const total = Object.values(data).reduce((s, r) => s + r.length, 0)
      setStatus(`✅ Downloaded ${names.length} table${names.length > 1 ? 's' : ''}, ${total.toLocaleString('en-IN')} rows.`)
    } catch (e) {
      setError(e.message || 'Export failed.')
      setStatus('')
    }
    setBusy(false)
  }

  return (
    <Card>
      <SectionTitle>📤 Export data</SectionTitle>
      <p style={note}>Choose the tables, then the file type. Reading the tables uses some of your data allowance, so export only what you need.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {[['xlsx', 'Excel (.xlsx, one sheet per table)'], ['csv', 'CSV (.csv, zipped if several)'], ['json', 'JSON (.json, full backup)']].map(([k, label]) => (
          <button key={k} onClick={() => setFormat(k)} style={{ ...btn(format === k, false), padding: '7px 12px', fontSize: 12.5 }}>{label}</button>
        ))}
      </div>
      {groups.map(g => (
        <div key={g} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9CA3AF', margin: '6px 0 4px' }}>{g}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
            {tables.filter(t => t.group === g).map(t => (
              <label key={t.name} style={{ fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={picked.has(t.name)} onChange={() => toggle(t.name)} />{t.label}
              </label>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
        <button onClick={run} disabled={busy || !picked.size} style={btn(true, busy || !picked.size)}>{busy ? '⏳ Exporting…' : `Export ${picked.size} table${picked.size === 1 ? '' : 's'}`}</button>
        <button onClick={() => setPicked(new Set())} disabled={busy} style={btn(false, busy)}>Clear</button>
      </div>
      {status && <div style={{ marginTop: 10, fontSize: 13, color: '#374151' }}>{status}</div>}
      {error && <div style={{ marginTop: 10, fontSize: 13, color: '#B91C1C', fontWeight: 600 }}>❌ {error}</div>}
    </Card>
  )
}

// ── Import / restore ─────────────────────────────────────────────────────
async function readFileAsTables(file, csvTable) {
  const lower = file.name.toLowerCase()
  if (lower.endsWith('.gz')) {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot open .gz files. Use a newer browser, or unzip the file first.')
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
    return tablesFromJson(JSON.parse(await new Response(stream).text()))
  }
  if (lower.endsWith('.json')) return tablesFromJson(JSON.parse(await file.text()), csvTable)
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })
    return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { defval: null })]))
  }
  if (lower.endsWith('.csv')) {
    if (!csvTable) throw new Error('Choose which table this CSV belongs to first.')
    return { [csvTable]: parseCsv(await file.text()) }
  }
  throw new Error('Use a .json, .json.gz, .xlsx or .csv file.')
}

export function ImportCard({ Card, SectionTitle }) {
  const allowed = importableNames()
  const choices = BACKUP_TABLES.filter(t => allowed.has(t.name))
  const [csvTable, setCsvTable] = useState('students')
  const [file, setFile] = useState(null)
  const [found, setFound] = useState(null) // { table: rows[] }
  const [use, setUse] = useState(new Set())
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [log, setLog] = useState([])
  const [error, setError] = useState('')

  const load = async (f, table = csvTable) => {
    setError(''); setLog([]); setFound(null); setUse(new Set()); setConfirmText('')
    if (!f) return
    try {
      const tables = await readFileAsTables(f, table)
      const keep = Object.fromEntries(Object.entries(tables).filter(([name]) => allowed.has(name)))
      const ignored = Object.keys(tables).filter(n => !allowed.has(n))
      if (!Object.keys(keep).length) throw new Error(ignored.length ? `Nothing to import: these tables can't be imported here — ${ignored.join(', ')}.` : 'No tables with rows were found in that file.')
      setFound(keep); setUse(new Set(Object.keys(keep)))
      if (ignored.length) setLog([`Ignored (not importable here): ${ignored.join(', ')}`])
    } catch (e) { setError(e.message || 'Could not read that file.') }
  }

  const run = async () => {
    setBusy(true); setError(''); setLog([])
    const lines = []
    try {
      for (const name of Object.keys(found).filter(n => use.has(n))) {
        const { rows, skipped } = rowsForUpsert(found[name], pkOf(name))
        let saved = 0
        for (const part of chunk(rows, 200)) {
          const { error: err } = await supabase.from(name).upsert(part, { onConflict: pkOf(name) })
          if (err) { lines.push(`❌ ${name}: stopped after ${saved} rows — ${err.message}`); saved = -1; break }
          saved += part.length
          setLog([...lines, `⏳ ${name}: ${saved} of ${rows.length}`])
        }
        if (saved >= 0) lines.push(`✅ ${name}: ${saved} row${saved === 1 ? '' : 's'} saved${skipped ? `, ${skipped} skipped (no ${pkOf(name)})` : ''}`)
        setLog([...lines])
      }
    } catch (e) { setError(e.message || 'Import failed.') }
    setBusy(false); setConfirmText('')
  }

  const canRun = found && use.size > 0 && confirmText.trim().toUpperCase() === 'RESTORE' && !busy
  return (
    <Card>
      <SectionTitle>📥 Import / restore data</SectionTitle>
      <p style={note}>Reads a backup or export file (.json, .json.gz, .xlsx or .csv). Rows are matched by their <b>id</b> (system settings by <b>key</b>): existing rows are <b>overwritten</b> with the file's values, new rows are added, and nothing is deleted. JSON files keep every value exactly; Excel and CSV are best for simple tables.</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
        <input type="file" accept=".json,.gz,.xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0] || null; setFile(f); load(f) }} />
        <label style={{ fontSize: 12.5, color: '#6B7280' }}>For a CSV, table:{' '}
          <select value={csvTable} onChange={e => { setCsvTable(e.target.value); if (file) load(file, e.target.value) }} style={{ padding: 6, borderRadius: 8, border: '1px solid #D1D5DB' }}>
            {choices.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
          </select>
        </label>
      </div>
      {error && <div style={{ fontSize: 13, color: '#B91C1C', fontWeight: 600, marginBottom: 8 }}>❌ {error}</div>}
      {found && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {Object.entries(found).map(([name, rows]) => (
              <label key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 12px', background: '#F9FAFB', borderRadius: 9, fontSize: 13 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, color: '#374151' }}>
                  <input type="checkbox" checked={use.has(name)} onChange={() => setUse(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })} />{name}
                </span>
                <span style={{ color: '#6B7280' }}>{rows.length.toLocaleString('en-IN')} rows</span>
              </label>
            ))}
          </div>
          <div style={{ padding: 12, borderRadius: 10, background: '#FEF2F2', color: '#991B1B', fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
            ⚠️ This overwrites matching rows. Export the current data first if you may need it. Type <b>RESTORE</b> to confirm.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="RESTORE" style={{ padding: '9px 12px', borderRadius: 9, border: '1px solid #D1D5DB', width: 130 }} />
            <button onClick={run} disabled={!canRun} style={{ ...btn(true, !canRun), background: canRun ? '#B91C1C' : '#1D4ED8' }}>{busy ? '⏳ Importing…' : 'Import now'}</button>
          </div>
        </>
      )}
      {log.map((l, i) => <div key={i} style={{ marginTop: 6, fontSize: 13, color: l.startsWith('❌') ? '#B91C1C' : '#374151' }}>{l}</div>)}
    </Card>
  )
}

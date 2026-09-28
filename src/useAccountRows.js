// useAccountRows — loads (or reuses) the Accounts ledger for the account books.
import { useEffect, useMemo, useState } from 'react'
import { loadAccountRows, normalise } from './accountBooks'

// source: optional { rows, vendors, payers } already loaded by the caller
// (the Accounts module passes its own entries so both views agree).
export function useAccountRows(source) {
  const [loaded, setLoaded] = useState(null)
  const [error, setError] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    if (source) return
    let live = true
    loadAccountRows().then(r => { if (live) { setLoaded(r); setError('') } }).catch(e => { if (live) setError(e.message) })
    return () => { live = false }
  }, [source, reload])
  const entries = useMemo(() => {
    const s = source ? (source.rows && { rows: source.rows, vendors: new Map((source.vendors || []).map(v => [v.id, v.name])), payers: new Map((source.payers || []).map(v => [v.id, v.name])) }) : loaded
    return s ? normalise(s.rows, s) : null
  }, [source, loaded])
  return { entries, error, refresh: source ? null : () => { setLoaded(null); setReload(n => n + 1) } }
}

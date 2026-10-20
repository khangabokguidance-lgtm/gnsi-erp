// useLiveCourseBatches.js — a batch created in Courses shows up in the other screens' course
// and batch lists (Admissions, Students, Fees, Fee Setup) without editing code.
// Loads the Active course_batches once per page load and merges them into the screens' lists in
// place; the calling screen re-renders once if anything was added. Never removes anything, and
// a failed load just leaves the standard lists.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { canonicalBatch } from './courseMap'
import { mergeLiveBatches } from './lib/courseCatalog'

let loading = null
const loadRows = () => (loading ||= Promise.resolve(supabase.from('course_batches').select('course, subtype, status').eq('status', 'Active'))
  .then(r => r?.data || []).catch(() => { loading = null; return [] }))

export function useLiveCourseBatches(...structures) {
  const [, bump] = useState(0)
  useEffect(() => {
    let live = true
    loadRows().then(rows => {
      const changed = structures.map(s => mergeLiveBatches(s, rows, canonicalBatch)).some(Boolean)
      if (live && changed) bump(n => n + 1)
    })
    return () => { live = false }
  // the structures are module-level constants
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

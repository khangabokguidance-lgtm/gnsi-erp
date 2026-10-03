// feeStanding.js — loads standing concessions and instalment plans once (cached
// for a minute) so the dues engine, ledgers and defaulter lists can honour them.
// Either table being missing just means "none".
import { supabase } from './supabase'
import { gccStr } from './feeEngine'
import { planState } from './lib/standingMath'

let cache = null, cacheAt = 0, inflight = null
const TTL = 60000
const EMPTY = { conc: new Map(), plans: new Map() }

export function getCachedStanding() { return cache || EMPTY }

export function loadStanding({ force = false } = {}) {
  if (!force && cache && Date.now() - cacheAt < TTL) return Promise.resolve(cache)
  if (inflight) return inflight
  inflight = (async () => {
    const out = { conc: new Map(), plans: new Map() }
    try {
      const { data, error } = await supabase.from('fee_concession_register').select('*').eq('status', 'active')
      if (!error) for (const r of data || []) { const g = gccStr(r.gcc); if (!out.conc.has(g)) out.conc.set(g, []); out.conc.get(g).push(r) }
    } catch { /* table not there yet */ }
    try {
      const { data, error } = await supabase.from('fee_installment_plans').select('id, gcc, status, installments').eq('status', 'active')
      const today = new Date().toLocaleDateString('en-CA')
      if (!error) for (const p of data || []) { const st = planState(p, today); if (st) out.plans.set(gccStr(p.gcc), st) }
    } catch { /* table not there yet */ }
    cache = out; cacheAt = Date.now(); inflight = null
    return out
  })()
  return inflight
}

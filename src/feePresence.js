// feePresence.js — multi-user detection for fee collection.
//  • useFeeCollectionPresence(gcc, user): who else has this student's fee form
//    open right now (Supabase Realtime presence; nothing is stored).
//  • findRecentOtherCollection(gcc, staffId): rows for this student saved in the
//    last few minutes by a different staff member (used by collectFee()).
//  • deviceId(): stable id for this browser tab-session.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export const RECENT_CLASH_MINUTES = 10

export function deviceId() {
  try {
    let id = sessionStorage.getItem('gnsi_device_id')
    if (!id) { id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); sessionStorage.setItem('gnsi_device_id', id) }
    return id
  } catch { return 'dev-' + Math.random().toString(36).slice(2, 10) }
}

const whoOf = u => u?.userName || u?.username || u?.name || ''

export function useFeeCollectionPresence(gcc, user) {
  const [others, setOthers] = useState([])
  useEffect(() => {
    const g = String(gcc || '').trim()
    if (!g || !supabase?.channel) { setOthers([]); return undefined }
    const me = deviceId()
    let ch
    try {
      ch = supabase.channel(`fee-collect-${g}`, { config: { presence: { key: me } } })
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState() || {}
        const list = []
        for (const [key, metas] of Object.entries(st)) {
          if (key === me) continue
          const m = (metas || [])[metas.length - 1] || {}
          list.push({ key, who: m.who || 'Another user', role: m.role || '', at: m.at })
        }
        setOthers(list)
      }).subscribe(status => {
        if (status === 'SUBSCRIBED') ch.track({ who: whoOf(user) || 'Unknown', role: user?.role || '', at: Date.now() })
      })
    } catch { setOthers([]) }
    return () => { try { if (ch) supabase.removeChannel(ch) } catch { /* ignore */ } }
  }, [gcc, user?.userName, user?.username, user?.name, user?.role]) // eslint-disable-line react-hooks/exhaustive-deps
  return others
}

// Fee rows for this student written in the last few minutes by someone else.
export async function findRecentOtherCollection(gcc, staffId, minutes = RECENT_CLASH_MINUTES) {
  const since = new Date(Date.now() - minutes * 60000).toISOString()
  const out = []
  for (const table of ['adm_flat_fees', 'adm_course_fees', 'adm_fee_collections']) {
    try {
      const { data, error } = await supabase.from(table).select('*').eq('adm_app_id', gcc).gte('collected_at', since).limit(20)
      if (error) continue
      for (const r of data || []) {
        if (r.reverted) continue
        if (String(r.staff_id || '').trim().toLowerCase() === String(staffId || '').trim().toLowerCase()) continue
        out.push({ table, by: r.collected_by || r.staff_id || 'another user', at: r.collected_at, label: r.month || r.for_month || r.fee_type || '' })
      }
    } catch { /* best effort */ }
  }
  return out
}

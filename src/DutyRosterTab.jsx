import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from './supabase'
import { DUTY_SLOTS, ALL_STAFF_NOTE, currentSlotKey, slotItems, dutyProgress } from './dutyRoster'

// Study Duty Roster: the fixed daily timetable for House Masters & Mistresses,
// with a per-house daily checklist saved to hm_duty_log (one row per house+date).
// Housemasters see/edit their own house; office staff pick a house and see all
// houses' progress for the chosen date.

const todayStr = () => new Date().toLocaleDateString('en-CA')
const nowHHMM = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 14, marginBottom: 12 }

export default function DutyRosterTab({ lockHouse, houses = [], currentHousemaster, currentUser }) {
  const [date, setDate] = useState(todayStr())
  const [pickedHouse, setHouse] = useState('')
  const house = lockHouse || pickedHouse || houses[0] || ''
  const [rows, setRows] = useState([])           // all houses, for the date
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const live = currentSlotKey(nowHHMM())

  const [tick, setTick] = useState(0)
  const load = useCallback(() => setTick(t => t + 1), [])
  useEffect(() => {
    let cancelled = false
    supabase.from('hm_duty_log').select('*').eq('duty_date', date).then(({ data, error }) => {
      if (cancelled) return
      if (error) { setErr(error.message); setRows([]) } else { setErr(''); setRows(data || []) }
    })
    return () => { cancelled = true }
  }, [date, tick])

  const mine = useMemo(() => rows.find(r => (r.house || '').toLowerCase() === (house || '').toLowerCase()) || null, [rows, house])
  const done = mine?.done || {}

  const save = async (patch) => {
    if (!house) return
    setSaving(true)
    const next = {
      house, duty_date: date,
      housemaster_name: currentHousemaster?.name || currentUser?.name || null,
      done: mine?.done || {}, photo_sent: !!mine?.photo_sent, erp_checked: !!mine?.erp_checked, notes: mine?.notes || null,
      ...patch, updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('hm_duty_log').upsert(next, { onConflict: 'house,duty_date' })
    setSaving(false)
    if (error) setErr(error.message); else { setErr(''); load() }
  }
  const toggle = (key) => save({ done: { ...done, [key]: !done[key] } })
  const prog = dutyProgress(done)

  return (
    <div>
      <div style={{ ...card, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <strong style={{ flex: '1 1 160px' }}>🕰️ Study Duty Roster</strong>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }} />
        {!lockHouse && (
          <select value={house} onChange={e => setHouse(e.target.value)} style={{ padding: 8, borderRadius: 8, border: '1px solid #d1d5db' }}>
            {houses.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', margin: '0 2px 10px' }}>{ALL_STAFF_NOTE} {house && <>House: <b>{house}</b> · {prog.done}/{prog.total} done ({prog.pct}%)</>}</div>
      {err && <div style={{ ...card, borderColor: '#fecaca', color: '#b91c1c' }}>Could not sync duty log: {err}</div>}

      {DUTY_SLOTS.map(slot => (
        <div key={slot.key} style={{ ...card, borderLeft: `4px solid ${live === slot.key && date === todayStr() ? '#16a34a' : '#cbd5e1'}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <b>{slot.time}</b>
            {live === slot.key && date === todayStr() && <span style={{ color: '#16a34a', fontSize: 12, fontWeight: 700 }}>● NOW</span>}
          </div>
          <div style={{ fontWeight: 600, marginTop: 4 }}>{slot.task}</div>
          <div style={{ fontSize: 13, color: '#475569', margin: '2px 0 8px' }}>{slot.responsibility}</div>
          {slotItems(slot).map(it => (
            <label key={it.key} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', minHeight: 44, borderTop: '1px solid #f1f5f9' }}>
              <input type="checkbox" checked={!!done[it.key]} disabled={saving || !house} onChange={() => toggle(it.key)} style={{ width: 20, height: 20 }} />
              <span>{it.label}</span>
            </label>
          ))}
          {slot.photo && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
              <input type="checkbox" checked={!!mine?.photo_sent} disabled={saving || !house} onChange={() => save({ photo_sent: !mine?.photo_sent })} style={{ width: 20, height: 20 }} />
              <span>📷 Photo uploaded in WhatsApp group</span>
            </label>
          )}
          {slot.checkErp && (
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', minHeight: 44 }}>
              <input type="checkbox" checked={!!mine?.erp_checked} disabled={saving || !house} onChange={() => save({ erp_checked: !mine?.erp_checked })} style={{ width: 20, height: 20 }} />
              <span>✅ Checked all classes in the ERP</span>
            </label>
          )}
        </div>
      ))}

      {!lockHouse && (
        <div style={card}>
          <b>All houses — {date}</b>
          {houses.map(h => {
            const r = rows.find(x => (x.house || '').toLowerCase() === h.toLowerCase())
            const p = dutyProgress(r?.done)
            return <div key={h} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
              <span>{h}</span><span>{r ? `${p.pct}%${r.photo_sent ? ' · 📷' : ''}${r.erp_checked ? ' · ✅ ERP' : ''}` : '— not started'}</span>
            </div>
          })}
        </div>
      )}
    </div>
  )
}

// MultiLoginWatch.jsx — notices when the same login is open on more than one
// browser/device at once, shows a dismissible banner, and logs it for admins
// (audit_log, action 'multi_login_detected'). Presence only; nothing else is stored.
import { useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import { deviceId } from './feePresence'

export default function MultiLoginWatch({ currentUser }) {
  const [others, setOthers] = useState([])
  const [hidden, setHidden] = useState(false)
  const logged = useRef(false)
  const uname = String(currentUser?.username || currentUser?.userName || currentUser?.name || '').trim().toLowerCase()

  useEffect(() => {
    if (!uname || !supabase?.channel) return undefined
    const me = deviceId()
    let ch
    try {
      ch = supabase.channel('gnsi-logins', { config: { presence: { key: me } } })
      ch.on('presence', { event: 'sync' }, () => {
        const st = ch.presenceState() || {}
        const list = []
        for (const [key, metas] of Object.entries(st)) {
          if (key === me) continue
          const m = (metas || [])[metas.length - 1] || {}
          if (String(m.uname || '') === uname) list.push({ key, ua: m.ua || '', since: m.since })
        }
        setOthers(list)
      }).subscribe(status => {
        if (status === 'SUBSCRIBED') ch.track({ uname, name: currentUser?.name || '', role: currentUser?.role || '', ua: (navigator.userAgent || '').slice(0, 80), since: Date.now() })
      })
    } catch { /* realtime unavailable — silently skip */ }
    return () => { try { if (ch) supabase.removeChannel(ch) } catch { /* ignore */ } }
  }, [uname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (others.length > 0 && !logged.current) {
      logged.current = true
      Promise.resolve(supabase.from('audit_log').insert({
        action: 'multi_login_detected', changed_by: currentUser?.name || uname, target_id: uname,
        new_values: JSON.stringify({ username: uname, role: currentUser?.role || null, devices: others.length + 1, agents: others.map(o => o.ua) }),
        created_at: new Date().toISOString(),
      })).catch(() => {})
    }
    if (others.length === 0) setHidden(false)
  }, [others]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!others.length || hidden) return null
  return (
    <div role="alert" style={{ position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 100000, maxWidth: 'min(640px, 94vw)', display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 14, color: '#fff', fontSize: 13, fontWeight: 600, background: 'linear-gradient(135deg,#7f1d1d,#b42318)', boxShadow: '0 18px 34px -16px rgba(127,29,29,.7), 0 0 0 1.5px #fff, 0 0 0 3px #c9a24b' }}>
      <span style={{ fontSize: 18 }}>⚠️</span>
      <span style={{ flex: 1 }}>This login ({currentUser?.name || uname}) is open on {others.length + 1} devices right now. If that isn't you, sign out and change the password.</span>
      <button onClick={() => setHidden(true)} style={{ border: 0, borderRadius: 8, padding: '5px 10px', fontWeight: 800, cursor: 'pointer', background: 'rgba(255,255,255,.18)', color: '#fff' }}>Dismiss</button>
    </div>
  )
}

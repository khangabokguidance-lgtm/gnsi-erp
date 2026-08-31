// PremiumToggleCard.jsx — admin-only self-serve activate/deactivate control
// for org-wide premium, rendered in FaceAttendance.jsx's Settings tab.
//
// Only admin can flip this switch (enforced by the caller not rendering it
// for non-admins, and again here defensively). Premium *setting values*
// remain admin-only to edit too — this card only controls whether the
// premium tier is active at all, not the individual settings under it.

import React, { useState } from 'react'
import { supabase } from './supabase'
import { usePremiumStatus, setPremiumPlan } from './premiumSettings'

const S = {
  card: { background: 'white', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,.07)', padding: 18, marginBottom: 16 },
  toggle: (on, disabled) => ({
    width: 46, height: 26, borderRadius: 999, background: disabled ? '#e2e8f0' : on ? '#16a34a' : '#cbd5e1',
    position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background .15s',
  }),
  knob: (on) => ({
    width: 20, height: 20, borderRadius: '50%', background: 'white', position: 'absolute', top: 3,
    left: on ? 23 : 3, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
  }),
}

export default function PremiumToggleCard({ isAdmin, adminId, showToast }) {
  const { isPremium, loading, refresh } = usePremiumStatus()
  const [busy, setBusy] = useState(false)

  if (!isAdmin) return null // defensive — this card is only ever rendered for admins

  const handleToggle = async () => {
    if (busy || loading) return
    const nextPlan = isPremium ? 'free' : 'premium'
    setBusy(true)
    try {
      await setPremiumPlan(supabase, nextPlan, adminId)
      await refresh()
      showToast?.(
        nextPlan === 'premium' ? '✅ Premium activated for this organization' : 'Premium deactivated — locked settings return to their defaults',
        'ok'
      )
    } catch (e) {
      showToast?.('Could not update plan: ' + e.message, 'err')
    }
    setBusy(false)
  }

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#0B1E3D' }}>
            {isPremium ? '✨ Premium — active' : 'Premium — inactive'}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            {isPremium
              ? 'Advanced settings (stricter face-match, drift watch, scheduled reports, and more) are unlocked across all tabs.'
              : 'Unlock advanced settings across all Face Attendance tabs — stricter face-match thresholds, drift watch, scheduled reports, and more.'}
          </div>
        </div>
        <div style={S.toggle(isPremium, busy || loading)} onClick={handleToggle}>
          <div style={S.knob(isPremium)} />
        </div>
      </div>
    </div>
  )
}

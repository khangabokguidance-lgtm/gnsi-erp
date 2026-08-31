// AdvancedSettingsPanel.jsx — the sheet opened by the ⚙️ gear icon on every
// FaceAttendance tab. Renders that tab's settings from premiumSettings.js:
// free settings are toggleable immediately by the viewing staff member;
// premium settings show locked with an upgrade prompt until org_subscription
// is active, and even once unlocked are only editable by admins (they're
// org-wide security/behavior settings, not personal preferences).

import React, { useState } from 'react'
import { TAB_SETTINGS, usePremiumStatus, useTabSettings } from './premiumSettings'

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', zIndex: 9996, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  sheet: { background: 'white', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 480, maxHeight: '82vh', overflowY: 'auto', padding: '18px 18px 28px', boxShadow: '0 -8px 30px rgba(0,0,0,.2)' },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px 2px', borderBottom: '1px solid #f1f5f9' },
  label: { fontSize: 13.5, color: '#1e293b', fontWeight: 600, flex: 1 },
  sub: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: 400 },
  toggle: (on, disabled) => ({
    width: 42, height: 24, borderRadius: 999, background: disabled ? '#e2e8f0' : on ? '#16a34a' : '#cbd5e1',
    position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background .15s',
  }),
  knob: (on) => ({
    width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3,
    left: on ? 21 : 3, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
  }),
  select: { padding: '6px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 12.5, fontFamily: 'inherit', background: 'white' },
  numInput: { width: 64, padding: '6px 8px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, textAlign: 'center', fontFamily: 'inherit' },
  lockBadge: { fontSize: 10, fontWeight: 800, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '2px 7px', flexShrink: 0 },
  upsell: { marginTop: 16, padding: 16, borderRadius: 12, background: 'linear-gradient(135deg, #0B1E3D, #16305C)', color: 'white' },
}

function Toggle({ on, onChange, disabled }) {
  return (
    <div style={S.toggle(on, disabled)} onClick={() => !disabled && onChange(!on)}>
      <div style={S.knob(on)} />
    </div>
  )
}

function SettingRow({ def, value, onChange, locked, canEditPremium }) {
  const disabled = locked || (def.premium && !canEditPremium)
  return (
    <div style={S.row}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={S.label}>{def.label}</span>
          {def.premium && <span style={S.lockBadge}>{locked ? '🔒 PREMIUM' : '✨ PREMIUM'}</span>}
        </div>
        {def.premium && !locked && !canEditPremium && (
          <div style={S.sub}>Org-wide setting — only admins can change this</div>
        )}
      </div>

      {def.type === 'toggle' && (
        <Toggle on={!!value} onChange={(v) => onChange(v)} disabled={disabled} />
      )}
      {def.type === 'select' && (
        <select style={S.select} value={value ?? def.default} disabled={disabled} onChange={e => onChange(e.target.value)}>
          {def.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
      {def.type === 'number' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="number" style={S.numInput} disabled={disabled}
            value={value ?? def.default} min={def.min} max={def.max}
            onChange={e => onChange(Math.min(def.max, Math.max(def.min, Number(e.target.value) || 0)))}
          />
          {def.suffix && <span style={{ fontSize: 11, color: '#94a3b8' }}>{def.suffix}</span>}
        </div>
      )}
    </div>
  )
}

export default function AdvancedSettingsPanel({ tabKey, tabLabel, staffId, isAdmin, adminId, showToast, onClose, onUpgradeClick }) {
  const defs = TAB_SETTINGS[tabKey] || []
  const { isPremium, loading: premiumLoading } = usePremiumStatus()
  const { values, loading, saveFree, savePremium } = useTabSettings(tabKey, staffId)
  const [busyKey, setBusyKey] = useState(null)

  const handleChange = async (def, newValue) => {
    setBusyKey(def.key)
    try {
      if (def.premium) await savePremium(def.key, newValue, adminId)
      else await saveFree(def.key, newValue)
      showToast?.('Setting saved', 'ok')
    } catch (e) {
      showToast?.('Could not save: ' + e.message, 'err')
    }
    setBusyKey(null)
  }

  const hasLockedSettings = defs.some(d => d.premium) && !isPremium

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.sheet} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#0B1E3D' }}>⚙️ {tabLabel} — advanced settings</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 16, color: '#64748b', cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {!defs.length ? (
          <p style={{ color: '#94a3b8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>No advanced settings for this section yet.</p>
        ) : loading || premiumLoading ? (
          <p style={{ color: '#94a3b8', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>Loading…</p>
        ) : (
          <div style={{ marginTop: 8 }}>
            {defs.map(def => (
              <SettingRow
                key={def.key}
                def={def}
                value={values[def.key]}
                locked={def.premium && !isPremium}
                canEditPremium={isAdmin}
                onChange={(v) => handleChange(def, v)}
              />
            ))}
          </div>
        )}

        {hasLockedSettings && (
          <div style={S.upsell}>
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4 }}>Unlock premium settings</div>
            <p style={{ fontSize: 12, opacity: 0.85, margin: '0 0 12px' }}>
              Stricter face-match thresholds, mandatory head-turn liveness, drift watch, scheduled reports, and more — across every tab in Face Attendance.
            </p>
            <button
              onClick={() => onUpgradeClick ? onUpgradeClick() : showToast?.('Contact your Anthropic/portal admin to activate premium.', 'warn')}
              style={{ width: '100%', padding: 11, borderRadius: 10, border: 'none', background: '#C9A24B', color: '#0B1E3D', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
            >
              Upgrade to Premium
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

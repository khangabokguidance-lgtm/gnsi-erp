// AdminControlCenter.jsx — the unified admin tab for controlling every
// tunable and emergency lever in Face Attendance from one screen, instead
// of hunting through each tab's own gear icon.
//
// Three sections:
//   1. Settings overview  — every tab's advanced settings (from
//      premiumSettings.js) in one scrollable list, plus the premium
//      activation toggle.
//   2. Emergency controls — pause check-ins system-wide, lock new
//      enrollment, force-checkout everyone currently tracked. Each is a
//      real production lever, so each requires a typed confirmation.
//   3. Automation rules   — admin-defined rules that run server-side
//      (auto-approve low-risk enrollments, auto-flag repeat lateness).
//
// Admin-only by construction (the caller in FaceAttendance.jsx only
// renders this tab for isAdmin), and every write additionally re-checks
// admin status server-side via the RPCs in systemControl.js /
// premiumSettings.js — the isAdmin prop here is a display convenience,
// never the actual security boundary.

import React, { useState } from 'react'
import { supabase } from './supabase'
import { COLOR, FONT, RADIUS, SHADOW, ledger } from './ledgerTheme.jsx'
import { TAB_SETTINGS, usePremiumStatus, useTabSettings, setPremiumPlan } from './premiumSettings'
import { useSystemControl, forceCheckoutAll, useAutomationRules, RULE_DEFS } from './systemControl'

const S = {
  section: { ...ledger.card, marginBottom: 20 },
  sectionTitle: { fontFamily: FONT.display, fontSize: 15, fontWeight: 600, color: COLOR.ink, marginBottom: 4 },
  sectionSub: { fontSize: 12, color: COLOR.slate, marginBottom: 14 },
  toggle: (on, disabled, tone = COLOR.sageDeep) => ({
    width: 44, height: 25, borderRadius: 999,
    background: disabled ? '#e2e8f0' : on ? tone : '#cbd5e1',
    position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0, transition: 'background .15s',
  }),
  knob: (on) => ({
    width: 19, height: 19, borderRadius: '50%', background: 'white', position: 'absolute', top: 3,
    left: on ? 22 : 3, transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
  }),
}

function Toggle({ on, onChange, disabled, tone }) {
  return (
    <div style={S.toggle(on, disabled, tone)} onClick={() => !disabled && onChange(!on)}>
      <div style={S.knob(on)} />
    </div>
  )
}

// ─── Section 1: Settings overview ──────────────────────────────────────
// Flattens TAB_SETTINGS into one list instead of the person visiting each
// tab's own gear icon. Reuses useTabSettings per-tab under the hood so
// there's exactly one source of truth with the per-tab gear panel.

function SettingsOverviewSection({ isAdmin, adminId, showToast }) {
  const { isPremium, loading: premiumLoading, refresh: refreshPremium } = usePremiumStatus()
  const [busyPlan, setBusyPlan] = useState(false)
  const [expandedTab, setExpandedTab] = useState(null)

  const handlePlanToggle = async () => {
    if (busyPlan || premiumLoading) return
    if (!adminId) {
      showToast?.('Your account isn\'t linked to a staff profile (staff_profile_id is missing) — can\'t verify admin status.', 'err')
      return
    }
    setBusyPlan(true)
    try {
      await setPremiumPlan(supabase, isPremium ? 'free' : 'premium', adminId)
      await refreshPremium()
      showToast?.(isPremium ? 'Premium deactivated' : '✅ Premium activated', 'ok')
    } catch (e) {
      showToast?.('Could not update plan: ' + e.message, 'err')
    }
    setBusyPlan(false)
  }

  const tabKeys = Object.keys(TAB_SETTINGS).filter(k => TAB_SETTINGS[k].length > 0)

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>Settings overview</div>
      <div style={S.sectionSub}>Every tab's advanced settings in one place — expand a tab to review or change its values.</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: isPremium ? `${COLOR.sage}14` : COLOR.parchment, borderRadius: RADIUS.md, border: `1px solid ${isPremium ? COLOR.sage + '44' : COLOR.rule}`, marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: isPremium ? COLOR.sageDeep : COLOR.ink2 }}>{isPremium ? '✨ Premium active' : 'Premium inactive'}</div>
          <div style={{ fontSize: 11, color: COLOR.slate, marginTop: 2 }}>Controls which settings below are unlocked</div>
        </div>
        <Toggle on={isPremium} onChange={handlePlanToggle} disabled={busyPlan || premiumLoading} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {tabKeys.map(tabKey => (
          <TabSettingsRow
            key={tabKey}
            tabKey={tabKey}
            expanded={expandedTab === tabKey}
            onToggleExpand={() => setExpandedTab(expandedTab === tabKey ? null : tabKey)}
            isPremium={isPremium}
            isAdmin={isAdmin}
            adminId={adminId}
            showToast={showToast}
          />
        ))}
      </div>
    </div>
  )
}

const TAB_LABELS = {
  checkin: 'Take attendance', attendancesummary: 'Attendance', timecard: 'Time card', advances: 'Advances',
  fines: 'Late fines', regularization: 'Correct attendance', reports: 'Reports', broadcast: 'Broadcast messages',
  notifications: 'Notifications', coverage: 'Staff coverage', cashbook: 'Cash book',
}

function TabSettingsRow({ tabKey, expanded, onToggleExpand, isPremium, isAdmin, adminId, showToast }) {
  const defs = TAB_SETTINGS[tabKey] || []
  const { values, loading, saveFree, savePremium } = useTabSettings(tabKey, adminId)
  const lockedCount = defs.filter(d => d.premium && !isPremium).length

  const handleChange = async (def, newValue) => {
    try {
      if (def.premium) await savePremium(def.key, newValue, adminId)
      else await saveFree(def.key, newValue)
      showToast?.('Setting saved', 'ok')
    } catch (e) {
      showToast?.('Could not save: ' + e.message, 'err')
    }
  }

  return (
    <div style={{ border: `1px solid ${COLOR.rule}`, borderRadius: RADIUS.md, overflow: 'hidden' }}>
      <button onClick={onToggleExpand} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '11px 14px', background: expanded ? COLOR.parchment : COLOR.parchmentRaised,
        border: 'none', cursor: 'pointer', fontFamily: FONT.body, textAlign: 'left',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLOR.ink2 }}>{TAB_LABELS[tabKey] || tabKey}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lockedCount > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: COLOR.warn, background: COLOR.warnBg, padding: '2px 7px', borderRadius: RADIUS.pill }}>{lockedCount} locked</span>}
          <span style={{ fontSize: 12, color: COLOR.slate }}>{expanded ? '▲' : '▼'}</span>
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '4px 14px 12px' }}>
          {loading ? (
            <div style={{ fontSize: 12, color: COLOR.slate, padding: '10px 0' }}>Loading…</div>
          ) : defs.map(def => {
            const locked = def.premium && !isPremium
            const value = values[def.key] ?? def.default
            return (
              <div key={def.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${COLOR.rule}` }}>
                <div style={{ fontSize: 12.5, color: COLOR.ink2, flex: 1, paddingRight: 10 }}>
                  {def.label}
                  {def.premium && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 700, color: locked ? COLOR.warn : COLOR.sageDeep }}>{locked ? '🔒' : '✨'}</span>}
                </div>
                {def.type === 'toggle' && <Toggle on={!!value} onChange={v => handleChange(def, v)} disabled={locked} />}
                {def.type === 'select' && (
                  <select disabled={locked} value={value} onChange={e => handleChange(def, e.target.value)} style={{ padding: '5px 8px', borderRadius: RADIUS.sm, border: `1px solid ${COLOR.rule}`, fontSize: 12, fontFamily: FONT.body }}>
                    {def.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                )}
                {def.type === 'number' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <input type="number" disabled={locked} value={value} min={def.min} max={def.max}
                      onChange={e => handleChange(def, Math.min(def.max, Math.max(def.min, Number(e.target.value) || 0)))}
                      style={{ width: 56, padding: '5px 7px', borderRadius: RADIUS.sm, border: `1px solid ${COLOR.rule}`, fontSize: 12, textAlign: 'center', fontFamily: FONT.body }} />
                    {def.suffix && <span style={{ fontSize: 10.5, color: COLOR.slate }}>{def.suffix}</span>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Section 2: Emergency controls ─────────────────────────────────────
// Real production levers — each requires the admin to type a short
// confirmation phrase rather than just clicking a toggle, since these
// affect every staff member at once.

function ConfirmInline({ prompt, confirmWord, onConfirm, onCancel, tone = COLOR.danger }) {
  const [text, setText] = useState('')
  return (
    <div style={{ marginTop: 10, padding: 12, background: `${tone}0f`, border: `1px solid ${tone}44`, borderRadius: RADIUS.md }}>
      <div style={{ fontSize: 12.5, color: tone, marginBottom: 8 }}>{prompt} Type <strong>{confirmWord}</strong> to confirm.</div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder={confirmWord}
          style={{ flex: 1, padding: '8px 10px', borderRadius: RADIUS.sm, border: `1px solid ${tone}55`, fontSize: 12.5, fontFamily: FONT.body }} />
        <button onClick={onCancel} style={{ ...ledger.btnGhost(), padding: '8px 14px', fontSize: 12 }}>Cancel</button>
        <button
          onClick={() => text.trim().toLowerCase() === confirmWord.toLowerCase() && onConfirm()}
          disabled={text.trim().toLowerCase() !== confirmWord.toLowerCase()}
          style={{ padding: '8px 14px', borderRadius: RADIUS.sm, border: 'none', background: tone, color: 'white', fontWeight: 700, fontSize: 12, cursor: text.trim().toLowerCase() === confirmWord.toLowerCase() ? 'pointer' : 'not-allowed', opacity: text.trim().toLowerCase() === confirmWord.toLowerCase() ? 1 : 0.5, fontFamily: FONT.body }}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}

function EmergencyControlsSection({ adminId, showToast }) {
  const { state, loading, loadError, apply } = useSystemControl()
  const [confirming, setConfirming] = useState(null) // 'pause' | 'lock' | 'forceCheckout' | null
  const [busy, setBusy] = useState(false)

  const doApply = async (patch) => {
    if (!adminId) {
      showToast?.('Your account isn\'t linked to a staff profile (staff_profile_id is missing) — can\'t verify admin status.', 'err')
      return
    }
    setBusy(true)
    try {
      await apply(patch, adminId)
      showToast?.('System control updated', 'ok')
    } catch (e) {
      showToast?.(e.message, 'err')
    }
    setBusy(false)
    setConfirming(null)
  }

  const doForceCheckout = async () => {
    if (!adminId) {
      showToast?.('Your account isn\'t linked to a staff profile — can\'t verify admin status.', 'err')
      return
    }
    setBusy(true)
    try {
      const res = await forceCheckoutAll(adminId, 'Admin Control Center — force checkout')
      showToast?.(`✅ Checked out ${res.checked_out_count} active session(s)`, 'ok')
    } catch (e) {
      showToast?.(e.message, 'err')
    }
    setBusy(false)
    setConfirming(null)
  }

  if (loading) return <div style={S.section}><div style={{ fontSize: 12, color: COLOR.slate }}>Loading system controls…</div></div>

  if (loadError || !state) {
    const isMissingMigration = /relation .* does not exist|schema cache/i.test(loadError || '')
    return (
      <div style={S.section}>
        <div style={S.sectionTitle}>Emergency controls</div>
        <div style={{ marginTop: 8, padding: 14, background: COLOR.dangerBg, border: `1px solid ${COLOR.danger}44`, borderRadius: RADIUS.md }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.danger, fontFamily: FONT.display }}>
            {isMissingMigration ? 'Database not set up yet' : 'Could not load system controls'}
          </div>
          <div style={{ fontSize: 12, color: COLOR.danger, marginTop: 6, lineHeight: 1.5 }}>
            {isMissingMigration
              ? "The system_control table doesn't exist yet. Run migration_system_control.sql against your Supabase project, then reload this page."
              : (loadError || 'Unknown error.')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>Emergency controls</div>
      <div style={S.sectionSub}>Affects every staff member immediately. Each action requires typed confirmation.</div>

      {/* Pause check-ins */}
      <div style={{ padding: '12px 0', borderBottom: `1px solid ${COLOR.rule}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: state.check_ins_paused ? COLOR.danger : COLOR.ink2 }}>
              {state.check_ins_paused ? '⏸ Check-ins paused' : 'Check-ins running normally'}
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.slate, marginTop: 2 }}>Blocks all new punch-ins system-wide. Existing tracked shifts are unaffected.</div>
          </div>
          {!state.check_ins_paused ? (
            <button onClick={() => setConfirming('pause')} disabled={busy} style={{ ...ledger.btnGhost(busy), fontSize: 12, padding: '8px 14px', color: COLOR.danger, borderColor: COLOR.danger + '44' }}>Pause</button>
          ) : (
            <button onClick={() => doApply({ check_ins_paused: false, pause_reason: null })} disabled={busy} style={{ ...ledger.btnPrimary(busy), fontSize: 12, padding: '8px 14px' }}>Resume</button>
          )}
        </div>
        {confirming === 'pause' && (
          <ConfirmInline
            prompt="This stops every staff member from checking in until resumed."
            confirmWord="PAUSE"
            tone={COLOR.danger}
            onCancel={() => setConfirming(null)}
            onConfirm={() => doApply({ check_ins_paused: true, pause_reason: 'Paused via Admin Control Center' })}
          />
        )}
      </div>

      {/* Lock enrollment */}
      <div style={{ padding: '12px 0', borderBottom: `1px solid ${COLOR.rule}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: state.enrollment_locked ? COLOR.warn : COLOR.ink2 }}>
              {state.enrollment_locked ? '🔒 Enrollment locked' : 'Enrollment open'}
            </div>
            <div style={{ fontSize: 11.5, color: COLOR.slate, marginTop: 2 }}>Blocks new face enrollments (admin and self). Existing approved faces still work for check-in.</div>
          </div>
          {!state.enrollment_locked ? (
            <button onClick={() => setConfirming('lock')} disabled={busy} style={{ ...ledger.btnGhost(busy), fontSize: 12, padding: '8px 14px', color: COLOR.warn, borderColor: COLOR.warn + '44' }}>Lock</button>
          ) : (
            <button onClick={() => doApply({ enrollment_locked: false, lock_reason: null })} disabled={busy} style={{ ...ledger.btnPrimary(busy), fontSize: 12, padding: '8px 14px' }}>Unlock</button>
          )}
        </div>
        {confirming === 'lock' && (
          <ConfirmInline
            prompt="No one will be able to enroll or re-enroll a face until unlocked."
            confirmWord="LOCK"
            tone={COLOR.warn}
            onCancel={() => setConfirming(null)}
            onConfirm={() => doApply({ enrollment_locked: true, lock_reason: 'Locked via Admin Control Center' })}
          />
        )}
      </div>

      {/* Force checkout all */}
      <div style={{ padding: '12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.ink2 }}>Force checkout everyone</div>
            <div style={{ fontSize: 11.5, color: COLOR.slate, marginTop: 2 }}>Ends every currently open (checked-in) session right now. Use for evacuations or stuck sessions.</div>
          </div>
          <button onClick={() => setConfirming('forceCheckout')} disabled={busy} style={{ ...ledger.btnGhost(busy), fontSize: 12, padding: '8px 14px', color: COLOR.danger, borderColor: COLOR.danger + '44' }}>Force checkout</button>
        </div>
        {confirming === 'forceCheckout' && (
          <ConfirmInline
            prompt="This immediately ends every open session for every staff member."
            confirmWord="CHECKOUT"
            tone={COLOR.danger}
            onCancel={() => setConfirming(null)}
            onConfirm={doForceCheckout}
          />
        )}
      </div>
    </div>
  )
}

// ─── Section 3: Automation rules ────────────────────────────────────────

function AutomationRulesSection({ adminId, showToast }) {
  const { rules, loading, save } = useAutomationRules()
  const [busyType, setBusyType] = useState(null)

  const ruleTypes = Object.keys(RULE_DEFS)

  const findRule = (ruleType) => rules.find(r => r.rule_type === ruleType)

  const handleToggle = async (ruleType, enabled) => {
    if (!adminId) {
      showToast?.('Your account isn\'t linked to a staff profile (staff_profile_id is missing), so admin actions can\'t be verified. Check your portal_users row.', 'err')
      return
    }
    setBusyType(ruleType)
    try {
      const existing = findRule(ruleType)
      const def = RULE_DEFS[ruleType]
      const config = existing?.config || Object.fromEntries(def.configFields.map(f => [f.key, f.default]))
      await save(adminId, { id: existing?.id ?? null, ruleType, enabled, config })
      showToast?.(enabled ? 'Rule enabled' : 'Rule disabled', 'ok')
    } catch (e) {
      showToast?.(e.message, 'err')
    }
    setBusyType(null)
  }

  const handleConfigChange = async (ruleType, key, value) => {
    if (!adminId) {
      showToast?.('Your account isn\'t linked to a staff profile — can\'t save this change.', 'err')
      return
    }
    setBusyType(ruleType)
    try {
      const existing = findRule(ruleType)
      const config = { ...(existing?.config || {}), [key]: value }
      await save(adminId, { id: existing?.id ?? null, ruleType, enabled: existing?.enabled ?? true, config })
    } catch (e) {
      showToast?.(e.message, 'err')
    }
    setBusyType(null)
  }

  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>Automation rules</div>
      <div style={S.sectionSub}>Rules run server-side and log every action taken — nothing here happens silently.</div>

      {loading ? (
        <div style={{ fontSize: 12, color: COLOR.slate }}>Loading rules…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ruleTypes.map(ruleType => {
            const def = RULE_DEFS[ruleType]
            const rule = findRule(ruleType)
            const enabled = rule?.enabled ?? false
            const config = rule?.config || Object.fromEntries(def.configFields.map(f => [f.key, f.default]))
            return (
              <div key={ruleType} style={{ border: `1px solid ${COLOR.rule}`, borderRadius: RADIUS.md, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: COLOR.ink2 }}>{def.label}</div>
                    <div style={{ fontSize: 11.5, color: COLOR.slate, marginTop: 3, lineHeight: 1.5 }}>{def.description}</div>
                  </div>
                  <Toggle on={enabled} onChange={v => handleToggle(ruleType, v)} disabled={busyType === ruleType} />
                </div>
                {enabled && def.configFields.length > 0 && (
                  <div style={{ display: 'flex', gap: 14, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLOR.rule}` }}>
                    {def.configFields.map(f => (
                      <label key={f.key} style={{ fontSize: 11.5, color: COLOR.slate, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {f.label}
                        <input
                          type={f.type} value={config[f.key] ?? f.default} min={f.min} max={f.max}
                          onChange={e => handleConfigChange(ruleType, f.key, Math.min(f.max, Math.max(f.min, Number(e.target.value) || f.default)))}
                          style={{ width: 64, padding: '5px 7px', borderRadius: RADIUS.sm, border: `1px solid ${COLOR.rule}`, fontSize: 12, textAlign: 'center', fontFamily: FONT.body }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────────────────

export default function AdminControlCenter({ isAdmin, adminId, showToast }) {
  if (!isAdmin) return null // defensive — this tab is only ever rendered for admins
  return (
    <div>
      <SettingsOverviewSection isAdmin={isAdmin} adminId={adminId} showToast={showToast} />
      <EmergencyControlsSection adminId={adminId} showToast={showToast} />
      <AutomationRulesSection adminId={adminId} showToast={showToast} />
    </div>
  )
}

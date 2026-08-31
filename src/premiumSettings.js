// premiumSettings.js — defines the "Advanced settings" available from the
// gear icon on every FaceAttendance tab, split into free (staff-level,
// stored in staff_face_settings) and premium (org-level, stored in
// org_face_settings, gated behind org_subscription.plan === 'premium').
//
// Adding a new advanced setting for a tab: add one entry to TAB_SETTINGS
// below. Nothing else needs to change — AdvancedSettingsPanel.jsx renders
// from this table generically.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

// type: 'toggle' | 'select' | 'number'
// premium: true  -> org-wide, requires is_premium_active(), admin-only to change
// premium: false -> per-staff, anyone viewing that tab can set their own
export const TAB_SETTINGS = {
  checkin: [
    { key: 'checkin.reminder_before_window', label: 'Remind me before check-in window opens', type: 'toggle', premium: false, default: true },
    { key: 'checkin.strict_face_threshold',  label: 'Stricter face-match threshold (fewer false accepts, more retries)', type: 'toggle', premium: true, default: false },
    { key: 'checkin.require_head_turn',      label: 'Require head-turn liveness on every check-in (not just blink)', type: 'toggle', premium: true, default: true },
    { key: 'checkin.auto_checkout_grace_min',label: 'Auto-checkout grace period after leaving campus', type: 'number', premium: true, default: 10, min: 5, max: 60, suffix: 'min' },
  ],
  attendancesummary: [
    { key: 'summary.default_range', label: 'Default view range', type: 'select', premium: false, default: 'month', options: [['week','This week'], ['month','This month'], ['term','This term']] },
    { key: 'summary.show_predicted_absent', label: 'Show predicted-absent forecast (based on past patterns)', type: 'toggle', premium: true, default: false },
  ],
  timecard: [
    { key: 'timecard.round_hours', label: 'Round hours to nearest 15 min', type: 'toggle', premium: false, default: false },
    { key: 'timecard.overtime_alerts', label: 'Alert admin when staff cross daily overtime threshold', type: 'toggle', premium: true, default: false },
  ],
  advances: [
    { key: 'advances.auto_deduct_reminder', label: 'Remind staff before an advance auto-deducts from salary', type: 'toggle', premium: false, default: true },
  ],
  fines: [
    { key: 'fines.grace_minutes', label: 'Late grace period before a fine applies', type: 'number', premium: true, default: 5, min: 0, max: 30, suffix: 'min' },
  ],
  regularization: [
    { key: 'regularization.auto_escalate_days', label: 'Auto-escalate to senior admin if pending over N days', type: 'number', premium: true, default: 3, min: 1, max: 14, suffix: 'days' },
  ],
  reports: [
    { key: 'reports.default_export', label: 'Default export format', type: 'select', premium: false, default: 'csv', options: [['csv','CSV'], ['xlsx','Excel']] },
    { key: 'reports.scheduled_email', label: 'Email a monthly report automatically', type: 'toggle', premium: true, default: false },
  ],
  broadcast: [
    { key: 'broadcast.delivery_receipts', label: 'Show delivery/read receipts on broadcasts', type: 'toggle', premium: true, default: false },
  ],
  notifications: [
    { key: 'notifications.digest_mode', label: 'Batch notifications into a daily digest instead of instant', type: 'toggle', premium: false, default: false },
  ],
  coverage: [
    { key: 'coverage.drift_watch', label: 'Face-match drift watch (proactive re-enrollment nudges)', type: 'toggle', premium: true, default: true },
  ],
  cashbook: [
    { key: 'cashbook.low_balance_alert', label: 'Alert admin when cash balance falls below a set amount', type: 'toggle', premium: true, default: false },
  ],
}

export function tabHasSettings(tabKey) {
  return Array.isArray(TAB_SETTINGS[tabKey]) && TAB_SETTINGS[tabKey].length > 0
}

// ─── Data hooks ─────────────────────────────────────────────────────────

// Toggle both directions between 'free' and 'premium'. Goes through the
// set_org_premium_plan RPC, which re-checks the caller is actually an
// admin server-side — the isAdmin prop passed into PremiumToggleCard is
// just React state and isn't a security boundary on its own (RLS is
// disabled for this project), so the real enforcement lives in the RPC.
export async function setPremiumPlan(supabase, plan, adminId) {
  const { data, error } = await supabase.rpc('set_org_premium_plan', { p_plan: plan, p_admin_id: adminId })
  if (error) {
    if (/function .* does not exist|could not find/i.test(error.message || '')) {
      throw new Error('Premium controls aren\'t set up yet — run migration_premium_settings.sql against the database, then try again.')
    }
    throw error
  }
  if (!data?.success) throw new Error(data?.error === 'unauthorized' ? 'Only admins can change the plan' : (data?.error || 'Could not update plan'))
  return data
}

export function usePremiumStatus() {
  const [isPremium, setIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('is_premium_active')
    let result
    if (error) {
      // Most likely cause: migration_premium_settings.sql hasn't been run
      // yet, so is_premium_active() doesn't exist. Default to "not
      // premium" (fail closed on the feature-gate) rather than crashing,
      // but keep the error visible for whoever's debugging deploy issues.
      setLoadError(error.message)
      setIsPremium(false)
      result = { isPremium: false, loadError: error.message }
    } else {
      setLoadError(null)
      setIsPremium(!!data)
      result = { isPremium: !!data, loadError: null }
    }
    setLoading(false)
    // Return the outcome directly (not just via state) so callers that
    // await refresh() right after a write — e.g. handleToggle — can
    // verify the change actually took effect instead of trusting the
    // write alone.
    return result
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return { isPremium, loading, loadError, refresh }
}

// Loads/saves both free (per-staff) and premium (org-level) setting values
// for a given tab. Free settings are readable/writable by the viewing
// staff member. Premium settings are readable by anyone (so locked rows
// can still show their configured value once unlocked) but writable only
// when isAdmin — the panel enforces this, this hook just executes what
// it's asked.
export function useTabSettings(tabKey, staffId) {
  const defs = TAB_SETTINGS[tabKey] || []
  const [values, setValues] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!defs.length) { setLoading(false); return }
    setLoading(true)
    const freeKeys = defs.filter(d => !d.premium).map(d => d.key)
    const premiumKeys = defs.filter(d => d.premium).map(d => d.key)

    const next = {}
    for (const d of defs) next[d.key] = d.default

    if (freeKeys.length && staffId) {
      const { data } = await supabase
        .from('staff_face_settings')
        .select('setting_key, value')
        .eq('staff_id', staffId)
        .in('setting_key', freeKeys)
      for (const row of data || []) next[row.setting_key] = row.value
    }
    if (premiumKeys.length) {
      const { data } = await supabase
        .from('org_face_settings')
        .select('setting_key, value')
        .in('setting_key', premiumKeys)
      for (const row of data || []) next[row.setting_key] = row.value
    }
    setValues(next)
    setLoading(false)
    // Return the freshly-loaded values so callers that await load()/reload()
    // right after a write can confirm what the server actually has, rather
    // than trusting the optimistic update or an undefined return value.
    return next
  }, [tabKey, staffId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const saveFree = useCallback(async (key, value) => {
    setValues(v => ({ ...v, [key]: value })) // optimistic
    const { error } = await supabase
      .from('staff_face_settings')
      .upsert({ staff_id: staffId, setting_key: key, value, updated_at: new Date().toISOString() }, { onConflict: 'staff_id,setting_key' })
    if (error) { load(); throw error } // roll back to server truth on failure
  }, [staffId, load])

  const savePremium = useCallback(async (key, value, adminId) => {
    setValues(v => ({ ...v, [key]: value })) // optimistic
    const { error } = await supabase
      .from('org_face_settings')
      .upsert({ setting_key: key, value, updated_by: adminId, updated_at: new Date().toISOString() }, { onConflict: 'setting_key' })
    if (error) { load(); throw error }
  }, [load])

  return { defs, values, loading, saveFree, savePremium, reload: load }
}
// systemControl.js — data layer for the Admin Control Center: the
// emergency kill-switches (pause check-ins, lock enrollment, force
// checkout) and admin-defined automation rules. Every write goes through
// a SECURITY DEFINER RPC that re-checks admin status server-side (see
// migration_system_control.sql) — the isAdmin prop passed around the UI
// is a display convenience only, never the actual boundary.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useSystemControl() {
  const [state, setState] = useState(null) // { check_ins_paused, pause_reason, enrollment_locked, lock_reason }
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('system_control')
      .select('check_ins_paused, pause_reason, enrollment_locked, lock_reason, updated_at')
      .eq('id', 1)
      .maybeSingle()
    if (error) {
      // Most common cause: migration_system_control.sql hasn't been run
      // yet, so the system_control table doesn't exist (Postgres error
      // 42P01 / PostgREST "relation does not exist"). Surface this
      // instead of leaving the UI stuck on "Loading system controls…"
      // with no explanation.
      setLoadError(error.message || 'Could not load system controls')
    } else {
      setState(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const apply = useCallback(async (patch, adminId) => {
    const next = { ...state, ...patch }
    setState(next) // optimistic
    const { data, error } = await supabase.rpc('set_system_control', {
      p_admin_id: adminId,
      p_check_ins_paused: next.check_ins_paused ?? false,
      p_pause_reason: next.pause_reason ?? null,
      p_enrollment_locked: next.enrollment_locked ?? false,
      p_lock_reason: next.lock_reason ?? null,
    })
    if (error || !data?.success) {
      refresh() // roll back to server truth
      // Distinguish "the RPC doesn't exist" (migration not run) from a
      // genuine permission denial, so the person isn't told they're not
      // an admin when the real problem is a missing migration.
      if (error && /function .* does not exist|could not find/i.test(error.message || '')) {
        throw new Error('System controls aren\'t set up yet — run migration_system_control.sql against the database, then try again.')
      }
      throw new Error(error?.message || (data?.error === 'unauthorized' ? 'Only admins can change system controls' : 'Could not update'))
    }
    return data
  }, [state, refresh])

  return { state, loading, loadError, apply, refresh }
}

export async function forceCheckoutAll(adminId, note) {
  const { data, error } = await supabase.rpc('force_checkout_all', { p_admin_id: adminId, p_note: note || 'Admin force-checkout' })
  if (error) throw error
  if (!data?.success) throw new Error(data?.error === 'unauthorized' ? 'Only admins can do this' : (data?.error || 'Could not force checkout'))
  return data
}

// ─── Automation rules ───────────────────────────────────────────────────

export const RULE_DEFS = {
  auto_approve_enrollment: {
    label: 'Auto-approve clean self-enrollments',
    description: 'Skip the manual approval queue when a self-enrollment has no conflicting face on file. Still logged for later audit — this speeds up onboarding, it does not remove the record.',
    configFields: [], // no tunables yet — see try_auto_approve_enrollment's SQL comment for why
  },
  auto_flag_repeat_late: {
    label: 'Auto-flag repeat late check-ins',
    description: 'Flag a staff member for review after they rack up N late check-ins within a rolling window, without waiting for an admin to notice the pattern manually.',
    configFields: [
      { key: 'late_count', label: 'Late check-ins', type: 'number', min: 2, max: 20, default: 3 },
      { key: 'window_days', label: 'Within (days)', type: 'number', min: 7, max: 90, default: 30 },
    ],
  },
}

export function useAutomationRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('automation_rules')
      .select('id, rule_type, enabled, config, updated_at')
      .order('created_at', { ascending: true })
    if (!error) setRules(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const save = useCallback(async (adminId, { id = null, ruleType, enabled, config }) => {
    const { data, error } = await supabase.rpc('upsert_automation_rule', {
      p_admin_id: adminId, p_id: id, p_rule_type: ruleType, p_enabled: enabled, p_config: config,
    })
    if (error) {
      if (/function .* does not exist|could not find|relation .* does not exist/i.test(error.message || '')) {
        throw new Error('Automation rules aren\'t set up yet — run migration_system_control.sql against the database, then try again.')
      }
      throw error
    }
    if (!data?.success) throw new Error(data?.error === 'unauthorized' ? 'Only admins can change automation rules' : (data?.error || 'Could not save rule'))
    await refresh()
    return data
  }, [refresh])

  return { rules, loading, save, refresh }
}

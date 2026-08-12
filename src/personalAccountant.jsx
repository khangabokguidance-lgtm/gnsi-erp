// personalAccountant.jsx — GNSI Portal
// ─────────────────────────────────────────────────────────────────────────────
// Shared "Personal Accountant" panel: an admin-only floating drawer that reads
// the portal's audit tables and surfaces (a) a narrated summary of recent
// activity and (b) risk flags worth a human's attention — reusing the same
// severity vocabulary and verdict-persistence pattern already established by
// Fees.jsx's AnomalyMonitor (SEV_COLOR/SEV_ICON, fraud_alerts verdict table).
//
// Self-contained: does not depend on any host file's local `T` theme object,
// so it can be dropped into Students.jsx, Admissions.jsx, and Fees.jsx
// unchanged. Each host only needs to render <PersonalAccountantButton/> and
// pass it `supabase`, `module` (which audit source to read), and `currentUser`.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react'

// ─── Palette (self-contained, mirrors Fees.jsx's AnomalyMonitor) ───────────
export const SEV_COLOR = {
  CRITICAL: { bg: '#fef2f2', border: '#fca5a5', text: '#dc2626', badge: '#dc2626' },
  HIGH:     { bg: '#fff7ed', border: '#fed7aa', text: '#ea580c', badge: '#ea580c' },
  MEDIUM:   { bg: '#fffbeb', border: '#fde68a', text: '#d97706', badge: '#d97706' },
  LOW:      { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', badge: '#16a34a' },
}
const SEV_ICON = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🟢' }
const INK = '#0B1E3D'
const GOLD = '#C9A24B'
const SURFACE = '#ffffff'
const SURFACE2 = '#f8fafc'
const BORDER = '#e2e8f0'
const TEXT2 = '#475569'
const TEXT3 = '#64748b'
const TEXT4 = '#94a3b8'

// ─── Module → audit table + action-list config ─────────────────────────────
// Each host module reads a different table/filter, but the same engine and
// UI work for all three, since the underlying row shape (action, changed_by
// or user_name, created_at, target_id/metadata) is consistent enough once
// normalized by `normalizeEntry` below.
const MODULE_CONFIG = {
  fees: {
    table: 'audit_log',
    actionCol: 'action',
    actions: ['fee_collection', 'fee_revert', 'fee_date_correction', 'legacy_fee_delete'],
    actorCol: 'changed_by',
    label: 'Fees',
  },
  students: {
    table: 'audit_logs',
    actionCol: 'action',
    moduleFilter: 'Students',
    actorCol: 'user_name',
    label: 'Students',
  },
  admissions: {
    table: 'audit_logs',
    actionCol: 'action',
    moduleFilter: 'admissions',
    actorCol: 'user_name',
    label: 'Admissions',
  },
}

function normalizeEntry(row, cfg) {
  return {
    id: row.id,
    action: row.action,
    actor: row[cfg.actorCol] || 'Unknown',
    createdAt: row.created_at,
    targetId: row.target_id ?? null,
    metadata: row.metadata ?? null,
    oldValues: row.old_values ?? null,
    newValues: row.new_values ?? null,
    raw: row,
  }
}

function fmtAmt(v) { return `₹${Number(v || 0).toLocaleString('en-IN')}` }
function fmtTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
function hourOf(iso) { try { return new Date(iso).getHours() } catch (_) { return null } }
function isAfterHours(iso) { const h = hourOf(iso); return h != null && (h < 6 || h >= 22) }
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d }

// ─── Risk-flag engine ────────────────────────────────────────────────────────
// Deliberately conservative: flags patterns worth a look, not accusations.
// Mirrors the push(id, sev, cat, title, detail, records) shape from Fees.jsx's
// runAnomalyEngine so verdicts can be saved the same way.
function runAccountantEngine(entries, moduleKey) {
  const flags = []
  const push = (id, sev, cat, title, detail, records = []) => flags.push({ id: `acct_${moduleKey}_${id}`, sev, cat, title, detail, records })

  if (entries.length === 0) return flags

  // 1. Reverts / deletes — always worth a glance, regardless of volume.
  const reverts = entries.filter(e => /revert|delete/i.test(e.action))
  if (reverts.length > 0) {
    push('reverts', reverts.length >= 3 ? 'HIGH' : 'MEDIUM', 'Reversal',
      `${reverts.length} revert/delete action${reverts.length !== 1 ? 's' : ''} recently`,
      `${reverts.length} record${reverts.length !== 1 ? 's were' : ' was'} reverted or deleted — worth confirming each was intentional.`,
      reverts.slice(0, 10).map(e => ({ label: `${e.action} by ${e.actor} · ${fmtTime(e.createdAt)}`, raw: e.raw }))
    )
  }

  // 2. After-hours activity (before 6am or after 10pm local time).
  const afterHours = entries.filter(e => isAfterHours(e.createdAt))
  if (afterHours.length > 0) {
    push('after_hours', 'MEDIUM', 'Timing',
      `${afterHours.length} action${afterHours.length !== 1 ? 's' : ''} outside normal hours`,
      `Activity recorded between 10 PM and 6 AM — confirm this was expected (e.g. legitimate late admin work), not a shared login being used unsupervised.`,
      afterHours.slice(0, 10).map(e => ({ label: `${e.action} by ${e.actor} · ${fmtTime(e.createdAt)}`, raw: e.raw }))
    )
  }

  // 3. Repeated bulk/destructive actions by the same actor in a short window.
  const byActor = {}
  entries.forEach(e => { (byActor[e.actor] = byActor[e.actor] || []).push(e) })
  Object.entries(byActor).forEach(([actor, list]) => {
    const bulky = list.filter(e => /bulk|delete/i.test(e.action))
    if (bulky.length >= 3) {
      push('bulk_' + actor, 'MEDIUM', 'Volume',
        `${actor}: ${bulky.length} bulk/delete actions recently`,
        `${actor} performed ${bulky.length} bulk or delete operations — a quick sanity check may be worthwhile if this wasn't a planned cleanup.`,
        bulky.slice(0, 10).map(e => ({ label: `${e.action} · ${fmtTime(e.createdAt)}`, raw: e.raw }))
      )
    }
  })

  // 4. Fees-specific: unusually high single collections (reuses Fees' own
  //    ₹50,000 threshold convention) and missing transaction reference.
  if (moduleKey === 'fees') {
    entries.forEach(e => {
      if (e.action !== 'fee_collection' || !e.newValues) return
      let nv = null
      try { nv = typeof e.newValues === 'string' ? JSON.parse(e.newValues) : e.newValues } catch (_) { return }
      const total = Number(nv?.total || 0)
      if (total > 50000) {
        push('high_' + e.id, 'HIGH', 'Amount',
          `Unusually high collection: ${fmtAmt(total)}`,
          `${nv.student_name || 'GCC-' + nv.gcc} paid ${fmtAmt(total)} via ${nv.pay_mode || '—'} on ${fmtTime(e.createdAt)}.`,
          [{ label: `${nv.student_name || 'GCC-' + nv.gcc} · ${fmtAmt(total)} · ${nv.pay_mode || '—'}`, raw: e.raw }]
        )
      }
    })
  }

  const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
  return flags.sort((a, b) => order[a.sev] - order[b.sev])
}

// ─── Narration engine ────────────────────────────────────────────────────────
// Produces a short, plain-English summary of "today" and "this week" —
// counts by action, top actor, and a one-line headline. Deliberately terse;
// this narrates facts already in the data, it does not infer intent.
function buildNarration(entries, cfg) {
  const today = startOfDay(new Date())
  const weekAgo = daysAgo(7)
  const todayEntries = entries.filter(e => new Date(e.createdAt) >= today)
  const weekEntries = entries.filter(e => new Date(e.createdAt) >= weekAgo)

  const countBy = (list, key) => {
    const m = {}
    list.forEach(e => { m[e[key]] = (m[e[key]] || 0) + 1 })
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }

  const todayByAction = countBy(todayEntries, 'action')
  const todayByActor = countBy(todayEntries, 'actor')
  const weekByActor = countBy(weekEntries, 'actor')

  const lines = []
  if (todayEntries.length === 0) {
    lines.push(`No ${cfg.label.toLowerCase()} activity recorded yet today.`)
  } else {
    lines.push(`${todayEntries.length} action${todayEntries.length !== 1 ? 's' : ''} recorded today across ${cfg.label.toLowerCase()}.`)
    if (todayByAction.length) {
      const top = todayByAction.slice(0, 3).map(([a, c]) => `${c} ${a}`).join(', ')
      lines.push(`Breakdown: ${top}.`)
    }
    if (todayByActor.length) {
      const [name, count] = todayByActor[0]
      lines.push(`Most active today: ${name} (${count} action${count !== 1 ? 's' : ''}).`)
    }
  }
  if (weekEntries.length > 0) {
    lines.push(`This week: ${weekEntries.length} total action${weekEntries.length !== 1 ? 's' : ''} across ${weekByActor.length} staff member${weekByActor.length !== 1 ? 's' : ''}.`)
  }
  return lines
}

// ─── Fetch hook ──────────────────────────────────────────────────────────────
function useAccountantData(supabase, moduleKey, isAdmin) {
  const cfg = MODULE_CONFIG[moduleKey]
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!isAdmin || !cfg) { setLoading(false); return }
    let cancelled = false
    setLoading(true)
    let q = supabase.from(cfg.table).select('*').order('created_at', { ascending: false }).limit(500)
    if (cfg.actions) q = q.in(cfg.actionCol, cfg.actions)
    if (cfg.moduleFilter) q = q.eq('module', cfg.moduleFilter)
    q.then(({ data, error }) => {
      if (cancelled) return
      if (error) { setError(error.message); setLoading(false); return }
      setEntries((data || []).map(r => normalizeEntry(r, cfg)))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [supabase, moduleKey, isAdmin])

  return { entries, loading, error, cfg }
}

// ─── Verdict persistence (reuses fraud_alerts, same as Fees' AnomalyMonitor) ─
function useVerdicts(supabase, flags, isAdmin, currentUser) {
  const [reviews, setReviews] = useState({})
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    if (!isAdmin || flags.length === 0) return
    let cancelled = false
    supabase.from('fraud_alerts').select('label,verdict,resolved_by,resolved_at').in('label', flags.map(f => f.id))
      .then(({ data, error }) => {
        if (cancelled || error) return
        const map = {}
        ;(data || []).forEach(r => { map[r.label] = { verdict: r.verdict || 'pending', resolved_by: r.resolved_by, resolved_at: r.resolved_at } })
        setReviews(map)
      })
    return () => { cancelled = true }
  }, [supabase, flags, isAdmin])

  const saveVerdict = async (flag, verdict) => {
    setSaving(flag.id)
    try {
      const reviewerName = currentUser?.name || currentUser?.userName || 'Admin'
      const { error } = await supabase.from('fraud_alerts').upsert({
        label: flag.id, flag_type: flag.cat, severity: flag.sev,
        detected_at: new Date().toISOString(),
        resolved: verdict !== 'pending', resolved_by: verdict === 'pending' ? null : reviewerName,
        resolved_at: verdict === 'pending' ? null : new Date().toISOString(),
        verdict,
      }, { onConflict: 'label' })
      if (error) { console.error('PersonalAccountant: save verdict failed', error.message); return }
      setReviews(prev => ({ ...prev, [flag.id]: { verdict, resolved_by: verdict === 'pending' ? null : reviewerName, resolved_at: verdict === 'pending' ? null : new Date().toISOString() } }))
    } finally {
      setSaving(null)
    }
  }
  return { reviews, saving, saveVerdict }
}

// ─── CSV export ──────────────────────────────────────────────────────────────
function exportEntriesCSV(entries, cfg) {
  if (!entries.length) return
  const rows = entries.map(e => ({
    action: e.action, actor: e.actor, time: e.createdAt, target_id: e.targetId ?? '',
    details: e.metadata ? JSON.stringify(e.metadata) : (e.newValues || ''),
  }))
  const headers = Object.keys(rows[0])
  const csv = [headers.join(','), ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${cfg.label.toLowerCase()}-accountant-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
}

// ─── UI: floating trigger button ─────────────────────────────────────────────
export function PersonalAccountantButton({ supabase, moduleKey, isAdmin, currentUser, isMobile }) {
  const [open, setOpen] = useState(false)
  if (!isAdmin) return null
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Personal Accountant"
        style={{
          position: 'fixed', zIndex: 99990,
          right: isMobile ? 14 : 24, bottom: isMobile ? 84 : 24,
          width: 52, height: 52, borderRadius: '50%',
          background: INK, color: GOLD, border: `1px solid ${GOLD}`,
          boxShadow: '0 8px 24px rgba(11,30,61,.35)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}
      >🧾</button>
      {open && (
        <PersonalAccountantDrawer
          supabase={supabase} moduleKey={moduleKey} currentUser={currentUser}
          isMobile={isMobile} onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

// ─── UI: drawer ──────────────────────────────────────────────────────────────
function PersonalAccountantDrawer({ supabase, moduleKey, currentUser, isMobile, onClose }) {
  const { entries, loading, error, cfg } = useAccountantData(supabase, moduleKey, true)
  const flags = useMemo(() => runAccountantEngine(entries, moduleKey), [entries, moduleKey])
  const narration = useMemo(() => buildNarration(entries, cfg), [entries, cfg])
  const { reviews, saving, saveVerdict } = useVerdicts(supabase, flags, true, currentUser)
  const [openFlag, setOpenFlag] = useState(null)
  const [tab, setTab] = useState('summary') // 'summary' | 'flags' | 'log'
  const [search, setSearch] = useState('')

  const pendingFlags = flags.filter(f => (reviews[f.id]?.verdict || 'pending') === 'pending')

  const filteredLog = entries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return `${e.action} ${e.actor} ${e.targetId || ''}`.toLowerCase().includes(q)
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99991, display: 'flex', justifyContent: isMobile ? 'stretch' : 'flex-end' }} onClick={onClose}>
      <div style={{
        width: isMobile ? '100%' : 480, background: SURFACE,
        borderLeft: isMobile ? 'none' : `1px solid ${BORDER}`,
        boxShadow: '-8px 0 32px rgba(15,23,42,.18)',
        display: 'flex', flexDirection: 'column',
        animation: isMobile ? 'slideUp .25s ease' : 'slideLeft .25s cubic-bezier(.34,1.2,.64,1)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER}`, background: INK, color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-.01em' }}>🧾 Personal Accountant</div>
            <div style={{ fontSize: 11, color: GOLD, marginTop: 2 }}>{cfg.label} · Admin only</div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid rgba(255,255,255,.25)`, background: 'transparent', color: '#fff', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, background: SURFACE2 }}>
          {[
            { key: 'summary', label: '📋 Summary' },
            { key: 'flags', label: `⚠ Flags${pendingFlags.length ? ` (${pendingFlags.length})` : ''}` },
            { key: 'log', label: '🔎 Full Log' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              flex: 1, padding: '10px 8px', fontSize: 12, fontWeight: 700, fontFamily: 'inherit',
              border: 'none', borderBottom: tab === t.key ? `2px solid ${GOLD}` : '2px solid transparent',
              background: 'transparent', color: tab === t.key ? INK : TEXT3, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: TEXT3 }}>⏳ Loading…</div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#dc2626' }}>Couldn't load activity: {error}</div>
          ) : tab === 'summary' ? (
            <div>
              <div style={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                {narration.map((line, i) => (
                  <div key={i} style={{ fontSize: 13, color: i === 0 ? INK : TEXT2, fontWeight: i === 0 ? 700 : 500, marginBottom: i < narration.length - 1 ? 6 : 0, lineHeight: 1.5 }}>{line}</div>
                ))}
              </div>
              {pendingFlags.length > 0 && (
                <div style={{ background: SEV_COLOR.HIGH.bg, border: `1px solid ${SEV_COLOR.HIGH.border}`, borderRadius: 10, padding: '12px 14px', fontSize: 12, color: SEV_COLOR.HIGH.text, fontWeight: 600, marginBottom: 14 }}>
                  {pendingFlags.length} item{pendingFlags.length !== 1 ? 's' : ''} in Flags need a look — see the Flags tab.
                </div>
              )}
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT4, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Recent activity</div>
              {entries.slice(0, 10).map(e => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 12, color: INK, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.action} · {e.actor}</div>
                  <div style={{ fontSize: 11, color: TEXT4, flexShrink: 0 }}>{fmtTime(e.createdAt)}</div>
                </div>
              ))}
              {entries.length === 0 && <div style={{ textAlign: 'center', padding: 24, color: TEXT4, fontSize: 12 }}>No activity recorded yet.</div>}
            </div>
          ) : tab === 'flags' ? (
            <div>
              {flags.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#16a34a', fontWeight: 600, fontSize: 13 }}>✅ Nothing flagged — activity looks clean.</div>
              ) : flags.map(f => {
                const c = SEV_COLOR[f.sev] || SEV_COLOR.LOW
                const isOpenF = openFlag === f.id
                const verdict = reviews[f.id]?.verdict || 'pending'
                return (
                  <div key={f.id} style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, cursor: 'pointer' }} onClick={() => setOpenFlag(isOpenF ? null : f.id)}>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: c.badge }}>{SEV_ICON[f.sev]} {f.sev} · {f.cat}</span>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginTop: 3 }}>{f.title}</div>
                      </div>
                      {verdict !== 'pending' && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: verdict === 'ok' ? '#dcfce7' : '#fee2e2', color: verdict === 'ok' ? '#16a34a' : '#dc2626', flexShrink: 0 }}>
                          {verdict === 'ok' ? '✓ Reviewed' : '⚑ Flagged'}
                        </span>
                      )}
                    </div>
                    {isOpenF && (
                      <div style={{ marginTop: 10 }}>
                        <div style={{ fontSize: 12, color: '#334155', marginBottom: 8, lineHeight: 1.5 }}>{f.detail}</div>
                        {f.records.slice(0, 6).map((r, i) => (
                          <div key={i} style={{ fontSize: 11, color: TEXT3, padding: '4px 0', borderTop: i === 0 ? `1px solid ${c.border}` : 'none' }}>{r.label}</div>
                        ))}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button disabled={saving === f.id} onClick={() => saveVerdict(f, 'ok')} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: '1px solid #86efac', background: '#f0fdf4', color: '#16a34a', cursor: 'pointer' }}>✓ Reviewed, OK</button>
                          <button disabled={saving === f.id} onClick={() => saveVerdict(f, 'suspicious')} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>⚑ Flag as suspicious</button>
                          {verdict !== 'pending' && (
                            <button disabled={saving === f.id} onClick={() => saveVerdict(f, 'pending')} style={{ fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, border: `1px solid ${BORDER}`, background: SURFACE, color: TEXT3, cursor: 'pointer' }}>Reset</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action, staff, ID…" style={{ flex: 1, fontSize: 12, padding: '7px 10px', borderRadius: 8, border: `1px solid ${BORDER}`, fontFamily: 'inherit' }} />
                <button onClick={() => exportEntriesCSV(filteredLog, cfg)} style={{ fontSize: 11, fontWeight: 700, padding: '7px 12px', borderRadius: 8, border: `1px solid ${BORDER}`, background: SURFACE2, color: INK, cursor: 'pointer', whiteSpace: 'nowrap' }}>⬇ Export</button>
              </div>
              <div style={{ fontSize: 11, color: TEXT4, marginBottom: 8 }}>{filteredLog.length} of {entries.length} entries</div>
              {filteredLog.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: TEXT4, fontSize: 12 }}>No matching entries.</div>
              ) : filteredLog.map(e => (
                <div key={e.id} style={{ padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{e.action}</div>
                  <div style={{ fontSize: 11, color: TEXT3, marginTop: 2 }}>{e.actor} · {fmtTime(e.createdAt)}{e.targetId ? ` · #${e.targetId}` : ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
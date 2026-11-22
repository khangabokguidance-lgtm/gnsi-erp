// MissionSainikAdmin.jsx — admin toolkit shown in the Admin tab:
// pinned announcement, approvals queue (bulk approve / send back), paper locks, reminder broadcast,
// filterable audit log with CSV export, full backup export, and a guarded danger zone.
import { useState, useMemo } from 'react'
import { supabase } from './supabase'
import { PremiumCard, PX } from './premiumUI'
import { Pill, PersonCell } from './MissionSainikUI'
import { fetchAll } from './lib/missionSainikQuestions'
import { TESTS, MOCK_TESTS, fullName } from './missionSainikData'

const TABLE = 'mission_sainik_tasks'
const SERIES = [['pre', 'Pre Mock', TESTS, 'PMT'], ['mega', 'Mega Mock', MOCK_TESTS, 'MT'], ['daily', 'Daily Class Test', TESTS, 'T'], ['practice', 'Practice Bank', TESTS, 'PMT']]
const csvCell = v => { const t = String(v ?? ''); return '"' + (/^[=+\-@\t\r]/.test(t) ? "'" + t : t).replace(/"/g, '""') + '"' }
const download = (name, blob) => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url) }
const taskLabel = r => `${r.kind === 'test' ? 'PMT-' + String(r.test_no).padStart(2, '0') : 'Practice'} · ${r.subject}`

export default function MissionSainikAdmin({ rows, settings, putSetting, delSetting, reload, setMsg, audit, currentUser, today, auditRows, loadAudit, isMobile, dueFor }) {
  const [ann, setAnn] = useState(settings.announcement || '')
  const [picked, setPicked] = useState([])
  const [lockSel, setLockSel] = useState({ series: 'pre', test: 1 })
  const [fAct, setFAct] = useState(''), [fWho, setFWho] = useState(''), [fQ, setFQ] = useState('')
  const [danger, setDanger] = useState({ word: '', busy: false })
  const lab = { display: 'block', fontSize: 12, fontWeight: 700, color: PX.sub }

  // ── approvals queue ──────────────────────────────────────────────────────────
  const verified = rows.filter(r => r.status === 'Verified')
  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const bulkStatus = async (ids, status) => {
    if (!ids.length) return setMsg('❌ Tick at least one task.')
    if (!window.confirm(`${status === 'Approved' ? 'Approve' : 'Send back to Submitted'} ${ids.length} task(s)?`)) return
    const patch = status === 'Approved'
      ? { status, approved_on: today, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }
      : { status, verified_on: null, approved_on: null, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }
    const { error } = await supabase.from(TABLE).update(patch).in('id', ids)
    if (error) return setMsg('❌ ' + error.message)
    audit('bulk_' + status.toLowerCase(), null, { count: ids.length }); setPicked([]); setMsg(`✅ ${ids.length} task(s) → ${status}`); reload()
  }

  // ── paper locks ──────────────────────────────────────────────────────────────
  const locks = Object.entries(settings).filter(([k, v]) => k.startsWith('lock:') && v === 'on').map(([k]) => k)
  const lockLabel = k => { const [, s, t] = k.split(':'); const ser = SERIES.find(x => x[0] === s); return `${ser?.[1] || s} · ${ser?.[3] === 'Set' ? 'Set ' + t : (ser?.[3] || '') + '-' + String(t).padStart(2, '0')}` }
  const lockNow = async () => { if (await putSetting(`lock:${lockSel.series}:${lockSel.test}`, 'on')) setMsg('🔒 Paper locked') }

  // ── reminder broadcast ───────────────────────────────────────────────────────
  const reminder = useMemo(() => {
    const by = {}; rows.filter(r => r.status === 'Pending').forEach(r => { (by[r.setter] = by[r.setter] || []).push(r) })
    const lines = Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([n, l]) =>
      `• ${fullName(n)} — ${l.length} pending: ` + l.slice(0, 5).map(r => `${taskLabel(r)} (due ${dueFor(r).slice(5)})`).join('; ') + (l.length > 5 ? ` … +${l.length - 5} more` : ''))
    return lines.length ? `Mission Sainik 2027 — pending question setting\n\n${lines.join('\n')}\n\nPlease submit to the Head of the Institute's office by the due dates. — GNSI` : ''
  }, [rows, dueFor])
  const copy = async txt => { try { await navigator.clipboard.writeText(txt); setMsg('✅ Copied') } catch { setMsg('❌ Copy failed — select the text and copy it.') } }

  // ── audit log filters ────────────────────────────────────────────────────────
  const actions = [...new Set(auditRows.map(a => a.action))].sort(), who = [...new Set(auditRows.map(a => a.actor).filter(Boolean))].sort()
  const shown = auditRows.filter(a => (!fAct || a.action === fAct) && (!fWho || a.actor === fWho) && (!fQ || JSON.stringify([a.ref, a.detail]).toLowerCase().includes(fQ.toLowerCase())))
  const auditCsv = () => {
    const lines = [['When', 'Who', 'Action', 'Reference', 'Detail'].map(csvCell).join(',')].concat(shown.map(a => [a.at, a.actor, a.action, a.ref, a.detail ? JSON.stringify(a.detail) : ''].map(csvCell).join(',')))
    download('Mission_Sainik_audit.csv', new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })); audit('export_audit', null, { rows: shown.length })
  }

  // ── backup ───────────────────────────────────────────────────────────────────
  const backup = async () => {
    setMsg('Preparing backup…')
    const names = ['mission_sainik_tasks', 'mission_sainik_materials', 'mission_sainik_syllabus', 'mission_sainik_marks', 'mission_sainik_panel', 'mission_sainik_settings', 'mission_sainik_signoffs', 'mission_sainik_questions', 'mission_sainik_paper_cfg']
    const tables = {}, missing = []
    for (const n of names) { const { data, error } = await fetchAll(() => supabase.from(n).select('*').order(n === 'mission_sainik_settings' || n === 'mission_sainik_paper_cfg' ? (n === 'mission_sainik_settings' ? 'key' : 'series') : 'id')); if (error) missing.push(n); else tables[n] = data }
    download(`Mission_Sainik_backup_${today}.json`, new Blob([JSON.stringify({ exported_at: new Date().toISOString(), exported_by: currentUser?.name || '', tables, not_available: missing }, null, 1)], { type: 'application/json' }))
    audit('backup_export', null, { tables: Object.keys(tables).length, missing }); setMsg(`✅ Backup downloaded${missing.length ? ` (skipped: ${missing.join(', ')})` : ''}`)
  }

  // ── danger zone ──────────────────────────────────────────────────────────────
  const resetStatuses = async () => {
    if (danger.word !== 'RESET') return setMsg('❌ Type RESET to confirm.')
    setDanger({ ...danger, busy: true })
    const { error } = await supabase.from(TABLE).update({ status: 'Pending', submitted_on: null, verified_on: null, approved_on: null, updated_by: currentUser?.name || '', updated_at: new Date().toISOString() }).gte('id', 0)
    setDanger({ word: '', busy: false })
    if (error) return setMsg('❌ ' + error.message)
    audit('reset_statuses', null, { tasks: rows.length }); setMsg('✅ Every task is Pending again'); reload()
  }
  const deleteAllTasks = async () => {
    if (danger.word !== 'DELETE') return setMsg('❌ Type DELETE to confirm.')
    if (!window.confirm(`Delete ALL ${rows.length} tasks? Download a backup first. This cannot be undone.`)) return
    setDanger({ ...danger, busy: true })
    const { error } = await supabase.from(TABLE).delete().gte('id', 0)
    setDanger({ word: '', busy: false })
    if (error) return setMsg('❌ ' + error.message)
    audit('delete_all_tasks', null, { tasks: rows.length }); setMsg('🗑 All tasks deleted — press “Create allotment” on Home to start again'); reload()
  }

  return (
    <>
      <PremiumCard title="Announcement" subtitle="Pinned on every teacher's Home screen until you clear it">
        <textarea className="px-input" rows={2} value={ann} onChange={e => setAnn(e.target.value)} maxLength={400} aria-label="Announcement text" placeholder="e.g. Submissions close on 28 Nov at 4 pm. Bring printed copies to the Head's office." />
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="px-btn gold" onClick={async () => { if (!ann.trim()) return setMsg('❌ Type the announcement first.'); if (await putSetting('announcement', ann.trim())) setMsg('✅ Announcement published') }}>Publish</button>
          <button className="px-btn ghost" onClick={async () => { await delSetting('announcement'); setAnn(''); setMsg('Announcement cleared') }}>Clear</button>
          <span style={{ fontSize: 12, color: PX.sub }}>{settings.announcement ? 'Live now.' : 'Nothing pinned.'} {ann.length}/400</span>
        </div>
      </PremiumCard>

      <PremiumCard title={`Approvals queue (${verified.length})`} subtitle="Sections verified by a colleague and waiting for approval" bodyStyle={{ padding: 0 }}
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="px-btn gold" onClick={() => bulkStatus(picked, 'Approved')}>Approve selected</button>
          <button className="px-btn ghost" onClick={() => bulkStatus(verified.map(r => r.id), 'Approved')}>Approve all verified</button>
          <button className="px-btn ghost" onClick={() => bulkStatus(picked, 'Submitted')}>Send selected back</button>
        </span>}>
        {!verified.length ? <div style={{ padding: 20, color: PX.sub, fontSize: 13 }}>🎉 Nothing is waiting for approval.</div> : verified.map(r => (
          <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: `1px solid ${PX.line}`, cursor: 'pointer' }}>
            <input type="checkbox" checked={picked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${taskLabel(r)}`} />
            <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{taskLabel(r)}</span>
            <PersonCell name={r.setter} size={26}>{fullName(r.setter)}</PersonCell>
            <span style={{ fontSize: 12, color: PX.sub }}>verified {r.verified_on || ''}{r.verifier ? ' by ' + fullName(r.verifier) : ''}</span>
          </label>))}
      </PremiumCard>

      <PremiumCard title="Locked papers" subtitle="A locked paper cannot be changed by anyone except admins — use it once a paper is final">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={lab}>Builder<select className="px-input" value={lockSel.series} onChange={e => setLockSel({ series: e.target.value, test: 1 })}>{SERIES.map(s => <option key={s[0]} value={s[0]}>{s[1]}</option>)}</select></label>
          <label style={lab}>Test<select className="px-input" value={lockSel.test} onChange={e => setLockSel({ ...lockSel, test: Number(e.target.value) })}>{SERIES.find(s => s[0] === lockSel.series)[2].map(t => <option key={t.no} value={t.no}>{SERIES.find(s => s[0] === lockSel.series)[3] === 'Set' ? 'Set ' + t.no : SERIES.find(s => s[0] === lockSel.series)[3] + '-' + String(t.no).padStart(2, '0')}</option>)}</select></label>
          <button className="px-btn gold" onClick={lockNow}>🔒 Lock paper</button>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!locks.length && <span style={{ fontSize: 13, color: PX.sub }}>No papers are locked.</span>}
          {locks.map(k => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Pill tone="gold">🔒 {lockLabel(k)}</Pill><button className="px-hbtn" onClick={async () => { await delSetting(k); setMsg('🔓 Unlocked') }}>Unlock</button></span>)}
        </div>
        <div style={{ fontSize: 12, color: PX.sub, marginTop: 8 }}>You can also lock the paper you are viewing from a builder's Paper tools.</div>
      </PremiumCard>

      <PremiumCard title="Database rules" subtitle="Keep the Syllabus Plan and the 25-question limit true even for anyone who calls the database directly">
        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer' }}>
          <input type="checkbox" checked={settings.enforce_plan === 'on'} style={{ marginTop: 4, width: 20, height: 20 }} onChange={async e => {
            if (e.target.checked) {
              if (!window.confirm('Switch on the database rules?\n\nNeeds migration 20261223 in Supabase. Pre Mock and Practice questions must then be on the planned chapter, and Pre Mock holds 25 per section. Existing questions are not changed.\n\nFirst run  select * from mission_sainik_plan_violations;  in the SQL editor to see which existing questions break the rules.')) return
              if (await putSetting('enforce_plan', 'on')) { audit('enforce_plan', null, { on: true }); setMsg('🔒 Database rules are ON') }
            } else if (await delSetting('enforce_plan')) { audit('enforce_plan', null, { on: false }); setMsg('Database rules are OFF') }
          }} />
          <span><b>Enforce the syllabus plan and the 25 limit in the database</b>
            <span style={{ display: 'block', fontSize: 12.5, color: PX.sub, marginTop: 3, lineHeight: 1.5 }}>Pre Mock and Practice questions must be on the chapter the plan gives that test (exactly one chapter), and a Pre Mock section holds 25 questions (per teacher while “multiple sets” is on). Who may upload is still checked by the app only. Run migration <code>20261223</code> in Supabase first.</span></span>
        </label>
        <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginTop: 16, paddingTop: 14, borderTop: `1px solid ${PX.line}` }}>
          <input type="checkbox" checked={settings.enforce_setters === 'on'} style={{ marginTop: 4, width: 20, height: 20 }} onChange={async e => {
            if (e.target.checked) {
              if (!window.confirm('Switch on setter rules in the database?\n\nNeeds migration 20261224 in Supabase. Then only the section\'s allotted setter can add Pre Mock, Mock and Practice questions (admins cannot), “uploaded by” is stamped by the database, and only admins can change who sets and verifies.\n\nFirst make sure: the panel is loaded (Panel → Load from notice), every staff member\'s login is linked to their staff profile, and every test and section has a setter in the allotment.')) return
              if (await putSetting('enforce_setters', 'on')) { audit('enforce_setters', null, { on: true }); setMsg('🔒 Setter rules are ON in the database') }
            } else if (await delSetting('enforce_setters')) { audit('enforce_setters', null, { on: false }); setMsg('Setter rules are OFF in the database') }
          }} />
          <span><b>Enforce setters in the database</b>
            <span style={{ display: 'block', fontSize: 12.5, color: PX.sub, marginTop: 3, lineHeight: 1.5 }}>Only the section’s allotted setter can add questions; the database stamps who uploaded them; only admins change who sets and verifies. A panel name that matches several staff identifies nobody. Run migration <code>20261224</code> first and check the panel, staff links and allotment as the prompt says.</span></span>
        </label>
      </PremiumCard>
      <PremiumCard title="Reminder to all teachers" subtitle="One message listing everyone's pending sections — paste it into your WhatsApp group"
        right={<span style={{ display: 'flex', gap: 8 }}><button className="px-hbtn" disabled={!reminder} onClick={() => copy(reminder)}>Copy</button><button className="px-hbtn" disabled={!reminder} onClick={() => window.open('https://wa.me/?text=' + encodeURIComponent(reminder), '_blank', 'noopener')}>💬 WhatsApp</button></span>}>
        {reminder ? <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', fontSize: 13, background: PX.tint, padding: 12, borderRadius: 12, maxHeight: 240, overflow: 'auto' }}>{reminder}</pre> : <div style={{ fontSize: 13, color: PX.sub }}>🎉 No pending sections.</div>}
      </PremiumCard>

      <PremiumCard title="Audit log" subtitle={`${shown.length} of ${auditRows.length} loaded entries (latest 150, cannot be edited or deleted)`}
        right={<span style={{ display: 'flex', gap: 8 }}><button className="px-hbtn" onClick={loadAudit}>Refresh</button><button className="px-hbtn" disabled={!shown.length} onClick={auditCsv}>⬇ CSV</button></span>} bodyStyle={{ padding: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 2fr', gap: 8, padding: '12px 16px' }}>
          <select className="px-input" value={fAct} onChange={e => setFAct(e.target.value)} aria-label="Filter by action"><option value="">All actions</option>{actions.map(a => <option key={a}>{a}</option>)}</select>
          <select className="px-input" value={fWho} onChange={e => setFWho(e.target.value)} aria-label="Filter by person"><option value="">Everyone</option>{who.map(a => <option key={a}>{a}</option>)}</select>
          <input className="px-input" type="search" value={fQ} onChange={e => setFQ(e.target.value)} aria-label="Search the log" placeholder="Search reference or detail…" />
        </div>
        {!auditRows.length ? <div style={{ padding: 16, color: PX.sub, fontSize: 13 }}>Press Refresh to load.</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table className="px-table" style={{ minWidth: 640 }}>
              <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Reference</th><th>Detail</th></tr></thead>
              <tbody>{shown.map(a => (
                <tr key={a.id}>
                  <td>{new Date(a.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td><PersonCell name={a.actor} size={26} /></td>
                  <td><Pill tone={/delete|purge|reset|bulk_send|unlock/.test(a.action) ? 'bad' : /verify|approve|create|publish/.test(a.action) ? 'ok' : /print|export|backup|lock/.test(a.action) ? 'gold' : 'info'}>{String(a.action).replace(/_/g, ' ')}</Pill></td>
                  <td style={{ color: PX.sub }}>{a.ref || ''}</td>
                  <td style={{ color: PX.sub, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.detail ? JSON.stringify(a.detail).slice(0, 80) : ''}</td>
                </tr>))}</tbody>
            </table>
          </div>)}
      </PremiumCard>

      <PremiumCard title="Backup" subtitle="Download everything in this module as one JSON file — tasks, material records, syllabus, marks, panel, settings, sign-offs, questions (with answers) and paper settings"
        right={<button className="px-btn gold" onClick={backup}>⬇ Download backup</button>}>
        <div style={{ fontSize: 12.5, color: PX.sub }}>The file contains unreleased questions and answers — store it safely and do not share it. Uploaded files and figures-as-files are not included; figures are inside the questions.</div>
      </PremiumCard>

      <PremiumCard title="Danger zone" subtitle="Admins only · both actions are recorded in the audit log">
        <label style={lab}>Type the word to unlock a button
          <input className="px-input" value={danger.word} onChange={e => setDanger({ ...danger, word: e.target.value })} placeholder="RESET or DELETE" aria-label="Confirmation word" style={{ maxWidth: 240 }} />
        </label>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="px-btn ghost" disabled={danger.busy || danger.word !== 'RESET'} style={{ color: PX.bad }} onClick={resetStatuses}>Reset all {rows.length} tasks to Pending</button>
          <button className="px-btn ghost" disabled={danger.busy || danger.word !== 'DELETE'} style={{ color: PX.bad }} onClick={deleteAllTasks}>Delete all {rows.length} tasks</button>
        </div>
        <div style={{ fontSize: 12, color: PX.sub, marginTop: 8 }}>Questions, material, marks and the panel are not touched. Download a backup first.</div>
      </PremiumCard>
    </>
  )
}

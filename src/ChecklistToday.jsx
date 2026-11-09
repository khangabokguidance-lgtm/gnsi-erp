// ChecklistToday.jsx — the "Today" tab of Checklist: every teacher's own task list for the
// day plus the material prepared for that day's classes (Navodaya / Sainik / Foundation).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { NEW_RECORD_BATCHES } from './courseMap'
import { printPremium } from './lib/printPremium'
import {
  COURSES, KINDS, dateKey, shiftDate, dayLabel, buildTask, buildMaterial, groupByCourse, progress,
  carryOver, dropDuplicates, loadDay, addTasks, addMaterial, setTaskDone, deleteTask, deleteMaterial,
  uploadMaterialFile,
} from './lib/dailyTasks'

const SUBJECTS = ['Maths', 'English', 'Science', 'Social Science', 'Hindi', 'EVS', 'Reasoning', 'GK', 'Mental Ability', 'Language']
const COL = { Navodaya: '#2563eb', Sainik: '#15803d', Foundation: '#b45309' }
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const css = `
.ct{font-family:inherit;color:#0f1b2e;padding-bottom:20px}
.ct *{box-sizing:border-box}
.ct .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0}
.ct button{font-family:inherit;cursor:pointer}
.ct .btn{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600;min-height:38px}
.ct .btn.pri{background:#0f1b2e;color:#fff;border-color:#0f1b2e}
.ct .btn.sm{padding:4px 9px;min-height:30px;font-size:12px}
.ct .chip{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:6px 13px;font-size:13px;font-weight:600}
.ct .chip.on{background:#0f1b2e;color:#fff;border-color:#0f1b2e}
.ct .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin-bottom:12px}
.ct .ch{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.ct .ch h3{margin:0;font-size:16px}
.ct .row{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #f1f5f9}
.ct .row input[type=checkbox]{width:22px;height:22px;margin-top:2px;flex:none}
.ct .done .tt{text-decoration:line-through;color:#94a3b8}
.ct .meta{font-size:12px;color:#64748b}
.ct .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.ct input,.ct select,.ct textarea{font-family:inherit;font-size:14px;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;width:100%;background:#fff}
.ct textarea{min-height:70px}
.ct .prog{height:8px;background:#e2e8f0;border-radius:99px;overflow:hidden}
.ct .prog i{display:block;height:100%;background:#16a34a}
.ct .note{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:9px 12px;font-size:13px;margin:10px 0}
.ct .mat{display:flex;gap:8px;align-items:flex-start;padding:7px 0;border-top:1px solid #f1f5f9;font-size:14px}
.ct .mat a{color:#2563eb;word-break:break-all}
.ct .mat pre{white-space:pre-wrap;margin:3px 0 0;font:inherit;color:#334155}
.ct .x{border:none;background:none;color:#94a3b8;font-size:16px;padding:2px 6px}
.ct .tabs2{display:flex;gap:6px;margin-bottom:8px}
`

export default function ChecklistToday({ userName, canSeeAll = false, institute = null }) {
  const today = dateKey()
  const [date, setDate] = useState(today)
  const [course, setCourse] = useState('All')
  const [everyone, setEveryone] = useState(false)
  const [state, setState] = useState({ tasks: [], mats: [], mode: 'cloud', note: '' })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(null) // 'task' | 'mat'
  const [draft, setDraft] = useState({})
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  const flash = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(''), 2600) }, [])
  const refresh = () => setTick((n) => n + 1)

  useEffect(() => {
    let live = true
    loadDay(date, userName, { everyone: everyone && canSeeAll })
      .then((r) => { if (live) { setState(r); setLoading(false) } })
      .catch((e) => { if (live) { setLoading(false); setMsg('⚠️ ' + (e.message || 'Could not load')) } })
    return () => { live = false }
  }, [date, userName, everyone, canSeeAll, tick])

  const { tasks, mats, mode } = state
  const groups = useMemo(() => groupByCourse(tasks, mats, course), [tasks, mats, course])
  const prog = progress(course === 'All' ? tasks : tasks.filter((t) => t.course === course))
  const mine = (row) => String(row.owner_name || '').trim().toLowerCase() === userName.trim().toLowerCase()

  const open = (kind) => { setForm(kind); setDraft({ course: course === 'All' ? '' : course, kind: 'note' }) }
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v, ...(k === 'course' ? { batch: '' } : {}) }))

  const save = async () => {
    setBusy(true)
    try {
      if (form === 'task') {
        const b = buildTask(draft, userName, date)
        if (!b.ok) return flash('⚠️ ' + b.error)
        await addTasks([b.row], mode)
      } else {
        let d = draft
        if (draft.kind === 'file') {
          if (!draft.file) return flash('⚠️ Choose a file to upload.')
          if (mode === 'local') return flash('⚠️ File upload needs the migration — use a link or note for now.')
          const url = await uploadMaterialFile(draft.file, userName)
          d = { ...draft, url, file_name: draft.file.name }
        }
        const b = buildMaterial(d, userName, date)
        if (!b.ok) return flash('⚠️ ' + b.error)
        await addMaterial(b.row, mode)
      }
      setForm(null); flash('✅ Saved'); refresh()
    } catch (e) { flash('⚠️ ' + (e.message || 'Could not save')) } finally { setBusy(false) }
  }

  const toggle = async (t) => {
    setState((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === t.id ? { ...x, done: !t.done } : x)) }))
    try { await setTaskDone(t.id, !t.done, mode) } catch (e) { flash('⚠️ ' + e.message); refresh() }
  }
  const del = async (kind, id) => {
    if (!window.confirm('Delete this?')) return
    try { await (kind === 'task' ? deleteTask(id, mode) : deleteMaterial(id, mode)); refresh() } catch (e) { flash('⚠️ ' + e.message) }
  }

  const bringYesterday = async () => {
    try {
      const prev = await loadDay(shiftDate(date, -1), userName)
      const fresh = dropDuplicates(carryOver(prev.tasks, date), tasks.filter(mine))
      if (!fresh.length) return flash('Nothing pending from the previous day.')
      await addTasks(fresh, mode); flash(`✅ ${fresh.length} pending task${fresh.length > 1 ? 's' : ''} brought forward`); refresh()
    } catch (e) { flash('⚠️ ' + e.message) }
  }

  const print = () => {
    const body = groups.map((g) => `
      <div class="box"><h3 style="margin:0 0 6px">${esc(g.course)} <span class="pill">${g.done}/${g.total} done</span></h3>
      ${g.tasks.length ? `<table class="t"><tr><th>✓</th><th>Task</th><th>Batch</th><th>Subject</th>${everyone ? '<th>Teacher</th>' : ''}</tr>${g.tasks.map((t) =>
        `<tr><td>${t.done ? '☑' : '☐'}</td><td>${esc(t.title)}${t.notes ? `<br><small>${esc(t.notes)}</small>` : ''}</td><td>${esc(t.batch)}</td><td>${esc(t.subject)}</td>${everyone ? `<td>${esc(t.owner_name)}</td>` : ''}</tr>`).join('')}</table>` : ''}
      ${g.mats.length ? `<p style="margin:8px 0 3px"><b>Material for today</b></p><table class="t">${g.mats.map((m) =>
        `<tr><td>${esc(m.title)}${m.subject ? ` · ${esc(m.subject)}` : ''}${m.batch ? ` · ${esc(m.batch)}` : ''}</td><td>${m.kind === 'note' ? esc(m.body) : esc(m.file_name || m.url)}</td></tr>`).join('')}</table>` : ''}
      </div>`).join('')
    printPremium(`<div class="title">Today's Task Sheet</div><div class="sub">${esc(everyone ? 'All teachers' : userName)} · ${esc(dayLabel(date, today))} · ${esc(date)}</div>${body || '<p class="note">Nothing planned for this day.</p>'}`,
      { title: "Today's Task Sheet", institute: institute || undefined, docLabel: "Today's Task Sheet" })
  }

  const batches = draft.course ? NEW_RECORD_BATCHES[draft.course] || [] : []

  return (
    <div className="ct">
      <style>{css}</style>
      <div className="bar">
        <button className="btn" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day">‹</button>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
        <button className="btn" onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day">›</button>
        {date !== today && <button className="btn" onClick={() => setDate(today)}>Today</button>}
        <b style={{ fontSize: 17 }}>{dayLabel(date, today)}</b>
        <span style={{ flex: 1 }} />
        <button className="btn pri" onClick={() => open('task')}>＋ Task</button>
        <button className="btn pri" onClick={() => open('mat')}>＋ Material</button>
      </div>

      <div className="bar" style={{ marginTop: 0 }}>
        {['All', ...COURSES].map((c) => <button key={c} className={'chip' + (course === c ? ' on' : '')} onClick={() => setCourse(c)}>{c}</button>)}
        <span style={{ flex: 1 }} />
        {canSeeAll && <label className="meta" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" style={{ width: 18 }} checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />All teachers</label>}
        <button className="btn sm" onClick={bringYesterday}>↪ Bring pending from yesterday</button>
        <button className="btn sm" onClick={print}>🖨 Print</button>
      </div>

      {state.note && <div className="note">{state.note}</div>}
      {msg && <div className="note" role="status">{msg}</div>}

      <div className="card">
        <div className="ch"><b>{prog.done} of {prog.total} tasks done</b><span className="meta">{prog.pct}%</span></div>
        <div className="prog"><i style={{ width: prog.pct + '%' }} /></div>
      </div>

      {form && (
        <div className="card" style={{ borderColor: '#0f1b2e' }}>
          <div className="ch"><h3>{form === 'task' ? 'New task' : 'Store material'}</h3><button className="x" onClick={() => setForm(null)} aria-label="Close">✕</button></div>
          <div className="grid">
            <select value={draft.course || ''} onChange={(e) => set('course', e.target.value)} aria-label="Course"><option value="">Course…</option>{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={draft.batch || ''} onChange={(e) => set('batch', e.target.value)} aria-label="Batch"><option value="">All batches</option>{batches.map((b) => <option key={b}>{b}</option>)}</select>
            <input list="ct-subj" placeholder="Subject" value={draft.subject || ''} onChange={(e) => set('subject', e.target.value)} />
            <datalist id="ct-subj">{SUBJECTS.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
          <div style={{ marginTop: 8 }}>
            <input placeholder={form === 'task' ? 'What needs to be done? e.g. Teach Ch 4 – Fractions' : 'Title e.g. Fractions worksheet'} value={draft.title || ''} onChange={(e) => set('title', e.target.value)} />
          </div>
          {form === 'task' ? (
            <div style={{ marginTop: 8 }}><textarea placeholder="Notes (optional)" value={draft.notes || ''} onChange={(e) => set('notes', e.target.value)} /></div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <div className="tabs2">{KINDS.map((k) => <button key={k.id} className={'chip' + (draft.kind === k.id ? ' on' : '')} onClick={() => set('kind', k.id)}>{k.icon} {k.label}</button>)}</div>
              {draft.kind === 'note' && <textarea placeholder="Write the note, questions, key points…" value={draft.body || ''} onChange={(e) => set('body', e.target.value)} />}
              {draft.kind === 'link' && <input placeholder="Paste a link (Drive, YouTube, website…)" value={draft.url || ''} onChange={(e) => set('url', e.target.value)} />}
              {draft.kind === 'file' && <input type="file" onChange={(e) => set('file', e.target.files?.[0] || null)} />}
            </div>
          )}
          <div className="bar" style={{ marginBottom: 0 }}>
            <button className="btn pri" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="meta">Loading…</p> : groups.length === 0 ? (
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ margin: '6px 0' }}><b>Nothing planned for {dayLabel(date, today).toLowerCase()}.</b></p>
          <p className="meta">Add a task for a class, or store the material you prepared for it.</p>
        </div>
      ) : groups.map((g) => (
        <div className="card" key={g.course} style={{ borderLeft: `5px solid ${COL[g.course]}` }}>
          <div className="ch"><h3>{g.course}</h3><span className="meta">{g.done}/{g.total} tasks · {g.mats.length} material</span></div>
          {g.tasks.map((t) => (
            <div key={t.id} className={'row' + (t.done ? ' done' : '')}>
              <input type="checkbox" checked={!!t.done} disabled={!mine(t)} onChange={() => toggle(t)} aria-label={'Done: ' + t.title} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tt" style={{ fontWeight: 600 }}>{t.title}</div>
                <div className="meta">{[t.batch, t.subject, everyone && t.owner_name].filter(Boolean).join(' · ')}</div>
                {t.notes && <div className="meta" style={{ color: '#334155' }}>{t.notes}</div>}
              </div>
              {mine(t) && <button className="x" onClick={() => del('task', t.id)} aria-label="Delete task">🗑</button>}
            </div>
          ))}
          {g.mats.length > 0 && <div className="meta" style={{ marginTop: 8, fontWeight: 700 }}>📚 Material for today</div>}
          {g.mats.map((m) => (
            <div key={m.id} className="mat">
              <span>{(KINDS.find((k) => k.id === m.kind) || KINDS[0]).icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{m.title}</b> <span className="meta">{[m.batch, m.subject, everyone && m.owner_name].filter(Boolean).join(' · ')}</span>
                {m.kind === 'note' ? <pre>{m.body}</pre> : <div><a href={m.url} target="_blank" rel="noopener noreferrer">{m.kind === 'file' ? (m.file_name || 'Open file') : m.url}</a></div>}
              </div>
              {mine(m) && <button className="x" onClick={() => del('mat', m.id)} aria-label="Delete material">🗑</button>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ClassMaterial.jsx — Learning Hub → Class Material. The admin uploads study material and test-series papers
// (PDF / images) by course and subject; staff open them for class use in a view-only viewer (no download).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { isAdminRole } from './roles'
import { NEW_RECORD_BATCHES } from './courseMap'
import { loggedInName } from './lib/collector'
import { loadMaterials, uploadMaterial, setActive, removeMaterial } from './lib/classMaterialStore'
import { COURSES, KINDS, SUBJECTS, buildMaterial, subjectSummary, subjectContent, searchRows, fmtSize } from './lib/classMaterialLogic'
import SecureViewer from './SecureViewer'

const COL = { Navodaya: '#2563eb', Sainik: '#15803d', Foundation: '#b45309' }
const css = `
.cmx{font-family:inherit;color:#0f1b2e;padding:4px 0 24px}.cmx *{box-sizing:border-box}
.cmx .bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:10px 0}
.cmx button{font-family:inherit;cursor:pointer}
.cmx .chip{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 15px;font-size:13px;font-weight:700;min-height:38px}
.cmx .chip.on{background:#0f1b2e;color:#fff;border-color:#0f1b2e}
.cmx .btn{border:1px solid #cbd5e1;background:#fff;border-radius:10px;padding:8px 13px;font-size:13px;font-weight:600;min-height:38px}
.cmx .btn.pri{background:#0f1b2e;color:#fff;border-color:#0f1b2e}.cmx .btn.sm{min-height:30px;padding:3px 9px;font-size:12px}
.cmx .btn.red{color:#b91c1c;border-color:#fecaca}
.cmx .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
.cmx .subj{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;text-align:left;border-top:4px solid var(--c)}
.cmx .subj b{display:block;font-size:16px;margin-bottom:4px}.cmx .meta{font-size:12px;color:#64748b}
.cmx .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:10px}
.cmx .item{display:flex;gap:10px;align-items:center;padding:9px 0;border-top:1px solid #f1f5f9;flex-wrap:wrap}
.cmx .item:first-of-type{border-top:none}
.cmx .item .t{flex:1;min-width:150px}.cmx .item .t b{font-size:14px}
.cmx input,.cmx select,.cmx textarea{font-family:inherit;font-size:14px;border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;width:100%;background:#fff}
.cmx .form{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
.cmx .note{background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:9px 12px;font-size:13px;margin:8px 0}
.cmx .tag{display:inline-block;border-radius:10px;padding:1px 8px;font-size:11px;font-weight:700;background:#eef2ff;color:#3730a3}
.cmx .tag.off{background:#fee2e2;color:#991b1b}
.cmx h3{margin:0 0 6px;font-size:16px}
`

export default function ClassMaterial({ currentUser }) {
  const isAdmin = isAdminRole(currentUser?.role)
  const who = loggedInName(currentUser)
  const [state, setState] = useState({ rows: [], setup: false })
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [course, setCourse] = useState('Navodaya')
  const [batch, setBatch] = useState('')
  const [subject, setSubject] = useState(null)
  const [q, setQ] = useState('')
  const [show, setShow] = useState(null)       // item open in the viewer
  const [form, setForm] = useState(null)       // upload draft
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)

  const flash = useCallback((m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }, [])
  useEffect(() => {
    let live = true
    loadMaterials().then((r) => { if (live) { setState(r); setLoading(false) } }).catch((e) => { if (live) { setLoading(false); setMsg('⚠️ ' + e.message) } })
    return () => { live = false }
  }, [tick])

  // staff see only what is switched on; the admin sees everything (hidden items marked)
  const rows = useMemo(() => (isAdmin ? state.rows.map((r) => r) : state.rows.filter((r) => r.active !== false)), [state.rows, isAdmin])
  const cards = useMemo(() => subjectSummary(isAdmin ? rows.map((r) => ({ ...r, active: true })) : rows, course, batch), [rows, course, batch, isAdmin])
  const content = useMemo(() => (subject ? subjectContent(isAdmin ? rows.map((r) => ({ ...r, _off: r.active === false, active: true })) : rows, course, subject, batch) : null), [rows, course, subject, batch, isAdmin])
  const found = useMemo(() => (q.trim() ? searchRows(rows.filter((r) => isAdmin || r.active !== false), q) : null), [q, rows, isAdmin])

  const pickCourse = (c) => { setCourse(c); setSubject(null); setBatch(''); setQ('') }
  const startUpload = () => setForm({ kind: 'material', course, batch: '', subject: subject || '', title: '', series_name: '', test_no: '', description: '', file: null })
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v, ...(k === 'course' ? { batch: '', subject: '' } : {}) }))

  const save = async () => {
    const b = buildMaterial(form, form.file, who)
    if (!b.ok) return flash('⚠️ ' + b.error)
    setBusy(true)
    try { await uploadMaterial(b.row, form.file); setForm(null); flash('✅ Uploaded — staff can now view it'); setTick((n) => n + 1) }
    catch (e) { flash('⚠️ ' + (e.message || 'Upload failed')) } finally { setBusy(false) }
  }
  const toggle = async (r) => { try { await setActive(r.id, r.active === false); setTick((n) => n + 1) } catch (e) { flash('⚠️ ' + e.message) } }
  const del = async (r) => { if (!window.confirm(`Delete “${r.title}” permanently?`)) return; try { await removeMaterial(r); flash('Deleted'); setTick((n) => n + 1) } catch (e) { flash('⚠️ ' + e.message) } }

  const Item = ({ r }) => (
    <div className="item">
      <span style={{ fontSize: 22 }}>{r.file_type === 'image' ? '🖼️' : '📄'}</span>
      <div className="t">
        <b>{r.test_no ? `Test ${r.test_no} · ` : ''}{r.title}</b> {r.active === false && <span className="tag off">hidden from staff</span>}
        <div className="meta">{[r.batch, fmtSize(r.file_size), r.description].filter(Boolean).join(' · ')}</div>
      </div>
      <button className="btn pri sm" onClick={() => setShow(r)}>👁 View</button>
      {isAdmin && <>
        <button className="btn sm" onClick={() => toggle(r)}>{r.active === false ? 'Show' : 'Hide'}</button>
        <button className="btn sm red" onClick={() => del(r)} aria-label="Delete">🗑</button>
      </>}
    </div>
  )

  const subjects = form ? (SUBJECTS[form.course] || []) : []
  const seriesNames = [...new Set(state.rows.filter((r) => r.kind === 'test_series' && r.course === form?.course).map((r) => r.series_name))]

  return (
    <div className="cmx">
      <style>{css}</style>
      <div className="card" style={{ background: '#f8fafc' }}>
        <h3>📚 Class Material &amp; Test Series</h3>
        <div className="meta">Study material and test papers for classroom use, by course and subject. {isAdmin ? 'You upload; staff can only view them on screen.' : 'Open a file to view it on screen — downloading and printing are switched off.'}</div>
      </div>

      {state.setup && <div className="note">⚙️ Class Material is not set up yet — run <b>supabase/migrations/20261056_class_materials.sql</b> in Supabase.</div>}
      {msg && <div className="note" role="status">{msg}</div>}

      <div className="bar">
        {COURSES.map((c) => <button key={c} className={'chip' + (course === c ? ' on' : '')} onClick={() => pickCourse(c)}>{c}</button>)}
        <select style={{ width: 160 }} value={batch} onChange={(e) => { setBatch(e.target.value); setSubject(null) }} aria-label="Class">
          <option value="">All classes</option>{(NEW_RECORD_BATCHES[course] || []).map((b) => <option key={b}>{b}</option>)}
        </select>
        <input style={{ flex: 1, minWidth: 160 }} placeholder="🔍 Search title, subject, test series…" value={q} onChange={(e) => setQ(e.target.value)} />
        {isAdmin && !state.setup && <button className="btn pri" onClick={startUpload}>＋ Upload</button>}
      </div>

      {form && (
        <div className="card" style={{ borderColor: '#0f1b2e' }}>
          <h3>Upload for class use</h3>
          <div className="bar" style={{ marginTop: 0 }}>{KINDS.map((k) => <button key={k.id} className={'chip' + (form.kind === k.id ? ' on' : '')} onClick={() => setF('kind', k.id)}>{k.icon} {k.label}</button>)}</div>
          <div className="form">
            <select value={form.course} onChange={(e) => setF('course', e.target.value)} aria-label="Course">{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
            <select value={form.batch} onChange={(e) => setF('batch', e.target.value)} aria-label="Class for upload"><option value="">All classes</option>{(NEW_RECORD_BATCHES[form.course] || []).map((b) => <option key={b}>{b}</option>)}</select>
            <input list="cm-subj" placeholder="Subject (pick or type)" value={form.subject} onChange={(e) => setF('subject', e.target.value)} />
            <datalist id="cm-subj">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
            <input placeholder="Title e.g. Fractions — Chapter 4" value={form.title} onChange={(e) => setF('title', e.target.value)} />
            {form.kind === 'test_series' && <>
              <input list="cm-series" placeholder="Test series name e.g. Navodaya Series 2026" value={form.series_name} onChange={(e) => setF('series_name', e.target.value)} />
              <datalist id="cm-series">{seriesNames.map((s) => <option key={s} value={s} />)}</datalist>
              <input type="number" min="1" placeholder="Test no." value={form.test_no} onChange={(e) => setF('test_no', e.target.value)} />
            </>}
          </div>
          <div style={{ marginTop: 8 }}><input placeholder="Note for teachers (optional)" value={form.description} onChange={(e) => setF('description', e.target.value)} /></div>
          <div style={{ marginTop: 8 }}><input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*" onChange={(e) => setF('file', e.target.files?.[0] || null)} /></div>
          <div className="meta" style={{ marginTop: 4 }}>PDF or image, up to 40 MB. Staff will only be able to view it on screen.</div>
          <div className="bar"><button className="btn pri" disabled={busy} onClick={save}>{busy ? 'Uploading…' : 'Upload'}</button><button className="btn" onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}

      {loading ? <p className="meta">Loading…</p> : found ? (
        <div className="card"><h3>{found.length} result{found.length === 1 ? '' : 's'}</h3>{found.length ? found.map((r) => <div key={r.id}><div className="meta" style={{ marginTop: 6 }}>{r.course} · {r.subject}{r.series_name ? ` · ${r.series_name}` : ''}</div><Item r={r} /></div>) : <p className="meta">Nothing matches.</p>}</div>
      ) : !subject ? (
        cards.length ? <div className="grid">{cards.map((s) => (
          <button key={s.subject} className="subj" style={{ '--c': COL[course] }} onClick={() => setSubject(s.subject)}>
            <b>{s.subject}</b><span className="meta">{s.materials} material{s.materials === 1 ? '' : 's'} · {s.tests} test{s.tests === 1 ? '' : 's'}</span>
          </button>))}</div>
          : <div className="card" style={{ textAlign: 'center' }}><p><b>No material for {course}{batch ? ` · ${batch}` : ''} yet.</b></p><p className="meta">{isAdmin ? 'Use “＋ Upload” to add study material or a test series.' : 'The admin has not uploaded anything here yet.'}</p></div>
      ) : (
        <div>
          <div className="bar" style={{ marginTop: 0 }}><button className="btn" onClick={() => setSubject(null)}>‹ All subjects</button><h3 style={{ margin: 0 }}>{course} · {subject}</h3></div>
          {content.materials.length > 0 && <div className="card"><h3>📘 Study material</h3>{content.materials.map((r) => <Item key={r.id} r={{ ...r, active: r._off ? false : true }} />)}</div>}
          {content.series.map((s) => <div className="card" key={s.name}><h3>📝 {s.name}</h3>{s.tests.map((r) => <Item key={r.id} r={{ ...r, active: r._off ? false : true }} />)}</div>)}
          {!content.materials.length && !content.series.length && <p className="meta">Nothing in this subject.</p>}
        </div>
      )}
      {show && <SecureViewer item={show} viewer={who} onClose={() => setShow(null)} />}
    </div>
  )
}

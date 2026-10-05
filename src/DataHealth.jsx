import { useMemo, useState } from 'react'
import { PremiumStyles, PremiumHero, PremiumCard, PX } from './premiumUI'
import { editField } from './editEngine'
import { QUICK_FIXES, validateQuickFix } from './lib/dataHealthFix'

// Student data health dashboard: read-only checks over active students.

const NAVY = '#1e3a6e'
const s = v => String(v ?? '').trim()
const digitsOf = v => String(v ?? '').replace(/\D/g, '')

// Local copy of getParentPhone (src/Fees.jsx) — returns the raw digits on file.
function parentPhoneDigits(st) {
  const raw = st.guardian_phone || st.father_phone || st.mother_phone || st.parent_phone ||
    st.guardian_mobile || st.mobile || st.phone || st.contact_no || st.contact_number || ''
  return digitsOf(raw)
}

const CHECKS = [
  { key: 'gcc_missing', label: 'Missing / invalid GCC', fix: 'Students module → Edit student → set a numeric GCC No.' },
  { key: 'gcc_dup', label: 'Duplicate GCC', fix: 'Students module → find both records and correct or merge; GCC must be unique.' },
  { key: 'course', label: 'Missing course', fix: 'Students module → Edit student → choose Course.' },
  { key: 'batch', label: 'Missing batch / class', fix: 'Students module → Edit student → set Batch / Class.' },
  { key: 'hostel', label: 'Missing hostel type', fix: 'Students module → Edit student → set Hostel Type (Boarder / Day Boarder / Day Scholar).' },
  { key: 'adm_missing', label: 'Missing admission date', fix: 'Students module → Edit student → set Admission Date (fee dues depend on it).' },
  { key: 'adm_future', label: 'Future admission date', fix: 'Students module → Edit student → correct the Admission Date (it is after today).' },
  { key: 'phone_missing', label: 'Missing parent phone', fix: 'Students module → Edit student → add Parent / Guardian phone.' },
  { key: 'phone_invalid', label: 'Invalid phone (not 10 digits)', fix: 'Students module → Edit student → re-enter a 10-digit mobile number.' },
  { key: 'name', label: 'Missing name', fix: 'Students module → Edit student → enter the full name.' },
  { key: 'repeater', label: 'Repeater without admission date', fix: 'Students module → Edit student → set the Admission Date for the repeater.' },
  { key: 'photo', label: 'Photo missing', fix: 'Students module → open student → upload a photo.' },
  { key: 'dup_name_phone', label: 'Duplicate name + phone', fix: 'Students module → check whether the same student was entered twice.' },
]

function runChecks(list, todayStr) {
  const gccCount = {}, npCount = {}
  for (const st of list) {
    const g = s(st.gcc_no); if (g) gccCount[g] = (gccCount[g] || 0) + 1
    const ph = parentPhoneDigits(st).slice(-10)
    if (s(st.name) && ph.length === 10) { const k = `${s(st.name).toLowerCase()}|${ph}`; npCount[k] = (npCount[k] || 0) + 1 }
  }
  return list.map(st => {
    const f = []
    const g = s(st.gcc_no)
    if (!g || !/^\d+$/.test(g) || Number(g) <= 0) f.push('gcc_missing')
    if (g && gccCount[g] > 1) f.push('gcc_dup')
    if (!s(st.course)) f.push('course')
    if (!s(st.batch) && !s(st.class_name)) f.push('batch')
    if (!s(st.hostel_type)) f.push('hostel')
    const ad = s(st.admission_date).slice(0, 10)
    if (!ad) f.push('adm_missing')
    else if (ad > todayStr) f.push('adm_future')
    const pd = parentPhoneDigits(st)
    if (!pd) f.push('phone_missing')
    else {
      const core = pd.length === 12 && pd.startsWith('91') ? pd.slice(2) : pd
      if (core.length !== 10) f.push('phone_invalid')
    }
    if (!s(st.name)) f.push('name')
    if (st.is_repeater && !ad) f.push('repeater')
    if (!s(st.photo_url) && !s(st.photo_path)) f.push('photo')
    const ph = pd.slice(-10)
    if (s(st.name) && ph.length === 10 && npCount[`${s(st.name).toLowerCase()}|${ph}`] > 1) f.push('dup_name_phone')
    return { st, fails: f }
  })
}

function downloadCsv(rows, filename) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

const TODAY = () => new Date().toLocaleDateString('en-CA')

// One row's "Quick fix" panel — one input per fixable failed check. Writes go
// through editEngine.editField (audit log + admissions sync), never straight to
// the table, so a fix here leaves the same trail as a fix in Student 360.
function QuickFix({ st, fails, onSaved }) {
  const fixable = fails.filter(k => QUICK_FIXES[k])
  const [vals, setVals] = useState({})
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState({})
  if (!fixable.length) return <div style={{ fontSize: 12, color: PX.sub }}>These issues need a manual fix in the Students module (open the student and correct them there).</div>

  const save = async k => {
    const fix = QUICK_FIXES[k]
    const v = validateQuickFix(k, vals[k], TODAY())
    if (!v.ok) { setErr(e => ({ ...e, [k]: v.error })); return }
    setBusy(k); setErr(e => ({ ...e, [k]: null }))
    try {
      await editField({ tableKey: 'students', rowId: st.id, field: fix.field, oldValue: st[fix.field] ?? null, newValue: v.value, studentContext: { id: st.id, name: st.name, gcc_no: st.gcc_no } })
      onSaved(st.id, fix.field, v.value)
    } catch (e) {
      setErr(x => ({ ...x, [k]: e?.message || 'Save failed — try again.' }))
    }
    setBusy(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 12 }}>
      {fixable.map(k => {
        const fix = QUICK_FIXES[k]
        const set = v => setVals(x => ({ ...x, [k]: v }))
        const common = { value: vals[k] ?? '', onChange: e => set(e.target.value), className: 'px-input', 'aria-label': fix.label, disabled: busy === k }
        return (
          <div key={k}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: PX.sub, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>{fix.label}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {fix.type === 'select'
                ? <select {...common}><option value="">Choose…</option>{fix.options.map(o => <option key={o}>{o}</option>)}</select>
                : <input {...common} type={fix.type === 'date' ? 'date' : 'text'} placeholder={fix.type === 'text' ? `Enter ${fix.label.toLowerCase()}` : undefined} onKeyDown={e => e.key === 'Enter' && save(k)} />}
              <button type="button" className="px-btn" disabled={busy === k || !String(vals[k] ?? '').trim()} onClick={() => save(k)}>{busy === k ? 'Saving…' : 'Save'}</button>
            </div>
            {err[k] && <div role="alert" style={{ marginTop: 5, fontSize: 11.5, color: PX.bad }}>{err[k]}</div>}
          </div>
        )
      })}
    </div>
  )
}

export default function DataHealth({ students = [], isAdmin, embedded = false }) {
  const [filter, setFilter] = useState(null)
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const [patches, setPatches] = useState({})   // id -> { column: value } applied after a successful quick fix
  const [toast, setToast] = useState(null)

  const result = useMemo(() => {
    const active = (students || [])
      .filter(x => !x.deleted_at && (!s(x.status) || s(x.status).toLowerCase() === 'active'))
      .map(x => (patches[x.id] ? { ...x, ...patches[x.id] } : x))
    const rows = runChecks(active, TODAY())
    const counts = {}
    for (const r of rows) for (const k of r.fails) counts[k] = (counts[k] || 0) + 1
    const withIssues = rows.filter(r => r.fails.length)
    return { total: rows.length, counts, withIssues }
  }, [students, patches])

  if (!isAdmin) return <div style={{ padding: 48, textAlign: 'center', color: PX.faint }}>🔒 Admin only</div>

  const label = k => CHECKS.find(c => c.key === k)?.label || k
  const score = result.total ? Math.round(((result.total - result.withIssues.length) / result.total) * 100) : 100
  const scoreTone = score >= 90 ? '#86efac' : score >= 70 ? '#fcd34d' : '#fca5a5'
  const needle = q.trim().toLowerCase()
  const shown = result.withIssues.filter(r => {
    if (filter && !r.fails.includes(filter)) return false
    return !needle || [r.st.name, r.st.gcc_no, r.st.course, r.st.batch, r.st.class_name].some(v => s(v).toLowerCase().includes(needle))
  })
  const activeCheck = CHECKS.find(c => c.key === filter)
  const failing = CHECKS.filter(c => result.counts[c.key]).length

  const onSaved = (id, field, value) => {
    setPatches(p => ({ ...p, [id]: { ...p[id], [field]: value } }))
    setToast('Saved — record re-checked.')
    setTimeout(() => setToast(null), 2500)
  }

  const exportCsv = () => downloadCsv(shown.map(r => ({
    gcc_no: r.st.gcc_no ?? '', name: r.st.name ?? '', course: r.st.course ?? '', batch: r.st.batch || r.st.class_name || '',
    hostel_type: r.st.hostel_type ?? '', admission_date: r.st.admission_date ?? '', issues: r.fails.map(label).join('; '),
  })), 'student_data_health.csv')

  return (
    <div className="px-root" style={{ minHeight: 0, background: 'transparent' }}>
      <PremiumStyles />
      {!embedded && (
      <PremiumHero eyebrow="GNSI · Data quality" title="Student data health"
        subtitle={`Automatic checks on ${result.total} active students — fix simple gaps right here`}
        icon={<span style={{ fontSize: 24 }}>🩺</span>}
        actions={<button className="px-hbtn" disabled={!shown.length} onClick={exportCsv}>⬇ Export CSV</button>}
        stats={[
          { label: 'Health score', value: `${score}%`, sub: 'students with no issues', tone: scoreTone },
          { label: 'Clean', value: result.total - result.withIssues.length, sub: `of ${result.total}` },
          { label: 'Need attention', value: result.withIssues.length, sub: 'students', tone: result.withIssues.length ? '#fca5a5' : undefined },
          { label: 'Checks failing', value: failing, sub: `of ${CHECKS.length}`, tone: failing ? '#fcd34d' : undefined },
        ]} />
      )}

      {toast && <div role="status" style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 50, background: PX.ok, color: '#fff', padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, boxShadow: '0 12px 28px -12px rgba(0,0,0,.4)' }}>✓ {toast}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 10, marginBottom: 16 }}>
        {CHECKS.map(c => {
          const cnt = result.counts[c.key] || 0
          const on = filter === c.key
          const fixable = !!QUICK_FIXES[c.key]
          return (
            <button key={c.key} type="button" aria-pressed={on} onClick={() => { setFilter(on ? null : c.key); setOpen(null) }} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: 14, cursor: 'pointer', fontFamily: 'inherit',
              border: `1px solid ${on ? PX.navy : PX.line}`, background: on ? '#eef2fa' : '#fff',
              boxShadow: on ? '0 0 0 3px rgba(19,42,79,.08)' : '0 1px 2px rgba(19,42,79,.05)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: PX.serif, fontSize: 24, fontWeight: 600, color: cnt ? PX.bad : PX.ok, fontVariantNumeric: 'tabular-nums' }}>{cnt || '✓'}</span>
                {cnt > 0 && fixable && <span style={{ fontSize: 10, fontWeight: 700, color: PX.warn, background: PX.warnBg, borderRadius: 99, padding: '2px 8px' }}>Quick fix</span>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: PX.ink2, marginTop: 4 }}>{c.label}</div>
            </button>
          )
        })}
      </div>

      {activeCheck && (
        <div style={{ padding: '11px 15px', marginBottom: 14, background: PX.goldBg, border: `1px solid ${PX.goldLine}`, borderRadius: 12, fontSize: 12.5, color: PX.ink2 }}>
          <b>How to fix “{activeCheck.label}”:</b> {QUICK_FIXES[activeCheck.key] ? 'press Fix on a row below and enter the correct value.' : activeCheck.fix}
        </div>
      )}

      <PremiumCard title={`Students with issues (${shown.length})`} subtitle="Press Fix to correct a record without leaving this screen"
        right={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="px-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / GCC…" aria-label="Search students" style={{ width: 190 }} />
          {filter && <button className="px-btn ghost" onClick={() => setFilter(null)}>Clear filter</button>}
          {embedded && <button className="px-btn ghost" disabled={!shown.length} onClick={exportCsv}>⬇ Export CSV</button>}
        </div>} bodyStyle={{ padding: 0 }}>
        {shown.length === 0 ? (
          <div style={{ padding: 44, textAlign: 'center', color: PX.ok, fontWeight: 700, fontSize: 13.5 }}>✓ No students match — data looks healthy.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="px-table" style={{ minWidth: 640 }}>
              <thead><tr>{['GCC', 'Name', 'Course', 'Batch', 'Issues', ''].map(h => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {shown.slice(0, 500).map(r => {
                  const id = r.st.id ?? `${r.st.gcc_no}-${r.st.name}`
                  const isOpen = open === id
                  return [
                    <tr key={id}>
                      <td style={{ fontWeight: 700 }}>{s(r.st.gcc_no) || '—'}</td>
                      <td>{s(r.st.name) || '—'}</td>
                      <td>{s(r.st.course) || '—'}</td>
                      <td>{s(r.st.batch) || s(r.st.class_name) || '—'}</td>
                      <td style={{ whiteSpace: 'normal', minWidth: 220 }}>
                        {r.fails.map(k => <span key={k} style={{ display: 'inline-block', margin: '2px 4px 2px 0', padding: '2px 9px', borderRadius: 99, background: PX.badBg, color: PX.bad, fontSize: 11, fontWeight: 700 }}>{label(k)}</span>)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button type="button" className={isOpen ? 'px-btn ghost' : 'px-btn'} style={{ padding: '6px 14px', fontSize: 12.5 }} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : id)}>{isOpen ? 'Close' : 'Fix'}</button>
                      </td>
                    </tr>,
                    isOpen && (
                      <tr key={id + '-fix'}>
                        <td colSpan={6} style={{ background: PX.tint, padding: '14px 18px' }}>
                          <QuickFix st={r.st} fails={r.fails} onSaved={onSaved} />
                        </td>
                      </tr>
                    ),
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > 500 && <div style={{ padding: '10px 20px', fontSize: 11.5, color: PX.sub }}>Showing first 500; export CSV for all.</div>}
      </PremiumCard>
    </div>
  )
}

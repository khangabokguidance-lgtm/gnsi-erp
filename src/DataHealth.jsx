import { useMemo, useState } from 'react'

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

export default function DataHealth({ students = [], isAdmin }) {
  const [filter, setFilter] = useState(null)
  const [q, setQ] = useState('')

  const result = useMemo(() => {
    const todayStr = new Date().toLocaleDateString('en-CA')
    const active = (students || []).filter(x => !x.deleted_at && (!s(x.status) || s(x.status).toLowerCase() === 'active'))
    const rows = runChecks(active, todayStr)
    const counts = {}
    for (const r of rows) for (const k of r.fails) counts[k] = (counts[k] || 0) + 1
    const withIssues = rows.filter(r => r.fails.length)
    return { total: rows.length, counts, withIssues }
  }, [students])

  if (!isAdmin) return <div style={{ padding: 48, textAlign: 'center', color: '#8a93a6' }}>🔒 Admin only</div>

  const label = k => CHECKS.find(c => c.key === k)?.label || k
  const score = result.total ? Math.round(((result.total - result.withIssues.length) / result.total) * 100) : 100
  const scoreColor = score >= 90 ? '#16a34a' : score >= 70 ? '#b45309' : '#dc2626'
  const needle = q.trim().toLowerCase()
  const shown = result.withIssues.filter(r => {
    if (filter && !r.fails.includes(filter)) return false
    return !needle || [r.st.name, r.st.gcc_no, r.st.course, r.st.batch, r.st.class_name].some(v => s(v).toLowerCase().includes(needle))
  })
  const activeCheck = CHECKS.find(c => c.key === filter)

  const cell = { padding: '8px 10px', borderBottom: '1px solid #f3f0e8', fontSize: 12.5, color: '#14213d', whiteSpace: 'nowrap' }
  const head = { ...cell, fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.05em', background: '#faf8f3' }
  const btn = { padding: '7px 12px', border: '1px solid #d9d2c2', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }

  const exportCsv = () => downloadCsv(shown.map(r => ({
    gcc_no: r.st.gcc_no ?? '', name: r.st.name ?? '', course: r.st.course ?? '', batch: r.st.batch || r.st.class_name || '',
    hostel_type: r.st.hostel_type ?? '', admission_date: r.st.admission_date ?? '', issues: r.fails.map(label).join('; '),
  })), 'student_data_health.csv')

  return (
    <div>
      <div style={{ background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, padding: '14px 16px', marginBottom: 14, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>🩺 Student data health</div>
          <div style={{ fontSize: 11.5, color: '#5d6b82', marginTop: 2 }}>Checks on {result.total} active students. Read-only — fix records in the Students module.</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 34, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{score}%</div>
          <div style={{ fontSize: 11, color: '#5d6b82' }}>{result.total - result.withIssues.length} of {result.total} students clean</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {CHECKS.map(c => {
          const cnt = result.counts[c.key] || 0
          const on = filter === c.key
          return (
            <button key={c.key} onClick={() => setFilter(on ? null : c.key)} style={{
              flex: '1 1 170px', textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${on ? NAVY : '#e8e3d8'}`, background: on ? '#eef2fa' : 'white',
            }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: cnt ? '#dc2626' : '#16a34a' }}>{cnt}</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#14213d' }}>{c.label}</div>
            </button>
          )
        })}
      </div>

      {activeCheck && (
        <div style={{ padding: '10px 14px', marginBottom: 12, background: '#eef2fa', border: '1px solid #c7d4ee', borderRadius: 10, fontSize: 12.5, color: NAVY }}>
          <b>{activeCheck.label}:</b> {activeCheck.fix}
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160, fontSize: 14, fontWeight: 800, color: NAVY }}>Students with issues ({shown.length})</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / GCC…" style={{ padding: '7px 10px', border: '1px solid #d9d2c2', borderRadius: 8, fontSize: 12.5, minWidth: 160 }} />
          {filter && <button style={btn} onClick={() => setFilter(null)}>Clear filter</button>}
          <button style={btn} disabled={!shown.length} onClick={exportCsv}>⬇ Export CSV</button>
        </div>
        {shown.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#16a34a', fontWeight: 700, fontSize: 13 }}>✓ No students match — data looks healthy.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>{['GCC', 'Name', 'Course', 'Batch', 'Failed checks'].map(h => <th key={h} style={{ ...head, textAlign: 'left' }}>{h}</th>)}</tr></thead>
              <tbody>
                {shown.slice(0, 500).map(r => (
                  <tr key={r.st.id ?? `${r.st.gcc_no}-${r.st.name}`}>
                    <td style={{ ...cell, fontWeight: 700 }}>{s(r.st.gcc_no) || '—'}</td>
                    <td style={cell}>{s(r.st.name) || '—'}</td>
                    <td style={cell}>{s(r.st.course) || '—'}</td>
                    <td style={cell}>{s(r.st.batch) || s(r.st.class_name) || '—'}</td>
                    <td style={{ ...cell, whiteSpace: 'normal', minWidth: 220 }}>
                      {r.fails.map(k => <span key={k} style={{ display: 'inline-block', margin: '2px 4px 2px 0', padding: '2px 8px', borderRadius: 99, background: '#fef2f2', color: '#991b1b', fontSize: 11, fontWeight: 700 }}>{label(k)}</span>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > 500 && <div style={{ padding: '8px 16px', fontSize: 11, color: '#5d6b82' }}>Showing first 500; export CSV for all.</div>}
      </div>
    </div>
  )
}

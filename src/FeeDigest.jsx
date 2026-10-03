import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'

// Admin "Fees activity digest": read-only summary of fee corrections, reverts,
// concessions, short-payments and hostel-type changes for the last 7 / 30 days,
// with a "Needs attention" list of suspicious patterns.

const NAVY = '#1e3a6e'
const n = v => Number(v || 0).toLocaleString('en-IN')
const norm = v => String(v || '').trim().toLowerCase()

const CORRECTION_ACTIONS = ['fee_amount_correction', 'fee_month_correction', 'fee_date_correction']
const CONC_ACTIONS = ['fee_concession_approved', 'fee_concession_rejected']
const FEE_ACTIONS = [
  'fee_revert', ...CORRECTION_ACTIONS, 'fee_action_requested', 'fee_action_approved', 'fee_action_rejected',
  ...CONC_ACTIONS, 'flat_fee_underpayment', 'course_fee_underpayment', 'hostel_type_corrected', 'hostel_type_changed',
]
const LABELS = {
  fee_revert: 'Revert', fee_amount_correction: 'Amount correction', fee_month_correction: 'Month correction',
  fee_date_correction: 'Date correction', fee_action_requested: 'Action requested', fee_action_approved: 'Action approved',
  fee_action_rejected: 'Action rejected', fee_concession_approved: 'Concession approved', fee_concession_rejected: 'Concession rejected',
  flat_fee_underpayment: 'Flat fee short', course_fee_underpayment: 'Course fee short', hostel_type_corrected: 'Hostel corrected',
  hostel_type_changed: 'Hostel changed', concession: 'Concession',
}

function parseJson(s) {
  if (s && typeof s === 'object') return s
  try { return s ? JSON.parse(s) : null } catch { return null }
}

function gccFrom(v) {
  if (!v) return ''
  if (v.gcc != null) return String(v.gcc)
  if (v.adm_app_id != null) return String(v.adm_app_id)
  if (v.source_ref) {
    const p = String(v.source_ref).split('_')
    return String((p[0] === 'adm' && p[1] === 'item' ? p[2] : p[1]) ?? '')
  }
  return ''
}

function toEntry(r) {
  const o = parseJson(r.old_values) || {}
  const nw = parseJson(r.new_values) || {}
  const oldAmt = o.amount != null ? Number(o.amount) : null
  const newAmt = nw.amount != null ? Number(nw.amount) : null
  return {
    id: `a${r.id ?? r.created_at}${r.action}${r.target_id}`, action: r.action, kind: r.action,
    by: r.changed_by || '—', at: r.created_at || '', gcc: gccFrom(o) || gccFrom(nw), target: r.target_id || '',
    receipt: o.receipt_no || nw.receipt_no || '', oldAmt, newAmt,
    amount: r.action === 'fee_amount_correction' ? newAmt : (Number(o.shortfall) || null),
    detail: nw.reason || o.revert_reason || o.reason || '',
    student: o.student_name || nw.student_name || '',
  }
}

function concEntry(c) {
  return {
    id: `c${c.id}`, action: 'concession', kind: 'concession', status: c.status || 'pending',
    by: c.collected_by || c.requested_by || '—', at: c.created_at || '', gcc: String(c.gcc ?? ''),
    target: c.fee_row_id || '', receipt: c.receipt_no || '', oldAmt: null, newAmt: null,
    amount: Number(c.shortfall) || 0, detail: c.reason || '', student: c.student_name || '',
  }
}

async function loadDigest(days) {
  const nowMs = Date.now()
  const since = new Date(nowMs - days * 86400000).toISOString()
  const wide = new Date(nowMs - 120 * 86400000).toISOString()
  const out = { days, entries: [], concs: null, collectors: {}, error: '' }
  try {
    const { data, error } = await supabase.from('audit_log').select('*').in('action', FEE_ACTIONS)
      .gte('created_at', since).order('created_at', { ascending: false }).limit(3000)
    if (error) out.error = error.message
    else out.entries = (data || []).map(toEntry)
  } catch (e) { out.error = e?.message || String(e) }
  try {
    const { data } = await supabase.from('audit_log').select('changed_by,new_values').eq('action', 'fee_collection')
      .gte('created_at', wide).limit(5000)
    for (const r of data || []) {
      const v = parseJson(r.new_values)
      if (v?.receipt_no && r.changed_by) out.collectors[String(v.receipt_no)] = r.changed_by
    }
  } catch { /* collector map is optional */ }
  try {
    const { data, error } = await supabase.from('fee_concessions').select('*').gte('created_at', since)
      .order('created_at', { ascending: false }).limit(2000)
    if (!error) out.concs = (data || []).map(concEntry)
  } catch { /* table missing */ }
  return out
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

const fmtAt = s => { const d = new Date(s); return isNaN(d) ? (s || '—') : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) }

const cell = { padding: '8px 10px', borderBottom: '1px solid #f3f0e8', fontSize: 12.5, color: '#14213d', whiteSpace: 'nowrap' }
const head = { ...cell, fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.05em', background: '#faf8f3' }

const Tile = ({ label, value, sub, color = NAVY }) => (
  <div style={{ flex: '1 1 150px', background: 'white', border: '1px solid #e8e3d8', borderRadius: 12, padding: '12px 14px' }}>
    <div style={{ fontSize: 10.5, fontWeight: 800, color: '#5d6b82', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 900, color, marginTop: 2 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#8a93a6', marginTop: 2 }}>{sub}</div>}
  </div>
)


const EntryTable = ({ list, students }) => (
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead><tr>{['When', 'Action', 'By', 'GCC', 'Student', 'Amount', 'Detail'].map(h => <th key={h} style={{ ...head, textAlign: 'left' }}>{h}</th>)}</tr></thead>
      <tbody>
        {list.map(e => (
          <tr key={e.id}>
            <td style={cell}>{fmtAt(e.at)}</td>
            <td style={cell}>{LABELS[e.action] || e.action}{e.status ? ` (${e.status})` : ''}</td>
            <td style={cell}>{e.by}</td>
            <td style={cell}>{e.gcc ? `GCC-${e.gcc}` : '—'}</td>
            <td style={cell}>{e.student || (students || []).find(s => String(s.gcc_no) === e.gcc)?.name || '—'}</td>
            <td style={cell}>{e.oldAmt != null && e.newAmt != null ? `₹${n(e.oldAmt)} → ₹${n(e.newAmt)}` : e.amount ? `₹${n(e.amount)}` : '—'}</td>
            <td style={{ ...cell, whiteSpace: 'normal', minWidth: 140 }}>{e.detail || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)


export default function FeeDigest({ students = [], isAdmin }) {
  const [days, setDays] = useState(7)
  const [data, setData] = useState(null)
  const [openFlag, setOpenFlag] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isAdmin) return undefined
    let live = true
    loadDigest(days).then(r => { if (live) setData(r) })
    return () => { live = false }
  }, [isAdmin, days, tick])

  const loading = !data || data.days !== days

  const model = useMemo(() => {
    if (!data || data.days !== days) return null
    const concs = data.concs
    const auditConc = data.entries.filter(e => CONC_ACTIONS.includes(e.action))
    const rest = data.entries.filter(e => !CONC_ACTIONS.includes(e.action))
    const all = concs ? [...rest, ...concs] : [...rest, ...auditConc]
    all.sort((a, b) => String(b.at).localeCompare(String(a.at)))
    const count = a => rest.filter(e => e.action === a).length
    const kpi = {
      reverts: count('fee_revert'),
      corrections: CORRECTION_ACTIONS.reduce((t, a) => t + count(a), 0),
      amountC: count('fee_amount_correction'), monthC: count('fee_month_correction'), dateC: count('fee_date_correction'),
      raised: concs ? concs.length : null,
      approved: concs ? concs.filter(c => c.status === 'approved').length : auditConc.filter(e => e.action === 'fee_concession_approved').length,
      rejected: concs ? concs.filter(c => c.status === 'rejected').length : auditConc.filter(e => e.action === 'fee_concession_rejected').length,
      waived: concs ? concs.filter(c => c.status === 'approved').reduce((t, c) => t + (c.amount || 0), 0) : null,
      short: count('flat_fee_underpayment') + count('course_fee_underpayment'),
      hostel: count('hostel_type_corrected') + count('hostel_type_changed'),
    }

    // staff table
    const staff = {}
    for (const e of all) {
      const s = staff[e.by] || (staff[e.by] = { staff: e.by, reverts: 0, corrections: 0, concessions: 0, short: 0, hostel: 0, requests: 0 })
      if (e.action === 'fee_revert') s.reverts++
      else if (CORRECTION_ACTIONS.includes(e.action)) s.corrections++
      else if (e.kind === 'concession' || CONC_ACTIONS.includes(e.action)) s.concessions++
      else if (e.action.endsWith('underpayment')) s.short++
      else if (e.action.startsWith('hostel_type')) s.hostel++
      else if (e.action.startsWith('fee_action')) s.requests++
    }

    // flags
    const flags = []
    const concList = concs || []
    const perStaffConc = {}
    for (const c of concList) perStaffConc[c.by] = (perStaffConc[c.by] || []).concat(c)
    for (const [who, list] of Object.entries(perStaffConc)) {
      if (list.length >= 3) flags.push({ key: `sc-${who}`, sev: 'warn', title: `${who} raised ${list.length} concessions`, entries: list })
    }
    const big = concList.filter(c => c.amount > 2000)
    if (big.length) flags.push({ key: 'bigc', sev: 'high', title: `${big.length} concession${big.length > 1 ? 's' : ''} above ₹2,000`, entries: big })
    const selfC = rest.filter(e => CORRECTION_ACTIONS.includes(e.action) && e.receipt && data.collectors[String(e.receipt)] && norm(data.collectors[String(e.receipt)]) === norm(e.by))
    if (selfC.length) flags.push({ key: 'selfc', sev: 'high', title: `${selfC.length} correction${selfC.length > 1 ? 's' : ''} by the same person who collected the fee`, entries: selfC })
    const byGcc = {}
    for (const e of rest) if (CORRECTION_ACTIONS.includes(e.action) && e.gcc) (byGcc[e.gcc] = byGcc[e.gcc] || []).push(e)
    for (const [g, list] of Object.entries(byGcc)) {
      if (list.length >= 3) {
        const st = (students || []).find(s => String(s.gcc_no) === g)
        flags.push({ key: `gcc-${g}`, sev: 'warn', title: `${list.length} corrections on ${st?.name || 'GCC-' + g} (GCC-${g})`, entries: list })
      }
    }
    const cuts = rest.filter(e => e.action === 'fee_amount_correction' && e.oldAmt > 0 && e.newAmt != null && e.newAmt < e.oldAmt * 0.5)
    if (cuts.length) flags.push({ key: 'cuts', sev: 'high', title: `${cuts.length} correction${cuts.length > 1 ? 's' : ''} cutting an amount by more than 50%`, entries: cuts })

    return { all, kpi, staff: Object.values(staff).sort((a, b) => a.staff.localeCompare(b.staff)), flags, hasConcTable: !!concs }
  }, [data, days, students])

  if (!isAdmin) return <div style={{ padding: 48, textAlign: 'center', color: '#8a93a6' }}>🔒 Admin only</div>

  const exportRows = list => list.map(e => ({
    when: e.at, action: LABELS[e.action] || e.action, status: e.status || '', by: e.by, gcc: e.gcc, student: e.student,
    receipt: e.receipt, old_amount: e.oldAmt ?? '', new_amount: e.newAmt ?? '', amount_or_shortfall: e.amount ?? '', detail: e.detail,
  }))

  const btn = { padding: '7px 12px', border: '1px solid #d9d2c2', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }
  const card = { background: 'white', border: '1px solid #e8e3d8', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }

  const k = model?.kpi
  const activeFlag = model?.flags.find(f => f.key === openFlag)

  return (
    <div>
      <div style={{ ...card, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: NAVY }}>📰 Fees activity digest</div>
          <div style={{ fontSize: 11.5, color: '#5d6b82', marginTop: 2 }}>Reverts, corrections, concessions, short payments and hostel changes. Read-only.</div>
        </div>
        <select value={days} onChange={e => { setDays(Number(e.target.value)); setOpenFlag(null) }} style={{ padding: '7px 8px', border: '1px solid #d9d2c2', borderRadius: 8, fontSize: 12.5 }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
        </select>
        <button style={btn} onClick={() => { setData(null); setTick(t => t + 1) }}>↻ Refresh</button>
        <button style={btn} disabled={!model?.all.length} onClick={() => downloadCsv(exportRows(model.all), `fee_digest_${days}d.csv`)}>⬇ Export CSV</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#5d6b82', fontSize: 13 }}>Loading activity…</div>
      ) : (
        <>
          {data.error && <div style={{ padding: 12, marginBottom: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, color: '#991b1b', fontSize: 12.5 }}>Could not read the audit log: {data.error}</div>}
          {!model.hasConcTable && <div style={{ padding: 10, marginBottom: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, color: '#92400e', fontSize: 12 }}>Concession table not available — concession figures come from audit-log entries only and ₹ waived is unknown.</div>}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <Tile label="Reverts" value={k.reverts} color="#dc2626" />
            <Tile label="Corrections" value={k.corrections} sub={`${k.amountC} amount · ${k.monthC} month · ${k.dateC} date`} color="#b45309" />
            <Tile label="Concessions raised" value={k.raised ?? '—'} sub={`${k.approved} approved · ${k.rejected} rejected`} />
            <Tile label="Total waived" value={k.waived == null ? '—' : `₹${n(k.waived)}`} sub="approved concessions" color="#16a34a" />
            <Tile label="Short payments" value={k.short} color="#991b1b" />
            <Tile label="Hostel type changes" value={k.hostel} />
          </div>

          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', fontSize: 14, fontWeight: 800, color: NAVY }}>
              ⚠ Needs attention {model.flags.length > 0 && <span style={{ color: '#dc2626' }}>({model.flags.length})</span>}
            </div>
            {model.flags.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#16a34a', fontWeight: 700, fontSize: 13 }}>✓ Nothing unusual in this period.</div>
            ) : (
              <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {model.flags.map(f => (
                  <button key={f.key} onClick={() => setOpenFlag(openFlag === f.key ? null : f.key)}
                    style={{ textAlign: 'left', padding: '9px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
                      border: `1px solid ${f.sev === 'high' ? '#fecaca' : '#fde68a'}`, background: f.sev === 'high' ? '#fef2f2' : '#fffbeb',
                      color: f.sev === 'high' ? '#991b1b' : '#92400e' }}>
                    {f.sev === 'high' ? '🔴' : '🟠'} {f.title} <span style={{ float: 'right', fontWeight: 600 }}>{openFlag === f.key ? '▲' : 'view ▼'}</span>
                  </button>
                ))}
              </div>
            )}
            {activeFlag && (
              <div style={{ borderTop: '1px solid #e8e3d8' }}>
                <div style={{ padding: '8px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#5d6b82' }}>
                  <span style={{ flex: 1 }}>{activeFlag.entries.length} underlying entr{activeFlag.entries.length > 1 ? 'ies' : 'y'}</span>
                  <button style={btn} onClick={() => downloadCsv(exportRows(activeFlag.entries), `fee_digest_flag_${activeFlag.key}.csv`)}>⬇ CSV</button>
                </div>
                <EntryTable list={activeFlag.entries} students={students} />
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', fontSize: 14, fontWeight: 800, color: NAVY }}>👥 By staff</div>
            {model.staff.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#8a93a6', fontSize: 13 }}>No activity in this period.</div> : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>{['Staff', 'Reverts', 'Corrections', 'Concessions', 'Short pay', 'Hostel', 'Requests'].map((h, i) => <th key={h} style={{ ...head, textAlign: i ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {model.staff.map(s => (
                      <tr key={s.staff}>
                        <td style={{ ...cell, fontWeight: 700 }}>{s.staff}</td>
                        {[s.reverts, s.corrections, s.concessions, s.short, s.hostel, s.requests].map((v, i) => <td key={i} style={{ ...cell, textAlign: 'right', color: v ? '#14213d' : '#c4bfb0' }}>{v}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={card}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e3d8', fontSize: 14, fontWeight: 800, color: NAVY }}>All entries ({model.all.length})</div>
            {model.all.length === 0 ? <div style={{ padding: 24, textAlign: 'center', color: '#8a93a6', fontSize: 13 }}>No entries.</div> : <EntryTable list={model.all.slice(0, 300)} students={students} />}
            {model.all.length > 300 && <div style={{ padding: '8px 16px', fontSize: 11, color: '#5d6b82' }}>Showing first 300; export CSV for all.</div>}
          </div>
        </>
      )}
    </div>
  )
}

// FeeSetup.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Admin-only Fee Structure Setup
//  • Per session year, course, batch, hostel type
//  • Manages flat_fee, course_fee, admission_fee in fee_structures table
//  • Tab 2: Per-student flat fee overrides (student_fee_overrides table)
//  • Role-gated: admin only
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import {
  CURRENT_YEAR, clearFeeRateCache, COURSE_STRUCTURE,
  getFeeRates, saveStudentFlatFeeOverride, TABLES,
} from './feeEngine'

// ─── Constants ────────────────────────────────────────────────────────────────
// ✦ COURSE_STRUCTURE now imported from feeEngine.js (single source of truth) —
//   this file used to keep its own separate copy, which could silently drift
//   out of sync with the one feeEngine.js actually uses (e.g. Navodaya's
//   Lakshya batch was split into "Lakshya A" / "Lakshya B" elsewhere in the
//   app but this file's local copy still only had plain "Lakshya", so Fee
//   Setup could never configure rates for the batches actually being billed).

const COURSES      = Object.keys(COURSE_STRUCTURE)
const HOSTEL_TYPES = ['Boarder', 'Day Boarder', 'Day Scholar']

const SESSION_YEARS = [
  `${CURRENT_YEAR - 1}-${CURRENT_YEAR}`,
  `${CURRENT_YEAR}-${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR + 1}-${CURRENT_YEAR + 2}`,
]

// ─── Styles ───────────────────────────────────────────────────────────────────

const C = {
  navy:    '#1e3a5f',
  indigo:  '#4f46e5',
  emerald: '#059669',
  amber:   '#d97706',
  red:     '#dc2626',
  gold:    '#ffd060',
  violet:  '#7c3aed',
  slate: {
    50:  '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0',
    400: '#94a3b8', 500: '#64748b', 700: '#334155', 900: '#0f172a',
  },
}

const HOSTEL_COLORS = {
  Boarder:       { bg: '#dcfce7', color: '#166534', border: '#86efac' },
  'Day Boarder': { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'Day Scholar': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
}

const COURSE_COLORS = {
  Sainik:           { accent: '#4f46e5', light: '#eff6ff' },
  Navodaya:         { accent: '#059669', light: '#f0fdf4' },
  Foundation:       { accent: '#d97706', light: '#fffbeb' },
  'Combined Course':{ accent: '#7c3aed', light: '#f5f3ff' },
}

const inp = {
  padding: '7px 10px', borderRadius: 7, border: `1px solid ${C.slate[200]}`,
  fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box',
  fontFamily: 'inherit', background: 'white', textAlign: 'right',
  fontWeight: 700, color: C.navy,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const rowKey = (session, course, batch, hostel) =>
  `${session}__${course}__${batch}__${hostel}`

// ─── Sub-components ───────────────────────────────────────────────────────────

function HostelBadge({ type }) {
  const s = HOSTEL_COLORS[type] || HOSTEL_COLORS['Day Scholar']
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em',
      padding: '2px 8px', borderRadius: 4,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{type}</span>
  )
}

function AmtInput({ value, onChange, color }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.slate[400], pointerEvents: 'none' }}>₹</span>
      <input
        type="number" min="0" value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ ...inp, paddingLeft: 22, color: color || C.navy }}
      />
    </div>
  )
}

// ─── Student Overrides Tab ────────────────────────────────────────────────────

function StudentOverridesTab({ sessionYear }) {
  const [search,    setSearch]    = useState('')
  const [results,   setResults]   = useState([])
  const [searching, setSearching] = useState(false)
  const [selected,  setSelected]  = useState(null)   // full student row
  const [baseRate,  setBaseRate]  = useState(null)   // from fee_structures
  const [override,  setOverride]  = useState(null)   // existing override row or null
  const [newAmt,    setNewAmt]    = useState('')
  const [reason,    setReason]    = useState('')
  const [saving,    setSaving]    = useState(false)
  const [feedback,  setFeedback]  = useState(null)   // { type: 'ok'|'err', msg }

  // ── Search students ────────────────────────────────────────────────────
  const searchStudents = useCallback(async () => {
    const q = search.trim()
    if (!q) return
    setSearching(true)
    const isNum = /^\d+$/.test(q)
    let query = supabase
      .from(TABLES.students)
      .select('id, gcc_no, name, course, batch, hostel_type, status')
      .eq('status', 'Active')
      .limit(10)
    if (isNum) {
      query = query.eq('gcc_no', parseInt(q))
    } else {
      query = query.ilike('name', `%${q}%`)
    }
    const { data } = await query
    setResults(data || [])
    setSearching(false)
  }, [search])

  const handleKeyDown = (e) => { if (e.key === 'Enter') searchStudents() }

  // ── Select a student ──────────────────────────────────────────────────
  const selectStudent = async (student) => {
    setSelected(student)
    setResults([])
    setSearch('')
    setFeedback(null)
    setNewAmt('')
    setReason('')

    // Fetch base rate
    const rates = await getFeeRates(sessionYear, student.course, student.batch, student.hostel_type)
    setBaseRate(rates.flatFee)

    // Fetch existing override
    const { data } = await supabase
      .from(TABLES.studentFeeOverrides)
      .select('*')
      .eq('gcc_no', student.gcc_no)
      .eq('session_year', sessionYear)
      .maybeSingle()
    setOverride(data || null)
    if (data) {
      setNewAmt(String(data.flat_fee_override))
      setReason(data.reason || '')
    }
  }

  // ── Save override ─────────────────────────────────────────────────────
  const saveOverride = async () => {
    if (!selected) return
    const amt = parseFloat(newAmt)
    if (isNaN(amt) || amt < 0) { setFeedback({ type: 'err', msg: 'Enter a valid amount (0 or above).' }); return }
    setSaving(true)
    try {
      await saveStudentFlatFeeOverride(selected.gcc_no, sessionYear, amt, reason, 'admin')
      clearFeeRateCache()
      setOverride({ flat_fee_override: amt, reason, updated_by: 'admin', updated_at: new Date().toISOString() })
      setFeedback({ type: 'ok', msg: `Override saved — GCC ${selected.gcc_no} will pay ₹${amt.toLocaleString('en-IN')} flat fee for ${sessionYear}.` })
    } catch (err) {
      setFeedback({ type: 'err', msg: err.message || 'Save failed.' })
    } finally { setSaving(false) }
  }

  // ── Remove override ───────────────────────────────────────────────────
  const removeOverride = async () => {
    if (!selected || !override) return
    if (!window.confirm(`Remove flat fee override for ${selected.name}? They will revert to the standard rate.`)) return
    setSaving(true)
    try {
      await saveStudentFlatFeeOverride(selected.gcc_no, sessionYear, null)
      clearFeeRateCache()
      setOverride(null)
      setNewAmt('')
      setReason('')
      setFeedback({ type: 'ok', msg: `Override removed. ${selected.name} now uses standard flat fee.` })
    } catch (err) {
      setFeedback({ type: 'err', msg: err.message || 'Remove failed.' })
    } finally { setSaving(false) }
  }

  // ── All overrides list ────────────────────────────────────────────────
  const [allOverrides,     setAllOverrides]     = useState([])
  const [loadingOverrides, setLoadingOverrides] = useState(false)

  const loadAllOverrides = useCallback(async () => {
    setLoadingOverrides(true)
    const { data } = await supabase
      .from(TABLES.studentFeeOverrides)
      .select('gcc_no, flat_fee_override, reason, updated_by, updated_at')
      .eq('session_year', sessionYear)
      .order('updated_at', { ascending: false })
    // Join student names
    if (data?.length) {
      const gccs = data.map(r => r.gcc_no)
      const { data: students } = await supabase
        .from(TABLES.students)
        .select('gcc_no, name, course, batch, hostel_type')
        .in('gcc_no', gccs)
      const sMap = {}
      ;(students || []).forEach(s => { sMap[s.gcc_no] = s })
      setAllOverrides(data.map(r => ({ ...r, student: sMap[r.gcc_no] || null })))
    } else {
      setAllOverrides([])
    }
    setLoadingOverrides(false)
  }, [sessionYear])

  useEffect(() => { loadAllOverrides() }, [loadAllOverrides])

  // ─────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

      {/* ── LEFT: Search + Edit ── */}
      <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${C.slate[200]}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <div style={{ background: `${C.violet}10`, borderBottom: `2px solid ${C.violet}20`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 4, height: 24, background: C.violet, borderRadius: 2 }} />
          <div style={{ fontSize: 15, fontWeight: 800, color: C.violet }}>Set Student Override</div>
        </div>

        <div style={{ padding: 20 }}>

          {/* Search box */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: C.slate[500], textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
              Search by Name or GCC No.
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text" value={search} placeholder="e.g. Rohan or 1042"
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...inp, textAlign: 'left', fontWeight: 400, flex: 1 }}
              />
              <button type="button" onClick={searchStudents} disabled={searching || !search.trim()}
                style={{ padding: '7px 16px', borderRadius: 7, border: 'none', background: C.navy, color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {searching ? '…' : '🔍 Search'}
              </button>
            </div>

            {/* Dropdown results */}
            {results.length > 0 && (
              <div style={{ border: `1px solid ${C.slate[200]}`, borderRadius: 8, marginTop: 6, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,.1)' }}>
                {results.map(s => (
                  <div key={s.id} onClick={() => selectStudent(s)}
                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${C.slate[100]}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', transition: 'background .1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = C.slate[50]}
                    onMouseLeave={e => e.currentTarget.style.background = 'white'}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: C.slate[400] }}>{s.course} · {s.batch} · GCC {s.gcc_no}</div>
                    </div>
                    <HostelBadge type={s.hostel_type || 'Day Scholar'} />
                  </div>
                ))}
              </div>
            )}
            {results.length === 0 && search && !searching && (
              <div style={{ fontSize: 12, color: C.slate[400], marginTop: 6 }}>No active students found.</div>
            )}
          </div>

          {/* Selected student card */}
          {selected && (
            <div style={{ background: C.slate[50], borderRadius: 10, padding: '14px 16px', marginBottom: 16, border: `1px solid ${C.slate[200]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>{selected.name}</div>
                  <div style={{ fontSize: 12, color: C.slate[500], marginTop: 2 }}>
                    GCC {selected.gcc_no} · {selected.course} / {selected.batch}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  <HostelBadge type={selected.hostel_type || 'Day Scholar'} />
                  {override && (
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#ede9fe', color: C.violet, border: `1px solid #c4b5fd` }}>OVERRIDE ACTIVE</span>
                  )}
                </div>
              </div>

              {/* Rate comparison */}
              {baseRate !== null && (
                <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, background: 'white', borderRadius: 8, padding: '8px 12px', border: `1px solid ${C.slate[200]}` }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', marginBottom: 2 }}>Standard Rate</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: C.emerald }}>₹{baseRate.toLocaleString('en-IN')}</div>
                    <div style={{ fontSize: 10, color: C.slate[400] }}>from fee_structures</div>
                  </div>
                  {override && (
                    <div style={{ flex: 1, background: '#ede9fe', borderRadius: 8, padding: '8px 12px', border: `1px solid #c4b5fd` }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.violet, textTransform: 'uppercase', marginBottom: 2 }}>Current Override</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: C.violet }}>₹{Number(override.flat_fee_override).toLocaleString('en-IN')}</div>
                      <div style={{ fontSize: 10, color: C.violet, opacity: .7 }}>
                        {override.reason || 'No reason given'}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Override form */}
          {selected && (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.slate[500], textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
                  New Flat Fee Override (₹/month)
                </label>
                <AmtInput value={newAmt} color={C.violet} onChange={v => setNewAmt(String(v))} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: C.slate[500], textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 5 }}>
                  Reason <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span>
                </label>
                <input
                  type="text" value={reason} placeholder="e.g. Scholarship, special concession…"
                  onChange={e => setReason(e.target.value)}
                  style={{ ...inp, textAlign: 'left', fontWeight: 400 }}
                />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={saveOverride} disabled={saving || newAmt === ''}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: saving || newAmt === '' ? 'not-allowed' : 'pointer', background: saving || newAmt === '' ? C.slate[200] : `linear-gradient(135deg,${C.violet},${C.indigo})`, color: saving || newAmt === '' ? C.slate[400] : 'white' }}>
                  {saving ? '⏳ Saving…' : override ? '✏️ Update Override' : '✅ Set Override'}
                </button>
                {override && (
                  <button type="button" onClick={removeOverride} disabled={saving}
                    style={{ padding: '9px 14px', borderRadius: 8, border: `1px solid #fca5a5`, background: '#fef2f2', fontSize: 13, fontWeight: 700, cursor: 'pointer', color: C.red }}>
                    🗑 Remove
                  </button>
                )}
              </div>

              {feedback && (
                <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: feedback.type === 'ok' ? '#ecfdf5' : '#fef2f2', border: `1px solid ${feedback.type === 'ok' ? '#6ee7b7' : '#fca5a5'}`, color: feedback.type === 'ok' ? '#065f46' : '#b91c1c' }}>
                  {feedback.type === 'ok' ? '✅' : '❌'} {feedback.msg}
                </div>
              )}
            </>
          )}

          {!selected && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: C.slate[400], fontSize: 13 }}>
              🔍 Search for a student above to set or edit their flat fee override.
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: All active overrides list ── */}
      <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${C.slate[200]}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <div style={{ background: `${C.violet}10`, borderBottom: `2px solid ${C.violet}20`, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 24, background: C.violet, borderRadius: 2 }} />
            <div style={{ fontSize: 15, fontWeight: 800, color: C.violet }}>Active Overrides</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: C.slate[400] }}>{sessionYear}</span>
            <button type="button" onClick={loadAllOverrides}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.slate[200]}`, background: 'white', cursor: 'pointer', color: C.slate[500] }}>
              ↻ Refresh
            </button>
          </div>
        </div>

        <div style={{ padding: '0' }}>
          {loadingOverrides ? (
            <div style={{ textAlign: 'center', padding: 32, color: C.slate[400], fontSize: 13 }}>⏳ Loading…</div>
          ) : allOverrides.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: C.slate[400], fontSize: 13 }}>
              No overrides set for {sessionYear} yet.
            </div>
          ) : (
            allOverrides.map((ov, i) => (
              <div key={ov.gcc_no} style={{ padding: '12px 18px', borderBottom: i < allOverrides.length - 1 ? `1px solid ${C.slate[100]}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.navy }}>
                    {ov.student?.name || `GCC ${ov.gcc_no}`}
                  </div>
                  <div style={{ fontSize: 11, color: C.slate[400], marginTop: 2 }}>
                    GCC {ov.gcc_no}
                    {ov.student ? ` · ${ov.student.course} / ${ov.student.batch}` : ''}
                    {ov.reason ? ` · ${ov.reason}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {ov.student && <HostelBadge type={ov.student.hostel_type || 'Day Scholar'} />}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: C.violet }}>
                      ₹{Number(ov.flat_fee_override).toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: 10, color: C.slate[400] }}>
                      {ov.updated_at ? new Date(ov.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                    </div>
                  </div>
                  {/* Quick-select to edit */}
                  {ov.student && (
                    <button type="button" onClick={() => selectStudent({ ...ov.student, gcc_no: ov.gcc_no })}
                      style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.slate[200]}`, background: C.slate[50], cursor: 'pointer', color: C.slate[500] }}>
                      Edit
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FeeSetup({ userRole }) {
  const [activeTab,    setActiveTab]    = useState('structures')   // 'structures' | 'overrides'
  const [sessionYear,  setSessionYear]  = useState(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`)
  const [activeCourse, setActiveCourse] = useState('Sainik')
  const [structures,   setStructures]   = useState({})
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState(null)

  // ── Load from Supabase ────────────────────────────────────────────────────
  const loadStructures = useCallback(async () => {
    setLoading(true); setError(null)
    const { data, error: e } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('session_year', sessionYear)
    if (e) { setError(e.message); setLoading(false); return }

    const map = {}
    COURSES.forEach(course => {
      COURSE_STRUCTURE[course].forEach(batch => {
        HOSTEL_TYPES.forEach(hostel => {
          const key = rowKey(sessionYear, course, batch, hostel)
          map[key] = { flat_fee: 0, course_fee: 0, admission_fee: 6000, id: null, dirty: false }
        })
      })
    })
    ;(data || []).forEach(row => {
      const key = rowKey(row.session_year, row.course, row.batch, row.hostel_type)
      map[key] = { flat_fee: row.flat_fee, course_fee: row.course_fee, admission_fee: row.admission_fee, id: row.id, dirty: false }
    })
    setStructures(map)
    setLoading(false)
  }, [sessionYear])

  useEffect(() => { loadStructures() }, [loadStructures])

  const updateField = (course, batch, hostel, field, value) => {
    const key = rowKey(sessionYear, course, batch, hostel)
    setStructures(prev => ({ ...prev, [key]: { ...prev[key], [field]: value, dirty: true } }))
    setSaved(false)
  }

  const saveAll = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const dirtyRows = Object.entries(structures)
        .filter(([, v]) => v.dirty)
        .map(([key, v]) => {
          const [session, course, batch, hostel] = key.split('__')
          return { session_year: session, course, batch, hostel_type: hostel, flat_fee: v.flat_fee, course_fee: v.course_fee, admission_fee: v.admission_fee }
        })
      if (!dirtyRows.length) { setSaving(false); setSaved(true); return }
      const { error: e } = await supabase
        .from('fee_structures')
        .upsert(dirtyRows, { onConflict: 'session_year,course,batch,hostel_type', ignoreDuplicates: false })
      if (e) throw e
      clearFeeRateCache()
      setStructures(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => { next[k] = { ...next[k], dirty: false } })
        return next
      })
      setSaved(true)
      await loadStructures()
    } catch (err) {
      setError(err.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const copyFromPrevSession = async () => {
    const prevSession = SESSION_YEARS[SESSION_YEARS.indexOf(sessionYear) - 1]
    if (!prevSession) return alert('No previous session available.')
    const { data, error: e } = await supabase.from('fee_structures').select('*').eq('session_year', prevSession)
    if (e || !data?.length) { alert('No data found for ' + prevSession); return }
    const updates = {}
    data.forEach(row => {
      const key = rowKey(sessionYear, row.course, row.batch, row.hostel_type)
      updates[key] = { flat_fee: row.flat_fee, course_fee: row.course_fee, admission_fee: row.admission_fee, id: null, dirty: true }
    })
    setStructures(prev => ({ ...prev, ...updates }))
    setSaved(false)
  }

  const dirtyCount  = Object.values(structures).filter(v => v.dirty).length
  const courseColor = COURSE_COLORS[activeCourse] || COURSE_COLORS.Sainik
  const batches     = COURSE_STRUCTURE[activeCourse]

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '24px 20px', fontFamily: "'Outfit', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.slate[400], marginBottom: 4 }}>Admin Settings</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>Fee Structure Setup</div>
            <div style={{ fontSize: 13, color: C.slate[400], marginTop: 3 }}>Configure fees and per-student flat fee overrides</div>
          </div>
          {activeTab === 'structures' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={copyFromPrevSession}
                style={{ padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.slate[200]}`, background: 'white', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: C.slate[500] }}>
                📋 Copy from prev session
              </button>
              <button type="button" onClick={saveAll} disabled={saving || !dirtyCount}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 700, cursor: saving || !dirtyCount ? 'not-allowed' : 'pointer', background: saving || !dirtyCount ? C.slate[200] : `linear-gradient(135deg,${C.navy},${C.indigo})`, color: saving || !dirtyCount ? C.slate[400] : 'white', transition: 'all .15s' }}>
                {saving ? '⏳ Saving…' : dirtyCount ? `💾 Save ${dirtyCount} change${dirtyCount > 1 ? 's' : ''}` : '✓ Saved'}
              </button>
            </div>
          )}
        </div>

        {/* Session selector */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.slate[500] }}>Session:</span>
          {SESSION_YEARS.map(sy => (
            <button key={sy} type="button" onClick={() => { setSessionYear(sy); setSaved(false) }}
              style={{ padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: sessionYear === sy ? C.navy : C.slate[100], color: sessionYear === sy ? 'white' : C.slate[500], transition: 'all .12s' }}>
              {sy}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab switcher ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {[
          { id: 'structures', label: '📋 Fee Structures', color: C.navy },
          { id: 'overrides',  label: '✏️ Student Overrides', color: C.violet, badge: null },
        ].map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            style={{ padding: '9px 20px', borderRadius: 9, border: `2px solid ${activeTab === tab.id ? tab.color : C.slate[200]}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: activeTab === tab.id ? tab.color : 'white', color: activeTab === tab.id ? 'white' : C.slate[500], transition: 'all .15s' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>❌ {error}</span>
          <button type="button" onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>×</button>
        </div>
      )}
      {saved && activeTab === 'structures' && (
        <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: '#065f46' }}>
          ✅ Fee structure saved successfully for {sessionYear}
        </div>
      )}

      {/* ── Tab content ── */}
      {activeTab === 'overrides' ? (
        <StudentOverridesTab sessionYear={sessionYear} />
      ) : (
        <>
          {/* ── Course tabs ── */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
            {COURSES.map(c => {
              const cc = COURSE_COLORS[c]
              const isActive = activeCourse === c
              const dirtyInCourse = COURSE_STRUCTURE[c].some(batch =>
                HOSTEL_TYPES.some(h => structures[rowKey(sessionYear, c, batch, h)]?.dirty)
              )
              return (
                <button key={c} type="button" onClick={() => setActiveCourse(c)}
                  style={{ padding: '8px 18px', borderRadius: 8, border: `2px solid ${isActive ? cc.accent : C.slate[200]}`, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: isActive ? cc.accent : 'white', color: isActive ? 'white' : C.slate[500], transition: 'all .15s', position: 'relative' }}>
                  {c}
                  {dirtyInCourse && <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, background: C.amber, borderRadius: '50%', border: '2px solid white' }} />}
                </button>
              )
            })}
          </div>

          {/* ── Table ── */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: C.slate[400], fontSize: 13 }}>⏳ Loading fee structures…</div>
          ) : (
            <div style={{ background: 'white', borderRadius: 14, border: `1px solid ${C.slate[200]}`, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>

              <div style={{ background: courseColor.light, borderBottom: `2px solid ${courseColor.accent}20`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 4, height: 24, background: courseColor.accent, borderRadius: 2 }} />
                <div style={{ fontSize: 16, fontWeight: 800, color: courseColor.accent }}>{activeCourse}</div>
                <div style={{ fontSize: 12, color: C.slate[400], marginLeft: 4 }}>
                  {batches.length} batch{batches.length > 1 ? 'es' : ''} · {sessionYear}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 0, background: C.slate[50], borderBottom: `1px solid ${C.slate[200]}`, padding: '8px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.06em' }}>Batch / Hostel</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right', paddingRight: 12 }}>Flat Fee /mo</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.indigo,  textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right', paddingRight: 12 }}>Course Fee /mo</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.amber,   textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right', paddingRight: 12 }}>Admission Fee</div>
              </div>

              {batches.map((batch, bi) => (
                <div key={batch}>
                  {batches.length > 1 && (
                    <div style={{ padding: '10px 20px 6px', background: `${courseColor.accent}08`, borderTop: bi > 0 ? `1px solid ${C.slate[100]}` : 'none' }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: courseColor.accent, textTransform: 'uppercase', letterSpacing: '.06em' }}>{batch}</span>
                    </div>
                  )}

                  {HOSTEL_TYPES.map((hostel, hi) => {
                    const key = rowKey(sessionYear, activeCourse, batch, hostel)
                    const row = structures[key] || { flat_fee: 0, course_fee: 0, admission_fee: 6000, dirty: false }
                    return (
                      <div key={hostel} style={{
                        display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr',
                        alignItems: 'center', gap: 0, padding: '10px 20px',
                        borderTop: hi > 0 ? `1px solid ${C.slate[100]}` : 'none',
                        background: row.dirty ? `${C.amber}08` : 'white', transition: 'background .2s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <HostelBadge type={hostel} />
                          {row.dirty && <span style={{ fontSize: 9, fontWeight: 800, color: C.amber, background: '#fef3c7', padding: '1px 5px', borderRadius: 3 }}>EDITED</span>}
                        </div>
                        <div style={{ paddingRight: 12 }}>
                          <AmtInput value={row.flat_fee} color={C.emerald} onChange={v => updateField(activeCourse, batch, hostel, 'flat_fee', v)} />
                        </div>
                        <div style={{ paddingRight: 12 }}>
                          <AmtInput value={row.course_fee} color={C.indigo} onChange={v => updateField(activeCourse, batch, hostel, 'course_fee', v)} />
                        </div>
                        <div style={{ paddingRight: 12 }}>
                          <AmtInput value={row.admission_fee} color={C.amber} onChange={v => updateField(activeCourse, batch, hostel, 'admission_fee', v)} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}

              {/* Footer summary */}
              <div style={{ borderTop: `1px solid ${C.slate[200]}`, padding: '12px 20px', background: C.slate[50], display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {HOSTEL_TYPES.map(hostel => {
                  const totals = batches.reduce((acc, batch) => {
                    const key = rowKey(sessionYear, activeCourse, batch, hostel)
                    const row = structures[key] || {}
                    acc.flat   += row.flat_fee   || 0
                    acc.course += row.course_fee || 0
                    return acc
                  }, { flat: 0, course: 0 })
                  const hc = HOSTEL_COLORS[hostel]
                  return (
                    <div key={hostel} style={{ background: hc.bg, border: `1px solid ${hc.border}`, borderRadius: 8, padding: '8px 14px', fontSize: 12 }}>
                      <div style={{ fontWeight: 700, color: hc.color, marginBottom: 3 }}>{hostel}</div>
                      <div style={{ color: hc.color, opacity: .8 }}>
                        Flat avg: ₹{Math.round(totals.flat / batches.length).toLocaleString('en-IN')} ·
                        Course avg: ₹{Math.round(totals.course / batches.length).toLocaleString('en-IN')}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, color: C.slate[400], display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ display: 'inline-block', width: 10, height: 10, background: `${C.amber}20`, border: `1px solid ${C.amber}40`, borderRadius: 2 }} />
              Unsaved changes
            </div>
            <div style={{ fontSize: 11, color: C.slate[400] }}>Changes apply to <strong>{sessionYear}</strong> session only</div>
            <div style={{ fontSize: 11, color: C.slate[400] }}>Flat fee = monthly hostel/facility fee · Course fee = monthly tuition fee</div>
          </div>
        </>
      )}
    </div>
  )
}
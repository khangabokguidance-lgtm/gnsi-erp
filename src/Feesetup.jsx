// FeeSetup.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Admin-only Fee Structure Setup
//  • Per session year, course, batch, hostel type
//  • Manages flat_fee, course_fee, admission_fee in fee_structures table
//  • Role-gated: admin only
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import { CURRENT_YEAR, clearFeeRateCache } from './feeEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const COURSE_STRUCTURE = {
  Sainik:           ['Achiever', 'Leader', 'Champion'],
  Navodaya:         ['Umeed', 'Lakshya'],
  Foundation:       ['Prime', 'Elite'],
  'Combined Course': ['—'],
}

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FeeSetup({ userRole }) {
  const [sessionYear,  setSessionYear]  = useState(`${CURRENT_YEAR}-${CURRENT_YEAR + 1}`)
  const [activeCourse, setActiveCourse] = useState('Sainik')
  const [structures,   setStructures]   = useState({})   // key → { flat_fee, course_fee, admission_fee, id?, dirty }
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
    // Pre-populate all possible keys with zeros
    COURSES.forEach(course => {
      COURSE_STRUCTURE[course].forEach(batch => {
        HOSTEL_TYPES.forEach(hostel => {
          const key = rowKey(sessionYear, course, batch, hostel)
          map[key] = { flat_fee: 0, course_fee: 0, admission_fee: 6000, id: null, dirty: false }
        })
      })
    })
    // Overlay DB values
    ;(data || []).forEach(row => {
      const key = rowKey(row.session_year, row.course, row.batch, row.hostel_type)
      map[key] = { flat_fee: row.flat_fee, course_fee: row.course_fee, admission_fee: row.admission_fee, id: row.id, dirty: false }
    })
    setStructures(map)
    setLoading(false)
  }, [sessionYear])

  useEffect(() => { loadStructures() }, [loadStructures])

  // ── Update local state ────────────────────────────────────────────────────
  const updateField = (course, batch, hostel, field, value) => {
    const key = rowKey(sessionYear, course, batch, hostel)
    setStructures(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value, dirty: true },
    }))
    setSaved(false)
  }

  // ── Copy hostel rates across batches ─────────────────────────────────────
  const copyAcrossBatches = (course, hostel, field, value) => {
    const batches = COURSE_STRUCTURE[course]
    const updates = {}
    batches.forEach(batch => {
      const key = rowKey(sessionYear, course, batch, hostel)
      updates[key] = { ...structures[key], [field]: value, dirty: true }
    })
    setStructures(prev => ({ ...prev, ...updates }))
    setSaved(false)
  }

  // ── Save all dirty rows ───────────────────────────────────────────────────
  const saveAll = async () => {
    setSaving(true); setError(null); setSaved(false)
    try {
      const dirtyRows = Object.entries(structures)
        .filter(([, v]) => v.dirty)
        .map(([key, v]) => {
          const [session, course, batch, hostel] = key.split('__')
          return {
            session_year: session, course, batch, hostel_type: hostel,
            flat_fee: v.flat_fee, course_fee: v.course_fee, admission_fee: v.admission_fee,
          }
        })

      if (!dirtyRows.length) { setSaving(false); setSaved(true); return }

      const { error: e } = await supabase
        .from('fee_structures')
        .upsert(dirtyRows, { onConflict: 'session_year,course,batch,hostel_type', ignoreDuplicates: false })

      if (e) throw e

      clearFeeRateCache() // ← bust cache so modals pick up new rates immediately

      // Clear dirty flags
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

  // ── Copy session ──────────────────────────────────────────────────────────
  const copyFromPrevSession = async () => {
    const prevSession = SESSION_YEARS[SESSION_YEARS.indexOf(sessionYear) - 1]
    if (!prevSession) return alert('No previous session available.')
    const { data, error: e } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('session_year', prevSession)
    if (e || !data?.length) { alert('No data found for ' + prevSession); return }

    const updates = {}
    data.forEach(row => {
      const key = rowKey(sessionYear, row.course, row.batch, row.hostel_type)
      updates[key] = { flat_fee: row.flat_fee, course_fee: row.course_fee, admission_fee: row.admission_fee, id: null, dirty: true }
    })
    setStructures(prev => ({ ...prev, ...updates }))
    setSaved(false)
  }

  // ── Dirty count ───────────────────────────────────────────────────────────
  const dirtyCount = Object.values(structures).filter(v => v.dirty).length
  const courseColor = COURSE_COLORS[activeCourse] || COURSE_COLORS.Sainik
  const batches     = COURSE_STRUCTURE[activeCourse]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px', fontFamily: "'Outfit', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: C.slate[400], marginBottom: 4 }}>Admin Settings</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>Fee Structure Setup</div>
            <div style={{ fontSize: 13, color: C.slate[400], marginTop: 3 }}>Configure flat fee, course fee and admission fee per course, batch and hostel type</div>
          </div>
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

      {/* ── Alerts ── */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 13, color: '#b91c1c', fontWeight: 600 }}>❌ {error}</span>
          <button type="button" onClick={() => setError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}>×</button>
        </div>
      )}
      {saved && (
        <div style={{ background: '#ecfdf5', border: '1.5px solid #6ee7b7', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, fontWeight: 700, color: '#065f46' }}>
          ✅ Fee structure saved successfully for {sessionYear}
        </div>
      )}

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

          {/* Course header */}
          <div style={{ background: courseColor.light, borderBottom: `2px solid ${courseColor.accent}20`, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 24, background: courseColor.accent, borderRadius: 2 }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: courseColor.accent }}>{activeCourse}</div>
            <div style={{ fontSize: 12, color: C.slate[400], marginLeft: 4 }}>
              {batches.length} batch{batches.length > 1 ? 'es' : ''} · {sessionYear}
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr', gap: 0, background: C.slate[50], borderBottom: `1px solid ${C.slate[200]}`, padding: '8px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.slate[400], textTransform: 'uppercase', letterSpacing: '.06em' }}>Batch / Hostel</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.emerald,    textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right', paddingRight: 12 }}>Flat Fee /mo</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.indigo,     textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right', paddingRight: 12 }}>Course Fee /mo</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.amber,      textTransform: 'uppercase', letterSpacing: '.06em', textAlign: 'right', paddingRight: 12 }}>Admission Fee</div>
          </div>

          {/* Rows */}
          {batches.map((batch, bi) => (
            <div key={batch}>
              {/* Batch label */}
              {batches.length > 1 && (
                <div style={{ padding: '10px 20px 6px', background: `${courseColor.accent}08`, borderTop: bi > 0 ? `1px solid ${C.slate[100]}` : 'none' }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: courseColor.accent, textTransform: 'uppercase', letterSpacing: '.06em' }}>{batch}</span>
                </div>
              )}

              {HOSTEL_TYPES.map((hostel, hi) => {
                const key  = rowKey(sessionYear, activeCourse, batch, hostel)
                const row  = structures[key] || { flat_fee: 0, course_fee: 0, admission_fee: 6000, dirty: false }
                const hc   = HOSTEL_COLORS[hostel]
                return (
                  <div key={hostel} style={{
                    display: 'grid', gridTemplateColumns: '160px 1fr 1fr 1fr',
                    alignItems: 'center', gap: 0,
                    padding: '10px 20px',
                    borderTop: hi > 0 ? `1px solid ${C.slate[100]}` : 'none',
                    background: row.dirty ? `${C.amber}08` : 'white',
                    transition: 'background .2s',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <HostelBadge type={hostel} />
                      {row.dirty && <span style={{ fontSize: 9, fontWeight: 800, color: C.amber, background: '#fef3c7', padding: '1px 5px', borderRadius: 3 }}>EDITED</span>}
                    </div>
                    <div style={{ paddingRight: 12 }}>
                      <AmtInput value={row.flat_fee} color={C.emerald}
                        onChange={v => updateField(activeCourse, batch, hostel, 'flat_fee', v)} />
                    </div>
                    <div style={{ paddingRight: 12 }}>
                      <AmtInput value={row.course_fee} color={C.indigo}
                        onChange={v => updateField(activeCourse, batch, hostel, 'course_fee', v)} />
                    </div>
                    <div style={{ paddingRight: 12 }}>
                      <AmtInput value={row.admission_fee} color={C.amber}
                        onChange={v => updateField(activeCourse, batch, hostel, 'admission_fee', v)} />
                    </div>
                  </div>
                )
              })}

              {/* Quick-fill row — copy one hostel type's flat fee across all hostel types for this batch */}
              {batches.length > 1 && (
                <div style={{ padding: '6px 20px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, color: C.slate[400], fontWeight: 600 }}>Quick fill:</span>
                  {HOSTEL_TYPES.map(h => {
                    const k = rowKey(sessionYear, activeCourse, batch, h)
                    const r = structures[k] || {}
                    return (
                      <button key={h} type="button"
                        onClick={() => {
                          HOSTEL_TYPES.forEach(targetH => {
                            if (targetH !== h) {
                              // Only copy flat_fee as a reference; user should set individually
                            }
                          })
                          // Just a visual hint — no auto-copy to avoid mistakes
                        }}
                        style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: `1px solid ${C.slate[200]}`, background: C.slate[50], cursor: 'default', color: C.slate[400], fontFamily: 'inherit' }}>
                        {h.split(' ')[0]}: ₹{(r.flat_fee || 0).toLocaleString('en-IN')} / ₹{(r.course_fee || 0).toLocaleString('en-IN')}
                      </button>
                    )
                  })}
                </div>
              )}
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

      {/* ── Legend ── */}
      <div style={{ marginTop: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, color: C.slate[400], display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 10, height: 10, background: `${C.amber}20`, border: `1px solid ${C.amber}40`, borderRadius: 2 }} />
          Unsaved changes
        </div>
        <div style={{ fontSize: 11, color: C.slate[400] }}>
          Changes apply to <strong>{sessionYear}</strong> session only
        </div>
        <div style={{ fontSize: 11, color: C.slate[400] }}>
          Flat fee = monthly hostel/facility fee · Course fee = monthly tuition fee
        </div>
      </div>
    </div>
  )
}